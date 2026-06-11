import { describe, it, expect } from 'vitest';
import { snapPoint } from '../../src/engine/snap.js';

describe('snapPoint', () => {
  it('returns original coords when no candidates', () => {
    const r = snapPoint(100, 200, [], 8);
    expect(r).toEqual({ x: 100, y: 200, snappedX: false, snappedY: false });
  });

  it('snaps X when within threshold', () => {
    const r = snapPoint(103, 200, [{ x: 100 }], 8);
    expect(r.x).toBe(100);
    expect(r.snappedX).toBe(true);
    expect(r.y).toBe(200);
    expect(r.snappedY).toBe(false);
  });

  it('snaps Y when within threshold', () => {
    const r = snapPoint(100, 207, [{ y: 200 }], 8);
    expect(r.y).toBe(200);
    expect(r.snappedY).toBe(true);
  });

  it('does not snap when beyond threshold', () => {
    const r = snapPoint(110, 210, [{ x: 100, y: 200 }], 8);
    expect(r.snappedX).toBe(false);
    expect(r.snappedY).toBe(false);
  });

  it('snaps both X and Y simultaneously', () => {
    const r = snapPoint(103, 203, [{ x: 100, y: 200 }], 8);
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
    expect(r.snappedX).toBe(true);
    expect(r.snappedY).toBe(true);
  });

  it('uses first matching candidate (priority order)', () => {
    const r = snapPoint(105, 200, [{ x: 102 }, { x: 104 }], 8);
    expect(r.x).toBe(102);
  });

  it('default threshold is 8 — snaps at distance 7', () => {
    const r = snapPoint(107, 200, [{ x: 100 }]); // distance = 7 ≤ 8
    expect(r.snappedX).toBe(true);
    expect(r.x).toBe(100);
  });
});
