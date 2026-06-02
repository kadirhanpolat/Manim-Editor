# Manim Motion Editor — Claude Code Instructions

## Project Overview

Browser-based Figma-like animation editor for Manim CE. 4 Docker services: Vue 2.7 + Konva.js frontend (Nginx :8080), Node.js/Express API (:3000), Python Manim CE renderer worker, Redis 7 job queue. Shared Docker volume at `/data`.

## Architecture

```
services/web/        # Vue 2.7 frontend (Vite, Vitest)
services/api/        # Node.js/Express API + Manim codegen
services/renderer/   # Python Manim worker (polls Redis)
```

## Running Tests

```bash
# Unit tests (store, components) — 29 tests
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
| `services/api/src/compiler/codegen.js` | Generates Python Manim code from project JSON |
| `services/web/src/components/stage/StageCanvas.vue` | Konva.js canvas — renders all object types |
| `services/web/src/components/inspector/PropertiesPanel.vue` | Object + clip property editor |
| `services/web/src/components/timeline/Timeline.vue` | Multi-track timeline + camera track |

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

## Object Types

`rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`, `heart`, `dot`, `dot_grid`, `text`, `image`, `svg_asset`, `latex`, `axes`, `numberplane`, `numberline`

`axes` objects have a `graphs: []` array — each graph has `{ id, expression, color, xMin, xMax, strokeWidth }`.

## Security

Graph expressions (`graph.expression`) must pass the whitelist before use in codegen or `new Function`:
```js
if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(expr)) return 'x**2';
if (/import|eval|exec|open|__/.test(expr)) return 'x**2';
```
This check exists in both `codegen.js` (`safeMathExpr`) and `StageCanvas.vue` (`axesGraphCurves`).

## Camera Animations

- Project-level: `cameraType: 'static' | 'moving'`, `cameraTrack: []`
- `camera_move` clips live in `cameraTrack`, not in regular `tracks[]`
- Codegen: `MovingCameraScene` base class + `self.camera.frame.animate.move_to().set_width(14/zoom)`
- Delete key and inspector work for camera clips (handled separately from regular clips in App.vue)

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

## Technical Debt (known)

- `services/web/src/export/manim.js` (client-side exporter) does not yet support `AnimationGroup`, `path_move`, or `camera_move` — only the server-side `codegen.js` does
- Camera preview in StageCanvas.vue applies a CSS transform approximation; not pixel-perfect vs. Manim output
