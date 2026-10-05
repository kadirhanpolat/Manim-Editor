// Relational/point-built objects are drawn in the preview around their own
// origin (object x/y + relative vertices), but Manim's move_to / set_x /
// MoveAlongPath / rotate / scale all work on the bounding-box CENTER. Two
// invisible VectorizedPoints mirror the bounding box through the origin so the
// center IS the origin, and every center-based operation matches the preview.
import { describe, it, expect } from 'vitest';
import { generateScene, ORIGIN_ANCHORED_TYPES } from '../src/index.js';

const resolveAsset = (obj: { name?: string }, ext: string) => `${obj.name || 'asset'}.${ext}`;

function obj(type: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    type,
    name: 'shape',
    x: 960,
    y: 540,
    width: 200,
    height: 200,
    fill: '#ff0000',
    stroke: '#ff0000',
    enterTime: 0,
    duration: 3,
    enterAnim: 'none',
    exitAnim: 'none',
    ...extra,
  };
}

function scene(o: unknown): string[] {
  return generateScene(
    {
      name: 'T',
      stage: { width: 1920, height: 1080 },
      objects: [o],
      tracks: [],
      cameraTrack: [],
    } as never,
    { resolveAsset } as never
  )
    .split('\n')
    .map((l) => l.trim());
}

const ANCHOR =
  /^o1\.add\(VectorizedPoint\(-o1\.get_corner\(DL\)\), VectorizedPoint\(-o1\.get_corner\(UR\)\)\)$/;

describe('origin-anchored objects', () => {
  it('covers the point-built and relational types', () => {
    expect([...ORIGIN_ANCHORED_TYPES].sort()).toEqual(
      ['angle', 'bezier', 'brace', 'coord_point', 'polygon_free', 'ray', 'vector_components'].sort()
    );
  });

  for (const type of [
    'angle',
    'bezier',
    'brace',
    'coord_point',
    'polygon_free',
    'ray',
    'vector_components',
  ]) {
    it(`${type}: mirrors its bounding box through the origin before move_to`, () => {
      const lines = scene(obj(type));
      const anchor = lines.findIndex((l) => ANCHOR.test(l));
      const moveTo = lines.findIndex((l) => l.startsWith('o1.move_to('));
      expect(anchor).toBeGreaterThan(-1);
      expect(moveTo).toBe(anchor + 1);
    });
  }

  it('leaves center-built shapes alone', () => {
    expect(scene(obj('rectangle')).some((l) => ANCHOR.test(l))).toBe(false);
  });
});

describe('coordinate-system lengths', () => {
  // x_length/y_length/length used toFixed(1): 560 px → 4.148 units → "4.1",
  // shifting the far end of an axis by ~6 px, and every value plotted on it.
  it('emits axis lengths precisely enough to land within a pixel', () => {
    const at = (type: string, extra: Record<string, unknown> = {}) =>
      scene(obj(type, { width: 900, height: 560, ...extra })).join('\n');
    expect(at('axes')).toContain('x_length=6.667, y_length=4.148');
    expect(at('numberplane')).toContain('x_length=6.667, y_length=4.148');
    expect(at('complex_plane')).toContain('x_length=6.667, y_length=4.148');
    expect(at('numberline')).toContain('length=6.667)');
  });
});

describe('axes plot-area anchoring', () => {
  // With the origin in a corner, the arrow tips stick out at one end only and
  // shift the bounding-box center by (0.0875, 0.0875) units (~12 px, measured
  // in Manim 0.20.1) — every plotted value moved with it. Mirror the box
  // through the plot-area center so move_to centers the plot area itself.
  it('centers the plot area, not the bounding box, on the object position', () => {
    const lines = scene(obj('axes', { xRange: [0, 5, 1], yRange: [0, 1.2, 0.2] }));
    const anchor = lines.findIndex(
      (l) =>
        l ===
        'o1.add(VectorizedPoint(o1.c2p(0, 0) + o1.c2p(5, 1.2) - o1.get_corner(DL)), VectorizedPoint(o1.c2p(0, 0) + o1.c2p(5, 1.2) - o1.get_corner(UR)))'
    );
    expect(anchor).toBeGreaterThan(-1);
    expect(lines[anchor + 1]).toMatch(/^o1\.move_to\(/);
  });
});

describe('angle rays', () => {
  it('draws both rays with the arc, like the preview', () => {
    const lines = scene(obj('angle', { vertex: [0, 0], point1: [100, 0], point2: [0, -100] }));
    expect(lines).toContain('o1 = VGroup(o1_l1, o1_l2, o1_arc)');
  });

  it('keeps the label after the rays and the arc', () => {
    const lines = scene(obj('angle', { label: '\\theta' }));
    expect(lines.some((l) => l.startsWith('o1 = VGroup(o1_l1, o1_l2, o1_arc, MathTex('))).toBe(
      true
    );
  });
});
