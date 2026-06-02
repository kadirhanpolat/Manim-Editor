import { describe, it, expect, beforeEach } from 'vitest';
import { store, actions } from '../../src/store/project.js';

beforeEach(() => {
  actions.newProject('Test', 'visual');
  actions.commitState();
});

describe('parallel clip defaults', () => {
  it('new clips have parallel=false and lag_ratio=0', () => {
    const obj = actions.addObject('circle', 960, 540);
    const clip = actions.addClip(0, {
      type: 'move', sourceId: obj.id, startTime: 0, duration: 1,
      params: { targetX: 100, targetY: 100 }
    });
    expect(clip.parallel).toBe(false);
    expect(clip.lag_ratio).toBe(0);
  });

  it('clip can be set to parallel', () => {
    const obj = actions.addObject('circle', 960, 540);
    const clip = actions.addClip(0, {
      type: 'move', sourceId: obj.id, startTime: 0, duration: 1,
      params: { targetX: 100, targetY: 100 }, parallel: true, lag_ratio: 0.2
    });
    expect(clip.parallel).toBe(true);
    expect(clip.lag_ratio).toBe(0.2);
  });
});
