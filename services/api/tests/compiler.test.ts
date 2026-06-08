/**
 * Unit tests for the API compiler pipeline:
 * validateProject → normalizeProject → generatePythonCode / compileProject
 */

import { describe, it, expect } from 'vitest';
import { validateProject } from '../src/compiler/validator.js';
import { normalizeProject } from '../src/compiler/normalizer.js';
import { generatePythonCode } from '../src/compiler/codegen.js';
import { compileProject } from '../src/compiler/index.js';

// ─── Shared project fixtures ──────────────────────────────────────────────────

const SW = 1920;
const SH = 1080;

function makeObj(id: string, type = 'circle', extra: Record<string, unknown> = {}) {
  return {
    id,
    type,
    name: 'Test Object',
    x: SW / 2,
    y: SH / 2,
    width: 200,
    height: 200,
    fill: '#3b82f6',
    stroke: '#ffffff',
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

function makeClip(id: string, type: string, sourceId: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type,
    sourceId,
    startTime: 0.5,
    duration: 1.5,
    easing: 'ease_in_out',
    params: {},
    ...extra,
  };
}

function makeProject(
  objects: unknown[] = [],
  clips: unknown[] = [],
  extra: Record<string, unknown> = {}
) {
  return {
    name: 'Test Animation',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    objects,
    groups: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips }],
    sceneDuration: 10,
    ...extra,
  };
}

const ASSETS_PATH = '/data/assets';

// ─── validateProject ──────────────────────────────────────────────────────────

describe('validateProject', () => {
  it('accepts a valid minimal project with no objects', () => {
    const result = validateProject(makeProject());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.errors).toBeUndefined();
    }
  });

  it('accepts a project with a circle object and a move clip', () => {
    const obj = makeObj('obj1', 'circle');
    const clip = makeClip('clip1', 'move', 'obj1', { params: { x: 500, y: 300 } });
    const result = validateProject(makeProject([obj], [clip]));
    expect(result.valid).toBe(true);
  });

  it('accepts a project with a rectangle and a fade clip', () => {
    const obj = makeObj('rect1', 'rectangle');
    const clip = makeClip('cl1', 'fade', 'rect1', { params: { opacity: 0 } });
    const result = validateProject(makeProject([obj], [clip]));
    expect(result.valid).toBe(true);
  });

  it('accepts a project with a text object', () => {
    const obj = makeObj('txt1', 'text', { text: 'Hello World', fontSize: 48 });
    const result = validateProject(makeProject([obj]));
    expect(result.valid).toBe(true);
  });

  it('accepts an emphasis clip (indicate)', () => {
    const obj = makeObj('c1', 'circle');
    const clip = makeClip('cl1', 'indicate', 'c1');
    const result = validateProject(makeProject([obj], [clip]));
    expect(result.valid).toBe(true);
  });

  it('accepts a count clip', () => {
    const obj = makeObj('n1', 'counter', { value: 0, numDecimals: 0 });
    const clip = {
      id: 'cnt1',
      type: 'count',
      sourceId: 'n1',
      startTime: 0,
      duration: 2,
      from: 0,
      to: 100,
      easing: 'linear',
      params: {},
    };
    const result = validateProject(makeProject([obj], [clip]));
    expect(result.valid).toBe(true);
  });

  it('rejects null input', () => {
    const result = validateProject(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects a plain string as input', () => {
    const result = validateProject('not-a-project');
    expect(result.valid).toBe(false);
  });

  it('rejects an array as input', () => {
    const result = validateProject([1, 2, 3]);
    expect(result.valid).toBe(false);
  });

  it('rejects an object with width:0 on the stage (not positive)', () => {
    const project = makeProject([], [], { stage: { width: 0, height: 1080 } });
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('stage'))).toBe(true);
    }
  });

  it('rejects a clip whose sourceId references a non-existent object', () => {
    const clip = makeClip('cl1', 'move', 'does-not-exist');
    const result = validateProject(makeProject([], [clip]));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('does-not-exist'))).toBe(true);
    }
  });

  it('rejects a transform clip whose targetId references a non-existent object', () => {
    const obj = makeObj('src1', 'circle');
    const clip = {
      id: 'cl1',
      type: 'transform',
      sourceId: 'src1',
      targetId: 'ghost-obj',
      startTime: 0,
      duration: 1,
      easing: 'linear',
      params: {},
    };
    const result = validateProject(makeProject([obj], [clip]));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('ghost-obj'))).toBe(true);
    }
  });

  it('rejects a clip with an unknown type', () => {
    const obj = makeObj('obj1', 'circle');
    const clip = {
      id: 'cl1',
      type: 'explode',
      sourceId: 'obj1',
      startTime: 0,
      duration: 1,
      easing: 'linear',
      params: {},
    };
    const result = validateProject(makeProject([obj], [clip]));
    expect(result.valid).toBe(false);
  });

  it('rejects an object with opacity > 1', () => {
    const obj = makeObj('obj1', 'circle', { opacity: 2 });
    const result = validateProject(makeProject([obj]));
    expect(result.valid).toBe(false);
  });
});

// ─── normalizeProject ─────────────────────────────────────────────────────────

describe('normalizeProject', () => {
  it('fills stage defaults when stage is missing', () => {
    const project = { name: 'T', objects: [], tracks: [] };
    const norm = normalizeProject(project);
    expect((norm.stage as { width: number }).width).toBe(1920);
    expect((norm.stage as { height: number }).height).toBe(1080);
  });

  it('clamps object opacity to [0, 1]', () => {
    const obj = makeObj('o1', 'circle', { opacity: 1.5 });
    const norm = normalizeProject(makeProject([obj]));
    const normObj = (norm.objects as Array<{ opacity: number }>)[0];
    expect(normObj.opacity).toBe(1);
  });

  it('enforces minimum object width/height of 1', () => {
    const obj = makeObj('o1', 'circle', { width: 0, height: -5 });
    const norm = normalizeProject(makeProject([obj]));
    const normObj = (norm.objects as Array<{ width: number; height: number }>)[0];
    expect(normObj.width).toBe(1);
    expect(normObj.height).toBe(1);
  });

  it('enforces minimum enterTime of 0', () => {
    const obj = makeObj('o1', 'circle', { enterTime: -2 });
    const norm = normalizeProject(makeProject([obj]));
    const normObj = (norm.objects as Array<{ enterTime: number }>)[0];
    expect(normObj.enterTime).toBe(0);
  });

  it('enforces minimum object duration of 0.1', () => {
    const obj = makeObj('o1', 'circle', { duration: 0 });
    const norm = normalizeProject(makeProject([obj]));
    const normObj = (norm.objects as Array<{ duration: number }>)[0];
    expect(normObj.duration).toBeGreaterThanOrEqual(0.1);
  });

  it('builds _assetMap from assets array', () => {
    const project = makeProject([], [], {
      assets: [{ id: 'a1', name: 'Logo', type: 'image', filename: 'logo.png' }],
    });
    const norm = normalizeProject(project);
    expect(norm._assetMap).toBeDefined();
    expect(norm._assetMap['a1']).toBeDefined();
    expect(norm._assetMap['a1'].filename).toBe('logo.png');
  });

  it('enforces minimum clip duration of 0.1', () => {
    const obj = makeObj('o1', 'circle');
    const clip = makeClip('cl1', 'move', 'o1', { duration: 0 });
    const norm = normalizeProject(makeProject([obj], [clip]));
    const track = (norm.tracks as Array<{ clips: Array<{ duration: number }> }>)[0];
    expect(track.clips[0].duration).toBeGreaterThanOrEqual(0.1);
  });

  it('enforces minimum clip startTime of 0', () => {
    const obj = makeObj('o1', 'circle');
    const clip = makeClip('cl1', 'move', 'o1', { startTime: -1 });
    const norm = normalizeProject(makeProject([obj], [clip]));
    const track = (norm.tracks as Array<{ clips: Array<{ startTime: number }> }>)[0];
    expect(track.clips[0].startTime).toBe(0);
  });
});

// ─── generatePythonCode ───────────────────────────────────────────────────────

describe('generatePythonCode', () => {
  it('emits a valid Python header and class definition', () => {
    const norm = normalizeProject(makeProject());
    const code = generatePythonCode(norm, ASSETS_PATH);
    expect(code).toContain('from manim import *');
    expect(code).toContain('class MainScene(');
    expect(code).toContain('def construct(self):');
  });

  it('emits a Circle constructor for a circle object', () => {
    const obj = makeObj('c1', 'circle');
    const norm = normalizeProject(makeProject([obj]));
    const code = generatePythonCode(norm, ASSETS_PATH);
    expect(code).toContain('Circle(');
  });

  it('emits a Rectangle constructor for a rectangle object', () => {
    const obj = makeObj('r1', 'rectangle');
    const norm = normalizeProject(makeProject([obj]));
    const code = generatePythonCode(norm, ASSETS_PATH);
    expect(code).toContain('Rectangle(');
  });

  it('emits a MathTex constructor for a latex object', () => {
    const obj = makeObj('l1', 'latex', { latex: 'x^2' });
    const norm = normalizeProject(makeProject([obj]));
    const code = generatePythonCode(norm, ASSETS_PATH);
    expect(code).toContain('MathTex(');
  });

  it('resolves image asset to server path using assetsBasePath', () => {
    const project = makeProject(
      [makeObj('img1', 'image', { name: 'MyImage', assetId: 'a1' })],
      [],
      { assets: [{ id: 'a1', name: 'MyImage', type: 'image', filename: 'photo.png' }] }
    );
    const norm = normalizeProject(project);
    const code = generatePythonCode(norm, ASSETS_PATH);
    expect(code).toContain('/data/assets/photo.png');
  });

  it('falls back to sanitized object name when asset has no filename', () => {
    const project = makeProject(
      [makeObj('img1', 'image', { name: 'My Photo', assetId: 'a2' })],
      [],
      { assets: [{ id: 'a2', name: 'My Photo', type: 'image' }] }
    );
    const norm = normalizeProject(project);
    const code = generatePythonCode(norm, ASSETS_PATH);
    // sanitized: spaces → underscores
    expect(code).toContain('/data/assets/');
    expect(code).toContain('My_Photo.png');
  });
});

// ─── compileProject ───────────────────────────────────────────────────────────

describe('compileProject', () => {
  it('returns success:true and a code string for a valid project', () => {
    const project = makeProject([makeObj('c1', 'circle')]);
    const result = compileProject(project, ASSETS_PATH);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.code).toBe('string');
      expect(result.code.length).toBeGreaterThan(0);
    }
  });

  it('generated code contains expected Manim boilerplate', () => {
    const project = makeProject([makeObj('c1', 'circle')]);
    const result = compileProject(project, ASSETS_PATH);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.code).toContain('from manim import *');
      expect(result.code).toContain('class MainScene(');
      expect(result.code).toContain('Circle(');
    }
  });

  it('returns success:false (not a thrown error) for null input', () => {
    const result = compileProject(null, ASSETS_PATH);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('returns success:false for a project with a bad clip reference', () => {
    const clip = makeClip('cl1', 'move', 'ghost');
    const project = makeProject([], [clip]);
    const result = compileProject(project, ASSETS_PATH);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('ghost'))).toBe(true);
    }
  });

  it('returns success:false for a project with opacity > 1', () => {
    const project = makeProject([makeObj('o1', 'circle', { opacity: 5 })]);
    const result = compileProject(project, ASSETS_PATH);
    expect(result.success).toBe(false);
  });

  it('compiles a project with a star object', () => {
    const obj = makeObj('s1', 'star');
    const result = compileProject(makeProject([obj]), ASSETS_PATH);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.code).toContain('Star(');
    }
  });

  it('compiles a project with multiple objects', () => {
    const objects = [
      makeObj('c1', 'circle'),
      makeObj('r1', 'rectangle'),
      makeObj('t1', 'text', { text: 'Hello' }),
    ];
    const result = compileProject(makeProject(objects), ASSETS_PATH);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.code).toContain('Circle(');
      expect(result.code).toContain('Rectangle(');
      expect(result.code).toContain('Text(');
    }
  });
});
