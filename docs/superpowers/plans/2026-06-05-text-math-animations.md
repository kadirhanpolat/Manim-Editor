# Text & Math Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three text/math animation capabilities to the editor — Tex-matching morph (`TransformMatchingTex`/`TransformMatchingShapes`), animated counter (`DecimalNumber` + `count` clip + keyframable `value`), and typewriter reveal presets — each with byte-identical codegen.js/manim.js emission, canvas preview, `.py` round-trip, and tests.

**Architecture:** Follow the established per-feature pattern. New fields are optional (absent ⇒ byte-identical legacy output). `codegen.js` (server, Node) and `manim.js` (client, Vitest-importable) emit identical strings, kept in sync by convention and guarded by `manim-export.test.js`. The `transform` clip gains a `matchTerms` variant via a shared `transformExpr` helper that replaces three duplicated sites. The counter is a new object type plus a new `count` clip plus a `value` arm in the keyframe engine.

**Tech Stack:** Vue 3 (`<script setup>`), Pinia, Konva.js, Vitest, Node.js codegen, Manim CE Python.

**Spec:** `docs/superpowers/specs/2026-06-05-text-math-animations-design.md`

**Branch:** Branch off `feat/coord-unify-phi-projection` (NOT `main` — per project memory; `main` lacks the v3.5.0 `FRAME_WIDTH` unification this relies on).

**Conventions used throughout:**
- Run unit tests: `cd services/web && npm run test:unit`
- Run engine tests: `cd services/web && npm test`
- Both must pass before every commit.
- `vn(id)` / `v(id)` = the Manim variable-name helper in codegen.js / manim.js.
- Parity rule: any Python string added to codegen.js must be added **character-identical** to manim.js.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `services/web/src/store/project.js` | State, defaults, actions | `counter` in `SHAPE_DEFAULTS`/`SHAPE_COLORS`; typewriter presets in `ENTER_ANIMS`/`EXIT_ANIMS`; `matchTerms`/counter/count actions |
| `services/api/src/compiler/codegen.js` | Server Python generator | `transformExpr` helper; `counter` object case; `count` clip case; `value` keyframe arm; typewriter enter/exit |
| `services/web/src/export/manim.js` | Client generator + parser | Same emission (identical strings) + reverse parsers |
| `services/web/src/engine/playback.js` | Preview engine | `count` clip eval; counter live value; typewriter reveal |
| `services/web/src/components/stage/StageCanvas.vue` | Konva preview | `counter` text node + hit rect |
| `services/web/src/components/inspector/PropertiesPanel.vue` | Object props | counter value/decimals/suffix |
| `services/web/src/components/inspector/AnimationPanel.vue` | Clip props | transform "Match terms"; `count` from/to/duration |
| `services/web/tests/components/text-math-animations.test.js` | New test file | store + codegen + round-trip + parity |

---

## Feature C — Typewriter reveal (presets)

Smallest feature; done first to establish the test file and warm up.

### Task 1: Typewriter entrance/exit presets + codegen + round-trip

**Files:**
- Modify: `services/web/src/store/project.js` (`ENTER_ANIMS` ~line 101, `EXIT_ANIMS` ~line 115)
- Modify: `services/api/src/compiler/codegen.js` (enter switch ~line 893, exit switch — search `exitAnim` switch)
- Modify: `services/web/src/export/manim.js` (enter switch ~line 870, exit switch, parser ~line 1934)
- Test: `services/web/tests/components/text-math-animations.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/text-math-animations.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore, ENTER_ANIMS, EXIT_ANIMS } from '../../src/store/project.js';
import { generateManimCode, parseManimCode } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('typewriter presets', () => {
  it('registers typewriter enter + exit presets', () => {
    expect(ENTER_ANIMS.find(a => a.value === 'typewriter')).toBeTruthy();
    expect(EXIT_ANIMS.find(a => a.value === 'typewriter_out')).toBeTruthy();
  });

  it('emits AddTextLetterByLetter / RemoveTextLetterByLetter', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Hello';
    obj.enterAnim = 'typewriter';
    obj.exitAnim = 'typewriter_out';
    obj.enterTime = 0; obj.duration = 4;
    const py = generateManimCode(store.project);
    expect(py).toContain('AddTextLetterByLetter');
    expect(py).toContain('RemoveTextLetterByLetter');
  });
});
```

> NOTE: confirm `generateManimCode` / `parseManimCode` are the actual exported names in `manim.js` (grep the file's `export`). If they differ (e.g. `exportManim`/`importManim`), use the real names here and in every later task.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js`
Expected: FAIL — `typewriter` preset not found.

- [ ] **Step 3: Add presets to the store**

In `services/web/src/store/project.js`, append to `ENTER_ANIMS` (before the closing `];` at ~line 113):

```js
  { value: 'typewriter',     label: 'Typewriter',     icon: '⌨', desc: 'Reveal char by char' },
```

Append to `EXIT_ANIMS` (before the closing `];` at ~line 125):

```js
  { value: 'typewriter_out',  label: 'Typewriter Out',  icon: '⌨', desc: 'Hide char by char' },
```

- [ ] **Step 4: Add codegen cases (both generators, identical strings)**

In `services/api/src/compiler/codegen.js`, in the **enter** switch (~line 893), add before `default:`:

```js
      case 'typewriter':
        enterCode = `self.play(AddTextLetterByLetter(${n})${rt})`;
        break;
```

Find the **exit** switch in the same file (search for `exitAnim` then the `switch`), add before its `default:`:

```js
      case 'typewriter_out':
        exitCode = `self.play(RemoveTextLetterByLetter(${n})${rt})`;
        break;
```

In `services/web/src/export/manim.js`, add the **identical** `case 'typewriter':` to the enter switch (~line 904, before `default:`) and `case 'typewriter_out':` to its exit switch. Use the same variable names already in scope there (`n`, `rt`).

- [ ] **Step 5: Add parser branches (manim.js)**

In `services/web/src/export/manim.js`, near the existing `Write`/`Create` enter parsers (~line 1934), add:

```js
    m = line.match(/^self\.play\(AddTextLetterByLetter\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) { objById[id].enterTime = ct; objById[id].enterAnim = 'typewriter'; }
      ct += parseFloat(m[2] || 0.5);
      continue;
    }
    m = line.match(/^self\.play\(RemoveTextLetterByLetter\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) { objById[id].exitAnim = 'typewriter_out'; }
      ct += parseFloat(m[2] || 0.5);
      continue;
    }
```

> Match the exact field-assignment style used by the neighbouring `Write` parser (how it sets `enterAnim`/exit). If the existing exit parser uses a different mechanism, mirror that instead.

- [ ] **Step 6: Add a round-trip test**

Append to the `typewriter presets` describe block:

```js
  it('round-trips typewriter enter through parse', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Hi'; obj.enterAnim = 'typewriter'; obj.enterTime = 0; obj.duration = 3;
    const py = generateManimCode(store.project);
    const parsed = parseManimCode(py);
    const reObj = parsed.objects.find(o => o.type === 'text');
    expect(reObj.enterAnim).toBe('typewriter');
  });
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js`
Expected: PASS (3 tests).
Then full suite: `npm run test:unit && npm test` → all green.

- [ ] **Step 8: Wire the playback preview**

In `services/web/src/engine/playback.js`, find the `enterAnim` switch (~line 369). Typewriter reveals characters over the window. For a minimal faithful preview, in the enter branch add a case that sets an override the canvas can read:

```js
        case 'typewriter': {
          // reveal fraction of characters; StageCanvas slices obj.content
          frame.objectOverrides[obj.id] = frame.objectOverrides[obj.id] || {};
          frame.objectOverrides[obj.id]._typewriter = enterProgress; // 0..1
          break;
        }
```

> Inspect how the existing `enterAnim` cases write to the frame (they likely set `opacity`/`scale` on an overrides object). Match that exact shape; `enterProgress` is whatever local the surrounding code already computes (e.g. `(time - enterTime) / enterDur`). If non-text objects pick `typewriter`, fall through to a fade (set opacity = progress).

- [ ] **Step 9: Render the partial text in StageCanvas**

In `services/web/src/components/stage/StageCanvas.vue`, where `text`/`latex` Konva text content is computed, if `overrides._typewriter` is present (0..1), slice the displayed string to `Math.round(content.length * _typewriter)` characters. For `latex` (Unicode approx) slice the approximated string. Exit (`typewriter_out`) slices from the end as progress runs 1→0.

- [ ] **Step 10: Manual preview check + commit**

Run the app (`docker compose up` or `cd services/web && npm run dev`), add a Text object, set entrance = Typewriter, scrub the timeline — characters appear progressively.

```bash
git add services/web/src/store/project.js services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/src/engine/playback.js services/web/src/components/stage/StageCanvas.vue services/web/tests/components/text-math-animations.test.js
git commit -m "feat(text-anim): typewriter entrance/exit presets (AddTextLetterByLetter)"
```

---

## Feature A — Tex-matching morph (transform variant)

### Task 2: `transformExpr` helper + `matchTerms` in codegen.js

**Files:**
- Modify: `services/api/src/compiler/codegen.js` (three `case 'transform'` sites: ~963, ~1033, ~1124)
- Test: `services/web/tests/components/text-math-animations.test.js`

- [ ] **Step 1: Write the failing test**

Add to the test file:

```js
describe('tex-matching transform', () => {
  function twoObjThenTransform(srcType, tgtType, matchTerms) {
    const a = store.addObject(srcType, 600, 540);
    const b = store.addObject(tgtType, 1200, 540);
    if (srcType === 'latex') a.latex = 'a^2 + b^2';
    if (tgtType === 'latex') b.latex = 'c^2';
    a.enterTime = 0; a.duration = 5; b.enterTime = 0; b.duration = 5;
    const clip = store.addClip(0, {
      type: 'transform', startTime: 1, duration: 1.5, easing: 'ease_in_out_cubic',
      sourceId: a.id, targetId: b.id,
    });
    if (matchTerms) clip.matchTerms = true;
    return { a, b, clip };
  }

  it('emits TransformMatchingTex for two latex objects with matchTerms', () => {
    twoObjThenTransform('latex', 'latex', true);
    expect(generateManimCode(store.project)).toContain('TransformMatchingTex(');
  });

  it('emits TransformMatchingShapes for non-latex VMobjects with matchTerms', () => {
    twoObjThenTransform('circle', 'square', true);
    expect(generateManimCode(store.project)).toContain('TransformMatchingShapes(');
  });

  it('without matchTerms emits ReplacementTransform (byte-identical legacy)', () => {
    twoObjThenTransform('latex', 'latex', false);
    const py = generateManimCode(store.project);
    expect(py).toContain('ReplacementTransform(');
    expect(py).not.toContain('TransformMatching');
  });

  it('raster source ignores matchTerms and uses FadeTransform', () => {
    twoObjThenTransform('image', 'latex', true);
    const py = generateManimCode(store.project);
    expect(py).toContain('FadeTransform(');
    expect(py).not.toContain('TransformMatching');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "tex-matching"`
Expected: FAIL — output still says `ReplacementTransform`.

- [ ] **Step 3: Add the `transformExpr` helper**

In `services/api/src/compiler/codegen.js`, add this helper near `_kfPropSet` (top-level function, ~line 570):

```js
// Shared transform-clip expression. matchTerms (when set and no raster involved)
// upgrades to TransformMatchingTex (both latex) or TransformMatchingShapes (other
// VMobjects). Used by all three transform-clip codegen sites + the parallel group.
function transformExpr(clip, sn, tn, srcObj, tgtObj) {
  const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
  if (hasRaster) return `FadeTransform(${sn}, ${tn})`;
  if (clip.matchTerms) {
    const bothLatex = srcObj?.type === 'latex' && tgtObj?.type === 'latex';
    return bothLatex
      ? `TransformMatchingTex(${sn}, ${tn})`
      : `TransformMatchingShapes(${sn}, ${tn})`;
  }
  return `ReplacementTransform(${sn}, ${tn})`;
}
```

- [ ] **Step 4: Replace the three transform sites with the helper**

Site 1 (~963), replace the `case 'transform'` body with:

```js
        case 'transform': {
          const tn = vn(c.targetId);
          code = `self.play(${transformExpr(c, sn, tn, oMap[c.sourceId], oMap[c.targetId])}${rtStr}${rfStr})`;
          break;
        }
```

Site 2 (~1033, degenerate single-parallel) — identical replacement.

Site 3 (~1124, parallel-group inner expr) — replace the body with:

```js
          case 'transform': {
            const tn = vn(c.targetId);
            return transformExpr(c, sn, tn, oMap[c.sourceId], oMap[c.targetId]);
          }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "tex-matching"`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/tests/components/text-math-animations.test.js
git commit -m "feat(text-anim): transformExpr helper + matchTerms (TransformMatchingTex/Shapes) in codegen.js"
```

### Task 3: Mirror in manim.js + parser

**Files:**
- Modify: `services/web/src/export/manim.js` (two transform sites ~938/~1015; parser ~1942)
- Test: `services/web/tests/components/text-math-animations.test.js`

- [ ] **Step 1: Add a round-trip test**

Add to the `tex-matching transform` describe:

```js
  it('round-trips matchTerms through generate→parse', () => {
    twoObjThenTransform('latex', 'latex', true);
    const py = generateManimCode(store.project);
    const parsed = parseManimCode(py);
    const clip = parsed.tracks.flatMap(t => t.clips).find(c => c.type === 'transform');
    expect(clip.matchTerms).toBe(true);
  });
```

> Confirm the parsed shape exposes clips at `parsed.tracks[].clips`. If the parser returns clips elsewhere, adjust the lookup.

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "round-trips matchTerms"`
Expected: FAIL — `matchTerms` undefined (manim.js still emits `ReplacementTransform`).

- [ ] **Step 3: Mirror the helper in manim.js**

In `services/web/src/export/manim.js`, add the **identical** `transformExpr` function (same body, using `v`/`oMap` equivalents in that file — check the local object-map variable name; it may be `oMap` or a `Map`). Replace both transform sites (~938, ~1015) to call it, exactly as Task 2 did.

- [ ] **Step 4: Extend the parser regex**

In `services/web/src/export/manim.js` (~1942), change the transform regex to also match the new animations and set `matchTerms`:

```js
    m = line.match(/^self\.play\((ReplacementTransform|FadeTransform|Transform|TransformMatchingTex|TransformMatchingShapes)\((\w+),\s*(\w+)\)(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=([^\s)]+))?\)/);
    if (m) {
      const animName = m[1];
      const srcId = varMap[m[2]], tgtId = varMap[m[3]];
      if (srcId && tgtId) {
        const dur = parseFloat(m[4] || 1);
        const easing = m[5] ? (EASING_REV[m[5]] || 'ease_in_out') : 'ease_in_out';
        const clip = { id: `clip_${clipIdx++}`, type: 'transform', sourceId: srcId, targetId: tgtId, startTime: ct, duration: dur, easing };
        if (animName === 'TransformMatchingTex' || animName === 'TransformMatchingShapes') clip.matchTerms = true;
        clips.push(clip);
        ct += dur;
      }
      continue;
    }
```

> Note the capture-group indices shifted by one (animName is now group 1). Update them carefully.

- [ ] **Step 5: Check the parallel-group inner parser too**

Search manim.js for where parallel-group / `AnimationGroup` inner expressions are parsed (the `parseAnimExpr` helper referenced in CLAUDE.md). Add `TransformMatchingTex`/`TransformMatchingShapes` recognition there, setting `matchTerms: true`, mirroring how it currently recognizes `ReplacementTransform`.

- [ ] **Step 6: Run tests to verify pass**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js`
Expected: PASS.
Full suite: `npm run test:unit && npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add services/web/src/export/manim.js services/web/tests/components/text-math-animations.test.js
git commit -m "feat(text-anim): mirror matchTerms in manim.js + round-trip parser"
```

### Task 4: Store flag + inspector "Match terms" checkbox

**Files:**
- Modify: `services/web/src/store/project.js` (new action)
- Modify: `services/web/src/components/inspector/AnimationPanel.vue`
- Test: `services/web/tests/components/text-math-animations.test.js`

- [ ] **Step 1: Write the failing store test**

```js
describe('setClipMatchTerms action', () => {
  it('sets and clears matchTerms, commits state', () => {
    const a = store.addObject('latex', 600, 540);
    const b = store.addObject('latex', 1200, 540);
    const clip = store.addClip(0, { type: 'transform', startTime: 0, duration: 1, easing: 'linear', sourceId: a.id, targetId: b.id });
    store.setClipMatchTerms(clip.id, true);
    expect(store.clipById(clip.id).matchTerms).toBe(true);
    store.setClipMatchTerms(clip.id, false);
    expect(store.clipById(clip.id).matchTerms).toBeUndefined();
  });
});
```

> Verify `clipById` exists as a getter; if clips are looked up differently, adapt. If `addClip(trackIndex, clip)` signature differs, match the real one (it returns the created clip — see `createTransform` in project.js).

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "setClipMatchTerms"`
Expected: FAIL — `setClipMatchTerms is not a function`.

- [ ] **Step 3: Add the action**

In `services/web/src/store/project.js` actions, near `createTransform`:

```js
    setClipMatchTerms(clipId, on) {
      const clip = this.clipById(clipId);
      if (!clip) return;
      if (on) clip.matchTerms = true;
      else delete clip.matchTerms;
      this.commitState();
    },
```

> If there is no `clipById` getter, add one or reuse the existing clip-lookup the inspector already uses (grep `selectedClipId` consumers).

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "setClipMatchTerms"`
Expected: PASS.

- [ ] **Step 5: Add the inspector checkbox**

In `services/web/src/components/inspector/AnimationPanel.vue`, when the selected clip is a `transform`, render a checkbox bound to `clip.matchTerms`, calling `store.setClipMatchTerms(clip.id, $event)`. Show it only when both source and target objects are non-raster:

```vue
<label v-if="clip.type === 'transform' && bothNonRaster" class="row">
  <input type="checkbox" :checked="!!clip.matchTerms"
         @change="store.setClipMatchTerms(clip.id, $event.target.checked)" />
  Match terms (TransformMatchingTex)
</label>
```

Add a computed `bothNonRaster` that resolves `store.objectById(clip.sourceId)` / `targetId` and checks neither type is `image`/`svg_asset`. Follow the file's existing `<script setup>` patterns for reading the selected clip.

- [ ] **Step 6: Manual check + commit**

Create two LaTeX objects, select both, make a transform, select the clip — the "Match terms" checkbox appears; toggling it changes export to `TransformMatchingTex`.

```bash
git add services/web/src/store/project.js services/web/src/components/inspector/AnimationPanel.vue services/web/tests/components/text-math-animations.test.js
git commit -m "feat(text-anim): setClipMatchTerms action + inspector Match-terms checkbox"
```

---

## Feature B — Animated counter

### Task 5: `counter` object type

**Files:**
- Modify: `services/web/src/store/project.js` (`SHAPE_DEFAULTS`, `SHAPE_COLORS`; field defaults in `addObject`)
- Modify: `services/api/src/compiler/codegen.js` (object switch — new `case 'counter'`)
- Modify: `services/web/src/export/manim.js` (object switch + parser)
- Test: `services/web/tests/components/text-math-animations.test.js`

- [ ] **Step 1: Write the failing test**

```js
describe('counter object', () => {
  it('emits DecimalNumber with num_decimal_places', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 42; c.numDecimals = 0;
    const py = generateManimCode(store.project);
    expect(py).toContain('DecimalNumber(42');
    expect(py).toContain('num_decimal_places=0');
  });

  it('emits unit="..." only when suffix set', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 50; c.numDecimals = 1; c.suffix = '%';
    expect(generateManimCode(store.project)).toContain('unit="%"');
  });

  it('round-trips a counter', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 7; c.numDecimals = 2; c.suffix = 'kg';
    const parsed = parseManimCode(generateManimCode(store.project));
    const re = parsed.objects.find(o => o.type === 'counter');
    expect(re.value).toBe(7);
    expect(re.numDecimals).toBe(2);
    expect(re.suffix).toBe('kg');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "counter object"`
Expected: FAIL — counter not a known type / no `DecimalNumber`.

- [ ] **Step 3: Register the object type in the store**

In `services/web/src/store/project.js`, add to `SHAPE_DEFAULTS` (~line 163):

```js
  counter:  { width: 120, height: 60, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
```

Add to `SHAPE_COLORS`:

```js
  counter: '#38bdf8',
```

In `addObject` (grep for where type-specific defaults are seeded — e.g. text gets `content`), seed counter fields:

```js
      if (type === 'counter') { obj.value = 0; obj.numDecimals = 0; obj.suffix = ''; }
```

> Match the exact place/idiom `addObject` uses to seed `text`/`latex` defaults.

- [ ] **Step 4: Add the codegen object case (both generators, identical)**

In `services/api/src/compiler/codegen.js` object switch (near `case 'text'` ~465), add:

```js
    case 'counter': {
      const val = safeNum(obj.value, 0);
      const dec = safeNum(obj.numDecimals, 0);
      const unit = obj.suffix ? `, unit="${safeText(obj.suffix)}"` : '';
      lines.push(`${n} = DecimalNumber(${val}, num_decimal_places=${dec}${unit})`);
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
```

> `safeNum`, `safeText`, `hasFill`, `fill`, `n` are already in scope in that switch (used by neighbouring cases). Verify `safeText` is the sanitizer used for text content (strips quotes/backslashes/newlines).

Add the **identical** case to `services/web/src/export/manim.js`'s object switch (same string), using that file's in-scope equivalents.

- [ ] **Step 5: Add the parser (manim.js)**

Where manim.js parses object constructor lines, add a branch:

```js
    m = line.match(/^(\w+) = DecimalNumber\(([\d.]+), num_decimal_places=(\d+)(?:, unit="([^"]*)")?\)/);
    if (m) {
      const obj = { id: uid(), type: 'counter', name: 'Counter',
        x: sw / 2, y: sh / 2, width: 120, height: 60,
        fill: '#ffffff', stroke: 'transparent', strokeWidth: 0, opacity: 1, rotation: 0,
        enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length,
        value: parseFloat(m[2]), numDecimals: parseInt(m[3], 10), suffix: m[4] || '' };
      varMap[m[1]] = obj.id; objById[obj.id] = obj; objects.push(obj);
      continue;
    }
```

> Match the exact object-construction idiom used by other parser branches in this file (the `square` fallback at ~line 1304 is a good template for required fields and how `varMap`/`objById`/`objects` are updated). `set_color(...)` on the following line should update `fill` via the existing color-parse branch.

- [ ] **Step 6: Run to verify it passes**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "counter object"`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add services/web/src/store/project.js services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/text-math-animations.test.js
git commit -m "feat(text-anim): counter object type (DecimalNumber) + round-trip"
```

### Task 6: `count` clip (ValueTracker drive)

**Files:**
- Modify: `services/web/src/store/project.js` (`createCount` helper)
- Modify: `services/api/src/compiler/codegen.js` (clip switches — new `case 'count'`)
- Modify: `services/web/src/export/manim.js` (clip switch + multi-line parser)
- Modify: `services/web/src/engine/playback.js` (count clip eval)
- Test: `services/web/tests/components/text-math-animations.test.js`

- [ ] **Step 1: Write the failing test**

```js
describe('count clip', () => {
  it('emits ValueTracker + add_updater + animate.set_value + clear_updaters', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.enterTime = 0; c.duration = 5;
    store.addClip(0, { type: 'count', objectId: c.id, from: 0, to: 100, startTime: 1, duration: 2, easing: 'linear' });
    const py = generateManimCode(store.project);
    expect(py).toContain('ValueTracker(0)');
    expect(py).toContain('add_updater(');
    expect(py).toContain('animate.set_value(100)');
    expect(py).toContain('clear_updaters()');
  });

  it('round-trips a count clip', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.enterTime = 0; c.duration = 5;
    store.addClip(0, { type: 'count', objectId: c.id, from: 5, to: 50, startTime: 1, duration: 2, easing: 'linear' });
    const parsed = parseManimCode(generateManimCode(store.project));
    const clip = parsed.tracks.flatMap(t => t.clips).find(cl => cl.type === 'count');
    expect(clip.from).toBe(5);
    expect(clip.to).toBe(50);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "count clip"`
Expected: FAIL — no `ValueTracker` emitted for the unknown clip type.

- [ ] **Step 3: Add the `count` codegen (both generators)**

The `count` clip emits a multi-line block. It is only meaningful as a sequential single step (not inside an `AnimationGroup`), so handle it in the **single-clip** sites and skip it in the parallel-group inner expr (return `null` there).

In `services/api/src/compiler/codegen.js`, in the single-clip switch (~963) add:

```js
        case 'count': {
          const cn = c.id ? c.id.replace(/[^a-zA-Z0-9_]/g, '_') : sn;
          const vt = `_count_${cn}`;   // distinct from keyframe _vt_<obj>_<prop> to avoid parser collision
          const from = safeNum(c.from, 0), to = safeNum(c.to, 0);
          code = [
            `${vt} = ValueTracker(${from})`,
            `${sn}.add_updater(lambda m: m.set_value(${vt}.get_value()))`,
            `self.play(${vt}.animate.set_value(${to})${rtStr}${rfStr})`,
            `${sn}.clear_updaters()`,
          ].join(`\n${indent}`);
          break;
        }
```

Add the **identical** case to the degenerate single-parallel switch (~1033). In the parallel-group inner-expr switch (~1124), add `case 'count': return null;` (count cannot be grouped). Mirror all of this into `manim.js` with identical strings (its single-clip + parallel sites; confirm `indent` equivalent variable name).

- [ ] **Step 4: Add the multi-line parser (manim.js)**

The parser is line-based; `count` spans four lines. Recognize the `ValueTracker` opener and consume the block. Near the other clip parsers add:

```js
    m = line.match(/^_count_(\w+) = ValueTracker\(([\d.-]+)\)/);
    if (m) {
      const from = parseFloat(m[2]);
      // next lines: add_updater (skip), self.play(_count_X.animate.set_value(TO)...), clear_updaters (skip)
      const playLine = lines[idx + 2] || '';
      const pm = playLine.match(/animate\.set_value\(([\d.-]+)\)(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=([^\s)]+))?/);
      const updLine = lines[idx + 1] || '';
      const um = updLine.match(/^(\w+)\.add_updater/);
      if (pm && um) {
        const objId = varMap[um[1]];
        const dur = parseFloat(pm[2] || 1);
        const easing = pm[3] ? (EASING_REV[pm[3]] || 'linear') : 'linear';
        clips.push({ id: `clip_${clipIdx++}`, type: 'count', objectId: objId, from, to: parseFloat(pm[1]), startTime: ct, duration: dur, easing });
        ct += dur;
      }
      idx += 3; // consumed 4 lines total (loop will ++)
      continue;
    }
```

> Adapt to the loop's actual index variable (`idx`/`i`) and how it accesses the lines array. The dashed-VGroup parser (per CLAUDE.md) is the precedent for a multi-line consume; follow its mechanics for advancing the line cursor.

- [ ] **Step 5: Add the `createCount` store helper**

In `services/web/src/store/project.js`, near `createAnimation`:

```js
    createCount(from = 0, to = 100) {
      if (this.selectedObjectIds.length !== 1) { this.setError('Select 1 counter to animate'); return null; }
      const objectId = this.selectedObjectIds[0];
      const src = this.objectById(objectId);
      const startTime = src ? (src.enterTime || 0) : 0;
      let trackIndex = 0;
      for (let i = 0; i < this.project.tracks.length; i++) {
        if (this.project.tracks[i].clips.length === 0) { trackIndex = i; break; }
        trackIndex = i + 1;
      }
      trackIndex = Math.min(trackIndex, 4);
      const clip = this.addClip(trackIndex, { type: 'count', objectId, from, to, startTime, duration: 2, easing: 'ease_in_out_cubic' });
      this.selectedClipId = clip.id;
      return clip;
    },
```

- [ ] **Step 6: Evaluate the count clip in playback**

In `services/web/src/engine/playback.js`, where clips are evaluated per type (grep the clip-type switch in `computeFrame`), add `count` handling: while `time` is within `[startTime, startTime+duration]`, interpolate `from→to` by eased progress and write the live number to the object's override so the canvas shows it:

```js
      if (clip.type === 'count') {
        const p = clamp01((time - clip.startTime) / clip.duration);
        const eased = applyEasing(clip.easing, p); // use the engine's existing easing fn
        const v = clip.from + (clip.to - clip.from) * eased;
        frame.objectOverrides[clip.objectId] = frame.objectOverrides[clip.objectId] || {};
        frame.objectOverrides[clip.objectId].value = v;
        // after the window, hold the final value
      }
```

> Match the file's real helpers (`clamp01`, the easing application). After the clip ends, hold `to`. Before it starts, the object shows its base `value`.

- [ ] **Step 7: Run to verify it passes**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "count clip"`
Expected: PASS.
Full suite: `npm run test:unit && npm test` → green.

- [ ] **Step 8: Commit**

```bash
git add services/web/src/store/project.js services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/src/engine/playback.js services/web/tests/components/text-math-animations.test.js
git commit -m "feat(text-anim): count clip (ValueTracker) codegen + playback + round-trip"
```

### Task 7: Keyframable `value` property

**Files:**
- Modify: `services/api/src/compiler/codegen.js` (`_kfPropSet`, `_kfUpdater`, `_kfValue`)
- Modify: `services/web/src/export/manim.js` (same three helpers)
- Test: `services/web/tests/components/text-math-animations.test.js`

- [ ] **Step 1: Write the failing test**

```js
describe('keyframable value', () => {
  it('emits set_value for a value keyframe', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.enterTime = 0; c.duration = 5;
    store.addKeyframe(c.id, 'value', 0.5, 0);
    store.addKeyframe(c.id, 'value', 2.5, 100);
    store.setKeyframeCodegen(c.id, 'value', 'animate');
    const py = generateManimCode(store.project);
    expect(py).toContain('set_value');
  });
});
```

> Confirm `addKeyframe(objId, prop, time, value)` and `setKeyframeCodegen` signatures against the store (CLAUDE.md documents them).

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "keyframable value"`
Expected: FAIL — `value` returns null from `_kfUpdater`, no `set_value` emitted.

- [ ] **Step 3: Add the `value` arms (codegen.js)**

In `_kfPropSet` (~573), add before `default:`:

```js
    case 'value': return `${n}.animate.set_value(${value.toFixed(4)})`;
```

In `_kfUpdater` (~597), add before `default:`:

```js
    case 'value':   return 'set_value';
```

`_kfValue` (~608) needs no `value` case — its `default` returns `value` unchanged, which is correct for a counter (raw number, no coordinate conversion).

- [ ] **Step 4: Mirror in manim.js**

Add the identical `case 'value':` lines to manim.js's `_kfPropSet` and `_kfUpdater`.

- [ ] **Step 5: Run to verify it passes**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "keyframable value"`
Expected: PASS.

- [ ] **Step 6: Verify the playback already handles `value` keyframes**

The keyframe override pipeline (`_applyKeyframeOverrides`) is property-generic, so a `value` keyframe should already flow to `frame.objectOverrides[id].value` like any numeric. Add a quick assertion or manual scrub check; if the lane UI rejects unknown props, see Task 9.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/text-math-animations.test.js
git commit -m "feat(text-anim): keyframable value property (set_value) in both generators"
```

### Task 8: Counter canvas preview

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Render the counter as Konva text**

In `StageCanvas.vue`, add `counter` to the object rendering. The displayed string is the live value formatted:

```js
function counterText(obj, overrides) {
  const raw = (overrides && 'value' in overrides) ? overrides.value : (obj.value ?? 0);
  return raw.toFixed(obj.numDecimals ?? 0) + (obj.suffix || '');
}
```

Render it with a `Konva` text node (reuse the existing `text` node config — font size derived from `obj.height` like other text, fill = `obj.fill`) plus a listening hit rect so it's selectable/draggable (follow the `matrix`/`text` hit-region pattern already in the file).

- [ ] **Step 2: Verify live value during playback**

The override-driven value (from a `count` clip or `value` keyframes, Tasks 6–7) flows through `overrides.value`. Scrub the timeline — the number animates.

- [ ] **Step 3: Manual check + commit**

Add a Counter, add a count clip 0→100, scrub — number ticks up.

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(text-anim): counter canvas preview with live value"
```

### Task 9: Inspector controls

**Files:**
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (counter value/decimals/suffix)
- Modify: `services/web/src/components/inspector/AnimationPanel.vue` (count from/to/duration)
- Modify: `services/web/src/store/project.js` (counter setter actions)
- Test: `services/web/tests/components/text-math-animations.test.js`

- [ ] **Step 1: Write the failing store-action test**

```js
describe('counter actions', () => {
  it('setCounterValue / setCounterDecimals / setCounterSuffix mutate + commit', () => {
    const c = store.addObject('counter', 960, 540);
    store.setCounterValue(c.id, 12);
    store.setCounterDecimals(c.id, 2);
    store.setCounterSuffix(c.id, '%');
    const re = store.objectById(c.id);
    expect(re.value).toBe(12);
    expect(re.numDecimals).toBe(2);
    expect(re.suffix).toBe('%');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "counter actions"`
Expected: FAIL — setters undefined.

- [ ] **Step 3: Add the setter actions**

In `services/web/src/store/project.js`:

```js
    setCounterValue(objId, v) { const o = this.objectById(objId); if (!o) return; o.value = Number(v) || 0; this.commitState(); },
    setCounterDecimals(objId, n) { const o = this.objectById(objId); if (!o) return; o.numDecimals = Math.max(0, Math.floor(Number(n) || 0)); this.commitState(); },
    setCounterSuffix(objId, s) { const o = this.objectById(objId); if (!o) return; o.suffix = String(s ?? ''); this.commitState(); },
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/web && npx vitest run tests/components/text-math-animations.test.js -t "counter actions"`
Expected: PASS.

- [ ] **Step 5: Add the PropertiesPanel controls**

In `PropertiesPanel.vue`, when the selected object is a `counter`, render number inputs for `value`, `numDecimals`, and a text input for `suffix`, wired to the three setters. Follow the panel's existing per-type control idiom (e.g. how `text` shows `content`/`fontSize`).

- [ ] **Step 6: Add the AnimationPanel count controls + button**

In `AnimationPanel.vue` (and wherever animation-creation buttons live, e.g. a "Count" button enabled when a single `counter` is selected), call `store.createCount()`. When a `count` clip is selected, show `from` / `to` / `duration` number inputs writing to the clip (mirror how other clips' params are edited; wrap mutations so they `commitState()` — use existing clip-param edit helpers).

- [ ] **Step 7: Manual check + commit**

Add a Counter, set value/decimals/suffix in the inspector; add a Count animation, set from/to; export and confirm Python.

```bash
git add services/web/src/store/project.js services/web/src/components/inspector/PropertiesPanel.vue services/web/src/components/inspector/AnimationPanel.vue services/web/tests/components/text-math-animations.test.js
git commit -m "feat(text-anim): counter inspector controls + count clip editor"
```

---

## Task 10: Parity invariants + docs

**Files:**
- Modify: `services/web/tests/components/text-math-animations.test.js` (parity block)
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Add a parity test**

`codegen.js` can't be imported in Vitest, so assert parity the way `manim-export.test.js` does — snapshot the manim.js output strings for each new construct and assert the exact expected Python (so any future drift in either file is caught against this fixed string):

```js
describe('parity / byte-stable strings', () => {
  it('counter construction string is stable', () => {
    const c = store.addObject('counter', 960, 540);
    c.value = 0; c.numDecimals = 0; c.suffix = '';
    const py = generateManimCode(store.project);
    expect(py).toContain('DecimalNumber(0, num_decimal_places=0)');
  });
  it('count block string is stable', () => {
    const c = store.addObject('counter', 960, 540);
    c.enterTime = 0; c.duration = 5;
    store.addClip(0, { type: 'count', objectId: c.id, from: 0, to: 100, startTime: 0, duration: 2, easing: 'linear' });
    const py = generateManimCode(store.project);
    expect(py).toMatch(/_count_\w+ = ValueTracker\(0\)/);
    expect(py).toContain('.add_updater(lambda m: m.set_value(');
  });
});
```

Open `tests/components/manim-export.test.js` and add the same constructs to its existing invariant list if that is where the project centralizes byte-stability (follow its structure; it is the canonical guard named in CLAUDE.md).

- [ ] **Step 2: Run the full suite**

Run: `cd services/web && npm run test:unit && npm test`
Expected: all green.

- [ ] **Step 3: Document in CLAUDE.md**

Add a section under the Clip Types / Object Types areas:
- `count` to the clip-types list; `counter` to the 2D object-types list.
- A short "Text & Math Animations" note: `matchTerms` transform variant (`transformExpr` helper, byte-identical across both files), `counter`/`DecimalNumber` (+`unit` for suffix, prefix deferred), `count` clip ValueTracker block (multi-line parser exception), `value` keyframe arm, typewriter presets. State the accepted preview≈render divergences.

- [ ] **Step 4: Document in README.md**

Bump the version badge; add bullets under "Animation & Timeline" (tex-matching morph, animated counter, typewriter) and under shapes (Counter). Mirror the wording style of the existing emphasis-animations bullet.

- [ ] **Step 5: Commit**

```bash
git add services/web/tests/components/ CLAUDE.md README.md
git commit -m "test+docs(text-anim): parity invariants + CLAUDE.md/README for Phase 3"
```

---

## Self-Review Checklist (completed during planning)

- **Spec coverage:** Feature 1 (matchTerms) → Tasks 2–4. Feature 2 counter object → Task 5; count clip → Task 6; keyframable value → Task 7; preview → Task 8; inspector → Task 9. Feature 3 typewriter → Task 1. Parity + docs → Task 10. Suffix-yes/prefix-deferred reflected in Task 5. ✔
- **Branch base** (`feat/coord-unify-phi-projection`) called out in header. ✔
- **Preview divergences** carried into Task 10 docs. ✔
- **Open verifications flagged inline** (export names `generateManimCode`/`parseManimCode`, `clipById` getter, `addKeyframe`/`setKeyframeCodegen` signatures, parser line-cursor variable, object-map var name in manim.js) — the implementer confirms each against the real file before coding; these are the only unknowns the plan can't resolve without the full file bodies open.
```
