// Science-documentary template pack (roadmap §12, requested by the production
// bug report): decay curve, isochron, decay chain, log time scale. Values must
// be scientifically right and land exactly where Manim plots them — `onAxes`
// mirrors codegen, which centres the axes' plot area on the object.
import { describe, it, expect } from 'vitest';
import TEMPLATES from '../../src/templates/index.js';
import { onAxes } from '../../src/templates/science.js';

type Obj = Record<string, unknown> & {
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function project(id: string): Obj[] {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t?.project) throw new Error(`no template ${id}`);
  return (t.project() as unknown as { objects: Obj[] }).objects;
}
const named = (objs: Obj[], name: string): Obj => {
  const o = objs.find((x) => x.name === name);
  if (!o) throw new Error(`missing ${name}`);
  return o;
};
const asAxes = (o: Obj) =>
  o as unknown as {
    x: number;
    y: number;
    width: number;
    height: number;
    xRange: number[];
    yRange: number[];
  };

describe('science template pack', () => {
  it('adds four templates in a science category', () => {
    const ids = TEMPLATES.filter((t) => t.category === 'science').map((t) => t.id);
    expect(ids.sort()).toEqual(['decay_chain', 'isochron', 'radioactive_decay', 'time_scale']);
  });
});

describe('radioactive_decay', () => {
  const objs = project('radioactive_decay');
  const ax = asAxes(named(objs, 'Axes'));

  it('plots N/N0 = 2^-t over the half-life axis', () => {
    const g = (named(objs, 'Axes').graphs as Array<Record<string, unknown>>)[0]!;
    expect(g.expression).toBe('2**(-x)');
    expect([g.xMin, g.xMax]).toEqual([0, ax.xRange[1]]);
  });

  it('marks 1/2, 1/4 and 1/8 exactly on the curve after 1, 2, 3 half-lives', () => {
    for (const k of [1, 2, 3]) {
      const dot = named(objs, `After ${k} half-life${k > 1 ? 's' : ''}`);
      const p = onAxes(ax, k, 2 ** -k);
      expect(dot.x).toBeCloseTo(p.x, 1);
      expect(dot.y).toBeCloseTo(p.y, 1);
    }
  });
});

describe('isochron', () => {
  const objs = project('isochron');
  const ax = asAxes(named(objs, 'Axes'));
  const line = named(objs, 'Isochron');
  const r = ((line.rotation as number) * Math.PI) / 180;
  const ends = [-1, 1].map((s) => ({
    x: line.x + (s * line.width * Math.cos(r)) / 2,
    y: line.y + (s * line.width * Math.sin(r)) / 2,
  }));
  // The isochron y = 0.7 + 0.015 x, drawn over the whole x range.
  const toValue = (p: { x: number; y: number }) => ({
    x: ax.xRange[0]! + ((p.x - (ax.x - ax.width / 2)) / ax.width) * (ax.xRange[1]! - ax.xRange[0]!),
    y: ax.yRange[0]! + ((ax.y + ax.height / 2 - p.y) / ax.height) * (ax.yRange[1]! - ax.yRange[0]!),
  });

  it('draws the isochron from x = 0 to the end of the axis', () => {
    const [a, b] = ends.map(toValue);
    expect(a!.x).toBeCloseTo(0, 2);
    expect(a!.y).toBeCloseTo(0.7, 3);
    expect(b!.x).toBeCloseTo(ax.xRange[1]!, 2);
    expect(b!.y).toBeCloseTo(0.7 + 0.015 * ax.xRange[1]!, 3);
  });

  it('puts every sample within measurement scatter of the line', () => {
    const samples = objs.filter((o) => o.name.startsWith('Sample'));
    expect(samples.length).toBeGreaterThanOrEqual(5);
    for (const s of samples) {
      const v = toValue(s);
      expect(Math.abs(v.y - (0.7 + 0.015 * v.x))).toBeLessThan(0.004);
    }
  });
});

describe('decay_chain', () => {
  const objs = project('decay_chain');

  it('follows U-238 → Th-234 → Pa-234 → U-234 with conserved mass and charge', () => {
    // α: A−4, Z−2; β⁻: A, Z+1.
    const nuclides = objs
      .filter((o) => o.type === 'latex' && /^\^\{\d+\}_\{\d+\}/.test(o.latex as string))
      .sort((a, b) => a.x - b.x)
      .map((o) => (o.latex as string).match(/^\^\{(\d+)\}_\{(\d+)\}\\mathrm\{(\w+)\}/)!.slice(1));
    expect(nuclides).toEqual([
      ['238', '92', 'U'],
      ['234', '90', 'Th'],
      ['234', '91', 'Pa'],
      ['234', '92', 'U'],
    ]);
    const steps = objs
      .filter((o) => o.name.startsWith('Step '))
      .sort((a, b) => a.x - b.x)
      .map((o) => o.latex);
    expect(steps).toEqual(['\\alpha', '\\beta^-', '\\beta^-']);
  });

  it('puts each arrow between two nuclei', () => {
    const nodes = objs.filter((o) => o.type === 'circle').sort((a, b) => a.x - b.x);
    const arrows = objs.filter((o) => o.type === 'arrow').sort((a, b) => a.x - b.x);
    expect(arrows).toHaveLength(nodes.length - 1);
    arrows.forEach((a, i) => {
      expect(a.x - a.width / 2).toBeGreaterThan(nodes[i]!.x + nodes[i]!.width / 2);
      expect(a.x + a.width / 2).toBeLessThan(nodes[i + 1]!.x - nodes[i + 1]!.width / 2);
    });
  });
});

describe('time_scale', () => {
  const objs = project('time_scale');
  const line = named(objs, 'Log time axis');
  const xr = line.xRange as number[];
  const at = (v: number) =>
    line.x - line.width / 2 + ((v - xr[0]!) / (xr[1]! - xr[0]!)) * line.width;

  it('places each event at log10 of its age in years', () => {
    const events: Record<string, number> = {
      'Human lifetime': 80,
      'Recorded history': 5_000,
      'Homo sapiens': 300_000,
      'End of the dinosaurs': 66e6,
      'Age of the Earth': 4.54e9,
    };
    for (const [name, years] of Object.entries(events)) {
      const dot = named(objs, `${name} marker`);
      expect(dot.x).toBeCloseTo(at(Math.log10(years)), 0);
      expect(dot.y).toBe(line.y);
    }
  });
});
