import { describe, it, expect } from 'vitest';
import { generateCode } from '../../src/export/manim.js';

function makeProject3D(cameraTrack = [], objects = [], extraTracks = []) {
  return {
    name: 'Test3D',
    sceneType: '3d',
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    tracks: extraTracks.length ? extraTracks : [{ id: 't1', clips: [] }],
    cameraType: 'moving',
    cameraTrack,
    camera3d: { phi: 75, theta: -45, zoom: 1.0 },
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
  };
}

function makeSphere() {
  return {
    id: 'sp1',
    type: 'sphere',
    x3d: 0,
    y3d: 0,
    z3d: 0,
    radius: 0.5,
    resolution: 20,
    fill: '#e67700',
    opacity: 1,
    enterTime: 0,
    exitTime: 5,
    anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
  };
}

describe('camera3d phi/theta in camera_move clip', () => {
  it('generates move_camera with phi and theta', () => {
    const clip = {
      id: 'cm1',
      type: 'camera_move',
      startTime: 1,
      duration: 2,
      params: { phi: 60, theta: -60, zoom: 1.0 },
    };
    const project = makeProject3D([clip]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('self.move_camera');
    expect(code).toContain('phi=60');
    expect(code).toContain('theta=-60');
  });
});

describe('rotate clip axis in 3D', () => {
  it('generates Rotate with axis=RIGHT for axis:X', () => {
    const clip = {
      id: 'r1',
      type: 'rotate',
      startTime: 0.5,
      duration: 1,
      objectId: 'sp1',
      angle: 90,
      axis: 'X',
      easing: 'linear',
      parallel: false,
    };
    const project = {
      ...makeProject3D([], [makeSphere()]),
      tracks: [{ id: 't1', clips: [clip] }],
      cameraType: 'static',
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Rotate(');
    expect(code).toContain('axis=RIGHT');
  });

  it('generates Rotate with axis=UP for axis:Y', () => {
    const clip = {
      id: 'r2',
      type: 'rotate',
      startTime: 0.5,
      duration: 1,
      objectId: 'sp1',
      angle: 90,
      axis: 'Y',
      easing: 'linear',
      parallel: false,
    };
    const project = {
      ...makeProject3D([], [makeSphere()]),
      tracks: [{ id: 't1', clips: [clip] }],
      cameraType: 'static',
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('axis=UP');
  });

  it('generates Rotate with axis=OUT for axis:Z (default)', () => {
    const clip = {
      id: 'r3',
      type: 'rotate',
      startTime: 0.5,
      duration: 1,
      objectId: 'sp1',
      angle: 90,
      axis: 'Z',
      easing: 'linear',
      parallel: false,
    };
    const project = {
      ...makeProject3D([], [makeSphere()]),
      tracks: [{ id: 't1', clips: [clip] }],
      cameraType: 'static',
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('axis=OUT');
  });
});
