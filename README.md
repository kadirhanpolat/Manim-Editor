<div align="center">
  <img src="assets/ManimMotionLogo.svg" alt="Manim Motion Logo" width="400">
  
  # Manim Motion Editor
  
  **A Figma-like visual animation editor powered by Manim.**  
  Build mathematical animations by dragging shapes, writing LaTeX, creating morphs, and rendering cinematic videos -- all from your browser.  
  Or switch to **Code-Only mode** and write raw Manim Python with full library access.
</div>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/vue-3-4FC08D?logo=vue.js&logoColor=white" alt="Vue">
  <img src="https://img.shields.io/badge/manim-CE-orange?logo=python&logoColor=white" alt="Manim">
  <img src="https://img.shields.io/badge/node-20-339933?logo=node.js&logoColor=white" alt="Node">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/version-3.3.1-6B7280" alt="Version">
</p>

---

## Screenshots

*Current UI: desktop menubar, light/dark themes, and configurable canvas.*

| Light theme | Dark theme |
|-------------|------------|
| [![Light theme](docs/screenshots/light-main.png)](docs/screenshots/light-main.png) | [![Dark theme](docs/screenshots/dark-main.png)](docs/screenshots/dark-main.png) |
| *Main window (light)* | *Main window (dark)* |

| File menu (light) | File menu (dark) |
|-------------------|------------------|
| [![File menu light](docs/screenshots/light-file-menu.png)](docs/screenshots/light-file-menu.png) | [![File menu dark](docs/screenshots/dark-file-menu.png)](docs/screenshots/dark-file-menu.png) |

Screenshots are stored in `docs/screenshots/`. Replace or add PNGs there and update the paths above if you change the UI.

---

## Features

### Dual Editor Modes
- **Visual (UI) mode** -- Figma-style drag-and-drop canvas with shapes, timeline, and animations
- **Code-Only mode** -- Write raw Manim Python directly; full library access, no visual limitations; errors streamed back from the renderer
- **New Project wizard** -- Choose name and mode (Visual / Code) when creating a project; mode is saved with the project

### Visual Editor
- **Drag-and-drop stage** -- Canvas with optional grid, resize/rotate handles, multi-select, snapping; background color and opacity configurable in the Properties panel (no selection)
- **Light & Dark themes** -- Toggle between warm light and sleek dark palettes via View > Theme; persists across sessions
- **Desktop-style menubar** -- File, Edit, View, Tools, Help menus with keyboard shortcuts and responsive collapse
- **16 shape types (2D)** -- Rectangle, Square, Circle, Ellipse, Triangle, Star, Polygon, Arrow, Heart, Line, Dot, Dot Grid, Text, Image, SVG, and more
- **6 shape types (3D)** -- Sphere, Cube, Cone, Cylinder, Torus, ThreeDAxes — available when scene is switched to 3D mode
- **2D/3D scene toggle** -- Switch any visual project between 2D and 3D mode from the Topbar; 3D mode uses `ThreeDScene` base class
- **LaTeX math objects** -- Add `MathTex` expressions (e.g. `E = mc^2`) that render natively in Manim
- **Coordinate Axes** -- Configurable `Axes` with custom x/y ranges and tick steps; add function graphs (e.g. `x**2`, `sin(x)`) with color and range controls; canvas preview included
- **NumberPlane / NumberLine** -- Full-page coordinate grid and number line as standalone shape types
- **Asset uploads** -- Import PNGs, JPEGs, and SVGs; drag onto the canvas from the sidebar

### Animation & Timeline
- **Multi-track timeline** -- Up to 5 tracks with draggable, resizable animation clips
- **Transform morphing** -- Select two shapes and morph between them with customizable easing
- **Animation types** -- Transform, Move, Scale, Fade, Rotate with 17 easing functions
- **AnimationGroup / LaggedStart** -- Mark clips as parallel (`∥`) to run simultaneously; set `lag_ratio` for staggered starts; generates `AnimationGroup(...)` or `LaggedStart(..., lag_ratio=x)` in Manim
- **Path animation (MoveAlongPath)** -- Draw a Bezier path on the canvas (click to add points, double-click to finish); object follows the path with arc-length interpolation
- **Camera animations** -- Toggle Moving Camera mode (🎥); add camera clips to the dedicated camera track to pan and zoom; generates `MovingCameraScene` + `self.camera.frame.animate.move_to().set_width()` in Manim (2D) or `self.move_camera(phi=..., theta=...)` (3D)
- **Split viewport (3D)** -- In 3D mode, the canvas splits into perspective (isometric) + top-down (XZ) views; drag objects in either panel to position them; Blender/Unity style
- **Audio / Voiceover** -- Attach audio to any clip: upload `.mp3`/`.wav`/`.ogg`, synthesize with **gTTS** (online) or **Coqui TTS** (offline); auto-sync stretches clip duration to match audio; manual mode lets you set offset; generates `VoiceoverScene` + `with self.voiceover(audio=...)` in Manim
- **Timeline scrubbing** -- Arrange and trim clips; audio status stripe on clips; resize locked while auto-sync is active
- **Entrance / exit animations** -- 11 entrance and 9 exit animation presets per object
- **Keyframe animation** -- Per-property absolute-time keyframes independent of clips; add keyframe lanes to any numeric property (x, y, opacity, rotation, scale, x3d, y3d, z3d…); drag diamond markers to adjust timing; Bezier easing editor with draggable handles and Linear/Ease In/Out presets; 3 behavior modes (opt-in, override, additive) and 3 Python codegen modes (UpdateFromAlphaFunc, animate, ValueTracker) configurable per property; simultaneous 3D coordinate keyframes merged into a single `move_to([x, y, z])` call

### Code-Only Editor
- **Full Manim power** -- Write any valid Manim code (imports, custom classes, 3D scenes) and render it directly
- **Syntax-highlighted editor** -- Python code editing with highlight.js; same familiar UI chrome as visual mode
- **Asset integration** -- Upload images/SVGs in the sidebar; click to copy the file path for use in your code
- **Direct render** -- Code is written as `scene.py` and executed by the Manim worker; full stdout/stderr visible in the render dialog
- **Error feedback** -- Manim tracebacks and compilation errors are shown in the render log panel

### Workflow
- **Undo / Redo** -- Full history stack (Ctrl+Z / Ctrl+Shift+Z) with 50-state memory
- **Copy / Paste** -- Duplicate objects with offset (Ctrl+C / Ctrl+V)
- **Generated Code view** -- Manim Python generated from your canvas; edit, copy, or download `.py`
- **Server rendering** -- One-click HQ render via Docker (480p to 4K) with progress tracking
- **Project management** -- Save/load locally (JSON) or sync to Docker server

---

## Quick Start

### Full Stack with Docker (Recommended)

```bash
git clone https://github.com/BlommeJan/Manim-Motion.git
cd Manim-Motion
docker compose up --build
```

Open **http://localhost:8080** in your browser. Everything works out of the box -- editor, API, render queue, and Manim renderer.

### Editor Only (No Docker)

```bash
cd services/web
npm install
npm run dev
```

Open **http://localhost:5173**. You can build scenes and export Manim scripts. Server features (render, project sync) require Docker.

### Deploy Website (Netlify)

The marketing site in `website/` deploys to Netlify via `netlify.toml`. Connect the repo to Netlify; build settings are read from the config (base: `website`, publish: `dist`).

---

## Architecture

```
Browser (localhost:8080)
  |
  |-- Nginx (serves Vue SPA, proxies /api/)
  |
  |-- Vue 3 + Konva.js
  |     |-- Stage Canvas (shapes, grid, morphs, transformer)
  |     |-- Properties Panel (object/clip editing)
  |     |-- Timeline (multi-track, drag clips)
  |     |-- Asset Sidebar (shapes, uploads)
  |     |-- Timeline (multi-track, clips)
  |     |-- Manim Exporter (client-side .py generation)
  |
  |-- /api/ --> Node.js + Express (port 3000)
  |     |-- Project CRUD (JSON on shared volume)
  |     |-- Asset upload (multipart + base64)
  |     |-- Audio upload + TTS job dispatch
  |     |-- Compiler: validate -> normalize -> codegen (scene.py)
  |     |-- Render trigger -> Redis queue
  |     |-- WebSocket push (render + audio events)
  |
  |-- Redis (job queue)
  |
  |-- Manim Renderer (Python worker, manim-voiceover)
  |     |-- Polls Redis for render jobs
  |     |-- Runs: manim -qh scene.py MainScene
  |     |-- Outputs MP4 to shared volume; uses VoiceoverScene for audio clips
  |     |-- Updates job status in Redis
  |
  |-- Audio Worker (Python, gTTS / Coqui TTS)
        |-- Polls Redis audio:queue:gtts (or audio:queue:coqui with --profile coqui)
        |-- Generates WAV → /data/assets/audio/
        |-- POSTs completion to API → WebSocket push to browser
```

**Shared Docker volume** (`manim_motion_data` at `/data`):
- `projects/` -- Project JSON + generated `scene.py`
- `assets/` -- Uploaded images/SVGs per project
- `assets/audio/` -- Generated and uploaded audio files (`.wav`)
- `renders/` -- Output MP4 files per project

---

## How It Works

### 1. Add Shapes
Click shapes in the left sidebar (including LaTeX and Axes). They appear on the stage and on the timeline.

### 2. Position and Style
Drag shapes on the canvas. Edit fill, stroke, opacity, size, rotation in the Properties panel. LaTeX objects have a formula editor; Axes objects have configurable ranges.

### 3. Create Animations
- **Transform**: Select two shapes (click + Shift+click), then click "Create Transform"
- **Quick Animate**: Select one shape, click Move/Scale/Fade/Rotate in the Properties panel

### 4. Edit Timeline
- Drag clips to change start time
- Resize clip edges to change duration
- Click clips to edit easing, overshoot, morph quality

### 5. Generated Code
Click the **Code** tab to see the Manim Python generated from your canvas. Copy or download the `.py` file. Scrub the timeline to review your edit structure.

### 6. Render
Click **Tools > Render HQ** in the menubar. Choose quality (Low/Medium/High/4K) and click Start Render. The project is saved to the server, compiled to a Manim scene, and rendered. When done, watch and download the MP4.

### 7. Code View & Export
The **Code** tab shows the generated Manim Python with syntax highlighting. Edit the code if needed, or copy/download the `.py` file to use elsewhere.

### 8. Export
Click **File > Export .py** to download a standalone `scene.py` you can run locally with `manim -qh scene.py MainScene`.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `V` | Select tool |
| `H` | Hand (pan) tool |
| `Delete` | Delete selected object/clip |
| `Escape` | Deselect all, close dialogs |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy selected objects |
| `Ctrl+V` | Paste copied objects |
| `Ctrl+S` | Save to file |
| `Ctrl+G` | Group selected objects |
| `Shift+Click` | Multi-select objects |
| `Scroll` | Zoom canvas |

---

## Data Model

```
Project
 +-- id, name, sceneDuration
 +-- cameraType: 'static' | 'moving'
 +-- cameraTrack[]: { id, type:'camera_move', startTime, duration, easing,
 |                    params: { targetX, targetY, zoom } }
 +-- stage: { width, height, backgroundColor, grid*, snap* }
 +-- objects[]: { id, type, name, x, y, width, height, rotation,
 |               fill, stroke, opacity, zOrder, enterTime, duration,
 |               enterAnim, exitAnim, latex?, xRange?, yRange?, assetId?,
 |               graphs?: [{ id, expression, color, xMin, xMax, strokeWidth }],
 |               keyframes?: { propName: [{ time, value, easing: { type, handles? } }] },
 |               keyframeMode?: { propName: 'opt-in' | 'override' | 'additive' },
 |               keyframeCodegen?: { propName: 'UpdateFromAlphaFunc' | 'animate' | 'ValueTracker' } }
 +-- groups[]: { id, name, childIds[], margin, collapsed }
 +-- tracks[]: { id, name, clips[] }
 |    +-- clip: { id, type, startTime, duration, easing,
 |                sourceId, targetId?, params, overshoot, morphQuality,
 |                parallel, lag_ratio, path?,
 |                audio?: { type, src, text?, lang, syncMode, offset,
 |                          status, duration? } }
 +-- assets[]: { id, name, type, filename, dataUrl?, width, height }
```

**Object types (2D)**: `rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`, `heart`, `dot`, `dot_grid`, `text`, `image`, `svg_asset`, `latex`, `axes`, `numberplane`, `numberline`

**Object types (3D)**: `sphere`, `cube`, `cone`, `cylinder`, `torus`, `axes3d` — only when `sceneType: '3d'`

**Clip types**: `transform` (morph A->B), `move`, `scale`, `fade`, `rotate`, `path_move` (MoveAlongPath), `camera_move` (MovingCameraScene / ThreeDScene)

**Parallel clips**: Any clip can be marked `parallel: true` with a `lag_ratio` to group with adjacent clips into `AnimationGroup` / `LaggedStart`.

**Easing functions** (17): linear, ease_in, ease_out, ease_in_out, cubic/quart variants, back variants, elastic in/out, bounce, spring

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create new project |
| `GET` | `/api/projects/:id` | Get project by ID |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project + assets + renders |
| `POST` | `/api/projects/:id/render` | Compile + enqueue render job |
| `POST` | `/api/assets/:projectId` | Upload file (multipart) |
| `POST` | `/api/assets/:projectId/base64` | Upload base64 data URL |
| `GET` | `/api/assets/:projectId/:filename` | Serve asset file |
| `POST` | `/api/audio/upload` | Upload audio file; returns `{ src, duration, status }` |
| `POST` | `/api/audio/tts` | Create TTS job; body: `{ clipId, type, text, lang }` |
| `GET` | `/api/audio/:jobId/status` | Poll TTS job status |
| `DELETE` | `/api/audio/:audioId` | Delete audio file |
| `GET` | `/api/jobs/:jobId` | Poll render job status |
| `GET` | `/api/renders/:projectId/latest.mp4` | Stream latest render |
| `GET` | `/health` | Health check |
| `WS` | `/ws` | Job events: subscribe render (`subscribe`) + audio (`subscribe_audio`) |

---

## Project Structure

```
Manim-docker/
+-- docker-compose.yml
+-- services/
    +-- web/                          # Vue frontend
    |   +-- src/
    |   |   +-- App.vue               # Root: dialogs, shortcuts
    |   |   +-- api.js                # API client
    |   |   +-- store/project.js      # State, history, clipboard, theme
    |   |   +-- styles/main.css       # Theme tokens, light/dark palettes
    |   |   +-- engine/               # Playback engine
    |   |   |   +-- geometry.js       # Shape point generation
    |   |   |   +-- easing.js         # 17 easing functions
    |   |   |   +-- transform.js      # Morph interpolation
    |   |   |   +-- playback.js       # rAF loop
    |   |   |   +-- blending.js       # Multi-track blending
    |   |   +-- export/manim.js       # Client-side .py generator
    |   |   +-- components/
    |   |       +-- topbar/           # Desktop menubar (File, Edit, View, Tools, Help)
    |   |       +-- sidebar/          # Shapes, assets, transform
    |   |       +-- stage/            # Konva canvas
    |   |       +-- inspector/        # Properties panel
    |   |       +-- timeline/         # Tracks, clips, playback
    |   +-- nginx.conf
    |   +-- Dockerfile
    |
    +-- api/                          # Node.js backend
    |   +-- src/
    |   |   +-- index.js              # Express server
    |   |   +-- queue.js              # Redis queue
    |   |   +-- routes/               # REST endpoints
    |   |   +-- compiler/             # Manim code generation
    |   |       +-- validator.js      # Zod schema validation
    |   |       +-- normalizer.js     # Data normalization
    |   |       +-- codegen.js        # Python code generation
    |   +-- Dockerfile
    |
    +-- renderer/                     # Manim worker (manim-voiceover)
    |   +-- worker.py                 # Redis consumer + manim exec
    |   +-- Dockerfile
    |
    +-- audio/                        # TTS audio worker
        +-- worker.py                 # gTTS / Coqui Redis consumer
        +-- Dockerfile                # gTTS image (default)
        +-- Dockerfile.coqui          # Coqui TTS image (--profile coqui)
        +-- requirements.txt
        +-- requirements.coqui.txt
```

---

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **web** | nginx:alpine | 8080 | Vue SPA + API proxy |
| **api** | node:20-alpine | 3000 | REST API, compiler |
| **renderer** | manimcommunity/manim | -- | Render worker + manim-voiceover |
| **audio** | python:3.11-slim | -- | gTTS worker (always on) |
| **audio-coqui** | python:3.11-slim | -- | Coqui TTS worker (`--profile coqui`) |
| **redis** | redis:7-alpine | 6379 | Job queue |
| **init** | alpine:3.19 | -- | Creates /data dirs |

Start with Coqui TTS enabled (~1.5 GB model download on first run):
```bash
docker compose --profile coqui up --build
```

### Security

All Docker containers run with **least-privilege non-root users**:
- **web** runs as `nginx` user (UID 1000)
- **api** runs as `node` user (UID 1000)
- File permissions set with `--chown` flags during build

**API hardening**: Helmet.js security headers, rate limiting on render endpoints (5 req/min/IP), input sanitization against injection.

### Render Quality

| Quality | Flag | Resolution | FPS |
|---------|------|------------|-----|
| Low | `-ql` | 480p | 15 |
| Medium | `-qm` | 720p | 30 |
| High | `-qh` | 1080p | 60 |
| 4K | `-qk` | 4K | 60 |

### Environment Variables

- `DATA_DIR` -- Shared volume path (default: `/data`)
- `REDIS_URL` -- Redis connection (default: `redis://redis:6379`)
- `PORT` -- API port (default: `3000`)

---

## Running Tests

```bash
cd services/web
npm test          # 105 engine tests (easing, geometry, transform, blending, keyframe interpolation)
npm run test:unit # 109 unit tests (store, templates, graphs, parallel clips, path, camera, audio, keyframe, manim export, 3D scene)
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Render fails** | Check `docker compose logs renderer` for Manim errors. Ensure all services are running: `docker compose ps` |
| **API not reachable** | Run `curl http://localhost:3000/health` -- should return `{"status":"ok"}`. Check `docker compose logs api` |
| **Images not loading** | Upload via the sidebar (stored as base64). Assets auto-sync to server on render |
| **Playback stutters** | Reduce morph quality in clip properties. Close DevTools. Use Chrome/Edge for best performance |

---

## Tech Stack![1775491376876](image/README/1775491376876.png)![1775491379141](image/README/1775491379141.png)![1775491380665](image/README/1775491380665.png)![1775491383028](image/README/1775491383028.png)

- **Frontend**: Vue 3, Pinia, Konva.js, Tailwind CSS (with CSS-variable theming), Vite
- **Backend**: Node.js 20, Express, Multer, Zod, Redis
- **Renderer**: Python, Manim Community Edition
- **Infrastructure**: Docker Compose, Nginx, Alpine Linux

---

## Documentation

For detailed technical docs of the entire codebase, see **[XTRA-BIG-README.md](XTRA-BIG-README.md)** -- includes architecture diagrams, complete API reference, data models, file-by-file breakdown, animation engine internals, compiler pipeline details, and development guide.

---

## Changelog

### v3.3.1 (current)

Bug-fix release — three latent defects that broke a clean Docker build / first render from scratch:

- **Fix (web build)**: `<template v-for>` keys were placed on child elements, which a pure Vue 3 production build rejects (`<template v-for> key should be placed on the <template> tag`). Relocated keys onto the `<template>` tags in `Topbar.vue` (3 loops) and `StageCanvas.vue` (16 objects); the text node's `fontLoadKey`-driven re-render is preserved via the template key. `npm run build` now succeeds (418 modules).
- **Fix (renderer)**: Manim failed to start with `ModuleNotFoundError: No module named 'pkg_resources'`. The `manimcommunity/manim:stable` base now ships Python 3.14 + **setuptools 82**, which removed `pkg_resources`; `manim-voiceover` imports it at module load, so the plugin entry-point crashed and took the whole `manim` CLI down — breaking renders even for projects with no audio. Pinned `setuptools<81` in `services/renderer/Dockerfile`.
- **Ops note**: the `api` service mounts a named volume `api_node_modules:/app/node_modules`. Named volumes are populated once and are not refreshed on image rebuild, so a newly added dependency (e.g. `ws`) can be shadowed by stale contents, surfacing as `ERR_MODULE_NOT_FOUND` and an unhealthy `api`. After changing api dependencies, run `docker volume rm manim_motion_api_node_modules` before `docker compose up`.

### v3.3.0

- **Feature**: 3D scene support — switch any project to 3D mode via the Topbar toggle; generates `ThreeDScene` base class with `set_camera_orientation(phi, theta, zoom)`
- **Feature**: 6 new 3D shape types — Sphere, Cube, Cone, Cylinder, Torus, ThreeDAxes; positioned with `x3d/y3d/z3d` in Manim units
- **Feature**: Split viewport — 3D mode shows isometric (perspective) + top-down (XZ) side-by-side views; drag shapes in either panel; divider adjustable
- **Feature**: Position3DPanel in Inspector — x/y/z position, rotation (rx/ry/rz), resolution, and axis range inputs for 3D objects
- **Feature**: 3D camera animate — `camera_move` clips generate `self.move_camera(phi, theta, zoom, run_time)` in 3D scenes
- **Feature**: 3D rotate axis — rotate clips on 3D objects expose X/Y/Z axis selector; generates `Rotate(obj, angle=..., axis=RIGHT/UP/OUT)`
- **Feature**: Keyframe 3D — `x3d/y3d/z3d` properties supported as keyframe lanes; simultaneous coordinate keyframes are merged into a single `move_to([x, y, z])` to avoid overwrite
- **Feature**: VoiceoverScene mixin — 3D scenes with audio use `class Scene(ThreeDScene, VoiceoverScene):`
- **Tests**: 31 new tests — 3D store (8), codegen (9), viewport (6), Layer 3 (4), Layer 4 (4); total 109 unit + 105 engine

### v3.2.0

- **Feature**: Keyframe animation system — per-property absolute-time keyframes independent of clips; survives clip deletion
- **Feature**: Keyframe lanes in Timeline — select a clip to reveal per-property keyframe lanes below it; double-click lane to add a keyframe at that time; drag diamond markers to move keyframes; right-click to delete
- **Feature**: Bezier easing popup — click the segment between two keyframes to open a floating easing editor with draggable SVG handles and Linear / Ease In / Ease Out / Ease In-Out presets
- **Feature**: `KeyframePanel` in Inspector — shows selected keyframe's time, value editor, and mode selector (opt-in / override / additive); delete button
- **Feature**: 3 behavior modes per property — `opt-in` (active only within keyframe range), `override` (always replaces clip value), `additive` (adds to clip value)
- **Feature**: 3 Python codegen modes per property — `UpdateFromAlphaFunc` (interpolation function + `UpdateFromAlphaFunc`), `animate` (sequential `obj.animate` calls), `ValueTracker` (`ValueTracker` + `add_updater`)
- **Feature**: `project.keyframeDefaults` — project-level fallback mode and codegenMode; configurable in Settings
- **Engine**: `services/web/src/engine/keyframe.js` — `interpolateKeyframes` (binary search + Newton-Raphson cubic Bezier solver), `getKeyframeRange`
- **Playback**: `_applyKeyframeOverrides` in `playback.js` — applied after clip blending, before enter/exit anims; skips objects with no keyframes (zero-cost fast path at 60fps)
- **Codegen**: `generateKeyframeSteps` added to both `codegen.js` (server) and `manim.js` (client) in sync
- **Tests**: 31 new tests — 16 engine (Bezier solver, interpolation edge cases) + 13 store (all 7 keyframe actions + undo) + 3 codegen (no-keyframe regression, animate mode, UpdateFromAlphaFunc mode); total 78 unit + 105 engine

### v3.1.0

- **Refactor**: Vue 2.7 → Vue 3 — pure Vue 3 with no compat shims
- **Refactor**: `Vue.observable` store → Pinia `defineStore`; `Vue.set` → direct assignment
- **Refactor**: All components migrated from Options API → `<script setup>` Composition API
- **Refactor**: `@vue/test-utils@1` → `@vue/test-utils@2`; test files use Pinia setup pattern
- **Removed**: `@vue/compat` bridge; all backward-compat store exports (`store`, `actions`, `getters`)

### v3.0.0

- **Feature**: Audio / Voiceover — attach audio to any clip; supports file upload (`.mp3`/`.wav`/`.ogg`), gTTS synthesis (online), and Coqui TTS (offline, `--profile coqui`)
- **Feature**: Per-clip audio sync — `auto` mode stretches clip duration to match audio; `manual` mode preserves clip duration with configurable offset
- **Feature**: `AudioPanel` Inspector tab — source selector, TTS text/language input, Generate button with live status (`pending` → `ready`/`error`), sync controls
- **Feature**: Timeline audio strip — status-colored badge below each clip; resize handles locked while auto-sync is active
- **Feature**: `VoiceoverScene` codegen — both `codegen.js` and `manim.js` detect audio clips and emit `VoiceoverScene` + `GTTSService` + per-clip `with self.voiceover(audio=...)` blocks
- **Feature**: Render lock — render button disabled (with tooltip) while any audio job is `pending`
- **Service**: New `audio` Docker service — Python + ffmpeg + gTTS; polls `audio:queue:gtts` Redis queue
- **Service**: New `audio-coqui` Docker service — optional Coqui TTS via `--profile coqui`; polls `audio:queue:coqui`
- **API**: New `/api/audio` endpoints — upload, TTS job creation, worker callback, delete
- **WebSocket**: `subscribe_audio` message type + `broadcastAudioEvent` for real-time audio job updates
- **Renderer**: `manim-voiceover[gtts]` added to renderer image
- **Tests**: 15 new unit tests (8 store audio actions + 7 codegen VoiceoverScene); total 62 unit + 89 engine

### v2.1.0

- **Fix**: Client-side exporter (`manim.js`) now supports all Phase 2 features — `NumberPlane`, `NumberLine`, `axes` function graphs, `AnimationGroup`/`LaggedStart` parallel grouping, `path_move` (VMobject + MoveAlongPath), `camera_move` + `MovingCameraScene`; output is semantically equivalent to server-side `codegen.js`
- **Feature**: `manim.js` parser updated — all Phase 2 Python constructs now round-trip back to project JSON; returns `cameraType` and `cameraTrack`; stateful VMobject→MoveAlongPath parsing; bracket-depth AnimationGroup/LaggedStart parsing
- **Fix**: Camera preview in StageCanvas.vue — replaced CSS transform approximation with Konva-level `vs`/`ox`/`oy` pipeline; camera zoom and pan now correctly integrated into the Konva coordinate system
- **Fix**: `applyCodeToCanvas()` in App.vue — applies `cameraType` and `cameraTrack` from parser result when loading Code-Only mode scenes
- **Tests**: 18 new generator + parser tests; total 47 unit tests

### v2.0.0

- **Feature**: Function graphs on Axes — add `f(x) = x**2`, `sin(x)` etc. from the Inspector; canvas shows live curve preview; generates `axes.plot(lambda x: ...)` in Manim
- **Feature**: NumberPlane and NumberLine — new shape types with full codegen support
- **Feature**: AnimationGroup / LaggedStart — mark any clip as parallel (`∥`) with a `lag_ratio`; timeline badge indicator; generates `AnimationGroup(...)` or `LaggedStart(..., lag_ratio=x)`
- **Feature**: Path animation (MoveAlongPath) — click to draw a path on the canvas, double-click to finish; object follows the path; generates `VMobject` + `MoveAlongPath` in Manim
- **Feature**: Camera animations — 🎥 toggle activates `MovingCameraScene`; camera track in timeline; generates `self.camera.frame.animate.move_to().set_width()` with absolute zoom
- **Fix**: `RenderPanel.vue` render button always disabled — `store.project.elements` corrected to `store.project.objects`
- **Fix**: `api.js` duplicate `renders.list` removed — all callers now use `renders.getInfo`
- **Fix**: `templates/index.js` uid collision — replaced Math.random-based uid with the store's counter+timestamp uid
- **Security**: Graph expression whitelist validation in both codegen and canvas preview (`new Function`) to prevent injection

### v1.2.0

- **Fix**: Easing mapping — 7 yanlış/eksik `EASING_MAP` girişi düzeltildi; `ease_in_out_cubic → rate_functions.ease_in_out_cubic`, `spring → rate_functions.ease_out_elastic`, 5 eksik easing (`ease_in/out_quart`, `ease_in_out_quart/back`, `ease_in/out_elastic`) eklendi
- **Feature**: WebSocket render takibi — 2 saniyelik client-side polling, server-side 500ms Redis poll + WebSocket push ile değiştirildi; `GET /ws` üzerinden anlık iş güncellemeleri
- **Feature**: Vitest test altyapısı — `npm run test:unit` ile Vue 2 uyumlu unit testler; `@vue/test-utils@1`, jsdom ortamı
- **Feature**: 5 proje şablonu — "New Project" diyaloğuna şablon seçici eklendi: Boş Proje, Formül Tanıtım, Şekil Dönüşümü, Başlık Slaydı, Koordinat Sistemi
- **Feature**: Paralel render worker — `docker-compose.yml`'e `renderer-2` servisi eklendi; aynı Redis kuyruğundan iki iş eş zamanlı işlenebilir
- **Feature**: Render geçmişi — Her render sonunda tarihli kopya (`render_YYYYMMDD_HHMMSS.mp4`) kaydedilir, son 5 kopya tutulur; render diyaloğunda geçmiş listesi ve indirme bağlantıları

### v1.1.0

- **Feature**: Dual editor modes -- choose **Visual (UI)** or **Code Only** when creating a new project
- **Feature**: Code-Only mode provides full Manim library access; write raw Python, render directly, see errors in-app
- **Feature**: New Project dialog with name input and mode selection (Visual / Code)
- **Feature**: Asset sidebar shows "copy path" helper in code mode for easy file references
- **Feature**: Dedicated `POST /api/projects/:id/render-code` endpoint for raw Manim source rendering
- **Data model**: Projects now include `editorMode` and `codeSource` fields; backward-compatible with existing projects (default to `visual`)

### v1.0.1

- **Fix**: Corrected `git clone` command in README to use the actual repository URL and correct directory name

### v1.0.0

- **Version bump**: Project version set to 1.0.0

### v0.11.1

- **Stage canvas**: Fixed shift-click multi-select when the selection transformer overlaps another object (e.g. dot + heart); now queries the objects layer for the shape under the cursor and adds it to selection

### v0.11.0

- **Deployment**: Added `netlify.toml` for one-click Netlify deployment of the marketing website

### v0.10.0

- **Website**: Accessibility (drawer focus trap, cursor fallback, reduced-motion), marquee gradient refinement, inline styles cleanup, shader pause on reduced-motion and tab visibility, font preload, animation easing (ease-out-quart), code panel indentation fix, removed GitHub nav link

### v0.9.1

- **Preview-render alignment**: Fixed Manim coordinate mapping to use official frame dimensions (14.22×8); scale-based shapes (square, circle, star, polygon, etc.) now match final render
- **Properties panel**: Size params now match preview — symmetric shapes show single "Size", line/arrow show "Length", text omits width/height
- **Favicon**: Fixed path so favicon loads correctly at `/ManimMotionLogoNoTextNoBG.svg`

### v0.9.0

- **Display-render parity**: Fixed heart scale in Manim codegen — was ~7× too large; now matches the canvas preview by normalizing x/y independently
- **Arrow rendering**: Added `buff=0`, proportional `tip_length`, and `stroke_width` to Manim Arrow output so rendered arrows match the canvas preview
- **Label consistency**: Renamed "5x5 Grid" / "5x5 Dot Grid" to "Dot Grid", "Hexagon" to "Polygon", "Rect" to "Rectangle" across all UI components
- **Docker dev workflow**: Added API source bind mount with `node --watch` auto-reload; added `web-dev` service (Vite HMR) via `docker compose --profile dev up`; Vite proxy target configurable via `VITE_API_TARGET`
- **Interface audit**: Unified type labels in PropertiesPanel, Toolbar, and AssetSidebar; added Polygon mapping to type badge

### v0.8.0

- **Docker & UI**: Updated Docker configuration; enhanced UI theming (light/dark themes, menubar)

### v0.7.0

- **Documentation**: Enhanced README and documentation with new features and updates

### v0.6.0

- **Style panel**: Hardened inputs with validated color picker
- **API security**: Implemented security middleware (Helmet, rate limiting, input sanitization)

### v0.5.0

- **Infrastructure**: Optimized Docker Compose with resource limits and health checks

### v0.4.0

- **Security**: Implemented non-root Docker containers for web and API services

### v0.3.0

- **Documentation**: Added XTRA-BIG-README.md with architecture diagrams, API reference, data models, and development guide

### v0.2.0

- **Initial features**: Core editor, shapes, timeline, Manim export, Docker stack

### v0.1.0

- **Project bootstrap**: Vue frontend, Node.js API, Manim renderer, Redis queue

### v0.0.0

- **Initial commit**: Project scaffold and GitHub backup

## License

MIT

---

## Acknowledgments

- [Manim Community Edition](https://www.manim.community/) -- Mathematical animation engine
- [Vue.js](https://vuejs.org/) -- Progressive JavaScript framework
- [Konva.js](https://konvajs.org/) -- 2D canvas library
- [Tailwind CSS](https://tailwindcss.com/) -- Utility-first CSS
