# Text & Math Animations — Phase 3 Design

**Date:** 2026-06-05
**Status:** Approved, ready for implementation planning
**Scope:** Three text/math animation capabilities, bundled as one coherent phase.
**Base branch:** branch off `feat/coord-unify-phi-projection` (carries the v3.5.0
`FRAME_WIDTH` coordinate unification; `main` does not yet have it — per project
memory *branch-base-coord-unify*).

## Goal

The editor's math/education audience can already reveal text (`Write`/`draw`
entrance presets) and morph two shapes (`transform` clip → `ReplacementTransform`).
What's missing is the text/math-specific animation vocabulary:

1. **Tex-matching morph** — `TransformMatchingTex` / `TransformMatchingShapes`,
   where shared symbols stay anchored across a derivation step. Today's transform
   clip morphs two LaTeX blobs as undifferentiated shapes.
2. **Animated counter** — a `DecimalNumber` whose value animates (0→100, %, etc.),
   driven both by a dedicated `count` clip and by the existing keyframe system.
3. **Typewriter reveal** — `AddTextLetterByLetter` / `RemoveTextLetterByLetter`
   char-by-char reveal, as entrance/exit presets.

Each follows the established project pattern: byte-identical `codegen.js` /
`manim.js` emission, Konva canvas preview, `.py` round-trip, store actions with
`commitState()`, inspector controls, and `manim-export.test.js` parity invariants.

## Non-Goals

- **Counter `prefix`** (leading text like `$`) — `DecimalNumber` has no native
  prefix parameter; faking it breaks single-line round-trip. Deferred to a later
  iteration. `suffix` **is** supported (native `unit=`).
- Separate `Integer` object type — `counter` with `numDecimals: 0` covers integers.
- Keyframing `matchTerms` or animating typewriter speed beyond a single duration.
- `TransformMatchingTex` key-map / custom symbol pairing (Manim's `key_map`) — v1
  uses default term matching only.

## Feature 1 — Tex-matching morph (variant of `transform` clip)

### Data model

One new **optional** field on the existing transform clip:

```js
clip.matchTerms = true   // absent ⇒ byte-identical legacy ReplacementTransform/FadeTransform
```

No new clip type. Reuses the transform clip's existing `sourceId` / `targetId`
selection, timeline rendering, playback, and parser plumbing.

### Codegen (`codegen.js` + `manim.js`, all `case 'transform'` sites)

The transform case currently picks `FadeTransform` (when a raster image is
involved) else `ReplacementTransform`. New decision, applied **only when
`clip.matchTerms` is truthy and no raster is involved**:

| Source + target types | Emission |
|---|---|
| both `latex` | `TransformMatchingTex(sn, tn)` |
| both VMobjects (text/shapes), not both latex | `TransformMatchingShapes(sn, tn)` |
| raster involved, or `matchTerms` absent | unchanged (`FadeTransform` / `ReplacementTransform`) |

A shared helper (`transformExpr(clip, sn, tn, hasRaster, srcType, tgtType)`) keeps
the three `case 'transform'` sites in codegen.js and the two in manim.js
byte-identical. Single-line emission (round-trip requirement).

### Inspector (`AnimationPanel.vue`)

A **"Match terms"** checkbox on the selected transform clip, shown only when both
source and target are non-raster objects (hidden/disabled otherwise). Tooltip
notes it produces `TransformMatchingTex` for LaTeX pairs.

### Playback preview

Reuses the existing transform clip's crossfade/swap approximation unchanged.
Term-level anchoring is **preview-only divergence** (documented; same convention
as gradient angle and 3D projection).

### Parser (`manim.js`)

Extend the existing transform-clip regex (currently matches
`ReplacementTransform|FadeTransform|Transform`) to also match
`TransformMatchingTex|TransformMatchingShapes`, setting `matchTerms: true` on the
reconstructed clip.

## Feature 2 — Animated counter

### New object type `counter` (`DecimalNumber`)

```js
{
  type: 'counter',
  value: 0,          // current/base numeric value
  numDecimals: 0,    // 0 ⇒ integer formatting
  suffix: '',        // maps to Manim DecimalNumber unit="…"; '' ⇒ omitted
  // standard object fields: x, y, fill, stroke, strokeWidth, opacity, rotation,
  // enterTime, duration, enterAnim, exitAnim, zOrder, …
}
```

Added to `SHAPE_DEFAULTS`. Not in `GRADIENT_TYPES` / `DASH_TYPES`. Eligible for
the standard fill/stroke/opacity Style controls.

### Codegen — object construction

Single-line, round-trippable:

```python
n = DecimalNumber(<value>, num_decimal_places=<numDecimals>)            # no suffix
n = DecimalNumber(<value>, num_decimal_places=<numDecimals>, unit="<suffix>")  # with suffix
n.set_color(<fill hex>)
```

Standard post-construction `move_to([...])` positioning like every other object.
`suffix` passes the `safeLatex`-style sanitizer (strip quotes/backslashes/newlines,
no eval) since it lands inside a Python string literal.

### Drive A — `count` clip (primary)

New clip type:

```js
{ type: 'count', objectId, from: 0, to: 100, duration: 2,
  easing: 'ease_in_out_cubic', parallel, lag_ratio }
```

Codegen (multi-line block — gets a dedicated parser branch, like the dashed-VGroup
precedent):

```python
_vt_<id> = ValueTracker(<from>)
<n>.add_updater(lambda m: m.set_value(_vt_<id>.get_value()))
self.play(_vt_<id>.animate.set_value(<to>), run_time=<duration>, rate_func=<easing>)
<n>.clear_updaters()
```

`clear_updaters()` after the play so a later `count` clip or keyframe on the same
object rebinds cleanly. `<id>` is sanitized from the clip id for a valid Python
identifier.

### Drive B — keyframable `value`

Add a `value` arm to the keyframe engine:

- `_kfPropSet('value')` → `set_value`
- `_kfUpdater('value')` → `set_value`-based updater body

so `value` appears as a keyframe lane and works in the existing
`UpdateFromAlphaFunc` / `ValueTracker` / `animate` codegen modes. `KeyframeLane`
and the keyframe value formatter tolerate the `value` property like any numeric.

**Interaction note:** using a `count` clip *and* `value` keyframes on the same
object at overlapping times is the user's responsibility (last writer wins at
render); documented, not guarded.

### Preview (`StageCanvas.vue`)

`counter` renders as a Konva text node showing the formatted number
(`value.toFixed(numDecimals) + suffix`). During playback, the live value is the
`count`-clip-interpolated and/or `value`-keyframe-evaluated number, so scrubbing
shows the number changing. A listening hit rect makes it selectable/draggable.

### Inspector

- **Properties panel:** `value`, `numDecimals`, `suffix` inputs for a selected
  `counter`.
- **Animation panel:** `count` clip gets `from` / `to` / `duration` inputs.

### Store actions

`setCounterValue`, `setCounterDecimals`, `setCounterSuffix`, and a `createCount`
clip helper (mirrors `createTransform` / `createAnimation`). Each ends with
`commitState()`.

## Feature 3 — Typewriter reveal (entrance/exit presets)

Two new presets appended to `ENTER_ANIMS` / `EXIT_ANIMS`:

```js
// ENTER_ANIMS
{ value: 'typewriter',     label: 'Typewriter',     icon: '⌨', desc: 'Reveal char by char' }
// EXIT_ANIMS
{ value: 'typewriter_out', label: 'Typewriter Out', icon: '⌨', desc: 'Hide char by char' }
```

### Codegen (both generators, enter/exit switches)

```python
self.play(AddTextLetterByLetter(<n>), run_time=<dur>)      # entrance
self.play(RemoveTextLetterByLetter(<n>), run_time=<dur>)   # exit
```

Single-line; parser adds these to the existing enter/exit anim recognizers.

### Playback (`playback.js`)

Char-by-char reveal approximation in the existing `enterAnim`/`exitAnim` switch:
reveal `floor(progress * len)` characters of the object's text during the window.
Eligible for `text` and `latex` objects (and `counter`); for non-text objects it
falls back to a fade (preview-only).

## Shared Concerns

### Parity

Every emitted string is identical across `codegen.js` and `manim.js`. They share
no import; parity is maintained by convention + `manim-export.test.js` invariant
tests. New invariant tests cover: matching-transform (tex + shapes + raster-falls-
back), counter construction (with/without suffix), the `count` clip block, the
`value` keyframe arm, and the typewriter presets.

### Single-line constructor rule

`DecimalNumber(...)`, the matching-transform line, and the typewriter plays are all
single-line. The `count` clip's `ValueTracker` + `add_updater` + `play` +
`clear_updaters` block is the multi-line exception and gets a dedicated,
explicitly-tested parser branch (precedent: dashed-VGroup).

### Backward compatibility

All new object/clip fields are optional. A project with none of them re-renders
byte-identically. Guarded by codegen string-assertion tests.

### Accepted preview ≈ render divergences

1. **Tex term-matching morph** — preview uses the generic transform crossfade; only
   the render anchors shared symbols.
2. **Typewriter timing** — preview reveals by character-count fraction; Manim's
   exact per-glyph timing may differ slightly.
3. **Counter font metrics** — Konva text vs. Manim `DecimalNumber` glyph layout
   differ marginally (same class of divergence as the `latex` Unicode preview).

## Files Touched

| File | Change |
|---|---|
| `services/web/src/store/project.js` | `counter` in `SHAPE_DEFAULTS`; `ENTER_ANIMS`/`EXIT_ANIMS` typewriter; `matchTerms` on transform; new actions + `createCount` |
| `services/api/src/compiler/codegen.js` | `transformExpr` helper; `counter` object case; `count` clip case; `value` arm in `_kfPropSet`/`_kfUpdater`; typewriter enter/exit |
| `services/web/src/export/manim.js` | same emission + `value` keyframe arm + reverse parsers (matching-transform, counter, count block, typewriter) |
| `services/web/src/engine/playback.js` | `count` clip evaluation; typewriter reveal; counter live value |
| `services/web/src/components/stage/StageCanvas.vue` | `counter` Konva text node + hit rect |
| `services/web/src/components/inspector/PropertiesPanel.vue` | counter value/decimals/suffix |
| `services/web/src/components/inspector/AnimationPanel.vue` | transform "Match terms"; `count` from/to/duration |
| `services/web/tests/components/*.test.js` | store + round-trip + codegen + parity tests |

## Testing

- **Store unit tests:** new actions mutate the right fields, clamp, and call
  `commitState()`; `createCount` builds a valid clip.
- **Round-trip invariants** (`manim-export.test.js`): generate → parse → compare for
  matching-transform (all three branches), counter (with/without suffix), the
  `count` block, and typewriter presets.
- **Codegen string assertions:** an object/clip with none of the new fields is
  byte-identical to the base branch.
- **Parity:** codegen.js and manim.js emit identical strings for the same input.
- Existing suites (`npm run test:unit`, `npm test`) stay green.
