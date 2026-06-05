# Emphasis Animations (Indicate / Flash / Wiggle / Circumscribe / FocusOn) Design

**Date:** 2026-06-05
**Status:** Approved, ready for implementation planning
**Scope:** Five new transient "emphasis" clip types added to the existing clip
pipeline (store → codegen → playback → inspector → round-trip parser), with the
full Manim parameter set per type and mixed-fidelity canvas preview.
**Base branch:** `feat/emphasis-animations`, branched from `main`.

## Goal

Extend the animation library (currently `transform, move, scale, fade, rotate,
path_move, camera_move`) with Manim's five common emphasis animations. Unlike the
existing clips — which lerp an object to a **persistent** target state — emphasis
animations are **transient** (there-and-back): they play and return the object to
its original state. They integrate into the same clip infrastructure and follow
the established conventions: byte-identical `codegen.js` ↔ `manim.js`, override-based
canvas preview, per-type inspector param sections, and full `.py` round-trip.

## Non-Goals

- Keyframing emphasis params.
- Dimming all other objects for `FocusOn` preview (render does it; preview only
  pulses the focused object — YAGNI).
- A faithful particle/ray preview for `Flash` (approximated as a color pulse).
- New store actions — `createAnimation(type, params)` is already generic.

## Architecture Overview

The clip pipeline has five touch points; emphasis clips extend each:

1. **Store** (`services/web/src/store/project.js`): `createAnimation(type, params)`
   is generic and unchanged. Only the inspector's `anim(type)` default-param helper
   gains the new types.
2. **Codegen** (`services/api/src/compiler/codegen.js` + `services/web/src/export/manim.js`):
   byte-identical per-type emission. codegen.js has three duplicated clip switches
   (single ~939, degenerate-single ~1000, parallel-group expr ~1066); manim.js has
   two helpers `clipCode(c)` (~915) and `clipExpr(c)` (~963). All must emit identical
   strings, guarded by `manim-export.test.js`.
3. **Playback** (`services/web/src/engine/playback.js`): `_evaluateClip` (~517) gains
   five cases returning transient (there-and-back) overrides.
4. **Inspector** (`services/web/src/components/inspector/PropertiesPanel.vue`): five
   new `anim()` buttons (an "Emphasis" sub-group) + per-type param `<Section>`s.
5. **Round-trip parser** (`services/web/src/export/manim.js`): standalone
   `self.play(<Anim>(...))` matchers (~1887+) + `parseClipExpr` (~1185) for parallel
   groups, reading back every emitted kwarg.

## Clip Types & Data Model

Each emphasis clip stores its params in the existing `clip.params` bag (consistent
with `move`/`scale`/`fade`/`rotate`). Full Manim parameter set per type:

| Type | `clip.params` keys | Defaults |
|------|--------------------|----------|
| `indicate` | `color, scale_factor` | `#FFFF00`, `1.2` |
| `flash` | `color, flash_radius, line_length, num_lines` | `#FFFF00`, `0.3`, `0.2`, `12` |
| `wiggle` | `scale_value, rotation_angle, n_wiggles` | `1.1`, `3.6` (deg), `6` |
| `circumscribe` | `color, shape, fade_out, time_width` | `#FFFF00`, `Rectangle`, `false`, `0.3` |
| `focus_on` | `color, opacity` | `#FFFF00`, `0.2` |

Common clip fields (already present): `duration` → emitted as `run_time`, `easing`
→ `rate_func`, `parallel`/`lag_ratio` (AnimationGroup/LaggedStart via existing infra),
`sourceId` (the target mobject), `startTime`.

**Conventions:**
- `color` is stored as a hex string and emitted via the existing `hex()` helper as a
  quoted hex literal (e.g. `"#FFFF00"`). Manim CE accepts hex strings for `color=`.
- `rotation_angle` is stored in **degrees** and emitted as `<deg> * DEGREES` (same
  convention as Phase 2 geometry angles). Default `3.6` deg ≈ Manim's `0.01 * TAU`.
- `shape` is one of the literal strings `"Rectangle"` | `"Circle"` in JSON, emitted
  as the **bare class name** `Rectangle` / `Circle` (no quotes).
- `fade_out` is a JS boolean, emitted as Python `True`/`False`.
- Numeric params emitted with a fixed precision matching surrounding code
  (`.toFixed(2)` for floats, integers bare).

## Codegen (byte-identical)

Each type emits a single `self.play(...)` line (and the same inner expression inside
parallel groups). `<rt>` = `, run_time=<dur>` via the existing `rtOpt`/`rtStr`, `<rf>`
= the existing `rfOpt`/`rfStr` rate-func option.

```python
self.play(Indicate(m, color="#FFFF00", scale_factor=1.2)<rt><rf>)
self.play(Flash(m, color="#FFFF00", flash_radius=0.3, line_length=0.2, num_lines=12)<rt><rf>)
self.play(Wiggle(m, scale_value=1.1, rotation_angle=3.6 * DEGREES, n_wiggles=6)<rt><rf>)
self.play(Circumscribe(m, color="#FFFF00", shape=Rectangle, fade_out=False, time_width=0.3)<rt><rf>)
self.play(FocusOn(m, color="#FFFF00", opacity=0.2)<rt><rf>)
```

- `m` is the source object's var name (`vn(objId)` / `sn`).
- Parallel-group form drops the `self.play(` wrapper and `<rt><rf>` (the group play
  carries run_time), emitting just `Indicate(m, color=..., scale_factor=...)` etc.
  via `clipExpr`/the parallel-group switch.
- The emission strings (kwarg order, spacing, precision) MUST be byte-identical
  across codegen.js's three switches and manim.js's `clipCode`/`clipExpr`. Guarded by
  `manim-export.test.js`.

**Security:** No expression input. `color` passes through `hex()` (sanitizes to a
`#RRGGBB` literal). `shape` is gated to the two allowed class names; any other value
falls back to `Rectangle`. Numerics are formatted, not interpolated raw.

## Playback Preview (mixed fidelity)

`_evaluateClip` returns `{ objectId, overrides, clipId }`. Emphasis cases compute a
transient pulse from `progress` (raw clip progress 0→1; emphasis ignores `easedT`'s
monotonic ramp and uses its own there-and-back shape):

- **Indicate** (faithful): `pulse = 1 - |2*progress - 1|` (triangle, peak at mid);
  `overrides.scaleX = overrides.scaleY = lerp(1, scale_factor, pulse)`; fill tinted
  toward `color` by `pulse` (a hex lerp helper, or set `overrides.fill` to the tinted
  color).
- **Wiggle** (faithful): `osc = sin(2π * n_wiggles * progress)`;
  `overrides.rotation = baseRotation + osc * rotation_angle` (deg);
  `overrides.scaleX = overrides.scaleY = 1 + osc * (scale_value - 1)`.
- **Flash** (approximate): `pulse = sin(π * progress)`; brief fill/stroke tint toward
  `color` by `pulse` (no rays).
- **FocusOn** (approximate): `pulse = sin(π * progress)`; fill tint toward `color` by
  `pulse` on the focused object only (others unchanged).
- **Circumscribe** (approximate): `progress`-driven overlay. Sets
  `overrides._emphasis = { kind: 'circumscribe', shape, color, progress, fadeOut }`.
  No property change to the object itself.

`StageCanvas.vue` reads `frame` object entries for `_emphasis`; when present it draws
a single temporary overlay (Konva `Rect` for `shape === 'Rectangle'`, `Ellipse` for
`'Circle'`) around the object's bounding box, stroked in `color`, with opacity driven
by `progress` (ramp-in; if `fadeOut`, ramp back out in the second half). This is the
only new rendering path. All other emphasis previews reuse the existing override
mechanism (scale/rotation/fill).

> A hex-lerp / tint helper is needed for the fill-tint previews. If one already
> exists in the engine (e.g. a color util), reuse it; otherwise add a small
> `lerpHex(a, b, t)` in the playback module.

## Inspector

In `PropertiesPanel.vue`, the existing "Create a timeline clip animation" button grid
gains an **Emphasis** sub-group (label + 5 buttons) calling `anim('indicate')` etc.
`anim(type)` sets the default params from the table above.

Per-type param `<Section>`s (shown when that clip is selected), mirroring the existing
move/scale/fade/rotate sections:
- **indicate**: color picker (`color`), Num `scale_factor`.
- **flash**: color, Num `flash_radius`, `line_length`, `num_lines`.
- **wiggle**: Num `scale_value`, `rotation_angle` (deg), `n_wiggles`.
- **circumscribe**: color, `shape` select (Rectangle/Circle), `fade_out` checkbox,
  Num `time_width`.
- **focus_on**: color, Num `opacity` (0–1).

Updates flow through the existing `up(key, val)` (writes `clip.params`) and `uc` for
top-level fields.

## Round-Trip Parser

Both parse paths in `manim.js` gain the five types, reading back **every** emitted
kwarg (full round-trip, consistent with existing clips):

1. **Standalone** (`self.play(<Anim>(m, ...)<rt>)`): one matcher per type near the
   existing `self.play(Rotate(...))` matcher (~1887). Captures the var (→ `sourceId`
   via the var map), the kwargs (color hex, numerics, `shape` class, `fade_out` bool,
   `rotation_angle` from `<deg> * DEGREES`), and optional `run_time` (→ `duration`).
   Pushes a clip with `type`, `sourceId`, `startTime` (running counter `ct`),
   `duration`, `easing: 'ease_in_out'`, `params`.
2. **Parallel** (`parseClipExpr`, ~1185): the same five inner-expression matchers so
   emphasis clips inside an `AnimationGroup`/`LaggedStart` round-trip with `parallel:
   true`.

`rotation_angle` parses `([-\d.]+) \* DEGREES` back to the stored degree value.
`shape` parses the bare class name back to the string. Unknown/missing kwargs fall
back to the type defaults.

## Testing

- **Codegen string** (`emphasis-codegen.test.js`): each of the 5 types emits the
  expected `self.play(<Anim>(...))` with correct kwargs and precision; parity via the
  existing `manim-export.test.js` invariants.
- **Round-trip** (same file): each type survives export → `parseManimScript` → import
  with params preserved (color, numerics, shape, fade_out, rotation_angle deg).
- **Parallel round-trip**: two emphasis clips at the same `startTime` with
  `parallel: true` → `AnimationGroup(...)` → parsed back as parallel.
- **Playback** (`emphasis-playback.test.js`): Indicate at `progress = 0.5` yields
  `scaleX ≈ scale_factor` and returns to ~1 at `progress = 0`/`1`; Wiggle rotation
  oscillates (sign flips across the period).
- **Inspector** (`emphasis-panel.test.js`): the 5 buttons exist; clicking creates a
  clip of the right type with default params; the per-type param sections render for a
  selected clip and write through `up()`.

## Files Touched

| File | Change |
|------|--------|
| `services/api/src/compiler/codegen.js` | 5 emphasis cases in the 3 clip switches (byte-identical) |
| `services/web/src/export/manim.js` | `clipCode`/`clipExpr` emission + standalone & `parseClipExpr` round-trip matchers |
| `services/web/src/engine/playback.js` | 5 `_evaluateClip` cases + `lerpHex` helper if absent |
| `services/web/src/components/stage/StageCanvas.vue` | `_emphasis` overlay rendering (Circumscribe box/ellipse) |
| `services/web/src/components/inspector/PropertiesPanel.vue` | Emphasis button sub-group + per-type param sections + `anim()` defaults |
| `services/web/tests/components/*.test.js` | codegen + round-trip + playback + inspector tests |

## Known Constraints / Risks

- **Flash / FocusOn previews are color-pulse approximations** — the render (Manim
  rays / spotlight dim) is faithful; the preview is a hint. Documented, same pattern
  as Phase 2.6 shadow blur (preview-only).
- **Circumscribe preview** is an overlay box/ellipse around the bbox; Manim's exact
  `time_width` sweep is approximated by a progress-driven opacity.
- **Emphasis ignores `easedT`'s monotonic ramp** — it derives its own there-and-back
  shape from raw `progress`, so the clip's `easing` field affects only the emitted
  `rate_func` (render), not the preview pulse shape.
- `rotation_angle` stored in degrees (UI-friendly) but Manim's native unit is radians;
  the `* DEGREES` emission bridges this. Round-trip preserves the degree value.
