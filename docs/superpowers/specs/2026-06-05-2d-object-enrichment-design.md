# 2D Object Enrichment — Phase 1 Design

**Date:** 2026-06-05
**Status:** Approved, ready for implementation planning
**Scope:** Static styling enrichment for 2D objects. Phase 1 of 2.
**Base branch:** `feat/2d-object-enrichment`, branched from `feat/coord-unify-phi-projection`
(which carries the v3.5.0 `FRAME_WIDTH` coordinate unification this spec relies on; `main`
does not yet have it).

## Goal

2D objects today are styled with only flat `fill`, `stroke`, `strokeWidth`, and a
single master `opacity`. This phase adds four richer, render-accurate styling
capabilities:

1. **Gradient fill** — multi-stop color gradient
2. **Rounded corners** — corner radius for rectangle/square
3. **Separate fill / stroke opacity** — independent alpha per channel
4. **Dashed stroke** — dashed outlines and lines

Glow and drop shadow (which require faking in Manim via extra mobjects) are
explicitly deferred to **Phase 2** and are out of scope here.

All four features render accurately in Manim CE, with two small, accepted
preview≈render divergences noted below (same convention already used by the 3D
projection preview).

## Non-Goals

- Glow / drop shadow (Phase 2).
- Animating / keyframing the new style channels. Phase 1 is static styling only;
  the existing master `opacity` keyframe + fade pipeline is unchanged.
- Rounded corners on polygon / triangle / star (`.round_corners()`) — deferred to
  Phase 2.
- Gradient on text, latex, line, arrow, dot, axes, number plane/line.

## Data Model

New **optional** object fields. Absent ⇒ today's flat behavior. This keeps every
existing project byte-identical on re-render.

```js
obj.gradient      = { colors: ['#f472b6', '#8b5cf6'], angle: 135 }  // absent = flat fill
obj.cornerRadius  = 24            // px in project coords; 0/absent = sharp. rectangle/square only
obj.fillOpacity   = 0.35          // 0–1, default 1
obj.strokeOpacity = 1             // 0–1, default 1
obj.dash          = { numDashes: 12, ratio: 0.5 }   // absent = solid
```

- `gradient.colors` — 2+ hex stops, applied in order.
- `gradient.angle` — degrees; **preview-only** (see divergences).
- `cornerRadius` — project pixels; converted to Manim units like other lengths.
- `fillOpacity` / `strokeOpacity` — combine multiplicatively with the master
  `opacity`: effective fill alpha = `opacity * fillOpacity`, effective stroke
  alpha = `opacity * strokeOpacity`. Defaults of `1` reproduce current output.
- `dash.numDashes` — integer dash count → Manim `num_dashes`.
- `dash.ratio` — 0–1 → Manim `dashed_ratio`.

### Defaults / seeding

`addObject` does **not** seed these fields. They are created lazily by the
inspector when the user first toggles/edits the corresponding control. Getter
reads everywhere must tolerate absence (`obj.fillOpacity ?? 1`, etc.).

## Feature → Object Matrix

| Feature | Applies to |
|---|---|
| Gradient fill | rectangle, square, circle, ellipse, triangle, star, polygon, heart |
| Rounded corners | rectangle, square |
| Fill / stroke opacity | all shapes with fill + stroke |
| Dashed stroke | rectangle, square, circle, ellipse, triangle, star, polygon, heart, line, arrow |

Controls that do not apply to the selected object's type are hidden in the
inspector (e.g. corner radius only shows for rectangle/square).

## Store Actions (`services/web/src/store/project.js`)

Add actions, each ending with `commitState()` for undo/redo:

| Action | Params | Notes |
|---|---|---|
| `setGradient` | `(objId, gradient \| null)` | `null` removes gradient (deletes field) |
| `setGradientStop` | `(objId, index, color)` | edit one stop |
| `addGradientStop` / `removeGradientStop` | `(objId, ...)` | min 2 stops enforced |
| `setCornerRadius` | `(objId, px)` | `0` deletes field |
| `setFillOpacity` | `(objId, value)` | clamp 0–1 |
| `setStrokeOpacity` | `(objId, value)` | clamp 0–1 |
| `setDash` | `(objId, dash \| null)` | `null` removes dash (deletes field) |

Field deletion (vs. setting to default) keeps re-render output identical for
objects the user toggled on then off.

## Codegen (`services/api/src/compiler/codegen.js` + `services/web/src/export/manim.js`)

**The two generators must stay semantically in sync** (per CLAUDE.md). Both also
parse `.py` back to project JSON, so emitted constructs must round-trip. Length
conversions use the shared `FRAME_WIDTH` / `FRAME_HEIGHT` / `FRAME_X_RADIUS`
constants already present on the base branch.

### Opacity (all shapes)

`set_fill(color=…, opacity = master*fillOpacity)` and
`set_stroke(color=…, width=…, opacity = master*strokeOpacity)`. When both factors
are 1 the numbers are identical to today's output.

### Gradient

After the shape is built and filled:

```python
n.set_color_by_gradient("#f472b6", "#8b5cf6")
```

Single line for round-trip parsing. Sits after `set_fill` (fill opacity still
applies; gradient overrides the color only).

### Rounded corners (rectangle / square)

Replace the constructor (single line, parseable):

```python
n = RoundedRectangle(corner_radius=<r>, width=<w>, height=<h>)   # rectangle
n = RoundedRectangle(corner_radius=<r>, width=<s>, height=<s>)   # square (w==h==side)
```

`<r>` converted from `cornerRadius` px via the shared `FRAME_WIDTH` length scale,
clamped to `< min(w,h)/2`.

### Dashed stroke (the one tricky case)

`DashedVMobject` carries **no fill** in Manim. To preserve fill on filled shapes,
wrap as a `VGroup` and rebind `n` so all downstream animation/keyframe code keeps
working unchanged (Manim handles `VGroup` for move/scale/fade/rotate):

```python
_base_<id> = Rectangle(...)
_base_<id>.set_fill(color=…, opacity=…)
_base_<id>.set_stroke(width=0)
n = VGroup(_base_<id>, DashedVMobject(_base_<id>.copy().set_fill(opacity=0).set_stroke(color=…, width=…), num_dashes=12, dashed_ratio=0.5))
```

For stroke-only objects (line, arrow) emit the simple form:

```python
n = DashedVMobject(n, num_dashes=12, dashed_ratio=0.5)
```

A shared helper builds these so codegen.js / manim.js stay identical. The
multi-line VGroup form requires a matching parser branch (see below).

### Parity convention

codegen.js and manim.js share no import; the coordinate multipliers and emitted
strings are kept identical by convention and guarded by `manim-export.test.js`
invariant tests.

## Parser (`manim.js` `.py` → JSON)

Reverse-parse each new construct back to fields:

- `set_color_by_gradient("a", "b", …)` → `obj.gradient.colors` (angle defaults to
  135; angle is not emitted, so it is not recovered — acceptable, preview-only).
- `RoundedRectangle(corner_radius=r, width=w, height=h)` → rectangle/square +
  `cornerRadius` (reverse the length scale).
- `set_fill(opacity=…)` / `set_stroke(opacity=…)` → `fillOpacity` / `strokeOpacity`
  (divide out master `opacity`).
- `DashedVMobject(..., num_dashes=n, dashed_ratio=r)` and the `VGroup(_base, Dashed…)`
  wrapper → `obj.dash` + restore the base shape fields.

Single-line emission is required for the regex parser (per project memory
*codegen-single-line-constructors-for-roundtrip*); the VGroup dashed-fill form is
the one multi-line exception and gets a dedicated, explicitly-tested parser branch.

## Preview (`services/web/src/components/stage/StageCanvas.vue`)

Konva rendering for each shape gains:

- **Gradient** → `fillLinearGradientStartPoint` / `EndPoint` / `ColorStops`,
  start/end derived from `gradient.angle` over the shape's bounding box (angle is
  honored exactly in preview).
- **Rounded corners** → Konva `cornerRadius` on the Rect node.
- **Fill / stroke opacity** → alpha baked into the Konva `fill` / `stroke` color
  strings (rgba), multiplied by the node's master opacity.
- **Dashed** → Konva `dash: [onLen, offLen]` derived from `numDashes` + `ratio`
  over an estimated perimeter.

The axes-graph security whitelist is unaffected (no new expression input).

## Inspector (`services/web/src/components/inspector/PropertiesPanel.vue`)

New **"Effects"** subsection below the existing Style section, shown for eligible
object types. Controls (each hidden when not applicable to the selected type):

- **Gradient** toggle → when on: ordered color stops (reuse `ColorRow`/`ColorInput`)
  with add (+) / remove, an angle slider, and a live gradient bar.
- **Corner radius** number input (rectangle/square only).
- **Fill opacity** slider (0–100%).
- **Stroke opacity** slider (0–100%).
- **Dashed stroke** toggle → when on: dash density (numDashes) + dash ratio sliders.

Multi-select: when several objects are selected, apply edits to all eligible
selected objects (mirrors existing Style-panel multi-edit behavior).

## Accepted Preview ≈ Render Divergences

Same convention as the existing 3D projection preview (CLAUDE.md "Known
Constraints").

1. **Gradient angle** — Konva honors `gradient.angle` exactly; Manim
   `set_color_by_gradient` orients along the mobject's point order, so render
   direction may differ from the previewed angle. Angle is therefore
   **preview-only** and is not emitted to codegen.
2. **Dashed + fill** — preview draws a single Konva shape with both fill and a
   dashed stroke; render expresses this as a `VGroup(filled_base, dashed_outline)`.
   Visually near-identical; dash phase/registration may differ slightly.

## Testing

- **Store unit tests** (`tests/components/`): each new action mutates the right
  field, clamps ranges, deletes fields on null/zero, and calls `commitState()`.
- **Round-trip invariants** (`tests/components/manim-export.test.js`): generate →
  parse → compare for gradient, rounded corners, fill/stroke opacity, and dashed
  (both VGroup and simple forms). Assert the dashed VGroup form parses back to the
  correct base shape + `dash`.
- **Codegen string assertions**: backward compatibility — an object with none of
  the new fields produces byte-identical output to the current base branch.
- **Parity**: codegen.js and manim.js emit identical multipliers/strings for the
  same input (guarded by existing invariant tests).
- Existing suites (`npm run test:unit`, `npm test`) must stay green.

## Files Touched

| File | Change |
|---|---|
| `services/web/src/store/project.js` | new actions; tolerate absent fields |
| `services/api/src/compiler/codegen.js` | emit gradient / RoundedRectangle / opacity / dashed |
| `services/web/src/export/manim.js` | same emission + reverse parser |
| `services/web/src/components/stage/StageCanvas.vue` | Konva gradient / cornerRadius / alpha / dash |
| `services/web/src/components/inspector/PropertiesPanel.vue` | new Effects subsection |
| `services/web/tests/components/*.test.js` | store + round-trip + codegen tests |

## Out of Scope → Phase 2

- Glow (layered luminous copies) and drop shadow (offset dark copy) — both faked
  via extra mobjects; preview≈render.
- `.round_corners()` for polygon / triangle / star.
- Keyframing the new style channels.
