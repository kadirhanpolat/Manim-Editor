# Data & Coordinate Objects — Phase 4 Design

**Date:** 2026-06-06
**Status:** Approved, ready for implementation planning
**Scope:** Five new object types — `table`, `complex_plane`, `polar_plane`, `graph`, `vector_field`.
**Base branch:** branch off `main` (the v3.5.0 `FRAME_WIDTH` coordinate unification and all
prior phases are merged into `main`).

## Goal

Extend the visual object library toward data and coordinate-system content for
math/education videos. Five new Manim object types, each following the established
project pattern: byte-identical `codegen.js` / `manim.js` emission, Konva canvas
preview, `.py` round-trip, store actions with `commitState()`, an inspector section,
and `manim-export.test.js` parity invariants. All new fields are optional / new
types, so every existing project re-renders byte-identically.

## Non-Goals

- Auto-layout for `graph` (Manim spring/tree layouts) — vertices are manually
  positioned (WYSIWYG). Deferred.
- Flat-color vector fields — v1 uses Manim's default magnitude coloring.
- `Tree`, `IntegerTable`/`DecimalTable` specializations — `table` with `mathMode`
  covers `Table`/`MathTable`; numeric tables are just text cells.
- `StreamLines` — only `ArrowVectorField` in v1.
- Animating/keyframing the new objects' internal data (cells, vertices, field
  expression). They animate as whole mobjects via existing clips only.

## Shared Conventions

- **Parity:** every emitted Python string is identical across `codegen.js` and
  `manim.js`; guarded by `manim-export.test.js`. New invariant tests per object.
- **Single-line constructors** for round-trip (project memory
  *codegen-single-line-constructors-for-roundtrip*) — all five emit single-line.
- **Post-construction block:** the generic tail (`gradientLine` gated by
  `GRADIENT_TYPES`, `dashedLines`, `shadowLines`, then `move_to([...])`) already
  runs for every object. None of the five are added to `GRADIENT_TYPES` / `DASH_TYPES`.
  Each is positioned by the existing generic `move_to`.
- **Security whitelist:** `vector_field` expressions pass `safeMathExpr` (the same
  whitelist kept in sync across `codegen.js`, `manim.js`, `StageCanvas.vue`).
- **Sequencing (for the plan):** low-risk first — `table` → `complex_plane` →
  `polar_plane` → `graph` → `vector_field`. One spec, one phase.

## 1. `table` (Table / MathTable)

### Data model
```js
{ type: 'table',
  cellData: [['1','2'],['3','4']],   // 2D string array — same model as matrix.matrixData
  mathMode: false,                    // false → Table (Text cells); true → MathTable (MathTex cells)
  rowLabels: [],                      // optional string[]; [] = no row labels
  colLabels: [],                      // optional string[]; [] = no col labels
  fill, stroke, ... }                 // standard object fields
```
Rows/cols are **derived from `cellData`, never stored** (mirrors `matrix`).

### Reuse of Matrix infrastructure
- Cell sanitization reuses `safeMatrixEntry` (strips backslashes/quotes/newlines,
  caps length, falls back to `'0'`).
- Store actions mirror the matrix set: `setTableCell`, `addTableRow`/`removeTableRow`,
  `addTableColumn`/`removeTableColumn` (guard at 1×1), plus `setTableMathMode`,
  `setTableRowLabels`/`setTableColLabels`.
- Inspector grid editor is the matrix grid editor generalized (per-cell inputs +
  add/remove row/col), with extra rows for label arrays and a mathMode toggle.
- Composite Konva preview reuses the matrix cell/bracket rendering approach, adding
  a left label column and top label row.

### Codegen (single-line)
```python
# text cells, no labels:
n = Table([["1", "2"], ["3", "4"]])
# math cells + labels:
n = MathTable([["1", "2"], ["3", "4"]], row_labels=[MathTex("a"), MathTex("b")], col_labels=[MathTex("x"), MathTex("y")])
n.set_color(<fill>)   # when hasFill
```
- `mathMode` selects `MathTable` vs `Table`; label wrappers are `MathTex(...)` in
  math mode, `Text(...)` otherwise.
- `row_labels=` / `col_labels=` emitted only when the corresponding array is non-empty.
- All cell + label strings pass `safeMatrixEntry`.

### Parser
Match `Table(` / `MathTable(` with the nested `[[...]]` array and optional
`row_labels=[...]` / `col_labels=[...]`; reconstruct `cellData`, `mathMode`,
`rowLabels`, `colLabels`. Single-line, regex-parseable.

### Accepted divergence
Label cell alignment / column sizing in the Konva preview is approximate
(preview-only); the render uses Manim's own table layout.

## 2. `complex_plane` (ComplexPlane)

### Data model
`{ type:'complex_plane', xRange:[-3,3,1], yRange:[-2,2,1] }` (+ standard fields).
Mirrors `numberplane`.

### Codegen (single-line)
```python
n = ComplexPlane(x_range=[-3, 3, 1], y_range=[-2, 2, 1], x_length=<w>, y_length=<h>)
```
`x_length`/`y_length` from `width`/`height` via `FRAME_WIDTH`/`FRAME_HEIGHT` (exactly
like the `numberplane` case).

### Preview / inspector / parser
Reuse the `numberplane` Konva grid preview (real/imaginary axis labels are
preview-only). Inspector reuses the numberplane range editor. Parser mirrors the
`numberplane` parser with the `ComplexPlane` constructor name. Smallest object.

## 3. `polar_plane` (PolarPlane)

### Data model
`{ type:'polar_plane', radiusMax:4, radiusStep:1, azimuthUnits:12 }` (+ standard fields).

### Codegen (single-line)
```python
n = PolarPlane(radius_max=4, radius_step=1, azimuth_units=12, size=<min(w,h)>)
```
`size` derived from the smaller of `width`/`height` via `FRAME_WIDTH`.

### Preview / inspector / parser
Konva preview: concentric circles (`radiusMax`/`radiusStep`) + `azimuthUnits` radial
spokes. Inspector: radiusMax / radiusStep / azimuthUnits number inputs. Parser matches
the `PolarPlane(...)` constructor.

## 4. `graph` (Graph / DiGraph — vertices + edges)

### Data model
```js
{ type: 'graph',
  vertices: ['A','B','C'],              // string ids (also used as labels)
  edges: [['A','B'], ['B','C']],        // [from, to] pairs referencing vertex ids
  positions: { A:[x,y], B:[x,y], C:[x,y] },  // object-relative px (polygon_free scale)
  directed: false,                       // true → DiGraph (arrow edges)
  showLabels: true,
  fill, stroke, ... }
```

### Codegen (single-line)
```python
n = Graph(["A", "B", "C"], [("A", "B"), ("B", "C")], layout={"A": [x, y, 0], "B": [x, y, 0], "C": [x, y, 0]}, labels=True)
# directed:
n = DiGraph(["A", "B", "C"], [("A", "B"), ("B", "C")], layout={...}, labels=True)
```
- `positions` px → Manim units via the `polygon_free` object-relative scale
  (`FRAME_WIDTH`-based), so the layout matches the canvas; the whole graph is then
  positioned by the generic `move_to`.
- `labels=True` only when `showLabels`. Vertex ids sanitized (`safeMatrixEntry`-style:
  identifier-safe, no quotes/backslashes).
- `directed` swaps `Graph` → `DiGraph`.

### Editor
- **Canvas:** draggable vertex handles — generalize the existing `polygonHandles`
  computed (already shared by `polygon_free` + `relational` objects) with a new
  `kind: 'graph'` branch; dragging updates `positions[id]`. Edges drawn as
  lines/arrows between vertex positions.
- **Inspector:** vertex list (add/remove, rename), edge list (from/to dropdowns over
  current vertex ids, add/remove), `directed` + `showLabels` toggles.
- **Preview:** composite Konva group — a circle + id label per vertex, a line (or
  arrowed line if `directed`) per edge — with a listening hit region for selection,
  mirroring the `matrix`/relational composite-preview pattern.

### Store actions
`addGraphVertex`, `removeGraphVertex` (also drops incident edges + its position),
`renameGraphVertex` (updates edges + positions + label), `addGraphEdge`,
`removeGraphEdge`, `setGraphVertexPosition` (drag), `setGraphDirected`,
`setGraphShowLabels`. Each ends with `commitState()` (drag commits once on mouseup,
per the keyframe-lane precedent).

### Parser
Match `Graph(` / `DiGraph(` with the vertex array, edge tuple-list, `layout={...}`,
and optional `labels=True`; reconstruct vertices/edges/positions/directed/showLabels.
Single-line.

### Accepted divergence
Edge arrow styling and vertex circle radius in the preview are approximations of
Manim's defaults.

## 5. `vector_field` (ArrowVectorField)

### Data model
```js
{ type: 'vector_field',
  fx: 'y',          // x-component expression in x, y (safeMathExpr whitelist)
  fy: '-x',         // y-component expression
  xRange: [-3,3,1], yRange: [-2,2,1],
  fill, stroke, ... }
```

### Codegen (single-line)
The lambda receives a position vector; a nested binding lambda exposes `x`/`y` to the
whitelisted expressions (the brackets `p[0]`/`p[1]` are fixed template text, never user
input, so the whitelist — which forbids `[` and `_` — is not violated by the user
expressions):
```python
n = ArrowVectorField(lambda p: (lambda x, y: np.array([<fx>, <fy>, 0]))(p[0], p[1]), x_range=[-3, 3, 1], y_range=[-2, 2, 1])
```
`<fx>`/`<fy>` pass `safeMathExpr`. Uses Manim's default magnitude coloring (no extra
color args in v1).

### Preview
Sparse sampled arrows on a coordinate grid (e.g. 8×8) using `engine/mathExpr.js`
`compileExpr` (the `parametric` preview precedent). Preview is sparse; render is full
density — an accepted divergence.

### Inspector
`fx` / `fy` text inputs (whitelist-validated, same UX as `parametric` x(t)/y(t)) +
x/y range editors.

### Parser
Match the `ArrowVectorField(lambda p: (lambda x, y: np.array([<fx>, <fy>, 0]))(p[0], p[1]), x_range=[...], y_range=[...])`
form; extract `fx`/`fy` and the ranges. Single-line.

### Security
`fx`/`fy` go through `safeMathExpr` in **all three** of `codegen.js`, `manim.js`,
`StageCanvas.vue` — keep the whitelist identical (same rule as graph expressions /
parametric).

## Store / Defaults

`SHAPE_DEFAULTS` + `SHAPE_COLORS` + `addObject` seeding gain the five types with the
field defaults above. `nameMap`: `table:'Table'`, `complex_plane:'ComplexPlane'`,
`polar_plane:'PolarPlane'`, `graph:'Graph'`, `vector_field:'VectorField'`. None added
to `GRADIENT_TYPES` / `DASH_TYPES`.

## Files Touched

| File | Change |
|---|---|
| `services/web/src/store/project.js` | 5 types in defaults/seeding; table/graph/plane/field store actions |
| `services/api/src/compiler/codegen.js` | 5 object cases; reuse `safeMatrixEntry`/`safeMathExpr`/`FRAME_WIDTH` |
| `services/web/src/export/manim.js` | same 5 cases (byte-identical) + 5 reverse parsers |
| `services/web/src/components/stage/StageCanvas.vue` | 5 previews; generalize `polygonHandles` for graph drag; `safeMathExpr` for field |
| `services/web/src/components/inspector/PropertiesPanel.vue` | 5 inspector sections (table grid+labels, plane ranges, graph vertex/edge editor, field exprs) |
| `services/web/src/components/stage/sidebar` (shape palette) | add the 5 to the object-add UI |
| `services/web/tests/components/*.test.js` | store + codegen + round-trip + parity tests per object |

## Testing

- **Store unit tests:** each new action mutates the right field, guards edges
  (table 1×1, graph vertex/edge integrity), and calls `commitState()`.
- **Round-trip invariants** (`manim-export.test.js` + a new
  `phase4-data-objects.test.js`): generate → parse → compare for all five
  (table text+math+labels, both planes, graph directed+undirected+labels,
  vector field). Assert exact emitted strings (byte-stability).
- **Backward compatibility:** an object set without the new types is byte-identical
  to the base branch.
- **Parity:** codegen.js and manim.js emit identical strings for the same input.
- Existing suites (`npm run test:unit`, `npm test`) stay green; `npm run build`
  succeeds (watch the Vue 3 `<template v-for>` key rule in the new inspector/preview
  loops).

## Decisions (resolved during brainstorming)

1. **`table`** — single `table` type with `mathMode` flag (not separate types);
   reuses Matrix's grid editor + 2D-array model.
2. **`graph`** — manual vertex positioning (draggable handles), WYSIWYG; `directed`
   included in v1.
3. **`vector_field`** — default Manim magnitude coloring; flat color deferred.
4. **Scope** — all five in one phase, sequenced low-risk → high-risk in the plan.
