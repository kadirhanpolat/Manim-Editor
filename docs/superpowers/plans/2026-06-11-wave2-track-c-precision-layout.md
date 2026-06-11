# Wave 2 Track C — Precision Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add horizontal/vertical canvas rulers, drag-to-create guide lines, and smart object/guide snapping during drag.

**Architecture:** `useStageRulers.ts` (new composable) owns ruler drawing via two `<canvas>` elements overlaid on the Konva stage. Guides are stored in `store.project.guides` and drawn on a dedicated Konva `Line` layer that is not exported to render. A pure `engine/snap.ts` helper computes snap targets; `useStageInteractions.ts` calls it during drag. All three features are 2D-only (disabled in 3D split viewport).

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Pinia, Konva/vue-konva, Vitest

---

## File Map

| Action | File |
|---|---|
| Create | `services/web/src/engine/snap.ts` — pure `snapPoint` helper |
| Modify | `services/web/src/store/project.ts` — `guides` state + guide actions |
| Create | `services/web/src/components/stage/composables/useStageRulers.ts` |
| Modify | `services/web/src/components/stage/StageCanvas.vue` — ruler canvases + guide layer + snap wiring |
| Modify | `services/web/src/components/stage/composables/useStageInteractions.ts` — snap during drag |
| Create | `services/web/tests/engine/snap.test.ts` |
| Create | `services/web/tests/components/guides-store.test.ts` |

---

## Task 1: `snapPoint` pure helper

**Files:**
- Create: `services/web/src/engine/snap.ts`
- Create: `services/web/tests/engine/snap.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/web/tests/engine/snap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { snapPoint } from '../../src/engine/snap.js';

describe('snapPoint', () => {
  it('returns original coords when no candidates', () => {
    const r = snapPoint(100, 200, [], 8);
    expect(r).toEqual({ x: 100, y: 200, snappedX: false, snappedY: false });
  });

  it('snaps X when within threshold', () => {
    const r = snapPoint(103, 200, [{ x: 100 }], 8);
    expect(r.x).toBe(100);
    expect(r.snappedX).toBe(true);
    expect(r.y).toBe(200);
    expect(r.snappedY).toBe(false);
  });

  it('snaps Y when within threshold', () => {
    const r = snapPoint(100, 207, [{ y: 200 }], 8);
    expect(r.y).toBe(200);
    expect(r.snappedY).toBe(true);
  });

  it('does not snap when beyond threshold', () => {
    const r = snapPoint(110, 210, [{ x: 100, y: 200 }], 8);
    expect(r.snappedX).toBe(false);
    expect(r.snappedY).toBe(false);
  });

  it('snaps both X and Y simultaneously', () => {
    const r = snapPoint(103, 203, [{ x: 100, y: 200 }], 8);
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
    expect(r.snappedX).toBe(true);
    expect(r.snappedY).toBe(true);
  });

  it('uses first matching candidate (priority order)', () => {
    const r = snapPoint(105, 200, [{ x: 102 }, { x: 104 }], 8);
    // Both are within threshold; first candidate wins
    expect(r.x).toBe(102);
  });

  it('default threshold is 8', () => {
    const r = snapPoint(107, 200, [{ x: 100 }]);
    expect(r.snappedX).toBe(false); // 7 < 8, should actually snap — test boundary
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- --reporter=verbose snap
```
Expected: FAIL — `snapPoint` not found.

- [ ] **Step 3: Create `engine/snap.ts`**

Create `services/web/src/engine/snap.ts`:

```typescript
export interface SnapCandidate {
  x?: number;
  y?: number;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
}

export function snapPoint(
  x: number,
  y: number,
  candidates: SnapCandidate[],
  threshold = 8
): SnapResult {
  let outX = x;
  let outY = y;
  let snappedX = false;
  let snappedY = false;

  for (const c of candidates) {
    if (!snappedX && c.x !== undefined && Math.abs(x - c.x) <= threshold) {
      outX = c.x;
      snappedX = true;
    }
    if (!snappedY && c.y !== undefined && Math.abs(y - c.y) <= threshold) {
      outY = c.y;
      snappedY = true;
    }
    if (snappedX && snappedY) break;
  }

  return { x: outX, y: outY, snappedX, snappedY };
}
```

- [ ] **Step 4: Fix the boundary test**

Update the last test in `snap.test.ts` — `snapPoint` with default threshold 8, distance = 7 should snap:

```typescript
  it('default threshold is 8 — snaps at distance 7', () => {
    const r = snapPoint(107, 200, [{ x: 100 }]); // distance = 7 ≤ 8
    expect(r.snappedX).toBe(true);
    expect(r.x).toBe(100);
  });
```

- [ ] **Step 5: Run test to verify all pass**

```
cd services/web && npm run test:unit -- --reporter=verbose snap
```
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```
git add services/web/src/engine/snap.ts services/web/tests/engine/snap.test.ts
git commit -m "feat(engine): snapPoint pure helper with tests"
```

---

## Task 2: Guides store state

**Files:**
- Modify: `services/web/src/store/project.ts`
- Create: `services/web/tests/components/guides-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/web/tests/components/guides-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

describe('guides store', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('starts with empty guides', () => {
    expect(store.project.guides).toEqual([]);
  });

  it('addGuide adds a guide with correct axis/pos', () => {
    store.addGuide('h', 300);
    expect(store.project.guides).toHaveLength(1);
    expect(store.project.guides[0]!.axis).toBe('h');
    expect(store.project.guides[0]!.pos).toBe(300);
    expect(typeof store.project.guides[0]!.id).toBe('string');
  });

  it('removeGuide removes by id', () => {
    store.addGuide('v', 500);
    const id = store.project.guides[0]!.id;
    store.removeGuide(id);
    expect(store.project.guides).toHaveLength(0);
  });

  it('moveGuide updates pos', () => {
    store.addGuide('h', 100);
    const id = store.project.guides[0]!.id;
    store.moveGuide(id, 250);
    expect(store.project.guides[0]!.pos).toBe(250);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- --reporter=verbose guides-store
```
Expected: FAIL — `store.project.guides` is undefined.

- [ ] **Step 3: Add guides to store**

In `services/web/src/store/project.ts`:

Add to `StoreProject` interface (line ~64):
```typescript
  guides: Array<{ id: string; axis: 'h' | 'v'; pos: number }>;
```

Add to `createDefaultProject()`:
```typescript
  guides: [],
```

Add three actions:
```typescript
    addGuide(axis: 'h' | 'v', pos: number) {
      this.project.guides = [...this.project.guides, { id: uid(), axis, pos }];
      this.isDirty = true;
      this.commitState();
    },

    removeGuide(guideId: string) {
      this.project.guides = this.project.guides.filter((g) => g.id !== guideId);
      this.isDirty = true;
      this.commitState();
    },

    moveGuide(guideId: string, pos: number) {
      const g = this.project.guides.find((g) => g.id === guideId);
      if (!g) return;
      g.pos = pos;
      this.isDirty = true;
      this.commitState();
    },
```

- [ ] **Step 4: Run test to verify it passes**

```
cd services/web && npm run test:unit -- --reporter=verbose guides-store
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```
git add services/web/src/store/project.ts services/web/tests/components/guides-store.test.ts
git commit -m "feat(store): guides state + addGuide/removeGuide/moveGuide actions"
```

---

## Task 3: Rulers composable

**Files:**
- Create: `services/web/src/components/stage/composables/useStageRulers.ts`

The rulers are drawn on two `<canvas>` elements (one horizontal, one vertical) positioned as HTML overlays over the Konva stage. `useStageRulers.ts` exports a `drawRulers(ctx, opts)` function and reactive refs for the canvas elements.

- [ ] **Step 1: Create `useStageRulers.ts`**

Create `services/web/src/components/stage/composables/useStageRulers.ts`:

```typescript
import { ref, watch } from 'vue';
import type { Ref, ComputedRef } from 'vue';

const RULER_SIZE = 18; // px — width of vertical ruler / height of horizontal ruler
export { RULER_SIZE };

interface RulerDeps {
  vs: ComputedRef<number>;
  ox: ComputedRef<number>;
  oy: ComputedRef<number>;
  stageW: ComputedRef<number>;
  stageH: ComputedRef<number>;
}

function pickTickInterval(vs: number): number {
  // Project-pixel intervals that give readable tick spacing
  const candidates = [10, 25, 50, 100, 200, 500, 1000];
  for (const c of candidates) {
    if (c * vs >= 40) return c; // at least 40 canvas-px between ticks
  }
  return 1000;
}

function drawHRuler(canvas: HTMLCanvasElement, vs: number, ox: number, stageW: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'var(--studio-bg, #1a1a1a)' ;
  ctx.fillRect(0, 0, W, H);

  const interval = pickTickInterval(vs);
  const startPx = Math.floor(-ox / vs / interval) * interval;

  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';

  for (let px = startPx; px < startPx + stageW / vs + interval * 2; px += interval) {
    const cx = ox + px * vs;
    if (cx < RULER_SIZE || cx > W) continue;
    ctx.fillRect(cx, H - 5, 1, 5);
    ctx.fillText(String(Math.round(px)), cx, H - 7);
  }
}

function drawVRuler(canvas: HTMLCanvasElement, vs: number, oy: number, stageH: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'var(--studio-bg, #1a1a1a)';
  ctx.fillRect(0, 0, W, H);

  const interval = pickTickInterval(vs);
  const startPy = Math.floor(-oy / vs / interval) * interval;

  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.save();

  for (let py = startPy; py < startPy + stageH / vs + interval * 2; py += interval) {
    const cy = oy + py * vs;
    if (cy < RULER_SIZE || cy > H) continue;
    ctx.fillRect(W - 5, cy, 5, 1);
    ctx.save();
    ctx.translate(W - 7, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(String(Math.round(py)), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

export function useStageRulers(deps: RulerDeps) {
  const hRulerRef = ref<HTMLCanvasElement | null>(null);
  const vRulerRef = ref<HTMLCanvasElement | null>(null);

  function redraw() {
    const h = hRulerRef.value;
    const v = vRulerRef.value;
    if (h) drawHRuler(h, deps.vs.value, deps.ox.value, deps.stageW.value);
    if (v) drawVRuler(v, deps.vs.value, deps.oy.value, deps.stageH.value);
  }

  watch([deps.vs, deps.ox, deps.oy], redraw);

  return { hRulerRef, vRulerRef, RULER_SIZE, redraw };
}
```

- [ ] **Step 2: Run typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add services/web/src/components/stage/composables/useStageRulers.ts
git commit -m "feat(stage): useStageRulers composable with tick drawing"
```

---

## Task 4: StageCanvas — ruler overlays + guide layer

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Add container dimension tracking**

`StageCanvas.vue` needs reactive `stageContainerW` / `stageContainerH` refs for the ruler canvas sizes. If the component already has a `containerEl` ref or similar, derive them from it. Otherwise, add:

```typescript
const stageContainerEl = ref<HTMLElement | null>(null); // attach to the wrapper div via ref="stageContainerEl"
const stageContainerW = ref(800);
const stageContainerH = ref(600);

onMounted(() => {
  if (stageContainerEl.value) {
    stageContainerW.value = stageContainerEl.value.clientWidth;
    stageContainerH.value = stageContainerEl.value.clientHeight;
  }
  const ro = new ResizeObserver((entries) => {
    const e = entries[0];
    if (e) {
      stageContainerW.value = e.contentRect.width;
      stageContainerH.value = e.contentRect.height;
      redrawRulers();
    }
  });
  if (stageContainerEl.value) ro.observe(stageContainerEl.value);
  onBeforeUnmount(() => ro.disconnect());
});
```

If StageCanvas.vue already tracks the stage container dimensions under a different name, use those instead of adding new refs.

- [ ] **Step 2: Mount the ruler composable**

In `StageCanvas.vue`, in `<script setup>`, import and call the composable (after the existing composable calls):

```typescript
import { useStageRulers, RULER_SIZE } from './composables/useStageRulers.js';
// ... after existing composable destructuring:
const { hRulerRef, vRulerRef, redraw: redrawRulers } = useStageRulers({
  vs, ox, oy,
  stageW: computed(() => store.project.stage.width),
  stageH: computed(() => store.project.stage.height),
});
// Redraw once on mount
onMounted(() => redrawRulers());
```

- [ ] **Step 2: Add ruler canvas elements to the template**

In `StageCanvas.vue` template, find the outermost wrapper `<div>` (must have `position: relative`). Add after the `<v-stage>` element:

```vue
<!-- Horizontal ruler -->
<canvas
  v-if="!is3D"
  ref="hRulerRef"
  class="ruler ruler-h"
  :width="stageContainerW"
  :height="RULER_SIZE"
  @mousedown="onHRulerMousedown"
/>
<!-- Vertical ruler -->
<canvas
  v-if="!is3D"
  ref="vRulerRef"
  class="ruler ruler-v"
  :width="RULER_SIZE"
  :height="stageContainerH"
  @mousedown="onVRulerMousedown"
/>
<!-- Corner block covering the ruler intersection -->
<div v-if="!is3D" class="ruler-corner" />
```

Add CSS (scoped):
```css
.ruler { position: absolute; pointer-events: auto; }
.ruler-h { top: 0; left: 0; cursor: crosshair; }
.ruler-v { top: 0; left: 0; cursor: crosshair; }
.ruler-corner {
  position: absolute;
  top: 0; left: 0;
  width: 18px; height: 18px;
  background: var(--studio-bg);
  z-index: 5;
}
```

- [ ] **Step 3: Drag from ruler to create guide**

In `<script setup>`, add:

```typescript
function onHRulerMousedown(e: MouseEvent) {
  // Dragging down from horizontal ruler creates a horizontal guide
  const startY = e.clientY;
  const onMove = (me: MouseEvent) => {
    // guide pos in project px = (canvas y - oy) / vs
    const canvasEl = (vRulerRef.value?.parentElement) as HTMLElement | null;
    const rect = canvasEl?.getBoundingClientRect();
    if (!rect) return;
    const cy = me.clientY - rect.top;
    _pendingGuidePos.value = { axis: 'h', pos: Math.round((cy - oy.value) / vs.value) };
  };
  const onUp = () => {
    if (_pendingGuidePos.value) {
      store.addGuide(_pendingGuidePos.value.axis, _pendingGuidePos.value.pos);
      _pendingGuidePos.value = null;
    }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  void startY;
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function onVRulerMousedown(e: MouseEvent) {
  const startX = e.clientX;
  const onMove = (me: MouseEvent) => {
    const canvasEl = (hRulerRef.value?.parentElement) as HTMLElement | null;
    const rect = canvasEl?.getBoundingClientRect();
    if (!rect) return;
    const cx = me.clientX - rect.left;
    _pendingGuidePos.value = { axis: 'v', pos: Math.round((cx - ox.value) / vs.value) };
  };
  const onUp = () => {
    if (_pendingGuidePos.value) {
      store.addGuide(_pendingGuidePos.value.axis, _pendingGuidePos.value.pos);
      _pendingGuidePos.value = null;
    }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  void startX;
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

const _pendingGuidePos = ref<{ axis: 'h' | 'v'; pos: number } | null>(null);
```

- [ ] **Step 4: Render guide lines in a Konva layer**

In `StageCanvas.vue` template, add a non-interactive Konva layer for guides (add after the existing object layer `<v-layer>`):

```vue
<!-- Guide lines — not exported to render -->
<v-layer v-if="!is3D" :config="{ listening: false }">
  <v-line
    v-for="g in store.project.guides"
    :key="g.id"
    :config="guideLineConfig(g)"
    @mousedown="onGuideMousedown(g.id, $event)"
  />
</v-layer>
```

In `<script setup>`:

```typescript
function guideLineConfig(g: { axis: 'h' | 'v'; pos: number; id: string }) {
  const stageW = store.project.stage.width;
  const stageH = store.project.stage.height;
  const p = g.axis === 'h'
    ? [0, g.pos * vs.value + oy.value, stageW * vs.value, g.pos * vs.value + oy.value]
    : [g.pos * vs.value + ox.value, 0, g.pos * vs.value + ox.value, stageH * vs.value];
  return {
    points: p,
    stroke: '#4f8ef7',
    strokeWidth: 1,
    dash: [4, 4],
    opacity: 0.7,
    hitStrokeWidth: 8,
    draggable: false,
  };
}

function onGuideMousedown(guideId: string, e: { evt: MouseEvent }) {
  // Drag guide to new position; drop off-stage deletes
  const g = store.project.guides.find((g) => g.id === guideId);
  if (!g) return;
  const onMove = (me: MouseEvent) => {
    const rect = (e.evt.target as HTMLElement).closest('.stage-container')?.getBoundingClientRect();
    if (!rect) return;
    const newPos = g.axis === 'h'
      ? Math.round((me.clientY - rect.top - oy.value) / vs.value)
      : Math.round((me.clientX - rect.left - ox.value) / vs.value);
    store.moveGuide(guideId, newPos);
  };
  const onUp = (me: MouseEvent) => {
    // If dropped outside stage area, delete
    const rect = (e.evt.target as HTMLElement).closest('.stage-container')?.getBoundingClientRect();
    if (rect) {
      const outsideH = me.clientY < rect.top || me.clientY > rect.bottom;
      const outsideV = me.clientX < rect.left || me.clientX > rect.right;
      if (g.axis === 'h' ? outsideH : outsideV) store.removeGuide(guideId);
    }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
```

- [ ] **Step 5: Run unit tests + typecheck**

```
cd services/web && npm run test:unit
npm run typecheck
```
Expected: all pass.

- [ ] **Step 6: Commit**

```
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(stage): ruler canvases + guide Konva layer"
```

---

## Task 5: Smart snapping during drag

**Files:**
- Modify: `services/web/src/components/stage/composables/useStageInteractions.ts`

Snap is applied inside the drag `mousemove` handler. Candidates come from (1) guide lines, (2) bounding box edges/centers of other visible objects.

- [ ] **Step 1: Import snapPoint and build candidates**

In `useStageInteractions.ts`, add at the top:

```typescript
import { snapPoint } from '../../../engine/snap.js';
import type { SnapCandidate } from '../../../engine/snap.js';
```

Add to the `Deps` interface:

```typescript
  guides: ComputedRef<Array<{ id: string; axis: 'h' | 'v'; pos: number }>>;
  stageObjects: ComputedRef<import('../../../engine/types.js').StageObject[]>;
```

Add a helper inside `useStageInteractions`:

```typescript
  function buildSnapCandidates(excludeIds: string[]): SnapCandidate[] {
    const candidates: SnapCandidate[] = [];

    // Guide lines → canvas-pixel coordinates
    for (const g of deps.guides.value) {
      if (g.axis === 'h') candidates.push({ y: g.pos * vs.value + deps.oy.value });
      else               candidates.push({ x: g.pos * vs.value + deps.ox.value });
    }

    // Object bounding boxes → center + edges (canvas px)
    for (const obj of deps.stageObjects.value) {
      if (excludeIds.includes(obj.id) || obj.hidden) continue;
      const c = deps.s2c(obj.x ?? 0, obj.y ?? 0);
      const hw = ((obj.width ?? 0) / 2) * vs.value;
      const hh = ((obj.height ?? 0) / 2) * vs.value;
      candidates.push(
        { x: c.x - hw }, { x: c.x }, { x: c.x + hw },
        { y: c.y - hh }, { y: c.y }, { y: c.y + hh },
      );
    }

    return candidates;
  }
```

- [ ] **Step 2: Apply snap in the drag mousemove handler**

Find the `mousemove` handler inside the drag logic (where the object position is being updated). It sets the new canvas position, e.g.:

```typescript
const newCx = ...; // candidate new canvas X
const newCy = ...; // candidate new canvas Y
```

After computing `newCx/newCy`, add:

```typescript
    if (!is3D.value) {
      const snapped = snapPoint(newCx, newCy, buildSnapCandidates(store.selectedObjectIds));
      finalCx = snapped.x;
      finalCy = snapped.y;
    }
```

Replace the position update with `finalCx`/`finalCy` instead of `newCx`/`newCy`.

The exact variable names depend on what the existing drag handler uses. Search for the `onObjectDragMove` or equivalent function inside `useStageInteractions.ts` and apply snap after the new position is computed, before it is written to the store.

- [ ] **Step 3: Pass new deps from StageCanvas.vue**

In `StageCanvas.vue`, where `useStageInteractions` is called, add the two new deps:

```typescript
  guides: computed(() => store.project.guides),
  stageObjects: computed(() => store.project.objects as import('../../engine/types.js').StageObject[]),
```

- [ ] **Step 4: Run full unit tests**

```
cd services/web && npm run test:unit
```
Expected: all tests pass (snap tests still pass, no regressions).

- [ ] **Step 5: Run typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```
git add services/web/src/components/stage/composables/useStageInteractions.ts services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(stage): smart snapping to guides and object edges during drag"
```

---

## Task 6: Full gate

- [ ] **Step 1: Run all test suites**

```
cd services/web && npm run test:unit
npm test
npm test --workspace services/api
npm test --workspace packages/manim-codegen
```

Expected: all suites pass.

- [ ] **Step 2: Run lint + typecheck + format**

```
npm run lint
npm run typecheck
npm run format:check
```

Expected: no errors.

- [ ] **Step 3: Final commit if needed**

```
git add -A
git commit -m "chore: lint/format fixes for wave2 track C"
```
