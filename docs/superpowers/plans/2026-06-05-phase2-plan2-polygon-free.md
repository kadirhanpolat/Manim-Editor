# Phase 2 — Plan 2: Free-Vertex Polygon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `polygon_free` object — an arbitrary-vertex polygon with Trapezoid/Parallelogram/Free presets and draggable on-canvas vertex handles — editable, previewed on Konva, and round-tripped through Manim `Polygon(...)`.

**Architecture:** Vertex math (presets, bbox, canvas↔vertex conversion) lives in a new pure, unit-tested module `engine/polygonVertices.js`, imported by the store (seed), StageCanvas (preview + handles), and the inspector (presets). The shape is a `case` arm in both generators emitting a single-line `Polygon([x,y,0], ...)` (vertices relative to center) positioned by the existing generic `move_to`. The Konva body is a closed `v-line` (like `triangleCfg`); when selected, draggable `v-circle` handles edit `obj.vertices`.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Konva.js (`v-line`/`v-circle`), Vitest, Node.js codegen, Manim CE.

**Spec:** `docs/superpowers/specs/2026-06-05-phase2-geometry-calculus-objects-design.md` (Plan 2 of 4 — `polygon_free`).
**Branch:** `feat/phase2-polygon-free`.

**Run tests with:**
```bash
cd services/web && npx vitest run tests/components/   # Vitest — this plan's tests
cd services/web && npm test                           # Node engine tests — must stay green
```

## Conventions

- `obj.vertices = [[vx, vy], ...]` — integer px **relative to the object center** (`obj.x`, `obj.y`). Min 3 vertices. Default = trapezoid.
- Codegen: each vertex → Manim units `mx = vx/sw*FRAME_WIDTH`, `my = -vy/sh*FRAME_HEIGHT` (y-flip, matching `stageToManim`). Emit `Polygon([mx,my,0], ...)` single-line at origin; the generic post-switch `move_to([mp.x, mp.y, 0])` (manim.js:409 / codegen.js equivalent) positions it.
- codegen.js and manim.js emit **byte-identical** strings.
- `polygon_free` joins `GRADIENT_TYPES` + `DASH_TYPES` (closed fillable shape).

---

## Task 1: Pure vertex math module

**Files:**
- Create: `services/web/src/engine/polygonVertices.js`
- Test: `services/web/tests/components/polygon-vertices.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/polygon-vertices.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { presetVertices, verticesBBox, vertexToCanvas, canvasToVertex } from '../../src/engine/polygonVertices.js';

describe('polygonVertices', () => {
  it('trapezoid preset is 4 vertices centered, top narrower than bottom', () => {
    const v = presetVertices('trapezoid', 160, 120);
    expect(v.length).toBe(4);
    const topW = v[1][0] - v[0][0];      // top edge width
    const botW = v[2][0] - v[3][0];      // bottom edge width
    expect(botW).toBeGreaterThan(topW);
    expect(v.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))).toBe(true);
  });

  it('parallelogram preset is 4 vertices with equal-length skewed sides', () => {
    const v = presetVertices('parallelogram', 160, 120);
    expect(v.length).toBe(4);
  });

  it('free preset returns >= 3 vertices', () => {
    expect(presetVertices('free', 120, 120).length).toBeGreaterThanOrEqual(3);
  });

  it('verticesBBox returns width/height spanning the extremes', () => {
    const bb = verticesBBox([[-40, -60], [40, -60], [80, 60], [-80, 60]]);
    expect(bb.width).toBe(160);
    expect(bb.height).toBe(120);
  });

  it('vertexToCanvas / canvasToVertex round-trip', () => {
    const center = { x: 500, y: 300 };
    const c = vertexToCanvas([40, -60], center.x, center.y, 2);   // zoom 2
    expect(c).toEqual({ x: 580, y: 180 });
    const back = canvasToVertex(c.x, c.y, center.x, center.y, 2);
    expect(back).toEqual([40, -60]);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/polygon-vertices.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `services/web/src/engine/polygonVertices.js`:
```js
/**
 * Pure vertex math for the polygon_free object.
 * Vertices are integer px relative to the object center: [[vx, vy], ...].
 */

/** Preset vertex arrays scaled to a w×h bounding box, centered at (0,0). */
export function presetVertices(type, w, h) {
  const hw = Math.round(w / 2), hh = Math.round(h / 2);
  if (type === 'parallelogram') {
    const s = Math.round(hw * 0.4);
    return [[-hw + s, -hh], [hw + s, -hh], [hw - s, hh], [-hw - s, hh]];
  }
  if (type === 'free') {
    return [[0, -hh], [hw, 0], [0, hh], [-hw, 0]];   // diamond starting shape
  }
  // trapezoid (default): narrower top
  const tw = Math.round(hw * 0.5);
  return [[-tw, -hh], [tw, -hh], [hw, hh], [-hw, hh]];
}

/** Bounding-box {width, height} of a vertex list. */
export function verticesBBox(vertices) {
  const xs = vertices.map(v => v[0]), ys = vertices.map(v => v[1]);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** Vertex (center-relative px) → canvas point, given center canvas coords and zoom. */
export function vertexToCanvas([vx, vy], centerX, centerY, zoom) {
  return { x: centerX + vx * zoom, y: centerY + vy * zoom };
}

/** Canvas point → vertex (center-relative px), rounded to integers. */
export function canvasToVertex(cx, cy, centerX, centerY, zoom) {
  return [Math.round((cx - centerX) / zoom), Math.round((cy - centerY) / zoom)];
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/polygon-vertices.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/engine/polygonVertices.js services/web/tests/components/polygon-vertices.test.js
git commit -m "feat(engine): pure polygon vertex math (presets, bbox, coord conversion)"
```

---

## Task 2: Store defaults, seed, sidebar, action

**Files:**
- Modify: `services/web/src/store/project.js` (`SHAPE_DEFAULTS` ~129, `SHAPE_COLORS` ~156, `nameMap` ~272, `addObject` seed ~302, import + a `setPolygonVertices` action after `updateObject` ~367)
- Modify: `services/web/src/components/sidebar/AssetSidebar.vue` (`shapes` array ~178)
- Test: `services/web/tests/components/phase2-polygon-store.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-polygon-store.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('polygon_free store', () => {
  it('seeds a default trapezoid (4 vertices)', () => {
    store.addObject('polygon_free', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('polygon_free');
    expect(Array.isArray(o.vertices)).toBe(true);
    expect(o.vertices.length).toBe(4);
  });

  it('setPolygonVertices replaces vertices and ignores < 3', () => {
    store.addObject('polygon_free', 960, 540);
    id = store.project.objects[0].id;
    store.setPolygonVertices(id, [[-50, -50], [50, -50], [50, 50], [-50, 50]]);
    expect(store.objectById(id).vertices.length).toBe(4);
    store.setPolygonVertices(id, [[0, 0], [10, 10]]); // too few — ignored
    expect(store.objectById(id).vertices.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-polygon-store.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement store changes**

In `services/web/src/store/project.js`, add the import near the top (with other imports):
```js
import { presetVertices } from '../engine/polygonVertices.js';
```

In `SHAPE_DEFAULTS` (after the `polygon:` line), add:
```js
  polygon_free: { width: 160, height: 120, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 },
```
In `SHAPE_COLORS`, add:
```js
  polygon_free: '#8b5cf6',
```
In the `nameMap` inside `addObject`, add:
```js
        polygon_free: 'Polygon',
```
In the `addObject` seed block (after the `star` seed), add:
```js
        ...(type === 'polygon_free' ? { vertices: presetVertices('trapezoid', SHAPE_DEFAULTS.polygon_free.width, SHAPE_DEFAULTS.polygon_free.height) } : {}),
```

Add the `setPolygonVertices` action immediately after the `updateObject` action (~line 367):
```js
    setPolygonVertices(id, vertices) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(vertices) || vertices.length < 3) return;
      obj.vertices = vertices.map(([x, y]) => [Math.round(x), Math.round(y)]);
      this.isDirty = true;
      this._debouncedCommit();
    },
```

- [ ] **Step 4: Add sidebar button**

In `services/web/src/components/sidebar/AssetSidebar.vue`, in the `shapes` array, add:
```js
  { type: 'polygon_free', label: 'Polygon', color: '#8b5cf6', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4h10l3 8-8 8-8-8z"/></svg>' },
```

- [ ] **Step 5: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-polygon-store.test.js`
Expected: PASS (2 tests). Then `cd services/web && npx vitest run tests/components/` → all pass.

- [ ] **Step 6: Commit**

```bash
git add services/web/src/store/project.js services/web/src/components/sidebar/AssetSidebar.vue services/web/tests/components/phase2-polygon-store.test.js
git commit -m "feat(store): polygon_free defaults + seed + setPolygonVertices"
```

---

## Task 3: Codegen + round-trip

**Files:**
- Modify: `services/web/src/export/manim.js` (generator switch; parser; `GRADIENT_TYPES`/`DASH_TYPES`)
- Modify: `services/api/src/compiler/codegen.js` (generator switch; sets)
- Test: `services/web/tests/components/phase2-polygon-codegen.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-polygon-codegen.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1', type: 'polygon_free', x: SW / 2, y: SH / 2, width: 160, height: 120,
    vertices: [[-40, -60], [40, -60], [80, 60], [-80, 60]],
    fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}

describe('polygon_free codegen', () => {
  it('emits a single-line Polygon with vertex arrays', () => {
    const s = generateManimScript(makeProject([makeObj()]));
    expect(s).toMatch(/= Polygon\(\[[-\d.]+, [-\d.]+, 0\](, \[[-\d.]+, [-\d.]+, 0\])+\)/);
  });
  it('round-trips type + vertex count + approximate first vertex', () => {
    const code = generateManimScript(makeProject([makeObj()]));
    const o = parseManimScript(code, SW, SH).objects[0];
    expect(o.type).toBe('polygon_free');
    expect(o.vertices.length).toBe(4);
    expect(o.vertices[0][0]).toBeCloseTo(-40, -1); // within ~10px after round-trip
    expect(o.vertices[0][1]).toBeCloseTo(-60, -1);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-polygon-codegen.test.js`
Expected: FAIL.

- [ ] **Step 3: Add the manim.js generator case**

In `services/web/src/export/manim.js` `objCode` switch, after `case 'polygon':`, add:
```js
    case 'polygon_free': {
      const verts = (Array.isArray(obj.vertices) && obj.vertices.length >= 3)
        ? obj.vertices : [[-80, -60], [80, -60], [80, 60], [-80, 60]];
      const pts = verts.map(([vx, vy]) =>
        `[${(vx / sw * FRAME_WIDTH).toFixed(3)}, ${(-vy / sh * FRAME_HEIGHT).toFixed(3)}, 0]`).join(', ');
      lines.push(`${n} = Polygon(${pts})`);
      if (hasFill) lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke) lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
```

- [ ] **Step 4: Add the manim.js parser branch**

In `parseManimScript`, after the `RegularPolygon` matcher, add:
```js
    // Polygon (free-vertex)
    m = line.match(/^(\w+)\s*=\s*Polygon\((\[[-\d.]+,\s*[-\d.]+,\s*0\](?:,\s*\[[-\d.]+,\s*[-\d.]+,\s*0\])+)\)/);
    if (m) {
      const [, name, body] = m;
      const verts = [];
      const re = /\[([-\d.]+),\s*([-\d.]+),\s*0\]/g;
      let v;
      while ((v = re.exec(body)) !== null) {
        verts.push([
          Math.round(parseFloat(v[1]) / FRAME_WIDTH * sw),
          Math.round(-parseFloat(v[2]) / FRAME_HEIGHT * sh),
        ]);
      }
      const xs = verts.map(p => p[0]), ys = verts.map(p => p[1]);
      const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
      const id = uid('obj');
      const obj = { id, type: 'polygon_free', name, x: sw / 2, y: sh / 2, width, height, vertices: verts,
        fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }
```
(The existing `move_to([cx, cy, 0])` parser then sets `obj.x`/`obj.y` from the position line.)

- [ ] **Step 5: Add `polygon_free` to BOTH effect sets**

In `manim.js`, append `'polygon_free'` to both `GRADIENT_TYPES` and `DASH_TYPES`.

- [ ] **Step 6: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-polygon-codegen.test.js` → 2 pass. Then `cd services/web && npx vitest run tests/components/manim-export.test.js` → green.

- [ ] **Step 7: Mirror into codegen.js**

Paste the IDENTICAL `case 'polygon_free':` block into `services/api/src/compiler/codegen.js` `objectCode` switch (after its `case 'polygon':`), and append `'polygon_free'` to both its sets. Verify:
```bash
cd "D:/PYTHON/Manim-Editor" && node --check services/api/src/compiler/codegen.js && echo OK
```

- [ ] **Step 8: Commit**

```bash
git add services/web/src/export/manim.js services/api/src/compiler/codegen.js services/web/tests/components/phase2-polygon-codegen.test.js
git commit -m "feat(codegen): polygon_free Polygon + round-trip + effect sets"
```

---

## Task 4: Konva preview body

No unit test for cfg; verify via build.

**Files:** Modify `services/web/src/components/stage/StageCanvas.vue` (cfg functions near `triangleCfg` ~759; template ~49).

- [ ] **Step 1: Add the cfg function**

In `<script setup>`, after `triangleCfg`, add (mirrors triangleCfg: `v-line` closed, relative points, applyEffects centered):
```js
function polygonFreeCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y);
  const verts = (Array.isArray(obj.vertices) && obj.vertices.length >= 3) ? obj.vertices : [[-80, -60], [80, -60], [80, 60], [-80, 60]];
  const pts = verts.flatMap(([vx, vy]) => [vx * vs.value, vy * vs.value]);
  const xs = verts.map(v => v[0]), ys = verts.map(v => v[1]);
  const w = (Math.max(...xs) - Math.min(...xs)) * vs.value, h = (Math.max(...ys) - Math.min(...ys)) * vs.value;
  const cfg = { x: p.x, y: p.y, points: pts, closed: true, fill: e.fill, stroke: e.stroke,
    strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1, rotation: e.rotation || 0,
    scaleX: 1, scaleY: 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return applyEffects(cfg, obj, w, h, true);
}
```

- [ ] **Step 2: Add the template element**

In the object loop, after the triangle `v-line` line (~49), add (drag-only — vertices are edited via handles in Task 5, not the transformer):
```html
            <v-line v-if="obj.type === 'polygon_free' && isVis(obj.id)" :config="polygonFreeCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />
```

- [ ] **Step 3: Verify build + tests**

```bash
cd services/web && npm run build
cd services/web && npx vitest run tests/components/
```
Expected: build succeeds; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): polygon_free body preview"
```

---

## Task 5: Draggable vertex handles

When a `polygon_free` is the sole selection and the select tool is active, draw a small draggable `v-circle` per vertex; dragging a handle updates `obj.vertices[i]` live and commits on release. Uses the tested `canvasToVertex` from Task 1.

**Files:** Modify `services/web/src/components/stage/StageCanvas.vue` (import; a computed; template handle layer; two handlers).

- [ ] **Step 1: Add import + computed + handlers**

In `<script setup>`, add the import (with other imports):
```js
import { canvasToVertex } from '../../engine/polygonVertices.js';
```

Add a computed that yields the selected polygon's vertex handles in canvas coords (place near the other computeds; `store.selectedObjectIds`, `store.objectById`, `s2c`, `vs` are in scope):
```js
const polygonHandles = computed(() => {
  if (store.activeTool !== 'select' || store.selectedObjectIds.length !== 1) return null;
  const obj = store.objectById(store.selectedObjectIds[0]);
  if (!obj || obj.type !== 'polygon_free' || !Array.isArray(obj.vertices)) return null;
  const c = s2c(obj.x, obj.y);
  return { id: obj.id,
    points: obj.vertices.map(([vx, vy], i) => ({ i, cx: c.x + vx * vs.value, cy: c.y + vy * vs.value })) };
});

function onVertexDrag(i, evt) {
  const h = polygonHandles.value; if (!h) return;
  const obj = store.objectById(h.id); if (!obj) return;
  const c = s2c(obj.x, obj.y);
  const node = evt.target;
  const nv = obj.vertices.slice();
  nv[i] = canvasToVertex(node.x(), node.y(), c.x, c.y, vs.value);
  obj.vertices = nv;             // live update (no commit per pixel)
}
function onVertexDragEnd() {
  store.commitState();
}
```

- [ ] **Step 2: Add the handle layer to the template**

After the object-loop `</template>` / layer that renders shapes (place it in the same overlay area as the path-drawing handles, e.g. near the `v-layer` at ~166), add:
```html
        <v-layer v-if="polygonHandles">
          <v-circle v-for="pt in polygonHandles.points" :key="'pv' + pt.i"
            :config="{ x: pt.cx, y: pt.cy, radius: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 1.5, draggable: true, name: 'vertexHandle' }"
            @dragmove="onVertexDrag(pt.i, $event)" @dragend="onVertexDragEnd" />
        </v-layer>
```
READ the existing path-handle `v-layer` (~166) first and match the structure/placement (a sibling `v-layer` inside the `v-stage`).

- [ ] **Step 3: Verify build + tests**

```bash
cd services/web && npm run build
cd services/web && npx vitest run tests/components/
```
Expected: build succeeds; all tests pass.

- [ ] **Step 4: Manual smoke (recommended)**

`cd services/web && npm run dev`; add a Polygon, select it, drag a corner handle — the polygon edge follows; deselect to hide handles; re-render in codegen reflects the new shape.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): draggable vertex handles for polygon_free"
```

---

## Task 6: Inspector presets + effect gating + verification

**Files:**
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (import; preset handlers; a `<Section>`; effect-gating sets ~696)
- Test: `services/web/tests/components/phase2-polygon-inspector.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-polygon-inspector.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
  store.addObject('polygon_free', 960, 540);
  id = store.project.objects[0].id;
  store.selectObject(id);
});

describe('polygon_free inspector', () => {
  it('shows a Polygon section with a Parallelogram preset button', () => {
    expect(mount(PropertiesPanel).html()).toContain('Parallelogram');
  });
  it('clicking the Parallelogram preset calls setPolygonVertices', async () => {
    const spy = vi.spyOn(store, 'setPolygonVertices');
    const w = mount(PropertiesPanel);
    await w.find('[data-test="preset-parallelogram"]').trigger('click');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][1].length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-polygon-inspector.test.js`
Expected: FAIL.

- [ ] **Step 3: Add the inspector section**

In `PropertiesPanel.vue` `<script setup>`, add the import:
```js
import { presetVertices } from '../../engine/polygonVertices.js';
```
Add a preset handler near the other helpers:
```js
function applyPolygonPreset(kind) {
  if (!obj.value) return;
  store.setPolygonVertices(obj.value.id, presetVertices(kind, obj.value.width, obj.value.height));
}
```
In the template, after the existing shape-specific sections, add:
```html
      <Section v-if="obj.type === 'polygon_free'" label="Polygon">
        <div class="flex gap-1.5">
          <button class="btn-mini flex-1" @click="applyPolygonPreset('trapezoid')">Trapezoid</button>
          <button data-test="preset-parallelogram" class="btn-mini flex-1" @click="applyPolygonPreset('parallelogram')">Parallelogram</button>
          <button class="btn-mini flex-1" @click="applyPolygonPreset('free')">Free</button>
        </div>
        <p class="text-[10px] text-studio-text-muted mt-1.5">{{ (obj.vertices || []).length }} vertices · drag corners on canvas</p>
      </Section>
```
READ an existing inspector button's class in the file; if there is no `btn-mini` utility, use the same class an existing small button uses (e.g. the graph add/remove buttons) so styling is consistent.

- [ ] **Step 4: Add `polygon_free` to the effect-gating sets**

In `PropertiesPanel.vue` `<script setup>` (~696), append `'polygon_free'` to BOTH `GRADIENT_TYPES` and `DASH_TYPES` (matching codegen.js/manim.js).

- [ ] **Step 5: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-polygon-inspector.test.js` → 2 pass. Then:
```bash
cd services/web && npx vitest run tests/components/
cd services/web && npm test
cd services/web && npm run build
```
Expected: all Vitest pass; engine suite green; build succeeds.

- [ ] **Step 6: Confirm generator parity**

```bash
cd "D:/PYTHON/Manim-Editor" && grep -n "= Polygon(" services/api/src/compiler/codegen.js services/web/src/export/manim.js
```
Expected: the `Polygon(${pts})` template string appears identically in both files.

- [ ] **Step 7: Commit**

```bash
git add services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/phase2-polygon-inspector.test.js
git commit -m "feat(inspector): polygon_free presets + effect gating"
```

---

## Self-Review Notes

- **Spec coverage (polygon_free):** vertices data model + presets → Tasks 1,2,6; codegen `Polygon(*pts)` single-line + parser → Task 3; Konva body → Task 4; draggable vertex handles → Task 5; Trapezoid/Parallelogram/Free presets → Tasks 1,6; effect-set membership → Tasks 3,6. Other Plan-2..4 objects are out of scope.
- **Coordinate coherence:** vertices are center-relative px everywhere (store, codegen `vx/sw*FRAME_WIDTH` + `-vy/sh*FRAME_HEIGHT` y-flip, parser inverse, Konva `vx*vs`, handle `canvasToVertex`). The generic `move_to([mp.x, mp.y, 0])` positions the origin-built polygon (accepted minor centroid offset, same as `triangle`).
- **Naming consistency:** `vertices`, `setPolygonVertices`, `presetVertices`, `verticesBBox`, `vertexToCanvas`, `canvasToVertex`, `polygonFreeCfg`, `polygonHandles`, type string `polygon_free`, `applyPolygonPreset` — used identically across tasks.
- **Type-set membership:** `polygon_free` in GRADIENT_TYPES + DASH_TYPES in codegen.js, manim.js, PropertiesPanel.vue (Tasks 3 + 6).
- **Round-trip:** Task 3 asserts type + vertex count + approximate first vertex (±~10px from `toFixed(3)`/`Math.round`). The parser regex requires ≥2 vertex tuples and won't collide with `RegularPolygon(n=...)` (which has no leading `[`).
- **Drag vs transformer:** polygon_free is drag-only on the body; resizing/reshaping is via vertex handles (Task 5), avoiding the generic transformer's scale→width/height mapping that doesn't fit free vertices.
```
