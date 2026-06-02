import { describe, it, expect, beforeEach } from 'vitest';
import { store, actions } from '../../src/store/project.js';

beforeEach(() => {
  actions.newProject('Test', 'visual');
  actions.commitState();
});

describe('addPathMoveClip', () => {
  it('creates a path_move clip with given points', () => {
    const obj = actions.addObject('circle', 960, 540);
    const pts = [{ x: 100, y: 100 }, { x: 500, y: 300 }, { x: 900, y: 100 }];
    const clip = actions.addPathMoveClip(obj.id, pts);
    expect(clip).not.toBeNull();
    expect(clip.type).toBe('path_move');
    expect(clip.path).toHaveLength(3);
    expect(clip.path[0]).toEqual({ x: 100, y: 100 });
  });

  it('returns null for fewer than 2 points', () => {
    const obj = actions.addObject('circle', 960, 540);
    const result = actions.addPathMoveClip(obj.id, [{ x: 100, y: 100 }]);
    expect(result).toBeNull();
  });

  it('returns null for missing sourceId', () => {
    const result = actions.addPathMoveClip(null, [{ x: 0, y: 0 }, { x: 100, y: 100 }]);
    expect(result).toBeNull();
  });
});
