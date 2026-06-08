import { describe, it, expect, beforeEach } from 'vitest';
import { PlaybackEngine } from '../../src/engine/playback.js';

let engine, objId, obj;
beforeEach(() => {
  engine = new PlaybackEngine();
  objId = 'obj1';
  obj = { id: objId, type: 'circle', x: 960, y: 540, fill: '#4488ff', rotation: 0, opacity: 1 };
});

function overridesAt(clip, t) {
  const objectMap = new Map([[objId, obj]]);
  const r = engine._evaluateClip(clip, t, objectMap);
  return r ? r.overrides : null;
}

describe('emphasis playback', () => {
  it('Indicate peaks at mid and returns to base', () => {
    const c = {
      id: 'c1',
      type: 'indicate',
      sourceId: objId,
      startTime: 0,
      duration: 1,
      easing: 'linear',
      params: { color: '#FFFF00', scale_factor: 1.4 },
    };
    const mid = overridesAt(c, 0.5);
    expect(mid.scaleX).toBeCloseTo(1.4, 1);
    const start = overridesAt(c, 0.001);
    expect(start.scaleX).toBeCloseTo(1.0, 1);
  });

  it('Wiggle rotation oscillates (sign flips across the period)', () => {
    const c = {
      id: 'c2',
      type: 'wiggle',
      sourceId: objId,
      startTime: 0,
      duration: 1,
      easing: 'linear',
      params: { scale_value: 1.1, rotation_angle: 10, n_wiggles: 2 },
    };
    const base = obj.rotation || 0;
    const a = overridesAt(c, 0.125).rotation - base;
    const b = overridesAt(c, 0.375).rotation - base;
    expect(Math.sign(a)).not.toBe(Math.sign(b));
  });

  it('Circumscribe sets an _emphasis overlay descriptor', () => {
    const c = {
      id: 'c3',
      type: 'circumscribe',
      sourceId: objId,
      startTime: 0,
      duration: 1,
      easing: 'linear',
      params: { color: '#00FF00', shape: 'Rectangle', fade_out: false, time_width: 0.3 },
    };
    const ov = overridesAt(c, 0.5);
    expect(ov._emphasis).toBeTruthy();
    expect(ov._emphasis.kind).toBe('circumscribe');
    expect(ov._emphasis.shape).toBe('Rectangle');
    expect(ov._emphasis.progress).toBeCloseTo(0.5, 1);
  });
});
