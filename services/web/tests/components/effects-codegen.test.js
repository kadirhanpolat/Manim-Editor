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
    sceneDuration: 5, fps: 60, background: '#000000',
    objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}
const script = (o) => generateManimScript(makeProject([o]));

describe('effects codegen (manim.js)', () => {
  it('backward compatible: plain rectangle has no effect calls', () => {
    const s = script(makeObj('rectangle'));
    expect(s).toContain('Rectangle(width=');
    expect(s).not.toContain('RoundedRectangle');
    expect(s).not.toContain('set_color_by_gradient');
    expect(s).not.toContain('DashedVMobject');
    expect(s).toContain('.set_fill(color="#3b82f6", opacity=1)');
    expect(s).toContain('.set_stroke(color="#ffffff", width=2)');
  });

  it('gradient emits set_color_by_gradient after set_fill', () => {
    const s = script(makeObj('circle', { gradient: { colors: ['#ff0000', '#00ff00'], angle: 90 } }));
    expect(s).toContain('.set_color_by_gradient("#ff0000", "#00ff00")');
  });

  it('rounded corners emit RoundedRectangle for rectangle', () => {
    const s = script(makeObj('rectangle', { cornerRadius: 48 }));
    expect(s).toMatch(/= RoundedRectangle\(corner_radius=[\d.]+, width=[\d.]+, height=[\d.]+\)/);
    expect(s).not.toContain('= Rectangle(width=');
  });

  it('fill/stroke opacity multiply the master opacity', () => {
    const s = script(makeObj('square', { opacity: 0.8, fillOpacity: 0.5, strokeOpacity: 0.25 }));
    expect(s).toContain('.set_fill(color="#3b82f6", opacity=0.4)');     // 0.8 * 0.5
    expect(s).toContain('.set_stroke(color="#ffffff", width=2, opacity=0.2)'); // 0.8 * 0.25
  });

  it('dashed wraps the mobject in a fill-preserving VGroup', () => {
    const s = script(makeObj('rectangle', { dash: { numDashes: 12, ratio: 0.5 } }));
    expect(s).toContain('DashedVMobject(');
    expect(s).toContain('num_dashes=12');
    expect(s).toContain('dashed_ratio=0.5');
    expect(s).toMatch(/= VGroup\(\w+, DashedVMobject\(/);
  });
});
