import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920,
  SH = 1080;
function makeObj(type, extra = {}) {
  return {
    id: 'o1',
    type,
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
    enterAnim: 'none',
    exitAnim: 'none',
    ...extra,
  };
}
function makeProject(objects, clips = []) {
  return {
    name: 'T',
    sceneType: '2d',
    stage: { width: SW, height: SH },
    sceneDuration: 5,
    fps: 60,
    background: '#000000',
    objects,
    tracks: [{ id: 't1', name: 'T1', clips }],
    cameraTrack: [],
    assets: [],
    groups: [],
  };
}
function clip(type, params, extra = {}) {
  return {
    id: 'c1',
    type,
    sourceId: 'o1',
    startTime: 0,
    duration: 1,
    easing: 'linear',
    params,
    ...extra,
  };
}

describe('emphasis codegen', () => {
  it('Indicate', () => {
    const s = generateManimScript(
      makeProject([makeObj('circle')], [clip('indicate', { color: '#FFFF00', scale_factor: 1.2 })])
    );
    expect(s).toMatch(/self\.play\(Indicate\(\w+, color="#FFFF00", scale_factor=1\.20\)/);
  });
  it('Flash', () => {
    const s = generateManimScript(
      makeProject(
        [makeObj('circle')],
        [clip('flash', { color: '#FF0000', flash_radius: 0.3, line_length: 0.2, num_lines: 12 })]
      )
    );
    expect(s).toMatch(
      /Flash\(\w+, color="#FF0000", flash_radius=0\.30, line_length=0\.20, num_lines=12\)/
    );
  });
  it('Wiggle', () => {
    const s = generateManimScript(
      makeProject(
        [makeObj('circle')],
        [clip('wiggle', { scale_value: 1.1, rotation_angle: 3.6, n_wiggles: 6 })]
      )
    );
    expect(s).toMatch(
      /Wiggle\(\w+, scale_value=1\.10, rotation_angle=3\.60 \* DEGREES, n_wiggles=6\)/
    );
  });
  it('Circumscribe (Rectangle, fade_out False)', () => {
    const s = generateManimScript(
      makeProject(
        [makeObj('square')],
        [
          clip('circumscribe', {
            color: '#00FF00',
            shape: 'Rectangle',
            fade_out: false,
            time_width: 0.3,
          }),
        ]
      )
    );
    expect(s).toMatch(
      /Circumscribe\(\w+, color="#00FF00", shape=Rectangle, fade_out=False, time_width=0\.30\)/
    );
  });
  it('Circumscribe (Circle, fade_out True)', () => {
    const s = generateManimScript(
      makeProject(
        [makeObj('circle')],
        [
          clip('circumscribe', {
            color: '#00FF00',
            shape: 'Circle',
            fade_out: true,
            time_width: 0.5,
          }),
        ]
      )
    );
    expect(s).toMatch(
      /Circumscribe\(\w+, color="#00FF00", shape=Circle, fade_out=True, time_width=0\.50\)/
    );
  });
  it('FocusOn', () => {
    const s = generateManimScript(
      makeProject([makeObj('circle')], [clip('focus_on', { color: '#FFFFFF', opacity: 0.2 })])
    );
    expect(s).toMatch(/FocusOn\(\w+, color="#FFFFFF", opacity=0\.20\)/);
  });
  it('parallel group uses bare exprs in AnimationGroup', () => {
    const s = generateManimScript(
      makeProject(
        [makeObj('circle'), { ...makeObj('square'), id: 'o2' }],
        [
          clip('indicate', { color: '#FFFF00', scale_factor: 1.2 }, { id: 'c1', parallel: true }),
          clip(
            'wiggle',
            { scale_value: 1.1, rotation_angle: 3.6, n_wiggles: 6 },
            { id: 'c2', sourceId: 'o2', parallel: true }
          ),
        ]
      )
    );
    expect(s).toMatch(/self\.play\(AnimationGroup\(Indicate\([^)]*\), Wiggle\([^)]*\)\)/);
  });
});

describe('emphasis round-trip', () => {
  function rt(type, params, objType = 'circle') {
    const proj = makeProject([makeObj(objType)], [clip(type, params)]);
    return parseManimScript(generateManimScript(proj), SW, SH).tracks[0].clips[0];
  }
  it('round-trips Indicate', () => {
    const c = rt('indicate', { color: '#FFFF00', scale_factor: 1.5 });
    expect(c.type).toBe('indicate');
    expect(c.params.color.toUpperCase()).toBe('#FFFF00');
    expect(c.params.scale_factor).toBeCloseTo(1.5, 2);
  });
  it('round-trips Flash', () => {
    const c = rt('flash', {
      color: '#FF0000',
      flash_radius: 0.4,
      line_length: 0.25,
      num_lines: 10,
    });
    expect(c.type).toBe('flash');
    expect(c.params.flash_radius).toBeCloseTo(0.4, 2);
    expect(c.params.line_length).toBeCloseTo(0.25, 2);
    expect(c.params.num_lines).toBe(10);
  });
  it('round-trips Wiggle (rotation_angle in deg)', () => {
    const c = rt('wiggle', { scale_value: 1.2, rotation_angle: 5, n_wiggles: 8 });
    expect(c.type).toBe('wiggle');
    expect(c.params.scale_value).toBeCloseTo(1.2, 2);
    expect(c.params.rotation_angle).toBeCloseTo(5, 2);
    expect(c.params.n_wiggles).toBe(8);
  });
  it('round-trips Circumscribe', () => {
    const c = rt(
      'circumscribe',
      { color: '#00FF00', shape: 'Circle', fade_out: true, time_width: 0.5 },
      'square'
    );
    expect(c.type).toBe('circumscribe');
    expect(c.params.shape).toBe('Circle');
    expect(c.params.fade_out).toBe(true);
    expect(c.params.time_width).toBeCloseTo(0.5, 2);
  });
  it('round-trips FocusOn', () => {
    const c = rt('focus_on', { color: '#FFFFFF', opacity: 0.3 });
    expect(c.type).toBe('focus_on');
    expect(c.params.opacity).toBeCloseTo(0.3, 2);
  });
  it('round-trips a parallel Indicate+Wiggle group', () => {
    const proj = makeProject(
      [makeObj('circle'), { ...makeObj('square'), id: 'o2' }],
      [
        clip('indicate', { color: '#FFFF00', scale_factor: 1.2 }, { id: 'c1', parallel: true }),
        clip(
          'wiggle',
          { scale_value: 1.1, rotation_angle: 3.6, n_wiggles: 6 },
          { id: 'c2', sourceId: 'o2', parallel: true }
        ),
      ]
    );
    const cs = parseManimScript(generateManimScript(proj), SW, SH).tracks[0].clips;
    const types = cs.map((c) => c.type).sort();
    expect(types).toEqual(['indicate', 'wiggle']);
    expect(cs.every((c) => c.parallel)).toBe(true);
  });
});
