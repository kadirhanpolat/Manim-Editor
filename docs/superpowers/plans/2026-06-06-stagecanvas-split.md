# StageCanvas.vue Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 2052-line `services/web/src/components/stage/StageCanvas.vue` monolith into pure `(obj, ctx)` config modules + Vue composables + a thin orchestrator, with behavior pinned by characterization snapshots and unit tests.

**Architecture:** The ~50 per-object Konva config builders move into pure JS modules under `components/stage/configs/` — each function takes `(obj, ctx)` where `ctx` bundles every reactive value/helper it used to close over. The reactive/stateful concerns (viewport, interaction, path-draw, assets) move into composables under `components/stage/composables/`. `StageCanvas.vue` keeps its template, wires the composables, builds one reactive `ctx`, and exposes thin template-compat wrappers so `:config="rectCfg(obj)"` call sites stay unchanged.

**Tech Stack:** Vue 3 `<script setup>`, vue-konva, Pinia, Vite, Vitest (`tests/**/*.test.js`, jsdom).

**Reference — spec:** `docs/superpowers/specs/2026-06-06-stagecanvas-split-design.md`

---

## Pre-flight facts (do not re-derive)

- `StageCanvas.vue`: template lines 1–309, `<script setup>` 312–2052, no `<style>`.
- Vitest glob is `tests/**/*.test.js` (in `services/web/vitest.config.js`); **all tests live under `services/web/tests/`** — a co-located `__tests__/` would NOT be collected.
- In jsdom, `container.value.clientWidth` is 0, so the live component's `vs/ox/oy` are degenerate. **Do not** characterize by mounting the component. Characterize the **pure modules** with a hand-built deterministic `ctx` (below) and Vitest snapshots.
- The extraction is a **verbatim move**: copy each function body unchanged, then replace its free references to reactive state (`vs`, `ox`, `oy`, `s2c`, `c2s`, `eff`, `eff3d`, `live`, `applyEffects`, `hexToRgba`, `stg`, `themeAccent`, `themeSurface`, `imageElements`, `frameState`, `is3D`, `cam3d`, `iso`, `proj3DScale`, `projCx`, `projCy`, `measureTextWidth`) with `ctx.` members. `.value` is dropped because `ctx` holds resolved values, not refs (e.g. `vs.value` → `ctx.vs`, `s2c(...)` → `ctx.s2c(...)`, `eff(obj)` → `ctx.eff(obj)`, `stg.value.width` → `ctx.stg.width`).
- Existing green baseline to preserve: `npm run test:unit` 341, `npm test` 114, `npm --workspace packages/manim-codegen test` 6, `npm run build` succeeds.

## The `ctx` contract (`configs/context.js`)

```js
// services/web/src/components/stage/configs/context.js
/**
 * StageCtx — the single bridge between the reactive SFC and the pure config builders.
 * Every field is a *resolved value* (not a ref). The orchestrator rebuilds this object
 * reactively (inside a computed) so builders always see current values.
 *
 * @typedef {Object} StageCtx
 * @property {{width:number,height:number,backgroundColor?:string}} stg  project.stage
 * @property {number} vs                 canvas scale
 * @property {number} ox                 canvas x offset
 * @property {number} oy                 canvas y offset
 * @property {(sx:number,sy:number)=>{x:number,y:number}} s2c  stage→canvas
 * @property {(cx:number,cy:number)=>{x:number,y:number}} c2s  canvas→stage
 * @property {(obj:object)=>object} eff          object merged with live frame overrides
 * @property {(obj:object)=>{x3d:number,y3d:number,z3d:number}} eff3d
 * @property {(obj:object)=>(object|null)} live   live drag transform for obj, or null
 * @property {(cfg:object,obj:object,w:number,h:number,centered:boolean)=>void} applyEffects
 * @property {(h:string,a:number)=>string} hexToRgba
 * @property {string} themeAccent
 * @property {string} themeSurface
 * @property {Record<string,HTMLImageElement>} imageElements
 * @property {object} frameState                 store.frameState
 * @property {boolean} is3D
 * @property {{phi:number,theta:number,zoom:number,mode:string,focalDistance:number}} cam3d
 * @property {number} proj3DScale
 * @property {number} projCx
 * @property {number} projCy
 * @property {(x3d:number,y3d:number,z3d:number,cx:number,cy:number,scale:number)=>{px:number,py:number}} iso
 * @property {(text:string,fontSize:number,fontFamily:string,fontStyle:string)=>number} measureTextWidth
 */
export const CTX_KEYS = [
  'stg','vs','ox','oy','s2c','c2s','eff','eff3d','live','applyEffects','hexToRgba',
  'themeAccent','themeSurface','imageElements','frameState','is3D','cam3d',
  'proj3DScale','projCx','projCy','iso','measureTextWidth',
];
```

## Module map (functions → file → current source lines)

| Target file | Functions (current `StageCanvas.vue` lines) |
|---|---|
| `configs/shapes2d.js` | rectCfg 883, circleCfg 891, ellipseCfg 898, dotCfg 905, heartCfg 909, triangleCfg 930, polygonFreeCfg 937, parametricCfg 948, starCfg 975, polygonCfg 983, lineCfg 990, arrowCfg 996, annulusCfg 1003, sectorCfg 1011, arcCfg 1019, doubleArrowCfg 1029 |
| `configs/text.js` | textCfg 1037, measureTextWidth 1061, counterText 1069, counterCfg 1075, latexBgCfg 1123, latexTextCfg 1129, latexBadgeCfg 1134 |
| `configs/dataObjects.js` | groupCfg 1090, dotGridDots 1096, dotGridHitCfg 1102, imageCfg 1110, matrixHitCfg 1140, matrixCellConfigs 1147, matrixBracketConfigs 1166, tableHitCfg 1185, tableCellConfigs 1191, tableGridLines 1232, polarCircleConfigs 1259, polarSpokeConfigs 1273, graphHitCfg 1366, graphEdgeConfigs 1370, graphVertexConfigs 1393, graphLabelConfigs 1404, vectorFieldHitCfg 1416, _compileField2 1420, vectorFieldArrows 1435 |
| `configs/relational.js` | relationalHitCfg 1289, relationalLabelCfg 1294, braceLineCfg 1299, braceLabelAnchor 1310, angleRayCfgs 1319, angleArcCfg 1328, angleSquareCfg 1344, angleLabelAnchor 1355 |
| `configs/axes.js` | axesBgCfg 1477, axesXLineCfg 1483, axesYLineCfg 1487, axesXArrowCfg 1491, axesYArrowCfg 1496, axesXTicks 1501, axesYTicks 1514, axesLabelCfg 1527, axesGraphCurves 1754, axesAreaRiemann 1792 |
| `configs/objects3d.js` | _basis3d 1840, shade 1844, _rel 1854, _circlePts 1860, _flat 1868, _hull 1870, sphere3dCfg 1881, cube3dFaces 1902, obj3dCenter 1932, round3dParts 1940, torus3dTube 1965, torusOutline 1990, axes3dLines 2004 |
| `configs/overlays.js` | morphCfg 1535 (+ `emphasisOverlays` 702 and `path3dPolylines` 726 logic refactored to `(objects, ctx)` builders) |
| `configs/chrome.js` | _clipSeg 435, _axCfg 456, _gridCfg 460, _lblCfg 464, isoRect 452, refAxesIso 469, refLabelsIso 478, floorGridIso 487, bgConfig 498, gridLines 510, centerH 523, centerV 527 (as `(ctx)` builders), VIEW/REF constants 429–431 |
| `composables/useStageViewport.js` | containerWidth/Height 338, panOffset 340, zoomLevel 341, vs 374, ox 381, oy 386, stageConfig 392, is3D 394, VIEW_ANGLES 396, cam3d 404, proj3DScale 421, projCx 422, projCy 423, iso 326, isoRef 332, s2c 682, c2s 683, getCssVar 673, themeAccent 507, themeSurface 508, updateSize 676, unprojectView 1644, _r3 1643, startPan 2038, handleWheel 2044 |
| `composables/useStageInteractions.js` | liveTransform 346, shiftKey 345, polygonHandles 565, onVertexDrag 589, onVertexDragEnd 603, groupBounds 607, _isGroupType 1751, handleStageMouseDown 1561, onObjDown 1611, onDragEnd 1617, onDrag3DEnd 1667, onTransform 1675, onTransformEnd 1698, onTextDblClick 2019, onStageDblClick 1550, updateTransformer 2022, trConfig 532 |
| `composables/useStagePathDraw.js` | pathDrawing 347, pathPoints 348, pathSourceId 349, pathCanvasPoints 543, pathPreviewLineCfg 554, startPathDraw 1544, path3dPolylines 726 |
| `composables/useStageAssets.js` | imageElements 342, isDraggingOver 343, fontLoadKey 344, loadNewImages 750, loadNewFonts 764, onDragOver 784, onDragLeave 788, onDrop 791 |

> Some functions are needed by more than one consumer (e.g. `unprojectView` is owned by the viewport composable but used by `onDrag3DEnd` in interactions; `iso` is owned by viewport but used by `objects3d`/`overlays`/`path-draw`). The owner exports it; consumers receive it as a dep (composable arg) or via `ctx` (builders).

---

## Task 0: Characterization fixtures + scaffold

**Files:**
- Create: `services/web/tests/components/stage/fixtures.js`
- Create: `services/web/tests/components/stage/stage-configs.characterization.test.js`

- [ ] **Step 1: Build the deterministic fixtures + ctx**

Create `services/web/tests/components/stage/fixtures.js`:

```js
// Deterministic inputs for characterizing the pure config builders.
// A fixed ctx (no component mount) makes every builder output reproducible.

export const STAGE = { width: 1920, height: 1080, backgroundColor: '#000000' };

// Resolved-value ctx: vs/ox/oy fixed; helpers are simple pure stand-ins matching
// the SFC's math so builder output is realistic and stable.
export function makeCtx(overrides = {}) {
  const vs = 0.4, ox = 100, oy = 50;
  const s2c = (sx, sy) => ({ x: ox + sx * vs, y: oy + sy * vs });
  const c2s = (cx, cy) => ({ x: (cx - ox) / vs, y: (cy - oy) / vs });
  return {
    stg: { ...STAGE },
    vs, ox, oy, s2c, c2s,
    eff: (obj) => obj,                         // no live overrides in the fixture
    eff3d: (obj) => ({ x3d: obj.x3d ?? 0, y3d: obj.y3d ?? 0, z3d: obj.z3d ?? 0 }),
    live: () => null,
    applyEffects: () => {},                    // identity (effect application tested separately)
    hexToRgba: (h, a) => `rgba(${h},${a})`,
    themeAccent: '#4CEEF9', themeSurface: '#E6EDF3',
    imageElements: {},
    frameState: { objectOverrides: {}, hiddenIds: new Set() },
    is3D: false,
    cam3d: { phi: 75, theta: -45, zoom: 1, mode: 'perspective', focalDistance: 8 },
    proj3DScale: 60, projCx: 484, projCy: 266,
    iso: (x, y, z, cx, cy, s) => ({ px: cx + (x - z) * s * 0.5, py: cy - y * s }),
    measureTextWidth: (t) => (t ? String(t).length * 10 : 0),
    ...overrides,
  };
}

// One representative object per supported type. Keep ids stable.
export const OBJECTS = {
  rectangle: { id: 'rect1', type: 'rectangle', x: 960, y: 540, width: 200, height: 120, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0 },
  circle:    { id: 'circ1', type: 'circle', x: 960, y: 540, width: 160, height: 160, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0 },
  // ... one entry per type the target module covers; each task adds the entries it needs.
};
```

> As each extraction task lands, it ADDS the object entries it needs to `OBJECTS` (one per type in that module). Keep entries minimal but exercising the type's key fields (e.g. a `rectangle` with `cornerRadius`, an `axes` with a `graphs[]` entry incl. `area`).

- [ ] **Step 2: Create the characterization test scaffold (no modules yet → skipped)**

Create `services/web/tests/components/stage/stage-configs.characterization.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { makeCtx, OBJECTS } from './fixtures.js';

// Each extraction task appends a block here that snapshots its module's builders.
// Vitest writes/commits the snapshot on first run; later drift fails the test.
describe('stage config characterization', () => {
  it('fixtures load', () => {
    expect(makeCtx()).toBeTruthy();
    expect(Object.keys(OBJECTS).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run + commit**

Run: `cd services/web && npx vitest run tests/components/stage/stage-configs.characterization.test.js`
Expected: 1 passed.

```bash
git add services/web/tests/components/stage/
git commit -m "test(stage): characterization fixtures + scaffold for StageCanvas split"
```

---

## Task 1: Extract `configs/shapes2d.js` (establish the pattern)

**Files:**
- Create: `services/web/src/components/stage/configs/context.js`
- Create: `services/web/src/components/stage/configs/shapes2d.js`
- Modify: `services/web/src/components/stage/StageCanvas.vue`
- Modify: `services/web/tests/components/stage/fixtures.js`, `stage-configs.characterization.test.js`

- [ ] **Step 1: Create `configs/context.js`** with the `CTX_KEYS` + typedef shown in “The ctx contract” above (copy verbatim).

- [ ] **Step 2: Create `configs/shapes2d.js`** by moving the 16 shape builders (lines 883–1036) **verbatim**, then:
  - add `import { stageToManim } from '../../../export/manim.js';` only if a moved body uses it (check; `parametricCfg` may). Otherwise no imports.
  - change each signature `function rectCfg(obj)` → `export function rectCfg(obj, ctx)`.
  - apply the ctx-substitution rule (Pre-flight): `vs.value`→`ctx.vs`, `s2c(`→`ctx.s2c(`, `c2s(`→`ctx.c2s(`, `eff(`→`ctx.eff(`, `live(`→`ctx.live(`, `applyEffects(`→`ctx.applyEffects(`, `hexToRgba(`→`ctx.hexToRgba(`, `stg.value`→`ctx.stg`, `themeAccent.value`→`ctx.themeAccent`, etc. Verify no bare `vs`/`ox`/`oy`/`s2c`/`eff`/`stg`/`applyEffects` remain (grep the new file for `\bvs\b`, `\bstg\b`, `\beff\(` — all must be `ctx.`).

- [ ] **Step 3: Wire `StageCanvas.vue` — build `ctx` + template-compat wrappers**

Add near the other computeds (after `oy`/helpers exist):

```js
import * as shapes2d from './configs/shapes2d.js';

const ctx = computed(() => ({
  stg: stg.value, vs: vs.value, ox: ox.value, oy: oy.value, s2c, c2s,
  eff, eff3d, live, applyEffects, hexToRgba,
  themeAccent: themeAccent.value, themeSurface: themeSurface.value,
  imageElements, frameState: frameState.value, is3D: is3D.value, cam3d: cam3d.value,
  proj3DScale: proj3DScale.value, projCx: projCx.value, projCy: projCy.value,
  iso, measureTextWidth,
}));
// template-compat: keep `:config="rectCfg(obj)"` working
const rectCfg = (o) => shapes2d.rectCfg(o, ctx.value);
const circleCfg = (o) => shapes2d.circleCfg(o, ctx.value);
const ellipseCfg = (o) => shapes2d.ellipseCfg(o, ctx.value);
const dotCfg = (o) => shapes2d.dotCfg(o, ctx.value);
const heartCfg = (o) => shapes2d.heartCfg(o, ctx.value);
const triangleCfg = (o) => shapes2d.triangleCfg(o, ctx.value);
const polygonFreeCfg = (o) => shapes2d.polygonFreeCfg(o, ctx.value);
const parametricCfg = (o) => shapes2d.parametricCfg(o, ctx.value);
const starCfg = (o) => shapes2d.starCfg(o, ctx.value);
const polygonCfg = (o) => shapes2d.polygonCfg(o, ctx.value);
const lineCfg = (o) => shapes2d.lineCfg(o, ctx.value);
const arrowCfg = (o) => shapes2d.arrowCfg(o, ctx.value);
const annulusCfg = (o) => shapes2d.annulusCfg(o, ctx.value);
const sectorCfg = (o) => shapes2d.sectorCfg(o, ctx.value);
const arcCfg = (o) => shapes2d.arcCfg(o, ctx.value);
const doubleArrowCfg = (o) => shapes2d.doubleArrowCfg(o, ctx.value);
```

Then DELETE the original 16 builder definitions (lines 883–1036) from `StageCanvas.vue`. `measureTextWidth`, `eff`, `applyEffects`, etc. stay (still used by other not-yet-moved builders + the ctx). The template is unchanged.

- [ ] **Step 4: Characterize shapes2d** — add to `fixtures.js` `OBJECTS` one entry per shape type (rectangle incl. `cornerRadius`, square, circle, ellipse, dot, heart, triangle, polygon, polygon_free, star, line, arrow, annulus, sector, arc, double_arrow, parametric). Append to the characterization test:

```js
import * as shapes2d from '../../../src/components/stage/configs/shapes2d.js';
describe('shapes2d', () => {
  const ctx = makeCtx();
  for (const [type, fn] of Object.entries({
    rectangle: shapes2d.rectCfg, square: shapes2d.rectCfg, circle: shapes2d.circleCfg,
    ellipse: shapes2d.ellipseCfg, dot: shapes2d.dotCfg, heart: shapes2d.heartCfg,
    triangle: shapes2d.triangleCfg, polygon: shapes2d.polygonCfg, polygon_free: shapes2d.polygonFreeCfg,
    star: shapes2d.starCfg, line: shapes2d.lineCfg, arrow: shapes2d.arrowCfg,
    annulus: shapes2d.annulusCfg, sector: shapes2d.sectorCfg, arc: shapes2d.arcCfg,
    double_arrow: shapes2d.doubleArrowCfg, parametric: shapes2d.parametricCfg,
  })) {
    it(`${type} config is stable`, () => {
      expect(fn(OBJECTS[type], ctx)).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 5: Run suites + build**

Run: `cd services/web && npx vitest run tests/components/stage/` → snapshots written, all pass.
Run: `cd services/web && npm run test:unit` → 341+ passed (new stage tests included).
Run: `cd services/web && npm run build` → succeeds.

- [ ] **Step 6: Manual render check** — `docker compose up -d web-dev` (or `npm run dev`), open the canvas, confirm 2D shapes render identically. (Required gate; automated tests can't fully cover Konva rendering.)

- [ ] **Step 7: Commit**

```bash
git add services/web/src/components/stage/configs/ services/web/src/components/stage/StageCanvas.vue services/web/tests/components/stage/
git commit -m "refactor(stage): extract configs/shapes2d.js (obj, ctx) + characterization"
```

---

## Tasks 2–7: remaining config modules

Each task repeats the **Task 1 pattern** for one module: create `configs/<module>.js` by moving the listed functions (Module map ranges) verbatim with the ctx-substitution rule; add `import * as <module>` + template-compat wrappers in `StageCanvas.vue`; delete the originals; add fixture entries + a characterization `describe` block; run `vitest run tests/components/stage/` + `npm run test:unit` + `npm run build`; manual render check; commit.

- [ ] **Task 2 — `configs/text.js`** (textCfg, measureTextWidth, counterText, counterCfg, latexBgCfg, latexTextCfg, latexBadgeCfg). `measureTextWidth` becomes an exported pure fn here AND is referenced by `ctx.measureTextWidth`; the orchestrator’s `ctx` `measureTextWidth` now points to `text.measureTextWidth` (a plain fn, no ctx needed). Wrappers: `textCfg`, `counterCfg`, `latexBgCfg`, `latexTextCfg`, `latexBadgeCfg` (counterText/measureTextWidth are internal). Commit: `refactor(stage): extract configs/text.js`.

- [ ] **Task 3 — `configs/dataObjects.js`** (groupCfg, dotGridDots, dotGridHitCfg, imageCfg, matrix*, table*, polar*, graph*, vectorField*, _compileField2). `imageCfg` uses `ctx.imageElements`. `_compileField2`/`vectorFieldArrows` use `isSafeExpr`/`compileExpr` from `../../engine/mathExpr.js` — re-import in the module. Add fixture entries for group, dot_grid, image, matrix, table, polar_plane, complex_plane, graph, vector_field. Commit: `refactor(stage): extract configs/dataObjects.js`.

- [ ] **Task 4 — `configs/relational.js`** (relationalHitCfg, relationalLabelCfg, braceLineCfg, braceLabelAnchor, angleRayCfgs, angleArcCfg, angleSquareCfg, angleLabelAnchor). Fixtures: brace, angle. Commit: `refactor(stage): extract configs/relational.js`.

- [ ] **Task 5 — `configs/axes.js`** (axesBgCfg, axesXLineCfg, axesYLineCfg, axesXArrowCfg, axesYArrowCfg, axesXTicks, axesYTicks, axesLabelCfg, axesGraphCurves, axesAreaRiemann). `axesGraphCurves`/`axesAreaRiemann` use `safeMathExpr`/`compileExpr` — re-import from `../../engine/mathExpr.js` and keep the whitelist regex identical (per the security note in CLAUDE.md). Fixture: an `axes` with `graphs:[{expression, area:{enabled}, riemann:{enabled}}]`. Commit: `refactor(stage): extract configs/axes.js`.

- [ ] **Task 6 — `configs/objects3d.js`** (_basis3d, shade, _rel, _circlePts, _flat, _hull, sphere3dCfg, cube3dFaces, obj3dCenter, round3dParts, torus3dTube, torusOutline, axes3dLines). These use `ctx.iso`, `ctx.eff3d`, `ctx.proj3DScale/projCx/projCy`, `ctx.cam3d`. Fixtures: sphere, cube, cone, cylinder, torus, axes3d, with `makeCtx({ is3D: true })`. Commit: `refactor(stage): extract configs/objects3d.js`.

- [ ] **Task 7 — `configs/overlays.js` + `configs/chrome.js`**. `overlays.js`: `morphCfg(m, ctx)` plus `emphasisOverlays(objects, ctx)` and `path3dPolylines(tracks, ctx)` refactored from the computeds (lines 702, 726) into pure builders taking the collection + ctx; the SFC computeds become `computed(() => overlays.emphasisOverlays(objects.value, ctx.value))`. `chrome.js`: `bgConfig(ctx)`, `gridLines(ctx)`, `centerH(ctx)`, `centerV(ctx)`, `refAxesIso(ctx)`, `refLabelsIso(ctx)`, `floorGridIso(ctx)` + internal `_clipSeg/_axCfg/_gridCfg/_lblCfg/isoRect` + REF constants; SFC computeds delegate. Commit: `refactor(stage): extract configs/overlays.js + chrome.js`.

---

## Task 8: `composables/useStageViewport.js`

**Files:**
- Create: `services/web/src/components/stage/composables/useStageViewport.js`
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Create the composable.** Move (verbatim) the viewport state + computeds + helpers (Module map: useStageViewport rows). Signature:

```js
import { ref, computed } from 'vue';
import { project3D, unprojectIso } from '../../../engine/projection3d.js';  // iso/isoRef + unproject use this today
export function useStageViewport(store, container) {
  const containerWidth = ref(800), containerHeight = ref(500);
  const panOffset = ref({ x: 0, y: 0 });
  const zoomLevel = ref(1);
  // ... vs, ox, oy, stg, is3D, VIEW_ANGLES, cam3d, proj3DScale, projCx, projCy,
  //     iso, isoRef, s2c, c2s, getCssVar, themeAccent, themeSurface, updateSize,
  //     unprojectView, _r3, startPan, handleWheel — moved verbatim, refs used directly.
  return { containerWidth, containerHeight, panOffset, zoomLevel, vs, ox, oy,
           stageConfig, stg, is3D, cam3d, proj3DScale, projCx, projCy, iso, isoRef,
           s2c, c2s, themeAccent, themeSurface, updateSize, unprojectView,
           startPan, handleWheel };
}
```

> Check the actual `iso`/`isoRef`/`unprojectView` bodies (lines 326/332/1644) for their real imports (`project3D`/`unprojectIso`) and copy those imports. `stg` is `computed(() => store.project.stage)`.

- [ ] **Step 2: Wire in `StageCanvas.vue`** — replace the moved declarations with:

```js
const vp = useStageViewport(store, container);
const { containerWidth, containerHeight, panOffset, zoomLevel, vs, ox, oy, stageConfig,
        stg, is3D, cam3d, proj3DScale, projCx, projCy, iso, isoRef, s2c, c2s,
        themeAccent, themeSurface, updateSize, unprojectView, startPan, handleWheel } = vp;
```

Keep `ctx` (Task 1) referencing these (now from `vp`). Delete the original declarations.

- [ ] **Step 3:** Run `npm run test:unit` (341+), `npm run build`, manual render + pan/zoom check. Commit `refactor(stage): extract composables/useStageViewport.js`.

---

## Task 9: `composables/useStageInteractions.js`

**Files:**
- Create: `services/web/src/components/stage/composables/useStageInteractions.js`
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Create the composable.** Move (verbatim) interaction state + handlers (Module map: useStageInteractions rows). Signature takes the deps these handlers close over:

```js
import { ref, computed } from 'vue';
export function useStageInteractions(store, { konvaStage, objectsLayer, transformer, container,
  vs, ox, oy, s2c, c2s, unprojectView, eff, sortedObjects, selectedObjectIds }) {
  const liveTransform = ref(null);
  const shiftKey = ref(false);
  // polygonHandles, onVertexDrag, onVertexDragEnd, groupBounds, _isGroupType,
  // handleStageMouseDown, onObjDown, onDragEnd, onDrag3DEnd, onTransform,
  // onTransformEnd, onTextDblClick, onStageDblClick, updateTransformer, trConfig
  // — moved verbatim; closure refs (vs/ox/oy/s2c/c2s/unprojectView/eff) come from args.
  return { liveTransform, shiftKey, polygonHandles, onVertexDrag, onVertexDragEnd,
           groupBounds, handleStageMouseDown, onObjDown, onDragEnd, onDrag3DEnd,
           onTransform, onTransformEnd, onTextDblClick, onStageDblClick,
           updateTransformer, trConfig };
}
```

> `liveTransform` is read by `ctx.live`; after this task, the SFC's `live` closure reads `inter.liveTransform.value`. `trConfig` (line 532) may instead stay with chrome — keep it wherever it currently reads `selectedObjectIds`/transformer; if it needs interaction state, return it here. Resolve by reading the actual body.

- [ ] **Step 2: Wire in `StageCanvas.vue`**, destructure the returned handlers (template uses them by name), delete originals. Run `npm run test:unit`, `npm run build`, manual check: select/drag/transform/vertex-drag/3D-drag. Commit `refactor(stage): extract composables/useStageInteractions.js`.

---

## Task 10: `composables/useStagePathDraw.js` + `composables/useStageAssets.js`

**Files:**
- Create: `services/web/src/components/stage/composables/useStagePathDraw.js`
- Create: `services/web/src/components/stage/composables/useStageAssets.js`
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: `useStagePathDraw(store, { s2c, c2s, iso, projCx, projCy, proj3DScale, is3D })`** — move pathDrawing/pathPoints/pathSourceId/pathCanvasPoints/pathPreviewLineCfg/startPathDraw/path3dPolylines (verbatim, deps from args). Return them all. `startPathDraw` stays in `defineExpose`.

- [ ] **Step 2: `useStageAssets(store, { objects, objectsLayer })`** — move imageElements/isDraggingOver/fontLoadKey/loadNewImages/loadNewFonts/onDragOver/onDragLeave/onDrop (verbatim). `imageElements` feeds `ctx.imageElements`; `fontLoadKey` is used by the template `:key`. Return them.

- [ ] **Step 3: Wire both in `StageCanvas.vue`**, destructure, delete originals, keep `defineExpose({ startPathDraw })`. Run `npm run test:unit`, `npm run build`, manual check: drag-drop add, font load, path draw (double-click). Commit `refactor(stage): extract path-draw + assets composables`.

---

## Task 11: Thin orchestrator + final verification

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Tidy the orchestrator.** Confirm `<script setup>` now contains only: imports, `store`, Konva refs (`container`, `konvaStage`, `objectsLayer`, `transformer`), the three composable wirings, `objects`/`sortedObjects`/`selectedObjectIds`/`gridVisible`/`frameState`/`morphShapes` computeds, `eff`/`eff3d`/`live`/`applyEffects`/`hexToRgba`/`isVis` (the ctx helpers that remain local), the `ctx` computed, the template-compat wrapper consts, lifecycle (`onMounted`/`onBeforeUnmount` with ResizeObserver + key listeners), watchers (lines 643/647), and `defineExpose`. Anything else should already live in a module/composable.

- [ ] **Step 2: Decide where `eff`/`applyEffects`/`hexToRgba` live.** They are pure-ish but read `frameState`/`liveTransform`. Keep them in the SFC (they build `ctx`) OR move `applyEffects`/`hexToRgba` into `configs/effects.js` as pure fns (they take only `(cfg,obj,...)`/`(h,a)`) and import them; `eff`/`eff3d`/`live` stay in the SFC (they read reactive frameState/liveTransform). If moved, add `effects.js` characterization. (Pick the move — `applyEffects`/`hexToRgba` are pure and large.)

- [ ] **Step 3: Full verification.**

Run: `cd services/web && npm run test:unit` → all pass.
Run: `cd services/web && npm test` → 114 pass.
Run: `cd /d/PYTHON/Manim-Editor && npm --workspace packages/manim-codegen test` → 6 pass.
Run: `cd services/web && npm run build` → succeeds.
Run: `wc -l services/web/src/components/stage/StageCanvas.vue` → confirm ~350–450 lines.
Manual: full canvas smoke — every object type renders; 3D split; camera preview; drag/transform; path draw; drag-drop; emphasis overlay.

- [ ] **Step 4: Remove any temporary scaffolding** (e.g. baseline `defineExpose` if one was added) and commit `refactor(stage): StageCanvas.vue is a thin orchestrator (final)`.

---

## Self-Review (completed during planning)

- **Spec coverage:** configs/ (Tasks 1–7), composables/ (8–10), thin orchestrator (11), ctx contract (Task 1 + context.js), characterization snapshot + unit tests (Task 0 + each task), phasing matches the spec’s 7 phases. ✅
- **Verification adaptation:** spec said "capture current outputs then compare"; the plan characterizes the **pure modules** with a deterministic `ctx` + Vitest snapshots (jsdom makes live-component `vs/ox/oy` degenerate). Same intent (pin behavior, catch drift), more robust — noted in Pre-flight + Task 0. Behavior-preservation also rests on the verbatim-move rule + per-phase `npm run build` + manual render gate.
- **Type consistency:** every builder is `fn(obj, ctx)`; composables are `useX(store, deps)` returning named APIs; `ctx` keys match `CTX_KEYS`; template-compat wrapper names equal the original function names so the template is untouched. ✅
- **No placeholders:** ctx contract, Task 0 fixtures/scaffold, and the Task 1 binding pattern are shown in full; Tasks 2–11 specify exact functions + source line ranges to move verbatim (the "code" of a move-refactor) + module-specific imports + commit messages.
