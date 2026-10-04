// The angle preview must draw the arc Manim renders: `Angle(l1, l2, radius=r)`
// sweeps counter-clockwise (on screen) from ray 1 to ray 2 with r in Manim
// units, `RightAngle` arms default to 0.4 units (2/3 of the shorter ray when
// that is under 0.6), and the label sits at 1.6x the arc midpoint (codegen).
// Reference values were checked against Manim CE 0.20.1.
import { describe, it, expect } from 'vitest';
import { FRAME_WIDTH } from '@manim/codegen';
import { makeCtx, STAGE } from './fixtures.js';
import * as relational from '../../../src/components/stage/configs/relational.js';

const ctx = makeCtx({ vs: 1 });
const PX_PER_UNIT = STAGE.width / FRAME_WIDTH; // 135

// vertex at the origin so points read directly as offsets from it
const base = { id: 'a', type: 'angle', x: 0, y: 0, vertex: [0, 0] };
// ray 1 points right, ray 2 points straight up (screen y is down)
const rightThenUp = { ...base, point1: [120, 0], point2: [0, -100] };

function arcPoints(obj: Record<string, unknown>): Array<[number, number]> {
  const pts = relational.angleArcCfg(obj as never, ctx as never).points as number[];
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i += 2) out.push([pts[i]!, pts[i + 1]!]);
  return out;
}

describe('angle arc preview parity', () => {
  it('uses the radius in Manim units (0.6 → 81 px on a 1920 stage)', () => {
    for (const [x, y] of arcPoints({ ...rightThenUp, radius: 0.6 })) {
      expect(Math.hypot(x, y)).toBeCloseTo(0.6 * PX_PER_UNIT, 5);
    }
  });

  it('sweeps the 90° arc between the rays, not the 270° reflex arc', () => {
    const pts = arcPoints({ ...rightThenUp, radius: 0.6 });
    const [first, mid, last] = [pts[0]!, pts[Math.floor(pts.length / 2)]!, pts[pts.length - 1]!];
    const r = 0.6 * PX_PER_UNIT;
    expect(first[0]).toBeCloseTo(r, 5); // starts on ray 1 (right)
    expect(first[1]).toBeCloseTo(0, 5);
    expect(last[0]).toBeCloseTo(0, 5); // ends on ray 2 (up)
    expect(last[1]).toBeCloseTo(-r, 5);
    // Manim: Angle(RIGHT, UP, radius=0.6).point_from_proportion(0.5) = (0.424, 0.424)
    expect(mid[0]).toBeCloseTo(0.424 * PX_PER_UNIT, 0);
    expect(mid[1]).toBeCloseTo(-0.424 * PX_PER_UNIT, 0);
  });

  it('measures counter-clockwise from ray 1 even when that is the long way', () => {
    // ray 1 up, ray 2 right: Manim draws the 270° arc through the left side
    const pts = arcPoints({ ...base, point1: [0, -100], point2: [120, 0], radius: 0.6 });
    const mid = pts[Math.floor(pts.length / 2)]!;
    expect(mid[0]).toBeLessThan(0);
    expect(mid[1]).toBeGreaterThan(0);
  });
});

describe('angle label preview parity', () => {
  it('sits at 1.6x the arc midpoint, like the generated MathTex', () => {
    const obj = { ...rightThenUp, radius: 0.6, label: '\\theta' };
    const [x, y] = relational.angleLabelAnchor(obj as never, ctx as never);
    const d = 1.6 * 0.6 * PX_PER_UNIT * Math.SQRT1_2;
    expect(x).toBeCloseTo(d, 3);
    expect(y).toBeCloseTo(-d, 3);
  });
});

describe('right angle preview parity', () => {
  function elbow(obj: Record<string, unknown>): number[] {
    return relational.angleSquareCfg(obj as never, ctx as never).points as number[];
  }

  it('uses 0.4-unit arms when both rays are long', () => {
    const pts = elbow({ ...rightThenUp, rightAngle: true });
    const arm = 0.4 * PX_PER_UNIT;
    expect(pts).toHaveLength(6);
    expect(pts[0]).toBeCloseTo(arm, 5);
    expect(pts[1]).toBeCloseTo(0, 5);
    expect(pts[2]).toBeCloseTo(arm, 5);
    expect(pts[3]).toBeCloseTo(-arm, 5);
    expect(pts[4]).toBeCloseTo(0, 5);
    expect(pts[5]).toBeCloseTo(-arm, 5);
  });

  it('uses 2/3 of the shorter ray when it is under 0.6 units', () => {
    const pts = elbow({ ...base, point1: [60, 0], point2: [0, -100], rightAngle: true });
    expect(pts[0]).toBeCloseTo((2 / 3) * 60, 5);
  });
});
