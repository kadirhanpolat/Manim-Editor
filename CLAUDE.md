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
cd services/web && npm run test:unit    # 746 unit tests (store, components, export)
cd services/web && npm run test:coverage # same, with v8 coverage report
cd services/web && npm test             # 122 engine tests (easing, geometry, transform, keyframe) — runs via tsx
npm test --workspace services/api       # 55 api tests (compiler pipeline + path/scene-name/render-options safety)
npm test --workspace packages/manim-codegen  # 15 codegen tests
# All must pass before any commit.

cd e2e && npm install && npx playwright install chromium   # first time only
cd e2e && npm test                      # 17 Playwright smoke tests (auto-boots dev server :5188); also a non-blocking CI job

cd services/web && RUN_MANIM_RENDER=1 npm run test:render  # OPT-IN, real Manim CE. Two harnesses: (1) render-truth (render-integration.test.ts) — a 6-scene corpus + self-check proves generated Python RUNS, not just that it's AST-valid; (2) golden-frame regression (render-golden.test.ts) — dHashes a stable geometric corpus's last frame vs a committed baseline (tests/components/__render_baselines__/dhash.json), Hamming-tolerant (≤8/256). Re-baseline after an intentional render change: RUN_MANIM_RENDER=1 UPDATE_RENDER_BASELINE=1 npm run test:render. Skips unless RUN_MANIM_RENDER=1 + `manim` on PATH + a Pillow-capable python; needs renderer deps (manim-fonts). Manim v0.20.1. CI runs this as a non-blocking `render-harness` job. NOTE: render-truth only checks exit 0 (a frame can be blank — addObject's default FadeOut exit blanks the last frame; golden corpus sets exitAnim='none').
```

Tooling (run from repo root) — all are CI gates:
```bash
npm run lint           # ESLint (errors fail CI; warnings allowed)
npm run typecheck      # build:codegen + vue-tsc (web) + tsc (api), all strict
npm run format:check   # Prettier (covers .js/.ts/.vue/.json/.css)
```

- `e2e/` is a **standalone package OUTSIDE the npm workspaces** (own `node_modules` so Playwright never perturbs web/api hoisting). Drives the real app via a DEV-only `window.__projectStore` hook (`services/web/src/main.ts`, stripped from prod). Dedicated port **5188**.
- **`jsdom` must stay in the ROOT `package.json` devDependencies** so the root-hoisted `vitest` resolves it; otherwise a clean `npm install` breaks `test:unit`.
- Test boilerplate: `setActivePinia(createPinia())` → `store = useProjectStore()` → `store.newProject('Test','visual')` → `store.commitState()` in `beforeEach`. Test files in `services/web/tests/components/*.test.ts`.
- **Codegen Python-validity** (`tests/components/codegen-python-validity.test.ts`): generates a script for every object/clip/keyframe/audio/camera combo and asserts valid Python via `python -m ast`. **Requires `python` on PATH; self-skips otherwise.**

## Key Files

| File | Purpose |
|------|---------|
| `services/web/src/store/project.ts` | Pinia store — all project state, actions, getters (`useProjectStore()`); exports `uid()` |
| `services/web/src/engine/playback.ts` | 60fps rAF playback engine — evaluates clips, computes frame state |
| `services/web/src/engine/types.ts` | Shared engine domain types (`Point`, `StageObject`, `Clip`, `ClipParams`, `Overrides`, `FrameState`, `TimedClip`, …) |
| `packages/manim-codegen/src/` | **Single source of truth for codegen** — `constants.ts`, `helpers.ts`, `objects.ts`, `objects3d.ts`, `clips.ts`, `keyframes.ts`, `index.ts` (`generateScene`), `types.ts` |
| `services/api/src/compiler/codegen.ts` | Thin server wrapper over `@manim/codegen` (server asset paths via `resolveAsset`) |
| `services/web/src/export/manim.ts` | Thin client generator wrapper + the web-only `.py` **parser** (`parseManimScript`) |
| `services/web/src/components/stage/StageCanvas.vue` | Orchestrator (~1230 lines) — wires the 4 stage composables + builds `ctx`; renders all object types via config builders (interactive configs lock-wrapped via `L()`) |
| `services/web/src/components/stage/configs/*.ts` | **Pure** Konva config builders `fn(obj, ctx)` (unit-tested): `context.ts` (ctx contract), `shapes2d`, `text`, `dataObjects`, `relational`, `axes`, `objects3d`, `overlays`, `chrome`, `effects` |
| `services/web/src/components/stage/composables/*.ts` | `useStageViewport` (vs/ox/oy, 3D projection, pan/zoom, s2c/c2s, iso), `useStageInteractions` (drag/transform/select; `editingTextId` for inline text edit; smart snap in `onDragEnd`), `useStagePathDraw`, `useStageAssets`, `useStageRulers` (H+V ruler canvases, adaptive ticks) |
| `services/web/src/engine/snap.ts` | Pure `snapPoint(x, y, candidates, threshold)` + `stageSnapCandidates(...)` helpers — snaps to grid/center, guide lines, and object bounding-box edges; unit-tested without Konva |
| `services/web/src/components/inspector/PropertiesPanel.vue` | Thin orchestrator (~40 lines) — `KeyframePanel` + 4-way switch over `panels/{Object,Clip,CameraClip,Canvas}Inspector.vue` |
| `services/web/src/components/inspector/object-settings/*.vue` + `index.js` | Per-object-type settings + `settingsComponentFor(type)` registry. Cross-cutting: `EffectsSection`, `TextSettings`, `MotionPicker` |
| `services/web/src/components/inspector/ui/*.vue` + `useObjectUpdate.js` | Shared atoms (`Section`, `Num`, `ColorRow`) + `u`/`uSize`/`uRange` field-update composable |
| `services/web/src/components/inspector/{Position3DPanel,AudioPanel,KeyframePanel}.vue` | 3D pos/rot editor; per-clip audio; selected-keyframe editor |
| `services/web/src/components/topbar/{Topbar,MenuBar,NewProjectDialog}.vue` + `menus.js` | Menubar orchestrator + reusable dropdown widget + new-project modal. **Menu items live in `menus.js`** (`buildMenus(ctx)`). |
| `services/web/src/components/timeline/Timeline.vue` + `KeyframeLanesPanel/KeyframeLane/KeyframeEasingPopup.vue` | Multi-track timeline + camera track + per-property keyframe lanes + Bezier easing editor |
| `services/web/src/engine/keyframe.ts` | `interpolateKeyframes`, `getKeyframeRange`, Bezier solver |
| `services/api/src/routes/audio.ts` + `services/api/src/ws.ts` | Audio upload/TTS/callback/delete endpoints; WebSocket push for render+audio events |
| `services/audio/worker.py` | gTTS / Coqui TTS Redis consumer; POSTs completion to API |
| `services/web/src/components/RenderOptionsDialog.vue` + `services/renderer/render_args.py` | Render export options (format/resolution/fps) — zod allowlist in `compiler/validator.ts` (`parseRenderOptions`), fixed-dict argv mapping |
| `services/web/src/components/stage/ContextMenu.vue` | Canvas right-click menu (object + empty-canvas variants), calls store actions |

## Codegen — single source of truth (`@manim/codegen`)

All Manim Python generation lives in the **`@manim/codegen`** npm-workspace package (`packages/manim-codegen/src/`, **strict TypeScript**): `constants.ts` (EASING_MAP, FRAME_*, *_TYPES), `helpers.ts` (`vn`, `hex`, `safe*`, `gradientLine`, `shadowLines`, …), `objects.ts` (`objectCode`), `objects3d.ts` (`objectCode3d`), `clips.ts` (`transformExpr`, `emphasisExpr`), `keyframes.ts` (`generateKeyframeSteps`), `index.ts` (`generateScene`), `types.ts` (domain model). Built to `dist/` via `tsc`; web consumes the TS source (via the `source` export condition), api/renderer consume `dist/`.

Both services are **thin wrappers** calling `generateScene(project, { resolveAsset })` — the only intentional divergence is `resolveAsset` (server file path vs client placeholder). The **`.py` parser** (`parseManimScript`) is web-only, in `manim.ts`.

**Adding a new object/clip type → edit the package once + the `manim.ts` parser for round-trip.** Emit constructors on **one line** (the canonical form). The parser now also tolerates **multi-line** input: `joinLogicalLines` (in `manim.ts`, before `parseManimScript`) reflows any statement with unbalanced brackets onto one logical line before the per-line regexes run — string-aware (in-string commas/parens/quotes preserved), and a no-op on already-single-line input (so existing round-trips are byte-identical). Known limit: inline `#` comments mid-constructor.

`Project` type carries `sections?: Array<{ id: string; time: number; title: string }>` and `sceneDuration?: number` — used by `generateScene` to emit `self.next_section(…)` calls interleaved with animation steps.

### Parity invariants (regression-guarded)

The codegen test suite asserts the generated Python is stable. When touching codegen, keep these consistent and re-run `manim-export.test.ts`, `effects-codegen.test.ts`, `phase26-effects-codegen.test.ts`:
- Generator helpers that historically had byte-identical copies (`emphasisExpr`, `transformExpr`, the `count`/`counter`/`matrix`/`brace`/`angle`/`table`/`graph`/`vector_field` cases, `safeMatrixEntry`, `safeLatex`, `fillOpacityExpr`, `strokeOpacityArg`, `gradientLine`, `dashedLines`, `shadowLines`, `roundCornersLine`, `SHADOW_TYPES`) now live **once** in `@manim/codegen`; the parity/round-trip tests remain as regression guards.
- The math whitelist exists in two places that must stay in sync: `safeMathExpr` (`@manim/codegen/helpers.ts`, used by codegen) and `engine/mathExpr.ts` `isSafeExpr`/`compileExpr` (preview). Whitelist:
  ```js
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(expr)) return 'x**2';
  if (/import|eval|exec|open|__/.test(expr)) return 'x**2';
  ```

## Coordinate Systems

- **Project coords**: 0–1920 (x), 0–1080 (y), origin top-left.
- **Manim coords**: `stageToManim(px, py, sw, sh)` → ≈ −7..+7 (x), −4..+4 (y).
- **Canvas coords**: `c2s(cx, cy)` / `s2c(px, py)` in StageCanvas — account for pan (`ox`, `oy`) and zoom (`vs`).
- **3D coords**: `obj.x3d/y3d/z3d` are direct Manim units (NOT through `stageToManim`). `iso()`/`top()` project 3D→2D for canvas.
- **Constants** (shared in `@manim/codegen/constants.ts`, so server+client emit identical coords): `FRAME_WIDTH = 14 + 2/9` (14.222), `FRAME_HEIGHT = 8`, `FRAME_X_RADIUS = 7.111`, `FRAME_Y_RADIUS = 4`. Positions + scale-based shape spacing use `FRAME_WIDTH`; radius values (heart `mw`, Dot radius) use `FRAME_X_RADIUS`, heart `mh` uses `FRAME_Y_RADIUS`.

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

// Wave 2 actions
store.splitClip(clipId)                       // split at store.playbackTime; both halves inherit type/objectId
store.addSection(time, title)                 // insert sorted section marker
store.removeSection(id)
store.updateSection(id, { title?, time? })
store.addGuide(axis, pos)                     // axis: 'h'|'v', pos in project px
store.removeGuide(id)
store.moveGuide(id, pos)
store.recentColors                            // string[] (top-level store state, not project)
store.addRecentColor(hex)                     // prepends + dedupes; persisted to localStorage
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

> **Adding a new object type** touches: generator (`@manim/codegen` once + `manim.ts` parser), **canvas preview** (a `fn(obj, ctx)` builder in the matching `configs/*.ts` + a one-line `<template>` branch + compat wrapper in `StageCanvas.vue` + a snapshot in `tests/components/stage/`), **store** (`project.ts` defaults/actions), **inspector** (one `<Type>Settings.vue` in `object-settings/` + one `index.ts` registry line; cross-cutting controls in `EffectsSection.vue`/`TextSettings.vue`), **palette/search surfaces** (a card in `components/sidebar/AssetSidebar.vue`'s `shapes`/`shapesData`/`shapes3D` array + an add command in `components/command/CommandPalette.vue`; `Toolbar.vue` was removed). `tests/components/ui-tools-audit.test.ts` fails if a registered type has no palette card.

**2D:** `rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`, `heart`, `dot`, `dot_grid`, `text`, `image`, `svg_asset`, `latex`, `axes`, `numberplane`, `numberline`, `annulus`, `arc`, `sector`, `double_arrow`, `polygon_free`, `parametric`, `matrix`, `brace`, `angle`, `counter`, `table`, `complex_plane`, `polar_plane`, `graph`, `vector_field`, `vector_components`, `ray`, `coord_point`, `bezier`, `surrounding_rect`, `underline`, `cross`, `code`, `bar_chart`

**3D** (only when `sceneType === '3d'`): `sphere`, `cube`, `cone`, `cylinder`, `torus`, `axes3d`, `surface`, `prism`

### Per-type notes

- **`axes`**: `graphs: []` array, each `{ id, expression, color, xMin, xMax, strokeWidth }`. Each graph also has optional `area` (`get_area`), `riemann` (`get_riemann_rectangles`), `tangent` (`TangentLine`, alpha from `x`).
- **Geometry**: `annulus`/`arc`/`sector`/`double_arrow` → `Annulus`/`Arc`/`Sector`/`DoubleArrow`; radii in px (via `FRAME_WIDTH`), angles in deg → `<deg> * DEGREES`.
- **`polygon_free`** (`Polygon`): `obj.vertices` (object-relative px) + draggable canvas handles; presets in `engine/polygonVertices.ts`.
- **`bezier`**: smooth open curve through draggable anchor `vertices`. Emits `VMobject()` + `set_points_smoothly([…])` + `set_stroke`. **Parser builds from the `set_points_smoothly` line, not `VMobject()`** (shared with `path_move` path).
- **`parametric`** (`ParametricFunction`): `xExpr`/`yExpr` (t-based), `tMin`/`tMax`; `safeMathExpr`-guarded.
- **`matrix`** (`Matrix`): source of truth `matrixData` (2D string array) + `bracket` (`[`|`(`|`|`); rows/cols derived. Single-line `Matrix([[…]])` (+ `left/right_bracket` for non-default) then `.set_color`. Entries sanitized by `safeMatrixEntry` (no eval). Actions: `setMatrixCell`, `add/removeMatrixRow/Column`, `setMatrixBracket` (guards at 1×1).
- **`brace`** (`BraceBetweenPoints`): `p1`/`p2` (object-relative px), `label`. Labeled → `VGroup(_brace, _brace.get_tex(…))`.
- **`angle`** (`Angle`/`RightAngle`): `vertex`/`point1`/`point2`, `rightAngle`, `radius`, `label`. Emitted via two helper `Line`s (`_l1`/`_l2`); parser captures them into `relLineMap`. Labels use `get_tex(…)` with `safeLatex` (non-raw, doubled-backslash). Both brace+angle: draggable point handles reuse `polygonHandles` (`kind:'relational'`).
- **`counter`** (`DecimalNumber`/`Integer`): `value`, `numDecimals`, `suffix`, `useInteger`. Emits `DecimalNumber(<v>, num_decimal_places=<d>[, unit="<s>"])`, or `Integer(<trunc v>[, unit])` when `useInteger`. `unit=` only when suffix non-empty. `value` keyframable (`set_value`). Actions: `setCounterValue/Decimals/Suffix/Integer`.
- **`table`** (`Table`/`MathTable`): `cellData`, `mathMode`, `rowLabels`/`colLabels`. Math mode emits `MathTable(…, row_labels=[MathTex(…)], col_labels=[…])` (labels omitted when empty). Reuses `safeMatrixEntry` + matrix grid editor. Actions: `setTableCell`, `add/removeTableRow/Column`, `setTableMathMode/RowLabels/ColLabels`.
- **`complex_plane`** / **`polar_plane`**: mirror `numberplane`; `xRange`/`yRange` + `width`/`height` → `x_length`/`y_length`. `polar_plane` → `PolarPlane(radius_max, radius_step, azimuth_units, size)` (`size = min(w,h)/sw*FRAME_WIDTH`). Actions: `setPolarRadiusMax/Step` (clamp ≥0.1), `setPolarAzimuth`.
- **`graph`** (`Graph`/`DiGraph`): `vertices` (string[]), `edges` ([[a,b]]), `positions` ({label:[px,py]}), `directed`, `showLabels`. Manual layout px→Manim. `labels=True` only when `showLabels`. Actions: `add/removeGraphVertex`, `add/removeGraphEdge`, `renameGraphVertex`, `setGraphVertexPosition/Directed/ShowLabels`.
- **`vector_field`** (`ArrowVectorField`): `fx`/`fy` (expr, `safeMathExpr`; fallback `'y'`/`'-x'`), `xRange`/`yRange`. Double-lambda single-line form. Actions: `setFieldExpr`, `setFieldRange`. Top-level comma exprs (e.g. `max(x,y)`) round-trip via `splitTopLevelCommaPair`.
- **`vector_components`** (composite): `VGroup` of main `Arrow` + x/y component arrows + 2 `DashedLine` guides. Fields `vx`/`vy` (px tip; vy<0 = up). Round-trips via `vcPending`. Inspector `VectorComponentsSettings.vue`.
- **`coord_point`** (composite, dynamic): `Dot` + `always_redraw` live `(x,y)` MathTex label. Field `decimals`. Emits `VGroup(Dot, always_redraw(lambda: MathTex(f"(…)").next_to(…)))`. Round-trips via `coordPending`.
- **3D `prism`** (`Prism`): `dimX`/`dimY`/`dimZ` (Manim units) → `Prism(dimensions=[…])`. Preview shares `boxFaces` with cube.
- **3D `surface`** (z=f(x,y)): `zExpr` (`safeMathExpr`), `xRange`/`yRange` (=u/v range). Emits `Surface(lambda x,y: np.array([x,y,<zExpr>]), u_range, v_range, resolution)`. Preview = iso wireframe (render = filled surface). Registered in `obj3DTypes`, store `is3D`, `Position3DPanel`.
- **3D common fields**: `x3d/y3d/z3d` (pos), `rx/ry/rz` (rot deg), `resolution`, `sideLength` (cube), `radius` (sphere/cone/cylinder/torus), `height` (cone/cylinder), `majorRadius/minorRadius` (torus), `xRange/yRange/zRange` (axes3d).
- **`surrounding_rect`** (`SurroundingRectangle`): `targetId` (refs another object), `color`, `strokeWidth`, `buff` (px padding), `cornerRadius`. Codegen: `SurroundingRectangle(target, color=…, stroke_width=…, buff=…, corner_radius=…)`. No `move_to` emitted — position is derived from the target Mobject. Cascade-deleted when target is deleted. Inspector: target picker + color/strokeWidth/buff/cornerRadius. `AnnotationSettings.vue` (shared with underline/cross).
- **`underline`** (`Underline`): `targetId`, `color`, `strokeWidth`, `buff`. Codegen: `Underline(target, color=…, stroke_width=…, buff=…)`. No `move_to`.
- **`cross`** (`Cross`): `targetId`, `color`, `strokeWidth`. Codegen: `Cross(target, stroke_color=…, stroke_width=…)`. No `move_to`.
- **Annotation pattern**: All three are "bound annotations" — their canvas position is computed from `ctx.objectBounds(targetId)` (new `StageCtx` method). `generateScene` applies a topological sort so annotations always emit after their targets (prevents Python NameError). `ANNOTATION_TYPES` set in `@manim/codegen/constants.ts` gates the post-construction block (round_corners/gradient/dashed/shadow/move_to are all skipped). Store action: `setAnnotationTarget(objId, targetId)`. None are in `GRADIENT_TYPES`, `DASH_TYPES`, or `SHADOW_TYPES`.
- **`code`** (Manim `Code`): `codeText` (multiline), `language` (Pygments allowlist: python/javascript/typescript/c/cpp/java/html/css/bash), `fontSize` (preview-only). Single-line `Code(code_string=…, language=…, add_line_numbers=False)` + `.scale_to_fit_width(…)`; `codeText` escaped via `pyMultiline` (`helpers.ts`), unescaped by the parser (`unescapePyMultiline`). Preview = flat monospace text on a bg rect (no highlighting; render has real Pygments). Height not persisted in Python → `.py` import defaults `height = width*0.6`.
- **`bar_chart`** (Manim `BarChart`): `values[]`, `barNames[]` (sanitized via `safeMatrixEntry` — they become Tex), `yMax`, `barColors[]`. Single-line `BarChart(values=[…], bar_names=[…], y_range=[0, yMax, yMax/5], bar_colors=[…], x_length=…, y_length=…)`. Preview = simple rect bars + baseline (render has full axes). Values/names editor adapts the matrix grid pattern.
- `matrix`/`table`/`brace`/`angle`/`counter`/`graph`/`vector_field`/`vector_components`/`surrounding_rect`/`underline`/`cross`/`code`/`bar_chart` are in **neither** `GRADIENT_TYPES` nor `DASH_TYPES`.

## Camera Animations

- Project-level: `cameraType: 'static'|'moving'`, `cameraTrack: []`. `camera_move` clips live in `cameraTrack`, not `tracks[]`. Delete key + inspector handled separately in `App.vue`.
- **2D**: `MovingCameraScene` + `self.camera.frame.animate.move_to().set_width(FRAME_WIDTH/zoom)`. Clip params `{x, y, zoom}`.
- **3D**: `ThreeDScene` + `self.move_camera(phi=… * DEGREES, theta=…, zoom=…, run_time=…)`. Clip params `{phi, theta, zoom}` (deg), stored in `project.camera3d`.

## Audio / Voiceover

- **Flow**: `AudioPanel` → `POST /api/audio/tts` → Redis `audio:queue:gtts` → `worker.py` → WAV to `/data/assets/audio/` → `POST /api/audio/:jobId/complete` → `broadcastAudioEvent` WS → `actions.setClipAudio`.
- **File upload** skips the queue: `POST /api/audio/upload` (ffprobe duration) → `{ src, duration, status:'ready' }`.
- **Codegen priority**: `MovingCameraScene` > `VoiceoverScene` > `Scene`. 3D: `is3D && hasReadyAudio → 'ThreeDScene, VoiceoverScene'` > `is3D → 'ThreeDScene'` > 2D chain.
- **Render lock**: `store.hasPendingAudio` disables render in `App.vue` (render dialog, which hosts `RenderOptionsDialog.vue`) and `Topbar.vue`. (There is no `RenderPanel.vue`.)
- **Coqui** (optional): `docker compose --profile coqui up`; `audio-coqui` handles `audio:queue:coqui`.

## Render Export Options

- `RenderOptionsDialog.vue` (hosted in `App.vue`'s render dialog): format **MP4/GIF/WebM/PNG Frames/WebM α** (`png`, `webm_transparent`) × resolution **854x480/1280x720/1920x1080/2560x1440/3840x2160** × fps **15/30/60**. Defaults (mp4·1920x1080·60) produce **byte-identical argv** to the legacy `-qh` path (regression-tested in `render_args` checks + api tests).
- Wire: flat `{format,resolution,fps}` in the POST body → zod **enum allowlist** (`parseRenderOptions`, `compiler/validator.ts`) → nested `options` in the Redis job → `services/renderer/render_args.py` fixed-dict argv mapping (preset-matching combos emit a single `-q*` flag; others `-qh -r W,H --fps N`; gif/webm append `--format <f>`; `png → --format png`, `webm_transparent → --format webm --transparent`). User values are never interpolated into argv.
- Output extension follows the format end-to-end: worker writes `latest.<ext>`, `renders.ts` serves `latest.:ext` with the right Content-Type, web `getLatestUrl(projectId, ext)`; GIF displays via an `<img>` branch in the completed dialog. The download button label is driven by a `downloadLabel` computed in `App.vue` (`{ mp4→"MP4 İndir", gif→"GIF İndir", webm→"WebM İndir", zip→"ZIP İndir" }`). Legacy `{quality}` payloads (low→4k) still work unchanged.
- **PNG frames → ZIP**: `FORMAT_EXT` maps `png → zip`, `webm_transparent → webm` (format names ≠ extensions — iterate `FORMAT_EXT.values()` when touching `latest.*`). The store mirrors this (`FORMAT_TO_EXT` in `renderOnServer`) so `renderFormat` always holds the real extension. Worker: manim writes frames as `<media_dir>/images/<module>/<SceneName><frame>.png` (no per-scene dir); `find_output_png_dir` locates them by scene-prefixed file glob, zips them into `latest.zip`, and job-start cleanup removes `images/` alongside `videos/` so stale frames never leak into the ZIP. Completed dialog shows a "ZIP İndir" branch when `renderFormat === 'zip'`. ZIP has no history copies (`render_*.zip` is not written).

## Editor UX (lock/hide, context menu, marquee, autosave, Wave 2)

- `obj.locked` / `obj.hidden` — optional booleans (absent = legacy behavior). **Locked** → not clickable/draggable on canvas (interactive configs wrapped by `L()` in StageCanvas), still selectable from the timeline. **Hidden** → not drawn in preview AND **skipped by codegen** (`generateScene` filters hidden objects; annotations whose target is hidden are skipped too — NameError guard; their clips cascade). **Known loss:** hidden objects don't survive a `.py` round-trip. Actions: `toggleLocked`, `toggleHidden`; timeline object bars carry aria-labelled eye/lock icons.
- **Right-click context menu** (`stage/ContextMenu.vue`): object variant (cut/copy/paste/duplicate/delete, bring-to-front/send-to-back, lock, hide) + empty-canvas variant. Store actions added for it: `bringToFront`, `sendToBack`, `duplicateSelection`, `cutSelection`, `selectAllObjects`, `translateObjects`.
- **Timeline clip context menu** (`TimelineClip.vue`): right-click a clip → Kopyala/Kes/Yapıştır/Çoğalt/Böl/Sil. Reuses `ContextMenu.vue`. Paste uses `store.pasteSelection()` (NOT `pasteClipboard`).
- **Split clip**: `store.splitClip(clipId)` splits at `store.playbackTime`; guard: split point must be strictly inside the clip. Both halves keep the original `type`/`objectId`.
- **Scene sections**: `store.project.sections[]` sorted `{ id, time, title }` array; `addSection/removeSection/updateSection` actions (all `commitState()`). Codegen (`@manim/codegen/index.ts`) emits `self.next_section("Title")` before the first animation step at or after each `section.time`. Timeline ruler shows vertical markers + inline-editable titles (double-click); "+ Bölüm" button adds at playhead. The `.py` parser **round-trips** these back (`parseManimScript` matches `self.next_section("…")` → `result.sections` → applied in `applyCodeToCanvas`); each marker's `time` is reconstructed from the accumulated playback time at its emit point, which re-emits identically.
- **Canvas rulers** (`useStageRulers.ts`): H + V ruler `<canvas>` overlays (18 px, `RULER_SIZE`), tick interval auto-scaled to zoom, visible in 2D mode only. Drag from a ruler onto the canvas to create a guide.
- **Guides**: `store.project.guides[]` array of `{ id, axis:'h'|'v', pos }` (project px). `addGuide/removeGuide/moveGuide` actions. Rendered as a blue dashed Konva layer on `StageCanvas`; drag on guide to reposition, drag out of stage to delete.
- **Smart snapping**: on drag-end, `useStageInteractions.onDragEnd` calls `snapPoint` (from `engine/snap.ts`) with grid/center candidates from `stageSnapCandidates`, guide positions, and other objects' bounding-box edges (threshold 8 canvas px, 2D only). The global Snap toggle gates the entire path. Coordinates round-trip through `s2c`/`c2s` for canvas space.
- **Inline text edit**: double-click a `text`, `latex`, or `code` object → `editingTextId` in `useStageInteractions` → textarea overlay appears directly on the canvas in `StageCanvas.vue`. `code` objects use `codeText` field.
- **Numeric scrubbing**: `Num.vue` label is draggable (100 px = 1 unit, Shift ×10) for fast inspector value changes.
- **Recent colors**: `store.recentColors: string[]` (top-level state, not part of project); persisted to `localStorage` key `manim-motion-recent-colors`. `ColorRow` shows up to 10 swatches; `addRecentColor(hex)` prepends + dedupes.
- **Marquee selection** (2D mode only): drag on empty canvas → bbox-intersecting objects become the multi-selection; the selection group-drags together. Intersection logic is a pure exported helper (unit-tested without Konva).
- **Autosave**: 2 s-debounced project JSON under localStorage key `manim-motion-autosave` (`{project, savedAt}`); restore prompt on startup; cleared on New/Open/save. (localStorage also holds `manim-motion-theme` and `manim-motion-recent-colors`.)

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

**Codegen** (`generateKeyframeSteps` in `@manim/codegen/keyframes.ts`, runs before camera clips): `UpdateFromAlphaFunc` (default, `def _kf_<obj>_<prop>_<i>_fn(mob,alpha)` + `self.play(UpdateFromAlphaFunc(…))`), `animate` (sequential `obj.animate.set_x(…)`), `ValueTracker` (`_vt` + `add_updater` + `clear_updaters`). ValueTracker/UpdateFromAlphaFunc skip props where `_kfUpdater(prop)` is null. `counter.value` keyframable via `set_value`.

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
- **Math → use the `latex` object, not `text`.** A `latex` object emits `MathTex(...)` (proper math typesetting: italic variables, real superscripts); a `text` object emits `Text(..., font=…)` (plain font). Authoring a math expression as a `text` object renders it in the wrong font (regression source — fixed in the `axes_intro` template).

## 3D Scene Support

```js
store.project.sceneType = '2d' | '3d'                              // default '2d'
store.project.camera3d  = { phi:75, theta:-45, zoom:1.0, projection:'orthographic'|'perspective', focalDistance:8 }
// projection + focalDistance are PREVIEW-ONLY (do not affect codegen)
```
- Actions: `setSceneType(type)`, `setCamera3d(params)` (both `commitState()`).
- **Split viewport** when `3d`: left iso (`iso(x3d,y3d,z3d,…)`), right top/XZ (`top(x3d,z3d,…)`). Drag updates `x3d/z3d`.
- **Preview projection** (`engine/projection3d.ts`, pure/testable): `project3D` + `unprojectIso`, ortho + perspective (Manim Z-up spherical camera). `StageCanvas.iso()` delegates via a `cam3d` computed. `playback.computeFrame` lerps 3D `camera_move` (`{phi,theta,zoom}`, detected by `'phi' in params`) into `cameraState{is3d:true}`; `setCamera3dBase` seeds the resting angle. Projection mode editable in `Scene3DPanel.vue`.
- **Known constraint**: projection mode is preview-only — perspective preview diverges slightly from render; perspective iso drag uses the ortho inverse (minor imprecision at extreme angles).
- Design spec: `docs/superpowers/specs/2026-06-03-3d-scene-design.md`.

## TypeScript

The whole codebase is **strict TypeScript** (migration complete — phases 0–7). Spec: `docs/superpowers/specs/2026-06-08-tooling-strict-ts-migration-design.md`.

- **What's TypeScript:** everything — `@manim/codegen/src/*`, all `services/web/src/*` (`.ts` + `.vue` with `<script setup lang="ts">`), all `services/api/src/*`, and all tests (`*.test.ts`, e2e `*.spec.ts`). Only build/tooling configs (`*.config.js`, `eslint.config.js`) and the tsx-run `engine.test.mjs` stay `.js`/`.mjs`.
- **Import-specifier rule (critical):** in `.ts`/`lang=ts` source, relative imports KEEP the `.js` extension (`import { x } from './types.js'`). The Vite/Vitest `resolve-ts-from-js` plugin + the `source` export condition remap `.js`→`.ts` at runtime; `moduleResolution` (`bundler` for web, `NodeNext` for api/codegen) does the same at typecheck. **Do not "fix" these to `.ts`.**
- **Config:** root `tsconfig.base.json` (strict, **`allowJs:false`**, `noUnusedLocals/Parameters`, …). `services/web/tsconfig.json` = bundler resolution + DOM lib + `checkJs:false` + `include:["src/**/*.ts","src/**/*.vue"]` (a `.vue` is strict-checked only once it has `lang="ts"`). `services/api/tsconfig.json` = NodeNext + `types:["node"]` + `noEmit` (api runs via **`tsx`**). `packages/manim-codegen/tsconfig.json` = NodeNext + declaration emit to `dist/`. `services/web/src/vite-env.d.ts` declares `import.meta.env` + `Window.__projectStore`.
- **Gates (all in CI):** `npm run lint` (ESLint — **errors fail**, warnings allowed), `npm run format:check`, `npm run typecheck` (= build codegen + `vue-tsc` web + `tsc` api). `npm run test:unit` + `npm test` + codegen tests.
- **Domain model:** wide interfaces — `@manim/codegen` `SceneObject` (common visual/layout fields typed + `[k:string]:unknown` for type-specific fields → cast those: `(obj.matrixData as string[][])`), `Clip`, `Project`, etc. (re-exported from the barrel). Engine has its own `engine/types.ts` (`StageObject`/`Clip`/`FrameState`/`TimedClip`…); engine↔codegen bridging uses `as unknown as` in a few stage/timeline spots. Discriminated-union refinement still deferred.
- **`.vue` migration pattern:** keep runtime `defineProps({ obj:{ type: Object as () => SceneObject } })`/`defineEmits`; move `$event.target.*` to script handlers with `(e.target as HTMLInputElement)`; Konva events typed `(e: any)` (eslint `no-explicit-any` is `warn`).
- **ESLint policy** (`eslint.config.js`): `no-unused-vars` ignores `^_`; `vue/no-template-key` is **off** (Vue 3 build requires the key on `<template v-for>`), as are `multi-word-component-names` and `vue/no-deprecated-filter` (false-positive on `lang=ts` union casts); `website/**` ignored.
- **Recurring strict landmines:** dead imports/params → prefix `_` or delete; `new Map(arr.map(o=>[id,o]))` needs `:[string,T]` tuple annotation; `Number.isFinite(x)` doesn't narrow `number|undefined` → cast; array-element narrowing from a flag → branch-local `as T[]`; class fields must be declared. Memory: `strict-ts-migration-initiative`.

## Stack Notes (history)

- **Strict TypeScript migration**: complete (whole codebase `.ts`/`lang=ts`; lint+typecheck CI gates; `allowJs:false`). See the TypeScript section above. Spec: `docs/superpowers/specs/2026-06-08-tooling-strict-ts-migration-design.md`.

## Stack Notes (history)

- **Vue 3 + Pinia**: migration complete (Options API → `<script setup>`, `Vue.observable`/`Vue.set` → Pinia/direct assignment, `@vue/test-utils@2`, `@vue/compat` removed). Spec: `docs/superpowers/specs/2026-06-03-vue3-migration-design.md`.

## Security posture

**Threat model: local, single-user, internet-closed.** Hardening is scoped to what protects a localhost app from malformed input/bugs — not multi-tenant concerns.

- **Path traversal:** every route param interpolated into a filesystem path (`id`/`projectId`/`filename`/`audioId`) is validated by `isSafeSegment` (`services/api/src/util/paths.ts`) via `router.param` guards on each router → a `..`/separator/NUL/over-long value gets a 400 before any fs access (param callbacks run before route middleware incl. multer). Unit-tested in `services/api/tests/paths.test.ts`.
- **Input validation:** project payloads go through the zod schema (`compiler/validator.ts`, tested in `compiler.test.ts`); asset upload enforces a mime allowlist; TTS checks required fields. Error responses are `{ error: '<message>' }` (no stack traces).
- **Argument injection:** `render-code` validates `sceneName` with `isSafeSceneName` (a Python class identifier) before it's forwarded to the `manim` CLI as an argv — list-form `subprocess.run` blocks shell injection, but an unvalidated value (e.g. `--config_file=…`) would be read as a manim flag.
- **Intentionally NOT added (YAGNI for a local app):** endpoint auth, CSP, CORS origin restriction (`cors()` stays open), per-route limits beyond the existing render rate-limit. Code-mode runs the user's own Python via the renderer — expected for a single-user local tool, not a sandbox-escape vuln in this model.
- Containers run non-root (web=nginx, api=node); Helmet headers + render rate-limit are applied in `services/api`.

## Build / Environment Gotchas

- **Vue 3 `<template v-for>` keys** must sit on the `<template>` tag, not child elements — a pure prod build (`npm run build`) errors otherwise. Watch in `MenuBar.vue` / `StageCanvas.vue`.
- **Renderer `setuptools<81` pin**: `manimcommunity/manim:stable` ships setuptools 82 (no `pkg_resources`), but `manim-voiceover` imports it at load and crashes the `manim` CLI. Pinned in `services/renderer/Dockerfile`.
- **`root_node_modules` named volume**: the api mounts `root_node_modules:/app/node_modules`; it persists across rebuilds and shadows freshly-installed packages. After adding/removing a dep, rebuild with: `docker compose down` → `docker volume rm manim_motion_root_node_modules` → `docker compose up -d --build` (keeps the `*_data` + `redis_data` volumes). Otherwise `ERR_MODULE_NOT_FOUND`.
- **Docker images must ship `tsconfig.base.json`**: `services/{web,api}/tsconfig.json` `extends ../../tsconfig.base.json`, and the toolchains resolve that `extends` at build/startup — `vite build` (web) and `tsc`/`tsx` (api) fail with "failed to resolve extends" if the root base config isn't in the image. Both Dockerfiles `COPY tsconfig.base.json ./` before install/build. (Surfaces only on a container rebuild, not locally.)
- **redis is not published on the host**: the app reaches redis over the internal Docker network (`REDIS_URL=redis://redis:6379`); `docker-compose.yml` deliberately omits a `6379:6379` mapping to avoid host-port clashes with other local projects. Add a `ports` mapping back if you need redis-cli from the host.
