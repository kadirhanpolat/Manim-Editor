/**
 * Redis Queue Manager
 */

import { createClient } from 'redis';
import type { RenderOptions } from './compiler/validator.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

type RedisClient = ReturnType<typeof createClient>;
let client: RedisClient | null = null;

/**
 * Get or create Redis client.
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on('error', (err: unknown) => console.error('[Redis Error]', err));
    await client.connect();
    console.log('[Redis] Connected to', REDIS_URL);
  }
  return client;
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

  return job;
}

/**
 * Get render queue stats for observability in the UI.
 */
export async function getRenderQueueStats(): Promise<{ queueDepth: number }> {
  const redis = await getRedisClient();
  const queueDepth = await redis.lLen('render:queue');
  return { queueDepth };
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
