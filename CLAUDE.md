# Manim Motion Editor — Claude Code Instructions

## Project Overview

Browser-based Figma-like animation editor for Manim CE. 5 Docker services: Vue 3 + Konva.js frontend (Nginx :8080), Node.js/Express API (:3000), Python Manim CE renderer worker, Python audio TTS worker, Redis 7 job queue. Shared Docker volume at `/data`.

```
services/web/        # Vue 3 frontend (Vite, Vitest)
services/api/        # Node.js/Express API + Manim codegen
services/renderer/   # Python Manim worker (polls Redis) + manim-voiceover
services/audio/      # Python TTS worker (gTTS; Coqui via --profile coqui)
packages/manim-codegen/  # Shared Manim Python codegen (single source of truth)
```

## Running

```bash
docker compose up --build              # all services
cd services/web && npm run dev         # frontend only → http://localhost:5173
cd services/api && npm run dev         # API only
docker compose --profile coqui up      # + Coqui TTS service
```

## Testing

```bash
cd services/web && npm run test:unit   # 515 unit tests (store, components, export)
cd services/web && npm test            # 114 engine tests (easing, geometry, transform, keyframe)
# Both must pass before any commit.

cd e2e && npm install && npx playwright install chromium   # first time only
cd e2e && npm test                     # 9 Playwright smoke tests (auto-boots dev server :5188)
```

- `e2e/` is a **standalone package OUTSIDE the npm workspaces** (own `node_modules` so Playwright never perturbs web/api hoisting). Drives the real app via a DEV-only `window.__projectStore` hook (`services/web/src/main.js`, stripped from prod). Dedicated port **5188**.
- **`jsdom` must stay in the ROOT `package.json` devDependencies** so the root-hoisted `vitest` resolves it; otherwise a clean `npm install` breaks `test:unit`.
- Test boilerplate: `setActivePinia(createPinia())` → `store = useProjectStore()` → `store.newProject('Test','visual')` → `store.commitState()` in `beforeEach`. Test files in `services/web/tests/components/*.test.js`.
- **Codegen Python-validity** (`tests/components/codegen-python-validity.test.js`): generates a script for every object/clip/keyframe/audio/camera combo and asserts valid Python via `python -m ast`. **Requires `python` on PATH; self-skips otherwise.**

## Key Files

| File | Purpose |
|------|---------|
| `services/web/src/store/project.js` | Pinia store — all project state, actions, getters (`useProjectStore()`); exports `uid()` |
| `services/web/src/engine/playback.js` | 60fps rAF playback engine — evaluates clips, computes frame state |
| `packages/manim-codegen/src/` | **Single source of truth for codegen** — `constants.js`, `helpers.js`, `objects.js`, `objects3d.js`, `clips.js`, `keyframes.js`, `index.js` (`generateScene`) |
| `services/api/src/compiler/codegen.js` | Thin server wrapper over `@manim/codegen` (server asset paths via `resolveAsset`) |
| `services/web/src/export/manim.js` | Thin client generator wrapper + the web-only `.py` **parser** (`parseManimScript`) |
| `services/web/src/components/stage/StageCanvas.vue` | Thin orchestrator (~544 lines) — wires the 4 stage composables + builds `ctx`; renders all object types via config builders |
| `services/web/src/components/stage/configs/*.js` | **Pure** Konva config builders `fn(obj, ctx)` (unit-tested): `context.js` (ctx contract), `shapes2d`, `text`, `dataObjects`, `relational`, `axes`, `objects3d`, `overlays`, `chrome`, `effects` |
| `services/web/src/components/stage/composables/*.js` | `useStageViewport` (vs/ox/oy, 3D projection, pan/zoom, s2c/c2s, iso), `useStageInteractions` (drag/transform/select), `useStagePathDraw`, `useStageAssets` |
| `services/web/src/components/inspector/PropertiesPanel.vue` | Thin orchestrator (~40 lines) — `KeyframePanel` + 4-way switch over `panels/{Object,Clip,CameraClip,Canvas}Inspector.vue` |
| `services/web/src/components/inspector/object-settings/*.vue` + `index.js` | Per-object-type settings + `settingsComponentFor(type)` registry. Cross-cutting: `EffectsSection`, `TextSettings`, `MotionPicker` |
| `services/web/src/components/inspector/ui/*.vue` + `useObjectUpdate.js` | Shared atoms (`Section`, `Num`, `ColorRow`) + `u`/`uSize`/`uRange` field-update composable |
| `services/web/src/components/inspector/{Position3DPanel,AudioPanel,KeyframePanel}.vue` | 3D pos/rot editor; per-clip audio; selected-keyframe editor |
| `services/web/src/components/topbar/{Topbar,MenuBar,NewProjectDialog}.vue` + `menus.js` | Menubar orchestrator + reusable dropdown widget + new-project modal. **Menu items live in `menus.js`** (`buildMenus(ctx)`). |
| `services/web/src/components/timeline/Timeline.vue` + `KeyframeLanesPanel/KeyframeLane/KeyframeEasingPopup.vue` | Multi-track timeline + camera track + per-property keyframe lanes + Bezier easing editor |
| `services/web/src/engine/keyframe.js` | `interpolateKeyframes`, `getKeyframeRange`, Bezier solver |
| `services/api/src/routes/audio.js` + `services/api/src/ws.js` | Audio upload/TTS/callback/delete endpoints; WebSocket push for render+audio events |
| `services/audio/worker.py` | gTTS / Coqui TTS Redis consumer; POSTs completion to API |

## Codegen — single source of truth (`@manim/codegen`)

All Manim Python generation lives in the **`@manim/codegen`** npm-workspace package (`packages/manim-codegen/src/`): `constants.js` (EASING_MAP, FRAME_*, *_TYPES), `helpers.js` (`vn`, `hex`, `safe*`, `gradientLine`, `shadowLines`, …), `objects.js` (`objectCode`), `objects3d.js` (`objectCode3d`), `clips.js` (`transformExpr`, `emphasisExpr`), `keyframes.js` (`generateKeyframeSteps`), `index.js` (`generateScene`).

Both services are **thin wrappers** calling `generateScene(project, { resolveAsset })` — the only intentional divergence is `resolveAsset` (server file path vs client placeholder). The **`.py` parser** (`parseManimScript`) is web-only, in `manim.js`.

**Adding a new object/clip type → edit the package once + the `manim.js` parser for round-trip.** Emit constructors on **one line** so the regex parser can read them back.

### Parity invariants (regression-guarded)

The codegen test suite asserts the generated Python is stable. When touching codegen, keep these consistent and re-run `manim-export.test.js`, `effects-codegen.test.js`, `phase26-effects-codegen.test.js`:
- Generator helpers that historically had byte-identical copies (`emphasisExpr`, `transformExpr`, the `count`/`counter`/`matrix`/`brace`/`angle`/`table`/`graph`/`vector_field` cases, `safeMatrixEntry`, `safeLatex`, `fillOpacityExpr`, `strokeOpacityArg`, `gradientLine`, `dashedLines`, `shadowLines`, `roundCornersLine`, `SHADOW_TYPES`) now live **once** in `@manim/codegen`; the parity/round-trip tests remain as regression guards.
- The math whitelist exists in two places that must stay in sync: `safeMathExpr` (`@manim/codegen/helpers.js`, used by codegen) and `engine/mathExpr.js` `isSafeExpr`/`compileExpr` (preview). Whitelist:
  ```js
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(expr)) return 'x**2';
  if (/import|eval|exec|open|__/.test(expr)) return 'x**2';
  ```

## Coordinate Systems

- **Project coords**: 0–1920 (x), 0–1080 (y), origin top-left.
- **Manim coords**: `stageToManim(px, py, sw, sh)` → ≈ −7..+7 (x), −4..+4 (y).
- **Canvas coords**: `c2s(cx, cy)` / `s2c(px, py)` in StageCanvas — account for pan (`ox`, `oy`) and zoom (`vs`).
- **3D coords**: `obj.x3d/y3d/z3d` are direct Manim units (NOT through `stageToManim`). `iso()`/`top()` project 3D→2D for canvas.
- **Constants** (shared in `@manim/codegen/constants.js`, so server+client emit identical coords): `FRAME_WIDTH = 14 + 2/9` (14.222), `FRAME_HEIGHT = 8`, `FRAME_X_RADIUS = 7.111`, `FRAME_Y_RADIUS = 4`. Positions + scale-based shape spacing use `FRAME_WIDTH`; radius values (heart `mw`, Dot radius) use `FRAME_X_RADIUS`, heart `mh` uses `FRAME_Y_RADIUS`.

## Store Patterns

```js
import { useProjectStore, uid } from '../store/project.js';
const store = useProjectStore();

obj.newProp = value;     // Vue 3 reactivity — direct assignment, no Vue.set
store.commitState();     // after any undoable mutation
store.isDirty = true;    // mark unsaved changes

store.computedDuration   // getter = property (no parens)
store.hasPendingAudio    // getter = property
store.objectById(id)     // factory getter = called as function
```

## Clip Types

All clips: `id, type, startTime, duration, easing, parallel, lag_ratio`. `parallel: true` clips at the same `startTime` → `AnimationGroup` / `LaggedStart`.

- **Persistent target**: `transform` (optional `matchTerms: true` → `TransformMatchingTex`/`TransformMatchingShapes` via `transformExpr`; raster→`FadeTransform`; default→`ReplacementTransform`), `move`, `scale`, `fade`, `rotate`, `path_move`, `camera_move`.
- **Emphasis (transient, there-and-back)**: `indicate`, `flash`, `wiggle`, `circumscribe`, `focus_on` — via `emphasisExpr(c, sn)` (`Indicate`/`Flash`/`Wiggle`/`Circumscribe`/`FocusOn`). `color` via `hex()`, `rotation_angle` in degrees → `<deg> * DEGREES`, `shape` as bare class, `fade_out` as Python bool. Playback approximates the pulse; Circumscribe writes `overrides._emphasis` for an overlay box/ellipse.
- **`count`**: `{ type:'count', objectId, from, to, duration, easing }`. Emits a 4-line `ValueTracker` block with a `_count_<clipid>` prefix (distinct from keyframe `_vt_<obj>_<prop>`). Skipped (`null`) in `animExpr` so it's never in a parallel group. Parsed via the `pendingCount` branch.

Clips may carry optional `audio`:
```js
clip.audio = {
  type: 'file'|'gtts'|'coqui', src: '/data/assets/audio/<id>.wav',
  text: '…', lang: 'tr',              // TTS only; BCP-47, default 'tr'
  syncMode: 'auto'|'manual', offset: 0,
  status: 'pending'|'ready'|'error', duration: 2.5,
}
```
`syncMode:'auto'` → on `ready`, `clip.duration = audio.duration`. `status:'ready'` clips generate `with self.voiceover(audio=…) as tracker:` blocks.

## Object Types

> **Adding a new object type** touches: generator (`@manim/codegen` once + `manim.js` parser), **canvas preview** (a `fn(obj, ctx)` builder in the matching `configs/*.js` + a one-line `<template>` branch + compat wrapper in `StageCanvas.vue` + a snapshot in `tests/components/stage/`), **store** (`project.js` defaults/actions), **inspector** (one `<Type>Settings.vue` in `object-settings/` + one `index.js` registry line; cross-cutting controls in `EffectsSection.vue`/`TextSettings.vue`), **palette** (a card in `components/sidebar/AssetSidebar.vue`'s `shapes`/`shapesData`/`shapes3D` array — the **only** live add UI; `Toolbar.vue` was removed). `tests/components/ui-tools-audit.test.js` fails if a registered type has no palette card.

**2D:** `rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`, `heart`, `dot`, `dot_grid`, `text`, `image`, `svg_asset`, `latex`, `axes`, `numberplane`, `numberline`, `annulus`, `arc`, `sector`, `double_arrow`, `polygon_free`, `parametric`, `matrix`, `brace`, `angle`, `counter`, `table`, `complex_plane`, `polar_plane`, `graph`, `vector_field`, `vector_components`, `ray`, `coord_point`, `bezier`

**3D** (only when `sceneType === '3d'`): `sphere`, `cube`, `cone`, `cylinder`, `torus`, `axes3d`, `surface`, `prism`

### Per-type notes

- **`axes`**: `graphs: []` array, each `{ id, expression, color, xMin, xMax, strokeWidth }`. Each graph also has optional `area` (`get_area`), `riemann` (`get_riemann_rectangles`), `tangent` (`TangentLine`, alpha from `x`).
- **Geometry**: `annulus`/`arc`/`sector`/`double_arrow` → `Annulus`/`Arc`/`Sector`/`DoubleArrow`; radii in px (via `FRAME_WIDTH`), angles in deg → `<deg> * DEGREES`.
- **`polygon_free`** (`Polygon`): `obj.vertices` (object-relative px) + draggable canvas handles; presets in `engine/polygonVertices.js`.
- **`bezier`**: smooth open curve through draggable anchor `vertices`. Emits `VMobject()` + `set_points_smoothly([…])` + `set_stroke`. **Parser builds from the `set_points_smoothly` line, not `VMobject()`** (shared with `path_move` path).
- **`parametric`** (`ParametricFunction`): `xExpr`/`yExpr` (t-based), `tMin`/`tMax`; `safeMathExpr`-guarded.
- **`matrix`** (`Matrix`): source of truth `matrixData` (2D string array) + `bracket` (`[`|`(`|`|`); rows/cols derived. Single-line `Matrix([[…]])` (+ `left/right_bracket` for non-default) then `.set_color`. Entries sanitized by `safeMatrixEntry` (no eval). Actions: `setMatrixCell`, `add/removeMatrixRow/Column`, `setMatrixBracket` (guards at 1×1).
- **`brace`** (`BraceBetweenPoints`): `p1`/`p2` (object-relative px), `label`. Labeled → `VGroup(_brace, _brace.get_tex(…))`.
- **`angle`** (`Angle`/`RightAngle`): `vertex`/`point1`/`point2`, `rightAngle`, `radius`, `label`. Emitted via two helper `Line`s (`_l1`/`_l2`); parser captures them into `relLineMap`. Labels use `get_tex(…)` with `safeLatex` (non-raw, doubled-backslash). Both brace+angle: draggable point handles reuse `polygonHandles` (`kind:'relational'`).
- **`counter`** (`DecimalNumber`/`Integer`): `value`, `numDecimals`, `suffix`, `useInteger`. Emits `DecimalNumber(<v>, num_decimal_places=<d>[, unit="<s>"])`, or `Integer(<trunc v>[, unit])` when `useInteger`. `unit=` only when suffix non-empty. `value` keyframable (`set_value`). Actions: `setCounterValue/Decimals/Suffix/Integer`.
- **`table`** (`Table`/`MathTable`): `cellData`, `mathMode`, `rowLabels`/`colLabels`. Math mode emits `MathTable(…, row_labels=[MathTex(…)], col_labels=[…])` (labels omitted when empty). Reuses `safeMatrixEntry` + matrix grid editor. Actions: `setTableCell`, `add/removeTableRow/Column`, `setTableMathMode/RowLabels/ColLabels`.
- **`complex_plane`** / **`polar_plane`**: mirror `numberplane`; `xRange`/`yRange` + `width`/`height` → `x_length`/`y_length`. `polar_plane` → `PolarPlane(radius_max, radius_step, azimuth_units, size)` (`size = min(w,h)/sw*FRAME_WIDTH`). Actions: `setPolarRadiusMax/Step` (clamp ≥0.1), `setPolarAzimuth`.
- **`graph`** (`Graph`/`DiGraph`): `vertices` (string[]), `edges` ([[a,b]]), `positions` ({label:[px,py]}), `directed`, `showLabels`. Manual layout px→Manim. `labels=True` only when `showLabels`. Actions: `add/removeGraphVertex`, `add/removeGraphEdge`, `renameGraphVertex`, `setGraphVertexPosition/Directed/ShowLabels`.
- **`vector_field`** (`ArrowVectorField`): `fx`/`fy` (expr, `safeMathExpr`; fallback `'y'`/`'-x'`), `xRange`/`yRange`. Double-lambda single-line form. Actions: `setFieldExpr`, `setFieldRange`. **Known limit**: top-level comma exprs (e.g. `max(x,y)`) don't round-trip.
- **`vector_components`** (composite): `VGroup` of main `Arrow` + x/y component arrows + 2 `DashedLine` guides. Fields `vx`/`vy` (px tip; vy<0 = up). Round-trips via `vcPending`. Inspector `VectorComponentsSettings.vue`.
- **`coord_point`** (composite, dynamic): `Dot` + `always_redraw` live `(x,y)` MathTex label. Field `decimals`. Emits `VGroup(Dot, always_redraw(lambda: MathTex(f"(…)").next_to(…)))`. Round-trips via `coordPending`.
- **3D `prism`** (`Prism`): `dimX`/`dimY`/`dimZ` (Manim units) → `Prism(dimensions=[…])`. Preview shares `boxFaces` with cube.
- **3D `surface`** (z=f(x,y)): `zExpr` (`safeMathExpr`), `xRange`/`yRange` (=u/v range). Emits `Surface(lambda x,y: np.array([x,y,<zExpr>]), u_range, v_range, resolution)`. Preview = iso wireframe (render = filled surface). Registered in `obj3DTypes`, store `is3D`, `Position3DPanel`.
- **3D common fields**: `x3d/y3d/z3d` (pos), `rx/ry/rz` (rot deg), `resolution`, `sideLength` (cube), `radius` (sphere/cone/cylinder/torus), `height` (cone/cylinder), `majorRadius/minorRadius` (torus), `xRange/yRange/zRange` (axes3d).
- `matrix`/`table`/`brace`/`angle`/`counter`/`graph`/`vector_field`/`vector_components` are in **neither** `GRADIENT_TYPES` nor `DASH_TYPES`.

## Camera Animations

- Project-level: `cameraType: 'static'|'moving'`, `cameraTrack: []`. `camera_move` clips live in `cameraTrack`, not `tracks[]`. Delete key + inspector handled separately in `App.vue`.
- **2D**: `MovingCameraScene` + `self.camera.frame.animate.move_to().set_width(FRAME_WIDTH/zoom)`. Clip params `{x, y, zoom}`.
- **3D**: `ThreeDScene` + `self.move_camera(phi=… * DEGREES, theta=…, zoom=…, run_time=…)`. Clip params `{phi, theta, zoom}` (deg), stored in `project.camera3d`.

## Audio / Voiceover

- **Flow**: `AudioPanel` → `POST /api/audio/tts` → Redis `audio:queue:gtts` → `worker.py` → WAV to `/data/assets/audio/` → `POST /api/audio/:jobId/complete` → `broadcastAudioEvent` WS → `actions.setClipAudio`.
- **File upload** skips the queue: `POST /api/audio/upload` (ffprobe duration) → `{ src, duration, status:'ready' }`.
- **Codegen priority**: `MovingCameraScene` > `VoiceoverScene` > `Scene`. 3D: `is3D && hasReadyAudio → 'ThreeDScene, VoiceoverScene'` > `is3D → 'ThreeDScene'` > 2D chain.
- **Render lock**: `store.hasPendingAudio` disables render in `App.vue`, `RenderPanel.vue`, `Topbar.vue`.
- **Coqui** (optional): `docker compose --profile coqui up`; `audio-coqui` handles `audio:queue:coqui`.

## Keyframe Animation System

Objects carry three optional fields (absent until first keyframe):
```js
obj.keyframes      = { x: [{ time, value, easing:{type,handles?} }, …], opacity: […] }
obj.keyframeMode   = { x: 'override'|'additive'|'opt-in' }
obj.keyframeCodegen= { x: 'UpdateFromAlphaFunc'|'animate'|'ValueTracker' }
// project defaults: store.project.keyframeDefaults = { mode:'opt-in', codegenMode:'UpdateFromAlphaFunc' }
// state: store.selectedKeyframeId = { objId, prop, time } | null
```

Store actions (all call `commitState()`): `addKeyframe(objId,prop,time,value)` (upsert within 0.01s, sorted), `removeKeyframe`, `updateKeyframeValue`, `updateKeyframeEasing`, `setKeyframeMode`, `setKeyframeCodegen`, `selectKeyframe`. `KeyframeLane` drag mutates state directly; one `commitState()` on mouseup.

**Playback** (`computeFrame` per-property): clip blending → `clipValue` → `_applyKeyframeOverrides` (reads `keyframes`+mode) → `_applyEnterExitAnims`. Modes: `opt-in` applies only within `[getKeyframeRange.start,.end]`; `override` → `overrides[prop]=kfValue`; `additive` → `clipValue+kfValue`.

**Codegen** (`generateKeyframeSteps` in `@manim/codegen/keyframes.js`, runs before camera clips): `UpdateFromAlphaFunc` (default, `def _kf_<obj>_<prop>_<i>_fn(mob,alpha)` + `self.play(UpdateFromAlphaFunc(…))`), `animate` (sequential `obj.animate.set_x(…)`), `ValueTracker` (`_vt` + `add_updater` + `clear_updaters`). ValueTracker/UpdateFromAlphaFunc skip props where `_kfUpdater(prop)` is null. `counter.value` keyframable via `set_value`.

**3D position keyframes**: keyframed `x3d/y3d/z3d` merge into **one** `move_to([x,y,z])` per segment (last-known value per axis), regardless of each axis's `keyframeCodegen` mode (no 3D setter exists for the other modes).

## 2D Object Effects

Optional fields; absent ⇒ byte-identical legacy output. Delete the field on null/0 to preserve legacy output.
- `gradient {colors[], angle}` → `set_color_by_gradient`; `cornerRadius` → `RoundedRectangle` (rect/square) or `.round_corners()` (polygon/triangle/star); `fillOpacity`/`strokeOpacity` → `set_fill/stroke` (master × channel); `dash {numDashes, ratio}` → fill-preserving `VGroup(base, DashedVMobject(_dash_src, …))`.
- `shadow {color, opacity, dx, dy, blur}` → `_shadow_<n> = <n>.copy().set_color().set_opacity().shift([dxm,dym,0])` + `<n> = VGroup(_shadow_<n>, <n>)` (shadow behind; `dym` screen-down → Manim −y). `blur` is preview-only.
- **Two "round" sets**: inspector `ROUND_TYPES`/`canRound` = `{rectangle,square,polygon,triangle,star}` (which show the control); codegen `roundCornersLine` emits `.round_corners()` only for `{polygon,triangle,star}`.
- **Effect order** in the post-construction block: round_corners → gradient → dashed → shadow → move_to.
- Actions: `setGradient`, `setCornerRadius`, `setDash`, `setShadow`. Preview in `configs/effects.js` `applyEffects()` (via `ctx.applyEffects`); inspector "Effects" section gates by type (`canGradient`/`canDash`/`canRound`).
- Preview-only divergences: gradient **angle** (Manim orients by point order), dashed+fill (preview single shape vs render VGroup), shadow blur. **Glow dropped** (Manim CE has no true blur).

## Text & Math Animation extras

- **Typewriter presets**: `enterAnim:'typewriter'` → `AddTextLetterByLetter`, `exitAnim:'typewriter_out'` → `RemoveTextLetterByLetter` (round-trip via enter/exit anim parsers).
- Tex term-matching morph shows a generic crossfade in preview (Manim does real term alignment); typewriter timing is approximate in preview.

## 3D Scene Support

```js
store.project.sceneType = '2d' | '3d'                              // default '2d'
store.project.camera3d  = { phi:75, theta:-45, zoom:1.0, projection:'orthographic'|'perspective', focalDistance:8 }
// projection + focalDistance are PREVIEW-ONLY (do not affect codegen)
```
- Actions: `setSceneType(type)`, `setCamera3d(params)` (both `commitState()`).
- **Split viewport** when `3d`: left iso (`iso(x3d,y3d,z3d,…)`), right top/XZ (`top(x3d,z3d,…)`). Drag updates `x3d/z3d`.
- **Preview projection** (`engine/projection3d.js`, pure/testable): `project3D` + `unprojectIso`, ortho + perspective (Manim Z-up spherical camera). `StageCanvas.iso()` delegates via a `cam3d` computed. `playback.computeFrame` lerps 3D `camera_move` (`{phi,theta,zoom}`, detected by `'phi' in params`) into `cameraState{is3d:true}`; `setCamera3dBase` seeds the resting angle. Projection mode editable in `Scene3DPanel.vue`.
- **Known constraint**: projection mode is preview-only — perspective preview diverges slightly from render; perspective iso drag uses the ortho inverse (minor imprecision at extreme angles).
- Design spec: `docs/superpowers/specs/2026-06-03-3d-scene-design.md`.

## Stack Notes (history)

- **Vue 3 + Pinia**: migration complete (Options API → `<script setup>`, `Vue.observable`/`Vue.set` → Pinia/direct assignment, `@vue/test-utils@2`, `@vue/compat` removed). Spec: `docs/superpowers/specs/2026-06-03-vue3-migration-design.md`.

## Build / Environment Gotchas

- **Vue 3 `<template v-for>` keys** must sit on the `<template>` tag, not child elements — a pure prod build (`npm run build`) errors otherwise. Watch in `MenuBar.vue` / `StageCanvas.vue`.
- **Renderer `setuptools<81` pin**: `manimcommunity/manim:stable` ships setuptools 82 (no `pkg_resources`), but `manim-voiceover` imports it at load and crashes the `manim` CLI. Pinned in `services/renderer/Dockerfile`.
- **`api_node_modules` named volume**: after adding an api dependency, `docker volume rm manim_motion_api_node_modules` before `docker compose up` — named volumes don't refresh on rebuild and shadow new packages (`ERR_MODULE_NOT_FOUND`).
