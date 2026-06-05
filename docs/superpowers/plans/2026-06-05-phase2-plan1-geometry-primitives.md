# Phase 2 — Plan 1: Geometry Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four standalone geometry shapes — `annulus`, `arc`, `sector`, `double_arrow` — editable in the inspector, previewed on the Konva canvas, emitted to / parsed from Manim Python by both generators.

**Architecture:** Each shape is a new `case` arm in `objectCode` (codegen.js server + manim.js client, emitted byte-identically), a Konva config function + template element in `StageCanvas.vue`, a `SHAPE_DEFAULTS`/`SHAPE_COLORS`/`nameMap`/`addObject` seed in the store, a sidebar button, an inspector panel, and a round-trip parser branch in manim.js. The closed shapes (`annulus`, `sector`) also join the Phase-1 effect type-sets (`GRADIENT_TYPES`/`DASH_TYPES`); the others (`arc`, `double_arrow`) join `DASH_TYPES`.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Konva.js (vue-konva `v-ring`/`v-wedge`/`v-shape`/`v-arrow`), Vitest, Node.js codegen, Manim CE.

**Spec:** `docs/superpowers/specs/2026-06-05-phase2-geometry-calculus-objects-design.md` (this is Plan 1 of 4).
**Branch:** `feat/phase2-geometry-objects`.

**Run tests with:**
```bash
cd services/web && npx vitest run tests/components/   # Vitest — this plan's tests live here
cd services/web && npm test                           # Node engine tests — must stay green, untouched
```

## Conventions (used throughout)

- **Angles** stored in **degrees**, emitted as `<deg> * DEGREES`.
- **Radius/length** px → Manim units: `value_px / sw * FRAME_WIDTH` (same scale as `circle`). `sw` = stage width (1920).
- New constructors emitted **single-line** for the regex round-trip parser.
- codegen.js and manim.js emit **identical** strings (parity by convention; no shared import).
- `FRAME_WIDTH` (14.222) exists in both generators already.

Field shapes:
```js
annulus      → { innerRadius, outerRadius }          // px
arc          → { radius, startAngle, sweepAngle }    // px, deg, deg
sector       → { radius, startAngle, sweepAngle }    // px, deg, deg
double_arrow → (uses base width as length, fill = color, strokeWidth)
```

---

## Task 1: Store defaults, seeds, and sidebar buttons

**Files:**
- Modify: `services/web/src/store/project.js` (`SHAPE_DEFAULTS` ~129, `SHAPE_COLORS` ~156, `nameMap` ~272, `addObject` seed block ~302-309)
- Modify: `services/web/src/components/sidebar/AssetSidebar.vue` (`shapes` array ~178)
- Test: `services/web/tests/components/phase2-geometry-store.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-geometry-store.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
});

describe('phase 2 geometry object seeds', () => {
  it('annulus seeds inner/outer radius', () => {
    store.addObject('annulus', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('annulus');
    expect(o.outerRadius).toBeGreaterThan(0);
    expect(o.innerRadius).toBeGreaterThan(0);
    expect(o.innerRadius).toBeLessThan(o.outerRadius);
  });

  it('arc seeds radius and angles', () => {
    store.addObject('arc', 960, 540);
    const o = store.project.objects[0];
    expect(o.radius).toBeGreaterThan(0);
    expect(o.startAngle).toBe(0);
    expect(o.sweepAngle).toBe(180);
  });

  it('sector seeds radius and angles', () => {
    store.addObject('sector', 960, 540);
    const o = store.project.objects[0];
    expect(o.radius).toBeGreaterThan(0);
    expect(o.sweepAngle).toBe(90);
  });

  it('double_arrow is created', () => {
    store.addObject('double_arrow', 960, 540);
    expect(store.project.objects[0].type).toBe('double_arrow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-store.test.js`
Expected: FAIL — seeded fields are undefined.

- [ ] **Step 3: Add SHAPE_DEFAULTS, SHAPE_COLORS, nameMap, seed fields**

In `services/web/src/store/project.js`, in `SHAPE_DEFAULTS` (after the `polygon:` line ~135), add:
```js
  annulus:  { width: 140, height: 140, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 },
  arc:      { width: 140, height: 140, fill: 'transparent', stroke: '#f97316', strokeWidth: 4 },
  sector:   { width: 140, height: 140, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 },
  double_arrow: { width: 200, height: 40, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 },
```

In `SHAPE_COLORS` (after `polygon:` ~158), add:
```js
  annulus: '#14b8a6', arc: '#f97316', sector: '#f59e0b', double_arrow: '#ef4444',
```

In the `nameMap` inside `addObject` (~272), add these keys:
```js
        annulus: 'Annulus', arc: 'Arc', sector: 'Sector', double_arrow: 'Double Arrow',
```

In the `addObject` seed block (after the `star` seed line ~305), add:
```js
        ...(type === 'annulus' ? { outerRadius: 70, innerRadius: 35 } : {}),
        ...(type === 'arc'    ? { radius: 70, startAngle: 0, sweepAngle: 180 } : {}),
        ...(type === 'sector' ? { radius: 70, startAngle: 0, sweepAngle: 90 } : {}),
```

- [ ] **Step 4: Add sidebar buttons**

In `services/web/src/components/sidebar/AssetSidebar.vue`, in the `shapes` array (~178), after the existing entries add:
```js
  { type: 'annulus', label: 'Annulus', color: '#14b8a6', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>' },
  { type: 'arc', label: 'Arc', color: '#f97316', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 18 0"/></svg>' },
  { type: 'sector', label: 'Sector', color: '#f59e0b', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12 L12 3 A9 9 0 0 1 21 12 Z"/></svg>' },
  { type: 'double_arrow', label: 'Double Arrow', color: '#ef4444', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4"/></svg>' },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-store.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add services/web/src/store/project.js services/web/src/components/sidebar/AssetSidebar.vue services/web/tests/components/phase2-geometry-store.test.js
git commit -m "feat(store): annulus/arc/sector/double_arrow defaults + sidebar buttons"
```

---

## Task 2: Codegen + round-trip — `annulus`

`codegen.js` cannot be imported by Vitest; tests target `manim.js` (`generateManimScript`/`parseManimScript`). codegen.js is mirrored by hand and kept byte-identical by convention.

**Files:**
- Modify: `services/web/src/export/manim.js` (generator switch ~204-260; parser shape region ~1028-1101; `GRADIENT_TYPES`/`DASH_TYPES` ~85)
- Modify: `services/api/src/compiler/codegen.js` (generator switch ~203-260; `GRADIENT_TYPES`/`DASH_TYPES` ~88)
- Test: `services/web/tests/components/phase2-geometry-codegen.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-geometry-codegen.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(type, extra = {}) {
  return {
    id: 'o1', type, x: SW / 2, y: SH / 2, width: 140, height: 140,
    fill: '#14b8a6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000',
    objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}
export const SW_ = SW, SH_ = SH;
export { makeObj, makeProject };
const script = (o) => generateManimScript(makeProject([o]));
const roundTrip = (o) => parseManimScript(generateManimScript(makeProject([o])), SW, SH).objects[0];

describe('annulus codegen', () => {
  it('emits Annulus with inner/outer radius', () => {
    const s = script(makeObj('annulus', { innerRadius: 35, outerRadius: 70 }));
    expect(s).toMatch(/= Annulus\(inner_radius=[\d.]+, outer_radius=[\d.]+\)/);
  });
  it('round-trips type + radii', () => {
    const o = roundTrip(makeObj('annulus', { innerRadius: 35, outerRadius: 70 }));
    expect(o.type).toBe('annulus');
    expect(o.outerRadius).toBeGreaterThan(o.innerRadius);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-codegen.test.js`
Expected: FAIL — no Annulus emitted.

- [ ] **Step 3: Add the manim.js generator case**

In `services/web/src/export/manim.js`, inside `objCode`'s `switch`, after the `case 'circle':` block (or any shape case, before `default:`), add:
```js
    case 'annulus': {
      const ri = (obj.innerRadius / sw * FRAME_WIDTH);
      const ro = (obj.outerRadius / sw * FRAME_WIDTH);
      lines.push(`${n} = Annulus(inner_radius=${ri.toFixed(3)}, outer_radius=${ro.toFixed(3)})`);
      if (hasFill) lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke) lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
```

- [ ] **Step 4: Add the manim.js parser branch**

In `parseManimScript`, near the other shape constructors (after the `Circle` matcher ~1050), add:
```js
    // Annulus
    m = line.match(/^(\w+)\s*=\s*Annulus\(inner_radius=([\d.]+),\s*outer_radius=([\d.]+)\)/);
    if (m) {
      const [, name, ri, ro] = m;
      const innerRadius = Math.round(parseFloat(ri) / FRAME_WIDTH * sw);
      const outerRadius = Math.round(parseFloat(ro) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'annulus', name, x: sw / 2, y: sh / 2, width: outerRadius * 2, height: outerRadius * 2,
        innerRadius, outerRadius, fill: '#14b8a6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }
```

- [ ] **Step 5: Add annulus to the effect type-sets (both files)**

In `services/web/src/export/manim.js`, change the two set literals (~85):
```js
const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus']);
const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow', 'annulus']);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-codegen.test.js`
Expected: PASS (2 annulus tests).

- [ ] **Step 7: Mirror into codegen.js (server parity)**

In `services/api/src/compiler/codegen.js`, paste the **identical** `case 'annulus':` block from Step 3 into `objectCode`'s switch, and make the **identical** `GRADIENT_TYPES`/`DASH_TYPES` edits from Step 5. Verify no syntax error:
```bash
cd "D:/PYTHON/Manim-Editor" && node --check services/api/src/compiler/codegen.js && echo OK
```
Expected: `OK`.

- [ ] **Step 8: Commit**

```bash
git add services/web/src/export/manim.js services/api/src/compiler/codegen.js services/web/tests/components/phase2-geometry-codegen.test.js
git commit -m "feat(codegen): annulus shape + round-trip + effect sets"
```

---

## Task 3: Codegen + round-trip — `arc`

**Files:**
- Modify: `services/web/src/export/manim.js`, `services/api/src/compiler/codegen.js`
- Test: append to `services/web/tests/components/phase2-geometry-codegen.test.js`

- [ ] **Step 1: Append the failing test**

Append to `phase2-geometry-codegen.test.js`:
```js
describe('arc codegen', () => {
  const script = (o) => generateManimScript(makeProject([o]));
  const roundTrip = (o) => parseManimScript(generateManimScript(makeProject([o])), SW, SH).objects[0];
  it('emits Arc with radius + angles in DEGREES', () => {
    const s = script(makeObj('arc', { radius: 70, startAngle: 0, sweepAngle: 180, fill: 'transparent', stroke: '#f97316' }));
    expect(s).toMatch(/= Arc\(radius=[\d.]+, start_angle=[-\d.]+ \* DEGREES, angle=[-\d.]+ \* DEGREES\)/);
  });
  it('round-trips radius + angles', () => {
    const o = roundTrip(makeObj('arc', { radius: 70, startAngle: 30, sweepAngle: 120, fill: 'transparent', stroke: '#f97316' }));
    expect(o.type).toBe('arc');
    expect(o.sweepAngle).toBeCloseTo(120, 0);
    expect(o.startAngle).toBeCloseTo(30, 0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-codegen.test.js`
Expected: FAIL on the 2 arc tests.

- [ ] **Step 3: Add the manim.js generator case**

In `services/web/src/export/manim.js` `objCode` switch, add:
```js
    case 'arc': {
      const r = (obj.radius / sw * FRAME_WIDTH);
      lines.push(`${n} = Arc(radius=${r.toFixed(3)}, start_angle=${(+obj.startAngle || 0)} * DEGREES, angle=${(+obj.sweepAngle || 0)} * DEGREES)`);
      lines.push(`${n}.set_stroke(color=${hex(obj.stroke) || hex(obj.fill) || '"#FFFFFF"'}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
```

- [ ] **Step 4: Add the manim.js parser branch**

In `parseManimScript`, add:
```js
    // Arc
    m = line.match(/^(\w+)\s*=\s*Arc\(radius=([\d.]+),\s*start_angle=([-\d.]+) \* DEGREES,\s*angle=([-\d.]+) \* DEGREES\)/);
    if (m) {
      const [, name, r, a0, sw_] = m;
      const radius = Math.round(parseFloat(r) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'arc', name, x: sw / 2, y: sh / 2, width: radius * 2, height: radius * 2,
        radius, startAngle: parseFloat(a0), sweepAngle: parseFloat(sw_),
        fill: 'transparent', stroke: '#f97316', strokeWidth: 4, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }
```

- [ ] **Step 5: Add `arc` to DASH_TYPES (both files)**

In `manim.js`, append `'arc'` to the `DASH_TYPES` set literal (not GRADIENT_TYPES — arc is an open stroke). Mirror in codegen.js in Step 7.

- [ ] **Step 6: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-codegen.test.js`
Expected: PASS (annulus + arc).

- [ ] **Step 7: Mirror into codegen.js**

Paste the identical `case 'arc':` block into `codegen.js` `objectCode` switch and append `'arc'` to its `DASH_TYPES`. Verify:
```bash
cd "D:/PYTHON/Manim-Editor" && node --check services/api/src/compiler/codegen.js && echo OK
```

- [ ] **Step 8: Commit**

```bash
git add services/web/src/export/manim.js services/api/src/compiler/codegen.js services/web/tests/components/phase2-geometry-codegen.test.js
git commit -m "feat(codegen): arc shape + round-trip"
```

---

## Task 4: Codegen + round-trip — `sector`

**Files:** same as Task 3.

- [ ] **Step 1: Append the failing test**

Append to `phase2-geometry-codegen.test.js`:
```js
describe('sector codegen', () => {
  const script = (o) => generateManimScript(makeProject([o]));
  const roundTrip = (o) => parseManimScript(generateManimScript(makeProject([o])), SW, SH).objects[0];
  it('emits Sector with radius + angles in DEGREES', () => {
    const s = script(makeObj('sector', { radius: 70, startAngle: 0, sweepAngle: 90, fill: '#f59e0b', stroke: '#ffffff' }));
    expect(s).toMatch(/= Sector\(radius=[\d.]+, start_angle=[-\d.]+ \* DEGREES, angle=[-\d.]+ \* DEGREES\)/);
    expect(s).toContain('.set_fill(color="#f59e0b"');
  });
  it('round-trips type + angles', () => {
    const o = roundTrip(makeObj('sector', { radius: 70, startAngle: 0, sweepAngle: 90, fill: '#f59e0b', stroke: '#ffffff' }));
    expect(o.type).toBe('sector');
    expect(o.sweepAngle).toBeCloseTo(90, 0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-codegen.test.js`
Expected: FAIL on the 2 sector tests.

- [ ] **Step 3: Add the manim.js generator case**

```js
    case 'sector': {
      const r = (obj.radius / sw * FRAME_WIDTH);
      lines.push(`${n} = Sector(radius=${r.toFixed(3)}, start_angle=${(+obj.startAngle || 0)} * DEGREES, angle=${(+obj.sweepAngle || 0)} * DEGREES)`);
      if (hasFill) lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke) lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
```

- [ ] **Step 4: Add the manim.js parser branch**

```js
    // Sector
    m = line.match(/^(\w+)\s*=\s*Sector\(radius=([\d.]+),\s*start_angle=([-\d.]+) \* DEGREES,\s*angle=([-\d.]+) \* DEGREES\)/);
    if (m) {
      const [, name, r, a0, sw_] = m;
      const radius = Math.round(parseFloat(r) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'sector', name, x: sw / 2, y: sh / 2, width: radius * 2, height: radius * 2,
        radius, startAngle: parseFloat(a0), sweepAngle: parseFloat(sw_),
        fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }
```

- [ ] **Step 5: Add `sector` to GRADIENT_TYPES + DASH_TYPES (both files)**

Append `'sector'` to **both** set literals in `manim.js` (closed fillable shape). Mirror in codegen.js in Step 7.

- [ ] **Step 6: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-codegen.test.js`
Expected: PASS (annulus + arc + sector).

- [ ] **Step 7: Mirror into codegen.js**

Paste the identical `case 'sector':` block and the identical set edits into `codegen.js`. Verify:
```bash
cd "D:/PYTHON/Manim-Editor" && node --check services/api/src/compiler/codegen.js && echo OK
```

- [ ] **Step 8: Commit**

```bash
git add services/web/src/export/manim.js services/api/src/compiler/codegen.js services/web/tests/components/phase2-geometry-codegen.test.js
git commit -m "feat(codegen): sector shape + round-trip"
```

---

## Task 5: Codegen + round-trip — `double_arrow`

**Files:** same as Task 3.

- [ ] **Step 1: Append the failing test**

Append to `phase2-geometry-codegen.test.js`:
```js
describe('double_arrow codegen', () => {
  const script = (o) => generateManimScript(makeProject([o]));
  const roundTrip = (o) => parseManimScript(generateManimScript(makeProject([o])), SW, SH).objects[0];
  it('emits DoubleArrow', () => {
    const s = script(makeObj('double_arrow', { width: 200, fill: '#ef4444' }));
    expect(s).toMatch(/= DoubleArrow\(start=LEFT \* [\d.]+, end=RIGHT \* [\d.]+, color="#ef4444"/);
  });
  it('round-trips type + width', () => {
    const o = roundTrip(makeObj('double_arrow', { width: 200, fill: '#ef4444' }));
    expect(o.type).toBe('double_arrow');
    expect(o.width).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-codegen.test.js`
Expected: FAIL on the 2 double_arrow tests.

- [ ] **Step 3: Add the manim.js generator case**

```js
    case 'double_arrow': {
      const half = (obj.width / 2 / sw * FRAME_WIDTH).toFixed(3);
      lines.push(`${n} = DoubleArrow(start=LEFT * ${half}, end=RIGHT * ${half}, color=${hex(obj.fill) || '"#EF4444"'}, buff=0, stroke_width=${sw2})`);
      break;
    }
```

- [ ] **Step 4: Add the manim.js parser branch**

```js
    // DoubleArrow
    m = line.match(/^(\w+)\s*=\s*DoubleArrow\(start=LEFT \* ([\d.]+), end=RIGHT \* ([\d.]+), color=["']([^"']+)["']/);
    if (m) {
      const [, name, half, , color] = m;
      const width = Math.round(parseFloat(half) * 2 / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'double_arrow', name, x: sw / 2, y: sh / 2, width, height: 40,
        fill: color, stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }
```

- [ ] **Step 5: Add `double_arrow` to DASH_TYPES (both files)**

Append `'double_arrow'` to the `DASH_TYPES` set literal in `manim.js`. Mirror in codegen.js in Step 7.

- [ ] **Step 6: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-codegen.test.js`
Expected: PASS (all 8 geometry codegen tests). Also run the existing export suite to confirm no regression:
Run: `cd services/web && npx vitest run tests/components/manim-export.test.js`
Expected: PASS.

- [ ] **Step 7: Mirror into codegen.js**

Paste the identical `case 'double_arrow':` block into `codegen.js` and append `'double_arrow'` to its `DASH_TYPES`. Verify:
```bash
cd "D:/PYTHON/Manim-Editor" && node --check services/api/src/compiler/codegen.js && echo OK
```

- [ ] **Step 8: Commit**

```bash
git add services/web/src/export/manim.js services/api/src/compiler/codegen.js services/web/tests/components/phase2-geometry-codegen.test.js
git commit -m "feat(codegen): double_arrow shape + round-trip"
```

---

## Task 6: Konva canvas preview for all four shapes

No unit test exists for `StageCanvas.vue` configs; verify via a production build (compiles the SFC, catches scope/syntax errors). vue-konva auto-registers `v-ring`, `v-wedge`, `v-shape`, `v-arrow`.

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue` (template object-render block ~34-115; shape cfg functions ~706-830)

- [ ] **Step 1: Add cfg functions**

In `StageCanvas.vue` `<script setup>`, near the other shape cfg functions (after `arrowCfg` ~787), add. (`s2c(px,py)` → canvas coords; `vs.value` = zoom; `eff(obj)` = animated object; `applyEffects` adds Phase-1 effects.)

```js
function annulusCfg(obj) {
  const e = eff(obj); const c = s2c(e.x, e.y);
  const cfg = { x: c.x, y: c.y, innerRadius: (obj.innerRadius || 35) * vs.value, outerRadius: (obj.outerRadius || 70) * vs.value,
    fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1,
    rotation: e.rotation || 0, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  const d = (obj.outerRadius || 70) * 2;
  return applyEffects(cfg, obj, d, d, true);
}
function sectorCfg(obj) {
  const e = eff(obj); const c = s2c(e.x, e.y);
  const cfg = { x: c.x, y: c.y, radius: (obj.radius || 70) * vs.value, angle: obj.sweepAngle || 90, rotation: (obj.startAngle || 0) + (e.rotation || 0),
    fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1,
    draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  const d = (obj.radius || 70) * 2;
  return applyEffects(cfg, obj, d, d, true);
}
function arcCfg(obj) {
  const e = eff(obj); const c = s2c(e.x, e.y);
  const r = (obj.radius || 70) * vs.value;
  const a0 = (obj.startAngle || 0) * Math.PI / 180;
  const a1 = ((obj.startAngle || 0) + (obj.sweepAngle || 180)) * Math.PI / 180;
  const cfg = { x: c.x, y: c.y, stroke: e.stroke || '#f97316', strokeWidth: (e.strokeWidth || 4) * vs.value / 2,
    opacity: e.opacity ?? 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 12,
    sceneFunc: (ctx, shape) => { ctx.beginPath(); ctx.arc(0, 0, r, -a1, -a0); ctx.strokeShape(shape); } };
  return applyEffects(cfg, obj, r * 2, r * 2, true);
}
function doubleArrowCfg(obj) {
  const e = eff(obj); const c = s2c(e.x, e.y); const half = (e.width || 200) / 2 * vs.value;
  const cfg = { x: c.x, y: c.y, points: [-half, 0, half, 0], pointerAtBeginning: true, pointerAtEnding: true,
    pointerLength: 10, pointerWidth: 10, fill: e.fill || '#ef4444', stroke: e.fill || '#ef4444',
    strokeWidth: (e.strokeWidth || 2) * vs.value / 2 + 2, opacity: e.opacity ?? 1, rotation: e.rotation || 0,
    draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 12 };
  return applyEffects(cfg, obj, e.width || 200, 0, false);
}
```

> Note: Konva is y-down / clockwise; Manim is y-up / counter-clockwise. `arcCfg` negates the angles so the preview sweeps the same visual direction; `sectorCfg`'s sweep is an accepted preview≈render approximation (document only).

- [ ] **Step 2: Add template render elements**

In the template object loop, after the `arrow` line (~61), add:
```html
            <v-ring v-if="obj.type === 'annulus' && isVis(obj.id)" :config="annulusCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />
            <v-wedge v-if="obj.type === 'sector' && isVis(obj.id)" :config="sectorCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />
            <v-shape v-if="obj.type === 'arc' && isVis(obj.id)" :config="arcCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />
            <v-arrow v-if="obj.type === 'double_arrow' && isVis(obj.id)" :config="doubleArrowCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />
```

- [ ] **Step 3: Verify with a production build**

Run: `cd services/web && npm run build`
Expected: build succeeds, no errors. Then confirm the component suite still passes:
Run: `cd services/web && npx vitest run tests/components/`
Expected: all pass.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run `cd services/web && npm run dev`; add each of annulus/arc/sector/double_arrow from the sidebar and confirm they render and drag on the canvas.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): preview annulus/arc/sector/double_arrow"
```

---

## Task 7: Inspector panels for the four shapes

**Files:**
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (shape-specific sections; `GRADIENT_TYPES`/`DASH_TYPES`/effect gating sets ~696)
- Test: `services/web/tests/components/phase2-geometry-inspector.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-geometry-inspector.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
});

describe('phase 2 geometry inspector', () => {
  it('shows inner/outer radius for annulus', () => {
    store.addObject('annulus', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    expect(mount(PropertiesPanel).html()).toContain('Inner radius');
  });
  it('shows sweep angle for sector', () => {
    store.addObject('sector', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    expect(mount(PropertiesPanel).html()).toContain('Sweep');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-inspector.test.js`
Expected: FAIL — no "Inner radius"/"Sweep" markup.

- [ ] **Step 3: Add inspector sections**

In `PropertiesPanel.vue`, after the existing shape-specific `<Section>`s (e.g. near the polygon `sides` / star controls), add (using the existing `Section`, `Num`, and `u(prop, val)` helpers):
```html
      <Section v-if="obj.type === 'annulus'" label="Annulus">
        <div class="grid grid-cols-2 gap-1.5">
          <Num label="Inner radius" :value="obj.innerRadius || 35" :min="0" @input="u('innerRadius', $event)" />
          <Num label="Outer radius" :value="obj.outerRadius || 70" :min="1" @input="u('outerRadius', $event)" />
        </div>
      </Section>
      <Section v-if="obj.type === 'arc' || obj.type === 'sector'" :label="obj.type === 'arc' ? 'Arc' : 'Sector'">
        <div class="grid grid-cols-3 gap-1.5">
          <Num label="Radius" :value="obj.radius || 70" :min="1" @input="u('radius', $event)" />
          <Num label="Start°" :value="obj.startAngle || 0" @input="u('startAngle', $event)" />
          <Num label="Sweep°" :value="obj.sweepAngle || 90" @input="u('sweepAngle', $event)" />
        </div>
      </Section>
```

- [ ] **Step 4: Add the four shapes to the effect-gating sets**

In `PropertiesPanel.vue`'s `<script setup>` (~696), update the three sets so the Effects panel shows correctly:
```js
const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector']);
const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow', 'annulus', 'sector', 'arc', 'double_arrow']);
const ROUND_TYPES = new Set(['rectangle', 'square']);
```

- [ ] **Step 5: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-geometry-inspector.test.js`
Expected: PASS (2 tests). Then full component suite + build:
Run: `cd services/web && npx vitest run tests/components/`  → all pass
Run: `cd services/web && npm run build` → succeeds

- [ ] **Step 6: Commit**

```bash
git add services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/phase2-geometry-inspector.test.js
git commit -m "feat(inspector): annulus/arc/sector panels + effect gating"
```

---

## Task 8: Full-suite verification

- [ ] **Step 1: Run both suites**

```bash
cd services/web && npx vitest run tests/components/
cd services/web && npm test
```
Expected: both green (new geometry tests included; engine suite unchanged at 114). If either fails, STOP and report.

- [ ] **Step 2: Confirm codegen.js parity by eye**

```bash
cd "D:/PYTHON/Manim-Editor" && grep -n "Annulus\|= Arc(\|Sector(\|DoubleArrow" services/api/src/compiler/codegen.js services/web/src/export/manim.js
```
Expected: the four constructor template strings appear identically (same right-hand sides) in both files.

- [ ] **Step 3: Commit (if any stray changes)**

```bash
git add -A && git commit -m "chore: phase2 plan1 geometry primitives verification" --allow-empty
```

---

## Self-Review Notes

- **Spec coverage (Plan 1 subset):** annulus (Tasks 1,2,6,7), arc (1,3,6,7), sector (1,4,6,7), double_arrow (1,5,6). Store/sidebar → Task 1; codegen+parser+parity → Tasks 2-5; Konva preview → Task 6; inspector + effect-set gating → Task 7; verification → Task 8. polygon_free, parametric, area/Riemann, matrix are **other plans** (2-4), not here.
- **Type-set consistency:** annulus+sector in GRADIENT+DASH; arc+double_arrow in DASH only — applied identically in codegen.js, manim.js, and PropertiesPanel.vue (Tasks 2-5 + 7). StageCanvas `applyEffects` gates on field presence, not type, so no set there.
- **Naming consistency:** field names (`innerRadius`/`outerRadius`, `radius`/`startAngle`/`sweepAngle`) and type strings (`annulus`/`arc`/`sector`/`double_arrow`) are identical across store seed, codegen, parser, Konva cfg, and inspector.
- **Preview≈render divergence:** Konva y-down/clockwise vs Manim y-up/counter-clockwise for arc/sector angles — `arcCfg` negates angles; sector sweep is an accepted approximation (documented in Task 6).
- **Round-trip:** each shape has a generate→parse test asserting type + key fields survive. The `double_arrow` parser uses the `LEFT * h / RIGHT * h` form the generator emits.
```
