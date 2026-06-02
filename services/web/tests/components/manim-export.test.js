import { describe, it, expect, beforeEach } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;

function makeObj(id, type = 'circle', extra = {}) {
  return {
    id, type,
    x: SW / 2, y: SH / 2,
    width: 200, height: 200,
    fill: '#ffffff', stroke: 'transparent', strokeWidth: 2,
    opacity: 1, rotation: 0,
    enterTime: 0, duration: 5,
    enterAnim: 'fade_in', exitAnim: 'none',
    ...extra,
  };
}

function makeProject(objects, clips) {
  return {
    name: 'Test',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    objects,
    groups: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips }],
  };
}

// ── Generator tests ──────────────────────────────────────────────────────────

describe('generator — numberplane', () => {
  it('emits NumberPlane with x/y ranges and dimensions', () => {
    const project = makeProject([makeObj('obj1', 'numberplane', {
      xRange: [-6, 6, 1], yRange: [-4, 4, 1], xStep: 1, yStep: 1,
      width: 1200, height: 800,
    })], []);
    const script = generateManimScript(project);
    expect(script).toContain('NumberPlane(x_range=[-6, 6, 1], y_range=[-4, 4, 1]');
  });
});

describe('generator — numberline', () => {
  it('emits NumberLine with x_range and length', () => {
    const project = makeProject([makeObj('obj1', 'numberline', {
      xRange: [-5, 5, 1], width: 1200, height: 100,
    })], []);
    const script = generateManimScript(project);
    expect(script).toContain('NumberLine(x_range=[-5, 5, 1]');
  });
});

describe('generator — axes graphs', () => {
  it('emits plot() for each graph on an axes object', () => {
    const axes = makeObj('ax1', 'axes', {
      xRange: [-5, 5, 1], yRange: [-3, 3, 1],
      graphs: [
        { id: 'g1', expression: 'x**2', color: '#F59E0B', xMin: -3, xMax: 3, strokeWidth: 3 },
      ],
    });
    const project = makeProject([axes], []);
    const script = generateManimScript(project);
    expect(script).toContain('ax1.plot(lambda x: x**2');
    expect(script).toContain('x_range=[-3, 3]');
    expect(script).toContain('"#F59E0B"');
  });

  it('sanitises dangerous expressions', () => {
    const axes = makeObj('ax1', 'axes', {
      xRange: [-5, 5, 1], yRange: [-3, 3, 1],
      graphs: [{ id: 'g1', expression: '__import__("os")', color: '#fff', xMin: -5, xMax: 5, strokeWidth: 2 }],
    });
    const script = generateManimScript(makeProject([axes], []));
    expect(script).toContain('lambda x: x**2'); // fallback expression
    expect(script).not.toContain('__import__');
  });
});

describe('generator — AnimationGroup', () => {
  it('groups two parallel clips into AnimationGroup', () => {
    const project = makeProject(
      [makeObj('obj1'), makeObj('obj2')],
      [
        { id: 'c1', type: 'move', sourceId: 'obj1', startTime: 1, duration: 1, easing: 'linear', parallel: true, lag_ratio: 0, params: { targetX: 400, targetY: SH / 2 } },
        { id: 'c2', type: 'move', sourceId: 'obj2', startTime: 1, duration: 1, easing: 'linear', parallel: true, lag_ratio: 0, params: { targetX: 1500, targetY: SH / 2 } },
      ]
    );
    const script = generateManimScript(project);
    expect(script).toContain('AnimationGroup(');
    const agCount = (script.match(/AnimationGroup\(/g) || []).length;
    expect(agCount).toBe(1);
    expect(script).toMatch(/AnimationGroup\(.*obj1.*obj2|AnimationGroup\(.*obj2.*obj1/s);
  });

  it('uses LaggedStart when lag_ratio > 0', () => {
    const project = makeProject(
      [makeObj('obj1'), makeObj('obj2')],
      [
        { id: 'c1', type: 'move', sourceId: 'obj1', startTime: 1, duration: 1, easing: 'linear', parallel: true, lag_ratio: 0.3, params: { targetX: 400, targetY: SH / 2 } },
        { id: 'c2', type: 'move', sourceId: 'obj2', startTime: 1, duration: 1, easing: 'linear', parallel: true, lag_ratio: 0.3, params: { targetX: 1500, targetY: SH / 2 } },
      ]
    );
    const script = generateManimScript(project);
    expect(script).toContain('LaggedStart(');
    expect(script).toContain('lag_ratio=0.30');
  });
});

describe('generator — path_move', () => {
  it('emits VMobject + MoveAlongPath for path_move clips', () => {
    const project = makeProject(
      [makeObj('obj1')],
      [{
        id: 'clip1', type: 'path_move', sourceId: 'obj1',
        startTime: 1, duration: 2, easing: 'linear', parallel: false, lag_ratio: 0,
        path: [{ x: 960, y: 540 }, { x: 1200, y: 300 }, { x: 1400, y: 540 }],
      }]
    );
    const script = generateManimScript(project);
    expect(script).toContain('VMobject()');
    expect(script).toContain('set_points_as_corners(');
    expect(script).toContain('MoveAlongPath(');
  });

  it('skips path_move clips with fewer than 2 points', () => {
    const project = makeProject(
      [makeObj('obj1')],
      [{
        id: 'clip1', type: 'path_move', sourceId: 'obj1',
        startTime: 1, duration: 2, easing: 'linear', parallel: false, lag_ratio: 0,
        path: [{ x: 960, y: 540 }],
      }]
    );
    const script = generateManimScript(project);
    expect(script).not.toContain('VMobject()');
    expect(script).not.toContain('MoveAlongPath(');
  });
});

describe('generator — camera', () => {
  it('uses MovingCameraScene when cameraType is moving', () => {
    const project = {
      name: 'Test',
      stage: { width: SW, height: SH, backgroundColor: '#000000' },
      cameraType: 'moving',
      cameraTrack: [],
      objects: [makeObj('obj1')],
      groups: [],
      tracks: [{ id: 't1', name: 'Track 1', clips: [] }],
    };
    const script = generateManimScript(project);
    expect(script).toContain('MovingCameraScene');
  });

  it('emits camera.frame.animate for camera_move clips', () => {
    const project = {
      name: 'Test',
      stage: { width: SW, height: SH, backgroundColor: '#000000' },
      cameraType: 'moving',
      cameraTrack: [{
        id: 'cam1', type: 'camera_move', startTime: 0.5, duration: 1, easing: 'linear',
        params: { targetX: SW / 2, targetY: SH / 2, zoom: 2 },
      }],
      objects: [makeObj('obj1')],
      groups: [],
      tracks: [{ id: 't1', name: 'Track 1', clips: [] }],
    };
    const script = generateManimScript(project);
    expect(script).toContain('self.camera.frame.animate');
    expect(script).toContain('.set_width(');
    expect(script).toContain('7.000'); // 14 / 2
  });
});
