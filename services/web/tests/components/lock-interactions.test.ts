import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';
import { useProjectStore } from '../../src/store/project.js';
import { lockConfig } from '../../src/components/stage/configs/chrome.js';
import { useStageInteractions } from '../../src/components/stage/composables/useStageInteractions.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

// Minimal Deps mock — Konva refs are null (updateTransformer self-guards),
// coordinate fns are identity.
function makeDeps(extra = {}) {
  return {
    konvaStage: ref(null),
    objectsLayer: ref(null),
    transformer: ref(null),
    vs: computed(() => 1),
    ox: computed(() => 0),
    oy: computed(() => 0),
    s2c: (x, y) => ({ x, y }),
    c2s: (x, y) => ({ x, y }),
    unprojectView: () => ({}),
    themeAccent: computed(() => '#7c5cff'),
    startPan: () => {},
    is3D: computed(() => false),
    pathDrawing: ref(false),
    pathPoints: ref([]),
    pathSourceId: ref(null),
    guides: computed(() => []),
    stageObjects: computed(() => []),
    ...extra,
  };
}

describe('lockConfig (pure)', () => {
  it('forces draggable=false and listening=false when obj.locked', () => {
    const cfg = lockConfig({ x: 1, draggable: true }, { locked: true });
    expect(cfg.draggable).toBe(false);
    expect(cfg.listening).toBe(false);
  });

  it('returns the config untouched when not locked (legacy path)', () => {
    const original = { x: 1, draggable: true };
    const cfg = lockConfig(original, {});
    expect(cfg).toBe(original);
    expect(cfg.draggable).toBe(true);
    expect('listening' in cfg).toBe(false);
  });
});

describe('onObjDown lock guard', () => {
  it('selects an unlocked object', () => {
    const obj = store.addObject('circle', 400, 400);
    const { onObjDown } = useStageInteractions(store, makeDeps());
    onObjDown(obj.id, { target: {}, evt: { shiftKey: false, ctrlKey: false, metaKey: false } });
    expect(store.selectedObjectIds).toEqual([obj.id]);
  });

  it('ignores a locked object (no selection, event falls through to the stage)', () => {
    const obj = store.addObject('circle', 400, 400);
    store.toggleLocked(obj.id);
    const { onObjDown } = useStageInteractions(store, makeDeps());
    const evt = { target: {}, evt: { shiftKey: false, ctrlKey: false, metaKey: false } };
    onObjDown(obj.id, evt);
    expect(store.selectedObjectIds).toEqual([]);
    expect(evt.cancelBubble).toBeUndefined();
  });
});

describe('onDragEnd lock guard', () => {
  it('refuses to move a locked object', () => {
    store.project.stage.snapEnabled = false;
    const obj = store.addObject('circle', 400, 400);
    store.toggleLocked(obj.id);
    const { onDragEnd } = useStageInteractions(store, makeDeps());
    onDragEnd(obj.id, { target: { x: () => 700, y: () => 700 } });
    expect(store.project.objects[0].x).toBe(400);
    expect(store.project.objects[0].y).toBe(400);
  });
});

describe('polygonHandles lock guard', () => {
  it('returns null for a locked polygon_free (no draggable vertex handles)', () => {
    const obj = store.addObject('polygon_free', 400, 400);
    store.selectObject(obj.id);
    const deps = makeDeps();
    const { polygonHandles } = useStageInteractions(store, deps);
    expect(polygonHandles.value).not.toBe(null);
    store.toggleLocked(obj.id);
    expect(polygonHandles.value).toBe(null);
  });
});

describe('3D inline text editing', () => {
  it('allows double-click text editing in 3D scenes', () => {
    store.project.sceneType = '3d';
    const obj = store.addObject('text', 400, 400, { text: '3D label' });
    const { startTextEdit, editingTextId } = useStageInteractions(store, makeDeps({ is3D: computed(() => true) }));

    startTextEdit(obj.id);

    expect(editingTextId.value).toBe(obj.id);
  });
});
