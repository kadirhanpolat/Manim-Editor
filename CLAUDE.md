# Manim Motion Editor — Claude Code Instructions

## Project Overview

Browser-based Figma-like animation editor for Manim CE. 5 Docker services: Vue 2.7 + Konva.js frontend (Nginx :8080), Node.js/Express API (:3000), Python Manim CE renderer worker, Python audio TTS worker, Redis 7 job queue. Shared Docker volume at `/data`.

## Architecture

```
services/web/        # Vue 2.7 frontend (Vite, Vitest)
services/api/        # Node.js/Express API + Manim codegen
services/renderer/   # Python Manim worker (polls Redis) + manim-voiceover
services/audio/      # Python TTS worker (gTTS; Coqui via --profile coqui)
```

## Running Tests

```bash
# Unit tests (store, components, export) — 62 tests
cd services/web && npm run test:unit

# Engine tests (easing, geometry, transform) — 89 tests
cd services/web && npm test

# Both must pass before any commit
```

## Key Files

| File | Purpose |
|------|---------|
| `services/web/src/store/project.js` | Vue.observable store — all project state, actions, getters |
| `services/web/src/engine/playback.js` | 60fps rAF playback engine — evaluates clips, computes frame state |
| `services/api/src/compiler/codegen.js` | Generates Python Manim code from project JSON (server-side) |
| `services/web/src/export/manim.js` | Client-side .py generator + parser (mirrors codegen.js semantics) |
| `services/web/src/components/stage/StageCanvas.vue` | Konva.js canvas — renders all object types; camera preview via vs/ox/oy |
| `services/web/src/components/inspector/Inspector.vue` | Object + clip property editor (Layout, Style, Timing, Animation, Audio panels) |
| `services/web/src/components/inspector/AudioPanel.vue` | Per-clip audio: file upload, gTTS/Coqui TTS, sync mode |
| `services/web/src/components/timeline/Timeline.vue` | Multi-track timeline + camera track |
| `services/api/src/routes/audio.js` | Audio upload, TTS job, worker callback, delete endpoints |
| `services/api/src/ws.js` | WebSocket push for render and audio job events |
| `services/audio/worker.py` | gTTS / Coqui TTS Redis consumer; POSTs completion to API |

## Coordinate Systems

- **Project coords**: 0–1920 (x), 0–1080 (y), origin top-left
- **Manim coords**: `stageToManim(px, py, sw, sh)` → approx −7 to +7 (x), −4 to +4 (y)
- **Canvas coords**: Use `c2s(cx, cy)` / `s2c(px, py)` in StageCanvas.vue — accounts for pan offset (`ox`, `oy`) and zoom (`vs`)

## Store Patterns

```js
// Vue 2 reactivity — always use Vue.set for new properties on existing objects
Vue.set(obj, 'newProp', value);

// uid() is exported from store/project.js — use it everywhere
import { uid } from '../store/project.js';

// Actions commit state for undo
actions.commitState();  // required after mutations that should be undoable
store.isDirty = true;   // mark unsaved changes
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

`rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`, `heart`, `dot`, `dot_grid`, `text`, `image`, `svg_asset`, `latex`, `axes`, `numberplane`, `numberline`

`axes` objects have a `graphs: []` array — each graph has `{ id, expression, color, xMin, xMax, strokeWidth }`.

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
- Codegen: `MovingCameraScene` base class + `self.camera.frame.animate.move_to().set_width(14/zoom)`
- Delete key and inspector work for camera clips (handled separately from regular clips in App.vue)

## Audio / Voiceover

- **Flow**: `AudioPanel` → `POST /api/audio/tts` → Redis `audio:queue:gtts` → `services/audio/worker.py` → WAV to `/data/assets/audio/` → `POST /api/audio/:jobId/complete` → `broadcastAudioEvent` WebSocket → `actions.setClipAudio`
- **File upload** skips the queue: `POST /api/audio/upload` stores file directly, runs ffprobe for duration, returns `{ src, duration, status: 'ready' }`.
- **Codegen priority**: `MovingCameraScene` > `VoiceoverScene` > `Scene`. Clips with `audio.status === 'ready'` generate `with self.voiceover(audio="...") as tracker_<clipId>:` blocks.
- **Render lock**: `getters.hasPendingAudio()` disables render button in `App.vue`, `RenderPanel.vue`, and `Topbar.vue`.
- **Coqui TTS** (optional): start with `docker compose --profile coqui up`; the `audio-coqui` service handles `audio:queue:coqui` jobs.
- **Keep `manim.js` and `codegen.js` in sync** for voiceover logic, same as for all other clip/object types.

## Testing Conventions

- Test files: `services/web/tests/components/*.test.js`
- Import store: `import { store, actions, getters } from '../../src/store/project.js'`
- Reset before each test: `actions.newProject('Test', 'visual'); actions.commitState();`
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
- Parser: all of the above in reverse (`.py` → project JSON); returns `cameraType` and `cameraTrack`

**Keep `manim.js` and `codegen.js` semantically in sync.** When adding a new object or clip type, update both.

## Technical Debt (known)

- `FRAME_WIDTH = 14 + 2/9` used in `manim.js` vs `14` in `codegen.js` — ~0.065 Manim unit divergence at stage edges
