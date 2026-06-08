import { describe, it, expect } from 'vitest';

const cos30 = Math.cos(Math.PI / 6);
const sin30 = Math.sin(Math.PI / 6);

function iso(x3d, y3d, z3d, cx, cy, scale) {
  const px = (x3d - z3d) * cos30;
  const py = -y3d + (x3d + z3d) * sin30;
  return { px: cx + px * scale, py: cy + py * scale };
}

function top(x3d, z3d, cx2, cy2, scale) {
  return { px: cx2 + x3d * scale, py: cy2 + z3d * scale };
}

describe('iso projection', () => {
  it('origin maps to center', () => {
    const r = iso(0, 0, 0, 100, 100, 50);
    expect(r.px).toBeCloseTo(100);
    expect(r.py).toBeCloseTo(100);
  });

  it('positive x shifts right and down in iso', () => {
    const r = iso(1, 0, 0, 100, 100, 50);
    expect(r.px).toBeGreaterThan(100);
  });

  it('positive y shifts upward', () => {
    const r = iso(0, 1, 0, 100, 100, 50);
    expect(r.py).toBeLessThan(100);
  });
});

describe('top projection', () => {
  it('origin maps to center', () => {
    const r = top(0, 0, 200, 100, 50);
    expect(r.px).toBeCloseTo(200);
    expect(r.py).toBeCloseTo(100);
  });

  it('positive x shifts right', () => {
    const r = top(1, 0, 200, 100, 50);
    expect(r.px).toBeGreaterThan(200);
  });

  it('positive z shifts down in top view', () => {
    const r = top(0, 1, 200, 100, 50);
    expect(r.py).toBeGreaterThan(100);
  });
});
