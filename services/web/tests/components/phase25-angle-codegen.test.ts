import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920,
  SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1',
    type: 'angle',
    x: SW / 2,
    y: SH / 2,
    width: 140,
    height: 140,
    vertex: [-40, 40],
    point1: [80, 40],
    point2: [-40, -60],
    rightAngle: false,
    radius: 0.6,
    label: '',
    fill: '#fbbf24',
    stroke: '#fbbf24',
    strokeWidth: 2,
    opacity: 1,
    rotation: 0,
    enterTime: 0,
    duration: 5,
    enterAnim: 'none',
    exitAnim: 'none',
    ...extra,
  };
}
function makeProject(objects) {
  return {
    name: 'T',
    sceneType: '2d',
    stage: { width: SW, height: SH },
    sceneDuration: 5,
    fps: 60,
    background: '#000000',
    objects,
    tracks: [],
    cameraTrack: [],
    assets: [],
    groups: [],
  };
}

describe('angle codegen', () => {
  it('emits two helper Lines + Angle with radius (unlabeled)', () => {
    const s = generateManimScript(makeProject([makeObj()]));
    expect(s).toMatch(/_l1 = Line\(\[-0\.296, -0\.296, 0\], \[0\.593, -0\.296, 0\]\)/);
    expect(s).toMatch(/_l2 = Line\(\[-0\.296, -0\.296, 0\], \[-0\.296, 0\.444, 0\]\)/);
    expect(s).toMatch(/= Angle\(\w+_l1, \w+_l2, radius=0\.6\)/);
  });

  it('emits RightAngle when rightAngle is true (no radius arg)', () => {
    const s = generateManimScript(makeProject([makeObj({ rightAngle: true })]));
    expect(s).toMatch(/= RightAngle\(\w+_l1, \w+_l2\)/);
    expect(s).not.toMatch(/radius=/);
  });

  // Manim's Angle has no get_tex (only Brace does) — it raised TypeError at
  // render time. The label is a MathTex placed just outside the arc midpoint.
  it('wraps a labeled angle in a VGroup with a MathTex placed at the arc', () => {
    const s = generateManimScript(makeProject([makeObj({ label: '\\theta' })]));
    expect(s).toMatch(/_arc = Angle\(/);
    expect(s).toMatch(
      /= VGroup\((\w+)_l1, \1_l2, \1_arc, MathTex\("\\\\theta"\)\.move_to\(\1_l1\.get_start\(\) \+ 1\.6 \* \(\1_arc\.point_from_proportion\(0\.5\) - \1_l1\.get_start\(\)\)\)\)/
    );
    expect(s).not.toContain('_arc.get_tex(');
  });
});

describe('angle round-trip', () => {
  it('round-trips an unlabeled angle (points + radius)', () => {
    const o = parseManimScript(generateManimScript(makeProject([makeObj()])), SW, SH).objects[0];
    expect(o.type).toBe('angle');
    expect(o.vertex[0]).toBeCloseTo(-40, 0);
    expect(o.point1[0]).toBeCloseTo(80, 0);
    expect(o.point2[1]).toBeCloseTo(-60, 0);
    expect(o.rightAngle).toBe(false);
    expect(o.radius).toBeCloseTo(0.6, 2);
  });
  it('round-trips a right angle', () => {
    const o = parseManimScript(
      generateManimScript(makeProject([makeObj({ rightAngle: true })])),
      SW,
      SH
    ).objects[0];
    expect(o.rightAngle).toBe(true);
  });
  it('round-trips position and the rays form without parser warnings', () => {
    for (const extra of [{}, { label: '\\theta' }, { rightAngle: true }]) {
      const obj = makeObj({ x: 700, y: 400, ...extra });
      const parsed = parseManimScript(generateManimScript(makeProject([obj])), SW, SH);
      // (the module docstring always yields generic warnings; ignore those)
      expect(parsed.warnings.filter((w) => /VGroup|VectorizedPoint|_l[12]|_arc/.test(w))).toEqual(
        []
      );
      expect(parsed.objects).toHaveLength(1);
      expect(parsed.objects[0].x).toBeCloseTo(700, 0);
      expect(parsed.objects[0].y).toBeCloseTo(400, 0);
    }
  });
  it('round-trips a labeled angle', () => {
    const o = parseManimScript(
      generateManimScript(makeProject([makeObj({ label: '\\theta' })])),
      SW,
      SH
    ).objects[0];
    expect(o.label).toBe('\\theta');
  });
  it('still parses the legacy get_tex label form from older .py files', () => {
    const py = [
      'from manim import *',
      'class MainScene(Scene):',
      '    def construct(self):',
      '        a_l1 = Line([-0.296, -0.296, 0], [0.593, -0.296, 0])',
      '        a_l2 = Line([-0.296, -0.296, 0], [-0.296, 0.444, 0])',
      '        a_arc = Angle(a_l1, a_l2, radius=0.6)',
      '        a = VGroup(a_arc, a_arc.get_tex("\\\\alpha"))',
    ].join('\n');
    const o = parseManimScript(py, SW, SH).objects[0];
    expect(o.type).toBe('angle');
    expect(o.label).toBe('\\alpha');
  });
});
