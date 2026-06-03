/**
 * Redis Queue Manager
 */

import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;

/**
 * Get or create Redis client.
 */
export async function getRedisClient() {
  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on('error', (err) => console.error('[Redis Error]', err));
    await client.connect();
    console.log('[Redis] Connected to', REDIS_URL);
  }
  return client;
}

/**
 * Enqueue a render job.
 * @param {Object} job - The job payload
 * @returns {string} The job ID
 */
export async function enqueueRenderJob(job) {
  const redis = await getRedisClient();
  
  // Create job record
  await redis.hSet(`render:job:${job.jobId}`, {
    status: 'queued',
    projectId: job.projectId,
    quality: job.quality || 'medium',
    createdAt: new Date().toISOString()
  });
  
  // Add to queue
  await redis.rPush('render:queue', JSON.stringify(job));
  
  return job.jobId;
}

/**
 * Get job status.
 * @param {string} jobId - The job ID
 * @returns {Object|null} Job status or null if not found
 */
export async function getJobStatus(jobId) {
  const redis = await getRedisClient();
  const job = await redis.hGetAll(`render:job:${jobId}`);

  if (!job || Object.keys(job).length === 0) {
    return null;
  }

  return job;
}

/**
 * Enqueue an audio TTS job.
 * @param {Object} job - { jobId, clipId, type: 'gtts'|'coqui', text, lang }
 * @returns {string} The job ID
 */
export async function enqueueAudioJob(job) {
  const redis = await getRedisClient();

  // Validate job type
  if (!['gtts', 'coqui'].includes(job.type)) {
    throw new Error(`Invalid audio job type: ${job.type}`);
  }

  // Create job record
  // Note: audio jobs use 'pending' status (not 'queued') — lifecycle is pending → running → ready/error
  await redis.hSet(`audio:job:${job.jobId}`, {
    status: 'pending',
    clipId: job.clipId,
    type: job.type,
    text: job.text || '',
    lang: job.lang || 'tr',
    createdAt: new Date().toISOString()
  });

  // Add to appropriate queue based on type
  const queueKey = job.type === 'coqui' ? 'audio:queue:coqui' : 'audio:queue:gtts';
  await redis.rPush(queueKey, JSON.stringify(job));

  return job.jobId;
}

/**
 * Get audio job status.
 * @param {string} jobId - The job ID
 * @returns {Object|null} Job status or null if not found
 */
export async function getAudioJobStatus(jobId) {
  const redis = await getRedisClient();
  const job = await redis.hGetAll(`audio:job:${jobId}`);

  if (!job || Object.keys(job).length === 0) {
    return null;
  }

  return job;
}

/**
 * Update fields on an audio job hash.
 * @param {string} jobId - The job ID
 * @param {Object} updates - Key-value pairs to update
 */
export async function updateAudioJobStatus(jobId, updates) {
  const redis = await getRedisClient();

  // Filter out null/undefined values and ensure remaining values are strings
  const safe = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v != null) safe[k] = String(v);
  }

  await redis.hSet(`audio:job:${jobId}`, safe);
}
