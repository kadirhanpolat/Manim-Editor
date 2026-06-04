import { describe, it, expect } from 'vitest';
import { project3D, unprojectIso, perspectiveScale } from '../../src/engine/projection3d.js';

describe('perspectiveScale', () => {
  it('is 1 in orthographic mode', () => {
    expect(perspectiveScale({ x3d: 4, y3d: 0, z3d: 0 }, { phi: 90, theta: 0, mode: 'orthographic', focalDistance: 8 })).toBe(1);
  });
  it('magnifies nearer the camera and shrinks farther (phi=90,theta=0 -> n=+X)', () => {
    const cam = { phi: 90, theta: 0, mode: 'perspective', focalDistance: 8 };
    expect(perspectiveScale({ x3d: 4, y3d: 0, z3d: 0 }, cam)).toBeCloseTo(2, 3);       // d=4 -> 8/(8-4)
    expect(perspectiveScale({ x3d: -4, y3d: 0, z3d: 0 }, cam)).toBeCloseTo(8 / 12, 3); // d=-4 -> 8/12
    expect(perspectiveScale({ x3d: 0, y3d: 0, z3d: 0 }, cam)).toBe(1);                 // origin unchanged
  });
});

describe('project3D', () => {
  const cx = 100, cy = 100, scale = 10;

  it('phi=0, theta=-90 -> classic XY (X right, Y up)', () => {
    const p = project3D({ x3d: 2, y3d: 3, z3d: 5 },
      { phi: 0, theta: -90, zoom: 1, mode: 'orthographic' }, cx, cy, scale);
    expect(p.px).toBeCloseTo(cx + 2 * scale, 3);
    expect(p.py).toBeCloseTo(cy - 3 * scale, 3);
  });

  it('phi=90 -> world Z maps to screen up', () => {
    const p = project3D({ x3d: 1, y3d: 9, z3d: 4 },
      { phi: 90, theta: -90, zoom: 1, mode: 'orthographic' }, cx, cy, scale);
    expect(p.px).toBeCloseTo(cx + 1 * scale, 3);
    expect(p.py).toBeCloseTo(cy - 4 * scale, 3);
  });

  it('perspective magnifies points nearer the camera (f>1)', () => {
    const cam = { phi: 60, theta: -45, zoom: 1, mode: 'perspective', focalDistance: 8 };
    const ortho = { ...cam, mode: 'orthographic' };
    const near = project3D({ x3d: 1, y3d: 0, z3d: 0 }, cam, cx, cy, scale);
    const nearO = project3D({ x3d: 1, y3d: 0, z3d: 0 }, ortho, cx, cy, scale);
    const distP = Math.hypot(near.px - cx, near.py - cy);
    const distO = Math.hypot(nearO.px - cx, nearO.py - cy);
    expect(distP).toBeGreaterThan(distO);
  });
});

describe('unprojectIso (orthographic, y fixed)', () => {
  it('round-trips x3d/z3d with y held constant', () => {
    const cam = { phi: 65, theta: -40, zoom: 1, mode: 'orthographic' };
    const cx = 100, cy = 100, scale = 10, yKnown = 1.5;
    const orig = { x3d: 2.3, y3d: yKnown, z3d: -1.7 };
    const scr = project3D(orig, cam, cx, cy, scale);
    const back = unprojectIso(scr.px, scr.py, cam, cx, cy, scale, yKnown);
    expect(back.x3d).toBeCloseTo(orig.x3d, 3);
    expect(back.z3d).toBeCloseTo(orig.z3d, 3);
  });
});
