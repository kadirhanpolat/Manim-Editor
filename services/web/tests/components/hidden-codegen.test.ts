import { describe, it, expect } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

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

function makeProject(objects, clips = [], extra = {}) {
  return {
    name: 'Test',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    objects,
    groups: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips }],
    ...extra,
  };
}

describe('codegen hidden filter — byte stability (legacy projects unchanged)', () => {
  it('locked:true never changes the generated script (byte-identical)', () => {
    const plain = makeProject([makeObj('obj1'), makeObj('obj2', 'square')]);
    const locked = makeProject([
      makeObj('obj1', 'circle', { locked: true }),
      makeObj('obj2', 'square'),
    ]);
    expect(generateManimScript(locked)).toBe(generateManimScript(plain));
  });

  it('hidden:false is byte-identical to the field being absent', () => {
    const plain = makeProject([makeObj('obj1')]);
    const explicit = makeProject([makeObj('obj1', 'circle', { hidden: false })]);
    expect(generateManimScript(explicit)).toBe(generateManimScript(plain));
  });

  it('a project with no hidden fields still emits all objects', () => {
    const script = generateManimScript(makeProject([makeObj('obj1'), makeObj('obj2', 'square')]));
    expect(script).toContain('obj1 = Circle(');
    expect(script).toContain('obj2 = ');
  });
});

describe('codegen hidden filter — skipping', () => {
  it('hiding an object is byte-identical to the object not existing at all', () => {
    const withHidden = makeProject([makeObj('obj1'), makeObj('obj2', 'square', { hidden: true })]);
    const without = makeProject([makeObj('obj1')]);
    expect(generateManimScript(withHidden)).toBe(generateManimScript(without));
  });

  it('clips referencing a hidden object are dropped (no NameError in Python)', () => {
    const clip = {
      id: 'c1',
      type: 'move',
      sourceId: 'obj2',
      startTime: 1,
      duration: 1,
      easing: 'ease_in_out',
      params: { toX: 100, toY: 100 },
    };
    const withHidden = makeProject(
      [makeObj('obj1'), makeObj('obj2', 'square', { hidden: true })],
      [clip]
    );
    const without = makeProject([makeObj('obj1')], []);
    expect(generateManimScript(withHidden)).toBe(generateManimScript(without));
    expect(generateManimScript(withHidden)).not.toContain('obj2');
  });

  it('cascade: an annotation whose target is hidden is skipped too', () => {
    const withHidden = makeProject([
      makeObj('obj1', 'circle', { hidden: true }),
      makeObj('obj2', 'square'),
      makeObj('obj3', 'underline', {
        targetId: 'obj1',
        color: '#f97316',
        strokeWidth: 4,
        buff: 10,
      }),
    ]);
    const without = makeProject([makeObj('obj2', 'square')]);
    expect(generateManimScript(withHidden)).toBe(generateManimScript(without));
    expect(generateManimScript(withHidden)).not.toContain('Underline');
  });

  it('groups: a hidden child is dropped from the VGroup, visible siblings remain', () => {
    const project = makeProject(
      [makeObj('obj1'), makeObj('obj2', 'square', { hidden: true })],
      [],
      { groups: [{ id: 'g1', name: 'G', childIds: ['obj1', 'obj2'] }] }
    );
    const script = generateManimScript(project);
    expect(script).toContain('= VGroup(obj1)');
    expect(script).not.toContain('obj2');
  });

  it('keyframes on a hidden object emit no _kf_ steps', () => {
    const project = makeProject([
      makeObj('obj1'),
      makeObj('obj2', 'square', {
        hidden: true,
        keyframes: {
          x: [
            { time: 0, value: 100, easing: { type: 'linear' } },
            { time: 2, value: 800, easing: { type: 'linear' } },
          ],
        },
      }),
    ]);
    expect(generateManimScript(project)).not.toContain('_kf_');
  });

  it('all objects hidden falls back to the empty-scene self.wait(1)', () => {
    const project = makeProject([makeObj('obj1', 'circle', { hidden: true })]);
    expect(generateManimScript(project)).toContain('self.wait(1)');
    expect(generateManimScript(project)).not.toContain('Circle(');
  });
});
