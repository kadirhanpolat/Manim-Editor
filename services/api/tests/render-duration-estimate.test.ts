import { beforeEach, describe, expect, it, vi } from 'vitest';

const keys = vi.fn();
const hGetAll = vi.fn();

vi.mock('redis', () => ({
  createClient: () => ({
    on: vi.fn(),
    connect: vi.fn(),
    keys,
    hGetAll,
    hSet: vi.fn(),
    rPush: vi.fn(),
    lLen: vi.fn(),
    lRange: vi.fn(),
  }),
}));

describe('render duration estimate', () => {
  beforeEach(() => {
    keys.mockReset();
    hGetAll.mockReset();
  });

  it('averages recent completed render durations for a project', async () => {
    keys.mockResolvedValue([
      'render:job:a',
      'render:job:b',
      'render:job:c',
      'render:job:other',
    ]);
    hGetAll.mockImplementation(async (key: string) => {
      if (key === 'render:job:a') {
        return {
          projectId: 'proj-1',
          status: 'completed',
          startedAt: '2026-06-29T10:00:00.000Z',
          completedAt: '2026-06-29T10:00:10.000Z',
        };
      }
      if (key === 'render:job:b') {
        return {
          projectId: 'proj-1',
          status: 'completed',
          startedAt: '2026-06-29T10:05:00.000Z',
          completedAt: '2026-06-29T10:05:20.000Z',
        };
      }
      if (key === 'render:job:c') {
        return {
          projectId: 'proj-1',
          status: 'completed',
          startedAt: '2026-06-29T10:10:00.000Z',
          completedAt: '2026-06-29T10:10:30.000Z',
        };
      }
      if (key === 'render:job:other') {
        return {
          projectId: 'proj-2',
          status: 'completed',
          startedAt: '2026-06-29T10:00:00.000Z',
          completedAt: '2026-06-29T10:00:50.000Z',
        };
      }
      return {};
    });

    const { getProjectRenderDurationEstimate } = await import('../src/queue.js');
    await expect(getProjectRenderDurationEstimate('proj-1')).resolves.toEqual({
      estimatedDurationMs: 20_000,
      sampleCount: 3,
    });
  });

  it('returns null until enough completed renders exist', async () => {
    keys.mockResolvedValue(['render:job:a', 'render:job:b']);
    hGetAll.mockResolvedValue({
      projectId: 'proj-1',
      status: 'completed',
      startedAt: '2026-06-29T10:00:00.000Z',
      completedAt: '2026-06-29T10:00:10.000Z',
    });

    const { getProjectRenderDurationEstimate } = await import('../src/queue.js');
    await expect(getProjectRenderDurationEstimate('proj-1')).resolves.toBe(null);
  });
});
