# Emphasis Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five transient "emphasis" clip types (Indicate, Flash, Wiggle, Circumscribe, FocusOn) to the existing clip pipeline — byte-identical codegen, full `.py` round-trip, there-and-back canvas preview, and per-type inspector controls.

**Architecture:** A single byte-identical `emphasisExpr(c, sn)` helper in both generators returns the inner Manim expression (`Indicate(m, color="#FFFF00", scale_factor=1.20)` …); the existing clip switches delegate to it. The parser reads every emitted kwarg back. Playback derives its own there-and-back pulse from raw `progress`. Circumscribe alone needs a new canvas overlay (`_emphasis`); the other four reuse the existing override mechanism.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Konva (vue-konva), Manim CE codegen (codegen.js + manim.js byte-identical), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-emphasis-animations-design.md`.

**Parity rule (codegen/parser tasks):** `services/api/src/compiler/codegen.js` and `services/web/src/export/manim.js` share no import. The `emphasisExpr` helper must be **byte-identical** between them, guarded by `manim-export.test.js`. The module-level `hex(...)` helper (returns a quoted `"#RRGGBB"` literal) is in scope in both files.

**Param defaults (one source of truth — used in `emphasisExpr`, `anim()`, parser fallbacks):**

| type | params | defaults |
|------|--------|----------|
| `indicate` | `color, scale_factor` | `#FFFF00`, `1.2` |
| `flash` | `color, flash_radius, line_length, num_lines` | `#FFFF00`, `0.3`, `0.2`, `12` |
| `wiggle` | `scale_value, rotation_angle, n_wiggles` | `1.1`, `3.6` (deg), `6` |
| `circumscribe` | `color, shape, fade_out, time_width` | `#FFFF00`, `Rectangle`, `false`, `0.3` |
| `focus_on` | `color, opacity` | `#FFFF00`, `0.2` |

---

### Task 1: Codegen — byte-identical `emphasisExpr` + clip-switch delegation

**Files:**
- Modify: `services/web/src/export/manim.js` (add module-level `emphasisExpr`; delegate in `singleClipCode` ~914 and `animExpr` ~962)
- Modify: `services/api/src/compiler/codegen.js` (add module-level `emphasisExpr`; delegate in the single switch ~939, degenerate-single switch ~1000, parallel-group `animExprs` switch ~1061)
- Test: `services/web/tests/components/emphasis-codegen.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(type, extra = {}) {
  return {
    id: 'o1', type, x: SW / 2, y: SH / 2, width: 200, height: 200,
    fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects, clips = []) {
  return {
    name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects,
    tracks: [{ id: 't1', name: 'T1', clips }], cameraTrack: [], assets: [], groups: [],
  };
}
function clip(type, params, extra = {}) {
  return { id: 'c1', type, sourceId: 'o1', startTime: 0, duration: 1, easing: 'linear', params, ...extra };
}

describe('emphasis codegen', () => {
  it('Indicate', () => {
    const s = generateManimScript(makeProject([makeObj('circle')], [clip('indicate', { color: '#FFFF00', scale_factor: 1.2 })]));
    expect(s).toMatch(/self\.play\(Indicate\(\w+, color="#FFFF00", scale_factor=1\.20\)/);
  });
  it('Flash', () => {
    const s = generateManimScript(makeProject([makeObj('circle')], [clip('flash', { color: '#FF0000', flash_radius: 0.3, line_length: 0.2, num_lines: 12 })]));
    expect(s).toMatch(/Flash\(\w+, color="#FF0000", flash_radius=0\.30, line_length=0\.20, num_lines=12\)/);
  });
  it('Wiggle', () => {
    const s = generateManimScript(makeProject([makeObj('circle')], [clip('wiggle', { scale_value: 1.1, rotation_angle: 3.6, n_wiggles: 6 })]));
    expect(s).toMatch(/Wiggle\(\w+, scale_value=1\.10, rotation_angle=3\.60 \* DEGREES, n_wiggles=6\)/);
  });
  it('Circumscribe (Rectangle, fade_out False)', () => {
    const s = generateManimScript(makeProject([makeObj('square')], [clip('circumscribe', { color: '#00FF00', shape: 'Rectangle', fade_out: false, time_width: 0.3 })]));
    expect(s).toMatch(/Circumscribe\(\w+, color="#00FF00", shape=Rectangle, fade_out=False, time_width=0\.30\)/);
  });
  it('Circumscribe (Circle, fade_out True)', () => {
    const s = generateManimScript(makeProject([makeObj('circle')], [clip('circumscribe', { color: '#00FF00', shape: 'Circle', fade_out: true, time_width: 0.5 })]));
    expect(s).toMatch(/Circumscribe\(\w+, color="#00FF00", shape=Circle, fade_out=True, time_width=0\.50\)/);
  });
  it('FocusOn', () => {
    const s = generateManimScript(makeProject([makeObj('circle')], [clip('focus_on', { color: '#FFFFFF', opacity: 0.2 })]));
    expect(s).toMatch(/FocusOn\(\w+, color="#FFFFFF", opacity=0\.20\)/);
  });
  it('parallel group uses bare exprs in AnimationGroup', () => {
    const s = generateManimScript(makeProject([makeObj('circle'), { ...makeObj('square'), id: 'o2' }], [
      clip('indicate', { color: '#FFFF00', scale_factor: 1.2 }, { id: 'c1', parallel: true }),
      clip('wiggle', { scale_value: 1.1, rotation_angle: 3.6, n_wiggles: 6 }, { id: 'c2', sourceId: 'o2', parallel: true }),
    ]));
    expect(s).toMatch(/self\.play\(AnimationGroup\(Indicate\([^)]*\), Wiggle\([^)]*\)\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/emphasis-codegen.test.js`
Expected: FAIL (no `Indicate`/`Flash`/… emitted; emphasis clips currently hit `default: return null`).

- [ ] **Step 3: Add the byte-identical `emphasisExpr` helper to BOTH files**

In `services/web/src/export/manim.js`, add at module level (next to other helpers like `gradientLine`, before the generator function that contains `singleClipCode`):

```js
/** Inner Manim expression for an emphasis clip (Indicate/Flash/Wiggle/Circumscribe/FocusOn), or null. */
function emphasisExpr(c, sn) {
  const p = c.params || {};
  const col = hex(p.color || '#FFFF00');
  switch (c.type) {
    case 'indicate':
      return `Indicate(${sn}, color=${col}, scale_factor=${(p.scale_factor ?? 1.2).toFixed(2)})`;
    case 'flash':
      return `Flash(${sn}, color=${col}, flash_radius=${(p.flash_radius ?? 0.3).toFixed(2)}, line_length=${(p.line_length ?? 0.2).toFixed(2)}, num_lines=${p.num_lines ?? 12})`;
    case 'wiggle':
      return `Wiggle(${sn}, scale_value=${(p.scale_value ?? 1.1).toFixed(2)}, rotation_angle=${(p.rotation_angle ?? 3.6).toFixed(2)} * DEGREES, n_wiggles=${p.n_wiggles ?? 6})`;
    case 'circumscribe': {
      const shape = p.shape === 'Circle' ? 'Circle' : 'Rectangle';
      const fade = p.fade_out ? 'True' : 'False';
      return `Circumscribe(${sn}, color=${col}, shape=${shape}, fade_out=${fade}, time_width=${(p.time_width ?? 0.3).toFixed(2)})`;
    }
    case 'focus_on':
      return `FocusOn(${sn}, color=${col}, opacity=${(p.opacity ?? 0.2).toFixed(2)})`;
    default:
      return null;
  }
}
```

Add the **identical** function to `services/api/src/compiler/codegen.js` at module level (next to its other helpers, before the script-generation function). Verify `hex` is module-level in each file (it is — used by `objCode`/`objectCode`).

- [ ] **Step 4: Delegate in `manim.js` `singleClipCode` and `animExpr`**

In `singleClipCode` (~914), add these cases just before `default: return null;`:
```js
      case 'indicate':
      case 'flash':
      case 'wiggle':
      case 'circumscribe':
      case 'focus_on': {
        const e = emphasisExpr(c, sn);
        return e ? { code: `self.play(${e}${rtStr}${rfStr})`, dur } : null;
      }
```
In `animExpr` (~962), add before `default: return null;`:
```js
      case 'indicate':
      case 'flash':
      case 'wiggle':
      case 'circumscribe':
      case 'focus_on':
        return emphasisExpr(c, sn);
```

- [ ] **Step 5: Delegate in `codegen.js` all three switches**

In codegen.js the single switch (~939) and the degenerate-single switch (~1000) both assign to a `code` variable then `break`. In EACH, add before the switch closes:
```js
        case 'indicate':
        case 'flash':
        case 'wiggle':
        case 'circumscribe':
        case 'focus_on': {
          const e = emphasisExpr(c, sn);
          if (e) code = `self.play(${e}${rtStr}${rfStr})`;
          break;
        }
```
(In the single switch the var is `sn = vn(objId)`; in the degenerate switch it is also `sn`. Confirm by reading — both use `sn`.)

In the parallel-group `animExprs` switch (~1061) which `return`s an expression, add before `default: return null;`:
```js
          case 'indicate':
          case 'flash':
          case 'wiggle':
          case 'circumscribe':
          case 'focus_on':
            return emphasisExpr(c, sn);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/emphasis-codegen.test.js` → PASS (7).
Then parity/regression: `npx vitest run tests/components/manim-export.test.js` → PASS.

- [ ] **Step 7: Parity check — `emphasisExpr` byte-identical**

Run (diff must be EMPTY):
```
cd /d/PYTHON/Manim-Editor && diff <(grep -A20 "function emphasisExpr" services/api/src/compiler/codegen.js) <(grep -A20 "function emphasisExpr" services/web/src/export/manim.js)
```

- [ ] **Step 8: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/emphasis-codegen.test.js
git commit -m "feat(emphasis): byte-identical codegen for Indicate/Flash/Wiggle/Circumscribe/FocusOn"
```

---

### Task 2: Round-trip parser — standalone + parallel-group

**Files:**
- Modify: `services/web/src/export/manim.js` (`parseClipExpr` ~1175 inner matchers; standalone `self.play(...)` matchers near the `Rotate` matcher ~1887)
- Test: extend `services/web/tests/components/emphasis-codegen.test.js`

- [ ] **Step 1: Add `parseManimScript` to the import and write failing round-trip tests**

Change the import at the top of `emphasis-codegen.test.js` to:
```js
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';
```
Append:
```js
describe('emphasis round-trip', () => {
  function rt(type, params, objType = 'circle') {
    const proj = makeProject([makeObj(objType)], [clip(type, params)]);
    return parseManimScript(generateManimScript(proj), SW, SH).tracks[0].clips[0];
  }
  it('round-trips Indicate', () => {
    const c = rt('indicate', { color: '#FFFF00', scale_factor: 1.5 });
    expect(c.type).toBe('indicate');
    expect(c.params.color.toUpperCase()).toBe('#FFFF00');
    expect(c.params.scale_factor).toBeCloseTo(1.5, 2);
  });
  it('round-trips Flash', () => {
    const c = rt('flash', { color: '#FF0000', flash_radius: 0.4, line_length: 0.25, num_lines: 10 });
    expect(c.type).toBe('flash');
    expect(c.params.flash_radius).toBeCloseTo(0.4, 2);
    expect(c.params.line_length).toBeCloseTo(0.25, 2);
    expect(c.params.num_lines).toBe(10);
  });
  it('round-trips Wiggle (rotation_angle in deg)', () => {
    const c = rt('wiggle', { scale_value: 1.2, rotation_angle: 5, n_wiggles: 8 });
    expect(c.type).toBe('wiggle');
    expect(c.params.scale_value).toBeCloseTo(1.2, 2);
    expect(c.params.rotation_angle).toBeCloseTo(5, 2);
    expect(c.params.n_wiggles).toBe(8);
  });
  it('round-trips Circumscribe', () => {
    const c = rt('circumscribe', { color: '#00FF00', shape: 'Circle', fade_out: true, time_width: 0.5 }, 'square');
    expect(c.type).toBe('circumscribe');
    expect(c.params.shape).toBe('Circle');
    expect(c.params.fade_out).toBe(true);
    expect(c.params.time_width).toBeCloseTo(0.5, 2);
  });
  it('round-trips FocusOn', () => {
    const c = rt('focus_on', { color: '#FFFFFF', opacity: 0.3 });
    expect(c.type).toBe('focus_on');
    expect(c.params.opacity).toBeCloseTo(0.3, 2);
  });
  it('round-trips a parallel Indicate+Wiggle group', () => {
    const proj = makeProject([makeObj('circle'), { ...makeObj('square'), id: 'o2' }], [
      clip('indicate', { color: '#FFFF00', scale_factor: 1.2 }, { id: 'c1', parallel: true }),
      clip('wiggle', { scale_value: 1.1, rotation_angle: 3.6, n_wiggles: 6 }, { id: 'c2', sourceId: 'o2', parallel: true }),
    ]);
    const cs = parseManimScript(generateManimScript(proj), SW, SH).tracks[0].clips;
    const types = cs.map(c => c.type).sort();
    expect(types).toEqual(['indicate', 'wiggle']);
    expect(cs.every(c => c.parallel)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd services/web && npx vitest run tests/components/emphasis-codegen.test.js`
Expected: the `emphasis round-trip` tests FAIL.

- [ ] **Step 3: Add inner matchers to `parseClipExpr` (~1175, before its final `return null;`)**

These parse the bare expression (used inside parallel groups). `varMap` maps var→id.
```js
    // Indicate(obj, color="#hex", scale_factor=f)
    m2 = expr.match(/^Indicate\((\w+),\s*color="([^"]+)",\s*scale_factor=([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'indicate', sourceId: id, params: { color: m2[2], scale_factor: parseFloat(m2[3]) } };
    }
    // Flash(obj, color=, flash_radius=, line_length=, num_lines=)
    m2 = expr.match(/^Flash\((\w+),\s*color="([^"]+)",\s*flash_radius=([\d.]+),\s*line_length=([\d.]+),\s*num_lines=(\d+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'flash', sourceId: id, params: { color: m2[2], flash_radius: parseFloat(m2[3]), line_length: parseFloat(m2[4]), num_lines: parseInt(m2[5], 10) } };
    }
    // Wiggle(obj, scale_value=, rotation_angle=d * DEGREES, n_wiggles=)
    m2 = expr.match(/^Wiggle\((\w+),\s*scale_value=([\d.]+),\s*rotation_angle=([\d.]+) \* DEGREES,\s*n_wiggles=(\d+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'wiggle', sourceId: id, params: { scale_value: parseFloat(m2[2]), rotation_angle: parseFloat(m2[3]), n_wiggles: parseInt(m2[4], 10) } };
    }
    // Circumscribe(obj, color=, shape=Class, fade_out=Bool, time_width=)
    m2 = expr.match(/^Circumscribe\((\w+),\s*color="([^"]+)",\s*shape=(Rectangle|Circle),\s*fade_out=(True|False),\s*time_width=([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'circumscribe', sourceId: id, params: { color: m2[2], shape: m2[3], fade_out: m2[4] === 'True', time_width: parseFloat(m2[5]) } };
    }
    // FocusOn(obj, color=, opacity=)
    m2 = expr.match(/^FocusOn\((\w+),\s*color="([^"]+)",\s*opacity=([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'focus_on', sourceId: id, params: { color: m2[2], opacity: parseFloat(m2[3]) } };
    }
```

- [ ] **Step 4: Add standalone line matchers (near the `self.play(Rotate(...))` matcher ~1887)**

Each wraps the same inner pattern in `self.play(...)` with an optional `run_time`. Place these among the other standalone `self.play` matchers. `ct` is the running start-time counter; `clipIdx` the id counter.
```js
    m = line.match(/^self\.play\(Indicate\((\w+),\s*color="([^"]+)",\s*scale_factor=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[4] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'indicate', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { color: m[2], scale_factor: parseFloat(m[3]) } });
        ct += dur;
      }
      continue;
    }
    m = line.match(/^self\.play\(Flash\((\w+),\s*color="([^"]+)",\s*flash_radius=([\d.]+),\s*line_length=([\d.]+),\s*num_lines=(\d+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[6] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'flash', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { color: m[2], flash_radius: parseFloat(m[3]), line_length: parseFloat(m[4]), num_lines: parseInt(m[5], 10) } });
        ct += dur;
      }
      continue;
    }
    m = line.match(/^self\.play\(Wiggle\((\w+),\s*scale_value=([\d.]+),\s*rotation_angle=([\d.]+) \* DEGREES,\s*n_wiggles=(\d+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[5] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'wiggle', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { scale_value: parseFloat(m[2]), rotation_angle: parseFloat(m[3]), n_wiggles: parseInt(m[4], 10) } });
        ct += dur;
      }
      continue;
    }
    m = line.match(/^self\.play\(Circumscribe\((\w+),\s*color="([^"]+)",\s*shape=(Rectangle|Circle),\s*fade_out=(True|False),\s*time_width=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[6] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'circumscribe', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { color: m[2], shape: m[3], fade_out: m[4] === 'True', time_width: parseFloat(m[5]) } });
        ct += dur;
      }
      continue;
    }
    m = line.match(/^self\.play\(FocusOn\((\w+),\s*color="([^"]+)",\s*opacity=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[4] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'focus_on', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { color: m[2], opacity: parseFloat(m[3]) } });
        ct += dur;
      }
      continue;
    }
```

> Confirm `varMap`/`clips`/`clipIdx`/`ct` are the in-scope names (they are, per the existing `Rotate`/`scale` standalone matchers). Place these BEFORE any broad fallback matcher.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/web && npx vitest run tests/components/emphasis-codegen.test.js` → PASS (13).
Then: `npx vitest run tests/components/manim-export.test.js` → PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add services/web/src/export/manim.js services/web/tests/components/emphasis-codegen.test.js
git commit -m "feat(emphasis): full round-trip parser (standalone + parallel group)"
```

---

### Task 3: Playback — there-and-back `_evaluateClip` cases

**Files:**
- Modify: `services/web/src/engine/playback.js` (`_evaluateClip` switch ~517; `interpolateColor` is already imported at line 11)
- Test: `services/web/tests/components/emphasis-playback.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { PlaybackEngine } from '../../src/engine/playback.js';

let store, engine, objId;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
  store.addObject('circle', 960, 540);
  objId = store.project.objects[0].id;
  engine = new PlaybackEngine(store);
});

function overridesAt(clip, t) {
  const objectMap = new Map(store.project.objects.map(o => [o.id, o]));
  const r = engine._evaluateClip(clip, t, objectMap);
  return r ? r.overrides : null;
}

describe('emphasis playback', () => {
  it('Indicate peaks at mid and returns to base', () => {
    const c = { id: 'c1', type: 'indicate', sourceId: objId, startTime: 0, duration: 1, easing: 'linear', params: { color: '#FFFF00', scale_factor: 1.4 } };
    const mid = overridesAt(c, 0.5);
    expect(mid.scaleX).toBeCloseTo(1.4, 1);
    const start = overridesAt(c, 0.001);
    expect(start.scaleX).toBeCloseTo(1.0, 1);
  });
  it('Wiggle rotation oscillates (sign flips across the period)', () => {
    const c = { id: 'c2', type: 'wiggle', sourceId: objId, startTime: 0, duration: 1, easing: 'linear', params: { scale_value: 1.1, rotation_angle: 10, n_wiggles: 2 } };
    const base = store.project.objects[0].rotation || 0;
    const a = overridesAt(c, 0.125).rotation - base;  // first quarter of first wiggle → positive
    const b = overridesAt(c, 0.375).rotation - base;  // third quarter → negative
    expect(Math.sign(a)).not.toBe(Math.sign(b));
  });
  it('Circumscribe sets an _emphasis overlay descriptor', () => {
    const c = { id: 'c3', type: 'circumscribe', sourceId: objId, startTime: 0, duration: 1, easing: 'linear', params: { color: '#00FF00', shape: 'Rectangle', fade_out: false, time_width: 0.3 } };
    const ov = overridesAt(c, 0.5);
    expect(ov._emphasis).toBeTruthy();
    expect(ov._emphasis.kind).toBe('circumscribe');
    expect(ov._emphasis.shape).toBe('Rectangle');
    expect(ov._emphasis.progress).toBeCloseTo(0.5, 1);
  });
});
```

> Verify the engine class export name by reading the top/bottom of `playback.js` (it may be `PlaybackEngine` or a default export). If different, adjust the import. If `_evaluateClip` requires the engine to hold the store differently, mirror how existing playback tests construct it (check `tests/` for an existing playback/engine test and copy its setup).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/emphasis-playback.test.js`
Expected: FAIL (emphasis types produce empty overrides).

- [ ] **Step 3: Add the five cases to `_evaluateClip` (before the switch's closing brace, after `case 'path_move'`)**

`progress` and `sourceObj` are already in scope above the switch (raw clip progress 0→1). Emphasis ignores `easedT` and uses `progress` directly.
```js
      case 'indicate': {
        const params = clip.params || {};
        const pulse = 1 - Math.abs(2 * progress - 1);            // triangle, peak at mid
        const sf = params.scale_factor !== undefined ? params.scale_factor : 1.2;
        overrides.scaleX = lerp(1, sf, pulse);
        overrides.scaleY = lerp(1, sf, pulse);
        overrides.fill = interpolateColor(sourceObj.fill || '#ffffff', params.color || '#FFFF00', pulse);
        break;
      }
      case 'wiggle': {
        const params = clip.params || {};
        const nW = params.n_wiggles !== undefined ? params.n_wiggles : 6;
        const ang = params.rotation_angle !== undefined ? params.rotation_angle : 3.6;  // deg
        const sv = params.scale_value !== undefined ? params.scale_value : 1.1;
        const osc = Math.sin(2 * Math.PI * nW * progress);
        overrides.rotation = (sourceObj.rotation || 0) + osc * ang;
        overrides.scaleX = 1 + osc * (sv - 1);
        overrides.scaleY = 1 + osc * (sv - 1);
        break;
      }
      case 'flash': {
        const params = clip.params || {};
        const pulse = Math.sin(Math.PI * progress);             // up then back, peak at mid
        overrides.fill = interpolateColor(sourceObj.fill || '#ffffff', params.color || '#FFFF00', pulse);
        break;
      }
      case 'focus_on': {
        const params = clip.params || {};
        const pulse = Math.sin(Math.PI * progress);
        overrides.fill = interpolateColor(sourceObj.fill || '#ffffff', params.color || '#FFFF00', pulse * 0.6);
        break;
      }
      case 'circumscribe': {
        const params = clip.params || {};
        overrides._emphasis = {
          kind: 'circumscribe',
          shape: params.shape === 'Circle' ? 'Circle' : 'Rectangle',
          color: params.color || '#FFFF00',
          fadeOut: !!params.fade_out,
          progress,
        };
        break;
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/emphasis-playback.test.js` → PASS (3).
Then: `npm test` (engine suite) → PASS (114).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/engine/playback.js services/web/tests/components/emphasis-playback.test.js
git commit -m "feat(emphasis): there-and-back playback overrides + _emphasis descriptor"
```

---

### Task 4: StageCanvas — Circumscribe overlay preview

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue` (add an `emphasisOverlays` computed + render it; `frameState`/`eff`/`s2c`/`vs` already in scope ~322/630)
- Test: manual (Konva); covered by build + full suite.

- [ ] **Step 1: Add an `emphasisOverlays` computed**

After the `eff(obj)` function (~633), add a computed that scans active overrides for `_emphasis` and produces Konva overlay configs around each object's bounding box. Read how an object's on-canvas center/size is computed elsewhere in this file (the per-shape `cfg` builders use `s2c(...)` for position and the object's `width`/`height`); mirror that to get screen-space center + half-extents. Use this implementation:
```js
const emphasisOverlays = computed(() => {
  const out = [];
  const ovMap = frameState.value.objectOverrides || {};
  for (const obj of objects.value) {
    const ov = ovMap[obj.id];
    const e = ov && ov._emphasis;
    if (!e || e.kind !== 'circumscribe') continue;
    const m = eff(obj);                                  // merged position/size
    const c = s2c(m.x, m.y);                             // screen-space center
    const w = (m.width || 100) * 1.25 * vs.value;
    const h = (m.height || 100) * 1.25 * vs.value;
    // opacity: ramp in over first half; if fadeOut, ramp back out over second half
    const p = e.progress;
    const op = e.fadeOut ? Math.sin(Math.PI * p) : Math.min(1, p * 2);
    const base = { stroke: e.color, strokeWidth: 3, opacity: Math.max(0, op), listening: false, id: obj.id + '-emph' };
    if (e.shape === 'Circle') {
      out.push({ ...base, kind: 'ellipse', x: c.x, y: c.y, radiusX: w / 2, radiusY: h / 2 });
    } else {
      out.push({ ...base, kind: 'rect', x: c.x - w / 2, y: c.y - h / 2, width: w, height: h });
    }
  }
  return out;
});
```
> Confirm `objects` (the rendered object list computed), `s2c`, `vs`, `eff`, `frameState` are the in-scope names (they are — `s2c` at ~628, `eff` ~630, `vs`/`frameState` used throughout). If `s2c`'s argument order or return differs, mirror an existing call site.

- [ ] **Step 2: Render the overlays in the template**

Find the main 2D Konva layer (where shapes are drawn, e.g. a `<v-layer>` containing the per-object shapes). Add, near the end of that layer (so overlays draw on top):
```html
        <template v-for="o in emphasisOverlays" :key="o.id">
          <v-rect v-if="o.kind === 'rect'" :config="o" />
          <v-ellipse v-else :config="o" />
        </template>
```
> Vue 3 requires the `:key` on the `<template>` tag (per CLAUDE.md build gotcha). Confirm `v-rect`/`v-ellipse` are the registered vue-konva tags used elsewhere in this file; if the file uses `<v-ellipse>` already (it renders `ellipse` objects) reuse that exact tag name.

- [ ] **Step 3: Verify build + suite**

Run: `cd services/web && npm run build` → succeeds (watch for `<template v-for>` key errors).
Run: `cd services/web && npm run test:unit` → all pass.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(emphasis): Circumscribe overlay canvas preview"
```

---

### Task 5: Inspector — Emphasis buttons + per-type param sections

**Files:**
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (add buttons after the rotate button ~495; add `anim()` defaults ~892; add per-type clip param `<Section>`s after the rotate section ~569)
- Test: `services/web/tests/components/emphasis-panel.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('emphasis inspector', () => {
  it('shows an Indicate button for a selected object and clicking creates an indicate clip', async () => {
    store.addObject('circle', 960, 540);
    const id = store.project.objects[0].id;
    store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    const btn = wrapper.find('[data-test="anim-indicate"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    const clip = store.project.tracks.flatMap(t => t.clips).find(c => c.type === 'indicate');
    expect(clip).toBeTruthy();
    expect(clip.params.scale_factor).toBe(1.2);
    expect(clip.params.color).toBe('#FFFF00');
  });

  it('shows the scale_factor control for a selected indicate clip', () => {
    store.addObject('circle', 960, 540);
    store.selectObject(store.project.objects[0].id);
    store.createAnimation('indicate', { color: '#FFFF00', scale_factor: 1.2 });
    const clipId = store.project.tracks.flatMap(t => t.clips)[0].id;
    store.selectedClipId = clipId;
    const wrapper = mount(PropertiesPanel);
    expect(wrapper.find('[data-test="emph-scale-factor"]').exists()).toBe(true);
  });
});
```
> Confirm the object-selection call (`store.selectObject(id)`) and that selecting a clip is `store.selectedClipId = id` by reading an existing PropertiesPanel test that selects a clip. Mirror whatever it does.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/emphasis-panel.test.js`
Expected: FAIL (no `anim-indicate` button).

- [ ] **Step 3: Add the Emphasis button sub-group**

After the rotate button block (~493-495, inside the `Add Motion` Section's grid `</div>` — add a NEW labeled sub-group right after that grid closes). Insert:
```html
        <p class="text-[8px] text-studio-text-muted/50 mb-1.5 mt-2">Emphasis (transient)</p>
        <div class="grid grid-cols-2 gap-1">
          <button data-test="anim-indicate" class="anim-btn" @click="anim('indicate')">Indicate</button>
          <button data-test="anim-flash" class="anim-btn" @click="anim('flash')">Flash</button>
          <button data-test="anim-wiggle" class="anim-btn" @click="anim('wiggle')">Wiggle</button>
          <button data-test="anim-circumscribe" class="anim-btn" @click="anim('circumscribe')">Circumscribe</button>
          <button data-test="anim-focus_on" class="anim-btn" @click="anim('focus_on')">Focus On</button>
        </div>
```
(Place it just before the `Add Motion` `</Section>` close. Confirm the surrounding tag names by reading ~478-500.)

- [ ] **Step 4: Add `anim()` defaults**

In `anim(type)` (~892), add before `store.createAnimation(type, p);`:
```js
  if (type === 'indicate') { p.color = '#FFFF00'; p.scale_factor = 1.2; }
  if (type === 'flash') { p.color = '#FFFF00'; p.flash_radius = 0.3; p.line_length = 0.2; p.num_lines = 12; }
  if (type === 'wiggle') { p.scale_value = 1.1; p.rotation_angle = 3.6; p.n_wiggles = 6; }
  if (type === 'circumscribe') { p.color = '#FFFF00'; p.shape = 'Rectangle'; p.fade_out = false; p.time_width = 0.3; }
  if (type === 'focus_on') { p.color = '#FFFFFF'; p.opacity = 0.2; }
```

- [ ] **Step 5: Add per-type clip param `<Section>`s**

After the rotate clip Section (~567-569), add (mirroring the existing `Num`/`up()` pattern; color via a native color input):
```html
      <Section v-if="clip.type === 'indicate'" label="Indicate">
        <div class="space-y-1.5">
          <input type="color" class="w-full h-7 rounded" :value="(clip.params||{}).color || '#FFFF00'" @input="up('color', $event.target.value)" />
          <Num data-test="emph-scale-factor" label="Scale factor" :value="(clip.params||{}).scale_factor||1.2" :step="0.1" @input="up('scale_factor', $event)" />
        </div>
      </Section>
      <Section v-if="clip.type === 'flash'" label="Flash">
        <div class="space-y-1.5">
          <input type="color" class="w-full h-7 rounded" :value="(clip.params||{}).color || '#FFFF00'" @input="up('color', $event.target.value)" />
          <Num label="Flash radius" :value="(clip.params||{}).flash_radius||0.3" :step="0.05" @input="up('flash_radius', $event)" />
          <Num label="Line length" :value="(clip.params||{}).line_length||0.2" :step="0.05" @input="up('line_length', $event)" />
          <Num label="Num lines" :value="(clip.params||{}).num_lines||12" :step="1" @input="up('num_lines', $event)" />
        </div>
      </Section>
      <Section v-if="clip.type === 'wiggle'" label="Wiggle">
        <div class="space-y-1.5">
          <Num label="Scale value" :value="(clip.params||{}).scale_value||1.1" :step="0.05" @input="up('scale_value', $event)" />
          <Num label="Rotation angle (deg)" :value="(clip.params||{}).rotation_angle||3.6" :step="0.5" @input="up('rotation_angle', $event)" />
          <Num label="Num wiggles" :value="(clip.params||{}).n_wiggles||6" :step="1" @input="up('n_wiggles', $event)" />
        </div>
      </Section>
      <Section v-if="clip.type === 'circumscribe'" label="Circumscribe">
        <div class="space-y-1.5">
          <input type="color" class="w-full h-7 rounded" :value="(clip.params||{}).color || '#FFFF00'" @input="up('color', $event.target.value)" />
          <select class="select text-sm w-full" :value="(clip.params||{}).shape || 'Rectangle'" @change="up('shape', $event.target.value)">
            <option value="Rectangle">Rectangle</option>
            <option value="Circle">Circle</option>
          </select>
          <label class="flex items-center gap-2 text-xs text-studio-text-muted cursor-pointer">
            <input type="checkbox" :checked="(clip.params||{}).fade_out" @change="up('fade_out', $event.target.checked)" />
            Fade out
          </label>
          <Num label="Time width" :value="(clip.params||{}).time_width||0.3" :step="0.05" @input="up('time_width', $event)" />
        </div>
      </Section>
      <Section v-if="clip.type === 'focus_on'" label="Focus On">
        <div class="space-y-1.5">
          <input type="color" class="w-full h-7 rounded" :value="(clip.params||{}).color || '#FFFFFF'" @input="up('color', $event.target.value)" />
          <Num label="Dim opacity" :value="(clip.params||{}).opacity||0.2" :step="0.05" @input="up('opacity', $event)" />
        </div>
      </Section>
```
> Confirm `Num`, `Section`, `up`, `clip` are the in-scope names (they are — used by the move/scale/fade/rotate sections directly above). `up()` writes into `clip.params`.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/emphasis-panel.test.js` → PASS (2).
Then `npm run build` → compiles. Then `npm run test:unit` → all pass.

- [ ] **Step 7: Commit**

```bash
git add services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/emphasis-panel.test.js
git commit -m "feat(emphasis): inspector buttons + per-type param sections"
```

---

### Task 6: Verification, docs, and parity audit

**Files:**
- Modify: `CLAUDE.md` (Clip Types section + a new emphasis note)
- Modify: `README.md` (Features bullet + changelog v3.11.0 + version badge + test count)

- [ ] **Step 1: Run the entire unit suite**

Run: `cd services/web && npm run test:unit`
Expected: PASS.

- [ ] **Step 2: Run engine tests**

Run: `cd services/web && npm test`
Expected: PASS (114 engine).

- [ ] **Step 3: Parity audit**

Diff `emphasisExpr` between the two generators (must be byte-identical):
```
cd /d/PYTHON/Manim-Editor && diff <(grep -A20 "function emphasisExpr" services/api/src/compiler/codegen.js) <(grep -A20 "function emphasisExpr" services/web/src/export/manim.js)
```
Run `cd services/web && npx vitest run tests/components/manim-export.test.js` → PASS.

- [ ] **Step 4: Update CLAUDE.md**

In the "## Clip Types" section, add the five emphasis types to the list and a note:
> **Emphasis (transient)**: `indicate`, `flash`, `wiggle`, `circumscribe`, `focus_on` — there-and-back animations (return the object to its original state). Emitted via the byte-identical `emphasisExpr(c, sn)` helper (`Indicate`/`Flash`/`Wiggle`/`Circumscribe`/`FocusOn`); `color` via `hex()`, `rotation_angle` stored in degrees and emitted as `<deg> * DEGREES`, `shape` as a bare class (`Rectangle`/`Circle`), `fade_out` as a Python bool. Full `.py` round-trip (standalone + `parseClipExpr`). Playback derives its own pulse from raw `progress` (Indicate/Wiggle faithful; Flash/FocusOn color-pulse approximations; Circumscribe draws an `_emphasis` overlay box/ellipse in `StageCanvas`). **Keep `emphasisExpr` byte-identical across codegen.js/manim.js** — guarded by `manim-export.test.js`.

- [ ] **Step 5: Update README.md**

- Bump the version badge `3.10.0` → `3.11.0`.
- Add an animation/emphasis Features bullet (the five emphasis clip types render in Manim and round-trip through `.py`).
- Add a `### v3.11.0 (current)` changelog entry (emphasis animations; Indicate/Wiggle faithful preview, Flash/FocusOn/Circumscribe approximations, render exact); demote `### v3.10.0 (current)` to `### v3.10.0`. Update the `test:unit` count comment to the new total.

- [ ] **Step 6: Commit docs**

```bash
git add CLAUDE.md README.md
git commit -m "docs(emphasis): document emphasis animations (v3.11.0)"
```

- [ ] **Step 7: Final review handoff**

All tasks complete. Use superpowers:finishing-a-development-branch to merge `feat/emphasis-animations` back to `main` (Option 1) and push.

---

## Self-Review

**Spec coverage:**
- 5 clip types + full param sets → Task 1 (codegen), Task 5 (inspector defaults/sections). ✓
- Byte-identical `emphasisExpr`, 3 codegen.js switches + 2 manim.js helpers → Task 1. ✓
- Full round-trip (standalone + parallel `parseClipExpr`) → Task 2. ✓
- There-and-back playback, Indicate/Wiggle faithful, Flash/FocusOn approx, Circumscribe `_emphasis` → Task 3. ✓
- Circumscribe overlay box/ellipse in StageCanvas → Task 4. ✓
- Inspector Emphasis buttons + per-type sections + `anim()` defaults → Task 5. ✓
- `color` via `hex()`, `rotation_angle` deg→`* DEGREES`, `shape` bare class, `fade_out` bool → Task 1 (`emphasisExpr`) + Task 2 (parser inverse). ✓
- `interpolateColor` reused (no new lerpHex) → Task 3 (already imported). ✓
- Docs (CLAUDE.md clip types, README v3.11.0) → Task 6. ✓

**Type consistency:** param keys (`scale_factor`, `flash_radius`, `line_length`, `num_lines`, `scale_value`, `rotation_angle`, `n_wiggles`, `shape`, `fade_out`, `time_width`, `opacity`, `color`) identical across codegen (`emphasisExpr` T1), parser (T2), playback (T3), inspector defaults + sections (T5). `_emphasis` descriptor shape `{kind, shape, color, fadeOut, progress}` identical between T3 (writer) and T4 (reader). Type strings (`indicate`/`flash`/`wiggle`/`circumscribe`/`focus_on`) identical everywhere.

**Placeholder scan:** No TBD/TODO; every code step shows full code. Tasks 3/4/5 flag the in-scope-name confirmations (engine export, `objects`/`s2c`/`vs`, `selectedClipId`, `Num`/`Section`) explicitly so the implementer verifies against the real file rather than guessing.
