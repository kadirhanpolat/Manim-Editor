# Type-debt Cleanup Plan

> Sub-project after the strict-TS migration. Pays down the type debt knowingly deferred during it. Each task ends green (lint 0 errors + typecheck + 515 unit + 114 engine + 6 codegen + build) and is committed atomically.

**Goal:** Remove dead code, reconcile the duplicated engine↔codegen type systems, eliminate `as unknown as` bridges + `any`/`storeAny` where they hide real issues, and add per-type interfaces for the complex object types — with zero behavior change (codegen byte-identical).

## Findings (verified)
- **10 orphaned components** (never imported by any mounted component; no tests reference them):
  `components/render/{RenderPanel,VideoPreview}.vue`, legacy `components/inspector/{Inspector,LayoutPanel,StylePanel,TimingPanel,AnimationPanel,ColorInput}.vue`, `components/assets/{AssetBrowser,AssetUploader}.vue`. RenderPanel's `storeAny.triggerRender/pollRenderStatus` and AssetBrowser's `addAsset` call store methods that **don't exist** — masked by `as any` because the components are dead. Real render path is `store.renderOnServer` from `App.vue`.
- **20 `as unknown as`** bridges: ~5 inside the dead components; the rest from the parallel engine `StageObject`/`Track`/`Clip` vs codegen `SceneObject`/`Track`/`Clip` type systems (StageCanvas/Timeline/composables), plus `frameState.cameraState` (missing on store type), `clip.path` (overlays), JSON boundaries in store (legit — keep), and a few Konva-event casts.
- **7 `any`**: 3× `error: any` in `api.ts` (from `response.json()`), `storeAny` (dead RenderPanel), 3× `ref<any>` Konva node refs in `StageCanvas.vue`.

## Task 1 — Delete dead components
`git rm` the 10 files above (and the now-empty `components/render/` dir). Confirm no remaining imports. This removes ~5 bridges + `storeAny` + synthetic `Layout/Style/Timing/AnimDir` types. Gate + commit `refactor(web): remove orphaned legacy components (type-debt)`.

## Task 2 — Reconcile engine ↔ codegen domain types
In `services/web/src/engine/types.ts`, replace the locally-defined `SceneObject`(as `StageObject`)/`Clip`/`Track`/`Point3D`(path)/`Project` shapes with **type-only re-exports/aliases of the `@manim/codegen` domain types**, keeping engine-only types local (`Point`, `Vertex`, `RGB`, `BoundingBox`, `EasingSpec`, `Keyframe`, `KeyframeRange`, `Overrides`, `MorphState`, `ClipResult`, `EvaluatedClip`, `CameraState`, `FrameState`, `Cam3D`, `TimedClip`, `ClipParams`). `StageObject = SceneObject`. Fix the resulting errors in `engine/{playback,blending,transform}.ts` (the engine reads clip.params/path/type — codegen `Clip` has these). Then remove the now-unnecessary `as unknown as StageObject/Track/Clip` bridges in `StageCanvas.vue`, `Timeline.vue`, `useStageInteractions.ts`, `useStageViewport.ts` (after adding `cameraState?` to the store `frameState` type), `overlays.ts` (`clip.path` typed via `PathPoint[]`). Gate (esp. playback/3d-path/camera/snapshot suites) + commit.

## Task 3 — Small type fixes
- `store/project.ts` state: type `frameState` with `cameraState?: CameraState | null` (or a local shape) so `useStageViewport` reads it without a cast.
- `api.ts`: `error: any` → `const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string }` (3 sites).
- `StageCanvas.vue` Konva refs (`ref<any>`) + `useStageInteractions.ts` Konva-event casts: use `vue-konva`/`konva` types where practical; otherwise keep a single typed local interface (no bare `any`) — the eslint `no-explicit-any` is warn-level, but prefer a named type. Keep JSON-boundary `as unknown as StoreProject` (legit). Gate + commit.

## Task 4 — Per-type object interfaces (incremental discriminated-union)
In `@manim/codegen/types.ts`, add interfaces for the complex object types that carry type-specific fields (e.g. `MatrixObject`, `TableObject`, `GraphObject`, `VectorFieldObject`, `AxesObject`, `ParametricObject`, `CounterObject`, `BraceObject`, `AngleObject`, `PolygonFreeObject`, `BezierObject`, `CoordPointObject`, `VectorComponentsObject`, plus 3D `SurfaceObject`/`PrismObject`) each `extends SceneObject` with a literal `type` discriminant + its fields. Export an `AnySceneObject` union. Refactor the matching `object-settings/*.vue` to narrow once (`const o = props.obj as MatrixObject`) instead of scattered `(obj.field as T)` casts. **Do NOT** convert the base `SceneObject` used by store/parser/codegen to the union (keeps the dynamic code + byte-identical codegen stable). If this proves high-churn for low value on a given type, skip that type. Gate + commit.

## Task 5 — Final sweep
Re-count `as unknown as`/`any`; confirm only justified ones remain (JSON boundaries, unavoidable Konva). Full gate + build + format. Merge to main, push, CI, update memory + docs note.
