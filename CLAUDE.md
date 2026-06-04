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

`transform`, `move`, `scale`, `fade`, `rotate`, `path_move`, `camera_move`

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

**2D:** `rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`, `heart`, `dot`, `dot_grid`, `text`, `image`, `svg_asset`, `latex`, `axes`, `numberplane`, `numberline`

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

## Build / Environment Gotchas (fixed in v3.3.1)

- **Vue 3 `<template v-for>` keys**: keys must sit on the `<template>` tag, not on child elements — a pure Vue 3 prod build (`npm run build`) errors otherwise. Watch for this when adding new keyed loops in `Topbar.vue` / `StageCanvas.vue`.
- **Renderer `setuptools<81` pin**: `manimcommunity/manim:stable` ships setuptools 82 (no `pkg_resources`), but `manim-voiceover` imports `pkg_resources` at load and crashes the whole `manim` CLI. `services/renderer/Dockerfile` pins `setuptools<81`. Revisit if the renderer base image or manim-voiceover drops the `pkg_resources` dependency.
- **`api_node_modules` named volume**: after adding an api dependency, run `docker volume rm manim_motion_api_node_modules` before `docker compose up` — named volumes don't refresh on image rebuild and will shadow new packages (`ERR_MODULE_NOT_FOUND`, unhealthy api).
