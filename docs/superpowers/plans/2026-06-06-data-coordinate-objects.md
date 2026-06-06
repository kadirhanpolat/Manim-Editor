# Data & Coordinate Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five new Manim object types to the editor — `table` (Table/MathTable), `complex_plane`, `polar_plane`, `graph` (manual-layout vertices+edges, directed), and `vector_field` (ArrowVectorField) — each with byte-identical codegen.js/manim.js emission, Konva preview, `.py` round-trip, store actions, inspector controls, and tests.

**Architecture:** Each object follows the established add-an-object pattern. New fields/types are optional ⇒ existing projects re-render byte-identically. `codegen.js` (server, not Vitest-importable) and `manim.js` (client + reverse parser) emit identical strings, guarded by `manim-export.test.js`. `table` reuses Matrix's 2D-array model + `safeMatrixEntry` + grid editor; the planes mirror `numberplane`; `graph` reuses the relational/`polygon_free` draggable-handle pattern; `vector_field` reuses `safeMathExpr` + the `parametric` preview sampler.

**Tech Stack:** Vue 3 (`<script setup>`), Pinia, Konva.js, Vitest, Node.js codegen, Manim CE Python.

**Spec:** `docs/superpowers/specs/2026-06-06-data-coordinate-objects-design.md`

**Branch:** Branch off `main` (coord-unify is merged; `FRAME_WIDTH` + all prior phases are on `main`).

**Conventions used throughout:**
- Real generator exports: `generateManimScript`, `parseManimScript` from `services/web/src/export/manim.js`.
- Run unit tests: `cd services/web && npm run test:unit`. Engine tests: `cd services/web && npm test`. Build: `npm run build`. All must pass/succeed before every commit.
- Parity rule: any Python string added to codegen.js must be added **character-identical** to manim.js.
- In codegen.js object switch, these are in scope per object: `n` (var name via `vn(obj.id)`), `obj`, `lines` (push lines), `fill`, `hasFill`, `sw`/`sh` (stage dims), `FRAME_WIDTH`/`FRAME_HEIGHT`, helpers `safeMatrixEntry`, `safeMathExpr`, `hex`. The generic tail after the switch emits `move_to([...])` for every object — do NOT add move_to in the case.
- Single-line constructors (regex round-trip). Cell/label/id strings via `safeMatrixEntry`; field expressions via `safeMathExpr`.
- New test file: `services/web/tests/components/phase4-data-objects.test.js` (created in Task 1, appended thereafter). Standard setup:
  ```js
  import { describe, it, expect, beforeEach } from 'vitest';
  import { setActivePinia, createPinia } from 'pinia';
  import { useProjectStore } from '../../src/store/project.js';
  import { generateManimScript, parseManimScript } from '../../src/export/manim.js';
  let store;
  beforeEach(() => { setActivePinia(createPinia()); store = useProjectStore(); store.newProject('Test', 'visual'); store.commitState(); });
  ```

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `services/web/src/store/project.js` | State, defaults, actions | 5 types in `SHAPE_DEFAULTS`/`SHAPE_COLORS`/`nameMap`/`addObject` seeding; table/graph/plane/field actions |
| `services/api/src/compiler/codegen.js` | Server Python generator | 5 object cases |
| `services/web/src/export/manim.js` | Client generator + parser | same 5 cases (byte-identical) + 5 reverse parsers |
| `services/web/src/components/stage/StageCanvas.vue` | Konva preview | 5 previews; generalize `polygonHandles` for graph drag |
| `services/web/src/components/inspector/PropertiesPanel.vue` | Object props | 5 inspector sections |
| (shape palette / object-add sidebar) | Add-object UI | 5 new buttons |
| `services/web/tests/components/phase4-data-objects.test.js` | Tests | store + codegen + round-trip per object |
| `services/web/tests/components/manim-export.test.js` | Parity guard | byte-stable invariants |
| `CLAUDE.md`, `README.md` | Docs | object types + section + version |

---

## Task 1: `table` object — data model + codegen + parser

**Files:** `store/project.js`, `codegen.js`, `manim.js`, `tests/components/phase4-data-objects.test.js` (new)

- [ ] **Step 1: Write the failing tests**

Create `services/web/tests/components/phase4-data-objects.test.js` with the standard setup (above) plus:

```js
describe('table object', () => {
  it('emits Table for text cells, no labels', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [['1','2'],['3','4']]; t.mathMode = false; t.rowLabels = []; t.colLabels = [];
    const py = generateManimScript(store.project);
    expect(py).toContain('Table([["1", "2"], ["3", "4"]])');
    expect(py).not.toContain('MathTable');
    expect(py).not.toContain('row_labels');
  });
  it('emits MathTable with row/col labels', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [['1','2'],['3','4']]; t.mathMode = true; t.rowLabels = ['a','b']; t.colLabels = ['x','y'];
    const py = generateManimScript(store.project);
    expect(py).toContain('MathTable([["1", "2"], ["3", "4"]]');
    expect(py).toContain('row_labels=[MathTex("a"), MathTex("b")]');
    expect(py).toContain('col_labels=[MathTex("x"), MathTex("y")]');
  });
  it('round-trips a table', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [['1','2'],['3','4']]; t.mathMode = true; t.rowLabels = ['a','b']; t.colLabels = ['x','y'];
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'table');
    expect(re.cellData).toEqual([['1','2'],['3','4']]);
    expect(re.mathMode).toBe(true);
    expect(re.rowLabels).toEqual(['a','b']);
    expect(re.colLabels).toEqual(['x','y']);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd services/web && npx vitest run tests/components/phase4-data-objects.test.js -t "table object"`
Expected: FAIL (table not a known type).

- [ ] **Step 3: Register `table` in the store**

In `services/web/src/store/project.js`:
- `SHAPE_DEFAULTS` (after `angle` ~line 163): `table: { width: 200, height: 140, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 0 },`
- `SHAPE_COLORS`: `table: '#ffffff',`
- `nameMap` (~line 307): add `table: 'Table',`
- `addObject` seeding (where `matrix` seeds, ~line 338): `...(type === 'table' ? { cellData: [['1','2'],['3','4']], mathMode: false, rowLabels: [], colLabels: [] } : {}),`

- [ ] **Step 4: Add the codegen case (BOTH generators, identical)**

In `services/api/src/compiler/codegen.js` object switch (near `case 'matrix'` ~line 412), add:

```js
    case 'table': {
      const data = (Array.isArray(obj.cellData) && obj.cellData.length && Array.isArray(obj.cellData[0]))
        ? obj.cellData : [['1','2'],['3','4']];
      const body = data.map(row => `[${row.map(c => `"${safeMatrixEntry(c)}"`).join(', ')}]`).join(', ');
      const cls = obj.mathMode ? 'MathTable' : 'Table';
      const wrap = obj.mathMode ? 'MathTex' : 'Text';
      const labelArr = (arr) => `[${arr.map(s => `${wrap}("${safeMatrixEntry(s)}")`).join(', ')}]`;
      let args = `[${body}]`;
      if (Array.isArray(obj.rowLabels) && obj.rowLabels.length) args += `, row_labels=${labelArr(obj.rowLabels)}`;
      if (Array.isArray(obj.colLabels) && obj.colLabels.length) args += `, col_labels=${labelArr(obj.colLabels)}`;
      lines.push(`${n} = ${cls}(${args})`);
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
```

Add the IDENTICAL case to `services/web/src/export/manim.js`'s object switch (same strings; that file's in-scope `n`/`obj`/`fill`/`hasFill`/`safeMatrixEntry`). VERIFY `safeMatrixEntry` exists in manim.js (it does — used by the matrix case).

- [ ] **Step 5: Add the parser (manim.js)**

Where manim.js parses object constructor lines (near the matrix parser — grep `Matrix(`), add a branch BEFORE the matrix parser (so `MathTable`/`Table` match first). The cell-array and label-array parsing:

```js
    m = line.match(/^(\w+) = (MathTable|Table)\(\[(\[.*?\])\](?:, row_labels=\[(.*?)\])?(?:, col_labels=\[(.*?)\])?\)/);
    if (m) {
      const mathMode = m[2] === 'MathTable';
      // cells: m[3] is "[\"1\", \"2\"], [\"3\", \"4\"]" → split into rows
      const rowStrs = m[3].match(/\[[^\]]*\]/g) || [];
      const cellData = rowStrs.map(r => (r.match(/"([^"]*)"/g) || []).map(q => q.slice(1, -1)));
      const labelList = (s) => s ? (s.match(/(?:MathTex|Text)\("([^"]*)"\)/g) || []).map(x => x.match(/"([^"]*)"/)[1]) : [];
      const obj = { id: uid('obj'), type: 'table', name: 'Table',
        x: sw / 2, y: sh / 2, width: 200, height: 140,
        fill: '#ffffff', stroke: '#ffffff', strokeWidth: 0, opacity: 1, rotation: 0,
        enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length,
        cellData, mathMode, rowLabels: labelList(m[4]), colLabels: labelList(m[5]) };
      varMap[m[1]] = obj.id; objById[obj.id] = obj; objects.push(obj);
      continue;
    }
```

VERIFY against the matrix parser the real locals (`uid`, `sw`, `sh`, `varMap`, `objById`, `objects`). The following `set_color` line is handled by the existing color-parse branch. Confirm placement is BEFORE the matrix parser (since both start `<var> = `; the regex names disambiguate, but order-safety is good practice).

- [ ] **Step 6: Run, verify pass**

Run: `cd services/web && npx vitest run tests/components/phase4-data-objects.test.js -t "table object"`
Expected: PASS (3 tests). Then `npm run test:unit && npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add services/web/src/store/project.js services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/phase4-data-objects.test.js
git commit -m "feat(data-obj): table object (Table/MathTable) codegen + round-trip"
```

## Task 2: `table` — store actions + preview + inspector

**Files:** `store/project.js`, `StageCanvas.vue`, `PropertiesPanel.vue`, `tests/components/phase4-data-objects.test.js`

- [ ] **Step 1: Write the failing store-action test**

```js
describe('table actions', () => {
  it('setTableCell / add+remove row+col / mathMode / labels mutate', () => {
    const t = store.addObject('table', 960, 540);
    store.setTableCell(t.id, 0, 1, '9');
    store.addTableRow(t.id); store.addTableColumn(t.id);
    store.setTableMathMode(t.id, true);
    store.setTableRowLabels(t.id, ['r1','r2','r3']);
    store.setTableColLabels(t.id, ['c1','c2','c3']);
    const re = store.objectById(t.id);
    expect(re.cellData[0][1]).toBe('9');
    expect(re.cellData.length).toBe(3);
    expect(re.cellData[0].length).toBe(3);
    expect(re.mathMode).toBe(true);
    expect(re.rowLabels).toEqual(['r1','r2','r3']);
    store.removeTableRow(t.id); store.removeTableColumn(t.id);
    expect(store.objectById(t.id).cellData.length).toBe(2);
    expect(store.objectById(t.id).cellData[0].length).toBe(2);
  });
});
```

- [ ] **Step 2: Run, verify fail.** `-t "table actions"` → FAIL.

- [ ] **Step 3: Add the store actions**

In `services/web/src/store/project.js`, near the matrix actions (~line 416), mirroring their `_debouncedCommit()` (cell/label edits) / `commitState()` (structural) split:

```js
    setTableCell(id, r, c, value) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData) || !obj.cellData[r] || obj.cellData[r][c] === undefined) return;
      obj.cellData[r][c] = String(value); this.isDirty = true; this._debouncedCommit();
    },
    addTableRow(id) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData) || !obj.cellData[0]) return;
      obj.cellData.push(new Array(obj.cellData[0].length).fill('0')); this.isDirty = true; this.commitState();
    },
    removeTableRow(id) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData) || obj.cellData.length <= 1) return;
      obj.cellData.pop(); if (Array.isArray(obj.rowLabels) && obj.rowLabels.length > obj.cellData.length) obj.rowLabels.pop();
      this.isDirty = true; this.commitState();
    },
    addTableColumn(id) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData)) return;
      obj.cellData.forEach(row => row.push('0')); this.isDirty = true; this.commitState();
    },
    removeTableColumn(id) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData) || !obj.cellData[0] || obj.cellData[0].length <= 1) return;
      obj.cellData.forEach(row => row.pop()); if (Array.isArray(obj.colLabels) && obj.colLabels.length > obj.cellData[0].length) obj.colLabels.pop();
      this.isDirty = true; this.commitState();
    },
    setTableMathMode(id, on) { const o = this.objectById(id); if (!o) return; o.mathMode = !!on; this.isDirty = true; this.commitState(); },
    setTableRowLabels(id, arr) { const o = this.objectById(id); if (!o || !Array.isArray(arr)) return; o.rowLabels = arr.map(s => String(s)); this.isDirty = true; this._debouncedCommit(); },
    setTableColLabels(id, arr) { const o = this.objectById(id); if (!o || !Array.isArray(arr)) return; o.colLabels = arr.map(s => String(s)); this.isDirty = true; this._debouncedCommit(); },
```

- [ ] **Step 4: Run, verify pass.** `-t "table actions"` → PASS.

- [ ] **Step 5: Canvas preview (StageCanvas.vue)**

Add a `table` composite preview mirroring the existing `matrix` preview (grep `matrixCellConfigs`/`matrixBracketConfigs` in StageCanvas.vue). Render a grid of cell text nodes from `cellData`, plus (when present) a left label column from `rowLabels` and a top label row from `colLabels`, plus a listening hit rect for selection. Reuse the matrix layout math; offset the grid right/down when labels exist. Keep it preview-approximate (label alignment is an accepted divergence). If a keyed `v-for` is added, keys go on the `<template>` tag (Vue 3 rule).

- [ ] **Step 6: Inspector (PropertiesPanel.vue)**

Add a `table` section (gate `obj.type === 'table'`), generalizing the existing `matrix` grid editor (grep the matrix section): per-cell inputs calling `setTableCell`, add/remove row/col buttons, a `mathMode` checkbox (`setTableMathMode`), and two comma-separated text inputs for row/col labels wired to `setTableRowLabels`/`setTableColLabels` (split on comma, trim). Follow the matrix section's markup idiom.

- [ ] **Step 7: Verify + commit**

Run `cd services/web && npm run test:unit && npm test && npm run build` → green/success.

```bash
git add services/web/src/store/project.js services/web/src/components/stage/StageCanvas.vue services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/phase4-data-objects.test.js
git commit -m "feat(data-obj): table store actions + grid preview + inspector"
```

## Task 3: `complex_plane` object (full)

**Files:** `store/project.js`, `codegen.js`, `manim.js`, `StageCanvas.vue`, `PropertiesPanel.vue`, test file

- [ ] **Step 1: Write the failing tests**

```js
describe('complex_plane object', () => {
  it('emits ComplexPlane with ranges', () => {
    const p = store.addObject('complex_plane', 960, 540);
    p.xRange = [-3,3,1]; p.yRange = [-2,2,1];
    const py = generateManimScript(store.project);
    expect(py).toContain('ComplexPlane(x_range=[-3, 3, 1], y_range=[-2, 2, 1]');
  });
  it('round-trips complex_plane', () => {
    const p = store.addObject('complex_plane', 960, 540);
    p.xRange = [-4,4,1]; p.yRange = [-2,2,1];
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'complex_plane');
    expect(re.xRange).toEqual([-4,4,1]);
    expect(re.yRange).toEqual([-2,2,1]);
  });
});
```

- [ ] **Step 2: Run, verify fail.** `-t "complex_plane"` → FAIL.

- [ ] **Step 3: Store registration**

In `project.js`: `SHAPE_DEFAULTS.complex_plane = { width: 600, height: 400, fill: '#334155', stroke: '#64748b', strokeWidth: 1 }`; `SHAPE_COLORS.complex_plane = '#334155'`; `nameMap.complex_plane = 'ComplexPlane'`; seeding `...(type === 'complex_plane' ? { xRange: [-3,3,1], yRange: [-2,2,1] } : {})`.

- [ ] **Step 4: Codegen (both generators, identical)** — mirror the `numberplane` case:

```js
    case 'complex_plane': {
      const xr = obj.xRange || [-3, 3, 1];
      const yr = obj.yRange || [-2, 2, 1];
      lines.push(`${n} = ComplexPlane(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2] ?? 1}], x_length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)}, y_length=${(obj.height / sh * FRAME_HEIGHT).toFixed(1)})`);
      break;
    }
```

Add identical to manim.js.

- [ ] **Step 5: Parser (manim.js)** — mirror the numberplane parser (grep `NumberPlane(`):

```js
    m = line.match(/^(\w+) = ComplexPlane\(x_range=\[([-\d.]+), ([-\d.]+), ([-\d.]+)\], y_range=\[([-\d.]+), ([-\d.]+), ([-\d.]+)\]/);
    if (m) {
      const obj = { id: uid('obj'), type: 'complex_plane', name: 'ComplexPlane',
        x: sw/2, y: sh/2, width: 600, height: 400, fill: '#334155', stroke: '#64748b', strokeWidth: 1,
        opacity: 1, rotation: 0, enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length,
        xRange: [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])], yRange: [parseFloat(m[5]), parseFloat(m[6]), parseFloat(m[7])] };
      varMap[m[1]] = obj.id; objById[obj.id] = obj; objects.push(obj); continue;
    }
```

VERIFY locals against the numberplane parser; match its exact field set.

- [ ] **Step 6: Run, verify pass.** `-t "complex_plane"` → PASS.

- [ ] **Step 7: Preview + inspector**

StageCanvas: render `complex_plane` by reusing the `numberplane` Konva grid branch (grep how numberplane draws its grid) — same grid lines from xRange/yRange; real/imag axis labels optional/preview-only. Inspector: reuse the numberplane range editor section (xRange/yRange inputs), gated additionally for `complex_plane`.

- [ ] **Step 8: Verify + commit**

`npm run test:unit && npm test && npm run build` → green.

```bash
git add services/web/src/store/project.js services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/src/components/stage/StageCanvas.vue services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/phase4-data-objects.test.js
git commit -m "feat(data-obj): complex_plane object (mirrors numberplane)"
```

## Task 4: `polar_plane` object (full)

**Files:** same set as Task 3.

- [ ] **Step 1: Failing tests**

```js
describe('polar_plane object', () => {
  it('emits PolarPlane', () => {
    const p = store.addObject('polar_plane', 960, 540);
    p.radiusMax = 4; p.radiusStep = 1; p.azimuthUnits = 12;
    const py = generateManimScript(store.project);
    expect(py).toContain('PolarPlane(radius_max=4, radius_step=1, azimuth_units=12');
  });
  it('round-trips polar_plane', () => {
    const p = store.addObject('polar_plane', 960, 540);
    p.radiusMax = 5; p.radiusStep = 1; p.azimuthUnits = 8;
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'polar_plane');
    expect(re.radiusMax).toBe(5); expect(re.azimuthUnits).toBe(8);
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Store registration**

`SHAPE_DEFAULTS.polar_plane = { width: 400, height: 400, fill: '#334155', stroke: '#64748b', strokeWidth: 1 }`; `SHAPE_COLORS.polar_plane = '#334155'`; `nameMap.polar_plane = 'PolarPlane'`; seeding `...(type === 'polar_plane' ? { radiusMax: 4, radiusStep: 1, azimuthUnits: 12 } : {})`.

- [ ] **Step 4: Codegen (both, identical)**

```js
    case 'polar_plane': {
      const rMax = Number.isFinite(obj.radiusMax) ? obj.radiusMax : 4;
      const rStep = Number.isFinite(obj.radiusStep) ? obj.radiusStep : 1;
      const az = Number.isFinite(obj.azimuthUnits) ? Math.max(1, Math.trunc(obj.azimuthUnits)) : 12;
      lines.push(`${n} = PolarPlane(radius_max=${rMax}, radius_step=${rStep}, azimuth_units=${az}, size=${(Math.min(obj.width, obj.height) / sw * FRAME_WIDTH).toFixed(1)})`);
      break;
    }
```

Identical in manim.js.

- [ ] **Step 5: Parser (manim.js)**

```js
    m = line.match(/^(\w+) = PolarPlane\(radius_max=([-\d.]+), radius_step=([-\d.]+), azimuth_units=(\d+)/);
    if (m) {
      const obj = { id: uid('obj'), type: 'polar_plane', name: 'PolarPlane',
        x: sw/2, y: sh/2, width: 400, height: 400, fill: '#334155', stroke: '#64748b', strokeWidth: 1,
        opacity: 1, rotation: 0, enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length,
        radiusMax: parseFloat(m[2]), radiusStep: parseFloat(m[3]), azimuthUnits: parseInt(m[4], 10) };
      varMap[m[1]] = obj.id; objById[obj.id] = obj; objects.push(obj); continue;
    }
```

- [ ] **Step 6: Run, verify pass.**

- [ ] **Step 7: Preview + inspector**

StageCanvas: draw `radiusMax/radiusStep` concentric circles + `azimuthUnits` radial spokes (Konva), centered on the object, scaled to width/height; listening hit rect. Inspector: radiusMax / radiusStep / azimuthUnits number inputs with setter actions `setPolarRadiusMax`/`setPolarRadiusStep`/`setPolarAzimuth` (add these three store actions, each `commitState()`-ing; mirror the simple counter setters). Add a quick store test for one setter if convenient.

- [ ] **Step 8: Verify + commit**

```bash
git add -A
git commit -m "feat(data-obj): polar_plane object (concentric grid preview)"
```

## Task 5: `graph` object — data model + codegen + parser

**Files:** `store/project.js`, `codegen.js`, `manim.js`, test file

- [ ] **Step 1: Failing tests**

```js
describe('graph object', () => {
  function g() {
    const o = store.addObject('graph', 960, 540);
    o.vertices = ['A','B','C']; o.edges = [['A','B'],['B','C']];
    o.positions = { A:[-60,0], B:[0,-40], C:[60,0] }; o.directed = false; o.showLabels = true;
    return o;
  }
  it('emits Graph with vertices, edges, layout, labels', () => {
    g(); const py = generateManimScript(store.project);
    expect(py).toContain('Graph(["A", "B", "C"], [("A", "B"), ("B", "C")]');
    expect(py).toContain('layout={');
    expect(py).toContain('labels=True');
  });
  it('emits DiGraph when directed', () => {
    const o = g(); o.directed = true;
    expect(generateManimScript(store.project)).toContain('DiGraph(["A", "B", "C"]');
  });
  it('round-trips a graph', () => {
    g(); const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'graph');
    expect(re.vertices).toEqual(['A','B','C']);
    expect(re.edges).toEqual([['A','B'],['B','C']]);
    expect(re.directed).toBe(false);
    expect(re.showLabels).toBe(true);
    expect(Object.keys(re.positions).sort()).toEqual(['A','B','C']);
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Store registration**

`SHAPE_DEFAULTS.graph = { width: 200, height: 200, fill: '#22c55e', stroke: '#ffffff', strokeWidth: 2 }`; `SHAPE_COLORS.graph = '#22c55e'`; `nameMap.graph = 'Graph'`; seeding `...(type === 'graph' ? { vertices: ['A','B','C'], edges: [['A','B'],['B','C']], positions: { A:[-60,0], B:[0,-40], C:[60,0] }, directed: false, showLabels: true } : {})`.

- [ ] **Step 4: Codegen (both, identical)**

The position px → Manim conversion uses the `polygon_free` object-relative scale. VERIFY the exact scale `polygon_free` uses (grep `polygon_free` in codegen.js — it converts object-relative px via `FRAME_WIDTH`). Use the SAME expression. Pattern:

```js
    case 'graph': {
      const verts = (Array.isArray(obj.vertices) ? obj.vertices : []).map(v => safeMatrixEntry(v));
      const vlist = `[${verts.map(v => `"${v}"`).join(', ')}]`;
      const edges = (Array.isArray(obj.edges) ? obj.edges : []).filter(e => Array.isArray(e) && e.length === 2);
      const elist = `[${edges.map(([a, b]) => `("${safeMatrixEntry(a)}", "${safeMatrixEntry(b)}")`).join(', ')}]`;
      const pos = obj.positions || {};
      const sc = (px) => (px / sw * FRAME_WIDTH);   // MATCH polygon_free's per-axis scale exactly
      const layout = `{${verts.map(v => { const p = pos[v] || [0, 0]; return `"${v}": [${sc(p[0]).toFixed(3)}, ${(-sc(p[1])).toFixed(3)}, 0]`; }).join(', ')}}`;
      const cls = obj.directed ? 'DiGraph' : 'Graph';
      const lbl = obj.showLabels ? ', labels=True' : '';
      lines.push(`${n} = ${cls}(${vlist}, ${elist}, layout=${layout}${lbl})`);
      break;
    }
```

> NOTE the y-axis sign flip (`-sc(p[1])`): canvas y is screen-down, Manim y is up — match exactly how `polygon_free` / relational points handle the y sign. VERIFY against polygon_free codegen and use the identical convention. Add identical to manim.js.

- [ ] **Step 5: Parser (manim.js)**

```js
    m = line.match(/^(\w+) = (Graph|DiGraph)\(\[(.*?)\], \[(.*?)\], layout=\{(.*?)\}(, labels=True)?\)/);
    if (m) {
      const directed = m[2] === 'DiGraph';
      const vertices = (m[3].match(/"([^"]*)"/g) || []).map(s => s.slice(1, -1));
      const edges = (m[4].match(/\("([^"]*)", "([^"]*)"\)/g) || []).map(t => { const mm = t.match(/\("([^"]*)", "([^"]*)"\)/); return [mm[1], mm[2]]; });
      const positions = {};
      const sc = (mu) => (mu / FRAME_WIDTH * sw);   // inverse of codegen sc()
      const layoutEntries = m[5].match(/"([^"]*)": \[([-\d.]+), ([-\d.]+), [-\d.]+\]/g) || [];
      for (const le of layoutEntries) { const e = le.match(/"([^"]*)": \[([-\d.]+), ([-\d.]+),/); positions[e[1]] = [Math.round(sc(parseFloat(e[2]))), Math.round(-sc(parseFloat(e[3])))]; }
      const obj = { id: uid('obj'), type: 'graph', name: 'Graph',
        x: sw/2, y: sh/2, width: 200, height: 200, fill: '#22c55e', stroke: '#ffffff', strokeWidth: 2,
        opacity: 1, rotation: 0, enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length,
        vertices, edges, positions, directed, showLabels: !!m[6] };
      varMap[m[1]] = obj.id; objById[obj.id] = obj; objects.push(obj); continue;
    }
```

VERIFY the inverse scale matches the codegen forward scale and the y-sign convention. Confirm locals.

- [ ] **Step 6: Run, verify pass.** Then `npm run test:unit && npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add services/web/src/store/project.js services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/phase4-data-objects.test.js
git commit -m "feat(data-obj): graph object (Graph/DiGraph manual layout) codegen + round-trip"
```

## Task 6: `graph` — store actions + draggable preview + inspector

**Files:** `store/project.js`, `StageCanvas.vue`, `PropertiesPanel.vue`, test file

- [ ] **Step 1: Failing store-action test**

```js
describe('graph actions', () => {
  it('add/remove vertex + edge, rename, position, toggles', () => {
    const o = store.addObject('graph', 960, 540);
    o.vertices = ['A','B']; o.edges = [['A','B']]; o.positions = { A:[-50,0], B:[50,0] };
    store.addGraphVertex(o.id, 'C');
    store.addGraphEdge(o.id, 'B', 'C');
    store.setGraphVertexPosition(o.id, 'C', [0, 60]);
    store.setGraphDirected(o.id, true);
    store.setGraphShowLabels(o.id, false);
    let re = store.objectById(o.id);
    expect(re.vertices).toContain('C');
    expect(re.edges).toContainEqual(['B','C']);
    expect(re.positions.C).toEqual([0,60]);
    expect(re.directed).toBe(true);
    expect(re.showLabels).toBe(false);
    store.renameGraphVertex(o.id, 'A', 'Z');
    re = store.objectById(o.id);
    expect(re.vertices).toContain('Z');
    expect(re.edges).toContainEqual(['Z','B']);
    expect(re.positions.Z).toBeTruthy();
    store.removeGraphVertex(o.id, 'B');
    re = store.objectById(o.id);
    expect(re.vertices).not.toContain('B');
    expect(re.edges.every(e => !e.includes('B'))).toBe(true);
    expect(re.positions.B).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Add store actions**

```js
    addGraphVertex(id, name) {
      const o = this.objectById(id); if (!o) return;
      const v = String(name || `V${o.vertices.length + 1}`);
      if (o.vertices.includes(v)) return;
      o.vertices.push(v); o.positions[v] = [0, 0]; this.isDirty = true; this.commitState();
    },
    removeGraphVertex(id, v) {
      const o = this.objectById(id); if (!o) return;
      o.vertices = o.vertices.filter(x => x !== v);
      o.edges = o.edges.filter(e => e[0] !== v && e[1] !== v);
      delete o.positions[v]; this.isDirty = true; this.commitState();
    },
    renameGraphVertex(id, oldV, newV) {
      const o = this.objectById(id); if (!o) return;
      const nv = String(newV); if (!nv || o.vertices.includes(nv)) return;
      o.vertices = o.vertices.map(x => x === oldV ? nv : x);
      o.edges = o.edges.map(e => [e[0] === oldV ? nv : e[0], e[1] === oldV ? nv : e[1]]);
      if (o.positions[oldV]) { o.positions[nv] = o.positions[oldV]; delete o.positions[oldV]; }
      this.isDirty = true; this.commitState();
    },
    addGraphEdge(id, a, b) {
      const o = this.objectById(id); if (!o || !o.vertices.includes(a) || !o.vertices.includes(b)) return;
      if (o.edges.some(e => e[0] === a && e[1] === b)) return;
      o.edges.push([a, b]); this.isDirty = true; this.commitState();
    },
    removeGraphEdge(id, a, b) {
      const o = this.objectById(id); if (!o) return;
      o.edges = o.edges.filter(e => !(e[0] === a && e[1] === b)); this.isDirty = true; this.commitState();
    },
    setGraphVertexPosition(id, v, pt) {
      const o = this.objectById(id); if (!o || !Array.isArray(pt) || pt.length !== 2) return;
      o.positions[v] = [Math.round(pt[0]), Math.round(pt[1])]; this.isDirty = true; this._debouncedCommit();
    },
    setGraphDirected(id, on) { const o = this.objectById(id); if (!o) return; o.directed = !!on; this.isDirty = true; this.commitState(); },
    setGraphShowLabels(id, on) { const o = this.objectById(id); if (!o) return; o.showLabels = !!on; this.isDirty = true; this.commitState(); },
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Draggable canvas preview**

In StageCanvas.vue: render the `graph` as a composite — one Konva line (or arrow when `directed`) per edge between the two vertices' canvas positions, and one circle + (when `showLabels`) text per vertex, plus a listening hit rect. Convert each `positions[v]` (object-relative px) to canvas coords using the SAME helper the `polygon_free`/relational previews use (grep `polygonHandles`). Add draggable vertex handles by generalizing the `polygonHandles` computed with a `kind: 'graph'` branch (named-key handles over `positions`), and an `onVertexDrag` branch that calls `store.setGraphVertexPosition(id, key, pt)` (commit once on dragend, mirroring the relational handles). Watch the Vue 3 `<template v-for>` key rule.

- [ ] **Step 6: Inspector**

PropertiesPanel.vue `graph` section: a vertex list (each row: rename input + remove button) with an add-vertex button; an edge list (each row: from/to `<select>` over current vertex ids + remove) with an add-edge button; `directed` + `showLabels` checkboxes. Wire to the store actions. Follow the file's list-editor idiom (the matrix grid / axes graphs list are precedents).

- [ ] **Step 7: Verify + commit**

`npm run test:unit && npm test && npm run build` → green.

```bash
git add -A
git commit -m "feat(data-obj): graph store actions + draggable preview + vertex/edge editor"
```

## Task 7: `vector_field` object (full)

**Files:** `store/project.js`, `codegen.js`, `manim.js`, `StageCanvas.vue`, `PropertiesPanel.vue`, test file

- [ ] **Step 1: Failing tests**

```js
describe('vector_field object', () => {
  it('emits ArrowVectorField with whitelisted fx/fy', () => {
    const v = store.addObject('vector_field', 960, 540);
    v.fx = 'y'; v.fy = '-x'; v.xRange = [-3,3,1]; v.yRange = [-2,2,1];
    const py = generateManimScript(store.project);
    expect(py).toContain('ArrowVectorField(lambda p: (lambda x, y: np.array([y, -x, 0]))(p[0], p[1]), x_range=[-3, 3, 1], y_range=[-2, 2, 1])');
  });
  it('sanitizes a malicious expression to the fallback', () => {
    const v = store.addObject('vector_field', 960, 540);
    v.fx = '__import__("os")'; v.fy = 'x';
    const py = generateManimScript(store.project);
    expect(py).not.toContain('__import__');
  });
  it('round-trips vector_field', () => {
    const v = store.addObject('vector_field', 960, 540);
    v.fx = 'y'; v.fy = '-x'; v.xRange = [-3,3,1]; v.yRange = [-2,2,1];
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'vector_field');
    expect(re.fx).toBe('y'); expect(re.fy).toBe('-x');
    expect(re.xRange).toEqual([-3,3,1]);
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Store registration**

`SHAPE_DEFAULTS.vector_field = { width: 600, height: 400, fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 2 }`; `SHAPE_COLORS.vector_field = '#38bdf8'`; `nameMap.vector_field = 'VectorField'`; seeding `...(type === 'vector_field' ? { fx: 'y', fy: '-x', xRange: [-3,3,1], yRange: [-2,2,1] } : {})`.

- [ ] **Step 4: Codegen (both, identical)**

```js
    case 'vector_field': {
      const fx = safeMathExpr(obj.fx, 'y');
      const fy = safeMathExpr(obj.fy, '-x');
      const xr = obj.xRange || [-3, 3, 1];
      const yr = obj.yRange || [-2, 2, 1];
      lines.push(`${n} = ArrowVectorField(lambda p: (lambda x, y: np.array([${fx}, ${fy}, 0]))(p[0], p[1]), x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2] ?? 1}])`);
      break;
    }
```

Add identical to manim.js. VERIFY `safeMathExpr` exists in manim.js (it does — used by parametric/axes). The `safeMathExpr` whitelist rejects `_` and `[`, so `__import__("os")` and `p[0]` user input both fall back — the `p[0]`/`p[1]` in the template are NOT user input. Confirm `np` is imported in the generated script preamble (it is — parametric uses `np.array`).

- [ ] **Step 5: Parser (manim.js)**

```js
    m = line.match(/^(\w+) = ArrowVectorField\(lambda p: \(lambda x, y: np\.array\(\[(.*?), (.*?), 0\]\)\)\(p\[0\], p\[1\]\), x_range=\[([-\d.]+), ([-\d.]+), ([-\d.]+)\], y_range=\[([-\d.]+), ([-\d.]+), ([-\d.]+)\]\)/);
    if (m) {
      const obj = { id: uid('obj'), type: 'vector_field', name: 'VectorField',
        x: sw/2, y: sh/2, width: 600, height: 400, fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 2,
        opacity: 1, rotation: 0, enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length,
        fx: m[2], fy: m[3], xRange: [parseFloat(m[4]), parseFloat(m[5]), parseFloat(m[6])], yRange: [parseFloat(m[7]), parseFloat(m[8]), parseFloat(m[9])] };
      varMap[m[1]] = obj.id; objById[obj.id] = obj; objects.push(obj); continue;
    }
```

The `(.*?)` for fx/fy is safe because the codegen always emits whitelisted expressions (no commas/brackets in a valid `safeMathExpr` output except `,` — but `safeMathExpr` allows commas; however fx/fy individually won't contain a top-level comma since they're single expressions. The lazy `(.*?), (.*?), 0` split on the LAST two commas before `0]` works for comma-free expressions. If an expression legitimately contains a comma like `max(x, y)`, the parser split breaks — note this as a known round-trip limitation for comma-bearing field expressions; acceptable for v1, document it).

- [ ] **Step 6: Run, verify pass.**

- [ ] **Step 7: Preview + inspector**

StageCanvas: sample an 8×8 grid over xRange/yRange, evaluate `fx`/`fy` at each point via `engine/mathExpr.js` `compileExpr` (the `parametric` preview precedent — grep `compileExpr`), and draw a short Konva arrow per sample (length/angle from the vector). Apply `safeMathExpr` before compiling (keep the whitelist identical to codegen — it already lives in StageCanvas per CLAUDE.md). Inspector: `fx`/`fy` text inputs (same UX as parametric `xExpr`/`yExpr`) + x/y range inputs, with setter actions `setFieldExpr`/`setFieldRange` (add these; `commitState()`). Add a store test for one setter if convenient.

- [ ] **Step 8: Verify + commit**

```bash
git add -A
git commit -m "feat(data-obj): vector_field object (ArrowVectorField) + sampled-arrow preview"
```

## Task 8: Shape palette buttons + parity invariants + docs

**Files:** shape palette/sidebar component, `manim-export.test.js`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Add the 5 add-object buttons**

Find the object-add UI (grep for an existing type like `'annulus'` or `'matrix'` in `services/web/src/components/` — likely a sidebar/palette with buttons calling `store.addObject(type, ...)`). Add buttons for `table`, `complex_plane`, `polar_plane`, `graph`, `vector_field`, following the existing button idiom (icon/label/grouping). Group them sensibly (e.g. a "Data & Coordinates" group). Watch the Vue 3 `<template v-for>` key rule if iterating.

- [ ] **Step 2: Parity invariants (manim-export.test.js)**

Open `services/web/tests/components/manim-export.test.js` and append byte-stable string assertions following its exact idiom (`makeObj`/`makeProject` + `generateManimScript` + `toContain`), for:
- `Table([["1", "2"], ["3", "4"]])` (text, no labels) and `MathTable(...row_labels=[MathTex("a"), MathTex("b")]...)`.
- `ComplexPlane(x_range=[-3, 3, 1], y_range=[-2, 2, 1]` and `PolarPlane(radius_max=4, radius_step=1, azimuth_units=12`.
- `Graph(["A", "B", "C"], [("A", "B"), ("B", "C")], layout={` and `DiGraph(["A"` and `labels=True`.
- `ArrowVectorField(lambda p: (lambda x, y: np.array([y, -x, 0]))(p[0], p[1])`.

Run `cd services/web && npx vitest run tests/components/manim-export.test.js` → PASS.

- [ ] **Step 3: Document in CLAUDE.md**

Add the 5 types to the **Object Types (2D)** list. Add a concise **"Data & Coordinate Objects (Phase 4)"** subsection (mirror the Phase 2 / Phase 2.5 notes' style) covering: `table` (Table/MathTable, `mathMode`, reuses `safeMatrixEntry` + matrix grid, row/col labels, byte-identical case); `complex_plane`/`polar_plane` (mirror numberplane); `graph` (manual layout, `polygon_free` scale + y-sign flip, DiGraph when directed, draggable handles, store actions); `vector_field` (double-lambda single-line form, `safeMathExpr` in all three files, sampled-arrow preview). State accepted preview≈render divergences (table label alignment, plane axis labels, graph edge styling, vector-field sparsity) and the vector-field comma-in-expression round-trip limitation. Add the "keep byte-identical across codegen.js/manim.js" note for each new case.

- [ ] **Step 4: Document in README.md**

Bump version badge `3.12.0` → `3.13.0`. Under the shapes list, add Table, ComplexPlane, PolarPlane, Graph, Vector Field (bump the "24+" count to "29+"). Add a Data Model "Object types (2D)" mention. Update the test-count line to the real number (run the suite and read it). Add a `v3.13.0` changelog entry mirroring the v3.12.0 entry's style.

- [ ] **Step 5: Verify + commit**

`cd services/web && npm run test:unit && npm test && npm run build` → all green/success. Note the real unit-test total and ensure README matches it.

```bash
git add services/web/src/components CLAUDE.md README.md services/web/tests/components/manim-export.test.js
git commit -m "feat+docs(data-obj): palette buttons + parity invariants + CLAUDE.md/README (v3.13.0)"
```

---

## Self-Review Checklist (completed during planning)

- **Spec coverage:** table → Tasks 1–2; complex_plane → 3; polar_plane → 4; graph → 5–6; vector_field → 7; palette + parity + docs → 8. All five spec objects + shared concerns covered. ✔
- **Decisions reflected:** single `table`+`mathMode` (Task 1); graph manual layout + `directed`/DiGraph (Tasks 5–6); vector_field default coloring + `safeMathExpr` (Task 7); all five one phase, sequenced low→high risk. ✔
- **Type/name consistency:** field names (`cellData`/`mathMode`/`rowLabels`/`colLabels`; `vertices`/`edges`/`positions`/`directed`/`showLabels`; `fx`/`fy`/`xRange`/`yRange`; `radiusMax`/`radiusStep`/`azimuthUnits`) are identical across each object's codegen/parser/store/test. Action names consistent. ✔
- **Verify-against-real-file flags (implementer confirms before coding):** `polygon_free` px↔Manim scale + y-sign convention (Tasks 5/6 — must match exactly for graph round-trip), the object-add palette component location (Task 8), the `compileExpr`/`polygonHandles` accessors (Tasks 6–7), `uid`/`varMap`/`objById`/`objects`/`sw`/`sh` parser locals. These are the only unknowns a plan can't resolve without open file bodies.
- **Known limitation documented:** vector-field expressions containing a top-level comma (e.g. `max(x, y)`) won't round-trip cleanly (Task 7 parser note + CLAUDE.md). ✔
