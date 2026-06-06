# Manim Motion Editor — Claude Code Instructions

## Project Overview

Browser-based Figma-like animation editor for Manim CE. 5 Docker services: Vue 3 + Konva.js frontend (Nginx :8080), Node.js/Express API (:3000), Python Manim CE renderer worker, Python audio TTS worker, Redis 7 job queue. Shared Docker volume at `/data`.

## Architecture

```
services/web/        # Vue 3 frontend (Vite, Vitest)
services/api/        # Node.js/Express API + Manim codegen
services/renderer/   # Python Manim worker (polls Redis) + manim-voiceover
services/audio/      # Python TTS worker (gTTS; Coqui via --profile coqui)
```

## Running Tests

```bash
# Unit tests (store, components, export) — 109 tests
cd services/web && npm run test:unit

# Engine tests (easing, geometry, transform, keyframe) — 105 tests
cd services/web && npm test

# Both must pass before any commit
```

## Key Files

| File | Purpose |
|------|---------|
| `services/web/src/store/project.js` | Pinia store — all project state, actions, getters (`useProjectStore()`) |
| `services/web/src/engine/playback.js` | 60fps rAF playback engine — evaluates clips, computes frame state |
| `services/api/src/compiler/codegen.js` | Generates Python Manim code from project JSON (server-side) |
| `services/web/src/export/manim.js` | Client-side .py generator + parser (mirrors codegen.js semantics) |
| `services/web/src/components/stage/StageCanvas.vue` | Konva.js canvas — renders all object types; split viewport for 3D (iso + top); camera preview via vs/ox/oy |
| `services/web/src/components/inspector/Inspector.vue` | Object + clip property editor (Layout, Style, Timing, Animation, Audio, Keyframe, Position3D panels) |
| `services/web/src/components/inspector/Position3DPanel.vue` | 3D position/rotation editor — x3d/y3d/z3d, rx/ry/rz, resolution, xRange inputs |
| `services/web/src/components/inspector/AudioPanel.vue` | Per-clip audio: file upload, gTTS/Coqui TTS, sync mode |
| `services/web/src/components/inspector/KeyframePanel.vue` | Selected keyframe editor — time (read-only), value, mode, delete |
| `services/web/src/components/timeline/Timeline.vue` | Multi-track timeline + camera track + keyframe lanes |
| `services/web/src/components/timeline/KeyframeLanesPanel.vue` | Keyframe lane panel — shown below selected clip, one lane per property |
| `services/web/src/components/timeline/KeyframeLane.vue` | Single-property keyframe lane — diamond markers, drag, add/remove |
| `services/web/src/components/timeline/KeyframeEasingPopup.vue` | Segment Bezier easing editor — draggable handles, presets, codegenMode selector |
| `services/web/src/engine/keyframe.js` | Keyframe interpolation engine — `interpolateKeyframes`, `getKeyframeRange`, Bezier solver |
| `services/api/src/routes/audio.js` | Audio upload, TTS job, worker callback, delete endpoints |
| `services/api/src/ws.js` | WebSocket push for render and audio job events |
| `services/audio/worker.py` | gTTS / Coqui TTS Redis consumer; POSTs completion to API |

## Coordinate Systems

- **Project coords**: 0–1920 (x), 0–1080 (y), origin top-left
- **Manim coords**: `stageToManim(px, py, sw, sh)` → approx −7 to +7 (x), −4 to +4 (y)
- **Canvas coords**: Use `c2s(cx, cy)` / `s2c(px, py)` in StageCanvas.vue — accounts for pan offset (`ox`, `oy`) and zoom (`vs`)
- **3D coords**: `obj.x3d / obj.y3d / obj.z3d` — direct Manim units (−7..+7 / −4..+4 / −4..+4); NOT converted through `stageToManim`. `iso()` and `top()` in StageCanvas.vue project 3D→2D for canvas rendering.

## Store Patterns

```js
// Pinia store — import and use in components
import { useProjectStore } from '../store/project.js';
const store = useProjectStore();

// Direct assignment (Vue 3 reactivity — no Vue.set needed)
obj.newProp = value;

// uid() is exported from store/project.js — use it everywhere
import { uid } from '../store/project.js';

// Actions are methods on the store instance
store.commitState();  // required after mutations that should be undoable
store.isDirty = true; // mark unsaved changes

// Getters are properties (no parens), factory getters are functions:
store.computedDuration    // property — NOT store.computedDuration()
store.hasPendingAudio     // property — NOT store.hasPendingAudio()
store.objectById(id)      // factory getter — called as function
store.assetById(id)       // factory getter — called as function
```

## Clip Types

`transform` (optional `matchTerms: true` field — upgrades to `TransformMatchingTex`/`TransformMatchingShapes` via the shared `transformExpr` helper), `move`, `scale`, `fade`, `rotate`, `path_move`, `camera_move`

**Emphasis (transient)**: `indicate`, `flash`, `wiggle`, `circumscribe`, `focus_on` — there-and-back animations (return the object to its original state, unlike the persistent-target clips above). Emitted via the byte-identical `emphasisExpr(c, sn)` helper (`Indicate`/`Flash`/`Wiggle`/`Circumscribe`/`FocusOn`); `color` via `hex()`, `rotation_angle` stored in degrees and emitted as `<deg> * DEGREES`, `shape` as a bare class (`Rectangle`/`Circle`), `fade_out` as a Python bool. Full `.py` round-trip (standalone `self.play(...)` matchers + `parseAnimExpr` inner matchers for parallel groups). Playback derives its own pulse from raw `progress` (Indicate/Wiggle faithful; Flash/FocusOn color-pulse approximations; Circumscribe writes an `overrides._emphasis = {kind, shape, color, fadeOut, progress}` descriptor that `StageCanvas` renders as an overlay box/ellipse). **Keep `emphasisExpr` byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.

**Count**: `count` — `{ type:'count', objectId, from, to, duration, easing }`. Emits a 4-line `ValueTracker` block using a distinct `_count_<clipid>` variable prefix (avoids colliding with keyframe `_vt_<obj>_<prop>` blocks): `_count_<id> = ValueTracker(from)` / `add_updater(set_value(get_value()))` / `animate.set_value(to)` / `clear_updaters()`. Skipped (returns `null`) in `animExpr` so it is never included in a parallel `AnimationGroup`. Parsed by a dedicated pending-dict branch (`pendingCount`) that buffers the tracker-init line and resolves on the `animate.set_value` line. **Keep the `case 'count'` block byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.

All clips have: `id, type, startTime, duration, easing, parallel, lag_ratio`

`parallel: true` clips at the same `startTime` → `AnimationGroup` / `LaggedStart` in codegen.

Clips may carry an optional `audio` field:
```js
clip.audio = {
  type: 'file' | 'gtts' | 'coqui',
  src: '/data/assets/audio/<id>.wav',   // absolute path on shared volume
  text: 'spoken text',                   // TTS only
  lang: 'tr',                            // BCP-47, default 'tr'
  syncMode: 'auto' | 'manual',
  offset: 0,                             // manual: audio start delay (s)
  status: 'pending' | 'ready' | 'error',
  duration: 2.5                          // filled when status = 'ready'
}
```
`syncMode: 'auto'` → when status becomes `ready`, `clip.duration` is set to `audio.duration`.
Clips with `status: 'ready'` generate `with self.voiceover(audio=...) as tracker:` blocks in codegen.

## Object Types

**2D:** `rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`, `heart`, `dot`, `dot_grid`, `text`, `image`, `svg_asset`, `latex`, `axes`, `numberplane`, `numberline`, `annulus`, `arc`, `sector`, `double_arrow`, `polygon_free`, `parametric`, `matrix`, `brace`, `angle`, `counter`, `table`, `complex_plane`, `polar_plane`, `graph`, `vector_field`

`counter` object fields: `value` (number, default 0), `numDecimals` (int ≥ 0, default 0), `suffix` (string, optional). Emits `DecimalNumber(<value>, num_decimal_places=<dec>[, unit="<suffix>"])` — `unit=` only when `suffix` is non-empty. Not in GRADIENT_TYPES or DASH_TYPES. `value` is keyframable via `_kfPropSet`/`_kfUpdater` (`set_value` setter). Store actions: `setCounterValue`, `setCounterDecimals`, `setCounterSuffix`.

**3D** (only when `sceneType === '3d'`): `sphere`, `cube`, `cone`, `cylinder`, `torus`, `axes3d`

`axes` objects have a `graphs: []` array — each graph has `{ id, expression, color, xMin, xMax, strokeWidth }`.

3D objects have additional fields: `x3d, y3d, z3d` (position in Manim units), `rx, ry, rz` (rotation degrees), `resolution` (surface quality), `sideLength` (cube), `radius` (sphere/cone/cylinder/torus), `height` (cone/cylinder), `majorRadius/minorRadius` (torus), `xRange/yRange/zRange` (axes3d).

## Security

Graph expressions (`graph.expression`) must pass the whitelist before use in codegen or `new Function`:
```js
if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(expr)) return 'x**2';
if (/import|eval|exec|open|__/.test(expr)) return 'x**2';
```
This check exists in `codegen.js` (`safeMathExpr`), `manim.js` (`safeMathExpr`), and `StageCanvas.vue` (`axesGraphCurves`). Keep all three in sync.

## Camera Animations

- Project-level: `cameraType: 'static' | 'moving'`, `cameraTrack: []`
- `camera_move` clips live in `cameraTrack`, not in regular `tracks[]`
- **2D codegen**: `MovingCameraScene` base class + `self.camera.frame.animate.move_to().set_width(14/zoom)`
- **3D codegen**: `ThreeDScene` base class + `self.move_camera(phi=... * DEGREES, theta=... * DEGREES, zoom=..., run_time=...)`
- `camera_move` clip params for 3D: `{ phi, theta, zoom }` — angles in degrees, stored in `project.camera3d`
- Delete key and inspector work for camera clips (handled separately from regular clips in App.vue)

## Audio / Voiceover

- **Flow**: `AudioPanel` → `POST /api/audio/tts` → Redis `audio:queue:gtts` → `services/audio/worker.py` → WAV to `/data/assets/audio/` → `POST /api/audio/:jobId/complete` → `broadcastAudioEvent` WebSocket → `actions.setClipAudio`
- **File upload** skips the queue: `POST /api/audio/upload` stores file directly, runs ffprobe for duration, returns `{ src, duration, status: 'ready' }`.
- **Codegen priority**: `MovingCameraScene` > `VoiceoverScene` > `Scene`. Clips with `audio.status === 'ready'` generate `with self.voiceover(audio="...") as tracker_<clipId>:` blocks.
- **Render lock**: `store.hasPendingAudio` (Pinia property) disables render button in `App.vue`, `RenderPanel.vue`, and `Topbar.vue`.
- **Coqui TTS** (optional): start with `docker compose --profile coqui up`; the `audio-coqui` service handles `audio:queue:coqui` jobs.
- **Keep `manim.js` and `codegen.js` in sync** for voiceover logic, same as for all other clip/object types.

## Testing Conventions

- Test files: `services/web/tests/components/*.test.js`
- Import store:
  ```js
  import { setActivePinia, createPinia } from 'pinia';
  import { useProjectStore } from '../../src/store/project.js';
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });
  ```
- Engine tests excluded from Vitest: `tests/engine.test.mjs` runs via `npm test` (Node.js)

## Development Workflow

```bash
# Start all services
docker compose up --build

# Frontend only (no render)
cd services/web && npm run dev   # http://localhost:5173

# API only
cd services/api && npm run dev
```

## Client-Side Exporter (`manim.js`)

`services/web/src/export/manim.js` supports the same features as `codegen.js`:
- Generator: `numberplane`, `numberline`, `axes` + `graphs[]`, `AnimationGroup`/`LaggedStart`, `path_move`, `camera_move`, `MovingCameraScene`, `VoiceoverScene` + per-clip `with self.voiceover(...)` blocks
- **3D**: `ThreeDScene` + `objectCode3d()` for 6 3D types, `set_camera_orientation`, `self.move_camera()`, `Rotate(axis=RIGHT/UP/OUT)`, keyframe `x3d/y3d/z3d → move_to([...])`, `ThreeDScene, VoiceoverScene` mixin
- Parser: all of the above in reverse (`.py` → project JSON); returns `cameraType` and `cameraTrack`

**Keep `manim.js` and `codegen.js` semantically in sync.** When adding a new object or clip type, update both.

## 3D Scene Support (Completed — 2026-06-03)

Design spec: `docs/superpowers/specs/2026-06-03-3d-scene-design.md`

### Project-Level Fields

```js
store.project.sceneType = '2d' | '3d'  // default: '2d'
store.project.camera3d = { phi: 75, theta: -45, zoom: 1.0 }
```

### Codegen Priority (3D)

`is3D && hasReadyAudio → 'ThreeDScene, VoiceoverScene'` > `is3D → 'ThreeDScene'` > (existing 2D chain)

### Split Viewport (StageCanvas.vue)

When `sceneType === '3d'`, canvas splits 50/50 into:
- **Left (iso)**: `iso(x3d, y3d, z3d, cx, cy, scale)` — `px=(x3d-z3d)*cos30`, `py=-y3d+(x3d+z3d)*sin30`
- **Right (top/XZ)**: `top(x3d, z3d, cx2, cy2, scale)` — `px=cx2+x3d*scale`, `py=cy2+z3d*scale`

Drag on iso panel updates `x3d/z3d` (inverse iso formula). Drag on top panel updates `x3d/z3d` directly.

### Keyframe 3D (position)

Keyframed `x3d/y3d/z3d` are merged into **one** `move_to([x, y, z])` call per `[t1, t2]` segment, using "last known value" for each axis. This merge runs **regardless of each axis's `keyframeCodegen` mode** — 3D position can only be expressed via `move_to`, and `UpdateFromAlphaFunc`/`ValueTracker` have no 3D setter (`_kfPropSet`/`_kfUpdater` return null), so non-merged axes would otherwise be silently dropped. The `x3d/y3d/z3d` arms of `_kfPropSet` are therefore dead and were removed (v3.3.2).

### Store Actions

- `setSceneType(type)` — `'2d' | '3d'`; calls `commitState()`
- `setCamera3d(params)` — `Object.assign(project.camera3d, params)`; calls `commitState()`. `camera3d` now also carries `projection: 'orthographic' | 'perspective'` (default `'orthographic'`) and `focalDistance` (default `8`) — **preview-only**, do not affect codegen.

### 3D Preview Projection (v3.5.0)

- `services/web/src/engine/projection3d.js` — pure, testable Manim Z-up spherical-camera projection: `project3D(p, cam, cx, cy, scale)` + `unprojectIso(px, py, cam, cx, cy, scale, yKnown)`. Orthographic + perspective.
- `StageCanvas.vue` `iso()` delegates to `project3D` via a `cam3d` computed (live 3D `cameraState` if `is3d`, else `project.camera3d` base). The fixed `cos30/sin30` isometric is gone. `top()` (XZ) stays a fixed orthographic reference.
- `playback.js` `computeFrame` lerps 3D `camera_move` clips (`{phi, theta, zoom}`, detected by `'phi' in params`) into `cameraState` with `is3d: true`; `setCamera3dBase(base)` seeds the resting angle (fed from `App.vue` watcher). 2D camera path (`{x, y, zoom}`) unchanged; `vs/ox/oy` guard on `!cs.is3d`.
- Projection mode editable in `Scene3DPanel.vue` (Inspector, shown when nothing selected + `sceneType === '3d'`).

### Known Constraints

- Projection mode is **preview-only** — perspective preview will diverge slightly from the render (codegen still emits Manim's own camera). Convention (Z-up axis/angle signs) validated by manual render comparison, not unit tests.
- Perspective-mode iso drag uses the orthographic inverse (`unprojectIso`); minor drag imprecision at extreme angles.

## Vue 3 Migration (Completed — 2026-06-03)

Migration is complete. Design spec: `docs/superpowers/specs/2026-06-03-vue3-migration-design.md`

What was done:
1. Installed `@vue/compat` bridge + fixed compat warnings
2. Migrated store to **Pinia** (`Vue.observable` → `defineStore`, `Vue.set` → direct assignment)
3. Converted all components from Options API → **`<script setup>` Composition API** (leaf → root order)
4. Upgraded `@vue/test-utils@1` → `@vue/test-utils@2`
5. Removed `@vue/compat` — now pure Vue 3

## Keyframe Animation System (Completed — 2026-06-03)

### Data Model

Objects carry three optional fields (all absent until first keyframe is added):

```js
obj.keyframes = {
  x: [{ time: 0.5, value: 300, easing: { type: 'linear' } }, ...],
  opacity: [...],
}
obj.keyframeMode = {
  x: 'override',    // 'override' | 'additive' | 'opt-in'
}
obj.keyframeCodegen = {
  x: 'UpdateFromAlphaFunc',  // 'UpdateFromAlphaFunc' | 'animate' | 'ValueTracker'
}
```

Project-level defaults (`store.project.keyframeDefaults`):
```js
{ mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' }
```

Store state: `selectedKeyframeId: { objId, prop, time } | null`

### Store Actions

| Action | Parameters | Notes |
|--------|-----------|-------|
| `addKeyframe` | `(objId, prop, time, value)` | Upserts within 0.01s tolerance; keeps sorted |
| `removeKeyframe` | `(objId, prop, time)` | Cleans up empty arrays + `keyframes` object |
| `updateKeyframeValue` | `(objId, prop, time, value)` | Value only; preserves easing |
| `updateKeyframeEasing` | `(objId, prop, time, easing)` | `{ type, handles? }` |
| `setKeyframeMode` | `(objId, prop, mode)` | Per-property mode override |
| `setKeyframeCodegen` | `(objId, prop, codegenMode)` | Per-property codegen override |
| `selectKeyframe` | `(objId, prop, time)` | Null args clears selection |

All actions call `commitState()` for undo/redo support.

### Playback Pipeline

`computeFrame` order per-property:
1. Clip blending → `clipValue`
2. `_applyKeyframeOverrides(frame, time, objects)` — reads `keyframes` + mode, writes to `frame.objectOverrides`
3. `_applyEnterExitAnims`

Mode behaviours:
- `opt-in`: applies only within `[getKeyframeRange.start, .end]`
- `override`: `overrides[prop] = kfValue`
- `additive`: `overrides[prop] = clipValue + kfValue`

Drag in `KeyframeLane` mutates Pinia state directly (no `commitState()` per pixel); single `commitState()` fires on `mouseup`.

### Codegen

`generateKeyframeSteps(project, steps, sw, sh)` is called in both `codegen.js` and `manim.js` before camera clips. Outputs per `codegenMode`:

- **`UpdateFromAlphaFunc`** (default): `def _kf_<obj>_<prop>_<i>_fn(mob, alpha)` + `self.play(UpdateFromAlphaFunc(...))`
- **`animate`**: sequential `self.play(obj.animate.set_x(...), run_time=...)`
- **`ValueTracker`**: `_vt = ValueTracker(init)`, `add_updater`, `self.play(_vt.animate.set_value(...))`, `clear_updaters`

ValueTracker and UpdateFromAlphaFunc skip properties where `_kfUpdater(prop)` returns null (unsupported setters).

## Coordinate Constants (unified — v3.5.0)

Both generators now share the same frame constants and emit identical coordinates:
`FRAME_WIDTH = 14 + 2/9` (14.222, Manim CE default), `FRAME_HEIGHT = 8`, `FRAME_X_RADIUS = 7.111`, `FRAME_Y_RADIUS = 4`.

- `codegen.js` previously used bare `14` (positions) and `7` (scale-based shapes — square/circle/triangle/star/polygon/dot_grid spacing) — the latter a 2× size divergence vs `manim.js`. All now use `FRAME_WIDTH`. Radius-type values (heart `mw`, `Dot` radius) correctly use `FRAME_X_RADIUS`; heart `mh` uses `FRAME_Y_RADIUS`.
- `_kfPropSet` x-conversion and camera `set_width` in **both** files now use `FRAME_WIDTH`.
- **When editing coordinate math, keep `codegen.js` and `manim.js` byte-identical in the multipliers** — they have no shared import (codegen.js can't be imported in Vitest), so parity is maintained by convention + the `manim-export.test.js` invariant tests.

## 2D Object Effects (Phase 1 — 2026-06-05)

Optional object fields, absent ⇒ byte-identical legacy output:
`gradient {colors[], angle}`, `cornerRadius` (rect/square), `fillOpacity`,
`strokeOpacity`, `dash {numDashes, ratio}`.

- Codegen: `set_color_by_gradient(...)`, `RoundedRectangle`, `set_fill/stroke`
  opacity = master × channel, dashed via fill-preserving
  `VGroup(base, DashedVMobject(_dash_src, ...))`. **Keep codegen.js and manim.js
  helpers (`fillOpacityExpr`, `strokeOpacityArg`, `gradientLine`, `dashedLines`)
  byte-identical** — guarded by `effects-codegen.test.js`.
- Preview: `StageCanvas.vue` `applyEffects()` (Konva gradient / cornerRadius /
  rgba alpha / dash).
- Inspector: "Effects" section in `PropertiesPanel.vue` (controls gate by shape
  type via `canGradient` / `canDash` / `canRound`).
- Store actions: `setGradient`, `setCornerRadius`, `setDash` (delete the field on
  null/0 to preserve byte-identical legacy output).
- Preview-only divergences: gradient **angle** (Manim orients by point order),
  and dashed+fill (preview = single shape, render = VGroup).

### Phase 2.6 Effects (Drop Shadow + Round Corners — 2026-06-05)

Two more optional fields (absent ⇒ byte-identical legacy output):
- `shadow {color, opacity, dx, dy, blur}` — emits
  `_shadow_<n> = <n>.copy().set_color(...).set_opacity(...).shift([dxm, dym, 0])` +
  `<n> = VGroup(_shadow_<n>, <n>)` (shadow copy first/behind; `dym` is screen-down →
  Manim −y). `blur` is **preview-only** (Manim has no blur). Eligible types =
  `SHADOW_TYPES`. Store action `setShadow` (delete field on null).
- `cornerRadius` now also rounds **polygon/triangle/star** via native
  `.round_corners(radius=<cr/sw*FRAME_WIDTH>)` (rect/square keep `RoundedRectangle`).
- **Two distinct "round" sets**: inspector `ROUND_TYPES` / `canRound` =
  `{rectangle, square, polygon, triangle, star}` (which types show the control);
  codegen `roundCornersLine` emits `.round_corners()` for **only**
  `{polygon, triangle, star}`.
- **Keep codegen.js / manim.js `shadowLines`, `roundCornersLine`, `SHADOW_TYPES`
  byte-identical** — guarded by `phase26-effects-codegen.test.js` +
  `manim-export.test.js`. Effect order in the post-construction block:
  round_corners → gradient → dashed → shadow → move_to. Round-trip parser
  reconstructs both (`blur` restores to default 12).
- Preview: `applyEffects()` sets Konva native shadow props (`shadowBlur = blur*vs`)
  + corner rounding (`cornerRadius` on RegularPolygon/Star, `tension` approx on the
  closed-Line triangle).
- **Glow dropped** — Manim CE has no true blur/glow (a render would only stack
  scaled low-opacity copies = concentric rings, not a soft glow).

## Phase 2 Objects (Geometry / Calculus / Data — 2026-06-05)

Seven standalone object types + axes graph extensions, all following the
constructor → styling → single-line round-trip pattern:

- **Geometry**: `annulus` (`Annulus`), `arc` (`Arc`), `sector` (`Sector`),
  `double_arrow` (`DoubleArrow`) — radii in project px (convert via `FRAME_WIDTH`),
  angles in degrees emitted as `<deg> * DEGREES`.
- **`polygon_free`** (`Polygon`): `obj.vertices` (object-relative px) with draggable
  canvas vertex handles; presets in `engine/polygonVertices.js`.
- **`parametric`** (`ParametricFunction`): `obj.xExpr`/`yExpr` (t-based), `tMin`/`tMax`;
  expressions pass the `safeMathExpr` whitelist (kept in sync across codegen.js,
  manim.js, StageCanvas.vue); preview samples via `engine/mathExpr.js compileExpr`.
- **`matrix`** (`Matrix`): source of truth is `obj.matrixData` (2D string array) +
  `obj.bracket` (`'['` | `'('` | `'|'`); rows/cols are **derived, never stored**.
  Codegen emits single-line `Matrix([["a","b"],...])` (+ `left_bracket`/`right_bracket`
  for non-default brackets) then `.set_color(fill)`; entries are sanitized display
  strings via `safeMatrixEntry` (strips quotes/backslashes/newlines, **no eval**) —
  `matrix` is in **neither** GRADIENT_TYPES nor DASH_TYPES. Store actions:
  `setMatrixCell`, `add/removeMatrixRow`, `add/removeMatrixColumn`, `setMatrixBracket`
  (remove guards at 1×1). Composite Konva preview (`matrixHitCfg`/`matrixCellConfigs`/
  `matrixBracketConfigs`) with a listening hit rect; inspector grid editor in
  `PropertiesPanel.vue`. Round-trips single-line `Matrix([[...]])` only (nested-LaTeX
  entries limited). **Keep `safeMatrixEntry`/`matrixBrackets` + the `case 'matrix'`
  byte-identical across codegen.js and manim.js** — guarded by `manim-export.test.js`.
- **Axes graph extensions**: each `axes.graphs[]` item gains optional `area`
  (`get_area`) and `riemann` (`get_riemann_rectangles`) fields with full canvas preview.

## Phase 2.5 Relational Objects (Brace + Angle — 2026-06-05)

Two relational mobjects, defined by **their own object-relative px points** (no
dependency on other objects — the relational-reference and hybrid options were
rejected). Points convert with the `polygon_free` scale; the generic post-switch
`move_to` positions the object/group.

- **`brace`** (`BraceBetweenPoints`): fields `p1`/`p2` (object-relative px), `label`.
  Unlabeled = single line; labeled = `<n>_brace = BraceBetweenPoints(...)` +
  `<n> = VGroup(<n>_brace, <n>_brace.get_tex("..."))`.
- **`angle`** (`Angle`/`RightAngle`): fields `vertex`/`point1`/`point2`,
  `rightAngle` (bool), `radius`, `label`. Emitted via two helper `Line`s
  (`<n>_l1`/`<n>_l2`) then `Angle(<n>_l1, <n>_l2, radius=...)` or
  `RightAngle(<n>_l1, <n>_l2)`; labeled wraps the `<n>_arc` constructor in a VGroup.
- **Labels** use `get_tex("...")` with **non-raw, doubled-backslash escaping**
  (`safeLatex` helper) — same convention as the `latex` case; raw `r"..."` would
  reproduce the v3.6.0 literal-`int` bug.
- **Parser** (`manim.js`): captures the `_l1`/`_l2` helper Lines into `relLineMap`
  (so they don't become standalone `line` objects), reconstructs points from them on
  the `Angle`/`RightAngle` line, and attaches labels from the following `VGroup` +
  `get_tex` line (renaming the base var). `for..of` loop — cross-iteration state via
  `varMap`/`objById`/`relLineMap`.
- **Preview** (`StageCanvas.vue`): composite groups with a listening hit region;
  brace bulge / angle arc are **preview-only approximations**. Draggable point
  handles reuse the generalized `polygonHandles` computed (`kind: 'relational'`,
  named-point keys) + `onVertexDrag` branch.
- Store actions: `setRelationalPoint`, `setAngleRightMode`, `setAngleRadius`,
  `setRelationalLabel`. **Keep `safeLatex` + the `case 'brace'`/`case 'angle'`
  byte-identical across codegen.js and manim.js** — guarded by `manim-export.test.js`.
  Not in GRADIENT_TYPES/DASH_TYPES (stroke marks).

## Text & Math Animations (Phase 3 — 2026-06-06)

New object, new clip, and two entrance/exit presets, all emitted byte-identically by both `codegen.js` (server) and `manim.js` (client). Parity guarded by `manim-export.test.js`.

- **`transformExpr` helper** (byte-identical across both files): selects the Manim transform class for a `transform` clip. Raster source/target (`image`/`svg_asset`) → `FadeTransform`; `matchTerms: true` + both `latex` → `TransformMatchingTex`; `matchTerms: true` + other VMobjects → `TransformMatchingShapes`; absent `matchTerms` → `ReplacementTransform` (legacy, byte-identical). Applied in the sequential `singleClipCode` path and the parallel `animExpr` path. Round-trips via the unified `parseAnimExpr` transform branch (all four class names captured in one regex). **Keep `transformExpr` byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.
- **`counter` object** (`DecimalNumber`): fields `value`, `numDecimals`, `suffix`. Emits `DecimalNumber(<v>, num_decimal_places=<d>[, unit="<s>"])` — `unit=` only when `suffix` is non-empty. Not in GRADIENT_TYPES/DASH_TYPES. Canvas preview: a formatted number in a text node. Inspector controls: value spinner, decimals spinner, suffix input. **Keep `case 'counter'` byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.
- **`count` clip** (ValueTracker block): `{ type:'count', objectId, from, to, duration, easing }`. Emits 4 lines using a `_count_<clipid>` prefix (distinct from keyframe `_vt_<obj>_<prop>` to avoid parser collision). `animExpr` returns `null` so the clip is silently skipped inside a parallel `AnimationGroup`. Parser uses a dedicated `pendingCount` dict: the tracker-init line buffers `{ from, objVar }` keyed by tracker var; the `animate.set_value` line resolves it into a full clip. **Keep the `case 'count'` block byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.
- **Keyframable `value`** arm added to `_kfPropSet` (`<n>.animate.set_value(...)`) and `_kfUpdater` (`set_value`) in both generators, so `counter.value` works with all three keyframe codegen modes (`animate`, `ValueTracker`, `UpdateFromAlphaFunc`).
- **Typewriter presets**: `enterAnim: 'typewriter'` → `AddTextLetterByLetter(<n>)`, `exitAnim: 'typewriter_out'` → `RemoveTextLetterByLetter(<n>)`. Both emit as standard `self.play(...)` lines in the enter/exit step loops. Round-trip via enter/exit anim string parsers.
- **Preview ≈ render divergences** (accepted): Tex term-matching morph shows a generic crossfade in the canvas (Manim does the actual term alignment); typewriter timing is approximate (Manim scales letter delay to match `run_time`, preview does not); `counter` font metrics differ between Konva text preview and Manim `DecimalNumber`.

## Data & Coordinate Objects (Phase 4 — 2026-06-06)

Five new 2D object types, all emitted byte-identically by both `codegen.js` (server) and `manim.js` (client). Parity guarded by `manim-export.test.js`.

- **`table`** (`Table` / `MathTable`): field `cellData` (2D string array), `mathMode` (bool), `rowLabels` / `colLabels` (string[]). Text mode emits `Table([["a","b"],...])` on one line; math mode emits `MathTable([...], row_labels=[MathTex("..."),...], col_labels=[MathTex("..."),...])`; labels omitted when empty. Reuses the same `safeMatrixEntry` sanitizer and matrix grid editor as `matrix`. In math mode labels are emitted via `MathTex`; in text mode they would use `Text` but the inspector keeps them as bare strings (math mode is the main use-case). Not in GRADIENT_TYPES/DASH_TYPES. Store actions: `setTableCell`, `addTableRow`, `removeTableRow`, `addTableColumn`, `removeTableColumn`, `setTableMathMode`, `setTableRowLabels`, `setTableColLabels`; remove guards at 1×1; splice-to-dimension on shrink. **Keep `case 'table'` byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.

- **`complex_plane`** / **`polar_plane`** — mirror `numberplane`; both have `xRange`/`yRange` and `width`/`height` fields that convert to `x_length`/`y_length` via `FRAME_WIDTH`/`FRAME_HEIGHT`. `complex_plane` emits `ComplexPlane(x_range=[..], y_range=[..], x_length=.., y_length=..)`. `polar_plane` emits `PolarPlane(radius_max=.., radius_step=.., azimuth_units=.., size=..)` where `size` is derived from the object width. Polar canvas preview = concentric rings at `radiusStep` intervals + radial spoke lines at `azimuthUnits` divisions. Store actions: `setPolarRadiusMax`, `setPolarRadiusStep` (clamp ≥ 0.1), `setPolarAzimuth`. **Keep both cases byte-identical across codegen.js/manim.js.**

- **`graph`** (`Graph` / `DiGraph`): fields `vertices` (string[]), `edges` ([[a,b],...]), `positions` ({label:[px,py]}), `directed` (bool), `showLabels` (bool). Uses **manual vertex layout**: px→Manim via `polygon_free` scale (`x * FRAME_WIDTH / sw`, y with sign flip `-(y * FRAME_HEIGHT / sh)`). Emits `Graph(["A",...], [("A","B"),...], layout={"A":[x,y,0],...}[, labels=True])` or `DiGraph(...)` when `directed`. `labels=True` only emitted when `showLabels` is true. Draggable handles reuse the generalized `polygonHandles` computed (`kind: 'graphVertex'`, vertex-label keys) + `onVertexDrag`. Fill is preview/inspector-only — Manim `Graph` colors its own vertex dots. Parser reconstructs vertices/edges/positions/directed/showLabels from the `Graph`/`DiGraph` constructor line. Store actions: `addGraphVertex`, `removeGraphVertex` (cascades edges + positions), `addGraphEdge`, `removeGraphEdge`, `renameGraphVertex` (updates edges + positions keys), `setGraphVertexPosition`, `setGraphDirected`, `setGraphShowLabels`. **Keep `case 'graph'` byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.

- **`vector_field`** (`ArrowVectorField`): fields `fx`/`fy` (expression strings), `xRange`/`yRange`. Both expressions pass `safeMathExpr` (identical whitelist across `codegen.js`, `manim.js`, `StageCanvas.vue`); invalid expressions fall back to `'0'`. Emitted as a **double-lambda single-line form**: `ArrowVectorField(lambda p: (lambda x, y: np.array([fx, fy, 0]))(p[0], p[1]), x_range=[..], y_range=[..])`. Canvas preview samples an 8×8 arrow grid via the shared `isSafeExpr` / `compileExpr` pipeline. Parser reconstructs `fx`/`fy` by matching the double-lambda form. **KNOWN limitation**: expressions with a top-level comma (e.g. `max(x, y)`) do not round-trip cleanly through the double-lambda parser. Store actions: `setFieldExpr` (fx/fy), `setFieldRange` (xRange/yRange). **Keep `case 'vector_field'` byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.

- **Accepted preview ≈ render divergences**: table label alignment and cell spacing; plane axis labels; graph edge styling (Manim uses its own curved edges); vector-field sparsity (preview 8×8 sample, Manim samples densely).

## Build / Environment Gotchas (fixed in v3.3.1)

- **Vue 3 `<template v-for>` keys**: keys must sit on the `<template>` tag, not on child elements — a pure Vue 3 prod build (`npm run build`) errors otherwise. Watch for this when adding new keyed loops in `Topbar.vue` / `StageCanvas.vue`.
- **Renderer `setuptools<81` pin**: `manimcommunity/manim:stable` ships setuptools 82 (no `pkg_resources`), but `manim-voiceover` imports `pkg_resources` at load and crashes the whole `manim` CLI. `services/renderer/Dockerfile` pins `setuptools<81`. Revisit if the renderer base image or manim-voiceover drops the `pkg_resources` dependency.
- **`api_node_modules` named volume**: after adding an api dependency, run `docker volume rm manim_motion_api_node_modules` before `docker compose up` — named volumes don't refresh on image rebuild and will shadow new packages (`ERR_MODULE_NOT_FOUND`, unhealthy api).
