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
  it('generates _kf_ function and UpdateFromFunc call', () => {
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
    expect(code).toContain('UpdateFromFunc');
    expect(code).toContain('run_time=1.5');
  });
});
