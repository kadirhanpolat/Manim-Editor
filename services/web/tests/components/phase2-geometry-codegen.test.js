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
    expect(o.outerRadius).toBeGreaterThan(o.innerRadius);
  });
});
