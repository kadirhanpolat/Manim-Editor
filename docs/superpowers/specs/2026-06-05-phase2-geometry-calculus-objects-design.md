# Phase 2 — Geometry, Calculus & Data Objects Design

**Date:** 2026-06-05
**Status:** Approved, ready for implementation planning
**Scope:** 7 new standalone object types + 2 axes-graph extensions, in a single spec.
**Base branch:** `feat/phase2-geometry-objects`, branched from `main` (which now carries the
v3.5.0 `FRAME_WIDTH` coordinate unification, 3D preview, and v3.7.0 2D object effects).

## Goal

Expand object variety for math/education videos with geometry primitives, calculus
constructs, and a data structure. All new units follow the existing
constructor → `set_fill`/`set_stroke` → round-trip pattern and the codegen.js ↔
manim.js byte-identical parity convention.

Two architectural categories:

- **A) Standalone objects (7)** — new `case` arms in `objectCode` (codegen.js +
  manim.js), Konva preview in `StageCanvas.vue`, toolbar/sidebar buttons, inspector
  panels, and a round-trip parser branch. Like circle/star/etc.
- **B) Axes graph extensions (2)** — `area` and `riemann` are **optional fields on
  each graph** in an `axes` object's `graphs[]` array, not new top-level types. In
  Manim both require a parent `axes` + a plotted graph, so they cannot be standalone.

## Non-Goals

- Dynamic/updater objects (live DecimalNumber counters, moving tangent, live
  coordinate readouts), relational objects (Brace, Angle, vector components),
  TransformMatchingTex substring animations, Ray, standalone Bezier object — all
  deferred (see the prior triage; out of scope here).
- Keyframing the new type-specific fields (radius/angles/expressions/matrix data).
  Standard keyframeable props (x, y, opacity, rotation, scale) work as today.
- 3D Surface/Prism — separate future effort.

## A) Standalone Object Types

Each new object carries the standard base fields created by `addObject`
(`id, type, name, x, y, width, height, rotation, fill, stroke, strokeWidth,
opacity, zOrder, visible, enterTime, duration, enterAnim, exitAnim,
enterAnimDur, exitAnimDur`) plus the type-specific fields below. `SHAPE_DEFAULTS`,
`SHAPE_COLORS`, and the `nameMap` in `store/project.js` gain an entry per type;
the toolbar/sidebar gain a button per type.

Angles are stored in **degrees** and emitted as `<deg> * DEGREES`. Radius-type
lengths convert with the same scale as `circle` (via `FRAME_WIDTH`).

### `annulus`
- Fields: `innerRadius`, `outerRadius` (project px). Default `outerRadius = width/2`,
  `innerRadius = 0.5 * outerRadius`.
- Codegen: `<n> = Annulus(inner_radius=<ri>, outer_radius=<ro>)` then standard
  `set_fill`/`set_stroke`.
- Konva: `Ring({ innerRadius, outerRadius })`.
- Fillable + strokable.

### `arc`
- Fields: `radius`, `startAngle` (deg), `sweepAngle` (deg). Defaults `radius=width/2`,
  `startAngle=0`, `sweepAngle=180`.
- Codegen: `<n> = Arc(radius=<r>, start_angle=<a0> * DEGREES, angle=<sweep> * DEGREES)`
  then `set_stroke` (open curve; no fill by default).
- Konva: custom `Shape` `sceneFunc` calling `context.arc(...)` (open stroked arc).

### `sector`
- Fields: `radius`, `startAngle` (deg), `sweepAngle` (deg). Defaults `radius=width/2`,
  `startAngle=0`, `sweepAngle=90`.
- Codegen: `<n> = Sector(radius=<r>, start_angle=<a0> * DEGREES, angle=<sweep> * DEGREES)`
  then standard `set_fill`/`set_stroke`.
- Konva: `Wedge({ radius, angle, rotation })` (pie slice).
- Fillable + strokable.

### `polygon_free`
- Fields: `vertices: [[x, y], ...]` (object-relative px, centered on the object's
  x/y). Default = a trapezoid (4 vertices). Inspector presets seed the vertices:
  **Trapezoid**, **Parallelogram**, **Free**.
- Codegen: `<n> = Polygon(*[np.array([<x>, <y>, 0]) for ...])` emitted **single-line**
  with literal coordinate arrays (`Polygon([x0, y0, 0], [x1, y1, 0], ...)`), then
  standard `set_fill`/`set_stroke`.
- Konva: `Line({ points, closed: true })` with draggable vertex handles (reuse the
  path-drawing interaction style; handles edit `vertices`).
- Fillable + strokable.
- This is the path to parallelogram/trapezoid (presets) and any custom quadrilateral+.

### `double_arrow`
- Fields: same as `arrow` (`width` = length, color via `fill`, `strokeWidth`).
- Codegen: `<n> = DoubleArrow(start=LEFT * <half>, end=RIGHT * <half>, color=<fill>,
  buff=0, stroke_width=<sw>)`.
- Konva: `Arrow({ pointerAtBeginning: true, pointerAtEnding: true })`.

### `parametric`
- Fields: `xExpr`, `yExpr` (t-based expression strings), `tMin`, `tMax`,
  `strokeWidth`. Defaults `xExpr="cos(t)"`, `yExpr="sin(t)"`, `tMin=0`, `tMax=6.283`.
- Codegen: `<n> = ParametricFunction(lambda t: np.array([<safeExpr(xExpr)>,
  <safeExpr(yExpr)>, 0]), t_range=[<tMin>, <tMax>], color=<stroke|fill>,
  stroke_width=<sw>)` — single line (heart already uses this shape).
- Konva: sample `t` over `[tMin, tMax]`, evaluate `x(t)`/`y(t)` via the whitelisted
  `new Function` (same mechanism as graph curves), build a polyline.
- Security: `xExpr`/`yExpr` pass the existing `safeMathExpr` whitelist; a t-based
  safe default replaces invalid input (`"t"` / `"0"`). Whitelist kept in sync in
  codegen.js, manim.js, and StageCanvas.vue (3 places, like `graph.expression`).

### `matrix`
- Fields: `data: [[string, ...], ...]` (entries), `rows`, `cols`, `bracket` (`"["`
  default). Default = 2×2 identity-ish `[["1","0"],["0","1"]]`.
- Codegen: `<n> = Matrix([["a", "b"], ["c", "d"]])` single-line; entry color via
  `<n>.set_color(<fill>)`. Entries sanitized (strip quotes/backslashes, like
  `safeText`).
- Konva: grid of `Text` nodes laid out by rows/cols, plus drawn bracket lines
  (left/right) — a composite config with a listening hit region (per the
  composite-object selectability fix convention).
- Inspector: grid editor — per-cell text inputs, add/remove row and column, bracket
  selector. No fill/stroke geometry; `fill` = entry color.
- Heaviest unit (grid editor + parser); the plan splits it into more tasks.

### Phase 1 effect eligibility (free integration)

Add the new **closed fillable** shapes (`annulus`, `sector`, `polygon_free`) to both
`GRADIENT_TYPES` and `DASH_TYPES`; add the **open-stroke** shapes (`arc`,
`parametric`, `double_arrow`) to `DASH_TYPES` only. These sets live in codegen.js,
manim.js, StageCanvas.vue, and PropertiesPanel.vue and must stay consistent. Because
the post-switch gradient/dashed append and Konva `applyEffects()` already exist,
those shapes inherit gradient / dashed / per-channel opacity at near-zero cost.
`matrix` is in none of the sets.

## B) Axes Graph Extensions

Each item in an `axes` object's `graphs[]` gains two optional fields:

```js
graph.area    = { enabled: true, xMin, xMax, opacity, color }
graph.riemann = { enabled: true, xMin, xMax, dx, type, color }  // type: 'left'|'right'|'midpoint'
```

### Codegen
Emitted **after** the graph's `plot(...)` line and added to the scene the same way
graphs are (`<axes>.add(<var>)`, mirroring codegen.js:667-673):

- Area: `<g>_area = <axes>.get_area(<g>, x_range=[<xMin>, <xMax>], color=<color>,
  opacity=<opacity>)` → `<axes>.add(<g>_area)`.
- Riemann: `<g>_riemann = <axes>.get_riemann_rectangles(<g>, x_range=[<xMin>, <xMax>],
  dx=<dx>, input_sample_type="<type>", color=<color>)` → `<axes>.add(<g>_riemann)`.

`xMin`/`xMax` default to the graph's x-range; `dx` defaults to a sane fraction of the
range; `type` defaults to `"left"`.

### Preview (full)
`StageCanvas.vue` `axesGraphCurves` already samples each graph curve in canvas space.
Extend it:
- **Area**: a closed filled polygon between the sampled curve and the x-axis over
  `[xMin, xMax]` (Konva `Line` closed, semi-transparent).
- **Riemann**: N rectangles from the x-axis to the curve at sample points spaced by
  `dx`, left/right/midpoint sampling per `type` (Konva `Rect`s).

### Inspector
The existing per-graph editor in `PropertiesPanel.vue` (axes graphs list) gains an
**Area** toggle (+ x-range, opacity, color) and a **Riemann** toggle (+ x-range, dx,
type, color) per graph.

### Parser (round-trip)
The manim.js parser reconstructs `graph.area` / `graph.riemann` from the
`get_area(...)` / `get_riemann_rectangles(...)` lines, associating them with the
parent graph variable.

## Security

- `parametric.xExpr` / `parametric.yExpr` and `graph.area` / `graph.riemann` rely on
  the graph the user already controls — all expression input passes `safeMathExpr`
  (digits/letters/operators/parens only; rejects `import|eval|exec|open|__`). The
  three copies (codegen.js, manim.js, StageCanvas.vue) stay in sync, per the existing
  CLAUDE.md Security note.
- `matrix.data` entries are sanitized to strip quotes and backslashes before emission
  (no expression evaluation — they are display strings passed to Manim `Matrix`).

## Cross-Cutting

| Concern | Change |
|---|---|
| Store | `SHAPE_DEFAULTS`, `SHAPE_COLORS`, `nameMap`, type-specific seed fields in `addObject` for 7 new types; graph `area`/`riemann` editing actions |
| Toolbar / sidebar | 7 new shape buttons |
| codegen.js | 7 new `case` arms + area/riemann emission; add new types to `GRADIENT_TYPES`/`DASH_TYPES` |
| manim.js | mirror generator (byte-identical) + parser branches for all 7 + area/riemann |
| StageCanvas.vue | Konva preview for 7 types + area/riemann; whitelist sync for parametric; composite hit regions for matrix |
| PropertiesPanel.vue | per-type inspector panels + area/riemann controls in the graph editor; type-set membership for effect gating |
| Tests | store + codegen-string + round-trip per type; parametric/matrix security tests; area/riemann codegen + round-trip |

## Round-Trip / Parity Conventions

- All new constructors emitted **single-line** so the regex parser round-trips them
  (per the `codegen-single-line-constructors-for-roundtrip` project memory).
- codegen.js and manim.js share no import; emitted multipliers/strings kept identical
  by convention, guarded by `manim-export.test.js` invariants.

## Known Constraints / Risks

- `polygon_free` (vertex-handle editing) and `matrix` (grid editor + parser) are the
  heaviest units; the implementation plan splits each into multiple tasks.
- The `matrix` parser round-trips only single-line `Matrix([[...]])` with simple
  numeric/string entries; nested-LaTeX edge cases are limited.
- `arc` / `parametric` are open curves — fillable in Manim but default to stroke;
  gradient applies only to the closed shapes.
- This is a large single spec by user choice; the plan will have many tasks. Each
  object type is largely independent, which suits subagent-driven, one-type-per-task
  execution.

## Files Touched

| File | Change |
|---|---|
| `services/web/src/store/project.js` | defaults, nameMap, seed fields, graph area/riemann actions |
| `services/api/src/compiler/codegen.js` | 7 case arms, area/riemann, type-set additions |
| `services/web/src/export/manim.js` | mirror generator + parser for all new units |
| `services/web/src/components/stage/StageCanvas.vue` | Konva preview for all new units + whitelist sync |
| `services/web/src/components/inspector/PropertiesPanel.vue` | per-type panels + area/riemann graph controls |
| `services/web/src/components/toolbar/Toolbar.vue` and/or sidebar | 7 new buttons |
| `services/web/tests/components/*.test.js` | store + codegen + round-trip + security tests |
