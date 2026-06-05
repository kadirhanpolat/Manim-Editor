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
});
