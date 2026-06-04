import { describe, it, expect } from 'vitest';
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
    expect(script).toContain('ax1.add(ax1_graph_');
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
    expect(script).toContain('7.111'); // 14.222 / 2
  });
});

import { parseManimScript } from '../../src/export/manim.js';

// ── Parser tests ─────────────────────────────────────────────────────────────

describe('parser — NumberPlane', () => {
  it('parses NumberPlane into numberplane object', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = NumberPlane(x_range=[-6, 6, 1], y_range=[-4, 4, 1], x_length=8.7, y_length=5.9)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].type).toBe('numberplane');
    expect(result.objects[0].xRange).toEqual([-6, 6, 1]);
    expect(result.objects[0].yRange).toEqual([-4, 4, 1]);
  });
});

describe('parser — NumberLine', () => {
  it('parses NumberLine into numberline object', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = NumberLine(x_range=[-5, 5, 1], length=8.7)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].type).toBe('numberline');
    expect(result.objects[0].xRange[0]).toBe(-5);
  });
});

describe('parser — axes graphs', () => {
  it('parses axes.plot() into graphs[] on the axes object', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        ax1 = Axes(x_range=[-5, 5, 1], y_range=[-3, 3, 1], x_length=5.8, y_length=4.4, tips=True)
        ax1.move_to([0.000, 0.000, 0])
        ax1_graph_g1 = ax1.plot(lambda x: x**2, x_range=[-3, 3], color="#F59E0B", stroke_width=3)
        self.play(FadeIn(ax1))
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.objects[0].graphs).toHaveLength(1);
    expect(result.objects[0].graphs[0].expression).toBe('x**2');
    expect(result.objects[0].graphs[0].color).toBe('#F59E0B');
    expect(result.objects[0].graphs[0].xMin).toBe(-3);
    expect(result.objects[0].graphs[0].xMax).toBe(3);
  });
});

describe('parser — MoveAlongPath', () => {
  it('parses VMobject + MoveAlongPath into path_move clip', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        path_clip1 = VMobject()
        path_clip1.set_points_as_corners([np.array(p) for p in [[-3.556, 0.000, 0], [1.333, 1.333, 0], [3.111, 0.000, 0]]])
        self.play(MoveAlongPath(obj_1, path_clip1), run_time=2.0)
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    const clips = result.tracks[0]?.clips || [];
    const pathClip = clips.find(c => c.type === 'path_move');
    expect(pathClip).toBeTruthy();
    expect(pathClip.path).toHaveLength(3);
    expect(pathClip.duration).toBe(2);
  });
});

describe('parser — AnimationGroup', () => {
  it('parses AnimationGroup into parallel clips', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([-3.556, 0.000, 0])
        obj_2 = Square(side_length=1.000)
        obj_2.move_to([3.556, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.play(FadeIn(obj_2))
        self.play(AnimationGroup(obj_1.animate.move_to([-5.000, 0.000, 0]), obj_2.animate.move_to([5.000, 0.000, 0])), run_time=1.0)
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    const clips = result.tracks[0]?.clips || [];
    const parallelClips = clips.filter(c => c.parallel === true);
    expect(parallelClips.length).toBeGreaterThanOrEqual(2);
    expect(parallelClips.every(c => c.startTime === parallelClips[0].startTime)).toBe(true);
  });

  it('parses LaggedStart with lag_ratio', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([-3.556, 0.000, 0])
        obj_2 = Square(side_length=1.000)
        obj_2.move_to([3.556, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.play(FadeIn(obj_2))
        self.play(LaggedStart(obj_1.animate.move_to([-5.000, 0.000, 0]), obj_2.animate.move_to([5.000, 0.000, 0]), lag_ratio=0.30), run_time=1.0)
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    const clips = result.tracks[0]?.clips || [];
    const parallelClips = clips.filter(c => c.parallel === true);
    expect(parallelClips.length).toBeGreaterThanOrEqual(2);
    expect(parallelClips[0].lag_ratio).toBeCloseTo(0.30);
  });
});

describe('parser — camera', () => {
  it('detects MovingCameraScene and sets cameraType', () => {
    const py = `\
from manim import *
class MainScene(MovingCameraScene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.cameraType).toBe('moving');
  });

  it('parses camera.frame.animate into cameraTrack', () => {
    const py = `\
from manim import *
class MainScene(MovingCameraScene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.play(self.camera.frame.animate.move_to([0.00, 0.00, 0]).set_width(7.111), run_time=1.0)
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.cameraTrack).toHaveLength(1);
    expect(result.cameraTrack[0].type).toBe('camera_move');
    expect(result.cameraTrack[0].params.zoom).toBeCloseTo(2); // 14.222/7.111 ≈ 2
  });
});

describe('FRAME_WIDTH unification', () => {
  const FRAME_WIDTH = 14 + 2 / 9;

  it('keyframe set_x uses the same scale as static x (14.222)', () => {
    const px = 1440, sw = 1920;
    const expectedMx = (((px / sw) - 0.5) * FRAME_WIDTH).toFixed(4); // "3.5556"
    const project = {
      name: 'kf', sceneDuration: 2,
      stage: { width: sw, height: 1080, backgroundColor: '#000' },
      objects: [{
        id: 'o1', type: 'circle', name: 'c', x: 960, y: 540, width: 100, height: 100,
        fill: '#fff', stroke: 'transparent', opacity: 1, rotation: 0,
        enterTime: 0, duration: 2, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: 0,
        keyframes: { x: [
          { time: 0.0, value: 960, easing: { type: 'linear' } },
          { time: 1.0, value: px,  easing: { type: 'linear' } },
        ] },
        keyframeCodegen: { x: 'animate' },
      }],
      tracks: [], assets: [], cameraTrack: [],
    };
    const script = generateManimScript(project);
    expect(script).toContain(`set_x(${expectedMx})`);
  });

  it('camera set_width uses FRAME_WIDTH (zoom=2 -> 7.111)', () => {
    const project = {
      name: 'cam', sceneDuration: 2, cameraType: 'moving',
      stage: { width: 1920, height: 1080, backgroundColor: '#000' },
      objects: [], tracks: [], assets: [],
      cameraTrack: [{ id: 'cm', type: 'camera_move', startTime: 0, duration: 1,
        easing: 'linear', params: { targetX: 0, targetY: 0, zoom: 2 } }],
    };
    const script = generateManimScript(project);
    expect(script).toContain('.set_width(7.111)');
  });
});
