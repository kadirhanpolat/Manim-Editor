// axis_point: a point placed by its value on an axes object (backlog "data
// point on axes"). Round-trips through the .py parser, is created bound to an
// axes, and the preview puts it where Manim's ax.c2p(x, y) does.
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';
import { axisPointCfgs } from '../../src/components/stage/configs/axes.js';
import { makeCtx } from './stage/fixtures.js';

const SW = 1920,
  SH = 1080;
const axes = {
  id: 'ax',
  type: 'axes',
  name: 'ax',
  x: 960,
  y: 540,
  width: 900,
  height: 560,
  xRange: [0, 4, 1],
  yRange: [0, 10, 2],
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeWidth: 2,
  opacity: 1,
  rotation: 0,
  enterTime: 0,
  duration: 5,
  enterAnim: 'none',
  exitAnim: 'none',
};
const point = {
  id: 'p',
  type: 'axis_point',
  name: 'p',
  targetId: 'ax',
  valueX: 1,
  valueY: 2,
  label: 'P',
  showGuides: true,
  x: 0,
  y: 0,
  width: 22,
  height: 22,
  fill: '#f97316',
  stroke: '#f97316',
  strokeWidth: 0,
  opacity: 1,
  rotation: 0,
  enterTime: 0,
  duration: 5,
  enterAnim: 'none',
  exitAnim: 'none',
};
const project = () =>
  ({
    name: 'T',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    objects: [axes, point],
    groups: [],
    tracks: [{ id: 't', name: 'Track 1', clips: [] }],
  }) as never;

describe('axis_point round-trip', () => {
  it('parses back value, label, guides, size, color and the binding', () => {
    const parsed = parseManimScript(generateManimScript(project()), SW, SH);
    const ax = parsed.objects.find((o) => o.type === 'axes')!;
    const p = parsed.objects.find((o) => o.type === 'axis_point')!;
    expect(p).toBeTruthy();
    expect(p.targetId).toBe(ax.id);
    expect([p.valueX, p.valueY]).toEqual([1, 2]);
    expect(p.label).toBe('P');
    expect(p.showGuides).toBe(true);
    expect(p.width).toBe(22);
    expect(p.fill).toBe('#f97316');
    expect(parsed.warnings.filter((w) => /Dot|VGroup|MathTex|get_lines/.test(w))).toEqual([]);
    // no stray plain dot object
    expect(parsed.objects.filter((o) => o.type === 'dot')).toEqual([]);
  });
});

describe('axis_point in the store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useProjectStore().newProject('T', 'visual');
  });

  it('binds a new point to the selected axes, else the first one', () => {
    const store = useProjectStore();
    const a1 = store.addObject('axes', 600, 500);
    const a2 = store.addObject('axes', 1300, 500);
    store.selectedObjectIds = [a2.id];
    const p = store.addObject('axis_point', 0, 0);
    expect(p.targetId).toBe(a2.id);
    expect([p.valueX, p.valueY]).toEqual([1, 1]);
    store.selectedObjectIds = [];
    expect(store.addObject('axis_point', 0, 0).targetId).toBe(a1.id);
  });

  it('is removed with its axes', () => {
    const store = useProjectStore();
    const a = store.addObject('axes', 600, 500);
    const p = store.addObject('axis_point', 0, 0);
    store.deleteObject(a.id);
    expect(store.objectById(p.id)).toBeFalsy();
  });
});

describe('axis_point preview', () => {
  // vs 1, no pan: canvas == stage coordinates
  const ctx = makeCtx({
    vs: 1,
    ox: 0,
    oy: 0,
    s2c: (x: number, y: number) => ({ x, y }),
    objectById: (id: string) => (id === 'ax' ? axes : null),
  });

  it('puts the dot where ax.c2p(x, y) is', () => {
    const cfg = axisPointCfgs(point as never, ctx as never)!;
    // x = 1 of 0…4 over 900 px, y = 2 of 0…10 over 560 px (from the bottom)
    expect(cfg.dot.x).toBeCloseTo(960 - 450 + 225);
    expect(cfg.dot.y).toBeCloseTo(540 + 280 - 112);
    expect(cfg.dot.radius).toBe(11);
  });

  it('draws dashed guides to the axes and a glyph label', () => {
    const cfg = axisPointCfgs(point as never, ctx as never)!;
    expect(cfg.guides.map((g) => g.points)).toEqual([
      [735, 820, 735, 708], // down to the x-axis (y = 0 at the bottom)
      [510, 708, 735, 708], // across to the y-axis (x = 0 at the left)
    ]);
    expect(cfg.guides.every((g) => Array.isArray(g.dash))).toBe(true);
    expect(cfg.label!.text).toBe('P');
  });

  it('draws nothing without its axes', () => {
    expect(axisPointCfgs({ ...point, targetId: 'nope' } as never, ctx as never)).toBeNull();
  });
});
