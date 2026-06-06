# PropertiesPanel.vue Decomposition — Design

**Date:** 2026-06-06
**Status:** Approved (design), pending spec review → implementation planning
**Scope:** Break the `services/web/src/components/inspector/PropertiesPanel.vue` monolith
(1267 lines: ~960 template + ~245 `<script setup>` + ~60 style) into shared UI atoms,
four branch panels, and a per-type settings **registry**, leaving a thin orchestrator SFC.
**Base branch:** branch off `main`.
**Predecessor:** mirrors `2026-06-06-stagecanvas-split-design.md` (the StageCanvas split).

## Problem

`PropertiesPanel.vue` is now the single largest source file (1267 lines) and a
high-churn one: **every new object type bolts on another
`<Section v-if="obj.type === 'x'">` block** here (currently ~20 type-specific
sections). It has **no unit tests**. It mixes four unrelated inspectors plus a pile
of cross-cutting concerns in one `<script setup>`:

- Four top-level branches: object (~680 template lines — the bulk), clip (~130),
  camera-clip (~35), nothing-selected/canvas (~90)
- ~20 per-object-type settings sections (dot_grid, star, polygon, polygon_free,
  annulus, arc/sector, parametric, vector_field, table, matrix, brace, angle,
  counter, graph, latex, polar_plane, numberplane/complex_plane, axes range + axes
  function-graphs)
- Two cross-cutting object sections: Effects (gradient/round/shadow/dash/opacity)
  and Text (content/style)
- A DiGraph vertex/edge editor + an axes function-graph (area/Riemann) editor
- Three inline mini-components (`Section`/`Num`/`ColorRow`) redefined in-script
- A pile of update wrappers (`u`/`uSize`/`uRange`/`uc`/`up`/`uca`/`uStage`) and
  branch-specific presentation computeds (`typeBadge`/`clipBadge`/`enterAnimDesc`…)

## Goal

One clear responsibility per file. `PropertiesPanel.vue` becomes a thin orchestrator
that renders `KeyframePanel` + exactly one of four branch panels. The object branch
hosts a **type→component registry** so a new object type adds **one file + one
registry line** (exactly like `configs/*.js` did for the canvas), instead of growing
this file. Output is **behaviorally identical** — guarded by a characterization
snapshot + new per-component unit tests.

## Non-Goals

- No visual/UX change. The inspector renders identically (characterization snapshot
  locks this).
- No change to object/clip data models, the store, or codegen.
- `ClipInspector` keeps its per-clip-type sections inline (it is **not** given a
  sub-registry). The clip side is low-churn — new clip types are rare — so a registry
  there is YAGNI for this pass.
- `Topbar.vue` (949 lines) and `Timeline.vue` are separate follow-up specs.
- `CanvasInspector` keeps the background/grid/snap/stage/groups/object-list sections
  inline (low-churn, "nothing selected" panel).

## Architecture

### 1. Shared UI atoms → `inspector/ui/`

The three in-script mini-components become real SFCs, API-identical:

- `Section.vue` — `props: ['label']`, default slot.
- `Num.vue` — `props: { label, value, min, max, step }`, `emits: ['input']`
  (emits `Number(...)` on `change`).
- `ColorRow.vue` — `props: ['label', 'value']`, `emits: ['input']`.

Every extracted component imports these. This is a prerequisite step.

### 2. Four branch panels → `inspector/panels/`

| Component | Branch | Reads |
|---|---|---|
| `ObjectInspector.vue` | `store.selectedObject` truthy | common frame + registry slot |
| `ClipInspector.vue` | `store.selectedClip` truthy | per-clip-type sections inline |
| `CameraClipInspector.vue` | selected id in `cameraTrack` | target/zoom/timing/easing |
| `CanvasInspector.vue` | nothing selected | bg/grid/snap/stage/groups/object-list |

Each panel reads the store directly (so it is independently mountable/testable).
`PropertiesPanel.vue` only decides which to show:

```vue
<template>
  <aside ...>
    <KeyframePanel />
    <ObjectInspector v-if="obj" />
    <ClipInspector v-else-if="clip" />
    <CameraClipInspector v-else-if="cameraClip" />
    <CanvasInspector v-else />
  </aside>
</template>
```

Branch-specific presentation computeds move with their branch: `typeLabel`/
`typeBadge`/`enterAnimDesc`/`exitAnimDesc`/`objGroup`/`effectiveSize` →
`ObjectInspector`; `clipBadge` → `ClipInspector`.

### 3. Per-type settings registry → `inspector/object-settings/`

Each type-specific block becomes a small SFC taking an `:obj` prop and calling store
actions. `index.js` exposes the registry:

```js
// inspector/object-settings/index.js
import DotGridSettings from './DotGridSettings.vue';
// …
const REGISTRY = {
  dot_grid: DotGridSettings,
  star: StarSettings,
  polygon: PolygonSettings,
  polygon_free: PolygonFreeSettings,
  annulus: AnnulusSettings,
  arc: ArcSectorSettings,    sector: ArcSectorSettings,
  parametric: ParametricSettings,
  vector_field: VectorFieldSettings,
  table: TableSettings,
  matrix: MatrixSettings,
  brace: BraceSettings,
  angle: AngleSettings,
  counter: CounterSettings,
  graph: GraphSettings,
  latex: LatexSettings,
  polar_plane: PolarPlaneSettings,
  numberplane: PlaneRangeSettings, complex_plane: PlaneRangeSettings,
  axes: AxesSettings,
};
export function settingsComponentFor(type) { return REGISTRY[type] || null; }
```

`ObjectInspector` slots it in at the position the per-type block occupies today
(between the Timeline-presence section and Z-Order):

```vue
<component :is="settingsComponentFor(obj.type)" v-if="settingsComponentFor(obj.type)" :obj="obj" />
```

Components grouped by shared UI (not one-per-type dogmatically):
- `ArcSectorSettings` handles `arc` + `sector` (shared radius/start/sweep grid, label
  switches on type).
- `PlaneRangeSettings` handles `numberplane` + `complex_plane` (shared X/Y range grid,
  label switches on type).
- `AxesSettings` handles `axes` — both the range grid **and** the function-graph
  editor (`addGraph`/`updateGraph`/area/Riemann), since those are axes-only.
- `GraphSettings` handles `graph` — the DiGraph vertex/edge editor (owns its local
  `newEdgeFrom`/`newEdgeTo` refs).

The two cross-cutting object sections also become components but are rendered
unconditionally by `ObjectInspector` (not via the type registry), gated by their
existing `canX`/type checks:
- `EffectsSection.vue` — gradient/rounded/shadow/fill-opacity/stroke-opacity/dash;
  owns the `GRADIENT_TYPES`/`DASH_TYPES`/`ROUND_TYPES`/`SHADOW_TYPES` sets +
  `canGradient`/`canDash`/`canRound`/`canShadow` + the gradient/dash helper fns.
- `TextSettings.vue` — text content + style (rendered when `obj.type === 'text'`).
- `MotionPicker.vue` — the "Add Motion" section (move/scale/fade/rotate + emphasis
  buttons + counter Count), owning the `anim(type)` helper and `store.createCount()`.

`Position & Size` stays inline in `ObjectInspector` (it is the common position frame,
type-aware only in which fields it shows — not a per-type settings block).

### 4. Generic update helper → `inspector/useObjectUpdate.js`

A tiny composable factored out of the current `u`/`uSize`/`uRange` wrappers, taking a
getter for the active object:

```js
export function useObjectUpdate(getObj) {
  const store = useProjectStore();
  const u = (k, v) => { const o = getObj(); if (o) store.updateObject(o.id, { [k]: v }); };
  const uSize = (v) => { const o = getObj(); if (o) store.updateObject(o.id, { width: v, height: v }); };
  const uRange = (prop, idx, v) => { /* existing array-copy logic */ };
  return { u, uSize, uRange };
}
```

Settings components that update generic fields (DotGrid, Star, Polygon, Annulus,
ArcSector, Parametric, PlaneRange, AxesSettings range) use it. Components that already
call dedicated store actions (`setTableCell`, `setMatrixCell`, `setFieldExpr`,
`setRelationalLabel`, `setCounterValue`, graph actions…) call them directly — unchanged.

## Resulting file layout

```
inspector/
  PropertiesPanel.vue          # ~35 lines: KeyframePanel + 4-way switch
  useObjectUpdate.js
  ui/
    Section.vue  Num.vue  ColorRow.vue
  panels/
    ObjectInspector.vue        # common frame + <component :is> registry slot
    ClipInspector.vue          # per-clip-type sections inline (no sub-registry)
    CameraClipInspector.vue
    CanvasInspector.vue
  object-settings/
    index.js                   # settingsComponentFor(type)
    DotGridSettings.vue  StarSettings.vue  PolygonSettings.vue
    PolygonFreeSettings.vue  AnnulusSettings.vue  ArcSectorSettings.vue
    ParametricSettings.vue  VectorFieldSettings.vue  TableSettings.vue
    MatrixSettings.vue  BraceSettings.vue  AngleSettings.vue
    CounterSettings.vue  GraphSettings.vue  LatexSettings.vue
    PolarPlaneSettings.vue  PlaneRangeSettings.vue  AxesSettings.vue
    EffectsSection.vue  TextSettings.vue  MotionPicker.vue
```

(Existing `KeyframePanel.vue`, `Position3DPanel.vue`, `Scene3DPanel.vue`,
`AudioPanel.vue`, `FontSelector.vue` stay where they are.)

## Testing

Mirrors the StageCanvas split's characterization-first approach.

1. **Characterization snapshot (baseline, before any extraction).**
   `tests/components/inspector/properties-panel.characterization.test.js`: for each
   selection state (object of every type, each clip type, camera clip, nothing
   selected) mount `PropertiesPanel` with a representative store and snapshot
   `wrapper.html()`. Captured against the current monolith, kept **green** through
   every extraction step — this is the behavioral-identity guard.
2. **Per-component unit tests (added during/after extraction).** Each settings
   component + `EffectsSection`/`TextSettings`/`MotionPicker`: mount with a fake obj +
   Pinia, assert it renders the expected inputs and that interactions call the right
   store action with the right args. Closes the "no unit tests" gap.

`data-test` hooks already present in the template (`gradient-toggle`, `corner-radius`,
`shadow-toggle`, `matrix-cell`, `table-cell`, `rel-label`, `angle-right`,
`graph-area-toggle`, `anim-*`, `preset-parallelogram`, `emph-scale-factor`) are
preserved verbatim so existing `Inspector`/object tests keep passing.

## Work order (leaf→root, green at every step)

1. **Characterization baseline** — write the snapshot test against the current
   monolith; commit. (Safety net first.)
2. **UI atoms** — extract `Section`/`Num`/`ColorRow` to `ui/`; replace the in-script
   defs (PropertiesPanel still one file). Snapshot green.
3. **Branch panels (smallest first)** — `CanvasInspector` → `CameraClipInspector` →
   `ClipInspector` → `ObjectInspector`. After each, PropertiesPanel shrinks; snapshot
   green.
4. **Object cross-cutting sections** — extract `EffectsSection`, `TextSettings`,
   `MotionPicker` from `ObjectInspector`. Green.
5. **Per-type registry** — add `object-settings/index.js`; extract each settings
   component one at a time, wiring `<component :is>`. Green after each.
6. **Per-component unit tests** — add focused tests for each new component.
7. **Docs/memory** — update `CLAUDE.md` "Key Files" (PropertiesPanel is no longer the
   place to add an object type's inspector — point to `object-settings/` + the
   registry) and add a memory pointer (mirrors the `stagecanvas-decomposed` memory).

## Verification

- `cd services/web && npm run test:unit` (unit + new inspector tests) and
  `npm test` (engine) both pass at every commit.
- The characterization snapshot is unchanged from the baseline commit through the
  final commit (any intentional diff must be explained, but the goal is zero diff).
- `npm run build` succeeds — watch the Vue 3 `<template v-for>` key gotcha noted in
  `CLAUDE.md` if any new keyed loops move between files.

## Known constraints / accepted divergences

- Snapshot tests are coupled to markup; large unrelated Tailwind-class churn would
  noise them. Mitigation: extractions move markup verbatim — no restyling in this pass.
- `<component :is>` in the registry means the per-type section is mounted/unmounted on
  selection-type change (today it is `v-if`-toggled). Behaviorally equivalent; local
  component state (e.g. `GraphSettings` edge-picker refs) resets on
  selection change, which already happens today via the `watch(selectedObjectIds)`.
