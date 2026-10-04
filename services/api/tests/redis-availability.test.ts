// EDITOR_FINDINGS #2: with Redis down, POST /render hung forever (node-redis
// retries the initial connect indefinitely and queues commands offline) while
// /health still said "ok". Requests must fail fast with 503 instead, and the
// health report must reflect Redis.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const connect = vi.fn();
const ping = vi.fn();
const hSet = vi.fn();
const rPush = vi.fn();
const createClient = vi.fn(() => ({ on: vi.fn(), connect, ping, hSet, rPush }));

vi.mock('redis', () => ({ createClient }));

class ClientOfflineError extends Error {
  constructor() {
    super('The client is offline');
  }
}

const JOB = { jobId: 'j1', projectId: 'p1', sceneFile: 'scene.py', sceneName: 'MainScene' };

describe('redis availability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('REDIS_CONNECT_TIMEOUT_MS', '50');
    for (const f of [connect, ping, hSet, rPush, createClient]) f.mockClear();
    connect.mockReset();
    ping.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('rejects enqueue with RedisUnavailableError when Redis never connects', async () => {
    connect.mockReturnValue(new Promise(() => {})); // ENOTFOUND → retries forever
    const { enqueueRenderJob, RedisUnavailableError } = await import('../src/queue.js');
    const started = Date.now();
    await expect(enqueueRenderJob(JOB)).rejects.toBeInstanceOf(RedisUnavailableError);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(hSet).not.toHaveBeenCalled();
  });

  it('creates the client with the offline queue disabled', async () => {
    connect.mockResolvedValue(undefined);
    const { getRedisClient } = await import('../src/queue.js');
    await getRedisClient();
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ disableOfflineQueue: true })
    );
  });

  it('recovers once Redis comes back after an initial timeout', async () => {
    let resolveConnect!: () => void;
    connect.mockReturnValue(new Promise<void>((r) => (resolveConnect = r)));
    const { getRedisClient, RedisUnavailableError } = await import('../src/queue.js');
    await expect(getRedisClient()).rejects.toBeInstanceOf(RedisUnavailableError);
    resolveConnect();
    await expect(getRedisClient()).resolves.toBeTruthy();
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('classifies offline/unavailable errors as 503-worthy', async () => {
    const { isRedisUnavailableError, RedisUnavailableError } = await import('../src/queue.js');
    expect(isRedisUnavailableError(new RedisUnavailableError())).toBe(true);
    expect(isRedisUnavailableError(new ClientOfflineError())).toBe(true);
    class ConnectionTimeoutError extends Error {}
    class ReconnectStrategyError extends Error {}
    expect(isRedisUnavailableError(new ConnectionTimeoutError('t'))).toBe(true);
    expect(isRedisUnavailableError(new ReconnectStrategyError('r'))).toBe(true);
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    expect(isRedisUnavailableError(refused)).toBe(true);
    expect(isRedisUnavailableError(new Error('boom'))).toBe(false);
    expect(new RedisUnavailableError().status).toBe(503);
  });

  it('health report is ok when Redis answers PING', async () => {
    connect.mockResolvedValue(undefined);
    ping.mockResolvedValue('PONG');
    const { getHealthReport } = await import('../src/queue.js');
    await expect(getHealthReport()).resolves.toMatchObject({ status: 'ok', redis: 'ok' });
  });

  it('health report is degraded when Redis is unreachable', async () => {
    connect.mockReturnValue(new Promise(() => {}));
    const { getHealthReport } = await import('../src/queue.js');
    await expect(getHealthReport()).resolves.toMatchObject({
      status: 'degraded',
      redis: 'unavailable',
    });
  });

  it('health report is degraded when PING hangs', async () => {
    connect.mockResolvedValue(undefined);
    ping.mockReturnValue(new Promise(() => {}));
    const { getHealthReport } = await import('../src/queue.js');
    await expect(getHealthReport()).resolves.toMatchObject({ redis: 'unavailable' });
  });
});
