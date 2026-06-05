import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('keyframeDefaults', () => {
  it('project has keyframeDefaults with mode opt-in', () => {
    expect(store.project.keyframeDefaults).toBeDefined();
    expect(store.project.keyframeDefaults.mode).toBe('opt-in');
    expect(store.project.keyframeDefaults.codegenMode).toBe('UpdateFromAlphaFunc');
  });
});

describe('clampKeyframesToRange', () => {
  it('clamps keyframes outside [enterTime, enterTime+duration] to the boundary', () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.updateObject(obj.id, { enterTime: 1, duration: 3 }); // visible interval [1, 4]
    store.addKeyframe(obj.id, 'x', 0.2, 100);  // before start → clamps to 1
    store.addKeyframe(obj.id, 'x', 2.5, 500);  // inside → unchanged
    store.addKeyframe(obj.id, 'x', 9.0, 900);  // after end → clamps to 4
    store.clampKeyframesToRange(obj.id);
    const times = store.objectById(obj.id).keyframes.x.map(k => k.time);
    expect(Math.min(...times)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...times)).toBeLessThanOrEqual(4);
    expect(times).toContain(2.5);
  });
});

describe('shiftKeyframes', () => {
  it('shifts all keyframe times by delta (clamped at 0)', () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 100);
    store.addKeyframe(obj.id, 'x', 3.0, 500);
    store.shiftKeyframes(obj.id, 1.5);
    expect(store.objectById(obj.id).keyframes.x.map(k => k.time)).toEqual([2.5, 4.5]);
    store.shiftKeyframes(obj.id, -10); // clamps both at 0
    expect(store.objectById(obj.id).keyframes.x.every(k => k.time >= 0)).toBe(true);
  });
});

describe('addKeyframe', () => {
  it('adds a keyframe to an object property', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    const updated = store.objectById(obj.id);
    expect(updated.keyframes).toBeDefined();
    expect(updated.keyframes.x).toHaveLength(1);
    expect(updated.keyframes.x[0].time).toBe(1.0);
    expect(updated.keyframes.x[0].value).toBe(500);
    expect(updated.keyframes.x[0].easing).toEqual({ type: 'linear' });
  });

  it('updates existing keyframe at same time', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.addKeyframe(obj.id, 'x', 1.0, 700);
    expect(store.objectById(obj.id).keyframes.x).toHaveLength(1);
    expect(store.objectById(obj.id).keyframes.x[0].value).toBe(700);
  });

  it('keeps keyframes sorted by time', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 2.0, 800);
    store.addKeyframe(obj.id, 'x', 0.5, 100);
    const kfs = store.objectById(obj.id).keyframes.x;
    expect(kfs[0].time).toBe(0.5);
    expect(kfs[1].time).toBe(2.0);
  });
});

describe('addKeyframeScaffold', () => {
  it('seeds start + end keyframes on the first keyframe of a property', () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.updateObject(obj.id, { enterTime: 1, duration: 3 }); // visible [1, 4]
    store.addKeyframeScaffold(obj.id, 'x', 2.5);
    const times = store.objectById(obj.id).keyframes.x.map(k => k.time);
    expect(times).toEqual([1, 2.5, 4]);
  });

  it('clamps the playhead time into the visible interval', () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.updateObject(obj.id, { enterTime: 0, duration: 3 }); // visible [0, 3]
    store.addKeyframeScaffold(obj.id, 'x', 9.0); // past end → clamps to 3 (dedup with seeded end)
    const times = store.objectById(obj.id).keyframes.x.map(k => k.time);
    expect(times).toEqual([0, 3]);
  });

  it('adds only one keyframe once the property already has keyframes', () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.updateObject(obj.id, { enterTime: 0, duration: 4 }); // visible [0, 4]
    store.addKeyframeScaffold(obj.id, 'x', 1); // first → seeds 0, 1, 4
    store.addKeyframeScaffold(obj.id, 'x', 2); // not first → just adds 2
    const times = store.objectById(obj.id).keyframes.x.map(k => k.time);
    expect(times).toEqual([0, 1, 2, 4]);
  });

  it('marks the seeded boundary keyframes as pinned start/end', () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.updateObject(obj.id, { enterTime: 0, duration: 3 });
    store.addKeyframeScaffold(obj.id, 'x', 1.5);
    const kfs = store.objectById(obj.id).keyframes.x;
    expect(kfs[0].pinned).toBe('start');
    expect(kfs[kfs.length - 1].pinned).toBe('end');
    expect(kfs[1].pinned).toBeUndefined();
  });
});

describe('clampKeyframesToRange with pinned keyframes', () => {
  it('drags the pinned end keyframe outward when the bar is expanded', () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.updateObject(obj.id, { enterTime: 0, duration: 3 }); // [0, 3]
    store.addKeyframeScaffold(obj.id, 'x', 1.5);               // 0(start), 1.5, 3(end)
    store.updateObject(obj.id, { duration: 6 });               // expand to [0, 6]
    store.clampKeyframesToRange(obj.id);
    const kfs = store.objectById(obj.id).keyframes.x;
    expect(kfs.find(k => k.pinned === 'start').time).toBe(0);
    expect(kfs.find(k => k.pinned === 'end').time).toBe(6);    // followed the new edge
  });

  it('keeps pinned keyframes at the edges when the object is repositioned', () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.updateObject(obj.id, { enterTime: 0, duration: 4 }); // [0, 4]
    store.addKeyframeScaffold(obj.id, 'x', 2);                 // 0, 2, 4
    store.updateObject(obj.id, { enterTime: 2 });              // moved → [2, 6]
    store.clampKeyframesToRange(obj.id);
    const kfs = store.objectById(obj.id).keyframes.x;
    expect(kfs.find(k => k.pinned === 'start').time).toBe(2);
    expect(kfs.find(k => k.pinned === 'end').time).toBe(6);
  });
});

describe('removeKeyframe', () => {
  it('removes a keyframe', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.removeKeyframe(obj.id, 'x', 1.0);
    expect(store.objectById(obj.id).keyframes).toBeUndefined();
  });

  it('cleans up empty prop arrays', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.addKeyframe(obj.id, 'y', 1.0, 300);
    store.removeKeyframe(obj.id, 'x', 1.0);
    expect(store.objectById(obj.id).keyframes.x).toBeUndefined();
    expect(store.objectById(obj.id).keyframes.y).toHaveLength(1);
  });
});

describe('updateKeyframeValue', () => {
  it('updates only the value', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.updateKeyframeValue(obj.id, 'x', 1.0, 999);
    expect(store.objectById(obj.id).keyframes.x[0].value).toBe(999);
    expect(store.objectById(obj.id).keyframes.x[0].easing).toEqual({ type: 'linear' });
  });
});

describe('updateKeyframeEasing', () => {
  it('updates the easing of a keyframe', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.updateKeyframeEasing(obj.id, 'x', 1.0, { type: 'ease_in_out' });
    expect(store.objectById(obj.id).keyframes.x[0].easing).toEqual({ type: 'ease_in_out' });
  });
});

describe('setKeyframeMode', () => {
  it('sets per-property keyframe mode', () => {
    const obj = store.addObject('circle', 960, 540);
    store.setKeyframeMode(obj.id, 'x', 'override');
    expect(store.objectById(obj.id).keyframeMode.x).toBe('override');
  });
});

describe('setKeyframeCodegen', () => {
  it('sets per-property codegen mode', () => {
    const obj = store.addObject('circle', 960, 540);
    store.setKeyframeCodegen(obj.id, 'x', 'ValueTracker');
    expect(store.objectById(obj.id).keyframeCodegen.x).toBe('ValueTracker');
  });
});

describe('selectKeyframe', () => {
  it('sets selectedKeyframeId', () => {
    store.selectKeyframe('obj_1', 'x', 1.5);
    expect(store.selectedKeyframeId).toEqual({ objId: 'obj_1', prop: 'x', time: 1.5 });
  });

  it('clears selectedKeyframeId with null args', () => {
    store.selectKeyframe('obj_1', 'x', 1.5);
    store.selectKeyframe(null, null, null);
    expect(store.selectedKeyframeId).toBeNull();
  });
});

describe('undo/redo with keyframes', () => {
  it('undoes addKeyframe', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.undo();
    expect(store.objectById(obj.id).keyframes).toBeUndefined();
  });
});
