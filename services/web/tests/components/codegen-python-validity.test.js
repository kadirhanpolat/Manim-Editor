import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';

const HELPER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'helpers', 'ast_check.py');

function hasPython() {
  try { execFileSync('python', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
}
const PY = hasPython();

// One python process validates the whole batch: stdin JSON [{name,src}] -> {name: null|error}.
function validateAll(scripts) {
  const items = Object.entries(scripts).map(([name, src]) => ({ name, src }));
  const out = execFileSync('python', [HELPER], { input: JSON.stringify(items), maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.toString());
}

function expectAllValid(scripts) {
  const res = validateAll(scripts);
  const bad = Object.entries(res).filter(([, e]) => e !== null);
  if (bad.length) {
    throw new Error('Generated invalid Python:\n' + bad.map(([n, e]) => `  [${n}] ${e}`).join('\n'));
  }
}

function gen(setup) {
  setActivePinia(createPinia());
  const store = useProjectStore();
  store.newProject('P', 'visual');
  setup(store);
  return generateManimScript(store.project);
}

const TYPES_2D = [
  'rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon',
  'line', 'arrow', 'heart', 'dot', 'dot_grid', 'text', 'latex', 'axes',
  'numberplane', 'numberline', 'annulus', 'arc', 'sector', 'double_arrow',
  'polygon_free', 'parametric', 'matrix', 'brace', 'angle', 'counter', 'table',
  'complex_plane', 'polar_plane', 'graph', 'vector_field', 'vector_components', 'ray',
];
const TYPES_3D = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d', 'surface', 'prism'];

describe.skipIf(!PY)('codegen → valid Python', () => {
  it('self-check: the validator rejects invalid python and generate emits a real scene', () => {
    // Validator has teeth (guards against a false-positive where everything "passes").
    const res = validateAll({ good: 'x = 1\n', bad: 'def f(:\n  pass\n' });
    expect(res.good).toBeNull();
    expect(res.bad).toBeTruthy();
    // generate actually emits a Manim scene (an empty string would also ast.parse).
    const py = gen(s => s.addObject('rectangle', 960, 540));
    expect(py).toContain('def construct');
    expect(py).toContain('Rectangle');
  });

  it('every 2D object type compiles', () => {
    const scripts = {};
    for (const t of TYPES_2D) scripts[t] = gen(s => s.addObject(t, 960, 540));
    expectAllValid(scripts);
  });

  it('every 3D object type compiles', () => {
    const scripts = {};
    for (const t of TYPES_3D) scripts[t] = gen(s => { s.setSceneType('3d'); s.addObject(t, 0, 0); });
    expectAllValid(scripts);
  });

  it('persistent + emphasis + count + transform + path_move clips compile', () => {
    const scripts = {};
    const CLIPS = {
      move: { targetX: 300, targetY: 200 },
      scale: { targetScaleX: 2, targetScaleY: 2 },
      fade: { targetOpacity: 0 },
      rotate: { targetRotation: 360 },
      indicate: { color: '#FFFF00', scale_factor: 1.2 },
      flash: { color: '#FFFF00', flash_radius: 0.3, line_length: 0.2, num_lines: 12 },
      wiggle: { scale_value: 1.1, rotation_angle: 3.6, n_wiggles: 6 },
      circumscribe: { color: '#FFFF00', shape: 'Rectangle', fade_out: false, time_width: 0.3 },
      focus_on: { color: '#FFFFFF', opacity: 0.2 },
    };
    for (const [t, p] of Object.entries(CLIPS)) {
      scripts[`clip_${t}`] = gen(s => {
        s.addObject('rectangle', 960, 540);
        s.selectObject(s.project.objects[0].id);
        s.createAnimation(t, p);
      });
    }
    scripts['clip_transform'] = gen(s => {
      s.addObject('circle', 800, 540);
      s.addObject('square', 1100, 540);
      s.selectObject(s.project.objects[0].id);
      s.selectObject(s.project.objects[1].id, true);
      s.createTransform();
    });
    scripts['clip_transform_matchtex'] = gen(s => {
      s.addObject('latex', 800, 540);
      s.addObject('latex', 1100, 540);
      s.selectObject(s.project.objects[0].id);
      s.selectObject(s.project.objects[1].id, true);
      const c = s.createTransform();
      if (c) s.updateClip(c.id, { matchTerms: true });
    });
    scripts['clip_count'] = gen(s => {
      s.addObject('counter', 960, 540);
      s.selectObject(s.project.objects[0].id);
      s.createCount(0, 100);
    });
    scripts['clip_path_move'] = gen(s => {
      s.addObject('dot', 400, 400);
      s.addPathMoveClip(s.project.objects[0].id, [{ x: 400, y: 400 }, { x: 800, y: 300 }, { x: 1200, y: 500 }]);
    });
    expectAllValid(scripts);
  });

  it('keyframes in all 3 codegen modes (+ 3D position) compile', () => {
    const scripts = {};
    for (const mode of ['UpdateFromAlphaFunc', 'animate', 'ValueTracker']) {
      scripts[`kf_${mode}`] = gen(s => {
        s.addObject('rectangle', 960, 540);
        const id = s.project.objects[0].id;
        s.addKeyframe(id, 'x', 0, 200);
        s.addKeyframe(id, 'x', 1.5, 800);
        s.addKeyframe(id, 'opacity', 0, 0.2);
        s.addKeyframe(id, 'opacity', 1.5, 1);
        s.setKeyframeCodegen(id, 'x', mode);
        s.setKeyframeCodegen(id, 'opacity', mode);
      });
    }
    scripts['kf_3d_position'] = gen(s => {
      s.setSceneType('3d');
      s.addObject('cube', 0, 0);
      const id = s.project.objects[0].id;
      s.addKeyframe(id, 'x3d', 0, -2);
      s.addKeyframe(id, 'x3d', 2, 2);
      s.addKeyframe(id, 'y3d', 0, 0);
      s.addKeyframe(id, 'y3d', 2, 1);
    });
    expectAllValid(scripts);
  });

  it('parallel groups, audio voiceover, and cameras compile', () => {
    const scripts = {};
    scripts['parallel_group'] = gen(s => {
      s.addObject('circle', 800, 540);
      s.addObject('square', 1100, 540);
      const [a, b] = s.project.objects;
      s.selectObject(a.id);
      const c1 = s.createAnimation('move', { targetX: 300, targetY: 0 });
      s.selectObject(b.id);
      const c2 = s.createAnimation('fade', { targetOpacity: 0 });
      if (c1) s.updateClip(c1.id, { parallel: true, startTime: 1, lag_ratio: 0.1 });
      if (c2) s.updateClip(c2.id, { parallel: true, startTime: 1, lag_ratio: 0.1 });
    });
    scripts['audio_voiceover'] = gen(s => {
      s.addObject('rectangle', 960, 540);
      s.selectObject(s.project.objects[0].id);
      const c = s.createAnimation('move', { targetX: 300, targetY: 0 });
      if (c) s.setClipAudio(c.id, { type: 'file', src: '/data/assets/audio/x.wav', status: 'ready', duration: 2.5, syncMode: 'auto' });
    });
    scripts['camera_2d_moving'] = gen(s => {
      s.setCameraType('moving');
      s.addCameraMoveClip({ startTime: 0, duration: 2, targetX: 200, targetY: 100, zoom: 1.5 });
    });
    scripts['camera_3d_move'] = gen(s => {
      s.setSceneType('3d');
      s.setCameraType('moving');
      s.addObject('sphere', 0, 0);
      s.project.cameraTrack.push({
        id: 'cam_x', type: 'camera_move', startTime: 0, duration: 2,
        easing: 'ease_in_out', params: { phi: 60, theta: -30, zoom: 1.2 },
      });
    });
    expectAllValid(scripts);
  });
});
