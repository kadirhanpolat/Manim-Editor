import { describe, it, expect } from 'vitest';
import { generateCode } from '../../src/export/manim.js';

function makeProject3DKeyframe(objects = []) {
  return {
    name: 'Test3DKF',
    sceneType: '3d',
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    tracks: [{ id: 't1', clips: [] }],
    cameraType: 'static',
    cameraTrack: [],
    camera3d: { phi: 75, theta: -45, zoom: 1.0 },
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'animate' },
  };
}

function makeSphere(withKeyframes = false) {
  const sphere = {
    id: 'sp1', type: 'sphere',
    x3d: 0, y3d: 0, z3d: 0, radius: 0.5, resolution: 20,
    fill: '#e67700', opacity: 1,
    enterTime: 0, exitTime: 5,
    anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
  };
  if (withKeyframes) {
    sphere.keyframes = {
      x3d: [
        { time: 0, value: 0, easing: { type: 'linear' } },
        { time: 2, value: 2, easing: { type: 'linear' } },
      ],
    };
    sphere.keyframeMode = { x3d: 'override' };
    sphere.keyframeCodegen = { x3d: 'animate' };
  }
  return sphere;
}

describe('keyframe x3d codegen (animate mode)', () => {
  it('generates animate.move_to for x3d keyframes', () => {
    const project = makeProject3DKeyframe([makeSphere(true)]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('move_to');
    expect(code).toContain('2.0');
  });
});

describe('voiceover + ThreeDScene mixin', () => {
  it('uses ThreeDScene, VoiceoverScene when 3D and audio', () => {
    const sphere = makeSphere();
    const clipWithAudio = {
      id: 'cl1', type: 'move',
      objectId: 'sp1', startTime: 0, duration: 1,
      toX: 960, toY: 540,
      easing: 'linear', parallel: false,
      audio: {
        type: 'gtts', src: '/data/assets/audio/a1.wav',
        status: 'ready', duration: 1.0,
        syncMode: 'auto', lang: 'tr', text: 'merhaba',
      },
    };
    const project = {
      ...makeProject3DKeyframe([sphere]),
      tracks: [{ id: 't1', clips: [clipWithAudio] }],
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('ThreeDScene, VoiceoverScene');
    expect(code).toContain('from manim_voiceover import VoiceoverScene');
  });
});
