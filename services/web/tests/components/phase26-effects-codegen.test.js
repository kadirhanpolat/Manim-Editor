import { describe, it, expect } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(type, extra = {}) {
  return {
    id: 'o1', type, x: SW / 2, y: SH / 2, width: 200, height: 200,
    fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}

describe('round_corners codegen', () => {
  it('emits .round_corners for a triangle with cornerRadius', () => {
    const s = generateManimScript(makeProject([makeObj('triangle', { cornerRadius: 20 })]));
    expect(s).toMatch(/\.round_corners\(radius=0\.148\)/);
  });
  it('does NOT emit round_corners for rectangle (uses RoundedRectangle)', () => {
    const s = generateManimScript(makeProject([makeObj('rectangle', { cornerRadius: 20 })]));
    expect(s).not.toMatch(/round_corners/);
  });
  it('emits nothing extra when cornerRadius is 0/absent', () => {
    const s = generateManimScript(makeProject([makeObj('star')]));
    expect(s).not.toMatch(/round_corners/);
  });
});

describe('shadow codegen', () => {
  it('emits a shifted dark copy + VGroup for a shadowed circle', () => {
    const s = generateManimScript(makeProject([makeObj('circle', { shadow: { color: '#000000', opacity: 0.4, dx: 8, dy: 8, blur: 12 } })]));
    expect(s).toMatch(/_shadow_\w+ = \w+\.copy\(\)\.set_color\("#000000"\)\.set_opacity\(0\.4\)\.shift\(\[0\.059, -0\.059, 0\]\)/);
    expect(s).toMatch(/\w+ = VGroup\(_shadow_\w+, \w+\)/);
  });
  it('emits no shadow lines when shadow is absent (legacy)', () => {
    const s = generateManimScript(makeProject([makeObj('circle')]));
    expect(s).not.toMatch(/_shadow_/);
  });
});
