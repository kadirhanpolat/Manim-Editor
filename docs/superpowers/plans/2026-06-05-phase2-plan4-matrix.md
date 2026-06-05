# Phase 2 Plan 4: Matrix Object Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `matrix` object type (Manim `Matrix`) with a grid cell editor, bracket selector, composite canvas preview, byte-identical codegen in both generators, and round-trip parsing.

**Architecture:** New standalone object type following the existing constructor → styling → round-trip pattern. Source of truth is `obj.matrixData` (2D array of string entries) + `obj.bracket` (`'['` | `'('` | `'|'`); rows/cols are derived from `matrixData`, never stored, to avoid desync. Codegen emits a single-line `Matrix([["a","b"],...])` (plus optional `left_bracket`/`right_bracket` for non-default brackets) followed by `.set_color(fill)`. Generic post-switch `move_to([...])` positions it (codegen.js:456 / manim.js equivalent). Entries are sanitized display strings (no expression evaluation) — backslashes/quotes/newlines stripped.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Konva (vue-konva), Manim CE codegen (codegen.js + manim.js byte-identical), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-phase2-geometry-calculus-objects-design.md` section `matrix` (lines 100–111) + Security (line 170).

**Deviation note (intentional, applies to all tasks):** The spec lists fields `data, rows, cols, bracket`. This plan stores **`matrixData`** (renamed from `data` to avoid an ambiguous generic `obj.data` property) and **`bracket`** only. `rows`/`cols` are **derived** (`matrixData.length` / `matrixData[0].length`) in components rather than stored — single source of truth, no desync bugs. Spec reviewers: accept this as a documented refinement.

---

### Task 1: Store — defaults, seed, and grid-editing actions

**Files:**
- Modify: `services/web/src/store/project.js` (SHAPE_DEFAULTS ~137, SHAPE_COLORS ~174, nameMap ~289, addObject seed ~322, new actions after `setPolygonVertices` ~392)
- Test: `services/web/tests/components/phase2-matrix-store.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('matrix store', () => {
  it('seeds a default 2x2 matrix with bracket "["', () => {
    store.addObject('matrix', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('matrix');
    expect(o.matrixData).toEqual([['1', '0'], ['0', '1']]);
    expect(o.bracket).toBe('[');
  });

  it('setMatrixCell updates one entry (coerced to string)', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.setMatrixCell(id, 0, 1, 5);
    expect(store.project.objects[0].matrixData[0][1]).toBe('5');
  });

  it('addMatrixRow / addMatrixColumn grow the grid with "0" fill', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.addMatrixRow(id);
    store.addMatrixColumn(id);
    const d = store.project.objects[0].matrixData;
    expect(d.length).toBe(3);
    expect(d[0].length).toBe(3);
    expect(d[2]).toEqual(['0', '0', '0']);
  });

  it('removeMatrixRow / removeMatrixColumn shrink but never below 1x1', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.removeMatrixRow(id);
    store.removeMatrixColumn(id);
    let d = store.project.objects[0].matrixData;
    expect(d.length).toBe(1);
    expect(d[0].length).toBe(1);
    store.removeMatrixRow(id);      // already 1 row → no-op
    store.removeMatrixColumn(id);   // already 1 col → no-op
    d = store.project.objects[0].matrixData;
    expect(d.length).toBe(1);
    expect(d[0].length).toBe(1);
  });

  it('setMatrixBracket only accepts [ ( |', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.setMatrixBracket(id, '(');
    expect(store.project.objects[0].bracket).toBe('(');
    store.setMatrixBracket(id, 'x');   // invalid → ignored
    expect(store.project.objects[0].bracket).toBe('(');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/phase2-matrix-store.test.js`
Expected: FAIL (matrix not seeded; `setMatrixCell` is not a function).

- [ ] **Step 3: Implement store changes**

In `SHAPE_DEFAULTS` (after the `parametric` entry):
```js
  matrix: { width: 160, height: 120, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 0 },
```

In `SHAPE_COLORS` (after `parametric`):
```js
  matrix: '#ffffff',
```

In the `nameMap` object inside `addObject` (extend the `polygon_free`/`parametric` line):
```js
        polygon_free: 'Polygon', parametric: 'Parametric', matrix: 'Matrix',
```

In the `addObject` seed spread block (after the `polygon_free` seed line ~319):
```js
        ...(type === 'matrix' ? { matrixData: [['1', '0'], ['0', '1']], bracket: '[' } : {}),
```

Add these actions right after `setPolygonVertices` (~line 392):
```js
    setMatrixCell(id, r, c, value) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData)) return;
      if (!obj.matrixData[r] || obj.matrixData[r][c] === undefined) return;
      obj.matrixData[r][c] = String(value);
      this.isDirty = true;
      this._debouncedCommit();
    },

    addMatrixRow(id) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData) || !obj.matrixData[0]) return;
      obj.matrixData.push(new Array(obj.matrixData[0].length).fill('0'));
      this.isDirty = true;
      this.commitState();
    },

    removeMatrixRow(id) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData) || obj.matrixData.length <= 1) return;
      obj.matrixData.pop();
      this.isDirty = true;
      this.commitState();
    },

    addMatrixColumn(id) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData)) return;
      obj.matrixData.forEach(row => row.push('0'));
      this.isDirty = true;
      this.commitState();
    },

    removeMatrixColumn(id) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData) || !obj.matrixData[0] || obj.matrixData[0].length <= 1) return;
      obj.matrixData.forEach(row => row.pop());
      this.isDirty = true;
      this.commitState();
    },

    setMatrixBracket(id, bracket) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !['[', '(', '|'].includes(bracket)) return;
      obj.bracket = bracket;
      this.isDirty = true;
      this._debouncedCommit();
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/phase2-matrix-store.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/store/project.js services/web/tests/components/phase2-matrix-store.test.js
git commit -m "feat(matrix): store defaults, seed, and grid-editing actions"
```

---

### Task 2: Codegen — `matrix` case in both generators (byte-identical)

**Files:**
- Modify: `services/api/src/compiler/codegen.js` (add helpers near `safeText` ~79; add `case 'matrix'` in the `objectCode` switch, after the `parametric` case ~349)
- Modify: `services/web/src/export/manim.js` (add identical helpers + identical `case 'matrix'`, after `parametric` ~350)
- Test: `services/web/tests/components/phase2-matrix-codegen.test.js`

> **PARITY REQUIREMENT:** The helper functions and the `case 'matrix'` body must be **byte-identical** between codegen.js and manim.js (same as every other shared case). They share no import; identity is by convention, guarded by `manim-export.test.js`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1', type: 'matrix', x: SW / 2, y: SH / 2, width: 160, height: 120,
    matrixData: [['1', '0'], ['0', '1']], bracket: '[',
    fill: '#ffffff', stroke: '#ffffff', strokeWidth: 0, opacity: 1, rotation: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', ...extra,
  };
}
function makeProject(objects) {
  return { name: 'T', sceneType: '2d', stage: { width: SW, height: SH },
    sceneDuration: 5, fps: 60, background: '#000000', objects, tracks: [], cameraTrack: [], assets: [], groups: [] };
}

describe('matrix codegen', () => {
  it('emits single-line Matrix with default square brackets + set_color', () => {
    const s = generateManimScript(makeProject([makeObj()]));
    expect(s).toMatch(/= Matrix\(\[\["1", "0"\], \["0", "1"\]\]\)/);
    expect(s).toMatch(/\.set_color\("#ffffff"\)/);
  });

  it('emits left_bracket/right_bracket for paren bracket', () => {
    const s = generateManimScript(makeProject([makeObj({ bracket: '(' })]));
    expect(s).toMatch(/Matrix\(\[\["1", "0"\], \["0", "1"\]\], left_bracket="\(", right_bracket="\)"\)/);
  });

  it('emits pipe brackets for determinant style', () => {
    const s = generateManimScript(makeProject([makeObj({ bracket: '|' })]));
    expect(s).toMatch(/left_bracket="\|", right_bracket="\|"/);
  });

  it('sanitizes entries (strips quotes/backslashes)', () => {
    const s = generateManimScript(makeProject([makeObj({ matrixData: [['a"b', 'c\\d']] })]));
    expect(s).toMatch(/Matrix\(\[\["ab", "cd"\]\]\)/);
  });

  it('handles a non-square 1x3 matrix', () => {
    const s = generateManimScript(makeProject([makeObj({ matrixData: [['x', 'y', 'z']] })]));
    expect(s).toMatch(/Matrix\(\[\["x", "y", "z"\]\]\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/phase2-matrix-codegen.test.js`
Expected: FAIL (no `Matrix(` in output; default switch path).

- [ ] **Step 3: Add the helpers (both files, byte-identical)**

In **both** `services/api/src/compiler/codegen.js` and `services/web/src/export/manim.js`, add right after the `safeText` function:
```js
/** Sanitize a Matrix entry to a safe Manim display string (no eval; strips quotes/backslashes/newlines). */
function safeMatrixEntry(s) {
  const t = String(s == null ? '' : s).replace(/\\/g, '').replace(/"/g, '').replace(/[\n\r]/g, '').slice(0, 32);
  return t.length ? t : '0';
}

/** Manim Matrix bracket args: '' for default '[', explicit left/right_bracket otherwise. */
function matrixBrackets(b) {
  if (b === '(') return ', left_bracket="(", right_bracket=")"';
  if (b === '|') return ', left_bracket="|", right_bracket="|"';
  return '';
}
```

- [ ] **Step 4: Add the `case 'matrix'` (both files, byte-identical)**

In **both** files, after the `case 'parametric'` block, add:
```js
    case 'matrix': {
      const data = (Array.isArray(obj.matrixData) && obj.matrixData.length && Array.isArray(obj.matrixData[0]))
        ? obj.matrixData : [['1', '0'], ['0', '1']];
      const body = data.map(row => `[${row.map(c => `"${safeMatrixEntry(c)}"`).join(', ')}]`).join(', ');
      lines.push(`${n} = Matrix([${body}]${matrixBrackets(obj.bracket)})`);
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/phase2-matrix-codegen.test.js`
Expected: PASS (5 tests). The generic `move_to([...])` after the switch positions the matrix automatically.

- [ ] **Step 6: Verify parity invariants still pass**

Run: `cd services/web && npx vitest run tests/components/manim-export.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/phase2-matrix-codegen.test.js
git commit -m "feat(matrix): byte-identical Matrix codegen with bracket selector"
```

---

### Task 3: Parser — round-trip `matrix` in manim.js

**Files:**
- Modify: `services/web/src/export/manim.js` (add a matrix matcher in `parseManimScript`, placed near the other object matchers — e.g. right after the `polygon_free` matcher ~1310)
- Test: extend `services/web/tests/components/phase2-matrix-codegen.test.js`

- [ ] **Step 1: Write the failing test (append to the codegen test file)**

```js
describe('matrix round-trip', () => {
  it('round-trips type + data + default bracket', () => {
    const o = parseManimScript(generateManimScript(makeProject([makeObj()])), SW, SH).objects[0];
    expect(o.type).toBe('matrix');
    expect(o.matrixData).toEqual([['1', '0'], ['0', '1']]);
    expect(o.bracket).toBe('[');
  });

  it('round-trips paren bracket and entry color', () => {
    const o = parseManimScript(
      generateManimScript(makeProject([makeObj({ bracket: '(', fill: '#ff0000' })])), SW, SH).objects[0];
    expect(o.bracket).toBe('(');
    expect(o.fill.toLowerCase()).toBe('#ff0000');
  });

  it('round-trips a non-square 1x3 matrix', () => {
    const o = parseManimScript(
      generateManimScript(makeProject([makeObj({ matrixData: [['x', 'y', 'z']] })])), SW, SH).objects[0];
    expect(o.matrixData).toEqual([['x', 'y', 'z']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/phase2-matrix-codegen.test.js`
Expected: FAIL on the new `matrix round-trip` block (parser returns no matrix object).

- [ ] **Step 3: Add the parser matcher**

In `parseManimScript`, near the other single-line object matchers (after the `polygon_free` matcher block), add. The generic `.set_color("#...")` matcher (manim.js ~1607) already round-trips `fill`, so this matcher only reconstructs structure:
```js
    // Matrix (single-line) — Matrix([["a","b"],...], left_bracket=..., right_bracket=...)
    m = line.match(/^(\w+)\s*=\s*Matrix\(\[(\[.+\])\](?:, left_bracket="([^"]*)", right_bracket="[^"]*")?\)/);
    if (m) {
      const [, name, body, leftBracket] = m;
      const rows = [];
      const rowRe = /\[([^\]]*)\]/g;
      let rm;
      while ((rm = rowRe.exec(body))) {
        const cells = rm[1].match(/"([^"]*)"/g);
        rows.push(cells ? cells.map(c => c.slice(1, -1)) : []);
      }
      const bracket = leftBracket === '(' ? '(' : leftBracket === '|' ? '|' : '[';
      const id = uid('obj');
      const obj = { id, type: 'matrix', name, x: sw / 2, y: sh / 2, width: 160, height: 120,
        matrixData: rows.length ? rows : [['1', '0'], ['0', '1']], bracket,
        fill: '#ffffff', stroke: '#ffffff', strokeWidth: 0, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }
```

> Note: confirm this matcher sits **before** any broad fallback and that `varMap`/`objById`/`objects`/`sw`/`sh`/`uid` are the in-scope names used by sibling matchers (they are, per the `polygon_free` block).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/phase2-matrix-codegen.test.js`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/export/manim.js services/web/tests/components/phase2-matrix-codegen.test.js
git commit -m "feat(matrix): round-trip parser for single-line Matrix"
```

---

### Task 4: StageCanvas — composite Konva preview

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue` (add a matrix branch in the object `<template>` near the LaTeX/axes composite groups ~110–124; add `matrixHitCfg`, `matrixCellConfigs`, `matrixBracketConfigs` functions near the LaTeX helpers ~960–990)
- Test: manual (Konva rendering not unit-tested in this repo); covered by visual verification in Task 7.

- [ ] **Step 1: Add the composite group to the template**

Follow the LaTeX/axes composite convention: an outer `v-group` with `x`/`y`/`rotation` from the object, a **listening** hit rect (so the matrix is selectable/draggable), then **non-listening** cell `v-text` nodes and bracket `v-line`s. Add near the other composite groups (use the same `onObjDown`/`onDragEnd` handlers and `isVis` guard the siblings use):
```html
          <v-group v-if="obj.type === 'matrix' && isVis(obj.id)"
                   :config="{ x: objX(obj), y: objY(obj), rotation: obj.rotation || 0 }"
                   @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)">
            <v-rect :config="matrixHitCfg(obj)" />
            <v-line v-for="(b, bi) in matrixBracketConfigs(obj)" :key="'mb' + bi" :config="b" />
            <v-text v-for="(t, ti) in matrixCellConfigs(obj)" :key="'mc' + ti" :config="t" />
          </v-group>
```

> Use whatever the sibling composite groups use for the group origin (`objX`/`objY`, or inline `obj.x * ... + ox` — match the LaTeX group exactly). Read the LaTeX `v-group` (~line 100) and mirror its origin/transform binding precisely so panning/zoom behave consistently.

- [ ] **Step 2: Add the config helpers**

Near the LaTeX helpers (`latexHitCfg`/`latexTextCfg` ~965–979), add:
```js
function matrixHitCfg(obj) {
  const w = (obj.width || 160) * vs.value;
  const h = (obj.height || 120) * vs.value;
  // listening:true → group hit area so the matrix can be selected/dragged
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(76,238,249,0.04)', stroke: themeAccent.value, strokeWidth: 1, dash: [6, 4], cornerRadius: 4, listening: true };
}

function matrixCellConfigs(obj) {
  const data = (Array.isArray(obj.matrixData) && obj.matrixData.length) ? obj.matrixData : [['1', '0'], ['0', '1']];
  const rows = data.length, cols = data[0]?.length || 1;
  const w = (obj.width || 160) * vs.value, h = (obj.height || 120) * vs.value;
  const padX = 0.18 * w, padY = 0.12 * h;
  const cellW = cols > 1 ? (w - 2 * padX) / (cols - 1) : 0;
  const cellH = rows > 1 ? (h - 2 * padY) / (rows - 1) : 0;
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = -w / 2 + padX + (cols > 1 ? c * cellW : w / 2 - padX);
      const cy = -h / 2 + padY + (rows > 1 ? r * cellH : h / 2 - padY);
      out.push({ x: cx - 16, y: cy - 8, width: 32, text: String(data[r][c]), align: 'center',
        fontSize: Math.max(10, 16 * vs.value), fill: obj.fill || '#ffffff', listening: false });
    }
  }
  return out;
}

function matrixBracketConfigs(obj) {
  const w = (obj.width || 160) * vs.value, h = (obj.height || 120) * vs.value;
  const bx = 0.40 * w, top = -h / 2 + 0.04 * h, bot = h / 2 - 0.04 * h, tick = 0.06 * w;
  const col = obj.fill || '#ffffff';
  const left = [-bx + tick, top, -bx, top, -bx, bot, -bx + tick, bot];
  const right = [bx - tick, top, bx, top, bx, bot, bx - tick, bot];
  // pipe brackets are straight verticals (no ticks)
  if (obj.bracket === '|') {
    return [
      { points: [-bx, top, -bx, bot], stroke: col, strokeWidth: 2, listening: false },
      { points: [bx, top, bx, bot], stroke: col, strokeWidth: 2, listening: false },
    ];
  }
  return [
    { points: left, stroke: col, strokeWidth: 2, listening: false },
    { points: right, stroke: col, strokeWidth: 2, listening: false },
  ];
}
```

> The bracket tick direction is cosmetic; `(` vs `[` both render as ticked brackets in preview (preview-only divergence, like the gradient-angle note). The render uses Manim's real bracket glyphs.

- [ ] **Step 3: Verify build compiles**

Run: `cd services/web && npm run build`
Expected: build succeeds (watch the Vue 3 `<template v-for>` key rule — keys are on the `v-text`/`v-line` directly here, which is allowed because they are the looped elements, not `<template>`).

- [ ] **Step 4: Run the full unit suite (no regressions)**

Run: `cd services/web && npm run test:unit`
Expected: PASS (existing + new matrix tests).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(matrix): composite Konva canvas preview with brackets"
```

---

### Task 5: PropertiesPanel — grid editor + bracket selector

**Files:**
- Modify: `services/web/src/components/inspector/PropertiesPanel.vue` (add a `Section` for matrix after the `parametric` section ~277; add helper methods near `applyPolygonPreset` ~756)
- Test: `services/web/tests/components/phase2-matrix-inspector.test.js`

- [ ] **Step 1: Write the failing test**

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
});

describe('matrix inspector', () => {
  it('shows a Matrix section with a cell input per entry', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    expect(wrapper.html()).toContain('Matrix');
    expect(wrapper.findAll('[data-test="matrix-cell"]').length).toBe(4); // 2x2
  });

  it('editing a cell input writes through setMatrixCell', async () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    const cell = wrapper.findAll('[data-test="matrix-cell"]')[0];
    await cell.setValue('9');
    await cell.trigger('input');
    expect(store.project.objects[0].matrixData[0][0]).toBe('9');
  });

  it('Add Row button grows the grid to 6 cells (3x2)', async () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    await wrapper.find('[data-test="matrix-add-row"]').trigger('click');
    expect(store.project.objects[0].matrixData.length).toBe(3);
    expect(wrapper.findAll('[data-test="matrix-cell"]').length).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/web && npx vitest run tests/components/phase2-matrix-inspector.test.js`
Expected: FAIL (no Matrix section / no `matrix-cell` inputs).

- [ ] **Step 3: Add the inspector Section**

After the parametric `Section` (~277), add:
```html
      <!-- Matrix grid editor -->
      <Section v-if="obj.type === 'matrix'" label="Matrix">
        <div class="space-y-2">
          <div v-for="(row, r) in obj.matrixData" :key="'mr' + r" class="flex gap-1">
            <input v-for="(cell, c) in row" :key="'mc' + r + '-' + c"
                   data-test="matrix-cell"
                   class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="cell"
                   @input="store.setMatrixCell(obj.id, r, c, $event.target.value)" />
          </div>
          <div class="flex gap-1 pt-1">
            <button data-test="matrix-add-row" class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.addMatrixRow(obj.id)">+ Row</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.removeMatrixRow(obj.id)">− Row</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.addMatrixColumn(obj.id)">+ Col</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.removeMatrixColumn(obj.id)">− Col</button>
          </div>
          <div class="flex gap-1 items-center pt-1">
            <span class="text-[10px] text-studio-text-muted">Brackets</span>
            <button v-for="b in ['[', '(', '|']" :key="'bk' + b"
                    class="flex-1 py-1 text-[11px] rounded border"
                    :class="obj.bracket === b ? 'border-studio-accent text-studio-accent' : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'"
                    @click="store.setMatrixBracket(obj.id, b)">{{ b === '|' ? '| |' : b + ' ]'.replace(']', b === '(' ? ')' : ']') }}</button>
          </div>
        </div>
      </Section>
```

> The bracket button label expression is fiddly; if it reads awkwardly, simplify to three explicit buttons labeled `[ ]`, `( )`, `| |` — clarity over cleverness. The only behavioral requirement is each button calls `store.setMatrixBracket(obj.id, '[' | '(' | '|')`.

`store` is already imported and in scope in PropertiesPanel (used by `applyPolygonPreset`). No new method needed — actions are called directly.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/web && npx vitest run tests/components/phase2-matrix-inspector.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/inspector/PropertiesPanel.vue services/web/tests/components/phase2-matrix-inspector.test.js
git commit -m "feat(matrix): inspector grid editor + bracket selector"
```

---

### Task 6: Sidebar button

**Files:**
- Modify: `services/web/src/components/sidebar/AssetSidebar.vue` (`shapes` array ~178–198, add after `parametric`)
- Test: none (static list); verified by Task 7 build + visual check.

- [ ] **Step 1: Add the sidebar button**

After the `parametric` entry in the `shapes` array:
```js
  { type: 'matrix', label: 'Matrix', color: '#ffffff', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4H5v16h2M17 4h2v16h-2"/><circle cx="10" cy="9" r="0.6" fill="currentColor"/><circle cx="14" cy="9" r="0.6" fill="currentColor"/><circle cx="10" cy="15" r="0.6" fill="currentColor"/><circle cx="14" cy="15" r="0.6" fill="currentColor"/></svg>' },
```

- [ ] **Step 2: Verify build**

Run: `cd services/web && npm run build`
Expected: build succeeds; a "Matrix" button appears in the shapes palette.

- [ ] **Step 3: Commit**

```bash
git add services/web/src/components/sidebar/AssetSidebar.vue
git commit -m "feat(matrix): add Matrix button to shape sidebar"
```

---

### Task 7: Final verification, docs, and parity audit

**Files:**
- Modify: `CLAUDE.md` (extend the Object Types `2D:` list + the Phase 2 notes)
- Modify: `README.md` (object list / changelog if a version section exists)

- [ ] **Step 1: Run the entire unit suite**

Run: `cd services/web && npm run test:unit`
Expected: PASS (all prior + matrix store/codegen/inspector tests).

- [ ] **Step 2: Run engine tests**

Run: `cd services/web && npm test`
Expected: PASS (114 engine tests, unaffected).

- [ ] **Step 3: Manual codegen↔manim parity audit**

Diff the `case 'matrix'` block and the `safeMatrixEntry`/`matrixBrackets` helpers between `services/api/src/compiler/codegen.js` and `services/web/src/export/manim.js`. They must be byte-identical (ignoring surrounding line numbers). Run:
```bash
cd services/web && npx vitest run tests/components/manim-export.test.js
```
Expected: PASS.

- [ ] **Step 4: Update CLAUDE.md**

In the **Object Types** `2D:` list, append `matrix` to the enumeration. Add a one-line note under the Phase 2 section that `matrix` stores `matrixData` (2D string array) + `bracket`, derives rows/cols, sanitizes entries (no eval), and round-trips single-line `Matrix([[...]])`.

- [ ] **Step 5: Update README.md**

Add `matrix` to the supported-objects list / changelog (mirror how `parametric`/`polygon_free` were added — match the existing format and bump the patch version note if present).

- [ ] **Step 6: Commit docs**

```bash
git add CLAUDE.md README.md
git commit -m "docs(matrix): document matrix object in CLAUDE.md + README"
```

- [ ] **Step 7: Final review handoff**

All tasks complete. Use superpowers:finishing-a-development-branch to merge `feat/phase2-matrix` back to `main` (Option 1) and push.

---

## Self-Review

**Spec coverage:**
- `matrix` fields (data/rows/cols/bracket) → Task 1 (`matrixData` + `bracket`; rows/cols derived — documented deviation). ✓
- Codegen single-line `Matrix([[...]])` + entry color via `set_color` → Task 2. ✓
- Entry sanitization (strip quotes/backslashes) → Task 2 `safeMatrixEntry`. ✓
- Konva grid of Text + bracket lines + composite hit region → Task 4. ✓
- Inspector grid editor + add/remove row/col + bracket selector → Task 5. ✓
- `fill` = entry color, no fill/stroke geometry → Task 1 defaults (strokeWidth 0) + Task 2 (`set_color`). ✓
- Round-trip parser single-line `Matrix([[...]])` → Task 3. ✓
- Sidebar button → Task 6. ✓
- `matrix` in **none** of GRADIENT_TYPES/DASH_TYPES → unchanged (no edit needed); confirmed it must not be added. ✓
- Security: entries sanitized, no expression eval → Task 2. ✓

**Type consistency:** `matrixData` (2D string array) and `bracket` (`'['|'('|'|'`) used identically across store, codegen, parser, preview, inspector. Action names `setMatrixCell/addMatrixRow/removeMatrixRow/addMatrixColumn/removeMatrixColumn/setMatrixBracket` consistent between Task 1 (definition) and Tasks 4–5 (callers).

**Placeholder scan:** No TBD/TODO; every code step shows full code.
