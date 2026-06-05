# Phase 2 — Plan 3: Calculus Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `parametric` curve object (x(t)/y(t) + t-range) and two per-graph axes extensions — **area under curve** (`get_area`) and **Riemann rectangles** (`get_riemann_rectangles`) — with full Konva preview and `.py` round-trip.

**Architecture:** A new pure, tested `engine/mathExpr.js` compiles whitelisted expressions into JS functions exposing an `np.*`/`PI`/`TAU` scope so previews match Manim's render namespace. `parametric` is a standalone `case` arm (single-line `ParametricFunction`, parsed **before** the existing heart matcher). `area`/`riemann` are optional fields on each `axes.graphs[]` entry, emitted right after the graph's `plot(...)` in the axes case of both generators, previewed by extending the axes graph sampler, and round-tripped via a `graphVar→graph` map in the parser.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Konva.js, Vitest, Node.js codegen, Manim CE.

**Spec:** `docs/superpowers/specs/2026-06-05-phase2-geometry-calculus-objects-design.md` (Plan 3 of 4 — parametric + area/riemann).
**Branch:** `feat/phase2-calculus`.

**Run tests with:**
```bash
cd services/web && npx vitest run tests/components/   # Vitest — this plan's tests
cd services/web && npm test                           # Node engine tests — must stay green
```

## Conventions

- Expression whitelist (must stay in sync across `codegen.js` `safeMathExpr`, `manim.js` `safeMathExpr`, and `engine/mathExpr.js`): chars `^[0-9a-zA-Z()+\-*/.%^, ]*$`, reject `import|eval|exec|open|__`.
- Field shapes:
  ```js
  parametric  → { xExpr, yExpr, tMin, tMax }          // expressions in t; tMin/tMax numbers
  graph.area    = { enabled, xMin, xMax, opacity, color }
  graph.riemann = { enabled, xMin, xMax, dx, type, color }  // type: 'left'|'right'|'center'
  ```
- codegen.js and manim.js emit **byte-identical** construction strings.
- `parametric` joins `DASH_TYPES` only (open stroked curve, no gradient).

---

## Task 1: Pure expression compiler `engine/mathExpr.js`

**Files:**
- Create: `services/web/src/engine/mathExpr.js`
- Test: `services/web/tests/components/math-expr.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/math-expr.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { isSafeExpr, compileExpr } from '../../src/engine/mathExpr.js';

describe('mathExpr', () => {
  it('compiles a polynomial in x', () => {
    expect(compileExpr('x**2', 'x')(3)).toBe(9);
  });
  it('exposes np.* and PI so previews match the render namespace', () => {
    expect(compileExpr('np.cos(t)', 't')(0)).toBeCloseTo(1);
    expect(compileExpr('np.sin(t)', 't')(Math.PI / 2)).toBeCloseTo(1);
    expect(compileExpr('PI', 't')(0)).toBeCloseTo(Math.PI);
  });
  it('rejects unsafe input (isSafeExpr false → compile null)', () => {
    expect(isSafeExpr('a; b')).toBe(false);
    expect(compileExpr('__import__("os")', 'x')).toBeNull();
  });
  it('returns null for an undefined function (reference error)', () => {
    expect(compileExpr('foo(x)', 'x')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/math-expr.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `services/web/src/engine/mathExpr.js`:
```js
/**
 * Whitelisted math-expression compiler for canvas previews.
 * Exposes an `np.*` + PI/TAU/E scope so a preview evaluates the same names
 * Manim resolves at render time (numpy as np, manim PI/TAU).
 * Whitelist must stay in sync with safeMathExpr() in codegen.js and manim.js.
 */
const SCOPE =
  'const np={sin:Math.sin,cos:Math.cos,tan:Math.tan,arcsin:Math.asin,arccos:Math.acos,' +
  'arctan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,log:Math.log,sign:Math.sign,' +
  'power:Math.pow,floor:Math.floor,ceil:Math.ceil,pi:Math.PI,e:Math.E};' +
  'const PI=Math.PI,TAU=2*Math.PI,E=Math.E;';

export function isSafeExpr(expr) {
  if (!expr || typeof expr !== 'string') return false;
  const e = expr.trim();
  if (!e) return false;
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(e)) return false;
  if (/import|eval|exec|open|__/.test(e)) return false;
  return true;
}

/** Returns a `(v) => number` function, or null if the expression is unsafe or won't evaluate. */
export function compileExpr(expr, varName = 'x') {
  if (!isSafeExpr(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(varName, '"use strict";' + SCOPE + 'return (' + expr.trim() + ');');
    const probe = fn(1);                 // reject ReferenceError (undefined functions) early
    if (typeof probe !== 'number') return null;
    return fn;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/math-expr.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/engine/mathExpr.js services/web/tests/components/math-expr.test.js
git commit -m "feat(engine): whitelisted math-expression compiler with np scope"
```

---

## Task 2: Store — parametric defaults, seed, sidebar

**Files:**
- Modify: `services/web/src/store/project.js` (`SHAPE_DEFAULTS`, `SHAPE_COLORS`, `nameMap`, seed block)
- Modify: `services/web/src/components/sidebar/AssetSidebar.vue` (`shapes`)
- Test: `services/web/tests/components/phase2-parametric-store.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-parametric-store.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('parametric store', () => {
  it('seeds xExpr/yExpr/tMin/tMax', () => {
    store.addObject('parametric', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('parametric');
    expect(typeof o.xExpr).toBe('string');
    expect(typeof o.yExpr).toBe('string');
    expect(o.tMin).toBe(0);
    expect(o.tMax).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-parametric-store.test.js`

- [ ] **Step 3: Implement store changes** in `services/web/src/store/project.js`:

In `SHAPE_DEFAULTS` (after `polygon:`):
```js
  parametric: { width: 160, height: 160, fill: 'transparent', stroke: '#10b981', strokeWidth: 4 },
```
In `SHAPE_COLORS`:
```js
  parametric: '#10b981',
```
In `nameMap`:
```js
        parametric: 'Parametric',
```
In the `addObject` seed block (after the `star` seed):
```js
        ...(type === 'parametric' ? { xExpr: 'np.cos(t)', yExpr: 'np.sin(t)', tMin: 0, tMax: 6.283 } : {}),
```

- [ ] **Step 4: Add sidebar button** in `services/web/src/components/sidebar/AssetSidebar.vue` `shapes`:
```js
  { type: 'parametric', label: 'Parametric', color: '#10b981', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18c4 0 4-12 8-12s4 12 8 12"/></svg>' },
```

- [ ] **Step 5: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-parametric-store.test.js` → 1 pass. Then `cd services/web && npx vitest run tests/components/` → all pass.

- [ ] **Step 6: Commit**

```bash
git add services/web/src/store/project.js services/web/src/components/sidebar/AssetSidebar.vue services/web/tests/components/phase2-parametric-store.test.js
git commit -m "feat(store): parametric defaults + seed + sidebar"
```

---

## Task 3: Parametric codegen + round-trip (before the heart matcher)

`safeMathExpr` gains an optional `fallback` param so parametric can default to `t`/`0` instead of `x**2`. The heart already emits `ParametricFunction(` (multi-line), so the single-line `parametric` parser must run **before** the heart parser (`manim.js` ~line 1306).

**Files:**
- Modify: `services/web/src/export/manim.js`, `services/api/src/compiler/codegen.js`
- Test: `services/web/tests/components/phase2-parametric-codegen.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-parametric-codegen.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1', type: 'parametric', x: SW / 2, y: SH / 2, width: 160, height: 160,
    xExpr: 'np.cos(t)', yExpr: 'np.sin(t)', tMin: 0, tMax: 6.283,
    fill: 'transparent', stroke: '#10b981', strokeWidth: 4, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}

describe('parametric codegen', () => {
  it('emits single-line ParametricFunction with t_range', () => {
    const s = generateManimScript(makeProject([makeObj()]));
    expect(s).toMatch(/= ParametricFunction\(lambda t: np\.array\(\[np\.cos\(t\), np\.sin\(t\), 0\]\), t_range=\[0, 6\.283\], color="#10b981", stroke_width=4\)/);
  });
  it('round-trips type + expressions + t-range', () => {
    const o = parseManimScript(generateManimScript(makeProject([makeObj()])), SW, SH).objects[0];
    expect(o.type).toBe('parametric');
    expect(o.xExpr).toBe('np.cos(t)');
    expect(o.yExpr).toBe('np.sin(t)');
    expect(o.tMax).toBeCloseTo(6.283, 2);
  });
  it('rejects an unsafe expression (falls back to t / 0)', () => {
    const s = generateManimScript(makeProject([makeObj({ xExpr: '__import__("os")' })]));
    expect(s).not.toContain('__import__');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-parametric-codegen.test.js`

- [ ] **Step 3: Add the `fallback` param to `safeMathExpr`** (both files)

In `services/web/src/export/manim.js`, change:
```js
function safeMathExpr(expr) {
  if (!expr || typeof expr !== 'string') return 'x**2';
  const t = expr.trim();
  if (!t) return 'x**2';
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(t)) return 'x**2';
  if (/import|eval|exec|open|__/.test(t)) return 'x**2';
  return t;
}
```
to:
```js
function safeMathExpr(expr, fallback = 'x**2') {
  if (!expr || typeof expr !== 'string') return fallback;
  const t = expr.trim();
  if (!t) return fallback;
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(t)) return fallback;
  if (/import|eval|exec|open|__/.test(t)) return fallback;
  return t;
}
```
(Existing graph callers pass one arg → fallback `'x**2'`, unchanged.) Apply the **identical** change to `services/api/src/compiler/codegen.js`'s `safeMathExpr`.

- [ ] **Step 4: Add the manim.js generator case**

In `objCode`'s switch, after `case 'polygon_free':` (or any shape case, before `default:`), add:
```js
    case 'parametric': {
      const xe = safeMathExpr(obj.xExpr, 't');
      const ye = safeMathExpr(obj.yExpr, '0');
      const t0 = Number.isFinite(obj.tMin) ? obj.tMin : 0;
      const t1 = Number.isFinite(obj.tMax) ? obj.tMax : 6.283;
      const col = hex(obj.stroke) || hex(obj.fill) || '"#10B981"';
      lines.push(`${n} = ParametricFunction(lambda t: np.array([${xe}, ${ye}, 0]), t_range=[${t0}, ${t1}], color=${col}, stroke_width=${sw2})`);
      break;
    }
```

- [ ] **Step 5: Add the manim.js parser branch BEFORE the heart matcher**

In `parseManimScript`, find the heart matcher `m = line.match(/^(\w+)\s*=\s*ParametricFunction\(/);` (~line 1306). **Immediately before it**, add:
```js
    // ParametricFunction (single-line parametric object) — must precede the heart matcher
    m = line.match(/^(\w+)\s*=\s*ParametricFunction\(lambda t: np\.array\(\[(.+?), (.+?), 0\]\), t_range=\[([-\d.]+), ([-\d.]+)\], color=["']([^"']+)["'], stroke_width=([\d.]+)\)/);
    if (m) {
      const [, name, xe, ye, t0, t1, color, sw_] = m;
      const id = uid('obj');
      const obj = { id, type: 'parametric', name, x: sw / 2, y: sh / 2, width: 160, height: 160,
        xExpr: xe.trim(), yExpr: ye.trim(), tMin: parseFloat(t0), tMax: parseFloat(t1),
        fill: 'transparent', stroke: color, strokeWidth: parseFloat(sw_), opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }
```
(The heart's `ParametricFunction(` line has the lambda on the **next** line, so this single-line regex won't match it — heart falls through to its own matcher.)

- [ ] **Step 6: Add `parametric` to DASH_TYPES** (both files)

In `manim.js`, append `'parametric'` to the `DASH_TYPES` Set only (open curve — not GRADIENT_TYPES).

- [ ] **Step 7: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-parametric-codegen.test.js` → 3 pass. Then `cd services/web && npx vitest run tests/components/manim-export.test.js` → green (heart still round-trips).

- [ ] **Step 8: Mirror into codegen.js**

Paste the IDENTICAL `case 'parametric':` block into `services/api/src/compiler/codegen.js` `objectCode` switch, and append `'parametric'` to its `DASH_TYPES`. (codegen.js has no parser — skip the parser step there.) Verify:
```bash
cd "D:/PYTHON/Manim-Editor" && node --check services/api/src/compiler/codegen.js && echo OK
```

- [ ] **Step 9: Commit**

```bash
git add services/web/src/export/manim.js services/api/src/compiler/codegen.js services/web/tests/components/phase2-parametric-codegen.test.js
git commit -m "feat(codegen): parametric ParametricFunction + round-trip (pre-heart)"
```

---

## Task 4: Parametric Konva preview

Sample x(t)/y(t) in Manim units (via `compileExpr`), convert to canvas px (1 Manim unit = `stageWidth / 14.222` px × zoom), draw a polyline. No unit test (cfg) — verify via build; the math core is tested in Task 1.

**Files:** Modify `services/web/src/components/stage/StageCanvas.vue` (import; cfg fn near `polygonFreeCfg`; template).

- [ ] **Step 1: Add import + cfg function**

In `<script setup>`, add the import (with other imports):
```js
import { compileExpr } from '../../engine/mathExpr.js';
```
After `polygonFreeCfg`, add:
```js
function parametricCfg(obj) {
  const e = eff(obj); const c = s2c(e.x, e.y);
  const fx = compileExpr(obj.xExpr || 'np.cos(t)', 't');
  const fy = compileExpr(obj.yExpr || 'np.sin(t)', 't');
  const t0 = Number.isFinite(obj.tMin) ? obj.tMin : 0;
  const t1 = Number.isFinite(obj.tMax) ? obj.tMax : 6.283;
  const unit = (store.project.stage.width / 14.222) * vs.value;   // px per Manim unit
  const pts = [];
  if (fx && fy && t1 > t0) {
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (t1 - t0) * (i / steps);
      const x = fx(t), y = fy(t);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push(x * unit, -y * unit);   // y-flip
    }
  }
  return { x: c.x, y: c.y, points: pts, stroke: e.stroke || '#10b981',
    strokeWidth: (e.strokeWidth || 4) * vs.value / 2, opacity: e.opacity ?? 1, tension: 0.3,
    rotation: e.rotation || 0, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 12, lineCap: 'round' };
}
```

- [ ] **Step 2: Add the template element**

In the object loop, after the `polygon_free` `<v-line>` line, add (drag-only):
```html
            <v-line v-if="obj.type === 'parametric' && isVis(obj.id)" :config="parametricCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />
```

- [ ] **Step 3: Verify build + tests**

```bash
cd services/web && npm run build
cd services/web && npx vitest run tests/components/
```
Expected: build succeeds; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): parametric curve preview"
```

---

## Task 5: Parametric inspector panel

**Files:**
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (section + DASH gating)
- Test: `services/web/tests/components/phase2-parametric-inspector.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-parametric-inspector.test.js`:
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
  store.commitState();
  store.addObject('parametric', 960, 540);
  id = store.project.objects[0].id;
  store.selectObject(id);
});

describe('parametric inspector', () => {
  it('shows x(t) and y(t) inputs', () => {
    const html = mount(PropertiesPanel).html();
    expect(html).toContain('x(t)');
    expect(html).toContain('y(t)');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-parametric-inspector.test.js`

- [ ] **Step 3: Add the inspector section** — in `PropertiesPanel.vue`, after the existing shape-specific sections, add (uses `obj` computed + `u(prop, val)` helper; for the expression text inputs use `@change` with the raw string):
```html
      <Section v-if="obj.type === 'parametric'" label="Parametric">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-8">x(t)</span>
            <input class="input input-sm flex-1" :value="obj.xExpr" @change="u('xExpr', $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-8">y(t)</span>
            <input class="input input-sm flex-1" :value="obj.yExpr" @change="u('yExpr', $event.target.value)" />
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <Num label="t min" :value="obj.tMin ?? 0" @input="u('tMin', $event)" />
            <Num label="t max" :value="obj.tMax ?? 6.283" @input="u('tMax', $event)" />
          </div>
        </div>
      </Section>
```
READ how existing text inputs bind (`input input-sm` class + `@change`) and match it.

- [ ] **Step 4: Add `parametric` to the DASH_TYPES gating set** in `PropertiesPanel.vue` `<script setup>` (~696) — append `'parametric'` to `DASH_TYPES` (not GRADIENT/ROUND).

- [ ] **Step 5: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-parametric-inspector.test.js` → 1 pass. Then `cd services/web && npx vitest run tests/components/` + `cd services/web && npm run build` → green.

- [ ] **Step 6: Commit**

```bash
git add services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/phase2-parametric-inspector.test.js
git commit -m "feat(inspector): parametric x(t)/y(t)/t-range panel"
```

---

## Task 6: Area + Riemann codegen + round-trip

`area`/`riemann` are optional fields on each `axes.graphs[]` entry. Emitted right after the graph's `plot(...)` line inside the axes `case` (both generators), and added to the scene there. Round-tripped via a `graphVar→graph` map in the parser.

**Files:**
- Modify: `services/web/src/export/manim.js` (axes case ~388-396; `.plot` parser ~1379; parser init), `services/api/src/compiler/codegen.js` (axes case ~361-368)
- Test: `services/web/tests/components/phase2-area-riemann-codegen.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-area-riemann-codegen.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function axesObj(graphs) {
  return { id: 'a1', type: 'axes', x: SW / 2, y: SH / 2, width: 400, height: 300,
    xRange: [-5, 5, 1], yRange: [-3, 3, 1], graphs,
    fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none' };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}
const graph = (extra) => ({ id: 'g1', expression: 'x**2', color: '#f59e0b', xMin: -2, xMax: 2, strokeWidth: 3, ...extra });

describe('area + riemann codegen', () => {
  it('emits get_area when area.enabled', () => {
    const s = generateManimScript(makeProject([axesObj([graph({ area: { enabled: true, xMin: -2, xMax: 2, opacity: 0.5, color: '#f59e0b' } })])]));
    expect(s).toMatch(/= \w+\.get_area\(\w+, x_range=\[-2, 2\], color="#f59e0b", opacity=0\.5\)/);
  });
  it('emits get_riemann_rectangles when riemann.enabled', () => {
    const s = generateManimScript(makeProject([axesObj([graph({ riemann: { enabled: true, xMin: -2, xMax: 2, dx: 0.5, type: 'left', color: '#f59e0b' } })])]));
    expect(s).toMatch(/= \w+\.get_riemann_rectangles\(\w+, x_range=\[-2, 2\], dx=0\.5, input_sample_type="left", color="#f59e0b"\)/);
  });
  it('round-trips area + riemann onto the graph', () => {
    const proj = makeProject([axesObj([graph({
      area: { enabled: true, xMin: -2, xMax: 2, opacity: 0.5, color: '#f59e0b' },
      riemann: { enabled: true, xMin: -2, xMax: 2, dx: 0.5, type: 'left', color: '#f59e0b' } })])]);
    const o = parseManimScript(generateManimScript(proj), SW, SH).objects[0];
    const g = o.graphs[0];
    expect(g.area.enabled).toBe(true);
    expect(g.area.xMax).toBeCloseTo(2, 2);
    expect(g.riemann.enabled).toBe(true);
    expect(g.riemann.dx).toBeCloseTo(0.5, 2);
    expect(g.riemann.type).toBe('left');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-area-riemann-codegen.test.js`

- [ ] **Step 3: Emit area/riemann in the manim.js axes case**

In `services/web/src/export/manim.js`, in the `case 'axes':` graph loop, **after** the `lines.push(\`${n}.add(${gn})\`);` line (~395), add:
```js
          if (g.area && g.area.enabled) {
            const an = `${gn}_area`;
            const axMin = Number.isFinite(g.area.xMin) ? g.area.xMin : xMin;
            const axMax = Number.isFinite(g.area.xMax) ? g.area.xMax : xMax;
            const acol = hex(g.area.color) || col;
            const aop = Number.isFinite(g.area.opacity) ? g.area.opacity : 0.5;
            lines.push(`${an} = ${n}.get_area(${gn}, x_range=[${axMin}, ${axMax}], color=${acol}, opacity=${aop})`);
            lines.push(`${n}.add(${an})`);
          }
          if (g.riemann && g.riemann.enabled) {
            const rn = `${gn}_riemann`;
            const rxMin = Number.isFinite(g.riemann.xMin) ? g.riemann.xMin : xMin;
            const rxMax = Number.isFinite(g.riemann.xMax) ? g.riemann.xMax : xMax;
            const rdx = (Number.isFinite(g.riemann.dx) && g.riemann.dx > 0) ? g.riemann.dx : ((rxMax - rxMin) / 10);
            const rtype = ['left', 'right', 'center'].includes(g.riemann.type) ? g.riemann.type : 'left';
            const rcol = hex(g.riemann.color) || col;
            lines.push(`${rn} = ${n}.get_riemann_rectangles(${gn}, x_range=[${rxMin}, ${rxMax}], dx=${rdx}, input_sample_type="${rtype}", color=${rcol})`);
            lines.push(`${n}.add(${rn})`);
          }
```

- [ ] **Step 4: Mirror into codegen.js axes case**

In `services/api/src/compiler/codegen.js` `case 'axes':`, after the graph `plot(...)` line (the `lines.push(\`${gn} = ${n}.plot(...)\`)`), paste the **identical** area + riemann blocks from Step 3 (same `const`/`lines.push` text; codegen.js's loop variable for the graph is also `gn` and `g`/`col`/`xMin`/`xMax` are in scope — read the file to confirm and adapt local names only if they differ, keeping emitted strings identical). The graph's own `axes.add(graph)` stays in the codegen scene-assembly loop; area/riemann `add` lines are emitted here (functionally fine).

- [ ] **Step 5: Add the parser graphVar map + matchers (manim.js)**

In `parseManimScript`, near the top where `varMap`/`objById` are declared, add:
```js
  const graphVarMap = {};
```
In the existing `.plot()` parser (~1379), change the push to also record the graph var. Replace:
```js
        objById[axesId].graphs.push({
          id: uid('graph').split('_').slice(-2).join('_'),
          expression: expr.trim(),
          color: color || '#F59E0B',
          xMin: parseFloat(xMin),
          xMax: parseFloat(xMax),
          strokeWidth: sw2 ? parseFloat(sw2) : 3,
        });
```
with:
```js
        const _g = {
          id: uid('graph').split('_').slice(-2).join('_'),
          expression: expr.trim(),
          color: color || '#F59E0B',
          xMin: parseFloat(xMin),
          xMax: parseFloat(xMax),
          strokeWidth: sw2 ? parseFloat(sw2) : 3,
        };
        objById[axesId].graphs.push(_g);
        graphVarMap[graphVar] = _g;
```
Then, immediately after that `.plot` `if (m) { … continue; }` block, add:
```js
    // axes.get_area(graphVar, ...)
    m = line.match(/^\w+\s*=\s*\w+\.get_area\((\w+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\](?:,\s*color=["']([^"']+)["'])?(?:,\s*opacity=([\d.]+))?\)/);
    if (m) {
      const g = graphVarMap[m[1]];
      if (g) g.area = { enabled: true, xMin: parseFloat(m[2]), xMax: parseFloat(m[3]), color: m[4] || g.color, opacity: m[5] !== undefined ? parseFloat(m[5]) : 0.5 };
      continue;
    }
    // axes.get_riemann_rectangles(graphVar, ...)
    m = line.match(/^\w+\s*=\s*\w+\.get_riemann_rectangles\((\w+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\],\s*dx=([\d.]+),\s*input_sample_type=["'](\w+)["'](?:,\s*color=["']([^"']+)["'])?\)/);
    if (m) {
      const g = graphVarMap[m[1]];
      if (g) g.riemann = { enabled: true, xMin: parseFloat(m[2]), xMax: parseFloat(m[3]), dx: parseFloat(m[4]), type: m[5], color: m[6] || g.color };
      continue;
    }
```
(The trailing `<axes>.add(<area/riemann var>)` lines match no constructor and are harmlessly ignored.)

- [ ] **Step 6: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-area-riemann-codegen.test.js` → 3 pass. Then `cd services/web && npx vitest run tests/components/manim-export.test.js` → green. Verify codegen parity:
```bash
cd "D:/PYTHON/Manim-Editor" && node --check services/api/src/compiler/codegen.js && echo OK
cd "D:/PYTHON/Manim-Editor" && grep -n "get_area\|get_riemann_rectangles" services/api/src/compiler/codegen.js services/web/src/export/manim.js
```
Expected: `OK`; the `get_area`/`get_riemann_rectangles` template strings appear identically in both files.

- [ ] **Step 7: Commit**

```bash
git add services/web/src/export/manim.js services/api/src/compiler/codegen.js services/web/tests/components/phase2-area-riemann-codegen.test.js
git commit -m "feat(codegen): axes area + riemann rectangles + round-trip"
```

---

## Task 7: Area + Riemann Konva preview

Refactor `axesGraphCurves` to compile expressions via `compileExpr` (also fixes trig graph previews), then add filled-area polygons and Riemann rectangles using the same sampling. Verify via build.

**Files:** Modify `services/web/src/components/stage/StageCanvas.vue` (`axesGraphCurves` ~1227; a new `axesAreaRiemann` fn; template axes group ~103).

- [ ] **Step 1: Refactor `axesGraphCurves` to use `compileExpr`**

In `axesGraphCurves`, replace the inline `safeExpr` IIFE + `new Function(...)` block:
```js
    let fn;
    // Validate expression before eval
    const safeExpr = (() => {
      const e = (graph.expression || '').trim();
      if (!e) return null;
      if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(e)) return null;
      if (/import|eval|exec|open|__/.test(e)) return null;
      return e;
    })();
    if (!safeExpr) continue;
    try {
      // eslint-disable-next-line no-new-func
      fn = new Function('x', `"use strict"; return (${safeExpr});`);
    } catch { continue; }
```
with:
```js
    const fn = compileExpr(graph.expression, 'x');
    if (!fn) continue;
```
(`compileExpr` is imported in Task 4.)

- [ ] **Step 2: Add the area/riemann shape builder**

After `axesGraphCurves`, add a function that returns Konva configs for area fills and Riemann bars (axes-local coords, same transform as `axesGraphCurves`):
```js
function axesAreaRiemann(obj) {
  if (!obj.graphs || obj.graphs.length === 0) return { areas: [], rects: [] };
  const xr = obj.xRange || [-5, 5, 1], yr = obj.yRange || [-3, 3, 1];
  const xMin = xr[0], xMax = xr[1], yMin = yr[0], yMax = yr[1];
  const pw = obj.width * vs.value, ph = obj.height * vs.value;
  const toCx = (x) => ((x - xMin) / (xMax - xMin)) * pw - pw / 2;
  const toCy = (y) => -((y - yMin) / (yMax - yMin)) * ph + ph / 2;
  const cy0 = toCy(0);
  const areas = [], rects = [];
  for (const graph of obj.graphs) {
    const fn = compileExpr(graph.expression, 'x');
    if (!fn) continue;
    if (graph.area && graph.area.enabled) {
      const a0 = Number.isFinite(graph.area.xMin) ? graph.area.xMin : xMin;
      const a1 = Number.isFinite(graph.area.xMax) ? graph.area.xMax : xMax;
      const pts = [];
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const x = a0 + (a1 - a0) * (i / steps); const y = fn(x);
        if (!Number.isFinite(y)) continue;
        pts.push(toCx(x), toCy(y));
      }
      if (pts.length >= 4) {
        pts.push(toCx(a1), cy0, toCx(a0), cy0);   // close down to the x-axis
        areas.push({ points: pts, closed: true, fill: graph.area.color || graph.color || '#f59e0b',
          opacity: graph.area.opacity ?? 0.5, listening: false });
      }
    }
    if (graph.riemann && graph.riemann.enabled) {
      const r0 = Number.isFinite(graph.riemann.xMin) ? graph.riemann.xMin : xMin;
      const r1 = Number.isFinite(graph.riemann.xMax) ? graph.riemann.xMax : xMax;
      const dx = (Number.isFinite(graph.riemann.dx) && graph.riemann.dx > 0) ? graph.riemann.dx : (r1 - r0) / 10;
      const type = graph.riemann.type || 'left';
      for (let x = r0; x < r1 - 1e-9; x += dx) {
        const sx = type === 'right' ? x + dx : type === 'center' ? x + dx / 2 : x;
        const y = fn(sx);
        if (!Number.isFinite(y)) continue;
        const left = toCx(x), right = toCx(Math.min(x + dx, r1));
        rects.push({ x: left, y: toCy(y), width: right - left, height: cy0 - toCy(y),
          fill: graph.riemann.color || graph.color || '#f59e0b', opacity: 0.45,
          stroke: '#fff', strokeWidth: 0.5, listening: false });
      }
    }
  }
  return { areas, rects };
}
```

- [ ] **Step 3: Render them in the axes group template**

In the axes group (where `<v-line v-for="(gc, gi) in axesGraphCurves(obj)" ...>` is, ~line 103), add **before** that graph-curve line (so areas/bars render under the curve):
```html
              <v-line v-for="(ar, ai) in axesAreaRiemann(obj).areas" :key="'ar'+ai" :config="ar" />
              <v-rect v-for="(rr, ri) in axesAreaRiemann(obj).rects" :key="'rr'+ri" :config="rr" />
```

- [ ] **Step 4: Verify build + tests**

```bash
cd services/web && npm run build
cd services/web && npx vitest run tests/components/
```
Expected: build succeeds; all tests pass (the `axesGraphCurves` refactor must not break existing graph tests).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): area-under-curve fill + Riemann rectangle preview"
```

---

## Task 8: Area + Riemann inspector controls

Add per-graph area/riemann toggles to the existing axes graph editor. Toggling sets `graph.area`/`graph.riemann` via the existing `store.updateGraph(objId, graphId, updates)` action (merge — enabled flag drives codegen).

**Files:**
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (graph editor ~300-325; handlers near `addGraph` ~792)
- Test: `services/web/tests/components/phase2-area-riemann-inspector.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/phase2-area-riemann-inspector.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store, id, gid;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
  store.addObject('axes', 960, 540);
  id = store.project.objects[0].id;
  store.addGraph(id, { expression: 'x**2' });
  gid = store.objectById(id).graphs[0].id;
  store.selectObject(id);
});

describe('area/riemann inspector', () => {
  it('shows Area and Riemann toggles per graph', () => {
    const html = mount(PropertiesPanel).html();
    expect(html).toContain('Area');
    expect(html).toContain('Riemann');
  });
  it('toggling Area calls updateGraph with an enabled area', async () => {
    const spy = vi.spyOn(store, 'updateGraph');
    const w = mount(PropertiesPanel);
    await w.find('[data-test="graph-area-toggle"]').trigger('click');
    expect(spy).toHaveBeenCalled();
    const areaArg = spy.mock.calls.find(c => c[2] && c[2].area)?.[2].area;
    expect(areaArg.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd services/web && npx vitest run tests/components/phase2-area-riemann-inspector.test.js`

- [ ] **Step 3: Add handlers** — in `PropertiesPanel.vue` `<script setup>`, near `addGraph`/`removeGraph` (~792):
```js
function toggleGraphArea(graph) {
  if (!obj.value) return;
  const on = !(graph.area && graph.area.enabled);
  store.updateGraph(obj.value.id, graph.id, { area: { enabled: on, xMin: graph.xMin, xMax: graph.xMax, opacity: 0.5, color: graph.color } });
}
function toggleGraphRiemann(graph) {
  if (!obj.value) return;
  const on = !(graph.riemann && graph.riemann.enabled);
  store.updateGraph(obj.value.id, graph.id, { riemann: { enabled: on, xMin: graph.xMin, xMax: graph.xMax, dx: Math.max(0.1, (graph.xMax - graph.xMin) / 10), type: 'left', color: graph.color } });
}
function setRiemannField(graph, key, val) {
  if (!obj.value || !graph.riemann) return;
  store.updateGraph(obj.value.id, graph.id, { riemann: { ...graph.riemann, [key]: val } });
}
```

- [ ] **Step 4: Add controls to the graph row** — in the per-graph block in the template (inside `v-for="graph in (obj.graphs || [])"`, after the x min/max row ~318), add:
```html
          <div class="flex items-center gap-2 mt-1">
            <button data-test="graph-area-toggle" class="text-[10px] px-1.5 py-0.5 rounded border border-studio-border" :class="graph.area && graph.area.enabled ? 'text-studio-accent' : 'text-studio-text-muted'" @click="toggleGraphArea(graph)">Area</button>
            <button class="text-[10px] px-1.5 py-0.5 rounded border border-studio-border" :class="graph.riemann && graph.riemann.enabled ? 'text-studio-accent' : 'text-studio-text-muted'" @click="toggleGraphRiemann(graph)">Riemann</button>
          </div>
          <div v-if="graph.riemann && graph.riemann.enabled" class="grid grid-cols-2 gap-1.5 mt-1">
            <Num label="dx" :value="graph.riemann.dx" :min="0.05" :step="0.05" @input="setRiemannField(graph, 'dx', $event)" />
            <div>
              <span class="text-[9px] text-studio-text-muted/50">Sample</span>
              <select class="select text-xs" :value="graph.riemann.type" @change="setRiemannField(graph, 'type', $event.target.value)">
                <option value="left">left</option>
                <option value="right">right</option>
                <option value="center">center</option>
              </select>
            </div>
          </div>
```
READ the existing graph row markup to match indentation/classes.

- [ ] **Step 5: Run to verify PASS**

Run: `cd services/web && npx vitest run tests/components/phase2-area-riemann-inspector.test.js` → 2 pass. Then full suite + build:
```bash
cd services/web && npx vitest run tests/components/
cd services/web && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/phase2-area-riemann-inspector.test.js
git commit -m "feat(inspector): per-graph area + Riemann controls"
```

---

## Task 9: Full-suite verification

- [ ] **Step 1: Run both suites + build**

```bash
cd services/web && npx vitest run tests/components/
cd services/web && npm test
cd services/web && npm run build
```
Expected: all green; build clean. If any fail, STOP and report.

- [ ] **Step 2: Confirm generator parity**

```bash
cd "D:/PYTHON/Manim-Editor" && grep -n "ParametricFunction(lambda\|get_area\|get_riemann_rectangles" services/api/src/compiler/codegen.js services/web/src/export/manim.js
```
Expected: the parametric, get_area, and get_riemann_rectangles template strings appear identically in both files.

- [ ] **Step 3: Commit (allow empty)**

```bash
git commit --allow-empty -m "chore: phase2 plan3 calculus verification"
```

---

## Self-Review Notes

- **Spec coverage:** parametric data model + seed → Tasks 1,2; ParametricFunction codegen single-line + round-trip (pre-heart) → Task 3; parametric preview → Task 4; parametric inspector → Task 5; area/riemann codegen + round-trip → Task 6; area/riemann preview → Task 7; area/riemann inspector → Task 8; security whitelist (compileExpr + safeMathExpr fallback) → Tasks 1,3; verification → Task 9.
- **Security:** the whitelist lives in `engine/mathExpr.js` (`isSafeExpr`/`compileExpr`, tested), `codegen.js` `safeMathExpr`, and `manim.js` `safeMathExpr` — 3 synced copies per CLAUDE.md. `axesGraphCurves` no longer has its own inline copy (now uses `compileExpr`). Parametric exprs pass `safeMathExpr(_, 't'/'0')`; unsafe input falls back (tested in Task 3).
- **Heart collision:** the parametric parser (single-line, requires `lambda t: np.array([…]), t_range=…` on one line) runs **before** the heart matcher; heart's multi-line `ParametricFunction(` line won't match it (Task 3 Step 5). The manim-export heart round-trip test guards this.
- **Parity:** parametric case + area/riemann construction strings are byte-identical between codegen.js and manim.js. The `.add()` placement for area/riemann is inside the axes case in both files (functionally fine; the graph's own add stays where each file already puts it).
- **Round-trip:** area/riemann attach to the parsed graph via `graphVarMap` (graphVar → graph object reference). Naming consistency: `graph.area`/`graph.riemann` with `{enabled, xMin, xMax, opacity|dx, type, color}`; type values `left`/`right`/`center` (Manim's `input_sample_type`).
- **Preview unit:** parametric converts Manim units → canvas px via `stageWidth / 14.222 * vs` (1 Manim unit spans FRAME_WIDTH over the stage width). Curve size is expression-defined (not width-scaled) — documented limitation.
```
