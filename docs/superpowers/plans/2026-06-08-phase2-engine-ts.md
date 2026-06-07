# Phase 2 — `engine/*` → strict TypeScript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 9 `services/web/src/engine/*.js` modules to strict TypeScript (`.ts`), with a shared `engine/types.ts` domain model, zero behavior change, and a web typecheck gate wired into the root `typecheck` script + CI.

**Architecture:** Engine modules are self-contained (they import only each other + JS built-ins). Rename `.js`→`.ts` leaf-first (dependency order), preserving function bodies byte-for-byte and keeping `.js`-extension import specifiers (the established NodeNext/bundler convention — the Vite/Vitest `resolve-ts-from-js` plugin + `source` condition already remap them at runtime; `moduleResolution: "bundler"` performs the same `.js`→`.ts` substitution at typecheck time). A new `services/web/tsconfig.json` (extends `tsconfig.base.json`, adds DOM lib) type-checks only `src/**/*.ts`, so it picks up engine files as they migrate and stays green on the still-`.js` rest of the app.

**Tech Stack:** TypeScript 5 (strict), `vue-tsc` (forward-compatible typechecker, already a devDep), `tsx` (already a root devDep — runs the plain-Node `engine.test.mjs` which must now import `.ts` engine modules), Vite 5 + Vitest 2 (web app + unit tests).

---

## Critical conventions (apply to EVERY migration task)

1. **`git mv file.js file.ts`** — never delete+create (preserves history).
2. **Do NOT change import specifiers.** Inside a migrated `.ts` file, `import { x } from './geometry.js'` STAYS `.js`. Consumers (`store/project.js`, `*.vue`, `configs/*.js`) keep importing `../engine/easing.js` — the resolver plugin handles it. No consumer files change in this phase.
3. **Preserve function bodies byte-for-byte.** Only add type annotations, declare class fields, remove provably-dead code explicitly called out, and apply the enumerated strict-mode fixes. No logic changes.
4. **Keep existing `export default { … }` blocks** — they keep functions "used" and are harmless.
5. **After each task:** `npm run typecheck` (from repo root) → PASS, `npm run test:unit --workspace services/web` → 515 pass, `npm test --workspace services/web` → 114 pass. Then commit.

---

## Task 1: TS config + shared types + typecheck/test wiring

**Files:**
- Create: `services/web/src/engine/types.ts`
- Create: `services/web/tsconfig.json`
- Modify: `package.json` (root) — `typecheck` script
- Modify: `services/web/package.json` — `test` script (`node` → `tsx`)
- Modify: `.github/workflows/ci.yml` — typecheck step name (cosmetic)

- [ ] **Step 1: Create the shared engine types**

Create `services/web/src/engine/types.ts`:

```ts
// Shared structural types for the preview engine. These describe the runtime
// "stage" shapes the playback engine reads (a loose superset of store objects).
// Phase 3/4 may reconcile these with the @manim/codegen domain model.

export interface Point {
  x: number;
  y: number;
}

export interface Point3D {
  x3d: number;
  y3d: number;
  z3d: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export type Vertex = [number, number];

export interface EasingSpec {
  type: string;
  handles?: number[];
}

export interface Keyframe {
  time: number;
  value: number;
  easing?: EasingSpec;
}

export interface KeyframeRange {
  start: number;
  end: number;
}

// Wide stage object (preview runtime shape). Mirrors store objects loosely.
export interface StageObject {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  x3d?: number;
  y3d?: number;
  z3d?: number;
  enterTime?: number;
  duration?: number;
  enterAnim?: string;
  exitAnim?: string;
  enterAnimDur?: number;
  exitAnimDur?: number;
  keyframes?: Record<string, Keyframe[]>;
  keyframeMode?: Record<string, string>;
  [k: string]: unknown;
}

// Per-object animatable overrides produced each frame.
export interface Overrides {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  scaleX?: number;
  scaleY?: number;
  fill?: string;
  stroke?: string;
  value?: number;
  x3d?: number;
  y3d?: number;
  z3d?: number;
  [k: string]: unknown;
}

// Known animation parameter bag. Typed fields keep playback arithmetic strict;
// the index signature preserves the wide, open-ended shape.
export interface ClipParams {
  targetX?: number;
  targetY?: number;
  targetScaleX?: number;
  targetScaleY?: number;
  targetOpacity?: number;
  targetRotation?: number;
  scale_factor?: number;
  color?: string;
  n_wiggles?: number;
  rotation_angle?: number;
  scale_value?: number;
  shape?: string;
  fade_out?: boolean;
  phi?: number;
  theta?: number;
  zoom?: number;
  [k: string]: unknown;
}

export interface Clip {
  id: string;
  type: string;
  startTime: number;
  duration: number;
  easing?: string;
  sourceId?: string;
  targetId?: string;
  objectId?: string;
  params?: ClipParams;
  path?: Array<Point | Point3D>;
  from?: number;
  to?: number;
  overshoot?: number;
  settle?: number;
  morphQuality?: string;
  [k: string]: unknown;
}

export interface Track {
  clips?: Clip[];
  [k: string]: unknown;
}

export interface CameraClip {
  startTime: number;
  duration: number;
  easing?: string;
  params?: ClipParams;
  [k: string]: unknown;
}

export interface MorphState {
  points: Point[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  flatPoints?: number[];
  [k: string]: unknown;
}

export interface ClipResult {
  objectId?: string;
  overrides?: Overrides;
  morphState?: MorphState;
  hideIds?: string[];
  clipId?: string;
  [k: string]: unknown;
}

export interface EvaluatedClip {
  trackIndex: number;
  clipResult: ClipResult | null;
}

export interface CameraState {
  x?: number;
  y?: number;
  zoom?: number;
  phi?: number;
  theta?: number;
  is3d?: boolean;
}

export interface FrameState {
  objectOverrides: Record<string, Overrides>;
  morphShapes: Array<MorphState & { trackIndex?: number; clipId?: string }>;
  hiddenIds: Set<string>;
  cameraState?: CameraState | null;
}

// Camera parameters for the 3D projection helpers (projection3d.ts).
export interface Cam3D {
  phi?: number;
  theta?: number;
  zoom?: number;
  mode?: string;
  focalDistance?: number;
}
```

- [ ] **Step 2: Create the web tsconfig**

Create `services/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "checkJs": false,
    "noEmit": true,
    "types": []
  },
  "include": ["src/**/*.ts"]
}
```

Notes: `moduleResolution: "bundler"` lets `./foo.js` specifiers resolve to `./foo.ts`. `checkJs: false` means the not-yet-migrated `.js` files are not type-checked (only `.ts` files report errors). `lib` adds DOM for `requestAnimationFrame`/`cancelAnimationFrame`/`console`. `include` only matches `.ts`, so right now it sees only `types.ts`.

- [ ] **Step 3: Wire web typecheck into the root `typecheck` script**

In root `package.json`, change the `typecheck` script so it builds codegen (emits the `.d.ts` consumers need) then type-checks both packages:

```json
"build:codegen": "tsc -p packages/manim-codegen/tsconfig.json",
"typecheck": "npm run build:codegen && vue-tsc -p services/web/tsconfig.json --noEmit"
```

(`build:codegen` already type-checks codegen as it emits, so a separate codegen `--noEmit` pass is redundant. `vue-tsc` is used — not plain `tsc` — so later phases that add `.vue` files need no script change.)

- [ ] **Step 4: Switch the engine test runner to tsx**

The engine test (`tests/engine.test.mjs`) runs under plain Node, which cannot import `.ts`. Switch it to `tsx` (resolves `.js`→`.ts`, verified working). In `services/web/package.json`:

```json
"pretest": "npm run build:codegen --prefix ../..",
"test": "tsx tests/engine.test.mjs",
```

(`pretest` stays — `engine.test.mjs` imports `../src/export/manim.js`, which imports the `@manim/codegen` barrel; under tsx that resolves the `import` condition → `dist/`, so dist must be built first.)

- [ ] **Step 5: Update CI typecheck step name (cosmetic)**

In `.github/workflows/ci.yml`, rename the typecheck step for accuracy (the script now covers web too):

```yaml
      - name: Typecheck (codegen + web engine)
        run: npm run typecheck
```

Leave the Phase-6 comment about `npm run lint` + full typecheck as-is.

- [ ] **Step 6: Verify and commit**

Run from repo root:
```bash
npm run typecheck
npm run test:unit --workspace services/web
npm test --workspace services/web
```
Expected: typecheck PASS (only `types.ts` checked, no errors); unit 515 passed; engine 114 passed (now via tsx).

```bash
git add services/web/tsconfig.json services/web/src/engine/types.ts package.json services/web/package.json .github/workflows/ci.yml
git commit -m "build(web): TS config + engine domain types + typecheck/tsx wiring (phase 2)"
```

---

## Task 2: Migrate leaf modules — easing, geometry, keyframe

**Files:**
- Rename: `services/web/src/engine/easing.js` → `.ts`
- Rename: `services/web/src/engine/geometry.js` → `.ts`
- Rename: `services/web/src/engine/keyframe.js` → `.ts`

These three have no engine imports and are exercised directly by `engine.test.mjs` (easing, geometry) and `keyframe-*.test.js` / `engine.test.mjs` (keyframe).

- [ ] **Step 1: Migrate easing.ts**

`git mv services/web/src/engine/easing.js services/web/src/engine/easing.ts`. Add types, bodies unchanged:
- `export const EASING_FUNCTIONS: Record<string, (t: number) => number> = { … };`
- `overshootSettle(t: number, overshoot = 1.04, settle = 1.0): number`
- `getEasing(name: string): (t: number) => number`
- `evaluateEasing(t: number, easingName = 'ease_in_out', overshootAmount = 0, settleValue = 1.0): number`
- `EASING_LIST` infers fine; annotate as `{ value: string; label: string }[]` for clarity.

- [ ] **Step 2: Migrate geometry.ts**

`git mv … geometry.js geometry.ts`. Import the Point/BoundingBox types: `import type { Point, BoundingBox } from './types.js';`. Annotate:
- `const QUALITY_POINT_COUNTS: Record<string, number> = { low: 32, medium: 64, high: 128 };`
- `generateShapePoints(type: string, width: number, height: number, quality = 'medium'): Point[]`
- All `generate*Points(...)` return `Point[]`; params `(width: number, height: number, numPoints: number)` (+ `arms = 5, innerRatio = 0.4` for star, `sides = 6` for polygon).
- **Strict fix (`noUnusedParameters`):** in `generateLinePoints`, the `height` param is unused — rename to `_height`.
- `generateDotGridPositions(cols: number, rows: number, spacing: number): Point[]`
- `pointsToFlat(points: Point[]): number[]`
- `flatToPoints(flat: number[]): Point[]`
- `pathLength(points: Point[], closed = true): number`
- `boundingBox(points: Point[]): BoundingBox`
- Internal `segments`/`verts` arrays: annotate as needed, e.g. `const segments: { a: Point; b: Point; len: number }[] = [];` and `const verts: Point[] = [ … ];` so element access is typed.

- [ ] **Step 3: Migrate keyframe.ts**

`git mv … keyframe.js keyframe.ts`. `import type { Keyframe, KeyframeRange } from './types.js';`. Annotate:
- `const PRESET_HANDLES: Record<string, number[]> = { … };`
- `cubicBezierY(x1: number, y1: number, x2: number, y2: number, t: number): number`
- `interpolateKeyframes(keyframes: Keyframe[] | null | undefined, time: number): number | null`
- `getKeyframeRange(keyframes: Keyframe[] | null | undefined): KeyframeRange | null`

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck && npm run test:unit --workspace services/web && npm test --workspace services/web
```
Expected: typecheck PASS, unit 515 pass, engine 114 pass.

```bash
git add services/web/src/engine/easing.ts services/web/src/engine/geometry.ts services/web/src/engine/keyframe.ts
git commit -m "refactor(engine): migrate easing/geometry/keyframe to strict TS (phase 2)"
```

---

## Task 3: Migrate leaf modules — mathExpr, polygonVertices, projection3d

**Files:**
- Rename: `services/web/src/engine/mathExpr.js` → `.ts`
- Rename: `services/web/src/engine/polygonVertices.js` → `.ts`
- Rename: `services/web/src/engine/projection3d.js` → `.ts`

Exercised by `math-expr.test.js`, `polygon-vertices.test.js`, `projection3d.test.js`.

- [ ] **Step 1: Migrate mathExpr.ts**

`git mv … mathExpr.js mathExpr.ts`. Annotate (keep the `eslint-disable no-new-func` comment and SCOPE string verbatim):
- `export function isSafeExpr(expr: unknown): boolean` (body already guards `typeof expr !== 'string'`).
- `export function compileExpr(expr: string, varName: string | string[] = 'x'): ((...args: number[]) => number) | null`
- Inside, annotate `const names: string[] = Array.isArray(varName) ? varName : [varName];` and `const fn = new Function(...) as (...args: number[]) => number;`.

- [ ] **Step 2: Migrate polygonVertices.ts**

`git mv … polygonVertices.js polygonVertices.ts`. `import type { Vertex } from './types.js';`. Annotate:
- `presetVertices(type: string, w: number, h: number): Vertex[]` (each returned tuple is a `Vertex`; annotate the returned arrays as `Vertex[]` or add `as Vertex` to literals so `[number, number]` tuples are inferred, not `number[][]`).
- `verticesBBox(vertices: Vertex[]): { width: number; height: number }`
- `vertexToCanvas([vx, vy]: Vertex, centerX: number, centerY: number, zoom: number): { x: number; y: number }`
- `canvasToVertex(cx: number, cy: number, centerX: number, centerY: number, zoom: number): Vertex`

- [ ] **Step 3: Migrate projection3d.ts**

`git mv … projection3d.js projection3d.ts`. `import type { Point3D, Cam3D } from './types.js';`. Annotate:
- `function basis(phi: number, theta: number): { sp: number; cp: number; st: number; ct: number }`
- `export function project3D(p: Partial<Point3D>, cam: Cam3D | null | undefined, cx: number, cy: number, scale: number): { px: number; py: number }`
- `export function perspectiveScale(p: Partial<Point3D>, cam: Cam3D | null | undefined): number`
- `export function unprojectIso(px: number, py: number, cam: Cam3D | null | undefined, cx: number, cy: number, scale: number, yKnown: number): { x3d: number | null; z3d: number | null }`

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck && npm run test:unit --workspace services/web && npm test --workspace services/web
```
Expected: typecheck PASS, unit 515 pass, engine 114 pass.

```bash
git add services/web/src/engine/mathExpr.ts services/web/src/engine/polygonVertices.ts services/web/src/engine/projection3d.ts
git commit -m "refactor(engine): migrate mathExpr/polygonVertices/projection3d to strict TS (phase 2)"
```

---

## Task 4: Migrate transform + blending

**Files:**
- Rename: `services/web/src/engine/transform.js` → `.ts`
- Rename: `services/web/src/engine/blending.js` → `.ts`

- [ ] **Step 1: Migrate transform.ts**

`git mv … transform.js transform.ts`. Keep `import { pathLength } from './geometry.js';` (note: `pathLength` is imported but only `resamplePoints` uses arc-length logic inline — **verify whether `pathLength` is actually referenced**; if it is NOT used anywhere in the file, remove the import to satisfy `noUnusedLocals`). `import type { Point, RGB, StageObject, MorphState } from './types.js';`. Annotate:
- `resamplePoints(points: Point[], targetCount: number): Point[]`
- `interpolatePoints(a: Point[], b: Point[], t: number): Point[]`
- `parseHex(hex: string): RGB`
- `toHex(rgb: RGB): string`
- `interpolateColor(colorA: string | undefined, colorB: string | undefined, t: number): string`
- `lerp(a: number, b: number, t: number): number`
- `computeMorphState(sourceObj: StageObject, targetObj: StageObject, sourcePoints: Point[], targetPoints: Point[], t: number): MorphState`
- `createMotionGhosts(prevState: MorphState, currentState: MorphState, numGhosts = 3): Array<Record<string, unknown>>` (returns ghost objects; a loose return type is fine).
- Internal `const cumLen: number[] = [0];` and `const result: Point[] = [];` annotations.

- [ ] **Step 2: Migrate blending.ts**

`git mv … blending.js blending.ts`. `import type { EvaluatedClip, StageObject, Overrides, MorphState, FrameState, Clip } from './types.js';`. Annotate:
- `export function blendClipResults(evaluatedClips: EvaluatedClip[], _baseObjects: Record<string, StageObject> | Map<string, StageObject>): { objectOverrides: Record<string, Overrides>; morphShapes: FrameState['morphShapes']; hiddenIds: Set<string> }`
  - **Strict fix (`noUnusedParameters`):** the second param is unused — rename `baseObjects` → `_baseObjects`.
  - Annotate locals: `const objectOverrides: Record<string, Overrides> = {};`, `const morphShapes: FrameState['morphShapes'] = [];`, `const hiddenIds = new Set<string>();`.
- `export function applyOverrides(baseObj: StageObject, overrides?: Overrides): StageObject` (the `{ ...baseObj, … }` literal is assignable to `StageObject`).
- `export function isClipActive(clip: Clip, time: number): boolean`
- `export function getClipProgress(clip: Clip, time: number): number`
- `export function isClipCompleted(clip: Clip, time: number): boolean`

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck && npm run test:unit --workspace services/web && npm test --workspace services/web
```
Expected: typecheck PASS, unit 515 pass, engine 114 pass.

```bash
git add services/web/src/engine/transform.ts services/web/src/engine/blending.ts
git commit -m "refactor(engine): migrate transform/blending to strict TS (phase 2)"
```

---

## Task 5: Migrate playback (the integrator)

**Files:**
- Rename: `services/web/src/engine/playback.js` → `.ts`

This file imports easing, geometry, transform, blending, keyframe (all now `.ts`) and defines `interpolatePath`, the `PlaybackEngine` class, and `getPlaybackEngine`.

- [ ] **Step 1: Migrate playback.ts**

`git mv … playback.js playback.ts`.

Imports — **remove the unused `applyOverrides`** from the blending import (confirmed dead; `noUnusedLocals`):
```ts
import { getEasing, evaluateEasing } from './easing.js';
import { generateShapePoints, pointsToFlat } from './geometry.js';
import { resamplePoints, computeMorphState, lerp, interpolateColor } from './transform.js';
import { blendClipResults, isClipActive, getClipProgress, isClipCompleted } from './blending.js';
import { interpolateKeyframes, getKeyframeRange } from './keyframe.js';
import type {
  Point,
  Point3D,
  StageObject,
  Track,
  Clip,
  CameraClip,
  ClipResult,
  EvaluatedClip,
  FrameState,
  Overrides,
} from './types.js';
```
(Keep `getEasing` if still referenced; if `getEasing` turns out unused after migration, remove it too — check `noUnusedLocals`.)

`interpolatePath` — annotate and cast inside the `is3d` branches (TS cannot narrow array elements from a flag computed off `path[0]`):
```ts
export function interpolatePath(
  path: Array<Point | Point3D> | null | undefined,
  t: number
): Point | Point3D {
```
Inside, where the body accesses `.x3d/.y3d/.z3d`, operate on a locally-cast `const p3 = path as Point3D[];`, and where it accesses `.x/.y`, use `const p2 = path as Point[];`. Bodies/logic otherwise unchanged.

`PlaybackEngine` — declare class fields (strict requires declarations; constructor still assigns them):
```ts
  playing: boolean;
  currentTime: number;
  loop: boolean;
  duration: number;
  private _frameId: number | null;
  private _lastTimestamp: number | null;
  private _onFrame: ((frame: FrameState) => void) | null;
  private _onTimeUpdate: ((time: number) => void) | null;
  private _pointsCache: Map<string, Point[]>;
  private _keyframeDefaults: { mode: string };
  private _camera3dBase?: { phi: number; theta: number; zoom: number };
  private _tracks?: Track[];
  private _objects?: StageObject[];
  private _cameraTrack?: CameraClip[];
  private _objectMap?: Map<string, StageObject>;
```
(`_tick` stays a method — it is rebound via `this._tick = this._tick.bind(this)`; no separate field declaration.)

Method signatures:
- `onFrame(callback: (frame: FrameState) => void): void`
- `onTimeUpdate(callback: (time: number) => void): void`
- `clearCache(): void`
- `setKeyframeDefaults(defaults: { mode: string } | null | undefined): void`
- `setCamera3dBase(base: { phi: number; theta: number; zoom: number } | null | undefined): void`
- `play(tracks: Track[], objects: StageObject[], duration: number, cameraTrack?: CameraClip[]): void`
- `pause(): void`
- `stop(): void`
- `seekTo(time: number, tracks?: Track[], objects?: StageObject[], cameraTrack?: CameraClip[]): void`
- `private _tick(timestamp: number): void`
- `computeFrame(time: number, tracks: Track[], objects: StageObject[], cameraTrack?: CameraClip[]): FrameState`
- `private _applyKeyframeOverrides(frame: FrameState, time: number, objects: StageObject[]): void`
- `private _applyEnterExitAnims(frame: FrameState, time: number, objects: StageObject[]): void`
- `private _evaluateClip(clip: Clip, time: number, objectMap: Map<string, StageObject>): ClipResult | null`
- `private _evaluateTransformClip(clip: Clip, time: number, active: boolean, completed: boolean, objectMap: Map<string, StageObject>): ClipResult | null`
- `private _getResampledPoints(obj: StageObject, quality: string): Point[]`
- `destroy(): void`

**Strict fixes inside methods:**
- Every `new Map(objects.map((o) => [o.id, o]))` (in `play`, `seekTo`, `computeFrame`) → annotate the callback to return a tuple: `objects.map((o): [string, StageObject] => [o.id, o])`.
- In the `count` branch of `_evaluateClip`, `Number.isFinite(clip.from)` does not narrow `clip.from` (typed `number | undefined`), so keep behavior with a cast: `const from = Number.isFinite(clip.from) ? (clip.from as number) : 0;` (same for `to`).
- `evaluatedClips` array → `const evaluatedClips: EvaluatedClip[] = [];`.
- `const overrides: Overrides = {};` in `_evaluateClip`.
- `frame.cameraState` assignments already match `CameraState`; `params` reads (`camClip.params.phi`, `prev?.targetX`, etc.) are now typed via `ClipParams`.
- `morphState: { ...morphState, flatPoints: pointsToFlat(morphState.points) }` — fine against `MorphState`.

`getPlaybackEngine`:
```ts
let _instance: PlaybackEngine | null = null;
export function getPlaybackEngine(): PlaybackEngine {
  if (!_instance) _instance = new PlaybackEngine();
  return _instance;
}
```

Keep the trailing `export default { PlaybackEngine, getPlaybackEngine };`.

- [ ] **Step 2: Verify and commit**

```bash
npm run typecheck && npm run test:unit --workspace services/web && npm test --workspace services/web
```
Expected: typecheck PASS, unit 515 pass, engine 114 pass. Pay special attention to `playback-camera3d.test.js`, `3d-path.test.js`, `path-move.test.js`, `emphasis-playback.test.js`, `camera.test.js` — these exercise playback.

```bash
git add services/web/src/engine/playback.ts
git commit -m "refactor(engine): migrate playback to strict TS (phase 2)"
```

---

## Task 6: Final sweep + production build check

**Files:** none (verification only).

- [ ] **Step 1: Confirm no `.js` engine files remain**

```bash
ls services/web/src/engine/
```
Expected: only `.ts` files (easing, geometry, keyframe, mathExpr, polygonVertices, projection3d, transform, blending, playback, types).

- [ ] **Step 2: Full gate + production build**

```bash
npm run typecheck
npm run test:unit --workspace services/web
npm test --workspace services/web
npm run build --workspace services/web
npm run format:check
```
Expected: typecheck PASS; unit 515 pass; engine 114 pass; Vite production build succeeds (confirms the `<template v-for>`/resolver wiring still works end-to-end with `.ts` engine sources); `format:check` clean. If `format:check` flags the new `.ts` files, run `npm run format` and amend.

- [ ] **Step 3: Commit any formatting fixes** (only if needed)

```bash
git add -A && git commit -m "style(engine): prettier format migrated TS (phase 2)"
```

---

## Self-review notes

- **Spec coverage:** all 9 engine modules migrate (Tasks 2–5); typecheck gate + DOM lib + tsx test runner wired (Task 1); production build verified (Task 6). Matches the Phase-2 line in the migration memory.
- **Strict landmines pre-identified:** unused params (`generateLinePoints._height`, `blendClipResults._baseObjects`), dead imports (`applyOverrides`, and verify `pathLength`/`getEasing`), Map-tuple inference, `Number.isFinite` non-narrowing, array-element narrowing in `interpolatePath`, class-field declarations, DOM lib for rAF.
- **No consumer changes:** specifiers stay `.js`; the resolver plugin + `source` condition (Phase 1) handle remap. Confirmed no default imports of engine modules exist.
- **Behavior preserved:** function bodies unchanged; codegen untouched (engine is preview-only) — the codegen parity suites are unaffected.
