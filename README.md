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
  <img src="https://img.shields.io/badge/version-3.16.0-6B7280" alt="Version">
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
- **35+ shape types (2D)** -- Rectangle, Square, Circle, Ellipse, Triangle, Star, Polygon, Arrow, Heart, Line, Dot, Dot Grid, Text, Image, SVG, plus the Phase 2 set: Annulus, Arc, Sector, Double Arrow, Free Polygon (draggable vertices), Parametric curve, Matrix (grid editor), **Counter** (animated `DecimalNumber`, with an Integer mode → `Integer` mobject), the Phase 4 set: **Table** (Table/MathTable with row/col labels), **Complex Plane**, **Polar Plane**, **Graph** (Graph/DiGraph with manual vertex layout), **Vector Field** (ArrowVectorField with sampled-arrow preview), and the object-library extensions: **Vector Components** (x/y projection arrows), **Ray** (source dot + direction arrow), **Coord Point** (live `(x, y)` label via `always_redraw`), and **Bezier** (smooth open curve through draggable anchors)
- **8 shape types (3D)** -- Sphere, Cube, Cone, Cylinder, Torus, ThreeDAxes, **Surface** (`z = f(x, y)` with wireframe preview), and **Prism** (box with per-axis dimensions) — available when scene is switched to 3D mode
- **2D/3D scene toggle** -- Switch any visual project between 2D and 3D mode from the Topbar; 3D mode uses `ThreeDScene` base class
- **LaTeX math objects** -- Add `MathTex` expressions (e.g. `\int_a^b`, `E = mc^2`) that render natively in Manim; the canvas shows an approximate Unicode preview (`\int_a^b` → `∫ₐᵇ`) and the box is selectable/draggable
- **Coordinate Axes** -- Configurable `Axes` with custom x/y ranges and tick steps; add function graphs (e.g. `x**2`, `sin(x)`) with color and range controls; canvas preview included
- **NumberPlane / NumberLine** -- Coordinate grid and number line as standalone shape types, addable from the sidebar with their own range/length inspectors
- **Geometry, calculus & data objects** -- Annulus, Arc, Sector, Double Arrow, Free Polygon (with draggable canvas vertex handles + Trapezoid/Parallelogram presets), Parametric curves (`x(t)`/`y(t)` over a `t`-range), Matrix (per-cell grid editor with `[ ]` / `( )` / `| |` bracket styles), and per-graph Area-under-curve / Riemann-rectangle overlays on Axes -- all render in Manim and round-trip through `.py` export/import
- **Relational objects** -- Brace (bracket between two draggable points with an optional LaTeX label) and Angle (angle/right-angle mark from a vertex + two draggable endpoints, with arc radius and optional LaTeX label); both are self-contained (defined by their own points) and round-trip through `.py`
- **2D object effects** -- An "Effects" panel adds gradient fill (multi-stop, angle), rounded corners (rectangle/square plus polygon/triangle/star via native `round_corners`), separate fill/stroke opacity, dashed stroke, and a configurable drop shadow (color/opacity/offset, with preview-only blur); controls appear only for shapes that support them; all render in Manim and round-trip through `.py` export/import
- **Asset uploads** -- Import PNGs, JPEGs, and SVGs; drag onto the canvas from the sidebar

### Animation & Timeline
- **Multi-track timeline** -- Up to 5 tracks with draggable, resizable animation clips
- **Transform morphing** -- Select two shapes and morph between them with customizable easing
- **Animation types** -- Transform, Move, Scale, Fade, Rotate with 17 easing functions
- **Emphasis animations** -- Five transient (there-and-back) Manim emphasis clips: Indicate, Flash, Wiggle, Circumscribe, FocusOn; full parameter set per type, render-exact output, mixed-fidelity canvas preview, and `.py` round-trip
- **Tex-matching morph** -- A "Match terms" toggle on any transform clip upgrades the emitted animation: two `MathTex` objects morph via `TransformMatchingTex` (Manim aligns matching sub-expressions); other VMobjects use `TransformMatchingShapes`; raster objects fall back to `FadeTransform`; absent toggle = legacy `ReplacementTransform`. Round-trips through `.py` export/import
- **Animated counter** -- A `Counter` object (`DecimalNumber`) with configurable decimal places and optional suffix string; add a `count` clip to animate the value from/to in Python using a `ValueTracker` block; the counter's `value` property is also keyframable (all three codegen modes). Render-accurate; canvas preview shows the formatted number
- **Typewriter reveal** -- `typewriter` entrance and `typewriter_out` exit presets for text objects; emits `AddTextLetterByLetter` / `RemoveTextLetterByLetter` in Manim; round-trips through `.py` export/import
- **AnimationGroup / LaggedStart** -- Mark clips as parallel (`∥`) to run simultaneously; set `lag_ratio` for staggered starts; generates `AnimationGroup(...)` or `LaggedStart(..., lag_ratio=x)` in Manim
- **Path animation (MoveAlongPath)** -- Draw a path on the canvas (click to add points, double-click to finish); object follows the path with arc-length interpolation. In **3D mode** the path is drawn in the top-down (XZ) panel with Y held constant, animates in the canvas preview, renders as a dashed overlay in both panels, and round-trips through `.py` export/import with full 3D coordinates
- **Camera animations** -- Toggle Moving Camera mode (🎥); add camera clips to the dedicated camera track to pan and zoom; generates `MovingCameraScene` + `self.camera.frame.animate.move_to().set_width()` in Manim (2D) or `self.move_camera(phi=..., theta=...)` (3D)
- **Split viewport (3D)** -- In 3D mode, the canvas splits into perspective (isometric) + top-down (XZ) views; drag objects in either panel to position them; 3D objects animate live in both panels during playback; Blender/Unity style
- **Camera-aware 3D preview** -- The isometric panel now projects from the actual camera angles (`phi`/`theta`) instead of a fixed 30° view, so the preview tracks the scene camera and live `camera_move` animation; choose **Orthographic** or **Perspective** projection (with focal distance) from the 3D Camera Preview panel when nothing is selected (preview-only — does not change the render)
- **3D axes ranges** -- `axes3d` objects expose full X/Y/Z range editors (min–max per axis) in the 3D Position panel; ranges survive `.py` export/import round-trips
- **Audio / Voiceover** -- Attach audio to any clip: upload `.mp3`/`.wav`/`.ogg`, synthesize with **gTTS** (online) or **Coqui TTS** (offline); auto-sync stretches clip duration to match audio; manual mode lets you set offset; generates `VoiceoverScene` + `with self.voiceover(audio=...)` in Manim
- **Timeline scrubbing** -- Arrange and trim clips; audio status stripe on clips; resize locked while auto-sync is active
- **Entrance / exit animations** -- 12 entrance and 10 exit animation presets per object (including `typewriter` / `typewriter_out`)
- **Keyframe animation** -- Per-property absolute-time keyframes independent of clips; add keyframe lanes to any numeric property (x, y, opacity, rotation, scale, x3d, y3d, z3d…); drag diamond markers to adjust timing; Bezier easing editor with draggable handles and Linear/Ease In/Out presets; 3 behavior modes (opt-in, override, additive) and 3 Python codegen modes (UpdateFromAlphaFunc, animate, ValueTracker) configurable per property; simultaneous 3D coordinate keyframes merged into a single `move_to([x, y, z])` call
- **Timeline playhead** -- A vertical playhead marks the current time across the ruler and all lanes; click or drag the ruler to scrub (seeks the canvas live)
- **Smart keyframe seeding** -- The first keyframe added to a property auto-seeds locked keyframes at the object's start and end (so a lone keyframe isn't a no-op); a per-lane `+` adds a keyframe at the playhead; pinned boundary keyframes stay welded to the object's edges — they follow the bar when it is moved, and middle keyframes rescale proportionally when it is resized from either side

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
git clone https://github.com/kadirhanpolat/Manim-Editor.git
cd Manim-Editor
docker compose up --build
```

Open **http://localhost:8080** in your browser. Everything works out of the box -- editor, API, render queue, and Manim renderer.

### Editor Only (No Docker)

This is an npm-workspaces monorepo (the shared `@manim/codegen` package is consumed
by both `services/web` and `services/api`), so install from the repo root:

```bash
npm install                       # root install — links the @manim/codegen workspace
npm --workspace services/web run dev
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
Drag shapes on the canvas. Edit fill, stroke, opacity, size, rotation in the Properties panel. The **Effects** section adds gradient fill, rounded corners (rectangle/square), separate fill/stroke opacity, and dashed stroke. LaTeX objects have a formula editor; Axes objects have configurable ranges.

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
 |               gradient?: { colors[], angle }, cornerRadius?,
 |               fillOpacity?, strokeOpacity?, dash?: { numDashes, ratio },
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

**Object types (2D)**: `rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`, `heart`, `dot`, `dot_grid`, `text`, `image`, `svg_asset`, `latex`, `axes`, `numberplane`, `numberline`, `annulus`, `arc`, `sector`, `double_arrow`, `polygon_free`, `parametric`, `matrix`, `brace`, `angle`, `counter`, `table`, `complex_plane`, `polar_plane`, `graph`, `vector_field`, `vector_components`, `ray`, `coord_point`, `bezier`

**Object types (3D)**: `sphere`, `cube`, `cone`, `cylinder`, `torus`, `axes3d`, `surface`, `prism` — only when `sceneType: '3d'`

**Clip types**: `transform` (morph A->B; optional `matchTerms` for `TransformMatchingTex`/`TransformMatchingShapes`), `move`, `scale`, `fade`, `rotate`, `path_move` (MoveAlongPath), `camera_move` (MovingCameraScene / ThreeDScene), `count` (ValueTracker counter animation); **emphasis (transient)**: `indicate`, `flash`, `wiggle`, `circumscribe`, `focus_on`

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
npm test          # 114 engine tests (easing, geometry, transform, blending, keyframe + path interpolation)
npm run test:unit # 515 unit tests (store, templates, graphs, parallel clips, path, camera, audio, keyframe, manim export + LaTeX round-trip, 3D scene/path/projection/camera, 2D object effects, Phase 2 geometry/calculus + math-expr security, Phase 2.5 relational, Phase 2.6 effects, emphasis animations, text-math animations, Phase 4 data objects, object-library extensions (Surface, Prism, Integer counter, Ray, Coord Point, Vector Components, Bezier, Tangent), UI-tools audit (palette reachability, MotionPicker clips, interaction tools), codegen→valid-Python checks, + StageCanvas config-builder characterization snapshots)
```

The shared codegen package has its own suite (run from the repo root):

```bash
npm --workspace packages/manim-codegen test   # 6 @manim/codegen tests (generateScene, camera-only guard, count/path_move indent, counter LaTeX-unit escape)
```

### End-to-end (Playwright)

The `e2e/` directory is a standalone package (outside the npm workspaces) that
drives the real app in a browser:

```bash
cd e2e
npm install                      # first time only
npx playwright install chromium  # first time only
npm test                         # 9 Chromium tests; auto-boots the web dev server on :5188
```

It clicks every palette/clip/tool surface (add objects, MotionPicker clips,
keyboard tools, transform gating) against the running app.

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

### v3.16.0 (current)

UI-tools audit — a systematic pass over **every add/clip/tool UI surface**
(palette → store → preview → inspector → codegen → `.py` round-trip), verified
three ways: code audit, jsdom unit tests, and a real-browser Playwright suite.

- **Counter & NumberPlane now reachable** — both had full store/codegen/inspector
  support but no palette button (the `count` clip was effectively unusable without
  a way to add a `Counter`). Added to the AssetSidebar "Data & Coordinates" group.
- **NumberLine is now a full tool** — gained an inspector (`NumberLineSettings`:
  x-range min/max/step + length) and a palette button; previously it only existed
  via `.py` import.
- **Removed dead `Toolbar.vue`** — it was never mounted (the app renders
  `AssetSidebar`); the live interaction tools are the `V` (select) / `H` (hand)
  keyboard shortcuts.
- **Clean-install fix** — `jsdom` is now declared in the root `package.json` so the
  root-hoisted `vitest` resolves it; a fresh `npm install` previously broke
  `npm run test:unit` with `Cannot find package 'jsdom'`.
- **New tests**: `ui-tools-audit.test.js` (palette-reachability invariant guarding
  the orphaned-object regression, MotionPicker clip tools, interaction tools) +
  `NumberLineSettings` + a `NumberLine` characterization snapshot; and a standalone
  **Playwright `e2e/` package** (9 Chromium tests) that drives the real app on a
  dedicated port via a DEV-only `window.__projectStore` hook.
- **Tests**: totals now **515 unit + 114 engine** (web) + **6** `@manim/codegen`
  package tests + **9** Playwright E2E. Audit report:
  `docs/superpowers/specs/2026-06-07-ui-tools-audit-design.md`.

### v3.15.0

Object-library extensions — eight new object types closing the gaps in the visual
library, each fully integrated (store → byte-identical `@manim/codegen` → `.py`
parser round-trip → canvas preview → inspector → sidebar) and browser-verified:

- **Surface** (`surface` → `Surface`, 3D): `z = f(x, y)` height map with a
  `safeMathExpr`-guarded `zExpr` and `xRange`/`yRange` (= u/v range). Preview is an
  iso-projected wireframe via the now-multivariate `compileExpr(expr, ['x','y'])`.
- **Prism** (`prism` → `Prism`, 3D): box with per-axis `dimX`/`dimY`/`dimZ` (Manim
  units); preview shares the `boxFaces()` builder with the cube.
- **Integer counter** (`counter` `useInteger` toggle → `Integer` mobject): whole-number
  mode for the existing counter; `numDecimals` is hidden in the inspector when active.
- **Ray** (`ray` → `Ray`/`Arrow`): a source dot + a direction arrow from one point
  through another.
- **Coord Point** (`coord_point`): a `Dot` + an `always_redraw` live `(x, y)`
  `MathTex` label (format precision via `decimals`) that updates as the dot animates.
- **Vector Components** (`vector_components`): a `VGroup` of a main arrow + red/green
  x/y component arrows + dashed projection guides (`vx`/`vy` tip in object-relative px).
- **Bezier** (`bezier`): a smooth open curve through draggable anchor `vertices`
  (`VMobject` + `set_points_smoothly`); the parser rebuilds it from the
  `set_points_smoothly` line so it doesn't collide with `path_move`'s VMobject.
- **Tangent line** on Axes graphs (`TangentLine`): each `axes.graphs[]` item gains an
  optional tangent (at-x + length) with a numeric-derivative preview segment.
- **Codegen→valid-Python guard**: a new test generates a Manim script for every
  object/clip/keyframe/audio/camera combination and asserts each parses via
  `python -m ast`, catching render-blocking syntax/indent bugs that string-match
  tests miss (self-skips when `python` is off PATH).
- **Tests**: totals now **495 unit + 114 engine** (web) + **6** `@manim/codegen`
  package tests.

### v3.14.0

Internal refactors (no user-facing behavior change) + render-path fixes:

- **Shared `@manim/codegen` package**: the hand-maintained byte-identical duplication between the server generator (`codegen.js`) and the client generator half of `manim.js` was extracted into a single npm-workspace package (`packages/manim-codegen/`: `constants`, `helpers`, `objects`, `objects3d`, `clips`, `keyframes`, `generateScene`). Both services are now thin wrappers; the one intentional server↔client difference (asset file paths) is injected via a `resolveAsset` callback. The `.py` parser stays web-only in `manim.js`. Docker build contexts moved to the repo root so the package ships into both images (the api dev `node_modules` volume was renamed `api_node_modules` → `root_node_modules`).
- **StageCanvas decomposition**: `StageCanvas.vue` (2052 → ~544 lines) was split into pure `(obj, ctx)` config builders (`components/stage/configs/*.js`) + reactive composables (`components/stage/composables/*.js`) + a thin orchestrator. Behavior preserved verbatim, pinned by characterization snapshots.
- **Render-path bug fixes** (surfaced end-to-end via the renderer): the project validator now accepts `count`/`path_move`/emphasis clip types; the `count`/`path_move` multi-line codegen no longer double-indents (was a Python `IndentationError`); the renderer writes world-writable output so `DELETE /api/projects/:id` no longer fails with `EACCES`; and a `counter` `suffix` with LaTeX-special chars (e.g. `%`) is now escaped so `DecimalNumber(unit=...)` renders correctly.
- **Tests**: totals now **402 unit + 114 engine** (web) + **6** `@manim/codegen` package tests.

### v3.13.0

Data & Coordinate Objects (Phase 4) — five new 2D object types, all byte-identical across the server (`codegen.js`) and client (`manim.js`) generators and round-tripping through `.py` export/import:

- **Table** (`table` → `Table` / `MathTable`): per-cell grid editor (reuses matrix grid + `safeMatrixEntry`), `mathMode` toggle, and optional `rowLabels`/`colLabels` (emitted as `MathTex` in math mode). Text mode emits `Table([...])`, math mode with labels emits `MathTable([...], row_labels=[MathTex("..."), ...], col_labels=[...])`. Store actions: `setTableCell`, `addTableRow/Column`, `removeTableRow/Column`, `setTableMathMode`, `setTableRowLabels`, `setTableColLabels`.
- **Complex Plane** (`complex_plane` → `ComplexPlane`): mirrors `numberplane`; configurable `xRange`/`yRange` with grid preview.
- **Polar Plane** (`polar_plane` → `PolarPlane`): `radiusMax`, `radiusStep`, `azimuthUnits`; canvas preview = concentric rings + radial spokes. Store actions: `setPolarRadiusMax`, `setPolarRadiusStep`, `setPolarAzimuth`.
- **Graph** (`graph` → `Graph` / `DiGraph`): `vertices`, `edges`, `positions` (manual vertex layout using the `polygon_free` px↔Manim scale with y-sign flip), `directed`, `showLabels`. Draggable vertex handles via the generalized `polygonHandles`. `labels=True` gated on `showLabels`; `fill` is preview/inspector-only. Store actions: `addGraphVertex`, `removeGraphVertex`, `addGraphEdge`, `removeGraphEdge`, `renameGraphVertex`, `setGraphVertexPosition`, `setGraphDirected`, `setGraphShowLabels`.
- **Vector Field** (`vector_field` → `ArrowVectorField`): `fx`/`fy` expression strings (via `safeMathExpr`, identical whitelist across `codegen.js`/`manim.js`/`StageCanvas.vue`), `xRange`/`yRange`. Emitted as a double-lambda single-line form. 8×8 sampled-arrow canvas preview. Store actions: `setFieldExpr`, `setFieldRange`.
- **Accepted preview ≈ render divergences**: table label alignment and cell spacing; plane axis labels; graph edge styling; vector-field sparsity (preview 8×8, Manim samples densely). **Known limitation**: `vector_field` expressions with a top-level comma (e.g. `max(x, y)`) do not round-trip cleanly.
- **Tests**: +7 parity invariant tests in `manim-export.test.js` (byte-stable exact-string assertions for all five new types); totals now **339 unit + 114 engine**.

### v3.12.0

Text & Math Animations (Phase 3) — animated counter object, count clip, Tex-matching morph, and typewriter presets, all byte-identical across the server (`codegen.js`) and client (`manim.js`) generators and round-tripping through `.py` export/import:

- **Counter object** (`counter` → `DecimalNumber`): fields `value`, `numDecimals`, and `suffix` (→ `unit="..."`, only when non-empty). Canvas preview shows the formatted number; inspector has value/decimals/suffix inputs. Not in GRADIENT_TYPES/DASH_TYPES. `value` is keyframable with all three codegen modes.
- **Count clip** (`count` → `ValueTracker` block): animates a counter from/to with `_count_<clipid> = ValueTracker(from)` + `add_updater` + `animate.set_value(to)` + `clear_updaters()`. The `_count_` prefix is distinct from keyframe `_vt_` blocks to prevent parser collisions. Skipped inside parallel `AnimationGroup`; parsed by a dedicated `pendingCount` pending-dict branch.
- **Tex-matching morph** (transform clip `matchTerms` toggle): upgrades the emitted class — `TransformMatchingTex` when both objects are `latex`, `TransformMatchingShapes` for other VMobjects, `FadeTransform` for raster sources, `ReplacementTransform` when absent (legacy, byte-identical). Implemented via a shared `transformExpr` helper kept byte-identical across both generators.
- **Typewriter presets**: `typewriter` entrance → `AddTextLetterByLetter`, `typewriter_out` exit → `RemoveTextLetterByLetter`.
- **Accepted preview ≈ render divergences**: Tex term-matching morph shows a generic crossfade (Manim does actual alignment); typewriter timing is approximate; counter font metrics differ between Konva and Manim `DecimalNumber`.
- **Tests**: +10 parity invariant tests in `manim-export.test.js` (byte-stable exact-string assertions for all four new constructs); totals now **314 unit + 114 engine**.

### v3.11.0

Emphasis animations — five transient ("there-and-back") Manim emphasis clips that play and return the object to its original state, integrated into the existing clip pipeline (store → byte-identical codegen → playback → inspector → `.py` round-trip):

- **`Indicate`** (`color`, `scale_factor`), **`Flash`** (`color`, `flash_radius`, `line_length`, `num_lines`), **`Wiggle`** (`scale_value`, `rotation_angle` in deg, `n_wiggles`), **`Circumscribe`** (`color`, `shape` = Rectangle/Circle, `fade_out`, `time_width`), **`FocusOn`** (`color`, `opacity`). Created from a new "Emphasis (transient)" button group in the inspector, each with its own param section.
- **Render-exact, mixed-fidelity preview**: the generated Manim is faithful for all five; the canvas preview is faithful for Indicate/Wiggle, a color-pulse approximation for Flash/FocusOn, and an overlay box/ellipse for Circumscribe. Emitted via a byte-identical `emphasisExpr(c, sn)` helper shared by `codegen.js`/`manim.js` and round-tripped through `.py` (standalone + parallel `AnimationGroup`/`LaggedStart` groups).
- **Tests**: +18 unit (codegen + full round-trip parser, there-and-back playback, inspector buttons + param sections); totals now **283 unit + 114 engine**.

### v3.10.0

Effects Phase 2.6 — two more optional, render-faithful object effects extending the Phase 1 "Effects" system, both byte-identical across the server (`codegen.js`) and client (`manim.js`) generators and round-tripping through `.py` export/import:

- **Drop shadow** (`obj.shadow {color, opacity, dx, dy, blur}`): emitted as a shifted, recolored `.copy()` placed behind the shape in a `VGroup(_shadow_<n>, <n>)`. Offsets convert px → Manim units (screen-down → −y). `blur` is **preview-only** (Manim CE has no blur); the preview uses Konva's native soft shadow (`shadowBlur = blur × zoom`).
- **Rounded corners for polygon/triangle/star**: the existing `cornerRadius` field now also drives Manim's native `.round_corners(radius=…)` for polygon/triangle/star (rectangle/square keep their `RoundedRectangle` path). The inspector control shows for all five; codegen emits `.round_corners()` for only the three. Preview rounds via Konva `cornerRadius` (RegularPolygon/Star) or a `tension` approximation (closed-Line triangle).
- **Glow evaluated and dropped**: Manim CE has no true blur/glow — a render would only stack scaled low-opacity copies (concentric rings, not a soft glow), so the fidelity gap wasn't worth shipping.
- **Tests**: +12 unit (store `setShadow`, round_corners + drop-shadow codegen, round-trip parser, inspector shadow panel + corner-radius for polygon/triangle/star); totals now **265 unit + 114 engine**.

### v3.9.0

Relational objects (Phase 2.5) — two self-contained relational mobjects following the constructor → styling → single-line round-trip pattern, emitted byte-identically by both generators:

- **Brace** (`brace` → `BraceBetweenPoints`): a bracket spanning two object-relative points (`p1`/`p2`) edited via draggable canvas handles, with an optional LaTeX label. Unlabeled emits one line; labeled wraps the brace + `get_tex` label in a `VGroup`.
- **Angle** (`angle` → `Angle` / `RightAngle`): an angle mark from a `vertex` and two endpoints (three draggable handles), with a right-angle-square mode, configurable arc radius, and an optional LaTeX label. Emitted via two helper `Line`s passed to `Angle`/`RightAngle`.
- **Independent geometric definition**: both are defined by their own points (no dependency on other objects); move/scale/rotate work through the standard object transform; the generic post-switch `move_to` positions them.
- **Labels**: optional LaTeX via `get_tex("...")` with non-raw, doubled-backslash escaping (`safeLatex`, the same convention as `MathTex` — avoids the v3.6.0 literal-`int` bug).
- **Round-trip + parity**: both types round-trip through `.py` export/import (the parser reconstructs angle points from the helper-`Line` vars and attaches labels from the `VGroup` line) and are emitted byte-identically by `codegen.js` (server) and `manim.js` (client), guarded by `manim-export.test.js`.
- **Tests**: +19 unit (store, brace/angle generator + round-trip codegen, inspector panels); totals now **253 unit + 114 engine**.

### v3.8.0

Object library enrichment (Phase 2) — seven new standalone object types plus two Axes graph extensions, all following the constructor → styling → single-line round-trip pattern and emitted byte-identically by both generators:

- **Geometry primitives**: **Annulus** (`Annulus`), **Arc** (`Arc`), **Sector** (`Sector`), and **Double Arrow** (`DoubleArrow`). Radii convert through `FRAME_WIDTH`; angles are stored in degrees and emitted as `<deg> * DEGREES`. Annulus/sector are fillable + gradient/dash-eligible; arc/double-arrow are open strokes (dash-eligible).
- **Free Polygon** (`polygon_free` → `Polygon`): arbitrary vertices edited directly on the canvas via draggable vertex handles, with **Trapezoid** / **Parallelogram** / **Free** presets in the inspector. Emitted single-line with literal coordinate arrays.
- **Parametric curve** (`parametric` → `ParametricFunction`): `x(t)` / `y(t)` expression strings over a `[tMin, tMax]` range; expressions pass the shared `safeMathExpr` whitelist (no `import`/`eval`/`exec`) and preview by sampling through `engine/mathExpr.js`.
- **Matrix** (`matrix` → `Matrix`): per-cell grid editor with add/remove row & column, and `[ ]` / `( )` / `| |` bracket styles. Source of truth is `matrixData` (2-D string array) + `bracket`; rows/cols are derived. Entries are sanitized display strings (quotes/backslashes/newlines stripped — **no expression evaluation**). Composite Konva canvas preview with a selectable hit region; round-trips single-line `Matrix([[...]])`.
- **Area & Riemann overlays**: each graph in an `Axes` object gains optional **Area-under-curve** (`get_area`) and **Riemann-rectangle** (`get_riemann_rectangles`, left/right/midpoint) overlays, with x-range / opacity / dx / color controls and full canvas preview.
- **Round-trip + parity**: every new object and overlay round-trips through `.py` export/import and is emitted byte-identically by `codegen.js` (server) and `manim.js` (client), guarded by `manim-export.test.js`.
- **Tests**: +61 unit across the four Phase 2 plans (store, generator + round-trip codegen, inspector panels, math-expression security, polygon-vertex geometry); totals now **234 unit + 114 engine**.

### v3.7.0

2D object styling effects (Phase 1) — a new **Effects** panel adds four render-accurate styling capabilities:

- **Feature (gradient fill)**: multi-stop linear gradient on fillable shapes (rectangle, square, circle, ellipse, triangle, star, polygon, heart); emits `set_color_by_gradient(...)`. The canvas previews the gradient at the chosen angle (Konva linear gradient); the angle is **preview-only** — Manim orients the gradient along the mobject's point order.
- **Feature (rounded corners)**: corner-radius control for rectangle/square; emits `RoundedRectangle(corner_radius=...)` (clamped below half the shorter side).
- **Feature (separate fill/stroke opacity)**: independent `fillOpacity` / `strokeOpacity` per object, combined multiplicatively with the master opacity (`set_fill`/`set_stroke` opacity = master × channel).
- **Feature (dashed stroke)**: dashed outlines and lines via a fill-preserving `VGroup(base, DashedVMobject(...))`; dash density (`num_dashes`) and ratio (`dashed_ratio`) configurable.
- **Inspector**: new "Effects" section in the Properties panel; each control gates by shape type (`canGradient` / `canDash` / `canRound`) and the whole section hides when no effect applies to the selected object.
- **Round-trip + parity**: all four effects round-trip through `.py` export/import (`manim.js` parser) and are emitted byte-identically by both generators (`codegen.js` server + `manim.js` client). Objects with none of the new fields produce byte-identical legacy output. Store actions (`setGradient`, `setCornerRadius`, `setDash`) delete the field on null/0 to preserve that guarantee.
- **Preview-only divergences**: gradient angle (above) and dashed+fill (preview draws one shape; render uses a `VGroup`). Deferred to Phase 2: glow, drop shadow, `.round_corners()` for polygon/triangle/star, and keyframing the effect channels.
- **Tests**: +16 unit (store actions, generator + round-trip codegen, Effects panel); totals now **173 unit + 114 engine**.

### v3.6.0

Timeline playhead, keyframe ergonomics, and LaTeX/canvas selection fixes:

- **Feature (timeline playhead)**: a vertical playhead line (diamond handle) marks the current playback time across the ruler, object/track lanes, and the keyframe panel; clicking or dragging the time ruler scrubs — it syncs the engine duration to the project length and seeks, updating the canvas frame live.
- **Feature (keyframe seeding)**: the first keyframe added to a property now auto-seeds keyframes at the object's start and end (a lone keyframe is a no-op in opt-in mode); a per-lane `+` button inserts a keyframe at the playhead (clamped to the object's visible interval).
- **Feature (pinned boundary keyframes)**: the seeded start/end keyframes are locked to the object's edges — not draggable (rendered with a locked halo), they follow the bar when it is moved, snap outward when it is expanded, and middle keyframes rescale **proportionally** when the bar is resized from either edge. Delete rules: a boundary can't be removed while other keyframes remain; when only the two boundaries are left, deleting either clears the property.
- **Fix (LaTeX render)**: `MathTex` was emitted as a raw string with doubled backslashes (`MathTex(r"\\int_a^b")`), so LaTeX received `\\int` (a line break) and rendered the literal word "int". Now emitted as a normal escaped Python string (`MathTex("\\int_a^b")` → `\int_a^b` at runtime) in both `codegen.js` and `manim.js`; the parser un-escapes on import (also repairs the legacy raw form). 
- **Fix (canvas selection)**: composite objects (LaTeX, axes, dot grid, number plane/line) couldn't be selected — all their Konva children were non-listening, leaving the group with no hit area. Each now has a listening hit region.
- **Feature (LaTeX preview)**: the canvas draws an approximate Unicode rendering of the raw LaTeX (`\int_a^b` → `∫ₐᵇ`; greek, operators, arrows, `\frac`/`\sqrt`, sub/superscripts) instead of raw source. Preview-only — Manim still typesets the raw LaTeX as MathTex.
- **Tests**: +26 unit (keyframe scaffold/pinned/delete/rescale, LaTeX preview, LaTeX export round-trip); totals now **157 unit + 114 engine**.

### v3.5.0

Tech-debt pass — coordinate unification + camera-aware 3D preview:

- **Fix (coordinate parity)**: unified both Python generators on Manim CE's true default frame width `FRAME_WIDTH = 14 + 2/9 = 14.222` (height 8 unchanged). The server `codegen.js` previously used a bare `14` for positions and `7` for scale-based shapes (square/circle/triangle/star/polygon, dot-grid spacing) — the latter a 2× size divergence vs the client `manim.js` exporter. Server renders and client `.py` exports now produce identical coordinates. Radius-type values (heart, Dot radius) correctly use `FRAME_X_RADIUS`; keyframe-x and camera `set_width` are unified too (`manim.js` no longer mixes 14.222 for static x with 14 for keyframe x).
- **Feature (camera-aware 3D preview)**: the isometric panel now projects from the actual `phi`/`theta` camera angles via a new pure `engine/projection3d.js` module (`project3D` + `unprojectIso`, Manim Z-up spherical camera), replacing the fixed 30° isometric. The preview tracks the scene's resting camera and animates live during 3D `camera_move` clips.
- **Feature (projection modes)**: choose **Orthographic** or **Perspective** (with focal distance) from the new 3D Camera Preview panel (Inspector, shown when nothing is selected in a 3D scene). Stored on `project.camera3d.projection` / `focalDistance`. Preview-only — render output is unchanged.
- **Engine**: `playback.js` now interpolates 3D `camera_move` clips (`{phi, theta, zoom}`) into `cameraState` with an `is3d` flag and `setCamera3dBase`; the 2D camera path is unchanged and guarded against the new 3D state.
- **Tests**: +12 unit (`projection3d` 4, `playback-camera3d` 2, `Scene3DPanel` 2, store defaults 2, manim-export FRAME_WIDTH invariants 2); totals now **131 unit + 114 engine**.

### v3.4.0

Completes 3D parity — 3D path animation and full `axes3d` range editing:

- **Feature (3D path_move)**: `path_move` now works in 3D scenes. The path is drawn in the top-down (XZ) panel with Y held at the object's current `y3d`; points are stored as `{x3d, y3d, z3d}` in Manim units (detected by `'x3d' in point`, no separate flag).
- **Feature (3D codegen)**: 3D paths emit `MoveAlongPath` with true 3D coordinates (`np.array([x, y, z])`, no `stageToManim`/`z=0`) in both `codegen.js` (server) and `manim.js` (client). The `manim.js` parser detects `ThreeDScene` → `sceneType: '3d'`, captures all three coordinates, and round-trips 3D paths back to project JSON.
- **Feature (playback preview)**: extracted a pure, exported `interpolatePath(path, t)` (arc-length, 2D + 3D) in `playback.js`; 3D `path_move` now animates in the canvas. A new `eff3d(obj)` helper in `StageCanvas.vue` merges `objectOverrides`, so all 3D objects reflect animation overrides during playback (not just paths).
- **Feature (visualization)**: committed 3D paths render as dashed purple polylines in both the iso and top panels.
- **Feature (axes3d ranges)**: `Position3DPanel` now has full X/Y/Z range editors (min–max per axis), not just X.
- **Fix (round-trip)**: `ThreeDAxes(...)` is now emitted on a single line so the regex parser reconstructs `axes3d` x/y/z ranges on `.py` import (previously reset to `[-3, 3, 1]`). Matches how `Axes`/`NumberPlane` are emitted.
- **Fix (3D drawing coords)**: 3D path drawing/preview uses raw canvas-pixel pointer coordinates (`projCx2`/`proj3DScale`/`top()`), not the 2D `c2s`/`s2c` stage transform — the split viewport projection operates in canvas-pixel space.
- **Cleanup**: removed a dead legacy 2D `move_to` parser handler superseded by a unified `move_to([x, y, z])` handler.
- **Tests**: +8 (new `3d-path.test.js` codegen/round-trip/2D-regression/axes3d-range + `Position3DPanel.test.js`) and `interpolatePath` engine coverage; totals now **119 unit + 114 engine**.

### v3.3.2

Bug-fix release — hardens 3D keyframe code generation:

- **Fix (3D keyframes)**: simultaneous `x3d/y3d/z3d` keyframes are now folded into a single `move_to([x, y, z])` regardless of each axis's `keyframeCodegen` mode. Previously, if one axis was set to `UpdateFromAlphaFunc` or `ValueTracker` (which have no 3D setter), that axis's keyframes were silently dropped — only the `animate`-mode axes survived. Now any keyframed 3D position axis always contributes to the combined move. Applied identically to both `codegen.js` (server) and `manim.js` (client exporter).
- **Cleanup**: removed dead `x3d/y3d/z3d` arms from `_kfPropSet` (unreachable — 3D position is only ever emitted through the combined `move_to` path) in both generators.
- **Tests**: added two regression tests in `3d-layer4.test.js` — staggered-time per-axis carry-over, and the mixed-codegen-mode no-silent-drop guard. Unit suite is now 111 tests.

### v3.3.1

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
