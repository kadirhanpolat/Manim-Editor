import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(type, extra = {}) {
  return {
    id: 'o1', type, x: SW / 2, y: SH / 2, width: 140, height: 140,
    fill: '#14b8a6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000',
    objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}
const script = (o) => generateManimScript(makeProject([o]));
const roundTrip = (o) => parseManimScript(generateManimScript(makeProject([o])), SW, SH).objects[0];

describe('annulus codegen', () => {
  it('emits Annulus with inner/outer radius', () => {
    const s = script(makeObj('annulus', { innerRadius: 35, outerRadius: 70 }));
    expect(s).toMatch(/= Annulus\(inner_radius=[\d.]+, outer_radius=[\d.]+\)/);
  });
  it('round-trips type + radii', () => {
    const o = roundTrip(makeObj('annulus', { innerRadius: 35, outerRadius: 70 }));
    expect(o.type).toBe('annulus');
    expect(o.innerRadius).toBe(35);
    expect(o.outerRadius).toBe(70);
  });
});

describe('arc codegen', () => {
  const script = (o) => generateManimScript(makeProject([o]));
  const roundTrip = (o) => parseManimScript(generateManimScript(makeProject([o])), SW, SH).objects[0];
  it('emits Arc with radius + angles in DEGREES', () => {
    const s = script(makeObj('arc', { radius: 70, startAngle: 0, sweepAngle: 180, fill: 'transparent', stroke: '#f97316' }));
    expect(s).toMatch(/= Arc\(radius=[\d.]+, start_angle=[-\d.]+ \* DEGREES, angle=[-\d.]+ \* DEGREES\)/);
  });
  it('round-trips radius + angles', () => {
    const o = roundTrip(makeObj('arc', { radius: 70, startAngle: 30, sweepAngle: 120, fill: 'transparent', stroke: '#f97316' }));
    expect(o.type).toBe('arc');
    expect(o.sweepAngle).toBeCloseTo(120, 0);
    expect(o.startAngle).toBeCloseTo(30, 0);
  });
});

describe('sector codegen', () => {
  const script = (o) => generateManimScript(makeProject([o]));
  const roundTrip = (o) => parseManimScript(generateManimScript(makeProject([o])), SW, SH).objects[0];
  it('emits Sector with radius + angles in DEGREES', () => {
    const s = script(makeObj('sector', { radius: 70, startAngle: 0, sweepAngle: 90, fill: '#f59e0b', stroke: '#ffffff' }));
    expect(s).toMatch(/= Sector\(radius=[\d.]+, start_angle=[-\d.]+ \* DEGREES, angle=[-\d.]+ \* DEGREES\)/);
    expect(s).toContain('.set_fill(color="#f59e0b"');
  });
  it('round-trips type + angles', () => {
    const o = roundTrip(makeObj('sector', { radius: 70, startAngle: 0, sweepAngle: 90, fill: '#f59e0b', stroke: '#ffffff' }));
    expect(o.type).toBe('sector');
    expect(o.sweepAngle).toBeCloseTo(90, 0);
  });
});
