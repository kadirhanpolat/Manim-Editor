# 2D Object Enrichment (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add gradient fill, rounded corners, separate fill/stroke opacity, and dashed stroke to 2D objects — editable in the inspector, previewed on the Konva canvas, and emitted to / parsed from Manim Python.

**Architecture:** New optional object fields (`gradient`, `cornerRadius`, `fillOpacity`, `strokeOpacity`, `dash`) default to absent ⇒ today's output is byte-identical. The two code generators (`codegen.js` server, `manim.js` client) emit identical Python via small shared-by-convention helpers; `manim.js` also parses the new constructs back. The Konva preview honors all four via shape-config helpers. The inspector gains an "Effects" section.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Konva.js, Vitest, Node.js codegen, Manim CE Python.

**Spec:** `docs/superpowers/specs/2026-06-05-2d-object-enrichment-design.md`
**Branch:** `feat/2d-object-enrichment` (based on `feat/coord-unify-phi-projection`, which has the `FRAME_WIDTH` constants).

**Run tests with:**
```bash
cd services/web && npm run test:unit   # Vitest (store, components, export) — this plan's tests live here
cd services/web && npm test            # Node engine tests — must stay green, untouched
```

---

## Reference: field shapes (used throughout)

```js
obj.gradient      = { colors: ['#f472b6', '#8b5cf6'], angle: 135 }  // absent = flat
obj.cornerRadius  = 24            // project px; 0/absent = sharp (rectangle/square only)
obj.fillOpacity   = 0.35          // 0–1, default 1
obj.strokeOpacity = 1             // 0–1, default 1
obj.dash          = { numDashes: 12, ratio: 0.5 }   // absent = solid
```

---

## Task 1: Store actions (`setGradient`, `setCornerRadius`, `setDash`)

`updateObject` (project.js:359) merges keys and cannot delete fields. Toggling an effect OFF must delete its field so re-render stays byte-identical, so we add three delete-capable actions. `fillOpacity`/`strokeOpacity` are plain numbers (default 1 reproduces current output) and keep using the existing `updateObject`.

**Files:**
- Modify: `services/web/src/store/project.js` (add actions after `updateObject`, around line 367)
- Test: `services/web/tests/components/store-effects.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/store-effects.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.addObject('rectangle', 960, 540);
  id = store.project.objects[0].id;
  store.commitState();
});

describe('effect store actions', () => {
  it('setGradient sets and clears the field', () => {
    store.setGradient(id, { colors: ['#ff0000', '#00ff00'], angle: 90 });
    expect(store.objectById(id).gradient).toEqual({ colors: ['#ff0000', '#00ff00'], angle: 90 });
    store.setGradient(id, null);
    expect('gradient' in store.objectById(id)).toBe(false);
  });

  it('setCornerRadius sets a positive value and deletes on 0', () => {
    store.setCornerRadius(id, 24);
    expect(store.objectById(id).cornerRadius).toBe(24);
    store.setCornerRadius(id, 0);
    expect('cornerRadius' in store.objectById(id)).toBe(false);
  });

  it('setDash sets and clears, clamping ratio to [0,1]', () => {
    store.setDash(id, { numDashes: 12, ratio: 1.8 });
    expect(store.objectById(id).dash).toEqual({ numDashes: 12, ratio: 1 });
    store.setDash(id, null);
    expect('dash' in store.objectById(id)).toBe(false);
  });

  it('marks the project dirty', () => {
    store.isDirty = false;
    store.setGradient(id, { colors: ['#ff0000', '#00ff00'], angle: 90 });
    expect(store.isDirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/store-effects.test.js`
Expected: FAIL — `store.setGradient is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `services/web/src/store/project.js`, immediately after the `updateObject` action (after line 367, before `deleteObject`), add:

```js
    setGradient(id, gradient) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      if (gradient && Array.isArray(gradient.colors) && gradient.colors.length >= 2) {
        obj.gradient = { colors: [...gradient.colors], angle: gradient.angle ?? 135 };
      } else {
        delete obj.gradient;
      }
      this.isDirty = true;
      this._debouncedCommit();
    },

    setCornerRadius(id, px) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      const r = Number(px);
      if (Number.isFinite(r) && r > 0) obj.cornerRadius = r;
      else delete obj.cornerRadius;
      this.isDirty = true;
      this._debouncedCommit();
    },

    setDash(id, dash) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      if (dash) {
        const numDashes = Math.max(2, Math.round(Number(dash.numDashes) || 12));
        const ratio = Math.max(0, Math.min(1, Number(dash.ratio ?? 0.5)));
        obj.dash = { numDashes, ratio };
      } else {
        delete obj.dash;
      }
      this.isDirty = true;
      this._debouncedCommit();
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/store-effects.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/store/project.js services/web/tests/components/store-effects.test.js
git commit -m "feat(store): gradient / cornerRadius / dash object actions"
```

---

## Task 2: `manim.js` generator — emit the four effects

Add shared style helpers and route emission through them. Backward compatibility is mandatory: an object with none of the new fields must produce byte-identical Python.

**Files:**
- Modify: `services/web/src/export/manim.js` (helpers near top of file ~line 85; `objectCode` ~lines 179–260)
- Test: `services/web/tests/components/effects-codegen.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/effects-codegen.test.js`:

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
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000',
    objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}
const script = (o) => generateManimScript(makeProject([o]));

describe('effects codegen (manim.js)', () => {
  it('backward compatible: plain rectangle has no effect calls', () => {
    const s = script(makeObj('rectangle'));
    expect(s).toContain('Rectangle(width=');
    expect(s).not.toContain('RoundedRectangle');
    expect(s).not.toContain('set_color_by_gradient');
    expect(s).not.toContain('DashedVMobject');
    expect(s).toContain('.set_fill(color="#3b82f6", opacity=1)');
    expect(s).toContain('.set_stroke(color="#ffffff", width=2)');
  });

  it('gradient emits set_color_by_gradient after set_fill', () => {
    const s = script(makeObj('circle', { gradient: { colors: ['#ff0000', '#00ff00'], angle: 90 } }));
    expect(s).toContain('.set_color_by_gradient("#ff0000", "#00ff00")');
  });

  it('rounded corners emit RoundedRectangle for rectangle', () => {
    const s = script(makeObj('rectangle', { cornerRadius: 48 }));
    expect(s).toMatch(/= RoundedRectangle\(corner_radius=[\d.]+, width=[\d.]+, height=[\d.]+\)/);
    expect(s).not.toContain('= Rectangle(width=');
  });

  it('fill/stroke opacity multiply the master opacity', () => {
    const s = script(makeObj('square', { opacity: 0.8, fillOpacity: 0.5, strokeOpacity: 0.25 }));
    expect(s).toContain('.set_fill(color="#3b82f6", opacity=0.4)');     // 0.8 * 0.5
    expect(s).toContain('.set_stroke(color="#ffffff", width=2, opacity=0.2)'); // 0.8 * 0.25
  });

  it('dashed wraps the mobject in a fill-preserving VGroup', () => {
    const s = script(makeObj('rectangle', { dash: { numDashes: 12, ratio: 0.5 } }));
    expect(s).toContain('DashedVMobject(');
    expect(s).toContain('num_dashes=12');
    expect(s).toContain('dashed_ratio=0.5');
    expect(s).toMatch(/= VGroup\(\w+, DashedVMobject\(/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/effects-codegen.test.js`
Expected: FAIL — gradient/rounded/opacity/dashed assertions fail.

- [ ] **Step 3a: Add style helpers**

In `services/web/src/export/manim.js`, just after the `FRAME_*` constants (around line 85), add:

```js
// ── Style effect helpers (KEEP BYTE-IDENTICAL with services/api/src/compiler/codegen.js) ──
const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart']);
const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow']);

/** Fill opacity expression: byte-identical to bare master when fillOpacity is 1/absent. */
function fillOpacityExpr(obj, master) {
  const f = obj.fillOpacity;
  if (f == null || f === 1) return `${master}`;
  return `${+(master * f).toFixed(3)}`;
}
/** Stroke opacity arg: emitted only when strokeOpacity is set and < 1. */
function strokeOpacityArg(obj, master) {
  const s = obj.strokeOpacity;
  if (s == null || s === 1) return '';
  return `, opacity=${+(master * s).toFixed(3)}`;
}
/** set_color_by_gradient line, or null when no valid gradient. */
function gradientLine(n, obj) {
  if (!obj.gradient || !Array.isArray(obj.gradient.colors)) return null;
  const cols = obj.gradient.colors.map(c => hex(c)).filter(Boolean);
  if (cols.length < 2) return null;
  return `${n}.set_color_by_gradient(${cols.join(', ')})`;
}
/** Dashed-wrap lines (fill-preserving VGroup), or [] when no dash. */
function dashedLines(n, obj) {
  if (!obj.dash || !DASH_TYPES.has(obj.type)) return [];
  const numDashes = Math.max(2, Math.round(obj.dash.numDashes || 12));
  const ratio = Math.max(0, Math.min(1, obj.dash.ratio ?? 0.5));
  return [
    `_dash_src_${n} = ${n}.copy()`,
    `${n}.set_stroke(width=0)`,
    `${n} = VGroup(${n}, DashedVMobject(_dash_src_${n}, num_dashes=${numDashes}, dashed_ratio=${+ratio}))`,
  ];
}
```

- [ ] **Step 3b: Apply fill/stroke opacity in every standard shape case**

Still in `manim.js`, in `objectCode`, update the repeated emission. Replace **all** occurrences of:

```js
        lines.push(`${n}.set_fill(color=${fill}, opacity=${opacity})`);
```
with:
```js
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
```

and replace **all** occurrences of:
```js
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2})`);
```
with:
```js
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
```

(These two exact lines appear in the rectangle/square/circle/ellipse/triangle/star/polygon cases and the heart case has only the `set_fill` form — all covered by replace-all of these exact strings. The `line`/`arrow`/`dot` cases use different stroke strings and are intentionally left unchanged.)

- [ ] **Step 3c: Rounded corners for rectangle & square**

In the `case 'rectangle':` block, replace the constructor line:
```js
      lines.push(`${n} = Rectangle(width=${(obj.width / sw * FRAME_WIDTH).toFixed(3)}, height=${(obj.height / sh * FRAME_HEIGHT).toFixed(3)})`);
```
with:
```js
      {
        const rw = obj.width / sw * FRAME_WIDTH, rh = obj.height / sh * FRAME_HEIGHT;
        if (obj.cornerRadius > 0) {
          const cr = Math.min(obj.cornerRadius / sw * FRAME_WIDTH, Math.min(rw, rh) / 2 - 0.001);
          lines.push(`${n} = RoundedRectangle(corner_radius=${cr.toFixed(3)}, width=${rw.toFixed(3)}, height=${rh.toFixed(3)})`);
        } else {
          lines.push(`${n} = Rectangle(width=${rw.toFixed(3)}, height=${rh.toFixed(3)})`);
        }
      }
```

In the `case 'square':` block, replace:
```js
      lines.push(`${n} = Square(side_length=${scale.toFixed(3)})`);
```
with:
```js
      if (obj.cornerRadius > 0) {
        const cr = Math.min(obj.cornerRadius / sw * FRAME_WIDTH, scale / 2 - 0.001);
        lines.push(`${n} = RoundedRectangle(corner_radius=${cr.toFixed(3)}, width=${scale.toFixed(3)}, height=${scale.toFixed(3)})`);
      } else {
        lines.push(`${n} = Square(side_length=${scale.toFixed(3)})`);
      }
```

- [ ] **Step 3d: Append gradient + dashed after the shape switch**

In `objectCode`, find where the `switch (obj.type) { … }` closes (just before `return lines;`). Immediately after the closing `}` of the switch, add:

```js
  const gl = gradientLine(n, obj);
  if (gl && GRADIENT_TYPES.has(obj.type)) lines.push(gl);
  for (const dl of dashedLines(n, obj)) lines.push(dl);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/effects-codegen.test.js`
Expected: PASS (5 tests). Also run the existing export suite to confirm no regression:
Run: `cd services/web && npx vitest run tests/components/manim-export.test.js`
Expected: PASS (unchanged).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/export/manim.js services/web/tests/components/effects-codegen.test.js
git commit -m "feat(export): emit gradient/rounded/opacity/dashed in manim.js"
```

---

## Task 3: `manim.js` parser — round-trip the four effects

**Files:**
- Modify: `services/web/src/export/manim.js` (`parseManimScript`, shape regexes ~lines 1028–1101, setters ~lines 1311–1329)
- Test: `services/web/tests/components/effects-codegen.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `services/web/tests/components/effects-codegen.test.js`:

```js
import { parseManimScript } from '../../src/export/manim.js';

describe('effects round-trip (manim.js)', () => {
  const roundTrip = (o) => {
    const code = generateManimScript(makeProject([o]));
    return parseManimScript(code, SW, SH).objects[0];
  };

  it('gradient colors survive', () => {
    const o = roundTrip(makeObj('circle', { gradient: { colors: ['#ff0000', '#00ff00'], angle: 90 } }));
    expect(o.gradient.colors).toEqual(['#ff0000', '#00ff00']);
  });

  it('rounded corners survive (non-square stays rectangle, cornerRadius > 0)', () => {
    const o = roundTrip(makeObj('rectangle', { cornerRadius: 48, width: 300, height: 150 }));
    expect(o.type).toBe('rectangle');
    expect(o.cornerRadius).toBeGreaterThan(0);
  });

  it('fill/stroke opacity survive', () => {
    const o = roundTrip(makeObj('square', { opacity: 1, fillOpacity: 0.5, strokeOpacity: 0.25 }));
    expect(o.fillOpacity).toBeCloseTo(0.5, 2);
    expect(o.strokeOpacity).toBeCloseTo(0.25, 2);
  });

  it('dash survives via the VGroup form', () => {
    const o = roundTrip(makeObj('rectangle', { dash: { numDashes: 12, ratio: 0.5 } }));
    expect(o.dash).toEqual({ numDashes: 12, ratio: 0.5 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/effects-codegen.test.js`
Expected: FAIL — the four round-trip cases fail (fields not parsed back).

- [ ] **Step 3a: Parse RoundedRectangle (rectangle/square)**

In `parseManimScript`, immediately **before** the existing `// Rectangle` matcher (manim.js ~line 1039), add:

```js
    // RoundedRectangle (rectangle/square with cornerRadius)
    m = line.match(/^(\w+)\s*=\s*RoundedRectangle\(corner_radius=([\d.]+),\s*width=([\d.]+),\s*height=([\d.]+)\)/);
    if (m) {
      const [, name, cr, w, h] = m;
      const width = Math.round(parseFloat(w) / FRAME_WIDTH * sw);
      const height = Math.round(parseFloat(h) / FRAME_HEIGHT * sh);
      const type = Math.abs(parseFloat(w) - parseFloat(h)) < 0.01 ? 'square' : 'rectangle';
      const id = uid('obj');
      const obj = { id, type, name, x: sw / 2, y: sh / 2, width, height,
        cornerRadius: Math.round(parseFloat(cr) / FRAME_WIDTH * sw),
        fill: '#ffffff', stroke: 'transparent', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }
```

- [ ] **Step 3b: Parse gradient**

In the `// ── Property setters ──` region (manim.js ~line 1309), add before the `set_fill` matcher:

```js
    m = line.match(/^(\w+)\.set_color_by_gradient\(([^)]+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        const colors = m[2].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        if (colors.length >= 2) objById[id].gradient = { colors, angle: 135 };
      }
      continue;
    }
```

- [ ] **Step 3c: Parse fill/stroke opacity back into channel fields**

Replace the existing `set_fill` setter (manim.js ~lines 1311–1319) with:

```js
    m = line.match(/^(\w+)\.set_fill\(color=["']([^"']+)["'](?:,\s*opacity=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].fill = m[2];
        if (m[3] !== undefined) {
          const op = parseFloat(m[3]);
          const master = objById[id].opacity ?? 1;
          if (master > 0 && Math.abs(op - master) > 0.001) objById[id].fillOpacity = +(op / master).toFixed(3);
        }
      }
      continue;
    }
```

Replace the existing `set_stroke` setter (manim.js ~lines 1321–1329) with:

```js
    m = line.match(/^(\w+)\.set_stroke\(color=["']([^"']+)["'](?:,\s*width=([\d.]+))?(?:,\s*opacity=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].stroke = m[2];
        if (m[3]) objById[id].strokeWidth = parseFloat(m[3]);
        if (m[4] !== undefined) {
          const op = parseFloat(m[4]);
          const master = objById[id].opacity ?? 1;
          if (master > 0) objById[id].strokeOpacity = +(op / master).toFixed(3);
        }
      }
      continue;
    }
```

> Note: the generator's `n.set_stroke(width=0)` line inside the dashed wrap has no `color=`, so it never matches this setter — it is harmless and ignored. The `_dash_src_X = X.copy()` line matches no constructor regex and is also ignored.

- [ ] **Step 3d: Parse the dashed VGroup wrapper**

In the setters region, add:

```js
    m = line.match(/^\w+\s*=\s*VGroup\((\w+),\s*DashedVMobject\([^,]+,\s*num_dashes=(\d+),\s*dashed_ratio=([\d.]+)\)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) objById[id].dash = { numDashes: parseInt(m[2]), ratio: parseFloat(m[3]) };
      continue;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/effects-codegen.test.js`
Expected: PASS (all 9 tests in the file). Then the full export suite:
Run: `cd services/web && npx vitest run tests/components/manim-export.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/export/manim.js services/web/tests/components/effects-codegen.test.js
git commit -m "feat(export): parse gradient/rounded/opacity/dashed round-trip"
```

---

## Task 4: Mirror generator changes into `codegen.js` (server)

`codegen.js` cannot be imported by Vitest, so it is kept byte-identical with `manim.js` **by convention** (CLAUDE.md). This task mirrors Task 2's generator changes only (the server generator does not parse).

**Files:**
- Modify: `services/api/src/compiler/codegen.js` (helpers near top; `objectCode` shape cases + post-switch)

- [ ] **Step 1: Add the same style helpers**

In `services/api/src/compiler/codegen.js`, after the `FRAME_*` constants, paste the **identical** helper block from Task 2 Step 3a (`GRADIENT_TYPES`, `DASH_TYPES`, `fillOpacityExpr`, `strokeOpacityArg`, `gradientLine`, `dashedLines`). They rely only on `hex()`, which exists in this file too.

- [ ] **Step 2: Apply the same emission edits**

Apply Task 2 Steps 3b, 3c, 3d verbatim to `codegen.js`'s `objectCode` (same exact source strings exist there — confirmed at codegen.js:204–254 for the shape cases). The post-switch append (3d) goes right before this function's `return lines;`.

- [ ] **Step 3: Verify byte-identical emission between the two files**

Run this parity check (extracts and diffs the new helper block + the changed lines):

```bash
cd "D:/PYTHON/Manim-Editor"
grep -n "set_color_by_gradient\|RoundedRectangle\|DashedVMobject\|fillOpacityExpr\|strokeOpacityArg\|_dash_src" \
  services/api/src/compiler/codegen.js services/web/src/export/manim.js
```
Expected: the multiplier/string fragments match between the two files (same right-hand sides). Eyeball that gradient/rounded/dashed lines are identical.

- [ ] **Step 4: Sanity-check the server generator parses (no syntax error)**

```bash
cd "D:/PYTHON/Manim-Editor" && node --check services/api/src/compiler/codegen.js && echo "codegen.js OK"
```
Expected: `codegen.js OK`.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/compiler/codegen.js
git commit -m "feat(codegen): mirror gradient/rounded/opacity/dashed (server parity)"
```

---

## Task 5: Konva preview in `StageCanvas.vue`

Add effect helpers and apply them to every 2D shape config so the canvas matches render.

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue` (helpers near the `// ── Shape configs ──` block ~line 664; shape cfg functions `rectCfg`, `circleCfg`, `ellipseCfg`, `triangleCfg`, `starCfg`, `polygonCfg`, `heartCfg`, `lineCfg`, `arrowCfg`)
- Test: manual visual check (Konva configs are not unit-tested in this repo)

- [ ] **Step 1: Add effect helpers**

In `StageCanvas.vue`'s `<script setup>`, just above `function rectCfg(obj)` (line ~668), add:

```js
// ── Effect preview helpers ──
function hexToRgba(h, a) {
  if (typeof h !== 'string' || !h.startsWith('#')) return h;
  let s = h.slice(1);
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
/** Mutates a Konva config with gradient / cornerRadius / dashed / per-channel alpha.
 *  centered = shape origin is its center (circle/star/polygon/triangle) vs top-left (rect). */
function applyEffects(cfg, obj, e, w, h, centered) {
  // per-channel opacity → baked into rgba colors (node opacity stays the master)
  if (obj.fillOpacity != null && obj.fillOpacity !== 1 && cfg.fill) cfg.fill = hexToRgba(cfg.fill, obj.fillOpacity);
  if (obj.strokeOpacity != null && obj.strokeOpacity !== 1 && cfg.stroke) cfg.stroke = hexToRgba(cfg.stroke, obj.strokeOpacity);
  // gradient
  const g = obj.gradient;
  if (g && Array.isArray(g.colors) && g.colors.length >= 2) {
    const rad = (g.angle ?? 135) * Math.PI / 180;
    const dx = Math.cos(rad) * w / 2, dy = Math.sin(rad) * h / 2;
    const cx = centered ? 0 : w / 2, cy = centered ? 0 : h / 2;
    cfg.fillLinearGradientStartPoint = { x: cx - dx, y: cy - dy };
    cfg.fillLinearGradientEndPoint = { x: cx + dx, y: cy + dy };
    const stops = [];
    g.colors.forEach((c, i) => { stops.push(i / (g.colors.length - 1), c); });
    cfg.fillLinearGradientColorStops = stops;
  }
  // dashed stroke (Konva keeps fill underneath, matching the render's VGroup)
  if (obj.dash) {
    const peri = centered ? Math.PI * Math.max(w, h) : 2 * (w + h);
    const on = Math.max(2, peri / Math.max(2, obj.dash.numDashes) * (obj.dash.ratio ?? 0.5));
    const off = Math.max(2, peri / Math.max(2, obj.dash.numDashes) * (1 - (obj.dash.ratio ?? 0.5)));
    cfg.dash = [on, off];
  }
  return cfg;
}
```

- [ ] **Step 2: Apply in `rectCfg` (top-left origin, supports cornerRadius)**

Replace the `return { … }` of `rectCfg` (line 672) with:

```js
  const crPx = (obj.cornerRadius > 0 ? obj.cornerRadius : (obj.type === 'square' ? 4 : 2)) * vs.value;
  const cfg = { x: p.x, y: p.y, width: w, height: h, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, cornerRadius: crPx, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return applyEffects(cfg, obj, e, w, h, false);
```

> `crPx` keeps today's default (4 for square / 2 for rect, scaled by `vs`) when no `cornerRadius` is set, and uses `obj.cornerRadius` (project px → canvas px via `vs`) when set.

- [ ] **Step 3: Apply in the other shape cfgs**

For each of `circleCfg`, `ellipseCfg`, `triangleCfg`, `starCfg`, `polygonCfg`, `heartCfg`, change the function's final `return { … }` to assign the object to `const cfg = { … }` and then `return applyEffects(cfg, obj, e, w, h, true);` (these shapes are center-origin, so `centered = true`; use that function's existing `w`/`h` locals).

For `lineCfg` and `arrowCfg`, do the same with `return applyEffects(cfg, obj, e, w, h, false);` — gradient/cornerRadius are inapplicable (no fill / not a rect) and `applyEffects` simply skips them; only the dashed branch will take effect.

> Each shape cfg already computes `w` and `h` locals (canvas-space width/height). If a given cfg uses a single radius `r` instead of `w`/`h` (e.g. `circleCfg`), pass `r * 2` for both `w` and `h`.

- [ ] **Step 4: Manual verification**

Run the dev server and visually confirm each effect previews:
```bash
cd services/web && npm run dev   # http://localhost:5173
```
Add a rectangle; in the inspector set a gradient, a corner radius, fill opacity 35%, and toggle dashed — confirm the canvas updates for each. (Inspector controls land in Task 6; until then, verify by temporarily setting fields via the browser console: `useProjectStore().setGradient(id, {colors:['#f00','#0f0'],angle:90})`.)

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): preview gradient/rounded/opacity/dashed effects"
```

---

## Task 6: Inspector "Effects" section in `PropertiesPanel.vue`

**Files:**
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (add a `<Section>` after the Opacity section ~line 149; add helpers + type-guard computeds in `<script setup>`)
- Test: `services/web/tests/components/effects-panel.test.js` (create — mounts the panel, asserts controls show/hide and wire to store)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/effects-panel.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.addObject('rectangle', 960, 540);
  id = store.project.objects[0].id;
  store.selectObject(id);
});

describe('Effects panel', () => {
  it('shows a corner-radius control for a rectangle', () => {
    const w = mount(PropertiesPanel);
    expect(w.html()).toContain('Corner');
  });

  it('hides the corner-radius control for a circle', () => {
    store.project.objects[0].type = 'circle';
    const w = mount(PropertiesPanel);
    expect(w.html()).not.toContain('Corner radius');
  });

  it('toggling gradient on calls setGradient with two stops', async () => {
    const spy = vi.spyOn(store, 'setGradient');
    const w = mount(PropertiesPanel);
    const toggle = w.find('[data-test="gradient-toggle"]');
    await toggle.trigger('click');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][1].colors.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/effects-panel.test.js`
Expected: FAIL — no "Corner"/gradient-toggle markup yet.

- [ ] **Step 3a: Add script helpers**

In `PropertiesPanel.vue` `<script setup>`, near the existing `u`/`uSize` helpers (line ~626), add:

```js
const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart']);
const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow']);
const ROUND_TYPES = new Set(['rectangle', 'square']);

const canGradient = computed(() => obj.value && GRADIENT_TYPES.has(obj.value.type));
const canDash = computed(() => obj.value && DASH_TYPES.has(obj.value.type));
const canRound = computed(() => obj.value && ROUND_TYPES.has(obj.value.type));

function toggleGradient() {
  if (!obj.value) return;
  if (obj.value.gradient) store.setGradient(obj.value.id, null);
  else store.setGradient(obj.value.id, { colors: [obj.value.fill || '#3b82f6', '#8b5cf6'], angle: 135 });
}
function setGradientStop(i, color) {
  const g = obj.value.gradient; if (!g) return;
  const colors = [...g.colors]; colors[i] = color;
  store.setGradient(obj.value.id, { ...g, colors });
}
function addGradientStop() {
  const g = obj.value.gradient; if (!g) return;
  store.setGradient(obj.value.id, { ...g, colors: [...g.colors, '#ffffff'] });
}
function removeGradientStop(i) {
  const g = obj.value.gradient; if (!g || g.colors.length <= 2) return;
  store.setGradient(obj.value.id, { ...g, colors: g.colors.filter((_, j) => j !== i) });
}
function setGradientAngle(deg) {
  const g = obj.value.gradient; if (!g) return;
  store.setGradient(obj.value.id, { ...g, angle: Number(deg) });
}
function toggleDash() {
  if (!obj.value) return;
  if (obj.value.dash) store.setDash(obj.value.id, null);
  else store.setDash(obj.value.id, { numDashes: 12, ratio: 0.5 });
}
function setDashField(key, val) {
  const d = obj.value.dash || { numDashes: 12, ratio: 0.5 };
  store.setDash(obj.value.id, { ...d, [key]: Number(val) });
}
```

Confirm `computed` is imported at the top of the file (it is used elsewhere; if not, add it to the `vue` import).

- [ ] **Step 3b: Add the Effects section template**

In the template, immediately after the Opacity `<Section>` (closes at line ~149), add:

```html
      <!-- Effects -->
      <Section v-if="obj.type !== 'text' && obj.type !== 'image' && obj.type !== 'svg_asset'" label="Effects">
        <div class="space-y-2">

          <!-- Gradient -->
          <div v-if="canGradient">
            <button data-test="gradient-toggle" class="flex items-center justify-between w-full text-[10px] text-studio-text-muted" @click="toggleGradient">
              <span>Gradient</span>
              <span :class="obj.gradient ? 'text-studio-accent' : ''">{{ obj.gradient ? 'On' : 'Off' }}</span>
            </button>
            <div v-if="obj.gradient" class="mt-1.5 space-y-1.5">
              <div v-for="(c, i) in obj.gradient.colors" :key="i" class="flex items-center gap-2">
                <input type="color" class="color-input" :value="c" @input="setGradientStop(i, $event.target.value)" />
                <button v-if="obj.gradient.colors.length > 2" class="text-studio-error text-xs px-1" @click="removeGradientStop(i)">✕</button>
              </div>
              <button class="text-[10px] text-studio-accent" @click="addGradientStop">+ Add stop</button>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-studio-text-muted w-12">Angle</span>
                <input type="range" min="0" max="360" step="1" class="flex-1 accent-studio-accent" :value="obj.gradient.angle ?? 135" @input="setGradientAngle($event.target.value)" />
                <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{ obj.gradient.angle ?? 135 }}°</span>
              </div>
            </div>
          </div>

          <!-- Corner radius -->
          <div v-if="canRound" class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-20">Corner radius</span>
            <input class="input input-sm w-16" type="number" min="0" step="1" :value="obj.cornerRadius || 0" @change="store.setCornerRadius(obj.id, Number($event.target.value))" />
          </div>

          <!-- Fill opacity -->
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-20">Fill opacity</span>
            <input type="range" min="0" max="1" step="0.01" class="flex-1 accent-studio-accent" :value="obj.fillOpacity ?? 1" @input="u('fillOpacity', Number($event.target.value))" />
            <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{ Math.round((obj.fillOpacity ?? 1) * 100) }}%</span>
          </div>

          <!-- Stroke opacity -->
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-20">Stroke opacity</span>
            <input type="range" min="0" max="1" step="0.01" class="flex-1 accent-studio-accent" :value="obj.strokeOpacity ?? 1" @input="u('strokeOpacity', Number($event.target.value))" />
            <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{ Math.round((obj.strokeOpacity ?? 1) * 100) }}%</span>
          </div>

          <!-- Dashed stroke -->
          <div v-if="canDash">
            <button class="flex items-center justify-between w-full text-[10px] text-studio-text-muted" @click="toggleDash">
              <span>Dashed stroke</span>
              <span :class="obj.dash ? 'text-studio-accent' : ''">{{ obj.dash ? 'On' : 'Off' }}</span>
            </button>
            <div v-if="obj.dash" class="mt-1.5 space-y-1.5">
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-studio-text-muted w-16">Density</span>
                <input type="range" min="2" max="60" step="1" class="flex-1 accent-studio-accent" :value="obj.dash.numDashes" @input="setDashField('numDashes', $event.target.value)" />
                <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{ obj.dash.numDashes }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-studio-text-muted w-16">Ratio</span>
                <input type="range" min="0.1" max="0.9" step="0.05" class="flex-1 accent-studio-accent" :value="obj.dash.ratio" @input="setDashField('ratio', $event.target.value)" />
                <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{ obj.dash.ratio }}</span>
              </div>
            </div>
          </div>

        </div>
      </Section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/effects-panel.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/effects-panel.test.js
git commit -m "feat(inspector): Effects section (gradient/rounded/opacity/dashed)"
```

---

## Task 7: Full-suite verification + docs

**Files:**
- Modify: `CLAUDE.md` (append a short note under a new "2D Object Effects" heading)

- [ ] **Step 1: Run both full test suites**

```bash
cd services/web && npm run test:unit
cd services/web && npm test
```
Expected: both green (109+ unit tests including the new ones; 105 engine tests unchanged).

- [ ] **Step 2: Document the feature in CLAUDE.md**

Append this section to `CLAUDE.md` (after the "Coordinate Constants" section):

```markdown
## 2D Object Effects (Phase 1 — 2026-06-05)

Optional object fields, absent ⇒ byte-identical legacy output:
`gradient {colors[], angle}`, `cornerRadius` (rect/square), `fillOpacity`,
`strokeOpacity`, `dash {numDashes, ratio}`.

- Codegen: `set_color_by_gradient(...)`, `RoundedRectangle`, `set_fill/stroke`
  opacity = master × channel, dashed via fill-preserving
  `VGroup(base, DashedVMobject(_dash_src, ...))`. **Keep codegen.js and manim.js
  helpers (`fillOpacityExpr`, `strokeOpacityArg`, `gradientLine`, `dashedLines`)
  byte-identical** — guarded by `effects-codegen.test.js`.
- Preview: `StageCanvas.vue` `applyEffects()` (Konva gradient / cornerRadius /
  rgba alpha / dash).
- Inspector: "Effects" section in `PropertiesPanel.vue`.
- Preview-only divergences: gradient **angle** (Manim orients by point order),
  and dashed+fill (preview = single shape, render = VGroup). Phase 2: glow,
  drop shadow, `.round_corners()` for polygon/triangle/star.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: 2D object effects (Phase 1) in CLAUDE.md"
```

---

## Self-Review Notes

- **Spec coverage:** data model → Task 1; gradient/rounded/opacity/dashed codegen → Tasks 2 & 4; parser → Task 3; preview → Task 5; inspector → Task 6; tests → every task + Task 7; CLAUDE.md sync note → Task 7. Feature→object matrix enforced via `GRADIENT_TYPES`/`DASH_TYPES`/`ROUND_TYPES` (defined identically in codegen.js, manim.js, StageCanvas.vue, PropertiesPanel.vue).
- **Backward compatibility:** `fillOpacityExpr` returns the bare master when factor is 1/absent; `strokeOpacityArg` emits nothing unless set; gradient/rounded/dashed only appear when their field is present — so legacy objects are byte-identical (asserted in Task 2 Step 1, test 1).
- **Naming consistency:** helper names (`fillOpacityExpr`, `strokeOpacityArg`, `gradientLine`, `dashedLines`, `applyEffects`, `GRADIENT_TYPES`, `DASH_TYPES`, `ROUND_TYPES`) and store actions (`setGradient`, `setCornerRadius`, `setDash`) are used identically across all tasks.
- **Dashed parser:** the generator emits `set_stroke(width=0)` (no `color=`) and `_dash_src_X = X.copy()`, neither of which matches any parser regex, so they are safely ignored; only the `VGroup(..., DashedVMobject(...))` line carries `dash` back.
```
