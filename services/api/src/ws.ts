import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { getJobStatus, getAudioJobStatus } from './queue.js';

const DONE_STATUSES = new Set(['completed', 'failed']);
const AUDIO_DONE = new Set(['ready', 'error']);

const subscriptions = new Map<string, Set<WebSocket>>();
const audioSubscriptions = new Map<string, Set<WebSocket>>();
const activePolls = new Set<string>();
const activeAudioPolls = new Set<string>();

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (data) => {
      let msg: { type?: string; jobId?: string };
      try {
        msg = JSON.parse(data.toString()) as { type?: string; jobId?: string };
      } catch {
        return;
      }

      if (msg.type === 'subscribe' && msg.jobId) {
        const jobId = msg.jobId;
        if (!subscriptions.has(jobId)) subscriptions.set(jobId, new Set());
        subscriptions.get(jobId)!.add(ws);
        if (!activePolls.has(jobId)) {
          activePolls.add(jobId);
          pollUntilDone(jobId).finally(() => activePolls.delete(jobId));
        }
      }

      if (msg.type === 'subscribe_audio' && msg.jobId) {
        const jobId = msg.jobId;
        if (!audioSubscriptions.has(jobId)) audioSubscriptions.set(jobId, new Set());
        audioSubscriptions.get(jobId)!.add(ws);
        if (!activeAudioPolls.has(jobId)) {
          activeAudioPolls.add(jobId);
          pollUntilAudioDone(jobId).finally(() => activeAudioPolls.delete(jobId));
        }
      }
    });

    ws.on('close', () => {
      for (const [jobId, clients] of subscriptions.entries()) {
        clients.delete(ws);
        if (clients.size === 0) subscriptions.delete(jobId);
      }
      for (const [jobId, clients] of audioSubscriptions.entries()) {
        clients.delete(ws);
        if (clients.size === 0) audioSubscriptions.delete(jobId);
      }
    });
  });
}

function broadcast(jobId: string, payload: Record<string, unknown>): void {
  const clients = subscriptions.get(jobId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function broadcastAudioEvent(jobId: string, payload: Record<string, unknown>): void {
  const clients = audioSubscriptions.get(jobId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
  audioSubscriptions.delete(jobId);
}

async function pollUntilDone(jobId: string): Promise<void> {
  let errors = 0;
  while (subscriptions.has(jobId)) {
    await new Promise<void>((r) => setTimeout(r, 500));
    const job = await getJobStatus(jobId).catch(() => {
      errors++;
      return null;
    });
    if (!job) {
      if (errors > 10) {
        subscriptions.delete(jobId);
        break;
      }
      continue;
    }
    errors = 0;
    broadcast(jobId, {
      type: 'job_update',
      jobId,
      status: job['status'],
      stdout: job['stdout'] ?? '',
      stderr: job['stderr'] ?? '',
      error: job['error'] ?? '',
    });
    if (DONE_STATUSES.has(job['status'] ?? '')) {
      subscriptions.delete(jobId);
      break;
    }
  }
}

async function pollUntilAudioDone(jobId: string): Promise<void> {
  let errors = 0;
  while (audioSubscriptions.has(jobId)) {
    await new Promise<void>((r) => setTimeout(r, 500));
    const job = await getAudioJobStatus(jobId).catch(() => {
      errors++;
      return null;
    });
    if (!job) {
      if (errors > 10) {
        audioSubscriptions.delete(jobId);
        break;
      }
      continue;
    }
    errors = 0;
    if (AUDIO_DONE.has(job['status'] ?? '')) {
      broadcastAudioEvent(jobId, {
        event: job['status'] === 'ready' ? 'audio_ready' : 'audio_error',
        jobId,
        clipId: job['clipId'],
        duration: job['duration'] ? parseFloat(job['duration']) : undefined,
        src: job['status'] === 'ready' ? `/data/assets/audio/${jobId}.wav` : undefined,
        error: job['error'] ?? undefined,
      });
      break;
    }
  }
}
