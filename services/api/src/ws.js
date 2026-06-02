import { WebSocketServer } from 'ws';
import { getJobStatus } from './queue.js';

const DONE_STATUSES = new Set(['completed', 'failed']);
const subscriptions = new Map(); // jobId -> Set<WebSocket>
const activePolls   = new Set(); // jobId'ler — paralel loop guard

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type === 'subscribe' && msg.jobId) {
        if (!subscriptions.has(msg.jobId)) subscriptions.set(msg.jobId, new Set());
        subscriptions.get(msg.jobId).add(ws);
        if (!activePolls.has(msg.jobId)) {
          activePolls.add(msg.jobId);
          pollUntilDone(msg.jobId).finally(() => activePolls.delete(msg.jobId));
        }
      }
    });

    ws.on('close', () => {
      for (const [jobId, clients] of subscriptions.entries()) {
        clients.delete(ws);
        if (clients.size === 0) subscriptions.delete(jobId);
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

async function pollUntilDone(jobId) {
  let errors = 0;
  while (subscriptions.has(jobId)) {
    await new Promise((r) => setTimeout(r, 500));
    const job = await getJobStatus(jobId).catch(() => { errors++; return null; });
    if (!job) {
      if (errors > 10) { subscriptions.delete(jobId); break; }
      continue;
    }
    errors = 0;
    broadcast(jobId, {
      type: 'job_update',
      jobId,
      status: job.status,
      stdout: job.stdout || '',
      stderr: job.stderr || '',
      error:  job.error  || '',
    });
    if (DONE_STATUSES.has(job.status)) {
      subscriptions.delete(jobId);
      break;
    }
  }
}
