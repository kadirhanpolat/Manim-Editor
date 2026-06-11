import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';
import {
  normalizeRect,
  objectStageBounds,
  marqueeHit,
  marqueeSelectIds,
} from '../../src/engine/marquee.js';
import { useProjectStore } from '../../src/store/project.js';
import { useStageInteractions } from '../../src/components/stage/composables/useStageInteractions.js';

describe('marquee geometry (pure)', () => {
  it('normalizeRect handles any drag direction', () => {
    expect(normalizeRect(10, 10, 30, 40)).toEqual({ x: 10, y: 10, width: 20, height: 30 });
    expect(normalizeRect(30, 40, 10, 10)).toEqual({ x: 10, y: 10, width: 20, height: 30 });
  });

  it('objectStageBounds is center-based (matches ctx.objectBounds semantics)', () => {
    expect(
      objectStageBounds({ id: 'a', type: 'circle', x: 100, y: 100, width: 40, height: 40 })
    ).toEqual({ x: 80, y: 80, width: 40, height: 40 });
  });

  it('marqueeHit: intersection counts, containment not required', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(marqueeHit(rect, { x: 90, y: 90, width: 50, height: 50 })).toBe(true); // overlap
    expect(marqueeHit(rect, { x: 200, y: 0, width: 10, height: 10 })).toBe(false); // outside
    expect(marqueeHit(rect, null)).toBe(false);
  });

  it('marqueeSelectIds skips locked and hidden objects', () => {
    const objs = [
      { id: 'a', type: 'circle', x: 50, y: 50, width: 20, height: 20 },
      { id: 'b', type: 'circle', x: 50, y: 50, width: 20, height: 20, locked: true },
      { id: 'c', type: 'circle', x: 50, y: 50, width: 20, height: 20, hidden: true },
      { id: 'd', type: 'circle', x: 500, y: 500, width: 20, height: 20 },
    ];
    expect(marqueeSelectIds({ x: 0, y: 0, width: 100, height: 100 }, objs)).toEqual(['a']);
  });
});

describe('marquee interaction flow (composable with fake stage)', () => {
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  function makeFakeStage(pointer) {
    return {
      getPointerPosition: () => pointer.value,
      name: () => '',
      getParent: () => null,
    };
  }

  function makeDeps(fakeStage, { is3D = false } = {}) {
    return {
      konvaStage: ref({ getNode: () => fakeStage }),
      objectsLayer: ref(null),
      transformer: ref(null),
      vs: computed(() => 1),
      ox: computed(() => 0),
      oy: computed(() => 0),
      s2c: (x, y) => ({ x, y }),
      c2s: (x, y) => ({ x, y }), // identity: canvas coords == project coords in tests
      unprojectView: () => ({}),
      themeAccent: computed(() => '#7c5cff'),
      startPan: () => {},
      is3D: computed(() => is3D),
      pathDrawing: ref(false),
      pathPoints: ref([]),
      pathSourceId: ref(null),
      guides: computed(() => []),
      stageObjects: computed(() => []),
    };
  }

  it('drag on empty canvas selects intersecting objects, skipping locked ones', () => {
    const a = store.addObject('circle', 100, 100); // bbox approx 50..150 (default size)
    const b = store.addObject('circle', 120, 120);
    const c = store.addObject('circle', 1500, 900); // far away
    store.toggleLocked(b.id);

    const pointer = { value: { x: 10, y: 10 } };
    const fakeStage = makeFakeStage(pointer);
    const itx = useStageInteractions(store, makeDeps(fakeStage));

    itx.handleStageMouseDown({ target: fakeStage, evt: { shiftKey: false } });
    expect(itx.marquee.value).toEqual({ x1: 10, y1: 10, x2: 10, y2: 10 });

    pointer.value = { x: 300, y: 300 };
    itx.handleStageMouseMove();
    expect(itx.marquee.value.x2).toBe(300);

    itx.handleStageMouseUp();
    expect(itx.marquee.value).toBe(null);
    expect(store.selectedObjectIds).toContain(a.id);
    expect(store.selectedObjectIds).not.toContain(b.id); // locked
    expect(store.selectedObjectIds).not.toContain(c.id); // outside
  });

  it('a tiny drag (<3px) is a plain click: selection just cleared, none selected', () => {
    store.addObject('circle', 100, 100);
    store.selectAllObjects();
    const pointer = { value: { x: 10, y: 10 } };
    const fakeStage = makeFakeStage(pointer);
    const itx = useStageInteractions(store, makeDeps(fakeStage));
    itx.handleStageMouseDown({ target: fakeStage, evt: { shiftKey: false } });
    pointer.value = { x: 11, y: 11 };
    itx.handleStageMouseMove();
    itx.handleStageMouseUp();
    expect(store.selectedObjectIds).toEqual([]);
  });

  it('marquee is disabled in 3D mode', () => {
    const pointer = { value: { x: 10, y: 10 } };
    const fakeStage = makeFakeStage(pointer);
    const itx = useStageInteractions(store, makeDeps(fakeStage, { is3D: true }));
    itx.handleStageMouseDown({ target: fakeStage, evt: { shiftKey: false } });
    expect(itx.marquee.value).toBe(null);
  });
});

describe('multi-selection group drag (onDragEnd delta fan-out)', () => {
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.project.stage.snapEnabled = false;
    store.commitState();
  });

  it('dragging one selected object moves the whole multi-selection by the same delta', () => {
    const a = store.addObject('circle', 400, 400);
    const b = store.addObject('circle', 600, 500);
    store.selectObject(a.id);
    store.selectObject(b.id, true);

    const deps = {
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
    };
    const { onDragEnd } = useStageInteractions(store, deps);
    // circle uses center positioning: node x/y == new project x/y (identity c2s)
    onDragEnd(a.id, { target: { x: () => 500, y: () => 450 } });
    expect([store.project.objects[0].x, store.project.objects[0].y]).toEqual([500, 450]);
    expect([store.project.objects[1].x, store.project.objects[1].y]).toEqual([700, 550]);
  });

  it('single selection keeps the existing behavior (only the dragged object moves)', () => {
    const a = store.addObject('circle', 400, 400);
    store.addObject('circle', 600, 500);
    store.selectObject(a.id);
    const deps = {
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
    };
    const { onDragEnd } = useStageInteractions(store, deps);
    onDragEnd(a.id, { target: { x: () => 500, y: () => 450 } });
    expect([store.project.objects[0].x, store.project.objects[0].y]).toEqual([500, 450]);
    expect([store.project.objects[1].x, store.project.objects[1].y]).toEqual([600, 500]);
  });
});
