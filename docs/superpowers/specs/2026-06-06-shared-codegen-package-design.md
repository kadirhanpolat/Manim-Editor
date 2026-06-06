# Shared Codegen Package — `@manim/codegen` Design

**Date:** 2026-06-06
**Status:** Approved (design), pending spec review → implementation planning
**Scope:** Eliminate the hand-maintained byte-identical duplication between
`services/api/src/compiler/codegen.js` and the generator half of
`services/web/src/export/manim.js` by extracting a single shared ESM workspace
package, `@manim/codegen`.
**Base branch:** branch off `main`.

## Problem

The project emits Manim Python from two places that must stay byte-identical:

- `services/api/src/compiler/codegen.js` (1383 lines) — server-side, used by the
  renderer pipeline.
- `services/web/src/export/manim.js` (2395 lines) — client-side; its first ~799
  lines are a generator that mirrors `codegen.js`, the rest is a `.py` → project
  JSON **parser** (web-only).

CLAUDE.md carries **19 separate "keep byte-identical across codegen.js/manim.js"**
warnings. Every new object/clip type requires editing both files identically, with
only `manim-export.test.js` parity tests as a safety net. The two files have **no
shared import** today, purely because of a packaging constraint (below) — not a
language one (both `services/api` and `services/web` are `"type": "module"`).

### Root cause of the duplication

Each service's Docker build context is its own directory
(`build: ./services/api`, `build: ./services/web`); the Dockerfiles `COPY . .`
only that directory. A shared file anywhere else is not in either build context,
so neither container could import it. Eliminating the duplication therefore
requires a packaging change, not just a code move.

## Goal

One source of truth for code generation, consumed by both services through normal
module resolution, with **zero on-disk duplication** and **byte-identical output
to today** for every existing project (guarded by the existing parity/round-trip
suites).

## Non-Goals

- **Moving the parser.** `parseManimScript` (the ~1580-line back half of
  `manim.js`) is web-only — the api never parses. It stays in `services/web`
  (YAGNI). The package may host it later if an api consumer appears.
- **Changing emitted Python.** No behavioral change. The intentional server↔client
  asset-path divergence (below) is preserved exactly.
- **Touching the renderer / audio / redis services.** Only `api` and `web` consume
  codegen.
- **Refactoring the generator's logic.** This is a move + de-dup, not a rewrite of
  the generation algorithm.

## Decisions (resolved during brainstorming)

1. **Packaging:** npm **workspace package** `@manim/codegen` (chosen over a
   sync-copy script and a root-context bare shared dir).
2. **Internal structure:** split into cohesive modules
   (`constants` / `helpers` / `objects` / `objects3d` / `clips` / `keyframes`) +
   an `index.js` barrel (chosen over single-file and two-file).
3. **Parser:** stays in `services/web/src/export/manim.js` (non-goal to move).
4. **Asset divergence:** handled by an injected `resolveAsset` callback (the one
   real content difference between the two generators).

## Architecture

### Monorepo layout

```
/ (repo root)
  package.json              # NEW: { "private": true, "workspaces": ["packages/*", "services/*"] }
  package-lock.json         # NEW: single root lockfile (workspaces hoist deps)
  packages/
    manim-codegen/
      package.json          # { "name": "@manim/codegen", "type": "module",
                            #   "main": "src/index.js", "exports": { ".": "./src/index.js" } }
      src/
        index.js            # barrel: re-exports public API + a generateScene() orchestrator
        constants.js        # EASING_MAP, FRAME_WIDTH/HEIGHT/X_RADIUS/Y_RADIUS,
                            #   GRADIENT_TYPES, DASH_TYPES, SHADOW_TYPES
        helpers.js          # rf, rfOpt, rtOpt, vn, hex, safeNum, safeOpacity,
                            #   safeMathExpr, safeText, safeLatex, safeMatrixEntry,
                            #   matrixBrackets, fillOpacityExpr, strokeOpacityArg,
                            #   gradientLine, dashedLines, roundCornersLine,
                            #   shadowLines, stageToManim, pathPointsPy, isSystemFont,
                            #   fmt3d
        objects.js          # objectCode(obj, sw, sh, { resolveAsset }) — the big switch
        objects3d.js        # objectCode3d(obj)
        clips.js            # transformExpr, emphasisExpr, single-clip + parallel-group
                            #   (AnimationGroup/LaggedStart) + count + path_move + camera codegen
        keyframes.js        # _kfPropSet, _kfUpdater, _kfValue, generateKeyframeSteps
      tests/                # package-level unit tests (snapshot the emitted strings)
  services/
    api/  src/compiler/codegen.js   # thin wrapper: imports @manim/codegen, supplies server resolveAsset
    web/  src/export/manim.js       # thin generator wrapper (delegates to @manim/codegen) + PARSER (unchanged)
```

`vn` (codegen) and `v` (manim) are the same variable-name sanitizer under two
names — unify to one (`vn`) in the package.

### Public API of `@manim/codegen`

The package exposes the pieces each consumer needs:

```js
// index.js
export { EASING_MAP, FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS,
         GRADIENT_TYPES, DASH_TYPES, SHADOW_TYPES } from './constants.js';
export { objectCode } from './objects.js';
export { generateKeyframeSteps } from './keyframes.js';
export { generateScene } from './index.js';   // top-level orchestrator
// plus any helpers the parser needs (e.g. EASING_MAP is already re-used by manim's EASING_REV)
```

`generateScene(project, { resolveAsset })` is the shared top-level orchestrator
that today lives twice as `generatePythonCode` / `generateManimScript`.

> **Code-audit finding (2026-06-06):** the two generators are **not** line-for-line
> the same — a normalized diff is ~446 changed lines — but the divergence is **~95%
> structural, not behavioral**: `manim.js` factored clip codegen into DRY helpers
> (`singleClipCode(c)` / `animExpr(c)`), while `codegen.js` inlines the identical
> logic three times. The *emitted Python strings are equivalent*. The **only real
> behavioral divergences** are: (1) the empty-project guard — `codegen.js` returns
> early when there are no objects, `manim.js` also renders camera-only projects;
> (2) the placement of the axes base-curve `axes.add(graph)` line — `manim.js` emits
> it inside `objCode`, `codegen.js` emits it in the main loop after `objectCode`
> (output equivalent modulo submobject draw order); (3) the intended image/svg asset
> path. The shared `generateScene` therefore adopts **`manim.js`'s cleaner DRY
> structure** as canonical, takes the camera-aware empty-project guard (a strict
> improvement for `codegen.js`), and emits `axes.add(graph)` from one place. Each of
> these three is covered by an explicit reconciliation step + test in the plan.

Each service keeps a thin public wrapper with its existing signature for backward
compatibility:

```js
// services/api/src/compiler/codegen.js
import { generateScene } from '@manim/codegen';
export function generatePythonCode(project, assetsPath) {
  const assetMap = project._assetMap || {};   // unchanged: read from project, as today
  const resolveAsset = (obj, ext) => {
    const asset = obj.assetId ? assetMap[obj.assetId] : null;
    const filename = asset?.filename
      || `${(obj.name || (ext === 'svg' ? 'asset' : 'image')).replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
    return `${assetsPath}/${filename}`;
  };
  return generateScene(project, { resolveAsset });
}
export { objectCode, EASING_MAP } from '@manim/codegen';  // preserve existing named exports
```

```js
// services/web/src/export/manim.js  (generator portion)
import { generateScene } from '@manim/codegen';
export function generateManimScript(project) {
  const resolveAsset = (obj, ext) => `${obj.name || (ext === 'svg' ? 'asset' : 'image')}.${ext}`;
  return generateScene(project, { resolveAsset });
}
// ... PARSER (parseManimScript, downloadManimScript, generateCode, default) stays below, unchanged ...
```

> The exact fallback strings above must reproduce each file's **current** image /
> svg_asset output byte-for-byte. Implementation copies the precise existing
> expressions (codegen reads `assetMap` from `project._assetMap`; manim uses the
> bare placeholder). The api signature `generatePythonCode(project, assetsPath)` is
> **unchanged**, so its only caller (`services/api/src/compiler/index.js` →
> `compileProject`) needs no edit.

### The asset-resolver seam

The single real content divergence between the two generators is the
`image` / `svg_asset` case:

- **api:** `ImageMobject("<assetsPath>/<filename>")` / `SVGMobject(...)` where the
  filename comes from `assetMap[obj.assetId]` or a sanitized `obj.name` fallback.
- **web:** `SVGMobject("<obj.name|asset>.svg")` / image equivalent — a placeholder,
  since the browser has no server file paths.

In the package, `objectCode`'s `image`/`svg_asset` arms call
`resolveAsset(obj, 'png'|'svg')` to get the path string; everything else in those
arms (the `.scale_to_fit_width(...)` math, etc.) is shared. This preserves the
intended divergence while sharing all surrounding code.

## Docker / build changes (highest-risk area)

Workspaces require the package to be inside each consumer's build context.

### docker-compose.yml

Change the `api`, `web`, and the dev `web` (`target: deps`) services from
`build: ./services/<svc>` to a repo-root context:

```yaml
api:
  build:
    context: .
    dockerfile: services/api/Dockerfile
  volumes:
    - manim_motion_data:/data
    - ./services/api/src:/app/services/api/src          # bind paths shift to monorepo layout
    - ./packages/manim-codegen/src:/app/packages/manim-codegen/src  # NEW: package hot-reload in dev
    - root_node_modules:/app/node_modules               # replaces api_node_modules
```

The dev bind mounts move from `/app/src` to `/app/services/api/src` because
`WORKDIR` is now the repo root inside the image. Same shift for the web dev
service's mounts and command working dir.

### Dockerfiles

Both Dockerfiles install from the **root** workspace manifests, then copy the
package + the one service they build:

```dockerfile
# services/api/Dockerfile
FROM node:20-alpine
WORKDIR /app
USER node  # (after mkdir/chown as today)
# install deps from root + relevant workspaces (hoisted)
COPY --chown=node:node package*.json ./
COPY --chown=node:node packages/manim-codegen/package.json packages/manim-codegen/package.json
COPY --chown=node:node services/api/package.json services/api/package.json
RUN npm install                       # installs all workspaces, hoists to /app/node_modules
# copy sources
COPY --chown=node:node packages/manim-codegen packages/manim-codegen
COPY --chown=node:node services/api services/api
CMD ["npm", "--workspace", "services/api", "run", "dev"]
```

The web Dockerfile mirrors this (deps stage copies root + package + web manifests,
build stage runs the web build via `npm --workspace services/web run build`).
`@manim/codegen` resolves through the hoisted root `node_modules` workspace symlink.

### Named-volume gotcha (documented)

The current `api_node_modules` named volume mounts at `/app/node_modules` and
**shadows** image contents; after switching to root-hoisted node_modules it must be
recreated. Rollout step: `docker volume rm manim_motion_api_node_modules` (and use a
fresh `root_node_modules` name) before `docker compose up --build`. This mirrors the
known stale-volume gotcha in CLAUDE.md / project memory.

### Validation

A successful `docker compose build api web` and a dev `docker compose up` with a
real render is a required acceptance step — the build/context change cannot be
verified by the JS test suites alone.

## Testing & rollout

The parity + round-trip suites are the safety net. Migrate **incrementally**, keeping
`npm run test:unit` (339) and `npm test` (114) green at every step:

1. **Scaffold** root `package.json` workspaces + `packages/manim-codegen` skeleton
   (no logic yet); confirm both services still build/test unchanged.
2. **constants + helpers** → move to the package; both files import them. Run suites.
3. **objects3d + keyframes** → move; run suites.
4. **objects** (with the `resolveAsset` seam) → move; run suites (asset divergence
   asserted, not equated).
5. **clips** (transform/emphasis/count/path/camera + AnimationGroup/LaggedStart) →
   move; run suites.
6. **generateScene** orchestrator → unify the two top-level functions; reduce each
   service file to its thin wrapper.
7. **Docker** → context + Dockerfile + compose changes; `docker compose build` +
   live render verification.

### Test placement

- The package gets `packages/manim-codegen/tests/*` snapshot tests asserting exact
  emitted strings for representative objects/clips/keyframes (byte-stability of the
  single source).
- `services/web/tests/components/manim-export.test.js` and the per-phase codegen
  tests stay; they now exercise the thin web wrapper (which pulls the shared core)
  and still assert the parser round-trips. Their "byte-identical across files"
  intent is now structurally guaranteed (one source), but the tests remain as
  regression guards and continue to assert the intended api↔web asset divergence.
- Vitest resolves `@manim/codegen` via the workspace; confirm `vitest.config.js`
  needs no alias (workspace symlink in root node_modules should suffice; add a
  resolve alias only if resolution fails).

### Backward compatibility

- Every existing project re-renders byte-identically (server path) and re-exports
  byte-identically (client placeholder).
- `generatePythonCode`, `generateManimScript`, `parseManimScript`,
  `downloadManimScript`, `generateCode`, and the `objectCode` / `EASING_MAP` named
  exports keep their signatures and import paths.

## Files Touched

| File | Change |
|---|---|
| `package.json` (root) | **NEW** — workspaces manifest |
| `package-lock.json` (root) | **NEW** — single lockfile |
| `packages/manim-codegen/**` | **NEW** — the shared package (7 src modules + tests) |
| `services/api/src/compiler/codegen.js` | reduce to thin wrapper + re-exports |
| `services/api/src/compiler/index.js` | no change (signature preserved) — listed for awareness |
| `services/web/src/export/manim.js` | generator → thin wrapper; **parser unchanged** |
| `services/api/Dockerfile` | root-context workspace install + copy |
| `services/web/Dockerfile` | root-context workspace install + copy + build |
| `docker-compose.yml` | api/web/web-dev contexts → repo root; bind-mount + volume updates |
| `services/web/package.json`, `services/api/package.json` | add `@manim/codegen` dependency |
| CLAUDE.md | replace the 19 "byte-identical" warnings with a single "one source: `@manim/codegen`" note |

## Success Criteria

1. A single source (`@manim/codegen`) generates all shared Python; the 19
   hand-sync warnings collapse to one structural note.
2. `npm run test:unit` (339) and `npm test` (114) pass unchanged.
3. `docker compose build api web` succeeds and a live render produces output
   identical to pre-refactor for the same project.
4. Adding a future object/clip type requires editing the package **once**
   (plus the web parser), not two byte-identical files.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Docker context change breaks dev hot-reload or volume mounts | Incremental: code de-dup lands and is fully green **before** the Docker step; the Docker step is isolated and verified with a live render |
| Stale `api_node_modules` volume shadows the new hoisted modules | Explicit `docker volume rm` in rollout; rename to `root_node_modules` |
| Vitest can't resolve the workspace symlink | Fallback `resolve.alias` for `@manim/codegen` in `vitest.config.js` |
| A subtle asset-path string mismatch reintroduces a divergence | Copy the exact current expressions into the resolvers; snapshot tests assert both forms |
| The two top-level generators differ in more than asset wiring | Diff `generatePythonCode` vs `generateManimScript` line-by-line before unifying `generateScene`; gate behind passing parity suite |
