import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1', type: 'brace', x: SW / 2, y: SH / 2, width: 160, height: 60,
    p1: [-80, 0], p2: [80, 0], label: '',
    fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}

describe('brace codegen', () => {
  it('emits single-line BraceBetweenPoints (unlabeled)', () => {
    const s = generateManimScript(makeProject([makeObj()]));
    expect(s).toMatch(/= BraceBetweenPoints\(\[-0\.593, 0\.000, 0\], \[0\.593, 0\.000, 0\]\)/);
    expect(s).not.toMatch(/VGroup/);
  });

  it('emits VGroup with get_tex for a labeled brace (non-raw escaping)', () => {
    const s = generateManimScript(makeProject([makeObj({ label: '\\frac{x}{2}' })]));
    expect(s).toMatch(/_brace = BraceBetweenPoints\(/);
    expect(s).toMatch(/= VGroup\(\w+_brace, \w+_brace\.get_tex\("\\\\frac\{x\}\{2\}"\)\)/);
  });
});

describe('brace round-trip', () => {
  it('round-trips an unlabeled brace (type + points)', () => {
    const o = parseManimScript(generateManimScript(makeProject([makeObj()])), SW, SH).objects[0];
    expect(o.type).toBe('brace');
    expect(o.p1[0]).toBeCloseTo(-80, 0);
    expect(o.p2[0]).toBeCloseTo(80, 0);
    expect(o.label).toBe('');
  });
  it('round-trips a labeled brace', () => {
    const o = parseManimScript(generateManimScript(makeProject([makeObj({ label: 'x' })])), SW, SH).objects[0];
    expect(o.type).toBe('brace');
    expect(o.label).toBe('x');
  });
});
