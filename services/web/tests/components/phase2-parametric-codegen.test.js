import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1', type: 'parametric', x: SW / 2, y: SH / 2, width: 160, height: 160,
    xExpr: 'np.cos(t)', yExpr: 'np.sin(t)', tMin: 0, tMax: 6.283,
    fill: 'transparent', stroke: '#10b981', strokeWidth: 4, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}

describe('parametric codegen', () => {
  it('emits single-line ParametricFunction with t_range', () => {
    const s = generateManimScript(makeProject([makeObj()]));
    expect(s).toMatch(/= ParametricFunction\(lambda t: np\.array\(\[np\.cos\(t\), np\.sin\(t\), 0\]\), t_range=\[0, 6\.283\], color="#10b981", stroke_width=4\)/);
  });
  it('round-trips type + expressions + t-range', () => {
    const o = parseManimScript(generateManimScript(makeProject([makeObj()])), SW, SH).objects[0];
    expect(o.type).toBe('parametric');
    expect(o.xExpr).toBe('np.cos(t)');
    expect(o.yExpr).toBe('np.sin(t)');
    expect(o.tMax).toBeCloseTo(6.283, 2);
  });
  it('rejects an unsafe expression (falls back to t / 0)', () => {
    const s = generateManimScript(makeProject([makeObj({ xExpr: '__import__("os")' })]));
    expect(s).not.toContain('__import__');
  });
  it('round-trips a comma-containing (multi-arg) expression', () => {
    const o = parseManimScript(generateManimScript(makeProject([makeObj({ xExpr: 'np.power(t, 2)', yExpr: 'np.sin(t)' })])), SW, SH).objects[0];
    expect(o.xExpr).toBe('np.power(t, 2)');
    expect(o.yExpr).toBe('np.sin(t)');
  });

  it('a parametric and a heart in the same scene each round-trip to their own type', () => {
    const heart = { id: 'h1', type: 'heart', x: SW / 2, y: SH / 2, width: 120, height: 120,
      fill: '#ec4899', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
      enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none' };
    const objs = parseManimScript(generateManimScript(makeProject([makeObj(), heart])), SW, SH).objects;
    const types = objs.map(o => o.type).sort();
    expect(types).toContain('parametric');
    expect(types).toContain('heart');
  });
});
