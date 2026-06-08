# Phase 3 — store + api-client + .py parser → strict TypeScript

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. These are compiler-driven migrations (rename → annotate → fix strict errors against `npm run typecheck`), so tasks specify strategy + type sources + gates rather than full line-by-line code.

**Goal:** Migrate `services/web/src/{api.js, export/manim.js, store/project.js}` to strict `.ts`, zero behavior change, all gates green.

**Architecture:** Reuse the `@manim/codegen` domain model (`Project`, `SceneObject` [has `[k:string]:unknown`], `Clip`, `Track`, `Group`, `Stage`, `Camera3d`, `AudioConfig`, `Keyframe`, …) as the shared types. Keep `.js` import specifiers in `.ts` source (resolver/bundler remap). `checkJs:false` means only the migrated `.ts` files get type-checked, so consumers (`*.vue`, configs) are unaffected.

## Shared conventions (every task)
- `git mv file.js file.ts`; preserve behavior; keep `.js` import specifiers.
- Prefer reusing `@manim/codegen` types via `import type { … } from '@manim/codegen'`. Where a local shape diverges, define a focused interface (e.g. a store `State`) rather than `any`.
- Dynamic code (parser building objects, store mutating `obj[prop]`): use wide types (`SceneObject` index signature, `Partial<…>`) and **justified `as` casts**; NO `@ts-ignore`, avoid bare `any` where a real type fits (DOM `response.json()` returning `any` is fine).
- After each task: `npm run typecheck` (0 errors) + `npm run test:unit --workspace services/web` (515) + `npm test --workspace services/web` (114). Then commit.

## Task 1 — `api.js` → `api.ts`
Small (216 lines). Type the `request(endpoint, options)` wrapper, the exported groups (`projects`, `assets`, `jobs`, `renders`, `audio`), `checkHealth`, and the two WS helpers (`connectJobWebSocket`, `connectAudioWebSocket`). `request` returns `Promise<unknown>` (or `any` from `response.json()`); WS callbacks typed `(msg: …) => void`. Keep `export default`. Gate + commit `refactor(web): migrate api client to strict TS (phase 3)`.

## Task 2 — `export/manim.js` → `manim.ts`
~2546 lines: thin `generateManimScript`/`downloadManimScript`/`generateCode` wrappers over `@manim/codegen` `generateScene`, plus the web-only `parseManimScript` regex parser. Type the wrappers with `Project`. The parser builds project/objects dynamically — type accumulators as `Partial<SceneObject>` / `Record<string, …>` / the domain types, with `as` casts where regex-derived strings feed typed fields. `manimToStage`/`unescapeUnit` helpers typed. Gate (esp. `manim-export.test.js`, `*-codegen.test.js`, round-trip suites) + commit `refactor(web): migrate manim generator+parser to strict TS (phase 3)`.

## Task 3 — `store/project.js` → `project.ts`
~2124 lines: Pinia Options store. Define a `State` interface (project + UI/selection/playback/render/history fields) and type `state(): State`. Reuse `@manim/codegen` types for `project` (extend `Project` locally if the store carries extra UI fields like `editorMode`/`codeSource`/`assets`/`sceneDuration`/`selectedObjectIds`-adjacent stage fields — define a `StoreProject extends Project` or a dedicated interface). Getters: annotate return types. Actions: `this` is inferred by Pinia; fix arithmetic-on-optional with guards/casts; objects are wide (`SceneObject`). Keep exports (`uid`, `ENTER_ANIMS`, `EXIT_ANIMS`, `SHAPE_DEFAULTS`, `SHAPE_COLORS`, `pinia`, `useProjectStore` default). Gate (esp. `store.test.js`, `keyframe-store.test.js`, `3d-store.test.js`, `phase2-*-store.test.js`) + commit `refactor(web): migrate Pinia store to strict TS (phase 3)`.

## Task 4 — Final sweep
No `.js` left among the three. Full gate + `npm run build --workspace services/web` + `npm run format` (commit if changed). Merge to `main` (ff), push, verify CI green, update `strict-ts-migration-initiative` memory.
