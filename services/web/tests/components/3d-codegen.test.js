import { describe, it, expect } from 'vitest';
import { generateCode } from '../../src/export/manim.js';

function makeProject(objects = [], sceneType = '3d', cameraOverrides = {}) {
  return {
    name: 'Test3D',
    sceneType,
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    tracks: [{ id: 't1', clips: [] }],
    cameraType: 'static',
    cameraTrack: [],
    camera3d: { phi: 75, theta: -45, zoom: 1.0, ...cameraOverrides },
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
  };
}

describe('ThreeDScene base class', () => {
  it('uses ThreeDScene when sceneType is 3d', () => {
    const project = makeProject([]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('class MainScene(ThreeDScene)');
  });

  it('uses Scene when sceneType is 2d', () => {
    const project = makeProject([], '2d');
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('class MainScene(Scene)');
  });

  it('sets camera orientation from camera3d', () => {
    const project = makeProject([]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('self.set_camera_orientation');
    expect(code).toContain('phi=75');
    expect(code).toContain('theta=-45');
  });
});

describe('sphere codegen', () => {
  it('generates Sphere with correct radius and position', () => {
    const sphere = {
      id: 'sp1',
      type: 'sphere',
      x3d: 1,
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
    const project = makeProject([sphere]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Sphere(radius=0.5');
    expect(code).toContain('resolution=(20, 20)');
    expect(code).toContain('move_to([1');
    expect(code).toContain('set_color');
  });
});

describe('cube codegen', () => {
  it('generates Cube with side_length and position', () => {
    const cube = {
      id: 'cu1',
      type: 'cube',
      x3d: 0,
      y3d: 0,
      z3d: 0,
      sideLength: 1.0,
      fill: '#3b5bdb',
      opacity: 1,
      enterTime: 0,
      exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([cube]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Cube(side_length=1.0)');
    expect(code).toContain('move_to([0');
  });
});

describe('axes3d codegen', () => {
  it('generates ThreeDAxes with ranges', () => {
    const ax = {
      id: 'ax1',
      type: 'axes3d',
      x3d: 0,
      y3d: 0,
      z3d: 0,
      xRange: [-3, 3, 1],
      yRange: [-3, 3, 1],
      zRange: [-3, 3, 1],
      fill: '#ffffff',
      opacity: 1,
      enterTime: 0,
      exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([ax]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('ThreeDAxes(');
    expect(code).toContain('x_range=[-3, 3, 1]');
  });
});

describe('cone / cylinder / torus codegen', () => {
  it('generates Cone with base_radius and height', () => {
    const cone = {
      id: 'c1',
      type: 'cone',
      x3d: 0,
      y3d: 0,
      z3d: 0,
      radius: 0.5,
      height: 1.0,
      resolution: 20,
      fill: '#2f9e44',
      opacity: 1,
      enterTime: 0,
      exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([cone]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Cone(base_radius=0.5');
    expect(code).toContain('height=1.0');
  });

  it('generates Cylinder', () => {
    const cyl = {
      id: 'cy1',
      type: 'cylinder',
      x3d: 0,
      y3d: 0,
      z3d: 0,
      radius: 0.5,
      height: 1.5,
      resolution: 20,
      fill: '#1098ad',
      opacity: 1,
      enterTime: 0,
      exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([cyl]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Cylinder(radius=0.5');
    expect(code).toContain('height=1.5');
  });

  it('generates Torus', () => {
    const tor = {
      id: 't1',
      type: 'torus',
      x3d: 0,
      y3d: 0,
      z3d: 0,
      majorRadius: 1.0,
      minorRadius: 0.3,
      resolution: 20,
      fill: '#ae3ec9',
      opacity: 1,
      enterTime: 0,
      exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([tor]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Torus(major_radius=1.0');
    expect(code).toContain('minor_radius=0.3');
  });
});
