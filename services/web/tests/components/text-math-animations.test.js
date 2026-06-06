import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore, ENTER_ANIMS, EXIT_ANIMS } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('typewriter presets', () => {
  it('registers typewriter enter + exit presets', () => {
    expect(ENTER_ANIMS.find(a => a.value === 'typewriter')).toBeTruthy();
    expect(EXIT_ANIMS.find(a => a.value === 'typewriter_out')).toBeTruthy();
  });

  it('emits AddTextLetterByLetter / RemoveTextLetterByLetter', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Hello';
    obj.enterAnim = 'typewriter';
    obj.exitAnim = 'typewriter_out';
    obj.enterTime = 0; obj.duration = 4;
    const py = generateManimScript(store.project);
    expect(py).toContain('AddTextLetterByLetter');
    expect(py).toContain('RemoveTextLetterByLetter');
  });

  it('round-trips typewriter enter through parse', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Hi'; obj.enterAnim = 'typewriter'; obj.enterTime = 0; obj.duration = 3;
    const py = generateManimScript(store.project);
    const parsed = parseManimScript(py);
    const reObj = parsed.objects.find(o => o.type === 'text');
    expect(reObj.enterAnim).toBe('typewriter');
  });

  it('round-trips typewriter_out exit through parse', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Bye'; obj.exitAnim = 'typewriter_out'; obj.enterTime = 0; obj.duration = 3;
    const py = generateManimScript(store.project);
    const parsed = parseManimScript(py);
    const reObj = parsed.objects.find(o => o.type === 'text');
    expect(reObj.exitAnim).toBe('typewriter_out');
  });
});

describe('font round-trip', () => {
  it('preserves fontFamily through generate/parse', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Hello'; obj.fontFamily = 'Courier New'; obj.enterTime = 0; obj.duration = 3;
    const py = generateManimScript(store.project);
    const parsed = parseManimScript(py);
    const reObj = parsed.objects.find(o => o.type === 'text');
    expect(reObj.fontFamily).toBe('Courier New');
  });
});

describe('tex-matching transform', () => {
  function twoObjThenTransform(srcType, tgtType, matchTerms) {
    const a = store.addObject(srcType, 600, 540);
    const b = store.addObject(tgtType, 1200, 540);
    if (srcType === 'latex') a.latex = 'a^2 + b^2';
    if (tgtType === 'latex') b.latex = 'c^2';
    a.enterTime = 0; a.duration = 5; b.enterTime = 0; b.duration = 5;
    const clip = store.addClip(0, {
      type: 'transform', startTime: 1, duration: 1.5, easing: 'ease_in_out_cubic',
      sourceId: a.id, targetId: b.id,
    });
    if (matchTerms) clip.matchTerms = true;
    return { a, b, clip };
  }

  it('emits TransformMatchingTex for two latex objects with matchTerms', () => {
    twoObjThenTransform('latex', 'latex', true);
    expect(generateManimScript(store.project)).toContain('TransformMatchingTex(');
  });
  it('emits TransformMatchingShapes for non-latex VMobjects with matchTerms', () => {
    twoObjThenTransform('circle', 'square', true);
    expect(generateManimScript(store.project)).toContain('TransformMatchingShapes(');
  });
  it('without matchTerms emits ReplacementTransform (byte-identical legacy)', () => {
    twoObjThenTransform('latex', 'latex', false);
    const py = generateManimScript(store.project);
    expect(py).toContain('ReplacementTransform(');
    expect(py).not.toContain('TransformMatching');
  });
  it('raster source ignores matchTerms and uses FadeTransform', () => {
    twoObjThenTransform('image', 'latex', true);
    const py = generateManimScript(store.project);
    expect(py).toContain('FadeTransform(');
    expect(py).not.toContain('TransformMatching');
  });
  it('round-trips matchTerms through generate→parse', () => {
    twoObjThenTransform('latex', 'latex', true);
    const py = generateManimScript(store.project);
    const parsed = parseManimScript(py);
    const clip = parsed.tracks.flatMap(t => t.clips).find(c => c.type === 'transform');
    expect(clip.matchTerms).toBe(true);
  });
});

describe('setClipMatchTerms action', () => {
  it('sets and clears matchTerms, commits state', () => {
    const a = store.addObject('latex', 600, 540);
    const b = store.addObject('latex', 1200, 540);
    const clip = store.addClip(0, { type: 'transform', startTime: 0, duration: 1, easing: 'linear', sourceId: a.id, targetId: b.id });
    store.setClipMatchTerms(clip.id, true);
    expect(store.clipById(clip.id).matchTerms).toBe(true);
    store.setClipMatchTerms(clip.id, false);
    expect(store.clipById(clip.id).matchTerms).toBeUndefined();
  });
});

describe('counter object', () => {
  it('emits DecimalNumber with num_decimal_places', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 42; c.numDecimals = 0;
    const py = generateManimScript(store.project);
    expect(py).toContain('DecimalNumber(42');
    expect(py).toContain('num_decimal_places=0');
  });
  it('emits unit="..." only when suffix set', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 50; c.numDecimals = 1; c.suffix = 'kg';
    expect(generateManimScript(store.project)).toContain('unit="kg"');
  });
  it('round-trips a counter', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 7; c.numDecimals = 2; c.suffix = 'kg';
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'counter');
    expect(re.value).toBe(7);
    expect(re.numDecimals).toBe(2);
    expect(re.suffix).toBe('kg');
  });

  it('round-trips value=0 (not dropped to a fallback)', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.numDecimals = 0;
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'counter');
    expect(re).toBeTruthy();
    expect(re.value).toBe(0);
  });

  it('round-trips a negative value', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = -3; c.numDecimals = 0;
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'counter');
    expect(re).toBeTruthy();
    expect(re.value).toBe(-3);
  });
});

describe('keyframable value', () => {
  it('emits set_value for a value keyframe (animate mode)', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.enterTime = 0; c.duration = 5;
    store.addKeyframe(c.id, 'value', 0.5, 0);
    store.addKeyframe(c.id, 'value', 2.5, 100);
    store.setKeyframeCodegen(c.id, 'value', 'animate');
    const py = generateManimScript(store.project);
    expect(py).toContain('set_value');
  });
  it('emits set_value updater for a value keyframe (ValueTracker mode)', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.enterTime = 0; c.duration = 5;
    store.addKeyframe(c.id, 'value', 0.5, 0);
    store.addKeyframe(c.id, 'value', 2.5, 100);
    store.setKeyframeCodegen(c.id, 'value', 'ValueTracker');
    const py = generateManimScript(store.project);
    expect(py).toContain('set_value');
  });
});

describe('counter actions', () => {
  it('setCounterValue / setCounterDecimals / setCounterSuffix mutate + commit', () => {
    const c = store.addObject('counter', 960, 540);
    store.setCounterValue(c.id, 12);
    store.setCounterDecimals(c.id, 2);
    store.setCounterSuffix(c.id, '%');
    const re = store.objectById(c.id);
    expect(re.value).toBe(12);
    expect(re.numDecimals).toBe(2);
    expect(re.suffix).toBe('%');
  });
});

describe('count clip', () => {
  it('emits ValueTracker + add_updater + animate.set_value + clear_updaters', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.enterTime = 0; c.duration = 5;
    store.addClip(0, { type: 'count', objectId: c.id, from: 0, to: 100, startTime: 1, duration: 2, easing: 'linear' });
    const py = generateManimScript(store.project);
    expect(py).toContain('ValueTracker(0)');
    expect(py).toContain('add_updater(');
    expect(py).toContain('animate.set_value(100)');
    expect(py).toContain('clear_updaters()');
    expect(py).toMatch(/_count_\w+ = ValueTracker/);
  });
  it('round-trips a count clip', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.enterTime = 0; c.duration = 5;
    store.addClip(0, { type: 'count', objectId: c.id, from: 5, to: 50, startTime: 1, duration: 2, easing: 'linear' });
    const parsed = parseManimScript(generateManimScript(store.project));
    const clip = parsed.tracks.flatMap(t => t.clips).find(cl => cl.type === 'count');
    expect(clip).toBeTruthy();
    expect(clip.from).toBe(5);
    expect(clip.to).toBe(50);
    expect(clip.objectId).toBe(c.id);
  });
});
