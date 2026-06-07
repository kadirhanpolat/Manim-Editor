# Phase 1 — TS Foundation + Domain Types + @manim/codegen Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the TypeScript foundation (tsconfig topology, strict mode) and migrate the `@manim/codegen` workspace package to strict TypeScript with a shared **wide-interface** domain type model — while preserving byte-identical generated Python and keeping every test green.

**Architecture:** A root `tsconfig.base.json` holds shared strict flags (`allowJs: true` during the broader migration). `@manim/codegen` becomes the first fully-typed package: it gets `src/types.ts` (the shared domain model — `Project`, `SceneObject` wide interface, `Clip`, `Keyframe`, …), its `src/*.js` become `src/*.ts`, and `tsc` builds `dist/*.js` + `*.d.ts`. **Consumption topology:** web + Vitest + the codegen's own tests consume the **source `.ts`** via a `source` export condition wired into Vite/Vitest `resolve.conditions`; the api (plain Node) consumes the built **dist** via the standard `import` condition. The codegen's relative imports already use `.js` extensions (e.g. `from './constants.js'`), which is exactly what TS NodeNext ESM needs — conversion is mechanical.

**Tech Stack:** TypeScript 5 (strict), `tsc` (NodeNext for the package build), Vite/Vitest `resolve.conditions`, npm workspaces.

**Branch:** `phase1-ts-foundation` (already created off `main`).

**Decisions locked in (from brainstorming):**
- Consumption: **web from source, api from dist.**
- Domain model: **wide `SceneObject` interface** (common + all type-specific fields optional), not a discriminated union. Discriminated-union refinement is deferred to Phase 4 (when components need it). Rationale: codegen accesses fields across object types heavily; a wide interface is strict-clean with minimal narrowing.

**Spec:** `docs/superpowers/specs/2026-06-08-tooling-strict-ts-migration-design.md` (Phase 1 section).

---

### Task 1: TS config topology + scripts

**Files:**
- Create: `tsconfig.base.json`
- Create: `packages/manim-codegen/tsconfig.json`
- Modify: `package.json` (root) — add `typecheck` + `build:codegen` scripts

- [ ] **Step 1: Create `tsconfig.base.json` (root)**

Shared strict flags. Does NOT set `module`/`moduleResolution` (each package sets its own to avoid conflicts).

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowJs": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 2: Create `packages/manim-codegen/tsconfig.json`**

NodeNext build config emitting `dist` + declarations.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "allowJs": false
  },
  "include": ["src/**/*.ts"]
}
```

(`allowJs: false` here because after Task 3 the package is all `.ts`; emitting from `.js` is unnecessary.)

- [ ] **Step 3: Add root scripts**

Add to root `package.json` `scripts` (keep existing lint/format scripts):
```json
"typecheck": "tsc -p packages/manim-codegen/tsconfig.json --noEmit",
"build:codegen": "tsc -p packages/manim-codegen/tsconfig.json"
```

- [ ] **Step 4: Verify config parses (no emit yet — files still .js)**

Run:
```bash
npx tsc -p packages/manim-codegen/tsconfig.json --showConfig | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{JSON.parse(s);console.log('tsconfig parses OK')})"
```
Expected: `tsconfig parses OK`. (Do not run a full typecheck yet — `include` matches no `.ts` files, so tsc finds nothing to compile, which is fine.)

- [ ] **Step 5: Commit**

```bash
git add tsconfig.base.json packages/manim-codegen/tsconfig.json package.json
git commit -m "chore(ts): add tsconfig topology + codegen typecheck/build scripts"
```

---

### Task 2: Shared domain type model

**Files:**
- Create: `packages/manim-codegen/src/types.ts`

This is the backbone wide-interface model. It captures the cross-cutting fields used by `index.js`, `helpers.js`, `clips.js`, `keyframes.js`. Object-type-specific fields consumed only by `objects.js`/`objects3d.js` are added to `SceneObject` during Task 3 as the compiler requires (the interface is intentionally open to extension there).

- [ ] **Step 1: Create `packages/manim-codegen/src/types.ts`**

```ts
// Shared domain model for the Manim Motion Editor.
// Wide-interface style: type-specific fields are optional on a single SceneObject.
// (Discriminated-union refinement is deferred to Phase 4.)

export type ResolveAsset = (asset: { src?: string; serverFilename?: string } | string) => string;

export interface Stage {
  width: number;
  height: number;
  backgroundColor?: string;
  [k: string]: unknown;
}

export interface Camera3d {
  phi?: number;
  theta?: number;
  zoom?: number;
  projection?: 'orthographic' | 'perspective';
  focalDistance?: number;
}

export interface GradientEffect {
  colors?: string[];
  angle?: number;
}
export interface DashEffect {
  numDashes?: number;
  ratio?: number;
}
export interface ShadowEffect {
  color?: string;
  opacity?: number;
  dx?: number;
  dy?: number;
  blur?: number;
}

export interface Keyframe {
  time: number;
  value: number;
  easing?: { type: string; handles?: number[] };
}

export type KeyframeMap = Record<string, Keyframe[]>;
export type KeyframeCodegenMode = 'UpdateFromAlphaFunc' | 'animate' | 'ValueTracker';

export interface PathPoint {
  x?: number;
  y?: number;
  x3d?: number;
  y3d?: number;
  z3d?: number;
}

export interface AudioConfig {
  type?: 'file' | 'gtts' | 'coqui';
  src?: string;
  text?: string;
  lang?: string;
  syncMode?: 'auto' | 'manual';
  offset?: number;
  status?: 'pending' | 'ready' | 'error';
  duration?: number;
}

/**
 * Wide scene-object interface. Common fields are explicit; object-type-specific
 * fields are added here during the objects.ts / objects3d.ts conversion (Task 3).
 * The index signature keeps the conversion incremental without losing the typed
 * backbone above.
 */
export interface SceneObject {
  id: string;
  type: string;

  // transform / layout
  x?: number;
  y?: number;
  rotation?: number;
  x3d?: number;
  y3d?: number;
  z3d?: number;

  // style + effects
  fillOpacity?: number;
  strokeOpacity?: number;
  gradient?: GradientEffect;
  dash?: DashEffect;
  shadow?: ShadowEffect;
  cornerRadius?: number;
  fontFamily?: string;

  // enter/exit animation
  enterTime?: number;
  duration?: number;
  enterAnim?: string;
  exitAnim?: string;
  enterAnimDur?: number;
  exitAnimDur?: number;

  // keyframes
  keyframes?: KeyframeMap;
  keyframeCodegen?: Record<string, KeyframeCodegenMode>;
  keyframeMode?: Record<string, string>;

  // object-type-specific fields are added during Task 3
  [k: string]: unknown;
}

export interface Clip {
  id?: string;
  type: string;
  startTime: number;
  duration: number;
  easing?: string;
  parallel?: boolean;
  lag_ratio?: number;

  // targets
  sourceId?: string;
  targetId?: string;
  objectId?: string;

  // transform
  matchTerms?: boolean;

  // generic params bag
  params?: {
    targetX?: number;
    targetY?: number;
    targetScaleX?: number;
    targetOpacity?: number;
    targetRotation?: number;
    zoom?: number;
    phi?: number;
    theta?: number;
    [k: string]: unknown;
  };

  // rotate (3D)
  axis?: 'X' | 'Y' | 'Z';
  angle?: number;

  // path_move
  path?: PathPoint[];

  // count
  from?: number;
  to?: number;

  // audio
  audio?: AudioConfig;
}

export interface Group {
  id: string;
  childIds?: string[];
}

export interface KeyframeDefaults {
  mode?: string;
  codegenMode?: KeyframeCodegenMode;
}

export interface Track {
  id: string;
  name?: string;
  clips: Clip[];
}

export interface Project {
  name: string;
  stage: Stage;
  objects: SceneObject[];
  tracks: Track[];
  cameraTrack?: Clip[];
  groups?: Group[];
  sceneType?: '2d' | '3d';
  cameraType?: 'static' | 'moving';
  camera3d?: Camera3d;
  keyframeDefaults?: KeyframeDefaults;
}

/** A scheduled animation line produced internally by generateScene. */
export interface GeneratedStep {
  time: number;
  order: number;
  code: string;
  dur: number;
  audio?: AudioConfig;
  _clipId?: string;
}

export interface GenerateOptions {
  resolveAsset: ResolveAsset;
}
```

- [ ] **Step 2: Verify it type-checks in isolation**

Run:
```bash
npx tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext packages/manim-codegen/src/types.ts
```
Expected: no output (exit 0) — the types module compiles clean.

- [ ] **Step 3: Commit**

```bash
git add packages/manim-codegen/src/types.ts
git commit -m "feat(ts): add shared domain type model (wide SceneObject interface)"
```

---

### Task 3: Convert @manim/codegen src to TypeScript

**Files (rename `.js` → `.ts`, add types):**
- `packages/manim-codegen/src/constants.js` → `.ts`
- `packages/manim-codegen/src/helpers.js` → `.ts`
- `packages/manim-codegen/src/clips.js` → `.ts`
- `packages/manim-codegen/src/keyframes.js` → `.ts`
- `packages/manim-codegen/src/objects.js` → `.ts`
- `packages/manim-codegen/src/objects3d.js` → `.ts`
- `packages/manim-codegen/src/index.js` → `.ts`
- Modify (extend): `packages/manim-codegen/src/types.ts` (add object-type-specific fields to `SceneObject` as needed)

This is a compiler-driven conversion. Use `git mv` to preserve history. The relative imports already carry `.js` extensions (correct for NodeNext) — keep them as-is.

**Public type contracts to apply (the function signatures the converted files must expose):**
```ts
// constants.ts — typed const exports (EASING_MAP: Record<string,string>, FRAME_*: number, *_TYPES: Set<string>)
// helpers.ts:
export function rf(e: string | undefined): string;
export function rfOpt(e: string | undefined): string;
export function vn(id: string): string;
export function rtOpt(d: number): string;
export function hex(h: unknown): string | null;
export function safeNum(val: unknown, fallback: number): number;
export function safeOpacity(val: unknown): number;
export function safeMathExpr(expr: unknown, fallback?: string): string;
export function safeText(s: unknown): string;
export function safeLatex(s: unknown): string;
export function latexUnit(s: unknown): string;
export function safeMatrixEntry(s: unknown): string;
export function matrixBrackets(b: string | undefined): string;
export function fillOpacityExpr(obj: SceneObject, master: number): string;
export function strokeOpacityArg(obj: SceneObject, master: number): string;
export function gradientLine(n: string, obj: SceneObject): string | null;
export function dashedLines(n: string, obj: SceneObject): string[];
export function roundCornersLine(n: string, obj: SceneObject, sw: number): string | null;
export function shadowLines(n: string, obj: SceneObject, sw: number, sh: number): string[];
export function stageToManim(x: number, y: number, w: number, h: number): { x: number; y: number };
export function pathPointsPy(path: PathPoint[], sw: number, sh: number): string;
export function isSystemFont(fontFamily: string): boolean;
export function fmt3d(n: number): string;
// clips.ts:
export function transformExpr(clip: Clip, sn: string, tn: string, srcObj?: SceneObject, tgtObj?: SceneObject): string;
export function emphasisExpr(c: Clip, sn: string): string | null;
// keyframes.ts:
export function generateKeyframeSteps(project: Project, steps: GeneratedStep[], sw: number, sh: number): void;
// objects.ts:
export function objectCode(o: SceneObject, sw: number, sh: number, opts: GenerateOptions): string[];
// objects3d.ts:
export function objectCode3d(o: SceneObject): string[];
// index.ts:
export function generateScene(project: Project, opts: GenerateOptions): string;
```

- [ ] **Step 1: Rename the 8 files with `git mv`**

```bash
cd packages/manim-codegen/src
for f in constants helpers clips keyframes objects objects3d index; do git mv $f.js $f.ts; done
cd ../../..
```

- [ ] **Step 2: Add types to each file (compiler-driven)**

Work bottom-up: `constants.ts` → `helpers.ts` → `clips.ts` → `keyframes.ts` → `objects3d.ts` → `objects.ts` → `index.ts`. Import domain types from `./types.js` (NodeNext: `.js` extension). Apply the signatures above. For `objects.ts`/`objects3d.ts`, when the compiler reports an object-type-specific field access (e.g. `o.radius`, `o.vertices`, `o.matrixData`), add that field as an optional property on `SceneObject` in `types.ts` (typed as precisely as is obvious from usage; `unknown` + a local narrow is acceptable only if the type isn't obvious). Internal helper functions (`_kfPropSet`, etc.) get parameter types. The `steps`/`oMap` locals in `index.ts` get `GeneratedStep[]` / `Record<string, SceneObject>`.

Do NOT change any runtime logic, string templates, numeric formatting, or control flow. Types only.

- [ ] **Step 3: Typecheck the package until clean**

Run:
```bash
npm run typecheck
```
Expected: exit 0, no errors. Iterate Step 2 until clean.

- [ ] **Step 4: Run the codegen package tests (they import source — prove byte-identical output)**

Run:
```bash
npm test --workspace packages/manim-codegen
```
Expected: all codegen package tests pass (generateScene, camera-only guard, count/path_move indent, counter LaTeX-unit escape — ~6 tests).

- [ ] **Step 5: Build dist + declarations**

Run:
```bash
npm run build:codegen && ls packages/manim-codegen/dist
```
Expected: `dist/` contains `index.js`, `index.d.ts`, and the other modules' `.js` + `.d.ts`. No emit errors.

- [ ] **Step 6: Ignore the build output**

Add to root `.gitignore` (under "Build / cache") if not already covered by `dist/`:
```
packages/*/dist/
```
(The existing `dist/` entry already matches; add this only if `dist/` does not match nested paths — verify with `git status` that `packages/manim-codegen/dist` is untracked/ignored.)

- [ ] **Step 7: Commit**

```bash
git add packages/manim-codegen/src .gitignore
git commit -m "feat(ts): migrate @manim/codegen to strict TypeScript"
```

---

### Task 4: Wire consumption (web → source, api → dist)

**Files:**
- Modify: `packages/manim-codegen/package.json` (exports/types)
- Modify: `services/web/vite.config.js` (resolve.conditions)
- Modify: `services/web/vitest.config.js` (resolve.conditions)
- Modify: `services/web/src/export/manim.js` (deep import → barrel)
- Modify: `services/api/package.json` (prebuild codegen for dev/start)
- Modify: `.github/workflows/ci.yml` (add typecheck; web tests still use source so no build needed there)

- [ ] **Step 1: Update `packages/manim-codegen/package.json` exports**

Replace the `main`/`exports` block with:
```json
"main": "dist/index.js",
"types": "dist/index.d.ts",
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "source": "./src/index.ts",
    "import": "./dist/index.js"
  }
},
"files": ["dist", "src"],
```
Add a `build` script to the package too:
```json
"build": "tsc"
```
(Removes the old `"./src/*"` deep export — web's deep import is migrated to the barrel in Step 4.)

- [ ] **Step 2: Add `source` condition to Vite**

In `services/web/vite.config.js`, add to the `resolve` block (which already has `alias`):
```js
  resolve: {
    conditions: ['source', 'import', 'module', 'browser', 'default'],
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
```

- [ ] **Step 3: Add `source` condition to Vitest**

In `services/web/vitest.config.js`, add a `resolve` block:
```js
export default defineConfig({
  plugins: [vue()],
  resolve: {
    conditions: ['source', 'import', 'module', 'browser', 'default'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'tests/engine.test.mjs'],
  },
});
```

- [ ] **Step 4: Migrate web's deep import to the barrel**

In `services/web/src/export/manim.js`:
- Change line ~18: `} from '@manim/codegen/src/constants.js';` import block → import those same names from `'@manim/codegen'` (the barrel re-exports all constants via `export * from './constants.js'`).
- Change line ~2545: `export { EASING_MAP } from '@manim/codegen/src/constants.js';` → `export { EASING_MAP } from '@manim/codegen';`
- Leave `import { generateScene } from '@manim/codegen';` (line 19) unchanged.
- Merge the two `@manim/codegen` imports into one import statement if both now target the barrel.

- [ ] **Step 5: Make api build codegen before running (dist consumer)**

In `services/api/package.json`, change scripts so dist exists before the api starts:
```json
"dev": "npm run build:codegen --prefix ../.. && node --watch src/index.js",
"start": "npm run build:codegen --prefix ../.. && node src/index.js"
```
(The api still runs as `.js` in Phase 1; it consumes the built `dist` of codegen. The Dockerfile is updated in Phase 5.)

- [ ] **Step 6: Add typecheck gate to CI; verify engine test resolves source**

The engine test `services/web/tests/engine.test.mjs` runs via `node` (not Vite), and may import `@manim/codegen`. Verify how it imports: if it imports the barrel, Node will resolve `import` → dist, so CI must build codegen before the engine test. Inspect `engine.test.mjs` imports:
```bash
grep -n "@manim/codegen" services/web/tests/engine.test.mjs || echo "engine test does not import codegen"
```
- If it does NOT import codegen: no build needed for the engine test.
- If it DOES: add `- run: npm run build:codegen` before the engine-test step in CI.

Then add a typecheck step to `.github/workflows/ci.yml` `node` job, after the format check:
```yaml
      - name: Typecheck (@manim/codegen)
        run: npm run typecheck
```

- [ ] **Step 7: Full verification**

Run each and confirm:
```bash
npm run typecheck                                   # exit 0
npm run build:codegen                               # dist emitted
npm test --workspace packages/manim-codegen         # codegen tests green
npm run test:unit --workspace services/web          # 515 unit (now via source condition)
npm test --workspace services/web                   # 114 engine
node -e "import('@manim/codegen').then(m=>console.log('api/dist barrel:', typeof m.generateScene))"  # 'function' (resolves dist)
npm run format:check                                # clean
```
Expected: all green; the `node -e` prints `api/dist barrel: function` (proves Node resolves the built dist barrel).

- [ ] **Step 8: Commit**

```bash
git add packages/manim-codegen/package.json services/web/vite.config.js services/web/vitest.config.js services/web/src/export/manim.js services/api/package.json .github/workflows/ci.yml
git commit -m "build(ts): wire codegen consumption (web→source, api→dist) + CI typecheck gate"
```

---

### Task 5: Phase 1 verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full local verification**

```bash
npm run typecheck
npm run build:codegen
npm test --workspace packages/manim-codegen
npm run test:unit --workspace services/web
npm test --workspace services/web
npm run format:check
```
Expected: typecheck exit 0; codegen tests green; 515 unit + 114 engine green; format clean.

- [ ] **Step 2: Confirm byte-identical codegen (regression guard)**

The codegen parity tests live in `services/web/tests/components/` (manim-export, effects-codegen, phase26-effects-codegen, codegen-python-validity). They ran in Step 1's `test:unit`. Confirm those specific suites passed (no snapshot/string drift):
```bash
npm run test:unit --workspace services/web 2>&1 | grep -iE "manim-export|effects-codegen|codegen-python-validity|passed|failed" | tail -8
```
Expected: those suites present and passing; overall `515 passed`.

- [ ] **Step 3: Confirm branch commits are scoped**

```bash
git log --oneline main..HEAD
```
Expected: 4 commits (config, types, codegen migration, consumption wiring) — all chore/feat/build, no unrelated logic changes.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin phase1-ts-foundation
```
Expected: branch pushed; CI runs the `node` (now incl. typecheck) + `python` jobs green. (Finishing — merge to main + push — is handled via the finishing-a-development-branch skill after CI is confirmed green.)

---

## Self-Review

**Spec coverage (Phase 1 section):**
- tsconfig topology (base + codegen) → Task 1 ✅
- Shared domain types (`Project`/`SceneObject`/`Clip`/`Keyframe`…) → Task 2 ✅ (wide interface per locked decision)
- `@manim/codegen` `.js`→`.ts` + `tsc` build (dist + d.ts) → Task 3 ✅
- exports updated; web from source / api from dist → Task 4 ✅
- Parity tests byte-identical (regression guard) → Task 3 Step 4 + Task 5 Step 2 ✅

**Placeholder scan:** Config files + types.ts are complete code. The conversion (Task 3) is compiler-driven by design with explicit public signatures + a tsc-clean + green-tests gate — not a vague placeholder. ✅

**Type/name consistency:** `GenerateOptions`/`ResolveAsset`/`GeneratedStep`/`Project`/`SceneObject`/`Clip` used identically in types.ts (Task 2) and the Task 3 signatures. Scripts `typecheck`/`build:codegen` named identically in Tasks 1, 4, 5 and CI. ✅

**Known intentional deviations from spec wording:**
- Wide interface instead of discriminated union (locked decision; rationale above).
- `declarationMap: true` added (better DX; harmless).
- The old `"./src/*"` deep export is removed and web's one deep import migrated to the barrel (Task 4 Step 4) — keeps a single public entry point.
