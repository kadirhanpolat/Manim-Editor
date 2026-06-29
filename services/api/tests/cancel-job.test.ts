import { beforeEach, describe, expect, it, vi } from 'vitest';

const lRange = vi.fn();
const lRem = vi.fn();
const hGetAll = vi.fn();
const hSet = vi.fn();

vi.mock('redis', () => ({
  createClient: () => ({
    on: vi.fn(),
    connect: vi.fn(),
    lLen: vi.fn(),
    keys: vi.fn(),
    hGetAll,
    hSet,
    rPush: vi.fn(),
    lRange,
    lRem,
  }),
}));

describe('cancel render job', () => {
  beforeEach(() => {
    lRange.mockReset();
    lRem.mockReset();
    hGetAll.mockReset();
    hSet.mockReset();
  });

  it('removes a queued job from the queue and marks it canceled', async () => {
    hGetAll.mockResolvedValue({ status: 'queued' });
    lRange.mockResolvedValue([JSON.stringify({ jobId: 'job_1' })]);
    lRem.mockResolvedValue(1);

    const { cancelRenderJob } = await import('../src/queue.js');
    await expect(cancelRenderJob('job_1')).resolves.toMatchObject({
      jobId: 'job_1',
      status: 'canceled',
      removedFromQueue: true,
    });
    expect(hSet).toHaveBeenCalled();
  });

  it('marks a running job as canceling without removing it from the queue', async () => {
    hGetAll.mockResolvedValue({ status: 'running' });

    const { cancelRenderJob } = await import('../src/queue.js');
    await expect(cancelRenderJob('job_2')).resolves.toMatchObject({
      jobId: 'job_2',
      status: 'canceling',
      removedFromQueue: false,
    });
    expect(lRem).not.toHaveBeenCalled();
    expect(hSet).toHaveBeenCalledWith(
      'render:job:job_2',
      expect.objectContaining({
        status: 'canceling',
        cancelRequested: '1',
      })
    );
  });

  it('refuses to cancel finished jobs', async () => {
    hGetAll.mockResolvedValue({ status: 'completed' });

    const { cancelRenderJob } = await import('../src/queue.js');
    await expect(cancelRenderJob('job_3')).resolves.toMatchObject({
      jobId: 'job_3',
      status: 'finished',
      removedFromQueue: false,
    });
    expect(hSet).not.toHaveBeenCalled();
  });
});
