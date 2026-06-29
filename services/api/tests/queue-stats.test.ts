import { beforeEach, describe, expect, it, vi } from 'vitest';

const lLen = vi.fn();

vi.mock('redis', () => ({
  createClient: () => ({
    on: vi.fn(),
    connect: vi.fn(),
    lLen,
    hSet: vi.fn(),
    hGetAll: vi.fn(),
    rPush: vi.fn(),
  }),
}));

describe('render queue stats', () => {
  beforeEach(() => {
    lLen.mockReset();
    lLen.mockResolvedValue(7);
  });

  it('reports the current render queue depth', async () => {
    const { getRenderQueueStats } = await import('../src/queue.js');
    await expect(getRenderQueueStats()).resolves.toEqual({ queueDepth: 7 });
  });
});
