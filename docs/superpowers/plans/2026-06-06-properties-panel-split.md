# PropertiesPanel.vue Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1267-line `services/web/src/components/inspector/PropertiesPanel.vue` monolith into shared UI atoms, four branch panels, and a per-object-type settings registry, leaving a thin orchestrator — behaviorally identical.

**Architecture:** A characterization snapshot is captured first as a safety net. Then, leaf→root, the three in-script mini-components become real SFCs (`ui/`), the four selection branches become panel components (`panels/`), the cross-cutting object sections and each per-type settings block become components (`object-settings/`) registered in a `type→component` map. `PropertiesPanel.vue` ends as a ~35-line switch. **All template markup moves verbatim** — only `<script setup>` differs per file — so the snapshot and the existing inspector tests stay green at every step.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest + `@vue/test-utils` (`mount`).

**Spec:** `docs/superpowers/specs/2026-06-06-properties-panel-split-design.md`

---

## Conventions (read once, applied by every task)

**The verbatim-move rule.** Every template block is located by its existing HTML
comment marker (e.g. `<!-- Dot Grid -->`) and moved **character-for-character** into the
new component. Do not retype or reformat markup — cut the existing lines and paste them.
The markers are stable across edits; raw line numbers are not, so always locate by marker.

**Why markup is identical in every target.** In the current monolith `obj` is a
`computed` ref and templates read `obj.foo` (Vue auto-unwraps refs in templates). In an
extracted settings component `obj` is a **prop** (plain reactive store object) and
templates still read `obj.foo`. Either way the template text is byte-identical — only the
`<script setup>` changes. Passing the reactive store object as a prop preserves
reactivity (store mutations flow back through the prop).

**Shared atom imports.** Components that use `Section`/`Num`/`ColorRow` import them from
`ui/` (created in Task 2):
```js
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
import ColorRow from '../ui/ColorRow.vue';
```
(`panels/*` import them as `'../ui/Section.vue'`; `object-settings/*` import them as
`'../ui/Section.vue'` too — both dirs are one level under `inspector/`.)

**Generic field updates.** Components that set plain object fields use the
`useObjectUpdate` composable (created in Task 2). In a settings component the active
object is the prop:
```js
import { useObjectUpdate } from '../useObjectUpdate.js';
const props = defineProps({ obj: { type: Object, required: true } });
const { u, uSize, uRange } = useObjectUpdate(() => props.obj);
const store = useProjectStore();   // only if the template calls store.* directly
```
Components that already call dedicated store actions (`store.setTableCell`,
`store.setFieldExpr`, …) keep calling them directly — those calls are part of the moved
markup and need no change beyond having `store` in scope.

**Per-component test harness.** New unit tests mount the small component directly with an
explicit `obj`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../src/store/project.js';

let store, obj;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
});
```

**Commands.** Unit + component tests: `cd services/web && npm run test:unit`. A single
file: `cd services/web && npx vitest run tests/components/<file>.test.js`. Engine tests
(must also stay green): `cd services/web && npm test`. Prod build sanity (Vue 3
`<template v-for>` key gotcha): `cd services/web && npm run build`.

**Commit after every task.** Frequent commits; never bundle two tasks.

---

## Task 1: Characterization snapshot (safety net, first)

**Files:**
- Test: `services/web/tests/components/inspector/properties-panel.characterization.test.js`

- [ ] **Step 1: Write the characterization test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../../src/store/project.js';

const OBJECT_TYPES = [
  'rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon',
  'line', 'arrow', 'heart', 'dot', 'dot_grid', 'text', 'latex', 'axes',
  'numberplane', 'numberline', 'annulus', 'arc', 'sector', 'double_arrow',
  'polygon_free', 'parametric', 'matrix', 'brace', 'angle', 'counter', 'table',
  'complex_plane', 'polar_plane', 'graph', 'vector_field',
];

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Char', 'visual');
});

describe('PropertiesPanel characterization — object branch', () => {
  for (const type of OBJECT_TYPES) {
    it(`renders identically for ${type}`, () => {
      store.addObject(type, 960, 540);
      const o = store.project.objects[store.project.objects.length - 1];
      store.selectObject(o.id);
      const w = mount(PropertiesPanel);
      expect(w.html()).toMatchSnapshot();
    });
  }
});

describe('PropertiesPanel characterization — canvas branch', () => {
  it('nothing selected (canvas)', () => {
    const w = mount(PropertiesPanel);
    expect(w.html()).toMatchSnapshot();
  });
});
```

> Scope note: this snapshot covers the **object branch (every type)** — the heavily
> refactored part — plus the **canvas** (nothing-selected) branch. The **clip** and
> **camera-clip** branches are not snapshotted here because existing tests already mount
> `PropertiesPanel` with those selections and guard them: `emphasis-panel.test.js` +
> `parallel-clips.test.js` (clip branch, Task 5) and `camera.test.js` (camera-clip branch,
> Task 4).

- [ ] **Step 2: Run it to capture the baseline snapshot**

Run: `cd services/web && npx vitest run tests/components/inspector/properties-panel.characterization.test.js`
Expected: PASS — Vitest writes a new snapshot file
(`tests/components/inspector/__snapshots__/properties-panel.characterization.test.js.snap`)
on first run. Confirm the `.snap` file now exists and contains the rendered HTML for each
object type plus the canvas and clip branches.

- [ ] **Step 3: Commit the baseline**

```bash
git add services/web/tests/components/inspector/properties-panel.characterization.test.js services/web/tests/components/inspector/__snapshots__/
git commit -m "test(inspector): characterization snapshot baseline for PropertiesPanel"
```

> From here on, **this snapshot must stay green and unchanged** through every task. If a
> task changes the snapshot, the extraction was not byte-identical — fix the extraction,
> do not update the snapshot.

---

## Task 2: Shared UI atoms (`ui/`) + `useObjectUpdate`

**Files:**
- Create: `services/web/src/components/inspector/ui/Section.vue`
- Create: `services/web/src/components/inspector/ui/Num.vue`
- Create: `services/web/src/components/inspector/ui/ColorRow.vue`
- Create: `services/web/src/components/inspector/useObjectUpdate.js`
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (remove in-script
  `Section`/`Num`/`ColorRow` consts; import the SFCs; replace `u`/`uSize`/`uRange` with
  the composable)

- [ ] **Step 1: Create `ui/Section.vue`** (markup copied from the in-script const)

```vue
<template>
  <div class="px-3 py-2 border-b border-studio-border/50">
    <label class="text-[10px] text-studio-text-muted/70 uppercase font-bold tracking-wider mb-1 block">{{ label }}</label>
    <slot />
  </div>
</template>

<script setup>
defineProps({ label: String });
</script>
```

- [ ] **Step 2: Create `ui/Num.vue`** (same props/emit contract as the in-script const)

```vue
<template>
  <div>
    <span class="text-[9px] text-studio-text-muted/50">{{ label }}</span>
    <input class="input input-sm" type="number" :value="value" :min="min" :max="max" :step="step"
           @change="$emit('input', Number($event.target.value))" />
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [Number, String],
  min: { type: Number, default: undefined },
  max: { type: Number, default: undefined },
  step: { type: Number, default: 1 },
});
defineEmits(['input']);
</script>
```

- [ ] **Step 3: Create `ui/ColorRow.vue`**

```vue
<template>
  <div class="flex items-center gap-2">
    <span class="text-[10px] text-studio-text-muted w-12">{{ label }}</span>
    <input type="color" class="color-input" :value="value || '#ffffff'" @input="$emit('input', $event.target.value)" />
    <input class="input input-sm flex-1" :value="value" @change="$emit('input', $event.target.value)" />
  </div>
</template>

<script setup>
defineProps(['label', 'value']);
defineEmits(['input']);
</script>
```

- [ ] **Step 4: Create `useObjectUpdate.js`** (factored from the current `u`/`uSize`/`uRange`)

```js
import { useProjectStore } from '../../store/project.js';

// getObj: () => the active object (or null). Returns generic field-update helpers.
export function useObjectUpdate(getObj) {
  const store = useProjectStore();
  const u = (k, v) => { const o = getObj(); if (o) store.updateObject(o.id, { [k]: v }); };
  const uSize = (v) => { const o = getObj(); if (o) store.updateObject(o.id, { width: v, height: v }); };
  const uRange = (prop, idx, val) => {
    const o = getObj(); if (!o) return;
    const arr = [...(o[prop] || (prop === 'xRange' ? [-5, 5, 1] : [-3, 3, 1]))];
    arr[idx] = val;
    store.updateObject(o.id, { [prop]: arr });
  };
  return { u, uSize, uRange };
}
```

- [ ] **Step 5: Rewire `PropertiesPanel.vue`**

In `<script setup>`: delete the three `const Section = {…}`, `const Num = {…}`,
`const ColorRow = {…}` definitions. Add imports beside the existing ones:
```js
import Section from './ui/Section.vue';
import Num from './ui/Num.vue';
import ColorRow from './ui/ColorRow.vue';
import { useObjectUpdate } from './useObjectUpdate.js';
```
Delete the `function u`, `function uSize`, and `function uRange` definitions, and add:
```js
const { u, uSize, uRange } = useObjectUpdate(() => obj.value);
```
Leave all template markup untouched.

- [ ] **Step 6: Run the characterization snapshot + existing inspector tests**

Run: `cd services/web && npm run test:unit`
Expected: PASS. The characterization snapshot is **unchanged** (same `.snap`). Existing
tests that mount `PropertiesPanel` (`effects-panel`, `phase2-*-inspector`,
`phase25-relational-inspector`, `phase26-effects-panel`, `emphasis-panel`, `graphs`) all
still pass.

- [ ] **Step 7: Commit**

```bash
git add services/web/src/components/inspector/ui services/web/src/components/inspector/useObjectUpdate.js services/web/src/components/inspector/PropertiesPanel.vue
git commit -m "refactor(inspector): extract ui/ atoms + useObjectUpdate; PropertiesPanel uses them"
```

---

## Task 3: `CanvasInspector.vue` (nothing-selected branch)

**Files:**
- Create: `services/web/src/components/inspector/panels/CanvasInspector.vue`
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue`

- [ ] **Step 1: Create `panels/CanvasInspector.vue`**

Template: move the entire final `<template v-else> … </template>` block (the one starting
with `<div class="panel-header">Canvas</div>`, marker
`<!-- Nothing Selected: Show background & canvas props + object list -->`) **verbatim**,
changing only the outer `<template v-else>` wrapper to a `<template>` root. Script:

```vue
<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
import ColorRow from '../ui/ColorRow.vue';
import Num from '../ui/Num.vue';
import Scene3DPanel from '../Scene3DPanel.vue';

const store = useProjectStore();
const stg = computed(() => store.project.stage);
const groups = computed(() => store.project.groups || []);
const objs = computed(() => store.project.objects);

function uStage(k, v) { store.updateStage({ [k]: v }); }
function ungroup(groupId) { store.ungroupObjects(groupId); }
function isSel(id) { return store.selectedObjectIds.includes(id); }
function selObj(id, e) { store.selectObject(id, e.shiftKey || e.ctrlKey); }
</script>
```
Move the `.obj-list-item` style rules from `PropertiesPanel.vue`'s `<style scoped>` into a
`<style scoped>` here (the `.obj-list-item` and `.obj-list-item.sel` blocks).

- [ ] **Step 2: Wire it into `PropertiesPanel.vue`**

Replace the whole `<template v-else> … </template>` block with `<CanvasInspector v-else />`.
Add `import CanvasInspector from './panels/CanvasInspector.vue';`. Remove now-unused
script bits **only if nothing else references them** (`stg`, `groups`, `objs`, `uStage`,
`isSel`, `selObj`, `ungroup` are still used by other branches — keep them for now; they
move out as those branches are extracted).

- [ ] **Step 3: Run snapshot + tests**

Run: `cd services/web && npm run test:unit`
Expected: PASS, snapshot unchanged.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/panels/CanvasInspector.vue services/web/src/components/inspector/PropertiesPanel.vue
git commit -m "refactor(inspector): extract panels/CanvasInspector.vue"
```

---

## Task 4: `CameraClipInspector.vue`

**Files:**
- Create: `services/web/src/components/inspector/panels/CameraClipInspector.vue`
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue`

- [ ] **Step 1: Create `panels/CameraClipInspector.vue`**

Template: move the `<template v-else-if="cameraClip"> … </template>` block (marker
`<!-- Camera Clip Inspector -->`) verbatim, outer wrapper → `<template>`. Script:

```vue
<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import { EASING_LIST } from '../../../engine/easing.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';

const store = useProjectStore();
const easings = EASING_LIST;
const cameraClip = computed(() => {
  if (!store.selectedClipId) return null;
  return store.project.cameraTrack?.find(c => c.id === store.selectedClipId) || null;
});

function updateCameraClip(param, value) {
  if (!cameraClip.value) return;
  store.updateCameraClip(cameraClip.value.id, { params: { [param]: value } });
}
function uca(key, value) {
  if (!cameraClip.value) return;
  store.updateCameraClip(cameraClip.value.id, { [key]: value });
}
function delCameraClip() {
  if (!cameraClip.value) return;
  store.deleteCameraClip(cameraClip.value.id);
  store.selectedClipId = null;
}
</script>
```

- [ ] **Step 2: Wire it into `PropertiesPanel.vue`**

Replace the `<template v-else-if="cameraClip"> … </template>` block with
`<CameraClipInspector v-else-if="cameraClip" />`. Add the import. Keep the `cameraClip`
computed in `PropertiesPanel` (the `v-else-if` condition still needs it).

- [ ] **Step 3: Run snapshot + tests** — `cd services/web && npm run test:unit` → PASS, snapshot unchanged. (`camera.test.js` covers this branch.)

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/panels/CameraClipInspector.vue services/web/src/components/inspector/PropertiesPanel.vue
git commit -m "refactor(inspector): extract panels/CameraClipInspector.vue"
```

---

## Task 5: `ClipInspector.vue`

**Files:**
- Create: `services/web/src/components/inspector/panels/ClipInspector.vue`
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue`

- [ ] **Step 1: Create `panels/ClipInspector.vue`**

Template: move the `<template v-else-if="clip"> … </template>` block (marker
`<!-- Clip Properties -->`, the one with the `Animation` header and all per-clip-type
`<Section v-if="clip.type === …">` rows) verbatim, outer wrapper → `<template>`. Script:

```vue
<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import { EASING_LIST } from '../../../engine/easing.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';

const store = useProjectStore();
const easings = EASING_LIST;
const clip = computed(() => store.selectedClip);

const clipBadge = computed(() => {
  const m = { transform: 'bg-purple-600 text-white', move: 'bg-blue-600 text-white', scale: 'bg-green-600 text-white', fade: 'bg-orange-600 text-white', rotate: 'bg-pink-600 text-white' };
  return m[clip.value?.type] || 'bg-gray-600 text-white';
});

function uc(k, v) { if (clip.value) store.updateClip(clip.value.id, { [k]: v }); }
function up(k, v) { if (clip.value) store.updateClip(clip.value.id, { params: { ...(clip.value.params || {}), [k]: v } }); }
function oName(id) { const o = store.objectById(id); return o ? o.name : '(deleted)'; }
function delClip() { if (clip.value) store.deleteClip(clip.value.id); }
</script>
```

- [ ] **Step 2: Wire it into `PropertiesPanel.vue`**

Replace the `<template v-else-if="clip"> … </template>` block with
`<ClipInspector v-else-if="clip" />`. Add the import. Keep the `clip` computed in
`PropertiesPanel` (the `v-else-if` still needs it).

- [ ] **Step 3: Run snapshot + tests** — `cd services/web && npm run test:unit` → PASS, snapshot unchanged. (`emphasis-panel.test.js`, `parallel-clips.test.js` cover this branch.)

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/panels/ClipInspector.vue services/web/src/components/inspector/PropertiesPanel.vue
git commit -m "refactor(inspector): extract panels/ClipInspector.vue (per-clip-type sections stay inline)"
```

---

## Task 6: `ObjectInspector.vue` (move the whole object branch)

This moves the large object branch verbatim into one component. Per-type sections stay
**inline inside ObjectInspector for now**; Tasks 9–28 carve them out afterward.

**Files:**
- Create: `services/web/src/components/inspector/panels/ObjectInspector.vue`
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue`

- [ ] **Step 1: Create `panels/ObjectInspector.vue`**

Template: move the entire `<template v-if="obj"> … </template>` block (marker
`<!-- Object Properties -->` through the `Delete Object` button) verbatim, outer wrapper →
`<template>`. Move the object-related `<style scoped>` rules (`.anim-btn*`, `.anchor-grid`,
`.anchor-btn*`, `.align-btn*`) into this component's `<style scoped>`. Script — move every
object-branch concern out of `PropertiesPanel` into here:

```vue
<script setup>
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import { ENTER_ANIMS, EXIT_ANIMS } from '../../../store/project.js';
import { ANCHOR_GRID, ANCHOR_LABELS } from '../../../constants/anchors.js';
import { presetVertices } from '../../../engine/polygonVertices.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
import ColorRow from '../ui/ColorRow.vue';
import FontSelector from '../FontSelector.vue';
import Position3DPanel from '../Position3DPanel.vue';

const store = useProjectStore();
const anchorGrid = ANCHOR_GRID;
const anchorLabels = ANCHOR_LABELS;
const enterAnims = ENTER_ANIMS;
const exitAnims = EXIT_ANIMS;

const obj = computed(() => store.selectedObject);
const { u, uSize, uRange } = useObjectUpdate(() => obj.value);

const OBJ_3D_TYPES = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
const is3DObject = computed(() => !!obj.value && OBJ_3D_TYPES.includes(obj.value.type));
function onObj3DUpdate(payload) { if (obj.value) store.updateObject(obj.value.id, payload); }

const enterAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = ENTER_ANIMS.find(a => a.value === (obj.value.enterAnim || 'fade_in'));
  return a ? a.desc : '';
});
const exitAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = EXIT_ANIMS.find(a => a.value === (obj.value.exitAnim || 'fade_out'));
  return a ? a.desc : '';
});
const objGroup = computed(() => (obj.value ? store.objectGroup(obj.value.id) : null));
const typeLabel = computed(() => {
  if (!obj.value) return '';
  const m = { dot_grid: 'Dot Grid', svg_asset: 'SVG', rectangle: 'Rectangle', latex: 'LaTeX', axes: 'Axes', polygon: 'Polygon' };
  return m[obj.value.type] || obj.value.type;
});
const typeBadge = computed(() => {
  const m = {
    heart: 'bg-pink-600 text-white', square: 'bg-blue-600 text-white', rectangle: 'bg-blue-600 text-white',
    circle: 'bg-green-600 text-white', ellipse: 'bg-cyan-600 text-white',
    triangle: 'bg-amber-600 text-white', star: 'bg-yellow-600 text-white', polygon: 'bg-purple-600 text-white',
    line: 'bg-gray-600 text-white', arrow: 'bg-red-600 text-white',
    dot: 'bg-gray-600 text-white', dot_grid: 'bg-purple-600 text-white',
    text: 'bg-pink-500 text-white', image: 'bg-amber-600 text-white', svg_asset: 'bg-amber-600 text-white',
    latex: 'bg-purple-600 text-white', axes: 'bg-emerald-600 text-white',
  };
  return m[obj.value?.type] || 'bg-gray-600 text-white';
});
const effectiveSize = computed(() => {
  if (!obj.value) return 0;
  return Math.min(obj.value.width || 0, obj.value.height || 0) || 1;
});

function applyPolygonPreset(kind) {
  if (!obj.value) return;
  store.setPolygonVertices(obj.value.id, presetVertices(kind, obj.value.width, obj.value.height));
}

// Effects sets + helpers (carved out in Task 7)
const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free']);
const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow', 'annulus', 'sector', 'arc', 'double_arrow', 'polygon_free', 'parametric']);
const ROUND_TYPES = new Set(['rectangle', 'square', 'polygon', 'triangle', 'star']);
const SHADOW_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free', 'text', 'latex']);
const canGradient = computed(() => obj.value && GRADIENT_TYPES.has(obj.value.type));
const canDash = computed(() => obj.value && DASH_TYPES.has(obj.value.type));
const canRound = computed(() => obj.value && ROUND_TYPES.has(obj.value.type));
const canShadow = computed(() => obj.value && SHADOW_TYPES.has(obj.value.type));
function toggleGradient() {
  if (!obj.value) return;
  if (obj.value.gradient) store.setGradient(obj.value.id, null);
  else store.setGradient(obj.value.id, { colors: [obj.value.fill || '#3b82f6', '#8b5cf6'], angle: 135 });
}
function setGradientStop(i, color) { const g = obj.value.gradient; if (!g) return; const colors = [...g.colors]; colors[i] = color; store.setGradient(obj.value.id, { ...g, colors }); }
function addGradientStop() { const g = obj.value.gradient; if (!g) return; store.setGradient(obj.value.id, { ...g, colors: [...g.colors, '#ffffff'] }); }
function removeGradientStop(i) { const g = obj.value.gradient; if (!g || g.colors.length <= 2) return; store.setGradient(obj.value.id, { ...g, colors: g.colors.filter((_, j) => j !== i) }); }
function setGradientAngle(deg) { const g = obj.value.gradient; if (!g) return; store.setGradient(obj.value.id, { ...g, angle: Number(deg) }); }
function toggleDash() { if (!obj.value) return; if (obj.value.dash) store.setDash(obj.value.id, null); else store.setDash(obj.value.id, { numDashes: 12, ratio: 0.5 }); }
function setDashField(key, val) { const d = obj.value.dash || { numDashes: 12, ratio: 0.5 }; store.setDash(obj.value.id, { ...d, [key]: Number(val) }); }

// Axes graph editor (carved out in Task 28)
function addGraph() { if (obj.value && obj.value.type === 'axes') store.addGraph(obj.value.id); }
function removeGraph(graphId) { if (obj.value) store.removeGraph(obj.value.id, graphId); }
function updateGraph(graphId, key, value) { if (obj.value) store.updateGraph(obj.value.id, graphId, { [key]: value }); }
function toggleGraphArea(graph) {
  if (!obj.value) return;
  const existing = graph.area || {}; const on = !existing.enabled;
  store.updateGraph(obj.value.id, graph.id, { area: on ? { xMin: graph.xMin, xMax: graph.xMax, opacity: 0.5, color: graph.color, ...existing, enabled: true } : { ...existing, enabled: false } });
}
function toggleGraphRiemann(graph) {
  if (!obj.value) return;
  const existing = graph.riemann || {}; const on = !existing.enabled;
  store.updateGraph(obj.value.id, graph.id, { riemann: on ? { xMin: graph.xMin, xMax: graph.xMax, dx: Math.max(0.1, (graph.xMax - graph.xMin) / 10), type: 'left', color: graph.color, ...existing, enabled: true } : { ...existing, enabled: false } });
}
function setRiemannField(graph, key, val) { if (obj.value && graph.riemann) store.updateGraph(obj.value.id, graph.id, { riemann: { ...graph.riemann, [key]: val } }); }

// DiGraph editor (carved out in Task 24)
const newEdgeFrom = ref('');
const newEdgeTo = ref('');
watch(() => store.selectedObjectIds, () => { newEdgeFrom.value = ''; newEdgeTo.value = ''; });
function graphVertexName(v) { return String(v || '').trim(); }
function addGraphVertexAuto() { if (obj.value) store.addGraphVertex(obj.value.id); }
function removeGraphVertex(v) { if (obj.value) store.removeGraphVertex(obj.value.id, v); }
function renameGraphVertex(oldV, newV) { if (!obj.value) return; const nv = graphVertexName(newV); if (nv && nv !== oldV) store.renameGraphVertex(obj.value.id, oldV, nv); }
function addGraphEdgeFromUI() { if (!obj.value) return; const a = newEdgeFrom.value, b = newEdgeTo.value; if (a && b && a !== b) { store.addGraphEdge(obj.value.id, a, b); newEdgeFrom.value = ''; newEdgeTo.value = ''; } }
function removeGraphEdge(a, b) { if (obj.value) store.removeGraphEdge(obj.value.id, a, b); }

// Align / group / motion / delete
function align(anchor) { if (obj.value) store.alignObject(obj.value.id, anchor); }
function ungroup(groupId) { store.ungroupObjects(groupId); }
function del() { if (obj.value) store.deleteObject(obj.value.id); }
function anim(type) {
  if (!obj.value) return;
  const p = {};
  if (type === 'move') { p.targetX = obj.value.x + 200; p.targetY = obj.value.y; }
  if (type === 'scale') { p.targetScaleX = 2; p.targetScaleY = 2; }
  if (type === 'fade') { p.targetOpacity = 0; }
  if (type === 'rotate') { p.targetRotation = (obj.value.rotation || 0) + 360; }
  if (type === 'indicate') { p.color = '#FFFF00'; p.scale_factor = 1.2; }
  if (type === 'flash') { p.color = '#FFFF00'; p.flash_radius = 0.3; p.line_length = 0.2; p.num_lines = 12; }
  if (type === 'wiggle') { p.scale_value = 1.1; p.rotation_angle = 3.6; p.n_wiggles = 6; }
  if (type === 'circumscribe') { p.color = '#FFFF00'; p.shape = 'Rectangle'; p.fade_out = false; p.time_width = 0.3; }
  if (type === 'focus_on') { p.color = '#FFFFFF'; p.opacity = 0.2; }
  store.createAnimation(type, p);
}
</script>
```

- [ ] **Step 2: Reduce `PropertiesPanel.vue` to the orchestrator**

Replace the whole `<template v-if="obj"> … </template>` block with
`<ObjectInspector v-if="obj" />`. The template is now:
```vue
<template>
  <aside class="w-72 bg-studio-surface border-l border-studio-border flex flex-col flex-shrink-0 overflow-y-auto">
    <KeyframePanel />
    <ObjectInspector v-if="obj" />
    <ClipInspector v-else-if="clip" />
    <CameraClipInspector v-else-if="cameraClip" />
    <CanvasInspector v-else />
  </aside>
</template>
```
Replace the whole `<script setup>` with the minimal switch logic, and delete the now-empty
`<style scoped>` (all rules moved into the panels):
```vue
<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
import KeyframePanel from './KeyframePanel.vue';
import ObjectInspector from './panels/ObjectInspector.vue';
import ClipInspector from './panels/ClipInspector.vue';
import CameraClipInspector from './panels/CameraClipInspector.vue';
import CanvasInspector from './panels/CanvasInspector.vue';

const store = useProjectStore();
const obj = computed(() => store.selectedObject);
const clip = computed(() => store.selectedClip);
const cameraClip = computed(() => {
  if (!store.selectedClipId) return null;
  return store.project.cameraTrack?.find(c => c.id === store.selectedClipId) || null;
});
</script>
```

- [ ] **Step 3: Run snapshot + full unit suite**

Run: `cd services/web && npm run test:unit`
Expected: PASS, snapshot unchanged. All existing inspector tests green (they mount
`PropertiesPanel`, which now delegates to the panels).

- [ ] **Step 4: Build sanity (Vue 3 `<template v-for>` key gotcha)**

Run: `cd services/web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/inspector/panels/ObjectInspector.vue services/web/src/components/inspector/PropertiesPanel.vue
git commit -m "refactor(inspector): extract panels/ObjectInspector.vue; PropertiesPanel is a thin switch"
```

---

## Task 7: `EffectsSection.vue`

**Files:**
- Create: `services/web/src/components/inspector/object-settings/EffectsSection.vue`
- Modify: `services/web/src/components/inspector/panels/ObjectInspector.vue`

- [ ] **Step 1: Create `object-settings/EffectsSection.vue`**

Template: move the `<!-- Effects -->` `<Section v-if="canGradient || canDash || canRound || canShadow" …>`
block verbatim. Script:

```vue
<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';

const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const { u } = useObjectUpdate(() => props.obj);
const obj = computed(() => props.obj);

const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free']);
const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow', 'annulus', 'sector', 'arc', 'double_arrow', 'polygon_free', 'parametric']);
const ROUND_TYPES = new Set(['rectangle', 'square', 'polygon', 'triangle', 'star']);
const SHADOW_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free', 'text', 'latex']);
const canGradient = computed(() => GRADIENT_TYPES.has(obj.value.type));
const canDash = computed(() => DASH_TYPES.has(obj.value.type));
const canRound = computed(() => ROUND_TYPES.has(obj.value.type));
const canShadow = computed(() => SHADOW_TYPES.has(obj.value.type));

function toggleGradient() {
  if (obj.value.gradient) store.setGradient(obj.value.id, null);
  else store.setGradient(obj.value.id, { colors: [obj.value.fill || '#3b82f6', '#8b5cf6'], angle: 135 });
}
function setGradientStop(i, color) { const g = obj.value.gradient; if (!g) return; const colors = [...g.colors]; colors[i] = color; store.setGradient(obj.value.id, { ...g, colors }); }
function addGradientStop() { const g = obj.value.gradient; if (!g) return; store.setGradient(obj.value.id, { ...g, colors: [...g.colors, '#ffffff'] }); }
function removeGradientStop(i) { const g = obj.value.gradient; if (!g || g.colors.length <= 2) return; store.setGradient(obj.value.id, { ...g, colors: g.colors.filter((_, j) => j !== i) }); }
function setGradientAngle(deg) { const g = obj.value.gradient; if (!g) return; store.setGradient(obj.value.id, { ...g, angle: Number(deg) }); }
function toggleDash() { if (obj.value.dash) store.setDash(obj.value.id, null); else store.setDash(obj.value.id, { numDashes: 12, ratio: 0.5 }); }
function setDashField(key, val) { const d = obj.value.dash || { numDashes: 12, ratio: 0.5 }; store.setDash(obj.value.id, { ...d, [key]: Number(val) }); }
</script>
```
The moved template references `store.setCornerRadius` / `store.setShadow` directly (already
in scope via `store`), and `u('fillOpacity', …)` / `u('strokeOpacity', …)` via the
composable.

- [ ] **Step 2: Wire into `ObjectInspector.vue`**

`EffectsSection` **self-gates** (its root is the original `<Section v-if="canGradient || canDash || canRound || canShadow" …>`, which renders a comment placeholder when no effect applies — identical output to the inline `v-if`). So in `ObjectInspector`, replace the
`<!-- Effects -->` `<Section …>` block with `<EffectsSection :obj="obj" />` (always rendered).
Add `import EffectsSection from '../object-settings/EffectsSection.vue';`. Delete from
`ObjectInspector`'s script everything the Effects block alone used: `toggleGradient`,
`setGradientStop`, `addGradientStop`, `removeGradientStop`, `setGradientAngle`, `toggleDash`,
`setDashField`, the `canGradient`/`canDash`/`canRound`/`canShadow` computeds, **and** the
`GRADIENT_TYPES`/`DASH_TYPES`/`ROUND_TYPES`/`SHADOW_TYPES` sets (they now live only in
`EffectsSection`).

- [ ] **Step 3: Run snapshot + tests** — `cd services/web && npm run test:unit` → PASS, snapshot unchanged. (`effects-panel.test.js`, `phase26-effects-panel.test.js` exercise this component.)

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/object-settings/EffectsSection.vue services/web/src/components/inspector/panels/ObjectInspector.vue
git commit -m "refactor(inspector): extract object-settings/EffectsSection.vue"
```

---

## Task 8: `TextSettings.vue`

**Files:**
- Create: `services/web/src/components/inspector/object-settings/TextSettings.vue`
- Modify: `services/web/src/components/inspector/panels/ObjectInspector.vue`

- [ ] **Step 1: Create `object-settings/TextSettings.vue`**

Template: move the `<!-- Text Properties -->` block (the
`<template v-if="obj.type === 'text'"> … </template>` containing the `Text Content` and
`Text Style` sections) verbatim, outer `<template v-if>` → `<template>`. Script:

```vue
<script setup>
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
import ColorRow from '../ui/ColorRow.vue';
import FontSelector from '../FontSelector.vue';

const props = defineProps({ obj: { type: Object, required: true } });
useProjectStore();
const { u } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>
```
> Note: the moved markup reads `obj.content`, `obj.fill`, `obj.fontSize`, `obj.textAlign`,
> `obj.fontFamily`, `obj.fontWeight`. With `const obj = props.obj` these resolve against the
> reactive store object. (If template reactivity on prop replacement is ever needed, switch
> to `const obj = computed(() => props.obj)`; not needed here since selection swaps the whole
> component.)

- [ ] **Step 2: Wire into `ObjectInspector.vue`**

Replace the `<!-- Text Properties -->` block with
`<TextSettings v-if="obj.type === 'text'" :obj="obj" />`. Add the import. Remove the now-unused
`FontSelector` import from `ObjectInspector` (it moved into `TextSettings`).

- [ ] **Step 3: Run snapshot + tests** — `cd services/web && npm run test:unit` → PASS, snapshot unchanged.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/object-settings/TextSettings.vue services/web/src/components/inspector/panels/ObjectInspector.vue
git commit -m "refactor(inspector): extract object-settings/TextSettings.vue"
```

---

## Task 9: `MotionPicker.vue`

**Files:**
- Create: `services/web/src/components/inspector/object-settings/MotionPicker.vue`
- Modify: `services/web/src/components/inspector/panels/ObjectInspector.vue`

- [ ] **Step 1: Create `object-settings/MotionPicker.vue`**

Template: move the `<!-- ═══ Motion (Timeline Clips) ═══ -->` `<Section label="Add Motion">`
block verbatim. Move the `.anim-btn*` style rules into this component's `<style scoped>`
(remove them from `ObjectInspector`). Script:

```vue
<script setup>
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';

const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;

function anim(type) {
  const p = {};
  if (type === 'move') { p.targetX = obj.x + 200; p.targetY = obj.y; }
  if (type === 'scale') { p.targetScaleX = 2; p.targetScaleY = 2; }
  if (type === 'fade') { p.targetOpacity = 0; }
  if (type === 'rotate') { p.targetRotation = (obj.rotation || 0) + 360; }
  if (type === 'indicate') { p.color = '#FFFF00'; p.scale_factor = 1.2; }
  if (type === 'flash') { p.color = '#FFFF00'; p.flash_radius = 0.3; p.line_length = 0.2; p.num_lines = 12; }
  if (type === 'wiggle') { p.scale_value = 1.1; p.rotation_angle = 3.6; p.n_wiggles = 6; }
  if (type === 'circumscribe') { p.color = '#FFFF00'; p.shape = 'Rectangle'; p.fade_out = false; p.time_width = 0.3; }
  if (type === 'focus_on') { p.color = '#FFFFFF'; p.opacity = 0.2; }
  store.createAnimation(type, p);
}
</script>
```
> The moved markup also calls `store.createCount()` directly inside the
> `v-if="obj.type === 'counter'"` block — `store` is in scope.

- [ ] **Step 2: Wire into `ObjectInspector.vue`**

Replace the `<!-- ═══ Motion (Timeline Clips) ═══ -->` block with
`<MotionPicker :obj="obj" />`. Add the import. Delete the now-unused `anim` function from
`ObjectInspector`.

- [ ] **Step 3: Run snapshot + tests** — `cd services/web && npm run test:unit` → PASS, snapshot unchanged. (`emphasis-panel.test.js` clicks `anim-*` buttons.)

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/object-settings/MotionPicker.vue services/web/src/components/inspector/panels/ObjectInspector.vue
git commit -m "refactor(inspector): extract object-settings/MotionPicker.vue"
```

---

## Task 10: Introduce the per-type registry (empty, wired into ObjectInspector)

**Files:**
- Create: `services/web/src/components/inspector/object-settings/index.js`
- Modify: `services/web/src/components/inspector/panels/ObjectInspector.vue`

- [ ] **Step 1: Create `object-settings/index.js`** (empty registry to start)

```js
// type -> settings component. Each per-type task adds one import + one entry.
const REGISTRY = {};
export function settingsComponentFor(type) { return REGISTRY[type] || null; }
```

- [ ] **Step 2: Add the registry slot to `ObjectInspector.vue`**

Import and expose the helper:
```js
import { settingsComponentFor } from '../object-settings/index.js';
```
In the template, insert this line **immediately after** the `<!-- Timeline presence -->`
`<Section>` and **before** the first per-type section (`<!-- Dot Grid -->`):
```vue
<component :is="settingsComponentFor(obj.type)" v-if="settingsComponentFor(obj.type)" :obj="obj" />
```
Leave every existing inline per-type `<Section>` in place for now (registry is empty, so
`settingsComponentFor` returns `null` → the `<component>` renders nothing). The inline
sections are deleted one at a time as each component is registered (Tasks 11–28).

- [ ] **Step 3: Run snapshot + tests** — `cd services/web && npm run test:unit` → PASS, snapshot unchanged (the empty registry adds nothing).

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/object-settings/index.js services/web/src/components/inspector/panels/ObjectInspector.vue
git commit -m "refactor(inspector): add empty object-settings registry + slot"
```

---

## Tasks 11–28: Per-type settings components

**Shared recipe for every task below:**
1. Create `object-settings/<Name>.vue`: paste the given `<script setup>`; move the named
   template block(s) from `ObjectInspector.vue` **verbatim** into a `<template>` root
   (outer `<Section v-if=…>` wrapper → `<Section>`; the `v-if` moves to the registry).
2. Register: in `object-settings/index.js` add `import <Name> from './<Name>.vue';` and one
   (or more) `REGISTRY` entries.
3. Delete the corresponding inline `<Section v-if="obj.type === …">` block(s) from
   `ObjectInspector.vue`. Delete any helper functions in `ObjectInspector` that only that
   block used (called out per task).
4. Run `cd services/web && npm run test:unit` → PASS, **snapshot unchanged**.
5. Commit `git add services/web/src/components/inspector/object-settings/<Name>.vue services/web/src/components/inspector/object-settings/index.js services/web/src/components/inspector/panels/ObjectInspector.vue && git commit -m "refactor(inspector): extract object-settings/<Name>.vue"`.

Each component's `<script setup>` head is one of two shapes:

**Shape G (generic-field):**
```js
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object, required: true } });
useProjectStore();
const { u } = useObjectUpdate(() => props.obj);   // add uSize/uRange when the block uses them
const obj = props.obj;
```

**Shape S (store-action):**
```js
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;
```
(Import `Num`/`ColorRow` only when the moved block uses them.)

---

### Task 11: `DotGridSettings.vue` — type `dot_grid`
- Block: `<!-- Dot Grid -->`. Shape **G** (uses `u`, `Num`). Registry: `dot_grid: DotGridSettings`.

### Task 12: `StarSettings.vue` — type `star`
- Block: `<!-- Star settings -->`. Shape **G** (`u`, `Num`). Registry: `star: StarSettings`.

### Task 13: `PolygonSettings.vue` — type `polygon`
- Block: `<!-- Polygon settings -->`. Shape **G** (`u`, `Num`). Registry: `polygon: PolygonSettings`.

### Task 14: `PolygonFreeSettings.vue` — type `polygon_free`
- Block: `<!-- Free polygon presets -->`. Uses `applyPolygonPreset`. Script:
```js
import { useProjectStore } from '../../../store/project.js';
import { presetVertices } from '../../../engine/polygonVertices.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;
function applyPolygonPreset(kind) { store.setPolygonVertices(obj.id, presetVertices(kind, obj.width, obj.height)); }
```
- Registry: `polygon_free: PolygonFreeSettings`. Delete `applyPolygonPreset` from `ObjectInspector` (and the `presetVertices` import if unused there).

### Task 15: `AnnulusSettings.vue` — type `annulus`
- Block: `<!-- Annulus settings -->`. Shape **G** (`u`, `Num`). Registry: `annulus: AnnulusSettings`.

### Task 16: `ArcSectorSettings.vue` — types `arc`, `sector`
- Block: `<!-- Arc / Sector settings -->` (the `<Section v-if="obj.type === 'arc' || obj.type === 'sector'" :label="…">`). Shape **G** (`u`, `Num`). Registry: `arc: ArcSectorSettings, sector: ArcSectorSettings`.

### Task 17: `ParametricSettings.vue` — type `parametric`
- Block: `<!-- Parametric settings -->`. Shape **G** (`u`, `Num`). Registry: `parametric: ParametricSettings`.

### Task 18: `VectorFieldSettings.vue` — type `vector_field`
- Block: `<!-- Vector Field settings -->`. Shape **S** + `Num` (markup calls `store.setFieldExpr`/`store.setFieldRange`). Registry: `vector_field: VectorFieldSettings`.

### Task 19: `TableSettings.vue` — type `table`
- Block: `<!-- Table grid editor -->`. Shape **S** (markup calls `store.setTableCell`/`addTableRow`/`removeTableRow`/`addTableColumn`/`removeTableColumn`/`setTableMathMode`/`setTableRowLabels`/`setTableColLabels`). No `Num`/`ColorRow`. Registry: `table: TableSettings`.

### Task 20: `MatrixSettings.vue` — type `matrix`
- Block: `<!-- Matrix grid editor -->`. Shape **S** (markup calls `store.setMatrixCell`/`addMatrixRow`/`removeMatrixRow`/`addMatrixColumn`/`removeMatrixColumn`/`setMatrixBracket`). Registry: `matrix: MatrixSettings`.

### Task 21: `BraceSettings.vue` — type `brace`
- Block: `<!-- Brace -->`. Shape **S** (`store.setRelationalLabel`). Registry: `brace: BraceSettings`.

### Task 22: `AngleSettings.vue` — type `angle`
- Block: `<!-- Angle -->`. Shape **S** (`store.setAngleRightMode`/`setAngleRadius`/`setRelationalLabel`). Registry: `angle: AngleSettings`.

### Task 23: `CounterSettings.vue` — type `counter`
- Block: `<!-- Counter settings -->`. Shape **S** (`store.setCounterValue`/`setCounterDecimals`/`setCounterSuffix`). Registry: `counter: CounterSettings`.

### Task 24: `GraphSettings.vue` — type `graph`
- Block: `<!-- Graph / DiGraph editor -->`. This owns the DiGraph editor + its local refs. Script:
```js
import { ref, watch } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;
const newEdgeFrom = ref('');
const newEdgeTo = ref('');
watch(() => store.selectedObjectIds, () => { newEdgeFrom.value = ''; newEdgeTo.value = ''; });
function graphVertexName(v) { return String(v || '').trim(); }
function addGraphVertexAuto() { store.addGraphVertex(obj.id); }
function removeGraphVertex(v) { store.removeGraphVertex(obj.id, v); }
function renameGraphVertex(oldV, newV) { const nv = graphVertexName(newV); if (nv && nv !== oldV) store.renameGraphVertex(obj.id, oldV, nv); }
function addGraphEdgeFromUI() { const a = newEdgeFrom.value, b = newEdgeTo.value; if (a && b && a !== b) { store.addGraphEdge(obj.id, a, b); newEdgeFrom.value = ''; newEdgeTo.value = ''; } }
function removeGraphEdge(a, b) { store.removeGraphEdge(obj.id, a, b); }
```
- Registry: `graph: GraphSettings`. Delete from `ObjectInspector`: `newEdgeFrom`, `newEdgeTo`, the `watch`, `graphVertexName`, `addGraphVertexAuto`, `removeGraphVertex`, `renameGraphVertex`, `addGraphEdgeFromUI`, `removeGraphEdge` (and the now-unused `ref`/`watch` imports if nothing else uses them).

### Task 25: `LatexSettings.vue` — type `latex`
- Block: `<!-- LaTeX settings -->`. Shape **G** (`u`; no `Num`). Registry: `latex: LatexSettings`.

### Task 26: `PolarPlaneSettings.vue` — type `polar_plane`
- Block: `<!-- PolarPlane settings -->`. Shape **S** (`store.setPolarRadiusMax`/`setPolarRadiusStep`/`setPolarAzimuth`). Registry: `polar_plane: PolarPlaneSettings`.

### Task 27: `PlaneRangeSettings.vue` — types `numberplane`, `complex_plane`
- Block: `<!-- NumberPlane / ComplexPlane settings -->` (the `<Section v-if="obj.type === 'numberplane' || obj.type === 'complex_plane'" :label="…">`). Shape **G** with `uRange`:
```js
const { uRange } = useObjectUpdate(() => props.obj);
```
- Uses `Num`. Registry: `numberplane: PlaneRangeSettings, complex_plane: PlaneRangeSettings`.

### Task 28: `AxesSettings.vue` — type `axes`
- Blocks: **both** `<!-- Axes settings -->` (range grid) **and** `<!-- Axes: Graph Functions -->`
  (the `Graphs` section). Move both into one component, in that order, inside one `<template>`
  (no wrapping element needed — two `<Section>` siblings are fine). Script:
```js
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const { uRange } = useObjectUpdate(() => props.obj);
const obj = props.obj;
function addGraph() { store.addGraph(obj.id); }
function removeGraph(graphId) { store.removeGraph(obj.id, graphId); }
function updateGraph(graphId, key, value) { store.updateGraph(obj.id, graphId, { [key]: value }); }
function toggleGraphArea(graph) {
  const existing = graph.area || {}; const on = !existing.enabled;
  store.updateGraph(obj.id, graph.id, { area: on ? { xMin: graph.xMin, xMax: graph.xMax, opacity: 0.5, color: graph.color, ...existing, enabled: true } : { ...existing, enabled: false } });
}
function toggleGraphRiemann(graph) {
  const existing = graph.riemann || {}; const on = !existing.enabled;
  store.updateGraph(obj.id, graph.id, { riemann: on ? { xMin: graph.xMin, xMax: graph.xMax, dx: Math.max(0.1, (graph.xMax - graph.xMin) / 10), type: 'left', color: graph.color, ...existing, enabled: true } : { ...existing, enabled: false } });
}
function setRiemannField(graph, key, val) { if (graph.riemann) store.updateGraph(obj.id, graph.id, { riemann: { ...graph.riemann, [key]: val } }); }
```
> The current `<!-- Axes: Graph Functions -->` wrapper reads `v-if="obj && obj.type === 'axes'"`;
> when moved its wrapper becomes a bare `<Section label="Graphs">` (the registry already gates on type).
- Registry: `axes: AxesSettings`. Delete from `ObjectInspector`: `addGraph`, `removeGraph`,
  `updateGraph`, `toggleGraphArea`, `toggleGraphRiemann`, `setRiemannField`.

**After Task 28:** `ObjectInspector.vue` contains only the common frame (header, Name,
Position3DPanel, Position&Size, Align, Rotation, Colors, EffectsSection, Opacity-into-frame,
TextSettings, Timeline-presence, the registry `<component>` slot, Z-Order, Group, Entrance,
Exit, MotionPicker, Delete). Verify no orphan helpers remain: grep for any of the deleted
function names in `ObjectInspector.vue` and confirm none remain.

- [ ] **Final check for the 11–28 block:**

Run: `cd services/web && npm run test:unit && npm test && npm run build`
Expected: all PASS, characterization snapshot unchanged from the Task 1 baseline.

---

## Task 29: Per-component unit tests (cover the carved-out components)

Adds focused unit tests for components **not already exercised** by existing inspector
tests (matrix/parametric/polygon_free/brace/angle/effects/area-riemann/graphs already have
coverage that mounts `PropertiesPanel`). Mount the small component directly with an explicit
`:obj`.

**Files:**
- Create: `services/web/tests/components/inspector/object-settings.test.js`

- [ ] **Step 1: Write the tests**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../../src/store/project.js';
import DotGridSettings from '../../../src/components/inspector/object-settings/DotGridSettings.vue';
import CounterSettings from '../../../src/components/inspector/object-settings/CounterSettings.vue';
import PolarPlaneSettings from '../../../src/components/inspector/object-settings/PolarPlaneSettings.vue';
import TableSettings from '../../../src/components/inspector/object-settings/TableSettings.vue';
import { settingsComponentFor } from '../../../src/components/inspector/object-settings/index.js';

let store;
function makeObj(type) {
  store.addObject(type, 960, 540);
  return store.project.objects[store.project.objects.length - 1];
}
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
});

describe('object-settings registry', () => {
  it('maps known types to a component and unknown types to null', () => {
    expect(settingsComponentFor('dot_grid')).toBeTruthy();
    expect(settingsComponentFor('axes')).toBeTruthy();
    expect(settingsComponentFor('rectangle')).toBe(null);
  });
});

describe('DotGridSettings', () => {
  it('editing Columns calls updateObject with gridCols', async () => {
    const obj = makeObj('dot_grid');
    const spy = vi.spyOn(store, 'updateObject');
    const w = mount(DotGridSettings, { props: { obj } });
    const input = w.findAll('input[type="number"]')[0];
    await input.setValue('7');
    await input.trigger('change');
    expect(spy).toHaveBeenCalledWith(obj.id, { gridCols: 7 });
  });
});

describe('CounterSettings', () => {
  it('editing suffix calls setCounterSuffix', async () => {
    const obj = makeObj('counter');
    const spy = vi.spyOn(store, 'setCounterSuffix');
    const w = mount(CounterSettings, { props: { obj } });
    const suffix = w.find('input[type="text"]');
    await suffix.setValue('%');
    await suffix.trigger('input');
    expect(spy).toHaveBeenCalledWith(obj.id, '%');
  });
});

describe('PolarPlaneSettings', () => {
  it('editing Radius Max calls setPolarRadiusMax', async () => {
    const obj = makeObj('polar_plane');
    const spy = vi.spyOn(store, 'setPolarRadiusMax');
    const w = mount(PolarPlaneSettings, { props: { obj } });
    const input = w.findAll('input[type="number"]')[0];
    await input.setValue('6');
    await input.trigger('change');
    expect(spy).toHaveBeenCalledWith(obj.id, '6');
  });
});

describe('TableSettings', () => {
  it('+ Row calls addTableRow', async () => {
    const obj = makeObj('table');
    const spy = vi.spyOn(store, 'addTableRow');
    const w = mount(TableSettings, { props: { obj } });
    const addRow = w.findAll('button').find(b => b.text() === '+ Row');
    await addRow.trigger('click');
    expect(spy).toHaveBeenCalledWith(obj.id);
  });
});
```

> If a `findAll('input[type="number"]')[0]` index does not hit the intended field for a
> given component (because the moved markup orders fields differently), adjust the index to
> match the field order in that component's template — the assertion (store method + args)
> stays the same.

- [ ] **Step 2: Run the tests**

Run: `cd services/web && npx vitest run tests/components/inspector/object-settings.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add services/web/tests/components/inspector/object-settings.test.js
git commit -m "test(inspector): unit tests for carved-out object-settings components"
```

---

## Task 30: Docs + memory

**Files:**
- Modify: `CLAUDE.md` (the "Key Files" table + the "Adding a new object type" note)
- Create: `C:\Users\Kadirhan\.claude\projects\D--PYTHON-Manim-Editor\memory\properties-panel-decomposed.md`
- Modify: `C:\Users\Kadirhan\.claude\projects\D--PYTHON-Manim-Editor\memory\MEMORY.md`

- [ ] **Step 1: Update `CLAUDE.md`**

In the "Key Files" table, change the `Inspector.vue`/`PropertiesPanel.vue` rows to reflect
the new layout. Add a row:
```
| `services/web/src/components/inspector/PropertiesPanel.vue` | **Thin orchestrator** — `KeyframePanel` + 4-way switch over `panels/{Object,Clip,CameraClip,Canvas}Inspector.vue` |
| `services/web/src/components/inspector/object-settings/*.vue` + `index.js` | Per-object-type settings components; `settingsComponentFor(type)` registry. **New object type → one component + one registry line** |
| `services/web/src/components/inspector/ui/*.vue` | Shared inspector atoms: `Section`, `Num`, `ColorRow` |
```
In the "Adding a new object type" note (Object Types section), change "the **inspector**
(`PropertiesPanel.vue`)" to "the **inspector** (a `<Type>Settings.vue` in
`inspector/object-settings/` + one `index.js` registry entry; cross-cutting controls live
in `EffectsSection.vue`/`TextSettings.vue`)".

- [ ] **Step 2: Write the memory file**

```markdown
---
name: properties-panel-decomposed
description: Inspector split into ui/ atoms + panels/ + object-settings/ registry; new object inspector goes in object-settings/
metadata:
  type: project
---

`PropertiesPanel.vue` is a thin orchestrator (~35 lines): `KeyframePanel` + a 4-way switch
over `panels/{Object,Clip,CameraClip,Canvas}Inspector.vue`. Per-object-type settings live in
`services/web/src/components/inspector/object-settings/<Type>Settings.vue`, registered in
`object-settings/index.js` via `settingsComponentFor(type)`. Cross-cutting object controls are
`EffectsSection.vue` / `TextSettings.vue` / `MotionPicker.vue`. Shared atoms (`Section`/`Num`/
`ColorRow`) are in `inspector/ui/`; generic field updates use `useObjectUpdate.js`.

**Adding a new object type's inspector:** add one `<Type>Settings.vue` + one `index.js` line —
do NOT grow a panel. Mirrors [[stagecanvas-decomposed]] (the `configs/*.js` split).
Guarded by `tests/components/inspector/properties-panel.characterization.test.js`.
```

- [ ] **Step 3: Add the `MEMORY.md` pointer**

Append under the index:
```
- [PropertiesPanel decomposed](properties-panel-decomposed.md) — inspector split into ui/ + panels/ + object-settings/ registry; new object inspector goes in object-settings/
```

- [ ] **Step 4: Commit (code/docs only; memory dir is outside the repo)**

```bash
git add CLAUDE.md
git commit -m "docs: reflect PropertiesPanel decomposition in CLAUDE.md"
```

---

## Self-review notes (already applied)

- **Spec coverage:** ui atoms (T2), four panels (T3–T6), registry (T10) + all ~20 types
  (T11–T28), EffectsSection/TextSettings/MotionPicker (T7–T9), characterization-first (T1),
  per-component tests (T29), docs/memory (T30). ClipInspector stays inline (T5) per spec
  non-goal. Topbar/Timeline untouched.
- **Type consistency:** `settingsComponentFor(type)` defined in T10, used in T10 + T29; prop
  name `obj` everywhere; `useObjectUpdate(getObj)` signature stable across T2/T6/T7/G-shape.
- **Verbatim moves** keep markup (and `data-test` hooks) byte-identical, so the T1 snapshot
  and all existing `mount(PropertiesPanel)` inspector tests are the regression guard at every
  step.
