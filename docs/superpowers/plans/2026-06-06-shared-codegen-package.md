# Shared `@manim/codegen` Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the hand-maintained duplication between `services/api/src/compiler/codegen.js` and the generator half of `services/web/src/export/manim.js` by extracting a single shared ESM workspace package, `@manim/codegen`, consumed by both services.

**Architecture:** Create an npm-workspaces monorepo with a new `packages/manim-codegen` package holding one canonical copy of every shared generator function (constants, helpers, 2D/3D object code, clip/keyframe code, top-level `generateScene` orchestrator). The one real server↔client difference — asset file paths — is injected via a `resolveAsset` callback. `codegen.js` and the generator half of `manim.js` shrink to thin wrappers; the `manim.js` **parser stays put** (web-only). Docker build contexts move to the repo root so the package is in each image's build context.

**Tech Stack:** Node.js 20 (ESM), npm workspaces, Vite + Vitest (web), Express (api), Docker Compose.

**Canonical source:** Where the two files differ only structurally (DRY helpers vs inlined logic, variable names, comments), the **`manim.js` generator-half version is canonical** (it is the cleaner, DRY form). All emitted Python is output-equivalent today (verified by a normalized diff during planning); the existing parity/round-trip suites are the safety net at every step.

**Reference — spec:** `docs/superpowers/specs/2026-06-06-shared-codegen-package-design.md`

---

## Pre-flight: known facts (do not re-derive)

- Both `services/api` and `services/web` are ESM (`"type": "module"`).
- `codegen.js` exports: `generatePythonCode(project, assetsPath)` (reads `assetMap` from `project._assetMap`), and `export { objectCode, EASING_MAP }`. Only caller of `generatePythonCode`: `services/api/src/compiler/index.js` → `compileProject` (passes `(normalized, assetsBasePath)`).
- `manim.js` exports: `generateManimScript(project)`, `parseManimScript(code, sw, sh)`, `downloadManimScript(project)`, `generateCode` (alias), `EASING_MAP`, and a default object. Importers: `services/web/src/App.vue`, `services/web/src/components/topbar/Topbar.vue`.
- The **only real behavioral divergences** between the two generators are:
  1. **Empty-project guard.** `codegen.js`: `if (!project.objects || project.objects.length === 0) return ...`. `manim.js`: `if (project.objects.length === 0 && !(Array.isArray(project.cameraTrack) && project.cameraTrack.length > 0))` — also renders camera-only projects. **Canonical = `manim.js`'s camera-aware guard** (strict improvement for the server).
  2. **`axes.add(graph)` placement.** `manim.js` emits the base-curve `axes.add(gn)` inside `objCode`; `codegen.js` emits it in the main loop after `objectCode`. Output equivalent modulo submobject draw order. **Canonical = `manim.js` (inside object code).**
  3. **Image / svg asset path** (intended). Handled by the `resolveAsset` seam.
- The `manim.js` **parser half** (lines 1278–2395) uses these shared symbols: `manimToStage` (parser-only — stays local), `EASING_REV` (parser-only — stays local, built from `EASING_MAP`), and `EASING_MAP`, `hex`, `FRAME_WIDTH`, `FRAME_HEIGHT` (must be **imported from `@manim/codegen`** after extraction). It does **not** use `v`/`vn` or the other helpers.
- `singleClipCode` / `animExpr` are **inner closures** of `generateManimScript` (they close over `oMap`, `sw`, `sh`, `is3D`, `obj3DTypes`, `indent`). They stay inside `generateScene` (in the package `index.js`), **not** in a separate module.
- `codegen.js` `text` case has a **dead** `const fontVar = ...` line (declared, never pushed) — drop it in the canonical version.

## Module map (`packages/manim-codegen/src/`)

| Module | Contents (canonical = `manim.js` line refs) |
|---|---|
| `constants.js` | `EASING_MAP` (manim 14–33), `FRAME_WIDTH/HEIGHT/X_RADIUS/Y_RADIUS` (98–101), `GRADIENT_TYPES`/`DASH_TYPES`/`SHADOW_TYPES` (104–106) |
| `helpers.js` | `rf, rfOpt, rtOpt` (37,38,40), `vn` (from `v` 39), `hex` (43–49), `safeNum` (52–56), `safeOpacity` (58–61), `safeMathExpr` (63–70), `safeText` (73–76), `safeLatex` (80–82), `safeMatrixEntry` (85–88), `matrixBrackets` (91–95), `fillOpacityExpr` (109–113), `strokeOpacityArg` (115–119), `gradientLine` (121–126), `dashedLines` (128–137), `roundCornersLine` (139–143), `shadowLines` (145–156), `stageToManim` (259–261), `pathPointsPy` (268–277), `isSystemFont` (280–288), `fmt3d` (198–201) |
| `objects3d.js` | `objectCode3d` (203–257) |
| `objects.js` | `objectCode` (from `objCode` 292–633) + `resolveAsset` seam in the `image`/`svg_asset` arms |
| `clips.js` | `transformExpr` (161–171), `emphasisExpr` (174–194) |
| `keyframes.js` | `_kfPropSet` (634–659), `_kfUpdater` (660–671), `_kfValue` (672–680), `generateKeyframeSteps` (681–798) |
| `index.js` | barrel re-exports + `generateScene(project, { resolveAsset })` (from `generateManimScript` 799–1277, with inner `singleClipCode`/`animExpr`) |

> **Move discipline:** "copy verbatim from manim.js:A–B" means paste the exact bytes, then add `import` lines for whatever symbols that function references, and `export` the function. Do **not** retype from memory. After each move, the regression suites confirm output is unchanged.

---

## Task 1: Scaffold the workspace and empty package

**Files:**
- Create: `package.json` (repo root)
- Create: `packages/manim-codegen/package.json`
- Create: `packages/manim-codegen/src/index.js` (placeholder)
- Modify: `services/api/package.json` (add dependency)
- Modify: `services/web/package.json` (add dependency)

- [ ] **Step 1: Create the root workspace manifest**

Create `package.json` (repo root):

```json
{
  "name": "manim-motion-editor",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "workspaces": [
    "packages/*",
    "services/api",
    "services/web"
  ]
}
```

- [ ] **Step 2: Create the package manifest**

Create `packages/manim-codegen/package.json`:

```json
{
  "name": "@manim/codegen",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "exports": {
    ".": "./src/index.js"
  },
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Create a placeholder entry so resolution works**

Create `packages/manim-codegen/src/index.js`:

```js
// Placeholder — populated in later tasks.
export const __placeholder = true;
```

- [ ] **Step 4: Declare the dependency in both services**

In `services/api/package.json`, add to `"dependencies"`:

```json
    "@manim/codegen": "*"
```

In `services/web/package.json`, add to `"dependencies"`:

```json
    "@manim/codegen": "*"
```

- [ ] **Step 5: Install workspaces from the repo root**

Run: `npm install`
Expected: succeeds; creates a root `node_modules/@manim/codegen` symlink to `packages/manim-codegen` and a root `package-lock.json`.

Verify the symlink resolves:
Run: `node --input-type=module -e "import('@manim/codegen').then(m => console.log('ok', m.__placeholder))"`
Expected: `ok true`

- [ ] **Step 6: Confirm existing suites still pass unchanged**

Run: `cd services/web && npm run test:unit`
Expected: 339 passed.
Run: `cd services/web && npm test`
Expected: 114 passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json packages/manim-codegen/package.json packages/manim-codegen/src/index.js services/api/package.json services/web/package.json
git commit -m "chore: scaffold @manim/codegen workspace package"
```

---

## Task 2: Move constants to the package

**Files:**
- Create: `packages/manim-codegen/src/constants.js`
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Create `constants.js`**

Copy verbatim from `manim.js`: `EASING_MAP` (lines 14–33), `FRAME_WIDTH`/`FRAME_HEIGHT`/`FRAME_X_RADIUS`/`FRAME_Y_RADIUS` (98–101), `GRADIENT_TYPES`/`DASH_TYPES`/`SHADOW_TYPES` (104–106). Prefix each top-level declaration with `export`. The file has no imports.

Expected shape:

```js
export const EASING_MAP = { /* ...verbatim... */ };
export const FRAME_WIDTH = 14 + 2 / 9;
export const FRAME_HEIGHT = 8;
export const FRAME_X_RADIUS = FRAME_WIDTH / 2;
export const FRAME_Y_RADIUS = FRAME_HEIGHT / 2;
export const GRADIENT_TYPES = new Set([ /* ...verbatim... */ ]);
export const DASH_TYPES = new Set([ /* ...verbatim... */ ]);
export const SHADOW_TYPES = new Set([ /* ...verbatim... */ ]);
```

- [ ] **Step 2: Import constants in `codegen.js`, delete the local copies**

At the top of `services/api/src/compiler/codegen.js` (after the file header comment), add:

```js
import {
  EASING_MAP, FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS,
  GRADIENT_TYPES, DASH_TYPES, SHADOW_TYPES,
} from '@manim/codegen/src/constants.js';
```

Delete the local `const EASING_MAP = {...}` (14–33), the `FRAME_*` block (101–104 region), and the `GRADIENT_TYPES`/`DASH_TYPES`/`SHADOW_TYPES` declarations (107–109). Keep the existing `export { objectCode, EASING_MAP }` working by re-exporting (handled in Task 8; for now, change line 1383 to `export { objectCode };` and add `export { EASING_MAP } from '@manim/codegen/src/constants.js';`).

- [ ] **Step 3: Import constants in `manim.js`, delete the local copies**

At the top of `services/web/src/export/manim.js`, add:

```js
import {
  EASING_MAP, FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS,
  GRADIENT_TYPES, DASH_TYPES, SHADOW_TYPES,
} from '@manim/codegen';
```

Delete the local `EASING_MAP` (14–33), `FRAME_*` (98–101), and `*_TYPES` (104–106) declarations. **Keep** the `EASING_REV` block (34–35) — it now consumes the imported `EASING_MAP`. **Keep** `manim.js`'s own `export { EASING_MAP }` (line 2394) by changing it to re-export: `export { EASING_MAP } from '@manim/codegen';`

- [ ] **Step 4: Run suites**

Run: `cd services/web && npm run test:unit && npm test`
Expected: 339 + 114 passed (output byte-identical; constants are the same values).

- [ ] **Step 5: Commit**

```bash
git add packages/manim-codegen/src/constants.js services/api/src/compiler/codegen.js services/web/src/export/manim.js
git commit -m "refactor(codegen): move shared constants to @manim/codegen"
```

---

## Task 3: Move pure helpers to the package

**Files:**
- Create: `packages/manim-codegen/src/helpers.js`
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Create `helpers.js`**

Copy verbatim from `manim.js` (canonical) the helper functions listed in the module map row for `helpers.js`. **Rename `v` → `vn`** (the package uses `vn` as the single canonical name). Add at the top:

```js
import { FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS, DASH_TYPES, SHADOW_TYPES } from './constants.js';
```

`export` every function. Note: `gradientLine`/`shadowLines` call `hex`; `dashedLines`/`shadowLines` read `DASH_TYPES`/`SHADOW_TYPES`; `roundCornersLine`/`shadowLines`/`pathPointsPy`/`stageToManim` use `FRAME_*`. All these are now imported or defined in-file. Do **not** include `manimToStage` (parser-only) here.

- [ ] **Step 2: Import helpers in `codegen.js`, delete local copies**

Add to the `@manim/codegen` import block in `codegen.js`:

```js
import {
  rf, rfOpt, rtOpt, vn, hex, safeNum, safeOpacity, safeMathExpr, safeText,
  safeLatex, safeMatrixEntry, matrixBrackets, fillOpacityExpr, strokeOpacityArg,
  gradientLine, dashedLines, roundCornersLine, shadowLines, stageToManim,
  pathPointsPy, isSystemFont, fmt3d,
} from '@manim/codegen/src/helpers.js';
```

Delete the corresponding local function definitions (`rf` 34, `rfOpt` 35, `vn` 36, `rtOpt` 37, `hex` 40, `safeNum` 51, `safeOpacity` 57, `safeMathExpr` 63, `safeText` 76, `safeLatex` 83, `safeMatrixEntry` 88, `matrixBrackets` 94, `fillOpacityExpr` 112, `strokeOpacityArg` 118, `gradientLine` 124, `dashedLines` 131, `roundCornersLine` 142, `shadowLines` 148, `stageToManim` 184, `pathPointsPy` 190, `isSystemFont` 264, `fmt3d` 203). `codegen.js` already used `vn` (not `v`), so no call-site renames are needed.

- [ ] **Step 3: Import helpers in `manim.js`, delete local copies, fix `v`→`vn` call sites**

`manim.js`'s generator AND parser call `v(...)`. Two options — choose this: keep a one-line local alias so call sites are untouched:

Add to the `@manim/codegen` import in `manim.js`:

```js
import {
  rf, rfOpt, rtOpt, vn, hex, safeNum, safeOpacity, safeMathExpr, safeText,
  safeLatex, safeMatrixEntry, matrixBrackets, fillOpacityExpr, strokeOpacityArg,
  gradientLine, dashedLines, roundCornersLine, shadowLines, stageToManim,
  pathPointsPy, isSystemFont, fmt3d,
} from '@manim/codegen';
const v = vn;   // local alias: existing generator+parser call sites use v()
```

Delete the corresponding local definitions in `manim.js` (`rf` 37 … `isSystemFont` 280, plus `fmt3d` 198, `stageToManim` 259, `pathPointsPy` 268 — but **keep** `manimToStage` at 262, parser-only).

- [ ] **Step 4: Run suites**

Run: `cd services/web && npm run test:unit && npm test`
Expected: 339 + 114 passed. If a `ReferenceError` names a symbol, it means a call site references a helper not yet imported — add it to the import list.

- [ ] **Step 5: Commit**

```bash
git add packages/manim-codegen/src/helpers.js services/api/src/compiler/codegen.js services/web/src/export/manim.js
git commit -m "refactor(codegen): move shared pure helpers to @manim/codegen"
```

---

## Task 4: Move 3D object code + keyframe code

**Files:**
- Create: `packages/manim-codegen/src/objects3d.js`
- Create: `packages/manim-codegen/src/keyframes.js`
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Create `objects3d.js`**

Copy `objectCode3d` verbatim from `manim.js` (203–257). Add imports:

```js
import { vn, hex, safeOpacity, fmt3d } from './helpers.js';
```

(Inside, the canonical uses `v(obj.id)` → change that one call to `vn(obj.id)`.) `export function objectCode3d(obj) { ... }`.

- [ ] **Step 2: Create `keyframes.js`**

Copy `_kfPropSet` (634–659), `_kfUpdater` (660–671), `_kfValue` (672–680), `generateKeyframeSteps` (681–798) verbatim from `manim.js`. Add imports:

```js
import { vn, stageToManim, rf, rfOpt, rtOpt } from './helpers.js';
import { FRAME_WIDTH } from './constants.js';
```

Change `generateKeyframeSteps`'s internal `v(...)` calls to `vn(...)`. `export function generateKeyframeSteps(...)`. (`_kfPropSet`/`_kfUpdater`/`_kfValue` are used only by `generateKeyframeSteps` — they need not be exported, but export them too for the package tests.)

> Verify the exact helper set each function references before finalizing imports; add any missing symbol. `generateKeyframeSteps` is the only one called externally.

- [ ] **Step 3: Wire both services**

In `codegen.js` add to imports:

```js
import { objectCode3d } from '@manim/codegen/src/objects3d.js';
import { generateKeyframeSteps } from '@manim/codegen/src/keyframes.js';
```

Delete local `objectCode3d` (208–257), `_kfPropSet` (645), `_kfUpdater` (671), `_kfValue` (684), `generateKeyframeSteps` (693–808) from `codegen.js`.

In `manim.js` add to imports:

```js
import { objectCode3d, generateKeyframeSteps } from '@manim/codegen';
```

Delete the same locals from `manim.js` (`objectCode3d` 203, `_kfPropSet` 634 … `generateKeyframeSteps` 681–798).

> `index.js` must re-export `objectCode3d` and `generateKeyframeSteps` for the bare `@manim/codegen` specifier to resolve them — add those re-exports now (see Task 7 barrel; or temporarily import from the deep path `@manim/codegen/src/...` in `manim.js` and switch to the barrel in Task 7).

- [ ] **Step 4: Run suites**

Run: `cd services/web && npm run test:unit && npm test`
Expected: 339 + 114 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/manim-codegen/src/objects3d.js packages/manim-codegen/src/keyframes.js services/api/src/compiler/codegen.js services/web/src/export/manim.js
git commit -m "refactor(codegen): move 3D object + keyframe codegen to @manim/codegen"
```

---

## Task 5: Move 2D object code with the `resolveAsset` seam

**Files:**
- Create: `packages/manim-codegen/src/objects.js`
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Create `objects.js` from the canonical `objCode`**

Copy `objCode` verbatim from `manim.js` (292–633). Rename the function to `objectCode` and change its signature to accept an options object with `resolveAsset`:

```js
import {
  vn, hex, safeNum, safeOpacity, safeText, safeLatex, safeMathExpr,
  safeMatrixEntry, matrixBrackets, fillOpacityExpr, strokeOpacityArg,
  gradientLine, dashedLines, roundCornersLine, shadowLines, stageToManim,
} from './helpers.js';
import { FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS, GRADIENT_TYPES } from './constants.js';

export function objectCode(obj, sw, sh, { resolveAsset }) {
  const n = vn(obj.id), lines = [];
  // ...verbatim body, with v(...) → vn(...) throughout...
}
```

> Replace **every** `v(` call inside the copied body with `vn(`. Verify no `v(` remains.

- [ ] **Step 2: Replace the image/svg arms with `resolveAsset`**

In the copied body, the canonical (manim) `image`/`svg_asset` arms read:

```js
    case 'image':
      lines.push(`${n} = ImageMobject("${obj.name || 'image'}.png").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
    case 'svg_asset':
      lines.push(`${n} = SVGMobject("${obj.name || 'asset'}.svg").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
```

Replace with:

```js
    case 'image':
      lines.push(`${n} = ImageMobject("${resolveAsset(obj, 'png')}").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
    case 'svg_asset':
      lines.push(`${n} = SVGMobject("${resolveAsset(obj, 'svg')}").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
```

- [ ] **Step 3: Wire `manim.js` (placeholder resolver)**

In `manim.js`, delete the local `objCode` (292–633). Add to imports `objectCode` from `@manim/codegen`. The generator wrapper (built in Task 6) will pass:

```js
const resolveAssetWeb = (obj, ext) => `${obj.name || (ext === 'svg' ? 'asset' : 'image')}.${ext}`;
```

For now (before Task 6), update the existing `generateManimScript` call site that invoked `objCode(o, sw, sh)` to `objectCode(o, sw, sh, { resolveAsset: resolveAssetWeb })` and define `resolveAssetWeb` at the top of `generateManimScript`.

> This reproduces the current placeholder output byte-for-byte: `obj.name || 'image'` → `image`, `obj.name || 'asset'` → `asset`.

- [ ] **Step 4: Wire `codegen.js` (server resolver)**

In `codegen.js`, delete the local `objectCode` (276–630). Import `objectCode` from `@manim/codegen`. In `generatePythonCode`, define:

```js
const resolveAssetServer = (obj, ext) => {
  const asset = obj.assetId ? assetMap[obj.assetId] : null;
  const filename = asset?.filename
    || `${(obj.name || (ext === 'svg' ? 'asset' : 'image')).replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
  return `${assetsPath}/${filename}`;
};
```

and change the call site `objectCode(obj, sw, sh, assetsPath, assetMap)` → `objectCode(obj, sw, sh, { resolveAsset: resolveAssetServer })`.

> This reproduces the current server output byte-for-byte: same `assetMap` lookup, same sanitized fallback, same `${assetsPath}/${filename}`.

- [ ] **Step 5: Run suites**

Run: `cd services/web && npm run test:unit && npm test`
Expected: 339 + 114 passed (the image/svg parity tests assert the **divergent** forms — server path vs placeholder — both still produced).

- [ ] **Step 6: Commit**

```bash
git add packages/manim-codegen/src/objects.js services/api/src/compiler/codegen.js services/web/src/export/manim.js
git commit -m "refactor(codegen): move 2D objectCode to @manim/codegen with resolveAsset seam"
```

---

## Task 6: Move clip helpers + the `generateScene` orchestrator

**Files:**
- Create: `packages/manim-codegen/src/clips.js`
- Modify: `packages/manim-codegen/src/index.js`
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`
- Test: `packages/manim-codegen/tests/generate-scene.test.js`

- [ ] **Step 1: Create `clips.js`**

Copy `transformExpr` (manim 161–171) and `emphasisExpr` (manim 174–194) verbatim. Add:

```js
import { hex } from './helpers.js';
```

`export` both.

- [ ] **Step 2: Build `generateScene` in `index.js` from the canonical generator**

Copy the **body** of `generateManimScript` (manim 799–1277) into a new `generateScene(project, { resolveAsset })` in `index.js`. Keep the inner closures `singleClipCode` / `animExpr` exactly as they are (they close over `oMap`, `sw`, `sh`, `is3D`, `obj3DTypes`, `indent`). Required imports at the top of `index.js`:

```js
import { EASING_MAP, FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS,
         GRADIENT_TYPES, DASH_TYPES, SHADOW_TYPES } from './constants.js';
import { rf, rfOpt, rtOpt, vn, hex, safeNum, safeOpacity, safeMathExpr, safeText,
         safeLatex, safeMatrixEntry, matrixBrackets, fillOpacityExpr, strokeOpacityArg,
         gradientLine, dashedLines, roundCornersLine, shadowLines, stageToManim,
         pathPointsPy, isSystemFont, fmt3d } from './helpers.js';
import { objectCode } from './objects.js';
import { objectCode3d } from './objects3d.js';
import { transformExpr, emphasisExpr } from './clips.js';
import { generateKeyframeSteps } from './keyframes.js';
```

Changes to the copied body:
- Every `v(` → `vn(`.
- Every `objCode(o, sw, sh)` → `objectCode(o, sw, sh, { resolveAsset })`.
- The empty-project guard stays as the canonical camera-aware form (already in manim).
- The `axes.add(gn)` for the base curve is already emitted inside `objectCode` (canonical) — **delete** any duplicate `axes.add(gn)` loop in the orchestrator if present in the copied body (manim's orchestrator does not have one; confirm none remains).
- `export function generateScene(project, { resolveAsset }) { ... }`.

- [ ] **Step 3: Add the barrel re-exports in `index.js`**

Below `generateScene`, ensure the public surface is exported:

```js
export { generateScene };
export { objectCode } from './objects.js';
export { objectCode3d } from './objects3d.js';
export { generateKeyframeSteps } from './keyframes.js';
export { transformExpr, emphasisExpr } from './clips.js';
export * from './constants.js';
export * from './helpers.js';
```

Remove the `__placeholder` export.

- [ ] **Step 4: Reduce `codegen.js` to a thin wrapper**

`services/api/src/compiler/codegen.js` becomes:

```js
/**
 * Manim Python Code Generator — server wrapper over @manim/codegen.
 * Supplies server file paths for image/svg assets via resolveAsset.
 */
import { generateScene, objectCode, EASING_MAP } from '@manim/codegen';

export function generatePythonCode(project, assetsPath) {
  const assetMap = project._assetMap || {};
  const resolveAsset = (obj, ext) => {
    const asset = obj.assetId ? assetMap[obj.assetId] : null;
    const filename = asset?.filename
      || `${(obj.name || (ext === 'svg' ? 'asset' : 'image')).replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
    return `${assetsPath}/${filename}`;
  };
  return generateScene(project, { resolveAsset });
}

export { objectCode, EASING_MAP };
```

- [ ] **Step 5: Reduce the `manim.js` generator half to a thin wrapper (parser unchanged)**

In `manim.js`, replace the entire `generateManimScript` body (799–1277) with:

```js
export function generateManimScript(project) {
  const resolveAsset = (obj, ext) => `${obj.name || (ext === 'svg' ? 'asset' : 'image')}.${ext}`;
  return generateScene(project, { resolveAsset });
}
```

Add `generateScene` to the top `@manim/codegen` import. Confirm the parser half (1278–end) is **unchanged** and that its imports now include `EASING_MAP, hex, FRAME_WIDTH, FRAME_HEIGHT` from `@manim/codegen` (from Tasks 2–3) and keep local `manimToStage` + `EASING_REV`. Confirm `downloadManimScript`, `generateCode`, the default export, and `export { EASING_MAP }` re-export still work.

- [ ] **Step 6: Add a package-level snapshot test**

Create `packages/manim-codegen/tests/generate-scene.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateScene } from '../src/index.js';

const resolveAsset = (obj, ext) => `${obj.name || 'asset'}.${ext}`;

function baseProject(extra = {}) {
  return {
    name: 'T', stage: { width: 1920, height: 1080 },
    objects: [], tracks: [], cameraTrack: [], ...extra,
  };
}

describe('generateScene', () => {
  it('emits a Scene subclass and importable header', () => {
    const code = generateScene(baseProject(), { resolveAsset });
    expect(code).toContain('from manim import *');
    expect(code).toContain('class MainScene(');
    expect(code).toContain('def construct(self):');
  });

  it('renders a camera-only project (camera-aware empty guard)', () => {
    const code = generateScene(baseProject({
      cameraType: 'moving',
      cameraTrack: [{ id: 'cam1', type: 'camera_move', startTime: 0, duration: 1, params: { x: 0, y: 0, zoom: 2 } }],
    }), { resolveAsset });
    expect(code).toContain('MovingCameraScene');
    expect(code).toContain('self.camera.frame.animate');
  });
});
```

- [ ] **Step 7: Run all suites**

Run: `cd services/web && npm run test:unit && npm test`
Expected: 339 + 114 passed.
Run: `npm --workspace packages/manim-codegen test`
Expected: the 2 new tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/manim-codegen services/api/src/compiler/codegen.js services/web/src/export/manim.js
git commit -m "refactor(codegen): unify generateScene in @manim/codegen; services become thin wrappers"
```

---

## Task 7: Verify the api compiler still emits identically (Node-side check)

**Files:**
- Test: `services/api/test-codegen-smoke.mjs` (temporary, deleted at end of step)

- [ ] **Step 1: Smoke-test the api compiler against a sample project**

Create `services/api/test-codegen-smoke.mjs`:

```js
import { compileProject } from './src/compiler/index.js';

const project = {
  name: 'Smoke',
  stage: { width: 1920, height: 1080 },
  objects: [
    { id: 'o1', type: 'circle', x: 960, y: 540, width: 200, height: 200,
      fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1,
      rotation: 0, enterTime: 0, duration: 3, enterAnim: 'fade_in', exitAnim: 'none', zOrder: 0 },
    { id: 'img1', type: 'image', assetId: 'a1', name: 'logo', x: 200, y: 200,
      width: 300, height: 200, opacity: 1, rotation: 0, enterTime: 0, duration: 3,
      enterAnim: 'fade_in', exitAnim: 'none', zOrder: 1 },
  ],
  tracks: [],
  cameraTrack: [],
  _assetMap: { a1: { filename: 'logo_real.png' } },
};

const res = compileProject(project, '/data/assets/proj_1');
if (!res.success) { console.error('FAIL', res.errors); process.exit(1); }
const out = res.code;
console.assert(out.includes('Circle(radius='), 'circle missing');
console.assert(out.includes('ImageMobject("/data/assets/proj_1/logo_real.png")'), 'server asset path missing');
console.log('SMOKE OK');
```

Run: `node services/api/test-codegen-smoke.mjs`
Expected: `SMOKE OK` (no assertion errors). This confirms the api wrapper resolves `@manim/codegen` and produces the **server** asset path.

- [ ] **Step 2: Delete the smoke file and commit nothing**

```bash
rm services/api/test-codegen-smoke.mjs
```

(No commit — this step is verification only.)

---

## Task 8: Docker — repo-root build context for api + web

**Files:**
- Modify: `services/api/Dockerfile`
- Modify: `services/web/Dockerfile`
- Modify: `docker-compose.yml`
- Create: `.dockerignore` (repo root, if absent)

- [ ] **Step 1: Update `services/api/Dockerfile` for the monorepo**

Replace with:

```dockerfile
FROM node:20-alpine

WORKDIR /app
RUN mkdir -p /data && chown -R node:node /app /data
USER node

# Install from root workspace manifests (deps hoist to /app/node_modules)
COPY --chown=node:node package*.json ./
COPY --chown=node:node packages/manim-codegen/package.json packages/manim-codegen/package.json
COPY --chown=node:node services/api/package.json services/api/package.json
RUN npm install

# Copy sources
COPY --chown=node:node packages/manim-codegen packages/manim-codegen
COPY --chown=node:node services/api services/api

EXPOSE 3000
CMD ["npm", "--workspace", "services/api", "run", "dev"]
```

- [ ] **Step 2: Update `services/web/Dockerfile` for the monorepo**

Replace with:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY packages/manim-codegen/package.json packages/manim-codegen/package.json
COPY services/web/package.json services/web/package.json
RUN npm install
COPY packages/manim-codegen packages/manim-codegen
COPY services/web services/web

FROM deps AS build
RUN npm --workspace services/web run build

FROM nginx:alpine
COPY --from=build /app/services/web/dist /usr/share/nginx/html
COPY services/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Create a root `.dockerignore`**

Create `.dockerignore` (repo root):

```
**/node_modules
**/dist
.git
docs
```

- [ ] **Step 4: Update `docker-compose.yml` — api service**

Change the `api` service `build:` and `volumes:`:

```yaml
  api:
    build:
      context: .
      dockerfile: services/api/Dockerfile
    environment:
      - NODE_ENV=development
      - DATA_DIR=/data
      - REDIS_URL=redis://redis:6379
      - PORT=3000
    volumes:
      - manim_motion_data:/data
      - ./services/api/src:/app/services/api/src
      - ./packages/manim-codegen/src:/app/packages/manim-codegen/src
      - root_node_modules:/app/node_modules
```

(Keep the existing `ports`, `depends_on`, `healthcheck`, `deploy` blocks unchanged.)

- [ ] **Step 5: Update `docker-compose.yml` — web + web-dev services**

For the production `web` service:

```yaml
  web:
    build:
      context: .
      dockerfile: services/web/Dockerfile
```

For the dev web service (the one with `target: deps` + the vite command), set:

```yaml
    build:
      context: .
      dockerfile: services/web/Dockerfile
      target: deps
    command: npm --workspace services/web exec vite -- --host 0.0.0.0 --port 5173
    working_dir: /app
    volumes:
      - ./services/web/src:/app/services/web/src
      - ./packages/manim-codegen/src:/app/packages/manim-codegen/src
```

(Adjust only `build`, `command`, `working_dir`, and the bind-mount paths; keep other keys.)

- [ ] **Step 6: Update the named volume declaration**

In the top-level `volumes:` section of `docker-compose.yml`, replace `api_node_modules:` with `root_node_modules:` (and remove the obsolete `api_node_modules` entry).

- [ ] **Step 7: Remove the stale named volume, then build**

Run: `docker volume rm manim_motion_api_node_modules`
Expected: removed (or "no such volume" if already gone — both fine).

Run: `docker compose build api web`
Expected: both images build; `npm install` resolves `@manim/codegen` as a workspace.

- [ ] **Step 8: Live render verification**

Run: `docker compose up -d`
Then create a project with an `axes` + a graph and an `image` object in the UI and trigger a render.
Expected: render completes; the axes curve **and** the image appear; output matches a pre-refactor render of the same project.

Run: `docker compose logs api --tail=50`
Expected: no `ERR_MODULE_NOT_FOUND` for `@manim/codegen`.

- [ ] **Step 9: Commit**

```bash
git add services/api/Dockerfile services/web/Dockerfile docker-compose.yml .dockerignore
git commit -m "build: repo-root build context for api+web to ship @manim/codegen"
```

---

## Task 9: Update docs (CLAUDE.md) and final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the byte-identical warnings with a single source-of-truth note**

In `CLAUDE.md`, replace the scattered "Keep X byte-identical across codegen.js/manim.js" instructions (there are ~19) with one consolidated note near the top of the codegen-related sections:

```markdown
## Code Generation — single source of truth (v3.14.0)

All Manim Python generation lives in the **`@manim/codegen`** workspace package
(`packages/manim-codegen/src/`): `constants.js`, `helpers.js`, `objects.js`,
`objects3d.js`, `clips.js`, `keyframes.js`, and `index.js` (`generateScene`).
`services/api/src/compiler/codegen.js` and the generator half of
`services/web/src/export/manim.js` are **thin wrappers** that call
`generateScene(project, { resolveAsset })` with a service-specific `resolveAsset`
(server file path vs client placeholder). The **`.py` parser** stays in
`services/web/src/export/manim.js` (web-only).

When adding a new object/clip type, edit the package **once** (plus the web parser).
There is no longer any byte-identical duplication to hand-maintain.
```

Leave per-type semantic notes (what each type emits) intact; only remove the now-obsolete "keep byte-identical across the two files" clauses.

- [ ] **Step 2: Full green run**

Run: `cd services/web && npm run test:unit && npm test`
Expected: 339 + 114 passed.
Run: `npm --workspace packages/manim-codegen test`
Expected: passes.
Run: `cd services/web && npm run build`
Expected: build succeeds (watch the Vue 3 `<template v-for>` rule is unaffected — no Vue changes here).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: @manim/codegen is the single codegen source of truth (v3.14.0)"
```

---

## Self-Review checklist (completed during planning)

- **Spec coverage:** workspace package (Task 1), constants/helpers/objects3d/keyframes/objects/clips/generateScene moves (Tasks 2–6), resolveAsset seam (Task 5), thin wrappers (Task 6), Docker repo-root context + volume gotcha (Task 8), CLAUDE.md update (Task 9), parser stays web-only (Task 6 step 5), backward-compat exports preserved (Tasks 2, 6). ✅
- **Behavioral reconciliations:** empty-project guard (canonical camera-aware, tested in Task 6 step 6); `axes.add(gn)` single placement (Task 6 step 2); image/svg seam parity (Task 5 step 5). ✅
- **Type consistency:** the package uses `vn` everywhere; `manim.js` keeps a `const v = vn` alias for its untouched generator/parser call sites; `objectCode(obj, sw, sh, { resolveAsset })` signature is consistent across objects.js, the orchestrator, and both wrappers. ✅
- **No placeholders:** every step has concrete code or an exact command + expected output. Verbatim-move steps cite exact source line ranges. ✅
```
