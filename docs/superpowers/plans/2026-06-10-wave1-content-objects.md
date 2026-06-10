# Wave 1 Track C — Content Objects (code, bar_chart) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new object types — `code` (Manim `Code`) and `bar_chart` (Manim `BarChart`) — through the repo's full "add an object type" pipeline: codegen package → `.py` parser round-trip → canvas preview → store defaults → inspector settings → palette card, all TDD with byte-stability, round-trip, python-validity, snapshot, and audit coverage.
**Branch:** feat/wave1-content-objects (worktree+branch created by the orchestrator)
**Architecture:** All Manim Python generation lives in the npm-workspace package `@manim/codegen` (`packages/manim-codegen/src/`); the web app re-parses generated `.py` with a line-by-line regex parser (`services/web/src/export/manim.ts`), previews objects with pure Konva config builders (`services/web/src/components/stage/configs/*.ts`) orchestrated by `StageCanvas.vue`, holds state in a Pinia store (`services/web/src/store/project.ts`), and edits per-type fields via registry-dispatched inspector components (`object-settings/`). Each new type touches every layer once, codegen-first.
**Tech Stack:** Strict TypeScript everywhere; Vue 3 `<script setup lang="ts">` + Konva (vue-konva); Pinia; Vitest (web unit + codegen package); Manim CE (`manimcommunity/manim:stable` Docker image).

---

## Verified Manim signatures (cite these; do not invent params)

Fetched 2026-06-10 from the **stable** docs (v0.20.1 — the renderer pins the `manimcommunity/manim:stable` image; the `Code` mobject rework landed in 0.19.0 and the 0.19.0 changelog confirms `formatter_style`/`Code.get_styles_list()`):

- `Code` — https://docs.manim.community/en/stable/reference/manim.mobject.text.code_mobject.Code.html
  ```
  Code(code_file=None, code_string=None, language=None, formatter_style='vim',
       tab_width=4, add_line_numbers=True, line_numbers_from=1,
       background='rectangle', background_config=None, paragraph_config=None)
  ```
  There is **no `font_size` parameter** (font settings go through `paragraph_config`, a dict).
- `BarChart` — https://docs.manim.community/en/stable/reference/manim.mobject.graphing.probability.BarChart.html
  ```
  BarChart(values, bar_names=None, y_range=None, x_length=None, y_length=None,
           bar_colors=['#003f5c', '#58508d', '#bc5090', '#ff6361', '#ffa600'],
           bar_width=0.6, bar_fill_opacity=0.7, bar_stroke_width=3, **kwargs)
  ```

**LOCKED sizing mechanism for `code`:** the constructor is chained with `.scale_to_fit_width(<manim width>)` on the **same single line** — exactly the mechanism (and parser pattern) already used by `image`/`svg_asset` (`services/web/src/export/manim.ts:1548` parses `.scale_to_fit_width(([\d.]+))`). Canvas resize already writes `obj.width`/`obj.height` generically via `onTransformEnd`, so resizing the block on canvas changes the next render's size. `fontSize` is **preview-only** (per the Track C spec: "`fontSize` (preview sizing)") — it is never emitted to Python.
**LOCKED sizing mechanism for `bar_chart`:** `x_length`/`y_length` computed from `width`/`height` — the same mapping `complex_plane` uses (`packages/manim-codegen/src/objects.ts:543-549`): `x_length=((width/sw)*FRAME_WIDTH).toFixed(1)`, `y_length=((height/sh)*FRAME_HEIGHT).toFixed(1)`.

Optional execution-time sanity check (run once if Docker is up; non-gating):
```bash
docker compose run --rm renderer python -c "import inspect; from manim import Code, BarChart; print(inspect.signature(Code.__init__)); print(inspect.signature(BarChart.__init__))"
```

## Hard constraints (coordination with parallel tracks)

1. **Do NOT modify `packages/manim-codegen/src/index.ts`** (Track D adds a `hidden` filter there). Everything you need flows through it already: `export * from './constants.js'` (line 571) and `export * from './helpers.js'` (line 572) re-export the new constant + helper automatically. The barrel's `export type { … }` block (lines 573–612) is NOT extended in this track — the new narrow interfaces stay exported from `types.ts` only (barrel export is a post-merge cleanup), and all Vue/test code uses the wide `SceneObject` with cast-at-use (`(obj.values as number[])`), exactly like `CounterSettings.vue` does.
2. **Store changes confined to the defaults/factory region of `services/web/src/store/project.ts`** (Track D adds new actions elsewhere in the same file). Therefore: **no new store actions**. Inspector components mutate the object directly + `store.commitState()` (the documented store pattern: direct assignment is reactive in Vue 3).
3. Both new types stay **OUT of** `GRADIENT_TYPES`, `DASH_TYPES`, `SHADOW_TYPES`, and `ANNOTATION_TYPES` in `constants.ts` — i.e. simply do not add them to those Sets. They get the standard post-construction `move_to`/`rotate` lines for free (`objects.ts:599-608`).
4. **Single-line constructors** — the regex parser reads one line at a time.
5. **Import-specifier rule:** in `.ts`/`lang="ts"` source, relative imports keep the `.js` extension (`from './helpers.js'`). Do not "fix" to `.ts`.
6. Test boilerplate for store-touching web tests: `setActivePinia(createPinia())` → `store = useProjectStore()` → `store.newProject('Test','visual')` → `store.commitState()` in `beforeEach`.
7. Web tests are NOT in the typecheck `include` (`services/web/tsconfig.json` includes `src/**` only) — test files may use loose property access like `obj.values[0]`, matching `ui-tools-audit.test.ts` style.

## Field names (use EXACTLY these everywhere — codegen, parser, store, inspector, tests)

| Type | Fields |
|---|---|
| `code` | `codeText: string` (multiline), `language: string` (allowlist), `fontSize: number` (preview-only, default 18) |
| `bar_chart` | `values: number[]`, `barNames: string[]`, `yMax: number`, `barColors: string[]` |

Store defaults: `code` → `width: 480, height: 280, codeText: 'def hello():\n    print("Hello")', language: 'python', fontSize: 18`; `bar_chart` → `width: 600, height: 400, values: [3, 5, 2, 6], barNames: ['A', 'B', 'C', 'D'], yMax: 8, barColors: ['#58c4dd', '#83c167', '#fc6255', '#ffff00']`.

---

### Task 1: Codegen foundation — `CODE_LANGUAGES`, `pyMultiline`, narrow types

**Files:**
- Modify: `packages/manim-codegen/src/constants.ts` (append after `ANNOTATION_TYPES`, line 75)
- Modify: `packages/manim-codegen/src/helpers.ts` (append after `matrixBrackets`, line 93)
- Modify: `packages/manim-codegen/src/types.ts` (append after the last per-type `…Object` interface)
- Test: `packages/manim-codegen/tests/content-helpers.test.ts` (new)

- [ ] **Step 1: Write the failing test** — create `packages/manim-codegen/tests/content-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pyMultiline } from '../src/helpers.js';
import { CODE_LANGUAGES } from '../src/constants.js';

describe('pyMultiline — single-line Python string escaping', () => {
  it('escapes newlines to \\n', () => {
    expect(pyMultiline('a\nb')).toBe('a\\nb');
  });
  it('escapes double quotes', () => {
    expect(pyMultiline('say "hi"')).toBe('say \\"hi\\"');
  });
  it('escapes backslashes BEFORE everything else (no double-processing)', () => {
    expect(pyMultiline('back\\slash')).toBe('back\\\\slash');
    // literal backslash followed by the letter n must NOT collapse into a newline escape
    expect(pyMultiline('a\\nb')).toBe('a\\\\nb');
  });
  it('escapes tabs and normalizes CRLF to \\n', () => {
    expect(pyMultiline('tab\there')).toBe('tab\\there');
    expect(pyMultiline('a\r\nb')).toBe('a\\nb');
    expect(pyMultiline('a\rb')).toBe('a\\nb');
  });
  it('null/undefined → empty string', () => {
    expect(pyMultiline(null)).toBe('');
    expect(pyMultiline(undefined)).toBe('');
  });
});

describe('CODE_LANGUAGES allowlist', () => {
  it('contains exactly the 9 spec languages', () => {
    expect([...CODE_LANGUAGES]).toEqual([
      'python',
      'javascript',
      'typescript',
      'c',
      'cpp',
      'java',
      'html',
      'css',
      'bash',
    ]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `npm test --workspace packages/manim-codegen` → fails with `SyntaxError: ... does not provide an export named 'pyMultiline'` (and `CODE_LANGUAGES`).

- [ ] **Step 3: Minimal implementation** —

`packages/manim-codegen/src/constants.ts` — append after line 75 (`export const ANNOTATION_TYPES …`):

```ts
// Pygments language allowlist for the `code` object (inspector dropdown + codegen guard).
// Invalid/missing language falls back to 'python' in objectCode.
export const CODE_LANGUAGES: readonly string[] = [
  'python',
  'javascript',
  'typescript',
  'c',
  'cpp',
  'java',
  'html',
  'css',
  'bash',
];
```

`packages/manim-codegen/src/helpers.ts` — append after `matrixBrackets` (line 93):

```ts
/** Escape a multiline user string into the body of a single-line Python
 *  double-quoted string literal: backslashes first, then quotes, then
 *  CR/CRLF→\n normalization, then newlines and tabs. Used by the `code`
 *  object's `code_string=` so the one-line regex parser can round-trip it.
 *  Inverse: `unescapePyMultiline` in services/web/src/export/manim.ts. */
export function pyMultiline(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}
```

`packages/manim-codegen/src/types.ts` — append after the last per-type interface (the `TextObject` interface; these are exported from this module only — do NOT touch the barrel `index.ts`):

```ts
// Wave 1 Track C content objects. NOTE: intentionally NOT added to the
// barrel's `export type { … }` block in src/index.ts (Track D owns that file
// this wave); import via SceneObject casts or deep path until the post-merge
// cleanup adds them to the barrel.
export interface CodeObject extends SceneObject {
  type: 'code';
  codeText?: string;
  language?: string;
}

export interface BarChartObject extends SceneObject {
  type: 'bar_chart';
  values?: number[];
  barNames?: string[];
  yMax?: number;
  barColors?: string[];
}
```

- [ ] **Step 4: Run test, expect PASS** — `npm test --workspace packages/manim-codegen` (6 existing + 7 new pass).
- [ ] **Step 5: Commit**
```bash
npx prettier --write packages/manim-codegen/src/constants.ts packages/manim-codegen/src/helpers.ts packages/manim-codegen/src/types.ts packages/manim-codegen/tests/content-helpers.test.ts
git add packages/manim-codegen/src/constants.ts packages/manim-codegen/src/helpers.ts packages/manim-codegen/src/types.ts packages/manim-codegen/tests/content-helpers.test.ts
git commit -m "feat(codegen): CODE_LANGUAGES allowlist + pyMultiline escaper + code/bar_chart types" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `objectCode` cases + byte-stability tests

**Files:**
- Modify: `packages/manim-codegen/src/objects.ts` (imports at lines 1–28; insert two cases between the `counter` case closing `}` at line 421 and `case 'text':` at line 422)
- Test: `services/web/tests/components/manim-export.test.ts` (append at end of file; `makeObj`/`makeProject`/`SW`/`SH` helpers are at lines 4–36, `parseManimScript` is imported at line 297 — imports are hoisted, available file-wide)

- [ ] **Step 1: Write the failing test** — append to `services/web/tests/components/manim-export.test.ts`:

```ts
// ── Wave 1 Track C — content objects ─────────────────────────────────────────

describe('generator — code (Code mobject, single-line)', () => {
  it('emits Code(code_string=…, language=…, add_line_numbers=False).scale_to_fit_width(…) on one line', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'code', {
          codeText: 'def hello():\n    print("Hello")',
          language: 'python',
          fontSize: 18,
          width: 480,
          height: 280,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    // 480/1920*14.2222 = 3.556 — width drives render size (LOCKED mechanism)
    expect(py).toContain(
      'obj1 = Code(code_string="def hello():\\n    print(\\"Hello\\")", language="python", add_line_numbers=False).scale_to_fit_width(3.556)'
    );
    // standard post-construction position line (object at stage center → manim origin)
    expect(py).toContain('obj1.move_to([0.000, 0.000, 0])');
    // fontSize is preview-only — never emitted
    expect(py).not.toContain('font_size');
    expect(py).not.toContain('paragraph_config');
  });

  it('falls back to language="python" for a non-allowlisted language', () => {
    const project = makeProject(
      [makeObj('obj1', 'code', { codeText: 'x', language: 'ruby', width: 480, height: 280 })],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('language="python"');
    expect(py).not.toContain('language="ruby"');
  });

  it('stays out of the effect emitters (no set_color/gradient/dash/shadow lines)', () => {
    const project = makeProject(
      [makeObj('obj1', 'code', { codeText: 'x = 1', language: 'python', width: 480, height: 280 })],
      []
    );
    const py = generateManimScript(project);
    expect(py).not.toContain('obj1.set_color(');
    expect(py).not.toContain('set_color_by_gradient');
    expect(py).not.toContain('DashedVMobject');
    expect(py).not.toContain('_shadow_obj1');
  });
});

describe('generator — bar_chart (BarChart, single-line)', () => {
  it('emits BarChart(values, bar_names, y_range=[0, yMax, yMax/5], bar_colors, x_length, y_length)', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'bar_chart', {
          values: [3, 5, 2, 6],
          barNames: ['A', 'B', 'C', 'D'],
          yMax: 8,
          barColors: ['#58c4dd', '#83c167', '#fc6255', '#ffff00'],
          width: 600,
          height: 400,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    // x_length = 600/1920*14.2222 = 4.4 ; y_length = 400/1080*8 = 3.0 ; step = 8/5 = 1.6
    expect(py).toContain(
      'obj1 = BarChart(values=[3, 5, 2, 6], bar_names=["A", "B", "C", "D"], y_range=[0, 8, 1.6], bar_colors=["#58c4dd", "#83c167", "#fc6255", "#ffff00"], x_length=4.4, y_length=3.0)'
    );
    expect(py).toContain('obj1.move_to([0.000, 0.000, 0])');
  });

  it('sanitizes barNames via safeMatrixEntry (quotes/backslashes stripped — they become Tex)', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'bar_chart', {
          values: [1, 2],
          barNames: ['A"B', 'C\\D'],
          yMax: 8,
          barColors: ['#58c4dd', '#83c167'],
          width: 600,
          height: 400,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('bar_names=["AB", "CD"]');
  });

  it('fills missing names with letters and invalid colors with the default blue', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'bar_chart', {
          values: [1, 2, 3],
          barNames: ['X'],
          yMax: 5,
          barColors: ['#ff0000', 'not-a-color'],
          width: 600,
          height: 400,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    expect(py).toContain('bar_names=["X", "B", "C"]');
    expect(py).toContain('bar_colors=["#ff0000", "#58c4dd", "#58c4dd"]');
    expect(py).toContain('y_range=[0, 5, 1]');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npx vitest run tests/components/manim-export.test.ts -t "generator — code"` then `-t "generator — bar_chart"` → both fail: the default switch case emits `obj1 = Circle(radius=0.5)  # code` so `toContain` misses.

- [ ] **Step 3: Minimal implementation** — `packages/manim-codegen/src/objects.ts`:

(a) Extend the two import blocks at the top of the file: add `pyMultiline` to the `./helpers.js` import list (lines 1–19) and `CODE_LANGUAGES` to the `./constants.js` import list (lines 20–27).

(b) Insert between the `counter` case's closing `}` (line 421) and `case 'text': {` (line 422):

```ts
    case 'code': {
      const lang = CODE_LANGUAGES.includes(o.language as string)
        ? (o.language as string)
        : 'python';
      const src = pyMultiline((o.codeText as string | undefined) ?? 'print("Hello")');
      const wM = (((o.width as number) || 480) / sw) * FRAME_WIDTH;
      // Single line (regex-parser requirement). fontSize is preview-only; render
      // size is width-driven via scale_to_fit_width (same mechanism as image/svg).
      // add_line_numbers=False matches the preview (which has no line numbers).
      lines.push(
        `${n} = Code(code_string="${src}", language="${lang}", add_line_numbers=False).scale_to_fit_width(${wM.toFixed(3)})`
      );
      break;
    }
    case 'bar_chart': {
      const rawValues = Array.isArray(o.values) ? (o.values as unknown[]) : [3, 5, 2, 6];
      const values = rawValues.map((v) => (Number.isFinite(v as number) ? (v as number) : 0));
      const rawNames = Array.isArray(o.barNames) ? (o.barNames as unknown[]) : [];
      const names = values.map((_, i) =>
        safeMatrixEntry(rawNames[i] ?? String.fromCharCode(65 + (i % 26)))
      );
      const rawColors = Array.isArray(o.barColors) ? (o.barColors as unknown[]) : [];
      const colors = values.map((_, i) => hex(rawColors[i]) || '"#58c4dd"');
      const yMax = safeNum(o.yMax, 8);
      const yStep = +(yMax / 5).toFixed(3);
      const xLen = (((o.width as number) || 600) / sw) * FRAME_WIDTH;
      const yLen = (((o.height as number) || 400) / sh) * FRAME_HEIGHT;
      lines.push(
        `${n} = BarChart(values=[${values.join(', ')}], bar_names=[${names.map((s) => `"${s}"`).join(', ')}], y_range=[0, ${yMax}, ${yStep}], bar_colors=[${colors.join(', ')}], x_length=${xLen.toFixed(1)}, y_length=${yLen.toFixed(1)})`
      );
      break;
    }
```

Notes: `hex()` already returns the quoted form (`"#58c4dd"`) or `null` (`helpers.ts:20-26`); `safeMatrixEntry` strips `\ " \n \r` and caps at 32 chars (`helpers.ts:79-86`); no `.set_color(fill)` line for either type (Code has Pygments colors, BarChart has `bar_colors`); the generic block at `objects.ts:599-608` appends `move_to`/`rotate` because neither type is in `ANNOTATION_TYPES`.

- [ ] **Step 4: Run test, expect PASS** — `cd services/web && npx vitest run tests/components/manim-export.test.ts` (all existing + 6 new pass; web consumes the package's TS source directly via the `source` export condition — no rebuild needed). Also `npm test --workspace packages/manim-codegen` still green.
- [ ] **Step 5: Commit**
```bash
npx prettier --write packages/manim-codegen/src/objects.ts services/web/tests/components/manim-export.test.ts
git add packages/manim-codegen/src/objects.ts services/web/tests/components/manim-export.test.ts
git commit -m "feat(codegen): emit Code and BarChart objects as single-line constructors" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Parser round-trip (`unescapePyMultiline` + two parse branches)

**Files:**
- Modify: `services/web/src/export/manim.ts` (add `unescapePyMultiline` right after `unescapeUnit` at lines 33–37; insert two parse branches between the Counter branch's `continue; }` at line 1370 and the `// Text` comment at line 1372). `FRAME_WIDTH`/`FRAME_HEIGHT` are already imported (lines 13–17); `uid` and the `varMap`/`objById`/`objects` plumbing are already in scope (see the matrix branch at lines 881–911).
- Test: `services/web/tests/components/manim-export.test.ts` (append)

- [ ] **Step 1: Write the failing test** — append to `services/web/tests/components/manim-export.test.ts`:

```ts
describe('parser round-trip — code', () => {
  it('round-trips multiline code with quotes, tabs and literal backslashes', () => {
    const src = 'def f(path):\n\treturn "C:\\\\tmp" + path';
    const project = makeProject(
      [makeObj('obj1', 'code', { codeText: src, language: 'cpp', width: 480, height: 280 })],
      []
    );
    const py = generateManimScript(project);
    const back = parseManimScript(py, SW, SH);
    const o = back.objects.find((x) => x.type === 'code');
    expect(o).toBeTruthy();
    expect(o.codeText).toBe(src);
    expect(o.language).toBe('cpp');
    // width round-trips through scale_to_fit_width (3-decimal precision)
    expect(Math.abs(o.width - 480)).toBeLessThanOrEqual(1);
  });

  it('a literal backslash-n in the source does NOT come back as a newline', () => {
    const src = 'print("a\\\\nb")'; // python source containing the 4 chars  \ \ n b → JS string 'print("a\\nb")'
    const project = makeProject(
      [makeObj('obj1', 'code', { codeText: src, language: 'python', width: 480, height: 280 })],
      []
    );
    const back = parseManimScript(generateManimScript(project), SW, SH);
    const o = back.objects.find((x) => x.type === 'code');
    expect(o.codeText).toBe(src);
  });
});

describe('parser round-trip — bar_chart', () => {
  it('round-trips values, barNames, yMax, barColors and approximate size', () => {
    const project = makeProject(
      [
        makeObj('obj1', 'bar_chart', {
          values: [3, 5.5, 2, 6],
          barNames: ['Q1', 'Q2', 'Q3', 'Q4'],
          yMax: 10,
          barColors: ['#58c4dd', '#83c167', '#fc6255', '#ffff00'],
          width: 600,
          height: 400,
        }),
      ],
      []
    );
    const py = generateManimScript(project);
    const back = parseManimScript(py, SW, SH);
    const o = back.objects.find((x) => x.type === 'bar_chart');
    expect(o).toBeTruthy();
    expect(o.values).toEqual([3, 5.5, 2, 6]);
    expect(o.barNames).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(o.yMax).toBe(10);
    expect(o.barColors).toEqual(['#58c4dd', '#83c167', '#fc6255', '#ffff00']);
    // x_length/y_length are emitted with 1 decimal → ~2% size tolerance
    expect(Math.abs(o.width - 600)).toBeLessThan(15);
    expect(Math.abs(o.height - 400)).toBeLessThan(15);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npx vitest run tests/components/manim-export.test.ts -t "parser round-trip — code"` and `-t "parser round-trip — bar_chart"` → fail: `o` is undefined (no parse branch yet, the lines fall through unmatched).

- [ ] **Step 3: Minimal implementation** — `services/web/src/export/manim.ts`:

(a) After `unescapeUnit` (line 37) add:

```ts
/** Inverse of @manim/codegen `pyMultiline`. Single regex pass so an escaped
 *  backslash followed by `n` (`\\n` in the .py source) restores to
 *  backslash+n, NOT to a newline. */
export function unescapePyMultiline(s: unknown): string {
  return String(s == null ? '' : s).replace(/\\(\\|n|t|")/g, (_, c: string) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c
  );
}
```

(b) Insert between the Counter branch's closing `continue; }` (line 1370) and the `// Text` branch (line 1372) — mirrors the matrix branch shape (uid id, varMap/objById/objects registration; position/rotation are filled in later by the generic `.move_to(`/`.rotate(` handlers):

```ts
    // Code block (single-line, pyMultiline-escaped code_string)
    m = line.match(
      /^(\w+) = Code\(code_string="((?:[^"\\]|\\.)*)", language="(\w+)", add_line_numbers=False\)\.scale_to_fit_width\(([\d.]+)\)/
    );
    if (m) {
      const [, name, src, language, wStr] = m;
      const width = Math.round((parseFloat(wStr) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'code',
        name,
        x: sw / 2,
        y: sh / 2,
        width,
        height: Math.round(width * 0.6), // height is not persisted (Code height follows content) — documented lossy default
        codeText: unescapePyMultiline(src),
        language,
        fontSize: 18,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 5,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
      };
      varMap[name] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }

    // BarChart (single-line)
    m = line.match(
      /^(\w+) = BarChart\(values=\[([^\]]*)\], bar_names=\[([^\]]*)\], y_range=\[0, ([\d.]+), [\d.]+\], bar_colors=\[([^\]]*)\], x_length=([\d.]+), y_length=([\d.]+)\)/
    );
    if (m) {
      const [, name, valuesStr, namesStr, yMaxStr, colorsStr, xLenStr, yLenStr] = m;
      const values = valuesStr
        .split(',')
        .map((s) => parseFloat(s))
        .filter((v) => Number.isFinite(v));
      const barNames = (namesStr.match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
      const barColors = (colorsStr.match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'bar_chart',
        name,
        x: sw / 2,
        y: sh / 2,
        width: Math.round((parseFloat(xLenStr) / FRAME_WIDTH) * sw),
        height: Math.round((parseFloat(yLenStr) / FRAME_HEIGHT) * sh),
        values: values.length ? values : [3, 5, 2, 6],
        barNames,
        yMax: parseFloat(yMaxStr),
        barColors,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 5,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
      };
      varMap[name] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }
```

Note: negative values round-trip too (`parseFloat` on `-2` works; the `[^\]]*` capture admits minus signs). `values` regex tolerates floats and negatives; `y_range` always starts at 0 by construction.

- [ ] **Step 4: Run test, expect PASS** — `cd services/web && npx vitest run tests/components/manim-export.test.ts`.
- [ ] **Step 5: Commit**
```bash
npx prettier --write services/web/src/export/manim.ts services/web/tests/components/manim-export.test.ts
git add services/web/src/export/manim.ts services/web/tests/components/manim-export.test.ts
git commit -m "feat(parser): round-trip code and bar_chart objects from generated .py" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Store defaults + python-validity coverage

**Files:**
- Modify: `services/web/src/store/project.ts` — three additive edits, all inside the defaults/factory region: `SHAPE_DEFAULTS` (insert after the `counter` entry, line 368), the `nameMap` inside `addObject` (insert after the `cross` entry, line 619), and the per-type default spreads inside `addObject` (insert after the `table` spread, which ends at line 699)
- Modify: `services/web/tests/components/codegen-python-validity.test.ts` (`TYPES_2D` array, after `'bezier'` at line 90)
- Test: `services/web/tests/components/content-objects-store.test.ts` (new)

- [ ] **Step 1: Write the failing test** — create `services/web/tests/components/content-objects-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('addObject defaults — code', () => {
  it('seeds codeText/language/fontSize and a 480x280 box', () => {
    const obj = store.addObject('code', 960, 540);
    expect(obj.type).toBe('code');
    expect(obj.codeText).toBe('def hello():\n    print("Hello")');
    expect(obj.language).toBe('python');
    expect(obj.fontSize).toBe(18);
    expect(obj.width).toBe(480);
    expect(obj.height).toBe(280);
    expect(obj.name).toContain('Code');
  });
  it('codegen produces a scene without "undefined" leakage', () => {
    store.addObject('code', 960, 540);
    const py = generateManimScript(store.project);
    expect(py).toContain('class MainScene');
    expect(py).toContain('Code(code_string=');
    expect(py).not.toMatch(/\bundefined\b/);
  });
});

describe('addObject defaults — bar_chart', () => {
  it('seeds values/barNames/yMax/barColors and a 600x400 box', () => {
    const obj = store.addObject('bar_chart', 960, 540);
    expect(obj.type).toBe('bar_chart');
    expect(obj.values).toEqual([3, 5, 2, 6]);
    expect(obj.barNames).toEqual(['A', 'B', 'C', 'D']);
    expect(obj.yMax).toBe(8);
    expect(obj.barColors).toEqual(['#58c4dd', '#83c167', '#fc6255', '#ffff00']);
    expect(obj.width).toBe(600);
    expect(obj.height).toBe(400);
    expect(obj.name).toContain('Bar Chart');
  });
  it('codegen produces a scene without "undefined" leakage', () => {
    store.addObject('bar_chart', 960, 540);
    const py = generateManimScript(store.project);
    expect(py).toContain('BarChart(values=');
    expect(py).not.toMatch(/\bundefined\b/);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npx vitest run tests/components/content-objects-store.test.ts` → fails: `obj.codeText` is `undefined` (no per-type defaults yet).

- [ ] **Step 3: Minimal implementation** — `services/web/src/store/project.ts`:

(a) `SHAPE_DEFAULTS` — after the `counter` line (368):

```ts
  code: { width: 480, height: 280, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  bar_chart: { width: 600, height: 400, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
```

(b) `nameMap` inside `addObject` — after the `cross` entry (line 619):

```ts
        code: 'Code',
        bar_chart: 'Bar Chart',
```

(c) Per-type spreads inside the `addObject` object literal — after the `table` spread (closing `: {}),` at line 699):

```ts
        ...(type === 'code'
          ? { codeText: 'def hello():\n    print("Hello")', language: 'python', fontSize: 18 }
          : {}),
        ...(type === 'bar_chart'
          ? {
              values: [3, 5, 2, 6],
              barNames: ['A', 'B', 'C', 'D'],
              yMax: 8,
              barColors: ['#58c4dd', '#83c167', '#fc6255', '#ffff00'],
            }
          : {}),
```

(d) `services/web/tests/components/codegen-python-validity.test.ts` — in `TYPES_2D`, after `'bezier',` (line 90):

```ts
  'code',
  'bar_chart',
```

- [ ] **Step 4: Run test, expect PASS** —
```bash
cd services/web && npx vitest run tests/components/content-objects-store.test.ts
cd services/web && npx vitest run tests/components/codegen-python-validity.test.ts   # needs python on PATH; self-skips otherwise
```
- [ ] **Step 5: Commit**
```bash
npx prettier --write services/web/src/store/project.ts services/web/tests/components/content-objects-store.test.ts services/web/tests/components/codegen-python-validity.test.ts
git add services/web/src/store/project.ts services/web/tests/components/content-objects-store.test.ts services/web/tests/components/codegen-python-validity.test.ts
git commit -m "feat(store): code + bar_chart factory defaults; python-validity coverage" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Stage preview — config builders, snapshots, StageCanvas branches

**Files:**
- Modify: `services/web/src/components/stage/configs/text.ts` (append `codeBgCfg` + `codeTextCfg` after `counterCfg`, which ends at line 114)
- Modify: `services/web/src/components/stage/configs/dataObjects.ts` (append `barChartHitCfg` + `barChartBarConfigs` + `barChartBaselineCfg` after `matrixBracketConfigs`, which ends at line 182)
- Modify: `services/web/tests/components/stage/fixtures.ts` (append `code` + `bar_chart` entries to the `OBJECTS` map)
- Modify: `services/web/src/components/stage/StageCanvas.vue` (two `<template>` group branches after the Table group, which starts at line 441; compat wrappers next to the matrix wrappers at lines 1111–1113; the namespaces `text` and `dataObjects` are already imported at lines 809–810)
- Test: `services/web/tests/components/stage/stage-configs.characterization.test.ts` (append a describe; `textCfgs`/`dataObjects` namespaces already imported at lines 4–5)

- [ ] **Step 1: Write the failing test** —

(a) Append to `services/web/tests/components/stage/fixtures.ts`, inside the `OBJECTS` map (after the last entry):

```ts
  code: {
    id: 'code1',
    type: 'code',
    x: 960,
    y: 540,
    width: 480,
    height: 280,
    codeText: 'def f():\n    return 1',
    language: 'python',
    fontSize: 18,
    fill: '#ffffff',
    opacity: 1,
    rotation: 0,
  },
  bar_chart: {
    id: 'bar1',
    type: 'bar_chart',
    x: 960,
    y: 540,
    width: 600,
    height: 400,
    values: [3, 5, 2, 6],
    barNames: ['A', 'B', 'C', 'D'],
    yMax: 8,
    barColors: ['#58c4dd', '#83c167', '#fc6255', '#ffff00'],
    fill: '#ffffff',
    opacity: 1,
    rotation: 0,
  },
```

(b) Append to `services/web/tests/components/stage/stage-configs.characterization.test.ts`:

```ts
describe('content objects (wave1 — code, bar_chart)', () => {
  const ctx = makeCtx();
  it('code bg cfg stable', () => {
    expect(textCfgs.codeBgCfg(OBJECTS.code, ctx)).toMatchSnapshot();
  });
  it('code text cfg stable', () => {
    expect(textCfgs.codeTextCfg(OBJECTS.code, ctx)).toMatchSnapshot();
  });
  it('bar_chart hit cfg stable', () => {
    expect(dataObjects.barChartHitCfg(OBJECTS.bar_chart, ctx)).toMatchSnapshot();
  });
  it('bar_chart bars stable (4 bars, heights proportional to value/yMax)', () => {
    const bars = dataObjects.barChartBarConfigs(OBJECTS.bar_chart, ctx);
    expect(bars).toHaveLength(4);
    expect(bars).toMatchSnapshot();
  });
  it('bar_chart baseline stable', () => {
    expect(dataObjects.barChartBaselineCfg(OBJECTS.bar_chart, ctx)).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npx vitest run tests/components/stage/stage-configs.characterization.test.ts -t "content objects"` → fails with `textCfgs.codeBgCfg is not a function`.

- [ ] **Step 3: Minimal implementation** —

(a) `services/web/src/components/stage/configs/text.ts` — append after `counterCfg` (line 114). Builders are pure `fn(obj, ctx)`; group-relative coords (origin at object center) like `matrixHitCfg`:

```ts
// ── code block (monospace preview; NO syntax highlighting — documented divergence:
//    the render uses real Pygments highlighting + add_line_numbers=False) ──────
export function codeBgCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 480) * ctx.vs;
  const h = ((obj.height as number | undefined) || 280) * ctx.vs;
  // listening:true → this rect is the group's hit area (select/drag), like latexBgCfg
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: '#1e1e2e',
    stroke: ctx.themeAccent,
    strokeWidth: 1,
    cornerRadius: 6,
    opacity: (obj.opacity as number | undefined) ?? 1,
    listening: true,
  };
}

export function codeTextCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 480) * ctx.vs;
  const h = ((obj.height as number | undefined) || 280) * ctx.vs;
  const fontSize = Math.max(8, ((obj.fontSize as number | undefined) || 18) * ctx.vs);
  return {
    x: -w / 2 + 12 * ctx.vs,
    y: -h / 2 + 10 * ctx.vs,
    width: w - 24 * ctx.vs,
    text: (obj.codeText as string | undefined) || '',
    fontSize,
    fontFamily: 'monospace',
    lineHeight: 1.4,
    fill: '#e2e8f0',
    opacity: (obj.opacity as number | undefined) ?? 1,
    wrap: 'none',
    listening: false,
  };
}
```

(b) `services/web/src/components/stage/configs/dataObjects.ts` — append after `matrixBracketConfigs` (line 182):

```ts
// ── BarChart preview (simple rect bars + baseline; render = real Manim BarChart
//    with axes/ticks — bars-only preview is the documented divergence) ─────────
export function barChartHitCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 600) * ctx.vs;
  const h = ((obj.height as number | undefined) || 400) * ctx.vs;
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: 'rgba(76,238,249,0.04)',
    stroke: ctx.themeAccent,
    strokeWidth: 1,
    dash: [6, 4],
    cornerRadius: 4,
    listening: true,
  };
}

export function barChartBarConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const w = ((obj.width as number | undefined) || 600) * ctx.vs;
  const h = ((obj.height as number | undefined) || 400) * ctx.vs;
  const rawValues = obj.values as number[] | undefined;
  const values = Array.isArray(rawValues) && rawValues.length ? rawValues : [3, 5, 2, 6];
  const colors = (obj.barColors as string[] | undefined) || [];
  const rawYMax = obj.yMax as number | undefined;
  const yMax = Number.isFinite(rawYMax) && (rawYMax as number) > 0 ? (rawYMax as number) : 8;
  const padX = 0.08 * w,
    padY = 0.08 * h;
  const innerW = w - 2 * padX,
    innerH = h - 2 * padY;
  const slot = innerW / values.length;
  const barW = slot * 0.6; // mirrors Manim's bar_width=0.6 default
  return values.map((v, i) => {
    const safe = Number.isFinite(v) ? Math.max(0, Math.min(v, yMax)) : 0; // preview clamps to [0, yMax]
    const bh = (safe / yMax) * innerH;
    return {
      x: -w / 2 + padX + i * slot + (slot - barW) / 2,
      y: h / 2 - padY - bh,
      width: barW,
      height: bh,
      fill: colors[i] || '#58c4dd',
      opacity: (obj.opacity as number | undefined) ?? 1,
      listening: false,
    };
  });
}

export function barChartBaselineCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 600) * ctx.vs;
  const h = ((obj.height as number | undefined) || 400) * ctx.vs;
  const padX = 0.08 * w,
    padY = 0.08 * h;
  return {
    points: [-w / 2 + padX, h / 2 - padY, w / 2 - padX, h / 2 - padY],
    stroke: '#ffffff',
    strokeWidth: 2,
    listening: false,
  };
}
```

(c) `services/web/src/components/stage/StageCanvas.vue`:

Template — insert after the Table `</v-group>` (the Table group starts at line 441; mirror the Matrix branch at lines 427–439 exactly, including the event handlers — `groupCfg`/`isVis`/`onObjDown`/`onDragEnd`/`onTransform`/`onTransformEnd` are all existing):

```html
            <!-- Code block -->
            <v-group
              v-if="obj.type === 'code' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="codeBgCfg(obj)" />
              <v-text :config="codeTextCfg(obj)" />
            </v-group>

            <!-- Bar chart -->
            <v-group
              v-if="obj.type === 'bar_chart' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="barChartHitCfg(obj)" />
              <v-rect v-for="(b, bi) in barChartBarConfigs(obj)" :key="'bcb' + bi" :config="b" />
              <v-line :config="barChartBaselineCfg(obj)" />
            </v-group>
```

Script — add compat wrappers next to the matrix wrappers (after line 1113, `const matrixBracketConfigs = …`); the `text` and `dataObjects` namespace imports already exist at lines 809–810:

```ts
const codeBgCfg = (o: SceneObject) => text.codeBgCfg(o, ctx.value);
const codeTextCfg = (o: SceneObject) => text.codeTextCfg(o, ctx.value);
const barChartHitCfg = (o: SceneObject) => dataObjects.barChartHitCfg(o, ctx.value);
const barChartBarConfigs = (o: SceneObject) => dataObjects.barChartBarConfigs(o, ctx.value);
const barChartBaselineCfg = (o: SceneObject) => dataObjects.barChartBaselineCfg(o, ctx.value);
```

(Reminder: any `v-for` key must NOT sit on a `<template>` tag here — the bars loop is on `<v-rect>` directly, which is fine.)

- [ ] **Step 4: Run test, expect PASS** —
```bash
cd services/web && npx vitest run tests/components/stage/stage-configs.characterization.test.ts
cd services/web && npm run test:unit    # full unit suite still green (StageCanvas mounts in several tests)
```
First run writes the new snapshots into `services/web/tests/components/stage/__snapshots__/stage-configs.characterization.test.ts.snap` — commit that file.
- [ ] **Step 5: Commit**
```bash
npx prettier --write services/web/src/components/stage/configs/text.ts services/web/src/components/stage/configs/dataObjects.ts services/web/src/components/stage/StageCanvas.vue services/web/tests/components/stage/fixtures.ts services/web/tests/components/stage/stage-configs.characterization.test.ts
git add services/web/src/components/stage/configs/text.ts services/web/src/components/stage/configs/dataObjects.ts services/web/src/components/stage/StageCanvas.vue services/web/tests/components/stage/fixtures.ts services/web/tests/components/stage/stage-configs.characterization.test.ts services/web/tests/components/stage/__snapshots__/stage-configs.characterization.test.ts.snap
git commit -m "feat(stage): code block + bar chart canvas previews (pure config builders + snapshots)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Inspector settings components + registry

**Files:**
- Create: `services/web/src/components/inspector/object-settings/CodeSettings.vue`
- Create: `services/web/src/components/inspector/object-settings/BarChartSettings.vue`
- Modify: `services/web/src/components/inspector/object-settings/index.ts` (2 imports after line 26 + 2 `REGISTRY` entries after `cross:` at line 55)
- Test: `services/web/tests/components/content-object-settings.test.ts` (new)

- [ ] **Step 1: Write the failing test** — create `services/web/tests/components/content-object-settings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../src/store/project.js';
import { settingsComponentFor } from '../../src/components/inspector/object-settings/index.js';
import CodeSettings from '../../src/components/inspector/object-settings/CodeSettings.vue';
import BarChartSettings from '../../src/components/inspector/object-settings/BarChartSettings.vue';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('CodeSettings', () => {
  it('is registered for type "code"', () => {
    expect(settingsComponentFor('code')).toBe(CodeSettings);
  });

  it('edits codeText, language (allowlist dropdown) and fontSize on the object', async () => {
    const obj = store.addObject('code', 960, 540);
    const w = mount(CodeSettings, { props: { obj } });
    await w.find('[data-test="code-text"]').setValue('x = 1\ny = 2');
    expect(obj.codeText).toBe('x = 1\ny = 2');
    const select = w.find('[data-test="code-language"]');
    expect(select.findAll('option').map((o) => o.element.value)).toContain('cpp');
    await select.setValue('cpp');
    expect(obj.language).toBe('cpp');
    await w.find('[data-test="code-fontsize"]').setValue('24');
    expect(obj.fontSize).toBe(24);
  });
});

describe('BarChartSettings', () => {
  it('is registered for type "bar_chart"', () => {
    expect(settingsComponentFor('bar_chart')).toBe(BarChartSettings);
  });

  it('edits values/names/colors/yMax and adds/removes bars (min 1 bar guard)', async () => {
    const obj = store.addObject('bar_chart', 960, 540);
    const w = mount(BarChartSettings, { props: { obj } });
    await w.findAll('[data-test="bar-value"]')[0].setValue('7');
    expect(obj.values[0]).toBe(7);
    await w.findAll('[data-test="bar-name"]')[1].setValue('Q2');
    expect(obj.barNames[1]).toBe('Q2');
    await w.find('[data-test="bar-ymax"]').setValue('10');
    expect(obj.yMax).toBe(10);
    await w.find('[data-test="bar-add"]').trigger('click');
    expect(obj.values.length).toBe(5);
    expect(obj.barNames.length).toBe(5);
    expect(obj.barColors.length).toBe(5);
    await w.find('[data-test="bar-remove"]').trigger('click');
    expect(obj.values.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npx vitest run tests/components/content-object-settings.test.ts` → fails resolving the two new `.vue` imports (files do not exist).

- [ ] **Step 3: Minimal implementation** —

(a) `services/web/src/components/inspector/object-settings/CodeSettings.vue` (full file; mirrors `CounterSettings.vue` structure but mutates directly + `commitState()` — see hard constraint 2):

```vue
<template>
  <!-- Code block settings -->
  <Section label="Code">
    <div class="space-y-1.5">
      <textarea
        data-test="code-text"
        rows="8"
        spellcheck="false"
        class="w-full px-2 py-1 text-[11px] font-mono rounded bg-studio-bg border border-studio-border text-studio-text"
        :value="(obj.codeText as string) ?? ''"
        @input="onCodeInput($event)"
      ></textarea>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Language</span>
        <select
          data-test="code-language"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="(obj.language as string) ?? 'python'"
          @change="onLanguageChange($event)"
        >
          <option v-for="l in CODE_LANGUAGES" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Font size</span>
        <input
          data-test="code-fontsize"
          type="number"
          min="6"
          step="1"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.fontSize ?? 18"
          @change="onFontSizeChange($event)"
        />
      </div>
      <p class="text-[10px] text-studio-text-muted">
        Preview has no syntax highlighting (render uses Pygments). Font size affects the preview
        only — render size follows the block width.
      </p>
    </div>
  </Section>
</template>

<script setup lang="ts">
import type { SceneObject } from '@manim/codegen';
import { CODE_LANGUAGES } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const obj = props.obj;
function commit() {
  store.isDirty = true;
  store.commitState();
}
function onCodeInput(e: Event) {
  obj.codeText = (e.target as HTMLTextAreaElement).value;
  commit();
}
function onLanguageChange(e: Event) {
  obj.language = (e.target as HTMLSelectElement).value;
  commit();
}
function onFontSizeChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  obj.fontSize = Number.isFinite(v) && v >= 6 ? v : 18;
  commit();
}
</script>
```

(b) `services/web/src/components/inspector/object-settings/BarChartSettings.vue` (full file; adapts the `MatrixSettings.vue` grid-editor pattern — one numbers row + one names row + one colors row):

```vue
<template>
  <!-- Bar chart editor (adapted from the Matrix grid editor) -->
  <Section label="Bar Chart">
    <div class="space-y-2">
      <div class="text-[10px] text-studio-text-muted">Values</div>
      <div class="flex gap-1">
        <input
          v-for="(v, i) in values"
          :key="'bv' + i"
          data-test="bar-value"
          type="number"
          step="0.1"
          class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="v"
          @change="onValueChange(i, $event)"
        />
      </div>
      <div class="text-[10px] text-studio-text-muted">Names</div>
      <div class="flex gap-1">
        <input
          v-for="(nm, i) in barNames"
          :key="'bn' + i"
          data-test="bar-name"
          class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="nm"
          @input="onNameInput(i, $event)"
        />
      </div>
      <div class="text-[10px] text-studio-text-muted">Colors</div>
      <div class="flex gap-1">
        <input
          v-for="(c, i) in barColors"
          :key="'bc' + i"
          data-test="bar-color"
          type="color"
          class="w-full min-w-0 h-6 rounded bg-studio-bg border border-studio-border"
          :value="c"
          @input="onColorInput(i, $event)"
        />
      </div>
      <div class="flex gap-1 pt-1">
        <button
          data-test="bar-add"
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="addBar"
        >
          + Bar
        </button>
        <button
          data-test="bar-remove"
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="removeBar"
        >
          − Bar
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Y max</span>
        <input
          data-test="bar-ymax"
          type="number"
          min="0.1"
          step="0.5"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.yMax ?? 8"
          @change="onYMaxChange($event)"
        />
      </div>
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const obj = props.obj;
const values = computed<number[]>(() => (obj.values as number[] | undefined) ?? []);
const barNames = computed<string[]>(() => (obj.barNames as string[] | undefined) ?? []);
const barColors = computed<string[]>(() => (obj.barColors as string[] | undefined) ?? []);
function commit() {
  store.isDirty = true;
  store.commitState();
}
function onValueChange(i: number, e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  (obj.values as number[])[i] = Number.isFinite(v) ? v : 0;
  commit();
}
function onNameInput(i: number, e: Event) {
  (obj.barNames as string[])[i] = (e.target as HTMLInputElement).value;
  commit();
}
function onColorInput(i: number, e: Event) {
  (obj.barColors as string[])[i] = (e.target as HTMLInputElement).value;
  commit();
}
function addBar() {
  const vs = obj.values as number[];
  vs.push(1);
  (obj.barNames as string[]).push(String.fromCharCode(65 + ((vs.length - 1) % 26)));
  (obj.barColors as string[]).push('#58c4dd');
  commit();
}
function removeBar() {
  const vs = obj.values as number[];
  if (vs.length <= 1) return; // keep at least one bar
  vs.pop();
  (obj.barNames as string[]).pop();
  (obj.barColors as string[]).pop();
  commit();
}
function onYMaxChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  obj.yMax = Number.isFinite(v) && v >= 0.1 ? v : 8; // clamp ≥ 0.1 (mirrors setPolarRadiusMax guard)
  commit();
}
</script>
```

(c) `services/web/src/components/inspector/object-settings/index.ts` — add after the `AnnotationSettings` import (line 26):

```ts
import CodeSettings from './CodeSettings.vue';
import BarChartSettings from './BarChartSettings.vue';
```

and inside `REGISTRY`, after `cross: AnnotationSettings,` (line 55):

```ts
  code: CodeSettings,
  bar_chart: BarChartSettings,
```

- [ ] **Step 4: Run test, expect PASS** — `cd services/web && npx vitest run tests/components/content-object-settings.test.ts`.
  NOTE: `cd services/web && npx vitest run tests/components/ui-tools-audit.test.ts` still passes at this point because `REGISTERED_TYPES` in that test has not been extended yet — that happens in Task 7 (it is the failing test there).
- [ ] **Step 5: Commit**
```bash
npx prettier --write services/web/src/components/inspector/object-settings/CodeSettings.vue services/web/src/components/inspector/object-settings/BarChartSettings.vue services/web/src/components/inspector/object-settings/index.ts services/web/tests/components/content-object-settings.test.ts
git add services/web/src/components/inspector/object-settings/CodeSettings.vue services/web/src/components/inspector/object-settings/BarChartSettings.vue services/web/src/components/inspector/object-settings/index.ts services/web/tests/components/content-object-settings.test.ts
git commit -m "feat(inspector): CodeSettings + BarChartSettings with registry entries" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: AssetSidebar palette cards + ui-tools-audit green

**Files:**
- Modify: `services/web/tests/components/ui-tools-audit.test.ts` (`REGISTERED_TYPES` array, lines 24–53; spot-check list in the first palette test, lines 87–97)
- Modify: `services/web/src/components/sidebar/AssetSidebar.vue` (`shapesData` array starting line 498 — append two cards as the LAST entries, after the `vector_components` card at ~line 542)

- [ ] **Step 1: Write the failing test** — edit `services/web/tests/components/ui-tools-audit.test.ts`:

(a) In `REGISTERED_TYPES`, after `'cross',` (line 52):

```ts
  'code',
  'bar_chart',
```

(b) In the first palette test's spot-check loop (the `for (const t of [...])` list at lines 87–97), add `'code',` and `'bar_chart',` after `'text',`.

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npx vitest run tests/components/ui-tools-audit.test.ts` → "every inspector-registered type is reachable from the palette" fails with `types with an inspector but no add button: code, bar_chart`.

- [ ] **Step 3: Minimal implementation** — `services/web/src/components/sidebar/AssetSidebar.vue`: append these two card objects as the last entries of the `shapesData` array (cards render as `.shape-card` buttons, which is exactly what `collectPaletteTypes()` clicks):

```js
  {
    type: 'code',
    label: 'Code',
    color: '#a78bfa',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="8 6 3 12 8 18"/><polyline points="16 6 21 12 16 18"/></svg>',
  },
  {
    type: 'bar_chart',
    label: 'Bar Chart',
    color: '#f472b6',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="12" width="3" height="9"/><rect x="11" y="7" width="3" height="14"/><rect x="17" y="3" width="3" height="18"/></svg>',
  },
```

- [ ] **Step 4: Run test, expect PASS** — `cd services/web && npx vitest run tests/components/ui-tools-audit.test.ts` (all audit tests green, including "codegen validity for every reachable object type", which now exercises `code` + `bar_chart` end-to-end through the palette → store → codegen chain).
- [ ] **Step 5: Commit**
```bash
npx prettier --write services/web/src/components/sidebar/AssetSidebar.vue services/web/tests/components/ui-tools-audit.test.ts
git add services/web/src/components/sidebar/AssetSidebar.vue services/web/tests/components/ui-tools-audit.test.ts
git commit -m "feat(palette): code + bar_chart AssetSidebar cards; audit guard extended" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Final verification (full gate)

**Files:** none (verification only; commit only if prettier/lint fixes produce diffs)

- [ ] **Step 1: Run the full gate from the repo root** — every command must pass:

```bash
cd services/web && npm run test:unit          # 618 existing + ~17 new unit tests
cd services/web && npm test                   # 114 engine tests (tsx; unaffected, must stay green)
npm test --workspace services/api             # 43 api tests (unaffected)
npm test --workspace packages/manim-codegen   # 6 existing + 7 new codegen tests
npm run lint                                  # ESLint — errors fail
npm run typecheck                             # build:codegen + vue-tsc (web) + tsc (api), strict
npm run format:check                          # Prettier
```

- [ ] **Step 2: If `format:check` or `lint` flags anything**, run `npx prettier --write <flagged files>`, re-run the gate, and commit:
```bash
git add -A
git commit -m "style: prettier/lint fixes for wave1 content objects" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Optional render smoke (non-gating, requires Docker):**
```bash
docker compose run --rm renderer python -c "import inspect; from manim import Code, BarChart; print(inspect.signature(Code.__init__)); print(inspect.signature(BarChart.__init__))"
```
Expected: signatures match the "Verified Manim signatures" section above.

- [ ] **Step 4: Report** — branch `feat/wave1-content-objects` ready for the orchestrator's rebase → full gate → merge (integration order A → B → C → D). Do NOT merge or open a PR from this worktree; the orchestrator owns integration.

---

## Known divergences / documented losses (intentional — mirror existing per-type notes)

- **`code` preview** has no syntax highlighting and no line numbers; codegen emits `add_line_numbers=False` so the render matches the no-line-numbers preview. Render uses real Pygments highlighting (preview is flat `#e2e8f0` monospace) — same class of divergence as gradient angle / dashed+fill.
- **`code` height** is not persisted in Python (`Code` height follows content); on `.py` import the parser defaults `height = round(width * 0.6)`.
- **`code` `fontSize`** is preview-only; render size is width-driven via `.scale_to_fit_width`.
- **`bar_chart` preview** draws bars + baseline only (no y-axis ticks/numbers — the render's `BarChart` includes full axes); negative values render in Manim but the preview clamps to `[0, yMax]`; `x_length`/`y_length` 1-decimal emission gives ~2% size tolerance on round-trip (same as `complex_plane`).
- Neither type is in `GRADIENT_TYPES` / `DASH_TYPES` / `SHADOW_TYPES` / `ANNOTATION_TYPES`; the Effects inspector section stays hidden for them automatically (`canGradient`/`canDash`/`canRound` gate by type).
- `CodeObject`/`BarChartObject` narrow interfaces live in `types.ts` but are NOT in the barrel's `export type` block (Track D owns `index.ts` this wave) — barrel export is a one-line post-merge cleanup.
