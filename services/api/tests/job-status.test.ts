import { beforeEach, describe, expect, it, vi } from 'vitest';

const lRange = vi.fn();
const hGetAll = vi.fn();

vi.mock('redis', () => ({
  createClient: () => ({
    on: vi.fn(),
    connect: vi.fn(),
    lLen: vi.fn(),
    keys: vi.fn(),
    hGetAll,
    hSet: vi.fn(),
    rPush: vi.fn(),
    lRange,
  }),
}));

describe('job status enrichment', () => {
  beforeEach(() => {
    lRange.mockReset();
    hGetAll.mockReset();
  });

  it('adds queue position for queued jobs', async () => {
    hGetAll.mockResolvedValueOnce({ status: 'queued' });
    lRange.mockResolvedValue([
      JSON.stringify({ jobId: 'job_a' }),
      JSON.stringify({ jobId: 'job_b' }),
      JSON.stringify({ jobId: 'job_c' }),
    ]);

    const { getJobStatus } = await import('../src/queue.js');
    await expect(getJobStatus('job_b')).resolves.toMatchObject({
      status: 'queued',
      queuePosition: '2',
    });
  });

  it('marks a running job as stalled when its worker heartbeat is stale', async () => {
    hGetAll.mockImplementation(async (key: string) => {
      if (key === 'render:job:job_running') {
        return { status: 'running', workerId: 'worker-1' };
      }
      if (key === 'render:worker:worker-1') {
        return {
          workerId: 'worker-1',
          status: 'running',
          heartbeatMs: String(Date.now() - 120_000),
        };
      }
      return {};
    });

    const { getJobStatus } = await import('../src/queue.js');
    await expect(getJobStatus('job_running')).resolves.toMatchObject({
      status: 'running',
      stalled: '1',
      workerStatus: 'running',
    });
  });
});
