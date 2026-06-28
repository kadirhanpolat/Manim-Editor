import { describe, it, expect } from 'vitest';
import { snapPoint, stageSnapCandidates } from '../../src/engine/snap.js';

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

describe('stageSnapCandidates', () => {
  it('adds grid candidates in canvas coordinates', () => {
    const candidates = stageSnapCandidates(
      { width: 1920, height: 1080, gridSize: 4, snapToGrid: true },
      0.5,
      10,
      20
    );
    expect(candidates).toContainEqual({ x: 10 });
    expect(candidates).toContainEqual({ x: 250 });
    expect(candidates).toContainEqual({ x: 970 });
    expect(candidates).toContainEqual({ y: 20 });
    expect(candidates).toContainEqual({ y: 155 });
    expect(candidates).toContainEqual({ y: 560 });
  });

  it('adds center candidates independently from grid candidates', () => {
    const candidates = stageSnapCandidates(
      { width: 1920, height: 1080, gridSize: 4, snapToCenter: true },
      0.5,
      10,
      20
    );
    expect(candidates).toEqual([{ x: 490 }, { y: 290 }]);
  });

  it('returns no candidates when grid and center snapping are disabled', () => {
    expect(stageSnapCandidates({ width: 1920, height: 1080, gridSize: 4 }, 1, 0, 0)).toEqual([]);
  });
});
