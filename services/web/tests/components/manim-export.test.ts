import { describe, it, expect } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { generateManimScript } from '../../src/export/manim.js';
import { useProjectStore } from '../../src/store/project.js';

const SW = 1920,
  SH = 1080;

function makeObj(id, type = 'circle', extra = {}) {
  return {
    id,
    type,
    x: SW / 2,
    y: SH / 2,
    width: 200,
    height: 200,
    fill: '#ffffff',
    stroke: 'transparent',
    strokeWidth: 2,
    opacity: 1,
    rotation: 0,
    enterTime: 0,
    duration: 5,
    enterAnim: 'fade_in',
    exitAnim: 'none',
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
    const project = makeProject(
      [
        makeObj('obj1', 'numberplane', {
          xRange: [-6, 6, 1],
          yRange: [-4, 4, 1],
          xStep: 1,
          yStep: 1,
          width: 1200,
          height: 800,
        }),
      ],
      []
    );
    const script = generateManimScript(project);
    expect(script).toContain('NumberPlane(x_range=[-6, 6, 1], y_range=[-4, 4, 1]');
  });
});

describe('generator/parser — latex', () => {
  it('emits MathTex as a normal (non-raw) python string so \\int survives', () => {
    const project = makeProject([makeObj('obj1', 'latex', { latex: '\\int_a^b' })], []);
    const script = generateManimScript(project);
    // normal python string with escaped backslash: "\\int_a^b" → \int_a^b at runtime
    expect(script).toMatch(/MathTex\("\\\\int_a\^b"/);
    // must NOT use a raw string (r"\\int" → LaTeX sees \\int, renders literal "int")
    expect(script).not.toContain('MathTex(r"');
  });

  it('round-trips \\int_a^b back to a single-backslash latex string', () => {
    const project = makeProject([makeObj('obj1', 'latex', { latex: '\\int_a^b' })], []);
    const script = generateManimScript(project);
    const parsed = parseManimScript(script, SW, SH);
    const tex = parsed.objects.find((o) => o.type === 'latex');
    expect(tex).toBeTruthy();
    expect(tex.latex).toBe('\\int_a^b');
  });
});

describe('generator — numberline', () => {
  it('emits NumberLine with x_range and length', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'numberline', {
          xRange: [-5, 5, 1],
          width: 1200,
          height: 100,
        }),
      ],
      []
    );
    const script = generateManimScript(project);
    expect(script).toContain('NumberLine(x_range=[-5, 5, 1]');
  });
});

describe('generator — axes graphs', () => {
  it('emits plot() for each graph on an axes object', () => {
    const axes = makeObj('ax1', 'axes', {
      xRange: [-5, 5, 1],
      yRange: [-3, 3, 1],
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
      xRange: [-5, 5, 1],
      yRange: [-3, 3, 1],
      graphs: [
        {
          id: 'g1',
          expression: '__import__("os")',
          color: '#fff',
          xMin: -5,
          xMax: 5,
          strokeWidth: 2,
        },
      ],
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
        {
          id: 'c1',
          type: 'move',
          sourceId: 'obj1',
          startTime: 1,
          duration: 1,
          easing: 'linear',
          parallel: true,
          lag_ratio: 0,
          params: { targetX: 400, targetY: SH / 2 },
        },
        {
          id: 'c2',
          type: 'move',
          sourceId: 'obj2',
          startTime: 1,
          duration: 1,
          easing: 'linear',
          parallel: true,
          lag_ratio: 0,
          params: { targetX: 1500, targetY: SH / 2 },
        },
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
        {
          id: 'c1',
          type: 'move',
          sourceId: 'obj1',
          startTime: 1,
          duration: 1,
          easing: 'linear',
          parallel: true,
          lag_ratio: 0.3,
          params: { targetX: 400, targetY: SH / 2 },
        },
        {
          id: 'c2',
          type: 'move',
          sourceId: 'obj2',
          startTime: 1,
          duration: 1,
          easing: 'linear',
          parallel: true,
          lag_ratio: 0.3,
          params: { targetX: 1500, targetY: SH / 2 },
        },
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
      [
        {
          id: 'clip1',
          type: 'path_move',
          sourceId: 'obj1',
          startTime: 1,
          duration: 2,
          easing: 'linear',
          parallel: false,
          lag_ratio: 0,
          path: [
            { x: 960, y: 540 },
            { x: 1200, y: 300 },
            { x: 1400, y: 540 },
          ],
        },
      ]
    );
    const script = generateManimScript(project);
    expect(script).toContain('VMobject()');
    expect(script).toContain('set_points_as_corners(');
    expect(script).toContain('MoveAlongPath(');
  });

  it('skips path_move clips with fewer than 2 points', () => {
    const project = makeProject(
      [makeObj('obj1')],
      [
        {
          id: 'clip1',
          type: 'path_move',
          sourceId: 'obj1',
          startTime: 1,
          duration: 2,
          easing: 'linear',
          parallel: false,
          lag_ratio: 0,
          path: [{ x: 960, y: 540 }],
        },
      ]
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
      cameraTrack: [
        {
          id: 'cam1',
          type: 'camera_move',
          startTime: 0.5,
          duration: 1,
          easing: 'linear',
          params: { targetX: SW / 2, targetY: SH / 2, zoom: 2 },
        },
      ],
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
    const pathClip = clips.find((c) => c.type === 'path_move');
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
    const parallelClips = clips.filter((c) => c.parallel === true);
    expect(parallelClips.length).toBeGreaterThanOrEqual(2);
    expect(parallelClips.every((c) => c.startTime === parallelClips[0].startTime)).toBe(true);
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
    const parallelClips = clips.filter((c) => c.parallel === true);
    expect(parallelClips.length).toBeGreaterThanOrEqual(2);
    expect(parallelClips[0].lag_ratio).toBeCloseTo(0.3);
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

// ── Text & Math Animations — byte-stability invariants (Phase 3) ─────────────

describe('generator — counter (DecimalNumber)', () => {
  it('value=0, numDecimals=0, no suffix → DecimalNumber(0, num_decimal_places=0) without unit=', () => {
    const project = makeProject([makeObj('obj1', 'counter', { value: 0, numDecimals: 0 })], []);
    const py = generateManimScript(project);
    expect(py).toContain('DecimalNumber(0, num_decimal_places=0)');
    expect(py).not.toContain('unit=');
  });

  it('value=50, numDecimals=1, suffix="u" → DecimalNumber(50, num_decimal_places=1, unit="u")', () => {
    const project = makeProject(
      [makeObj('obj1', 'counter', { value: 50, numDecimals: 1, suffix: 'u' })],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('DecimalNumber(50, num_decimal_places=1, unit="u")');
  });

  it('LaTeX-special suffix "%" is escaped (DecimalNumber unit renders via MathTex)', () => {
    const project = makeProject(
      [makeObj('obj1', 'counter', { value: 50, numDecimals: 0, suffix: '%' })],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('unit="\\\\%"'); // escaped \\% in the emitted .py
    expect(py).not.toContain('unit="%"'); // never the bare % that breaks the render
  });

  it('round-trips a LaTeX-special suffix back to the raw value', () => {
    const project = makeProject(
      [makeObj('obj1', 'counter', { value: 7, numDecimals: 0, suffix: '%' })],
      []
    );
    const py = generateManimScript(project);
    const back = parseManimScript(py, SW, SH);
    const ctr = back.objects.find((o) => o.type === 'counter');
    expect(ctr).toBeTruthy();
    expect(ctr.suffix).toBe('%');
  });
});

describe('generator — count clip (ValueTracker block)', () => {
  it('emits _count_<clipid> = ValueTracker(, add_updater set_value, animate.set_value, clear_updaters', () => {
    const obj = makeObj('ctr1', 'counter', { value: 0, numDecimals: 0 });
    const clip = {
      id: 'clip1',
      type: 'count',
      objectId: 'ctr1',
      from: 0,
      to: 100,
      startTime: 1,
      duration: 2,
      easing: 'linear',
      parallel: false,
      lag_ratio: 0,
    };
    const py = generateManimScript(makeProject([obj], [clip]));
    expect(py).toContain('_count_');
    expect(py).toContain('= ValueTracker(');
    expect(py).toContain('.add_updater(lambda m: m.set_value(');
    expect(py).toContain('.get_value()');
    expect(py).toContain('.animate.set_value(');
    expect(py).toContain('.clear_updaters()');
  });

  it('count clip is skipped in parallel group (animExpr returns null, no _count_ in AnimationGroup)', () => {
    const obj1 = makeObj('ctr1', 'counter', { value: 0, numDecimals: 0 });
    const obj2 = makeObj('obj2', 'circle');
    const clips = [
      {
        id: 'c1',
        type: 'count',
        objectId: 'ctr1',
        from: 0,
        to: 50,
        startTime: 1,
        duration: 2,
        easing: 'linear',
        parallel: true,
        lag_ratio: 0,
      },
      {
        id: 'c2',
        type: 'move',
        sourceId: 'obj2',
        startTime: 1,
        duration: 2,
        easing: 'linear',
        parallel: true,
        lag_ratio: 0,
        params: { targetX: 400, targetY: SH / 2 },
      },
    ];
    const py = generateManimScript(makeProject([obj1, obj2], clips));
    // The AnimationGroup expression list must not include a _count_ reference
    expect(py).not.toMatch(/AnimationGroup\([^)]*_count_/);
  });
});

describe('generator — transformExpr (matchTerms)', () => {
  it('two latex + matchTerms → TransformMatchingTex(', () => {
    const la = makeObj('la1', 'latex', { latex: 'a^2', enterTime: 0, duration: 5 });
    const lb = makeObj('lb1', 'latex', { latex: 'b^2', enterTime: 0, duration: 5 });
    const clip = {
      id: 'tc1',
      type: 'transform',
      sourceId: 'la1',
      targetId: 'lb1',
      startTime: 1,
      duration: 1,
      easing: 'linear',
      parallel: false,
      lag_ratio: 0,
      matchTerms: true,
    };
    const py = generateManimScript(makeProject([la, lb], [clip]));
    expect(py).toContain('TransformMatchingTex(');
  });

  it('two non-latex VMobjects + matchTerms → TransformMatchingShapes(', () => {
    const ca = makeObj('ca1', 'circle', { enterTime: 0, duration: 5 });
    const cb = makeObj('cb1', 'square', { enterTime: 0, duration: 5 });
    const clip = {
      id: 'tc2',
      type: 'transform',
      sourceId: 'ca1',
      targetId: 'cb1',
      startTime: 1,
      duration: 1,
      easing: 'linear',
      parallel: false,
      lag_ratio: 0,
      matchTerms: true,
    };
    const py = generateManimScript(makeProject([ca, cb], [clip]));
    expect(py).toContain('TransformMatchingShapes(');
  });

  it('no matchTerms → ReplacementTransform(, NOT TransformMatching', () => {
    const la = makeObj('la1', 'latex', { latex: 'a^2', enterTime: 0, duration: 5 });
    const lb = makeObj('lb1', 'latex', { latex: 'b^2', enterTime: 0, duration: 5 });
    const clip = {
      id: 'tc3',
      type: 'transform',
      sourceId: 'la1',
      targetId: 'lb1',
      startTime: 1,
      duration: 1,
      easing: 'linear',
      parallel: false,
      lag_ratio: 0,
    };
    const py = generateManimScript(makeProject([la, lb], [clip]));
    expect(py).toContain('ReplacementTransform(');
    expect(py).not.toContain('TransformMatching');
  });

  it('raster source + matchTerms → FadeTransform(, NOT TransformMatching', () => {
    const img = makeObj('img1', 'image', { name: 'photo', enterTime: 0, duration: 5 });
    const lb = makeObj('lb1', 'latex', { latex: 'b^2', enterTime: 0, duration: 5 });
    const clip = {
      id: 'tc4',
      type: 'transform',
      sourceId: 'img1',
      targetId: 'lb1',
      startTime: 1,
      duration: 1,
      easing: 'linear',
      parallel: false,
      lag_ratio: 0,
      matchTerms: true,
    };
    const py = generateManimScript(makeProject([img, lb], [clip]));
    expect(py).toContain('FadeTransform(');
    expect(py).not.toContain('TransformMatching');
  });
});

describe('generator — typewriter presets', () => {
  it('enterAnim typewriter → AddTextLetterByLetter(', () => {
    const project = makeProject(
      [makeObj('obj1', 'text', { content: 'Hello', enterAnim: 'typewriter' })],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('AddTextLetterByLetter(');
  });

  it('exitAnim typewriter_out → RemoveTextLetterByLetter(', () => {
    const project = makeProject(
      [makeObj('obj1', 'text', { content: 'Bye', exitAnim: 'typewriter_out', duration: 3 })],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('RemoveTextLetterByLetter(');
  });
});

describe('FRAME_WIDTH unification', () => {
  const FRAME_WIDTH = 14 + 2 / 9;

  it('keyframe set_x uses the same scale as static x (14.222)', () => {
    const px = 1440,
      sw = 1920;
    const expectedMx = ((px / sw - 0.5) * FRAME_WIDTH).toFixed(4); // "3.5556"
    const project = {
      name: 'kf',
      sceneDuration: 2,
      stage: { width: sw, height: 1080, backgroundColor: '#000' },
      objects: [
        {
          id: 'o1',
          type: 'circle',
          name: 'c',
          x: 960,
          y: 540,
          width: 100,
          height: 100,
          fill: '#fff',
          stroke: 'transparent',
          opacity: 1,
          rotation: 0,
          enterTime: 0,
          duration: 2,
          enterAnim: 'fade_in',
          exitAnim: 'fade_out',
          zOrder: 0,
          keyframes: {
            x: [
              { time: 0.0, value: 960, easing: { type: 'linear' } },
              { time: 1.0, value: px, easing: { type: 'linear' } },
            ],
          },
          keyframeCodegen: { x: 'animate' },
        },
      ],
      tracks: [],
      assets: [],
      cameraTrack: [],
    };
    const script = generateManimScript(project);
    expect(script).toContain(`set_x(${expectedMx})`);
  });

  it('camera set_width uses FRAME_WIDTH (zoom=2 -> 7.111)', () => {
    const project = {
      name: 'cam',
      sceneDuration: 2,
      cameraType: 'moving',
      stage: { width: 1920, height: 1080, backgroundColor: '#000' },
      objects: [],
      tracks: [],
      assets: [],
      cameraTrack: [
        {
          id: 'cm',
          type: 'camera_move',
          startTime: 0,
          duration: 1,
          easing: 'linear',
          params: { targetX: 0, targetY: 0, zoom: 2 },
        },
      ],
    };
    const script = generateManimScript(project);
    expect(script).toContain('.set_width(7.111)');
  });
});

// ── Data & Coordinate Objects — byte-stability invariants (Phase 4) ──────────

describe('generator — table (no labels, text mode)', () => {
  it('emits Table with cell data', () => {
    const obj = makeObj('t1', 'table', {
      cellData: [
        ['1', '2'],
        ['3', '4'],
      ],
      mathMode: false,
      rowLabels: [],
      colLabels: [],
    });
    const py = generateManimScript(makeProject([obj], []));
    expect(py).toContain('Table([["1", "2"], ["3", "4"]])');
    expect(py).not.toContain('MathTable');
    expect(py).not.toContain('row_labels');
  });
});

describe('generator — table (MathTable + row/col labels)', () => {
  it('emits MathTable with MathTex row and col labels', () => {
    const obj = makeObj('t2', 'table', {
      cellData: [
        ['1', '2'],
        ['3', '4'],
      ],
      mathMode: true,
      rowLabels: ['a', 'b'],
      colLabels: ['x', 'y'],
    });
    const py = generateManimScript(makeProject([obj], []));
    expect(py).toContain('MathTable(');
    expect(py).toContain('row_labels=[MathTex("a")');
    expect(py).toContain('col_labels=[MathTex("x")');
  });
});

describe('generator — complex_plane', () => {
  it('emits ComplexPlane with x_range and y_range', () => {
    const obj = makeObj('cp1', 'complex_plane', {
      xRange: [-3, 3, 1],
      yRange: [-2, 2, 1],
      width: 1200,
      height: 800,
    });
    const py = generateManimScript(makeProject([obj], []));
    expect(py).toContain('ComplexPlane(x_range=[-3, 3, 1], y_range=[-2, 2, 1]');
  });
});

describe('generator — polar_plane', () => {
  it('emits PolarPlane with radius_max, radius_step, azimuth_units', () => {
    const obj = makeObj('pp1', 'polar_plane', {
      radiusMax: 4,
      radiusStep: 1,
      azimuthUnits: 12,
      width: 800,
      height: 800,
    });
    const py = generateManimScript(makeProject([obj], []));
    expect(py).toContain('PolarPlane(radius_max=4, radius_step=1, azimuth_units=12');
  });
});

describe('generator — graph (undirected + labels)', () => {
  it('emits Graph with vertices, edges, layout and labels=True', () => {
    const obj = makeObj('g1', 'graph', {
      vertices: ['A', 'B', 'C'],
      edges: [
        ['A', 'B'],
        ['B', 'C'],
      ],
      positions: { A: [-60, 0], B: [0, -40], C: [60, 0] },
      directed: false,
      showLabels: true,
    });
    const py = generateManimScript(makeProject([obj], []));
    expect(py).toContain('Graph(["A", "B", "C"], [("A", "B"), ("B", "C")], layout={');
    expect(py).toContain('labels=True');
  });
});

describe('generator — graph (directed)', () => {
  it('emits DiGraph when directed=true', () => {
    const obj = makeObj('g2', 'graph', {
      vertices: ['A', 'B'],
      edges: [['A', 'B']],
      positions: { A: [-60, 0], B: [60, 0] },
      directed: true,
      showLabels: false,
    });
    const py = generateManimScript(makeProject([obj], []));
    expect(py).toContain('DiGraph(["A"');
  });
});

describe('generator — vector_field', () => {
  it('emits ArrowVectorField with double-lambda form', () => {
    const obj = makeObj('vf1', 'vector_field', {
      fx: 'y',
      fy: '-x',
      xRange: [-3, 3, 1],
      yRange: [-2, 2, 1],
    });
    const py = generateManimScript(makeProject([obj], []));
    expect(py).toContain(
      'ArrowVectorField(lambda p: (lambda x, y: np.array([y, -x, 0]))(p[0], p[1])'
    );
  });
});

// ── Wave 1 Track C — content objects ─────────────────────────────────────────

describe('generator — code (Code mobject, single-line)', () => {
  it('emits Code(code_string=…, language=…, add_line_numbers=False).scale_to_fit_width(…) on one line', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'code', {
          codeText: 'def hello():\n    print("Hello")',
          language: 'python',
          fontSize: 18,
          width: 480,
          height: 280,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    // 480/1920*14.2222 = 3.556 — width drives render size (LOCKED mechanism)
    expect(py).toContain(
      'obj1 = Code(code_string="def hello():\\n    print(\\"Hello\\")", language="python", add_line_numbers=False).scale_to_fit_width(3.556)'
    );
    // standard post-construction position line (object at stage center → manim origin)
    expect(py).toContain('obj1.move_to([0.000, 0.000, 0])');
    // fontSize is preview-only — never emitted
    expect(py).not.toContain('font_size');
    expect(py).not.toContain('paragraph_config');
  });

  it('falls back to language="python" for a non-allowlisted language', () => {
    const project = makeProject(
      [makeObj('obj1', 'code', { codeText: 'x', language: 'ruby', width: 480, height: 280 })],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('language="python"');
    expect(py).not.toContain('language="ruby"');
  });

  it('stays out of the effect emitters (no set_color/gradient/dash/shadow lines)', () => {
    const project = makeProject(
      [makeObj('obj1', 'code', { codeText: 'x = 1', language: 'python', width: 480, height: 280 })],
      []
    );
    const py = generateManimScript(project);
    expect(py).not.toContain('obj1.set_color(');
    expect(py).not.toContain('set_color_by_gradient');
    expect(py).not.toContain('DashedVMobject');
    expect(py).not.toContain('_shadow_obj1');
  });
});

describe('generator — bar_chart (BarChart, single-line)', () => {
  it('emits BarChart(values, bar_names, y_range=[0, yMax, yMax/5], bar_colors, x_length, y_length)', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'bar_chart', {
          values: [3, 5, 2, 6],
          barNames: ['A', 'B', 'C', 'D'],
          yMax: 8,
          barColors: ['#58c4dd', '#83c167', '#fc6255', '#ffff00'],
          width: 600,
          height: 400,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    // x_length = 600/1920*14.2222 = 4.4 ; y_length = 400/1080*8 = 3.0 ; step = 8/5 = 1.6
    expect(py).toContain(
      'obj1 = BarChart(values=[3, 5, 2, 6], bar_names=["A", "B", "C", "D"], y_range=[0, 8, 1.6], bar_colors=["#58c4dd", "#83c167", "#fc6255", "#ffff00"], x_length=4.4, y_length=3.0)'
    );
    expect(py).toContain('obj1.move_to([0.000, 0.000, 0])');
  });

  it('sanitizes barNames via safeMatrixEntry (quotes/backslashes stripped — they become Tex)', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'bar_chart', {
          values: [1, 2],
          barNames: ['A"B', 'C\\D'],
          yMax: 8,
          barColors: ['#58c4dd', '#83c167'],
          width: 600,
          height: 400,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('bar_names=["AB", "CD"]');
  });

  it('fills missing names with letters and invalid colors with the default blue', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'bar_chart', {
          values: [1, 2, 3],
          barNames: ['X'],
          yMax: 5,
          barColors: ['#ff0000', 'not-a-color'],
          width: 600,
          height: 400,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('bar_names=["X", "B", "C"]');
    expect(py).toContain('bar_colors=["#ff0000", "#58c4dd", "#58c4dd"]');
    expect(py).toContain('y_range=[0, 5, 1]');
  });
});

describe('parser round-trip — code', () => {
  it('round-trips multiline code with quotes, tabs and literal backslashes', () => {
    const src = 'def f(path):\n\treturn "C:\\\\tmp" + path';
    const project = makeProject(
      [makeObj('obj1', 'code', { codeText: src, language: 'cpp', width: 480, height: 280 })],
      []
    );
    const py = generateManimScript(project);
    const back = parseManimScript(py, SW, SH);
    const o = back.objects.find((x) => x.type === 'code');
    expect(o).toBeTruthy();
    expect(o.codeText).toBe(src);
    expect(o.language).toBe('cpp');
    // width round-trips through scale_to_fit_width (3-decimal precision)
    expect(Math.abs(o.width - 480)).toBeLessThanOrEqual(1);
  });

  it('a literal backslash-n in the source does NOT come back as a newline', () => {
    const src = 'print("a\\\\nb")'; // python source containing the 4 chars  \ \ n b → JS string 'print("a\\nb")'
    const project = makeProject(
      [makeObj('obj1', 'code', { codeText: src, language: 'python', width: 480, height: 280 })],
      []
    );
    const back = parseManimScript(generateManimScript(project), SW, SH);
    const o = back.objects.find((x) => x.type === 'code');
    expect(o.codeText).toBe(src);
  });
});

describe('parser round-trip — bar_chart', () => {
  it('round-trips values, barNames, yMax, barColors and approximate size', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'bar_chart', {
          values: [3, 5.5, 2, 6],
          barNames: ['Q1', 'Q2', 'Q3', 'Q4'],
          yMax: 10,
          barColors: ['#58c4dd', '#83c167', '#fc6255', '#ffff00'],
          width: 600,
          height: 400,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    const back = parseManimScript(py, SW, SH);
    const o = back.objects.find((x) => x.type === 'bar_chart');
    expect(o).toBeTruthy();
    expect(o.values).toEqual([3, 5.5, 2, 6]);
    expect(o.barNames).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(o.yMax).toBe(10);
    expect(o.barColors).toEqual(['#58c4dd', '#83c167', '#fc6255', '#ffff00']);
    // x_length/y_length are emitted with 1 decimal → ~2% size tolerance
    expect(Math.abs(o.width - 600)).toBeLessThan(15);
    expect(Math.abs(o.height - 400)).toBeLessThan(15);
  });
});

describe('parser round-trip — sections', () => {
  function projectWithSections() {
    setActivePinia(createPinia());
    const store = useProjectStore();
    store.newProject('Test', 'visual');
    store.addObject('circle', 800, 540);
    store.selectObject(store.project.objects[0].id);
    store.createAnimation('move', { targetX: 300, targetY: 200 });
    store.addSection(0, 'Intro');
    store.addSection(1, 'Outro');
    return store.project;
  }

  const sectionLines = (src) =>
    src
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('self.next_section('));

  it('round-trips next_section markers back to project.sections', () => {
    const py = generateManimScript(projectWithSections());
    expect(py).toContain('self.next_section("Intro")');
    expect(py).toContain('self.next_section("Outro")');

    const back = parseManimScript(py, SW, SH);
    expect(Array.isArray(back.sections)).toBe(true);
    expect(back.sections.map((s) => s.title)).toEqual(['Intro', 'Outro']);
    // each parsed section carries a stable id + numeric, non-decreasing time
    expect(back.sections.every((s) => typeof s.id === 'string' && s.id.length > 0)).toBe(true);
    expect(back.sections[0].time).toBeLessThanOrEqual(back.sections[1].time);
  });

  it('re-emits identical next_section lines (round-trip stability)', () => {
    const project = projectWithSections();
    const gen1 = generateManimScript(project);
    const back = parseManimScript(gen1, SW, SH);
    // Swap the parsed sections back onto the same timeline; placement must be identical.
    const project2 = { ...project, sections: back.sections };
    const gen2 = generateManimScript(project2);
    expect(sectionLines(gen2)).toEqual(sectionLines(gen1));
  });
});

describe('parser multi-line robustness', () => {
  const HEAD = ['from manim import *', 'class MainScene(Scene):', '    def construct(self):'];

  it('parses a constructor split across multiple lines', () => {
    const py = [
      ...HEAD,
      '        obj_1 = Circle(',
      '            radius=2.0',
      '        )',
      '        obj_1.set_fill(color="#22c55e", opacity=1)',
      '        obj_1.move_to([0.000, 0.000, 0])',
      '        self.play(FadeIn(obj_1))',
      '        self.wait(1)',
    ].join('\n');
    const result = parseManimScript(py, SW, SH);
    expect(result.objects.find((o) => o.type === 'circle')).toBeTruthy();
  });

  it('preserves in-string commas, parens and spaces when joining lines', () => {
    const py = [
      ...HEAD,
      '        obj_1 = Text(',
      '            "a, b (c)",',
      '            font_size=48,',
      '            font="Arial"',
      '        )',
      '        obj_1.move_to([0.000, 0.000, 0])',
      '        self.play(FadeIn(obj_1))',
      '        self.wait(1)',
    ].join('\n');
    const result = parseManimScript(py, SW, SH);
    const t = result.objects.find((o) => o.type === 'text');
    expect(t).toBeTruthy();
    expect(t.content).toBe('a, b (c)');
  });

  it('parses a multi-line animation call', () => {
    const py = [
      ...HEAD,
      '        obj_1 = Circle(radius=2.0)',
      '        obj_1.move_to([0.000, 0.000, 0])',
      '        self.play(',
      '            obj_1.animate.move_to([2.000, 0.000, 0]),',
      '            run_time=1.0',
      '        )',
      '        self.wait(1)',
    ].join('\n');
    const result = parseManimScript(py, SW, SH);
    const clips = result.tracks[0]?.clips || [];
    expect(clips.find((c) => c.type === 'move')).toBeTruthy();
  });

  it('does not alter equivalent single-line input (no regression)', () => {
    const py = [
      ...HEAD,
      '        obj_1 = Circle(radius=2.0)',
      '        obj_1.set_fill(color="#22c55e", opacity=1)',
      '        obj_1.move_to([0.000, 0.000, 0])',
      '        self.play(FadeIn(obj_1))',
      '        self.wait(1)',
    ].join('\n');
    const result = parseManimScript(py, SW, SH);
    expect(result.objects.find((o) => o.type === 'circle')).toBeTruthy();
  });
});
