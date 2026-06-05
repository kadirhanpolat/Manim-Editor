import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1', type: 'angle', x: SW / 2, y: SH / 2, width: 140, height: 140,
    vertex: [-40, 40], point1: [80, 40], point2: [-40, -60], rightAngle: false, radius: 0.6, label: '',
    fill: '#fbbf24', stroke: '#fbbf24', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
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

  it('wraps in VGroup with get_tex for a labeled angle', () => {
    const s = generateManimScript(makeProject([makeObj({ label: '\\theta' })]));
    expect(s).toMatch(/_arc = Angle\(/);
    expect(s).toMatch(/= VGroup\(\w+_arc, \w+_arc\.get_tex\("\\\\theta"\)\)/);
  });
});
