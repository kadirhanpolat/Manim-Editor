// The axes preview must match Manim's Axes: the axes cross at the origin
// (0 clamped into each range — x∈[0,4], y∈[0,10] → bottom-left corner), the
// lines span the full x_length / y_length, ticks sit on origin-aligned steps,
// and each graph is plotted over its own [xMin, xMax] (codegen:
// `axes.plot(f, x_range=[xMin, xMax])`), not over the whole axis.
import { describe, it, expect } from 'vitest';
import { makeCtx } from './fixtures.js';
import * as axes from '../../../src/components/stage/configs/axes.js';

const ctx = makeCtx({ vs: 1 });
const corner = {
  id: 'a',
  type: 'axes',
  x: 0,
  y: 0,
  width: 900,
  height: 560,
  xRange: [0, 4, 1],
  yRange: [0, 10, 2],
  graphs: [{ id: 'g', expression: 'x**2', color: '#3b82f6', xMin: 0, xMax: 3 }],
};
const centred = { ...corner, xRange: [-5, 5, 1], yRange: [-3, 3, 1], graphs: [] };

const pts = (cfg: Record<string, unknown>) => cfg.points as number[];

describe('axes preview origin', () => {
  it('crosses the axes at the clamped origin (bottom-left for positive ranges)', () => {
    expect(pts(axes.axesXLineCfg(corner as never, ctx as never))).toEqual([-450, 280, 450, 280]);
    expect(pts(axes.axesYLineCfg(corner as never, ctx as never))).toEqual([-450, 280, -450, -280]);
  });

  it('keeps centred axes in the middle', () => {
    expect(pts(axes.axesXLineCfg(centred as never, ctx as never))).toEqual([-450, 0, 450, 0]);
    expect(pts(axes.axesYLineCfg(centred as never, ctx as never))).toEqual([0, 280, 0, -280]);
  });

  it('puts the arrow tips at the positive ends of the axes', () => {
    const x = pts(axes.axesXArrowCfg(corner as never, ctx as never));
    const y = pts(axes.axesYArrowCfg(corner as never, ctx as never));
    expect(x[2]).toBe(450);
    expect(x[3]).toBe(280);
    expect(y[2]).toBe(-450);
    expect(y[3]).toBe(-280);
  });

  it('places ticks on origin-aligned steps along the axes', () => {
    const xt = axes.axesXTicks(corner as never, ctx as never).map((t) => pts(t)[0]);
    const yt = axes.axesYTicks(corner as never, ctx as never).map((t) => pts(t)[1]);
    expect(xt).toEqual([225 - 450, 450 - 450, 675 - 450]); // x = 1, 2, 3
    expect(yt.map((v) => Math.round(v))).toEqual([168, 56, -56, -168]); // y = 2, 4, 6, 8
    expect(axes.axesXTicks(corner as never, ctx as never).every((t) => pts(t)[1] === 276)).toBe(
      true
    );
  });
});

describe('axes preview graphs', () => {
  it('plots a graph over its own x range only', () => {
    const [curve] = axes.axesGraphCurves(corner as never, ctx as never);
    const p = pts(curve!);
    expect(p[0]).toBeCloseTo(-450); // x = 0
    expect(p[p.length - 2]).toBeCloseTo(225); // x = 3, not the axis end (4)
    expect(p[p.length - 1]).toBeCloseTo(280 - (9 / 10) * 560); // y = 9
  });
});
