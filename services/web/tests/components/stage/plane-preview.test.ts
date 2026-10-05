// NumberPlane / ComplexPlane preview must draw the grid Manim renders.
// Reference (Manim CE 0.20.1, measured):
//   NumberPlane(x_range=[-2, 2, 0.5], y_range=[-1.5, 1.5, 0.5]) → vertical lines
//   at x = -1.5 … 1.5 (the range ends get none), horizontal at y = -1 … 1.
//   NumberPlane(x_range=[0.5, 4, 1], y_range=[-1, 3, 1]) → the y-axis sits at
//   x = 0.5 (0 is outside the range, so the axis clamps to the nearest end) and
//   vertical lines at 0.5, 1.5, 2.5, 3.5. Lines are BLUE_D (#29ABCA), axes white.
import { describe, it, expect } from 'vitest';
import { makeCtx } from './fixtures.js';
import { planeGridValues, planeGridCfgs } from '../../../src/components/stage/configs/axes.js';

describe('planeGridValues', () => {
  it('steps out from the origin and leaves the range ends empty', () => {
    expect(planeGridValues(-2, 2, 0.5)).toEqual({
      origin: 0,
      values: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
    });
    expect(planeGridValues(-1.5, 1.5, 0.5).values).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it('clamps the origin into the range when 0 is outside it', () => {
    expect(planeGridValues(0.5, 4, 1)).toEqual({ origin: 0.5, values: [0.5, 1.5, 2.5, 3.5] });
    expect(planeGridValues(-5, -1, 1)).toEqual({ origin: -1, values: [-4, -3, -2, -1] });
  });

  it('survives a zero or negative step', () => {
    expect(planeGridValues(-1, 1, 0).values).toEqual([0]);
  });

  it('caps the number of lines (a tiny step must not freeze the canvas)', () => {
    const { values } = planeGridValues(-5, 5, 0.001);
    expect(values.length).toBeLessThanOrEqual(201);
    expect(values).toContain(0);
    expect(planeGridValues(0, 1e6, 1).values.length).toBeLessThanOrEqual(201);
  });
});

describe('planeGridCfgs', () => {
  const ctx = makeCtx({ vs: 1 });
  const plane = {
    id: 'p',
    type: 'numberplane',
    x: 0,
    y: 0,
    width: 1080,
    height: 810,
    xRange: [-2, 2, 0.5],
    yRange: [-1.5, 1.5, 0.5],
  };

  it('draws one line per grid value, positioned like Manim', () => {
    const { grid } = planeGridCfgs(plane as never, ctx as never);
    const vertical = grid.filter((l) => (l.points as number[])[0] === (l.points as number[])[2]);
    const horizontal = grid.filter((l) => (l.points as number[])[1] === (l.points as number[])[3]);
    expect(vertical.map((l) => (l.points as number[])[0])).toEqual([
      -405, -270, -135, 0, 135, 270, 405,
    ]);
    expect(horizontal.map((l) => (l.points as number[])[1])).toEqual([270, 135, 0, -135, -270]);
    expect(grid.every((l) => l.stroke === '#29ABCA')).toBe(true);
  });

  it('follows the live size during a resize, like the hit rect', () => {
    const live = makeCtx({ vs: 1, live: () => ({ w: 540, h: 405, x: 0, y: 0, rotation: 0 }) });
    const { axes } = planeGridCfgs(plane as never, live as never);
    expect((axes[0]!.points as number[])[2]).toBe(270); // x-axis spans the live width
  });

  it('draws nothing broken for an empty range', () => {
    const flat = { ...plane, xRange: [1, 1, 1] };
    const { grid, axes } = planeGridCfgs(flat as never, ctx as never);
    for (const l of [...grid, ...axes]) {
      expect((l.points as number[]).every(Number.isFinite)).toBe(true);
    }
  });

  it('puts the axes through the origin, not the box center', () => {
    const asym = { ...plane, width: 700, height: 400, xRange: [0.5, 4, 1], yRange: [-1, 3, 1] };
    const { axes } = planeGridCfgs(asym as never, ctx as never);
    const [xAxis, yAxis] = axes as Array<{ points: number[] }>;
    // y = 0 sits 1/4 of the way up from the bottom (range -1 … 3)
    expect(xAxis!.points[1]).toBeCloseTo(100);
    // x = 0.5 is the left edge
    expect(yAxis!.points[0]).toBeCloseTo(-350);
  });
});
