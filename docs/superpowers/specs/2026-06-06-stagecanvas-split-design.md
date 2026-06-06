# StageCanvas.vue Decomposition — Design

**Date:** 2026-06-06
**Status:** Approved (design), pending spec review → implementation planning
**Scope:** Break the `services/web/src/components/stage/StageCanvas.vue` monolith
(2052 lines: 309 template + ~1740 `<script setup>`) into pure config modules + Vue
composables, leaving a thin orchestrator SFC.
**Base branch:** branch off `main`.

## Problem

`StageCanvas.vue` is the single largest source file (2052 lines) and the highest-churn
one: every new object/clip type adds a Konva config builder + template branch here.
It has **no unit tests**. It mixes ~8 distinct concerns in one `<script setup>`:

- ~50 per-object Konva **config builders** (mostly pure: `obj → config object`)
- 3D object rendering (sphere/cube/torus/cone/cylinder/axes3d + math helpers)
- viewport/coordinate math (`vs`/`ox`/`oy`, 3D projection, `s2c`/`c2s`, `iso`, unproject)
- interaction (mousedown/drag/transform/3D-drag/vertex-drag, selection, transformer)
- stage chrome (background, grid, center lines, transformer, 3D reference axes)
- path drawing (state + preview + 3D polylines)
- emphasis/morph overlays
- asset/font loading + drag-and-drop

## Goal

One clear responsibility per file. The pure config builders become Vue-independent,
unit-testable modules; the reactive/stateful concerns become focused composables;
`StageCanvas.vue` becomes a thin orchestrator that wires the composables, builds one
`ctx` object, and renders the template. Output is **behaviorally identical** — guarded
by a characterization snapshot + new unit tests.

## Non-Goals

- No visual/UX change. The canvas renders pixel-identically.
- No change to object/clip data models, the store, or codegen.
- Not splitting the **template** into sub-components (the template stays in
  `StageCanvas.vue`; only the `<script setup>` logic is extracted). Sub-componentizing
  the template was considered and deferred (YAGNI for this pass).
- No change to `Timeline.vue`, `Inspector.vue`, or other large files (separate work).

## Decisions (resolved during brainstorming)

1. **Mechanism:** pure JS modules taking `(obj, ctx)` for the config builders;
   Vue **composables** for the reactive/stateful concerns. (Chosen over Vue-internal
   composables-for-everything and over template sub-components.)
2. **Scope:** maximum — every concern is extracted; `StageCanvas.vue` ends as a thin
   orchestrator.
3. **Verification:** characterization snapshot (capture current builder outputs for a
   one-of-every-type fixture, assert the extracted modules reproduce it deep-equal) +
   permanent unit tests on the pure modules.

## Architecture

```
components/stage/
  StageCanvas.vue            # thin orchestrator: wires composables, builds ctx, template
  configs/                   # PURE builder modules — each fn (obj, ctx) → Konva config(s)
    context.js               # StageCtx contract (JSDoc) + helper to bind ctx
    shapes2d.js              # rect, square, circle, ellipse, dot, heart, triangle,
                             #   polygon, polygon_free, star, line, arrow, annulus,
                             #   sector, arc, double_arrow, parametric
    text.js                  # text, counter, latex (+ measureTextWidth, counterText)
    dataObjects.js           # matrix, table, polar_plane, complex_plane (grid),
                             #   graph, vector_field, dot_grid
    relational.js            # brace, angle (+ hit/label/ray/arc/square helpers)
    axes.js                  # axes bg/x/y line/arrow, ticks, labels, graphCurves,
                             #   areaRiemann
    objects3d.js             # sphere, cube, torus, cone, cylinder, axes3d
                             #   (+ _basis3d, shade, _rel, _circlePts, _hull,
                             #    obj3dCenter, round3dParts, torusOutline)
    overlays.js              # emphasisOverlays, morphCfg
    chrome.js                # bgConfig, gridLines, centerH/V, trConfig, ref axes/
                             #   labels/floor grid (iso reference frame)
  composables/               # REACTIVE / stateful concerns
    useStageViewport.js      # containerWidth/Height, panOffset, zoomLevel, vs/ox/oy,
                             #   stageConfig, is3D, cam3d, proj3DScale/Cx/Cy, s2c/c2s,
                             #   iso/isoRef, unprojectView, updateSize + ResizeObserver,
                             #   startPan, handleWheel
    useStageInteractions.js  # handleStageMouseDown, onObjDown, onDragEnd, onDrag3DEnd,
                             #   onTransform, onTransformEnd, onTextDblClick,
                             #   onStageDblClick, selection sync, updateTransformer,
                             #   trConfig deps, groupBounds, polygonHandles,
                             #   onVertexDrag/onVertexDragEnd, liveTransform, shiftKey
    useStagePathDraw.js      # pathDrawing, pathPoints, pathCanvasPoints,
                             #   pathPreviewLineCfg, startPathDraw, path3dPolylines
    useStageAssets.js        # imageElements, loadNewImages, loadNewFonts, fontLoadKey,
                             #   onDragOver/Leave/Drop, isDraggingOver
```

Tests live under `services/web/tests/` (the Vitest glob is `tests/**/*.test.js`, so a
co-located `__tests__/` would NOT be picked up):

```
services/web/tests/components/stage/
  stage-config-baseline.json            # committed characterization fixture
  stage-configs.characterization.test.js
  stage-configs-shapes2d.test.js        # per-module unit tests
  stage-configs-<module>.test.js
```

### The `ctx` contract (the single bridge)

Pure builders read reactive state **only** through `ctx` — no closure capture. The
orchestrator constructs `ctx` once from the viewport composable + local helpers and
passes it to every builder:

```js
ctx = {
  stg,                       // project.stage (width/height/bg/...)
  vs, ox, oy,                // canvas scale + pan offsets (numbers, from useStageViewport)
  s2c, c2s,                  // stage<->canvas coordinate transforms
  eff, eff3d, live,          // per-object live frame state (overrides) accessors
  applyEffects, hexToRgba,   // shared Konva effect helpers
  themeAccent, themeSurface, // resolved CSS theme colors
  imageElements,             // loaded HTMLImageElement cache (for image objects)
  frameState,                // store.frameState (playback)
  is3D, cam3d,               // 3D scene flag + live camera state
  proj3DScale, projCx, projCy, // 3D projection params
  measureTextWidth,          // canvas text measurement (browser API)
}
```

Each builder signature becomes `fooCfg(obj, ctx)`. To keep the template readable, the
orchestrator binds `ctx` once and exposes thin wrappers (e.g. `const rectCfg = (o) =>
shapes2d.rectCfg(o, ctx.value)`), so template call sites stay `:config="rectCfg(obj)"`.
The exact binding mechanism (per-call vs a `bindConfigs(ctx)` factory returning the
wrapper set) is a plan-level detail; either keeps the template unchanged.

### Composable contracts

Each composable is `useX(deps)` returning the refs/computeds/handlers it owns. Cross-
composable needs are passed explicitly (e.g. `useStageInteractions` needs `c2s`,
`unprojectView`, `polygonHandles` inputs from the viewport composable; `useStageAssets`
needs `objects` + `fontLoadKey` consumers). No global state; deps flow in, API flows out.
`StageCanvas.vue` owns the Konva refs (`container`, `konvaStage`, `objectsLayer`,
`transformer`) and passes them to the composables that need them.

## Verification — characterization

Because `StageCanvas.vue` has no tests, behavior is pinned with a characterization
snapshot before trusting the extraction:

1. **Baseline capture (Phase 0).** Add a temporary `defineExpose` of the cfg builders
   (or a small in-test harness that mounts `StageCanvas.vue` via `@vue/test-utils` v2
   with a Pinia store + a fixture project containing **one object of every supported
   type** and a deterministic viewport — fixed `containerWidth/Height`, `panOffset=0`,
   `zoomLevel=1`, `sceneType` cases for 2D and 3D). Capture every builder's output into
   `services/web/tests/components/stage/stage-config-baseline.json` and commit it.
2. **Equivalence assertion.** After extraction, `stage-configs.characterization.test.js`
   feeds the **same fixture project + the same deterministic `ctx`** to the extracted
   modules and asserts deep-equality with `stage-config-baseline.json`. Any drift fails.
3. **Permanent unit tests.** Per-module tests assert representative builder outputs
   (e.g. `rectCfg` honors `cornerRadius`/effects; `axesGraphCurves` whitelists exprs;
   `objects3d` projects via `ctx`), so the modules stay correct as types are added.
4. **Suite + build + visual.** Existing suites stay green (`npm run test:unit` 341,
   `npm test` 114, package 6). `npm run build` succeeds at each phase (watch the Vue 3
   `<template v-for>` key rule). At each phase end, run the app and visually confirm the
   canvas renders identically (the manual gate the automated tests can't fully cover).

The extraction is a **verbatim move**: function bodies are copied unchanged except
replacing closure references (`vs`, `s2c`, `eff`, …) with `ctx.` members. Output is
preserved by construction; the snapshot guards against mistakes.

## Phasing (one spec, sequenced plan)

Each phase ends green + committed and leaves the app working:

0. **Baseline harness + fixture** — capture `stage-config-baseline.json`.
1. **`context.js` + `shapes2d.js`** — establish the `(obj, ctx)` pattern + binding;
   characterization covers the 2D shapes; prove the approach end-to-end.
2. **Remaining config modules** — `text.js`, `dataObjects.js`, `relational.js`,
   `axes.js`, `objects3d.js`, `overlays.js`, `chrome.js` (may be split across a few
   plan tasks). Characterization grows to all types.
3. **`useStageViewport.js`** — extract viewport/coordinate/projection + pan/wheel.
4. **`useStageInteractions.js`** — extract drag/transform/selection/vertex-drag.
5. **`useStagePathDraw.js` + `useStageAssets.js`** — path draw + asset/font/DnD.
6. **Thin orchestrator + final verification** — `StageCanvas.vue` reduced to wiring +
   template; full suite + build + visual render check; remove the temporary baseline
   harness expose.

Target: `StageCanvas.vue` from 2052 → roughly ~350–450 lines (template + wiring).

## Files Touched

| File | Change |
|---|---|
| `services/web/src/components/stage/StageCanvas.vue` | reduce to thin orchestrator |
| `services/web/src/components/stage/configs/*.js` | **NEW** — 9 pure builder modules |
| `services/web/src/components/stage/composables/*.js` | **NEW** — 4 composables |
| `services/web/tests/components/stage/*` | **NEW** — baseline fixture + characterization + per-module tests (matches the `tests/**/*.test.js` Vitest glob) |

## Success Criteria

1. `StageCanvas.vue` is a thin orchestrator; each extracted file has one clear concern.
2. The characterization test confirms the extracted modules reproduce the pre-refactor
   config outputs deep-equal for one-of-every-type.
3. `npm run test:unit`, `npm test`, the package suite, and `npm run build` all pass; the
   app renders the canvas identically (visual check).
4. Adding a new object type now means: one config-module function + one template branch
   (+ store/inspector/codegen as before) — no longer editing a 2000-line file.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| No existing tests → silent visual regressions | Characterization snapshot + per-phase `npm run build` + manual render check |
| `ctx` misses a dependency a builder needs | The contract is derived from the actual closure refs; characterization fails loudly if a builder reads stale/undefined state |
| Reactivity lost when moving computeds into composables | Keep refs/computeds reactive inside composables; pass `.value` into `ctx` at call time (the orchestrator rebuilds `ctx` reactively) |
| Phase too large / unsafe in one step | Strict phasing; each phase independently green + committed; Phase 1 proves the pattern before the bulk |
| Vue 3 `<template v-for>` key build error when touching loops | Noted; `npm run build` each phase |
