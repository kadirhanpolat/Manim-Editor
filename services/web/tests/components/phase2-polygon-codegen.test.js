import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1', type: 'polygon_free', x: SW / 2, y: SH / 2, width: 160, height: 120,
    vertices: [[-40, -60], [40, -60], [80, 60], [-80, 60]],
    fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}

describe('polygon_free codegen', () => {
  it('emits a single-line Polygon with vertex arrays', () => {
    const s = generateManimScript(makeProject([makeObj()]));
    expect(s).toMatch(/= Polygon\(\[[-\d.]+, [-\d.]+, 0\](, \[[-\d.]+, [-\d.]+, 0\])+\)/);
  });
  it('round-trips type + vertex count + approximate first vertex', () => {
    const code = generateManimScript(makeProject([makeObj()]));
    const o = parseManimScript(code, SW, SH).objects[0];
    expect(o.type).toBe('polygon_free');
    expect(o.vertices.length).toBe(4);
    expect(o.vertices[0][0]).toBeCloseTo(-40, -1); // within ~10px after round-trip
    expect(o.vertices[0][1]).toBeCloseTo(-60, -1);
  });
  it('round-trips an off-center polygon (position + relative vertices)', () => {
    const code = generateManimScript(makeProject([makeObj({ x: 1400, y: 400 })]));
    const o = parseManimScript(code, SW, SH).objects[0];
    expect(o.x).toBeCloseTo(1400, -1);   // position survives the move_to
    expect(o.y).toBeCloseTo(400, -1);
    expect(o.vertices.length).toBe(4);
    expect(o.vertices[0][0]).toBeCloseTo(-40, -1);  // vertices stay center-relative
    expect(o.vertices[0][1]).toBeCloseTo(-60, -1);
  });
});
