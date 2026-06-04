import { describe, it, expect } from 'vitest';
import { generateCode, parseManimScript } from '../../src/export/manim.js';

function makeProject3D(objects, tracks) {
  return {
    name: 'Test3DPath',
    sceneType: '3d',
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    tracks,
    cameraType: 'static',
    cameraTrack: [],
    camera3d: { phi: 75, theta: -45, zoom: 1.0 },
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
  };
}

const sphere = {
  id: 'sp1', type: 'sphere',
  x3d: 0, y3d: 1, z3d: 0, radius: 0.5, resolution: 20,
  fill: '#e67700', opacity: 1,
  enterTime: 0, exitTime: 5,
  anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
};

const pathClip = {
  id: 'clip_p1', type: 'path_move', sourceId: 'sp1',
  startTime: 0, duration: 2, easing: 'linear', parallel: false, lag_ratio: 0,
  path: [
    { x3d: 0, y3d: 1, z3d: 0 },
    { x3d: 2, y3d: 1, z3d: 3 },
    { x3d: -1, y3d: 1, z3d: -2 },
  ],
};

describe('3D path_move codegen', () => {
  it('emits 3D coordinates directly (z != 0, no stageToManim)', () => {
    const project = makeProject3D([sphere], [{ id: 't1', clips: [pathClip] }]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('set_points_as_corners');
    expect(code).toContain('MoveAlongPath');
    expect(code).toContain('[2.000, 1.000, 3.000]');
    expect(code).toContain('[-1.000, 1.000, -2.000]');
  });
});

describe('3D path_move round-trip', () => {
  it('parser reconstructs 3D path points from generated code', () => {
    const project = makeProject3D([sphere], [{ id: 't1', clips: [pathClip] }]);
    const code = generateCode(project, '/data/assets');
    const parsed = parseManimScript(code);
    expect(parsed.sceneType).toBe('3d');
    const clip = parsed.tracks[0].clips.find(c => c.type === 'path_move');
    expect(clip).toBeTruthy();
    expect(clip.path[1]).toMatchObject({ x3d: 2, y3d: 1, z3d: 3 });
    expect(clip.path[2]).toMatchObject({ x3d: -1, y3d: 1, z3d: -2 });
  });
});

describe('2D path_move regression', () => {
  it('2D path still emits z=0 and parses to {x,y}', () => {
    const obj2d = {
      id: 'r1', type: 'rectangle', x: 960, y: 540, width: 100, height: 100,
      fill: '#ffffff', opacity: 1, rotation: 0,
      enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'fade_out',
    };
    const clip2d = {
      id: 'clip_q1', type: 'path_move', sourceId: 'r1',
      startTime: 0, duration: 2, easing: 'linear', parallel: false, lag_ratio: 0,
      path: [{ x: 480, y: 540 }, { x: 1440, y: 540 }],
    };
    const project = {
      name: 'T2D', sceneType: '2d',
      stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
      objects: [obj2d], tracks: [{ id: 't1', clips: [clip2d] }],
      cameraType: 'static', cameraTrack: [],
      keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain(', 0]');
    const parsed = parseManimScript(code);
    const clip = parsed.tracks[0].clips.find(c => c.type === 'path_move');
    expect(clip.path[0]).toHaveProperty('x');
    expect(clip.path[0]).not.toHaveProperty('x3d');
  });
});

describe('axes3d range codegen (regression guard for editor)', () => {
  it('emits custom y_range and z_range', () => {
    const ax = {
      id: 'ax1', type: 'axes3d', x3d: 0, y3d: 0, z3d: 0,
      xRange: [-3, 3, 1], yRange: [-5, 5, 1], zRange: [-2, 2, 1],
      fill: '#ffffff', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject3D([ax], [{ id: 't1', clips: [] }]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('y_range=[-5, 5, 1]');
    expect(code).toContain('z_range=[-2, 2, 1]');
  });
});
