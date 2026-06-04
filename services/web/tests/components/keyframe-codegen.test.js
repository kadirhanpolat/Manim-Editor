import { describe, it, expect } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

function makeProject(overrides = {}) {
  return {
    stage: { width: 1920, height: 1080, backgroundColor: '#000000', backgroundOpacity: 1 },
    objects: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
    groups: [],
    assets: [],
    sceneDuration: 5,
    cameraType: 'static',
    cameraTrack: [],
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
    ...overrides
  };
}

describe('keyframe codegen — no keyframes', () => {
  it('project without keyframes generates same output as before', () => {
    const proj = makeProject({
      objects: [{ id: 'obj_1', type: 'circle', name: 'Circle', x: 960, y: 540, width: 120, height: 120, fill: '#22c55e', stroke: '#fff', strokeWidth: 2, opacity: 1, enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', rotation: 0 }]
    });
    const code = generateManimScript(proj);
    expect(code).not.toContain('UpdateFromFunc');
    expect(code).not.toContain('ValueTracker');
    expect(code).toContain('Circle');
  });
});

describe('keyframe codegen — animate mode', () => {
  it('generates sequential obj.animate calls', () => {
    const proj = makeProject({
      objects: [{
        id: 'obj_1', type: 'circle', name: 'Circle', x: 100, y: 540, width: 120, height: 120,
        fill: '#22c55e', stroke: '#fff', strokeWidth: 2, opacity: 1,
        enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', rotation: 0,
        keyframes: {
          x: [
            { time: 0.5, value: 300, easing: { type: 'linear' } },
            { time: 2.0, value: 900 }
          ]
        },
        keyframeCodegen: { x: 'animate' }
      }]
    });
    const code = generateManimScript(proj);
    expect(code).toContain('.animate');
    expect(code).toContain('run_time=1.5');
  });
});

describe('keyframe codegen — UpdateFromAlphaFunc mode', () => {
  it('generates _kf_ function and UpdateFromAlphaFunc call', () => {
    const proj = makeProject({
      objects: [{
        id: 'obj_1', type: 'circle', name: 'Circle', x: 100, y: 540, width: 120, height: 120,
        fill: '#22c55e', stroke: '#fff', strokeWidth: 2, opacity: 1,
        enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', rotation: 0,
        keyframes: {
          x: [
            { time: 0.5, value: 300, easing: { type: 'linear' } },
            { time: 2.0, value: 900 }
          ]
        },
        keyframeCodegen: { x: 'UpdateFromAlphaFunc' }
      }]
    });
    const code = generateManimScript(proj);
    expect(code).toContain('_kf_obj_1_x');
    expect(code).toContain('UpdateFromAlphaFunc');
    expect(code).not.toMatch(/\bUpdateFromFunc\b(?!Alpha)/);
    expect(code).toContain('run_time=1.5');
  });

  it('indents the multi-line UpdateFromAlphaFunc block for the construct body', () => {
    const proj = makeProject({
      objects: [{
        id: 'obj_1', type: 'circle', name: 'Circle', x: 100, y: 540, width: 120, height: 120,
        fill: '#22c55e', stroke: '#fff', strokeWidth: 2, opacity: 1,
        enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', rotation: 0,
        keyframes: { x: [{ time: 0.5, value: 300, easing: { type: 'linear' } }, { time: 2.0, value: 900 }] },
        keyframeCodegen: { x: 'UpdateFromAlphaFunc' },
      }],
    });
    const code = generateManimScript(proj);
    // def at construct level (8 spaces), body one level deeper (12), trailing
    // self.play back at 8 — and never at column 0 (which broke the render).
    expect(code).toMatch(/\n {8}def _kf_obj_1_x_0_fn\(mob, alpha\):/);
    expect(code).toMatch(/\n {12}mob\.set_x\(/);
    expect(code).toMatch(/\n {8}self\.play\(UpdateFromAlphaFunc\(/);
    expect(code).not.toMatch(/\nself\.play\(UpdateFromAlphaFunc\(/); // no column-0 line
  });

  it('converts x/y keyframe values to Manim units (not raw stage pixels)', () => {
    const proj = makeProject({
      stage: { width: 1920, height: 1080, backgroundColor: '#000' },
      objects: [{
        id: 'obj_1', type: 'rectangle', name: 'R', x: 960, y: 540, width: 200, height: 120,
        fill: '#3b82f6', stroke: 'transparent', strokeWidth: 2, opacity: 1,
        enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', rotation: 0,
        keyframes: { x: [{ time: 0.5, value: 500, easing: { type: 'linear' } }, { time: 3.0, value: 1500 }] },
        keyframeCodegen: { x: 'UpdateFromAlphaFunc' },
      }],
    });
    const code = generateManimScript(proj);
    // 1500px → ((1500/1920)-0.5)*14.222 ≈ 4.0 ; 500px → ≈ -3.407 (on-screen, |v|<8)
    expect(code).toContain('4.0000');
    expect(code).toContain('-3.4074');
    expect(code).not.toMatch(/set_x\(1500|1500\.0000|500\.0000/); // raw pixel value gone
  });
});
