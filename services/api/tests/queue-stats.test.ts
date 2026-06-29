import { beforeEach, describe, expect, it, vi } from 'vitest';

const lLen = vi.fn();
const keys = vi.fn();
const hGetAll = vi.fn();

vi.mock('redis', () => ({
  createClient: () => ({
    on: vi.fn(),
    connect: vi.fn(),
    lLen,
    keys,
    hGetAll,
    hSet: vi.fn(),
    rPush: vi.fn(),
  }),
}));

describe('render queue stats', () => {
  beforeEach(() => {
    lLen.mockReset();
    keys.mockReset();
    hGetAll.mockReset();
    lLen.mockResolvedValue(7);
    keys.mockResolvedValue(['render:worker:one', 'render:worker:two']);
    hGetAll.mockImplementation(async (key: string) => {
      if (key === 'render:worker:one') {
        return {
          workerId: 'one',
          status: 'running',
          heartbeatMs: String(Date.now()),
        };
      }
      return {
        workerId: 'two',
        status: 'running',
        heartbeatMs: String(Date.now() - 120_000),
      };
    });
  });

  it('reports the current render queue depth and worker health', async () => {
    const { getRenderQueueStats } = await import('../src/queue.js');
    await expect(getRenderQueueStats()).resolves.toMatchObject({
      queueDepth: 7,
      workersOnline: 2,
      busyWorkers: 2,
      staleWorkers: 1,
    });
  });
});
