import { WebSocketServer } from 'ws';
import { getJobStatus, getAudioJobStatus } from './queue.js';

const DONE_STATUSES = new Set(['completed', 'failed']);
const AUDIO_DONE = new Set(['ready', 'error']);

const subscriptions = new Map(); // jobId -> Set<WebSocket>  (render jobs)
const audioSubscriptions = new Map(); // jobId -> Set<WebSocket>  (audio jobs)
const activePolls = new Set();
const activeAudioPolls = new Set();

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === 'subscribe' && msg.jobId) {
        if (!subscriptions.has(msg.jobId)) subscriptions.set(msg.jobId, new Set());
        subscriptions.get(msg.jobId).add(ws);
        if (!activePolls.has(msg.jobId)) {
          activePolls.add(msg.jobId);
          pollUntilDone(msg.jobId).finally(() => activePolls.delete(msg.jobId));
        }
      }

      if (msg.type === 'subscribe_audio' && msg.jobId) {
        if (!audioSubscriptions.has(msg.jobId)) audioSubscriptions.set(msg.jobId, new Set());
        audioSubscriptions.get(msg.jobId).add(ws);
        if (!activeAudioPolls.has(msg.jobId)) {
          activeAudioPolls.add(msg.jobId);
          pollUntilAudioDone(msg.jobId).finally(() => activeAudioPolls.delete(msg.jobId));
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

function broadcast(jobId, payload) {
  const clients = subscriptions.get(jobId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function broadcastAudioEvent(jobId, payload) {
  const clients = audioSubscriptions.get(jobId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
  audioSubscriptions.delete(jobId);
}

async function pollUntilDone(jobId) {
  let errors = 0;
  while (subscriptions.has(jobId)) {
    await new Promise((r) => setTimeout(r, 500));
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
      status: job.status,
      stdout: job.stdout || '',
      stderr: job.stderr || '',
      error: job.error || '',
    });
    if (DONE_STATUSES.has(job.status)) {
      subscriptions.delete(jobId);
      break;
    }
  }
}

async function pollUntilAudioDone(jobId) {
  let errors = 0;
  while (audioSubscriptions.has(jobId)) {
    await new Promise((r) => setTimeout(r, 500));
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
    if (AUDIO_DONE.has(job.status)) {
      broadcastAudioEvent(jobId, {
        event: job.status === 'ready' ? 'audio_ready' : 'audio_error',
        jobId,
        clipId: job.clipId,
        duration: job.duration ? parseFloat(job.duration) : undefined,
        src: job.status === 'ready' ? `/data/assets/audio/${jobId}.wav` : undefined,
        error: job.error || undefined,
      });
      break;
    }
  }
}
