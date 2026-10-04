/**
 * Redis Queue Manager
 */

import { createClient } from 'redis';
import type { RenderOptions } from './compiler/validator.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
/** How long a request waits for Redis before failing with 503. */
const connectTimeoutMs = (): number => Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 3000;

type RedisClient = ReturnType<typeof createClient>;
let client: RedisClient | null = null;
/** Pending initial connect; node-redis keeps retrying it in the background. */
let connecting: Promise<void> | null = null;

/** Redis is unreachable — surfaced to clients as HTTP 503 by the error handler. */
export class RedisUnavailableError extends Error {
  readonly status = 503;
  constructor(message = 'Render queue unavailable: cannot reach Redis') {
    super(message);
    this.name = 'RedisUnavailableError';
  }
}

/** node-redis error classes that mean the server is unreachable. */
const REDIS_DOWN_ERRORS = new Set([
  'ClientOfflineError',
  'ClientClosedError',
  'SocketClosedUnexpectedlyError',
  'ConnectionTimeoutError',
  'ReconnectStrategyError',
]);
/** Socket-level codes surfaced when the Redis host is unreachable. */
const REDIS_DOWN_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

/**
 * True for errors meaning "Redis is down" rather than a bug: our own timeout,
 * or node-redis rejecting a command while disconnected (offline queue off).
 */
export function isRedisUnavailableError(err: unknown): boolean {
  if (err instanceof RedisUnavailableError) return true;
  if (!(err instanceof Error)) return false;
  const code = (err as Error & { code?: unknown }).code;
  if (typeof code === 'string' && REDIS_DOWN_CODES.has(code)) return true;
  return REDIS_DOWN_ERRORS.has(err.constructor.name) || REDIS_DOWN_ERRORS.has(err.name);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RedisUnavailableError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Get or create the Redis client. The first connect is started once and
 * retried by node-redis in the background; each caller waits at most
 * REDIS_CONNECT_TIMEOUT_MS for it and otherwise gets RedisUnavailableError,
 * so a missing Redis can never hang a request. The offline queue is disabled
 * for the same reason: after a later disconnect, commands fail immediately
 * instead of waiting for a reconnect that may never come.
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (!client) {
    const c = createClient({ url: REDIS_URL, disableOfflineQueue: true });
    c.on('error', (err: unknown) => console.error('[Redis Error]', err));
    client = c;
    connecting = c.connect().then(
      () => console.log('[Redis] Connected to', REDIS_URL),
      (err: unknown) => {
        // connect gave up for good — let the next call build a fresh client
        client = null;
        connecting = null;
        throw err;
      }
    );
    connecting.catch(() => {}); // rejection is observed via withTimeout below
  }
  const current = client;
  if (connecting) {
    try {
      await withTimeout(connecting, connectTimeoutMs());
    } catch (err) {
      throw err instanceof RedisUnavailableError ? err : new RedisUnavailableError();
    }
    connecting = null;
  }
  return current;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  redis: 'ok' | 'unavailable';
  timestamp: string;
}

/** Liveness + Redis reachability (bounded by the connect timeout). */
export async function getHealthReport(): Promise<HealthReport> {
  let redis: HealthReport['redis'] = 'ok';
  try {
    const c = await getRedisClient();
    await withTimeout(c.ping(), connectTimeoutMs());
  } catch {
    redis = 'unavailable';
  }
  return {
    status: redis === 'ok' ? 'ok' : 'degraded',
    redis,
    timestamp: new Date().toISOString(),
  };
}

export interface RenderJob {
  jobId: string;
  projectId: string;
  sceneFile: string;
  sceneName: string;
  quality?: string;
  /** Validated export options (Wave 1 Track B). Absent on legacy payloads. */
  options?: RenderOptions;
}

export interface AudioJob {
  jobId: string;
  clipId: string;
  type: 'gtts' | 'coqui';
  text: string;
  lang?: string;
}

export interface RenderQueueStats {
  queueDepth: number;
  workersOnline: number;
  busyWorkers: number;
  staleWorkers: number;
}

export interface CancelRenderJobResult {
  jobId: string;
  status: 'canceled' | 'canceling' | 'not_found' | 'finished';
  removedFromQueue: boolean;
}

export interface RenderDurationEstimate {
  estimatedDurationMs: number;
  sampleCount: number;
}

/**
 * Enqueue a render job.
 */
export async function enqueueRenderJob(job: RenderJob): Promise<string> {
  const redis = await getRedisClient();

  // Create job record
  await redis.hSet(`render:job:${job.jobId}`, {
    status: 'queued',
    projectId: job.projectId,
    quality: job.quality ?? 'medium',
    format: job.options?.format ?? 'mp4',
    resolution: job.options?.resolution ?? '1920x1080',
    fps: String(job.options?.fps ?? 60),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Add to queue
  await redis.rPush('render:queue', JSON.stringify(job));

  return job.jobId;
}

/**
 * Get job status.
 */
export async function getJobStatus(jobId: string): Promise<Record<string, string> | null> {
  const redis = await getRedisClient();
  const job = await redis.hGetAll(`render:job:${jobId}`);

  if (!job || Object.keys(job).length === 0) {
    return null;
  }

  if (job.status === 'queued') {
    const queue = await redis.lRange('render:queue', 0, -1);
    const position = queue.findIndex((entry) => {
      try {
        const parsed = JSON.parse(entry) as Record<string, unknown>;
        return parsed.jobId === jobId;
      } catch {
        return false;
      }
    });
    if (position >= 0) {
      job.queuePosition = String(position + 1);
    }
  }

  const workerId = job.workerId ?? '';
  if (workerId) {
    const worker = await redis.hGetAll(`render:worker:${workerId}`);
    if (worker && Object.keys(worker).length > 0) {
      job.workerStatus = worker.status ?? '';
      job.workerHeartbeatMs = worker.heartbeatMs ?? '';
      const heartbeatMs = Number(worker.heartbeatMs ?? 0);
      const ageMs = heartbeatMs > 0 ? Date.now() - heartbeatMs : Number.POSITIVE_INFINITY;
      if (ageMs > 90_000 && worker.status !== 'idle') {
        job.stalled = '1';
      }
    }
  }

  return job;
}

/**
 * Estimate render duration from recent successful jobs for a project.
 */
export async function getProjectRenderDurationEstimate(
  projectId: string,
  sampleSize = 5
): Promise<RenderDurationEstimate | null> {
  const redis = await getRedisClient();
  const jobKeys = await redis.keys('render:job:*');
  const samples: { completedAt: number; durationMs: number }[] = [];

  for (const key of jobKeys) {
    const job = await redis.hGetAll(key);
    if (!job || Object.keys(job).length === 0) continue;
    if (job.projectId !== projectId) continue;
    if (job.status !== 'completed') continue;

    const startedAt = Date.parse(job.startedAt ?? '');
    const completedAt = Date.parse(job.completedAt ?? '');
    if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt <= startedAt) {
      continue;
    }

    samples.push({ completedAt, durationMs: completedAt - startedAt });
  }

  if (samples.length < 3) return null;

  samples.sort((a, b) => b.completedAt - a.completedAt);
  const selected = samples.slice(0, Math.max(3, sampleSize));
  const total = selected.reduce((sum, item) => sum + item.durationMs, 0);

  return {
    estimatedDurationMs: Math.round(total / selected.length),
    sampleCount: selected.length,
  };
}

/**
 * Cancel a render job if it is queued or running.
 */
export async function cancelRenderJob(jobId: string): Promise<CancelRenderJobResult> {
  const redis = await getRedisClient();
  const key = `render:job:${jobId}`;
  const job = await redis.hGetAll(key);

  if (!job || Object.keys(job).length === 0) {
    return { jobId, status: 'not_found', removedFromQueue: false };
  }

  const status = job.status ?? '';
  const finished = new Set(['completed', 'failed', 'canceled']);
  if (finished.has(status)) {
    return { jobId, status: 'finished', removedFromQueue: false };
  }

  let removedFromQueue = false;
  if (status === 'queued') {
    const queue = await redis.lRange('render:queue', 0, -1);
    const match = queue.find((entry) => {
      try {
        const parsed = JSON.parse(entry) as Record<string, unknown>;
        return parsed.jobId === jobId;
      } catch {
        return false;
      }
    });
    if (match) {
      const removed = await redis.lRem('render:queue', 1, match);
      removedFromQueue = removed > 0;
    }
  }

  await redis.hSet(key, {
    status: status === 'queued' ? 'canceled' : 'canceling',
    cancelRequested: '1',
    cancelRequestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    jobId,
    status: status === 'queued' ? 'canceled' : 'canceling',
    removedFromQueue,
  };
}

const IDLE_WORKER_GONE_MS = 30_000;

/**
 * Get render queue stats for observability in the UI.
 */
export async function getRenderQueueStats(): Promise<RenderQueueStats> {
  const redis = await getRedisClient();
  const queueDepth = await redis.lLen('render:queue');
  const workerKeys = await redis.keys('render:worker:*');
  const now = Date.now();

  let workersOnline = 0;
  let busyWorkers = 0;
  let staleWorkers = 0;

  for (const key of workerKeys) {
    const worker = await redis.hGetAll(key);
    if (!worker || Object.keys(worker).length === 0) continue;

    const heartbeatMs = Number(worker.heartbeatMs ?? 0);
    const ageMs = heartbeatMs > 0 ? now - heartbeatMs : Number.POSITIVE_INFINITY;
    // An idle worker heartbeats every ~5 s; a silent idle key is a removed
    // container whose key has not expired yet (300 s TTL), not a worker.
    if (worker.status === 'idle' && ageMs > IDLE_WORKER_GONE_MS) continue;

    workersOnline++;
    if (worker.status === 'running') busyWorkers++;
    if (ageMs > 90_000 && worker.status !== 'idle') staleWorkers++;
  }

  return { queueDepth, workersOnline, busyWorkers, staleWorkers };
}

/**
 * Enqueue an audio TTS job.
 */
export async function enqueueAudioJob(job: AudioJob): Promise<string> {
  const redis = await getRedisClient();

  // Validate job type
  if (!(['gtts', 'coqui'] as const).includes(job.type)) {
    throw new Error(`Invalid audio job type: ${job.type}`);
  }

  // Create job record
  // Note: audio jobs use 'pending' status (not 'queued') — lifecycle is pending → running → ready/error
  await redis.hSet(`audio:job:${job.jobId}`, {
    status: 'pending',
    clipId: job.clipId,
    type: job.type,
    text: job.text ?? '',
    lang: job.lang ?? 'tr',
    createdAt: new Date().toISOString(),
  });

  // Add to appropriate queue based on type
  const queueKey = job.type === 'coqui' ? 'audio:queue:coqui' : 'audio:queue:gtts';
  await redis.rPush(queueKey, JSON.stringify(job));

  return job.jobId;
}

/**
 * Get audio job status.
 */
export async function getAudioJobStatus(jobId: string): Promise<Record<string, string> | null> {
  const redis = await getRedisClient();
  const job = await redis.hGetAll(`audio:job:${jobId}`);

  if (!job || Object.keys(job).length === 0) {
    return null;
  }

  return job;
}

/**
 * Update fields on an audio job hash.
 */
export async function updateAudioJobStatus(
  jobId: string,
  updates: Record<string, string | number | null | undefined>
): Promise<void> {
  const redis = await getRedisClient();

  // Filter out null/undefined values and ensure remaining values are strings
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v != null) safe[k] = String(v);
  }

  await redis.hSet(`audio:job:${jobId}`, safe);
}
