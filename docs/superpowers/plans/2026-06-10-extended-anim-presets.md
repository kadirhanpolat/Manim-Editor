# Extended Animation Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 entrance + 2 exit animation presets (`DrawBorderThenFill`, `GrowArrow`, `GrowFromEdge`+direction, `FadeIn`+scale, `Unwrite`, `FadeOut`+scale), per-type filtering in the inspector dropdown, and direction/scale parameter controls.

**Architecture:** New preset entries live in `ENTER_ANIMS`/`EXIT_ANIMS` in `project.ts`; two new exported helpers (`availableEnterAnims`/`availableExitAnims`) filter the list by object type. Three optional fields (`enterAnimDir`, `enterAnimScale`, `exitAnimScale`) are added to the `SceneObject` type and stored on the object. Inspector dropdown binds to the filtered list; conditional param controls appear below it. Codegen and parser handle the new keys.

**Tech Stack:** TypeScript, Vue 3 `<script setup lang="ts">`, Pinia (`useProjectStore`), Vitest

---

## File Map

| File | Change |
|---|---|
| `packages/manim-codegen/src/types.ts` | Add `enterAnimDir`, `enterAnimScale`, `exitAnimScale` to `SceneObject` |
| `packages/manim-codegen/src/index.ts` | 6 new `enterAnim`/`exitAnim` switch cases |
| `services/web/src/store/project.ts` | Extend `ENTER_ANIMS`/`EXIT_ANIMS`; add `availableEnterAnims`/`availableExitAnims` helpers + 3 store actions |
| `services/web/src/engine/playback.ts` | 6 new preview cases in `_applyEnterExitAnims` |
| `services/web/src/export/manim.ts` | 6 new parser branches |
| `services/web/src/components/inspector/panels/ObjectInspector.vue` | Filtered dropdowns + conditional param controls |
| `services/web/tests/components/extended-anim-presets.test.ts` | New test file (codegen, filter, round-trip, store) |

---

## Task 1: Extend `SceneObject` type

**Files:**
- Modify: `packages/manim-codegen/src/types.ts`

- [ ] **Step 1: Add three optional fields after `exitAnimDur`**

Open `packages/manim-codegen/src/types.ts`. Find the block:
```ts
  enterAnim?: string;
  exitAnim?: string;
  enterAnimDur?: number;
  exitAnimDur?: number;
```
Replace with:
```ts
  enterAnim?: string;
  exitAnim?: string;
  enterAnimDur?: number;
  exitAnimDur?: number;
  enterAnimDir?: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
  enterAnimScale?: number;
  exitAnimScale?: number;
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/manim-codegen/src/types.ts
git commit -m "feat(types): add enterAnimDir, enterAnimScale, exitAnimScale to SceneObject"
```

---

## Task 2: Codegen — new animation cases

**Files:**
- Modify: `packages/manim-codegen/src/index.ts`

The enter switch starts around line 169 and exit around line 465. Add new cases **before the `default:` branch** in each switch.

- [ ] **Step 1: Add 4 enter cases**

Find the line `case 'typewriter':` in the enter switch. Insert the following **before** the `default:` branch that comes after `typewriter`:

```ts
      case 'draw_border_fill':
        enterCode = `self.play(DrawBorderThenFill(${n})${rt})`;
        break;
      case 'grow_arrow':
        enterCode = `self.play(GrowArrow(${n})${rt})`;
        break;
      case 'grow_from_edge': {
        const dir = (o.enterAnimDir ?? 'LEFT') as string;
        enterCode = `self.play(GrowFromEdge(${n}, edge=${dir})${rt})`;
        break;
      }
      case 'fade_in_large': {
        const sc = (o.enterAnimScale ?? 1.5).toFixed(1);
        enterCode = `self.play(FadeIn(${n}, scale=${sc})${rt})`;
        break;
      }
```

- [ ] **Step 2: Add 2 exit cases**

Find `case 'typewriter_out':` in the exit switch. Insert the following **before** the `default:` branch that follows:

```ts
      case 'unwrite':
        exitCode = `self.play(Unwrite(${n})${rt})`;
        break;
      case 'fade_out_large': {
        const sc = (o.exitAnimScale ?? 1.5).toFixed(1);
        exitCode = `self.play(FadeOut(${n}, scale=${sc})${rt})`;
        break;
      }
```

- [ ] **Step 3: Verify typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/manim-codegen/src/index.ts
git commit -m "feat(codegen): add DrawBorderThenFill/GrowArrow/GrowFromEdge/FadeInLarge/Unwrite/FadeOutLarge animation cases"
```

---

## Task 3: Store — extend lists, helpers, actions

**Files:**
- Modify: `services/web/src/store/project.ts`

- [ ] **Step 1: Write the failing tests first**

Create `services/web/tests/components/extended-anim-presets.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  useProjectStore,
  ENTER_ANIMS,
  EXIT_ANIMS,
  availableEnterAnims,
  availableExitAnims,
} from '../../src/store/project.js';

describe('availableEnterAnims filter', () => {
  it('excludes grow_arrow for non-arrow types', () => {
    const keys = availableEnterAnims('circle').map((a) => a.value);
    expect(keys).not.toContain('grow_arrow');
  });

  it('includes grow_arrow for arrow type', () => {
    const keys = availableEnterAnims('arrow').map((a) => a.value);
    expect(keys).toContain('grow_arrow');
  });

  it('includes grow_arrow for double_arrow type', () => {
    const keys = availableEnterAnims('double_arrow').map((a) => a.value);
    expect(keys).toContain('grow_arrow');
  });

  it('excludes draw_border_fill for image type', () => {
    const keys = availableEnterAnims('image').map((a) => a.value);
    expect(keys).not.toContain('draw_border_fill');
  });

  it('includes draw_border_fill for rectangle type', () => {
    const keys = availableEnterAnims('rectangle').map((a) => a.value);
    expect(keys).toContain('draw_border_fill');
  });

  it('excludes typewriter for circle type', () => {
    const keys = availableEnterAnims('circle').map((a) => a.value);
    expect(keys).not.toContain('typewriter');
  });

  it('includes typewriter for text type', () => {
    const keys = availableEnterAnims('text').map((a) => a.value);
    expect(keys).toContain('typewriter');
  });

  it('excludes write/draw/uncreate for image type', () => {
    const keys = availableEnterAnims('image').map((a) => a.value);
    expect(keys).not.toContain('write');
    expect(keys).not.toContain('draw');
  });
});

describe('availableExitAnims filter', () => {
  it('excludes unwrite for image type', () => {
    const keys = availableExitAnims('image').map((a) => a.value);
    expect(keys).not.toContain('unwrite');
  });

  it('includes unwrite for latex type', () => {
    const keys = availableExitAnims('latex').map((a) => a.value);
    expect(keys).toContain('unwrite');
  });

  it('excludes typewriter_out for circle type', () => {
    const keys = availableExitAnims('circle').map((a) => a.value);
    expect(keys).not.toContain('typewriter_out');
  });

  it('includes typewriter_out for text type', () => {
    const keys = availableExitAnims('text').map((a) => a.value);
    expect(keys).toContain('typewriter_out');
  });
});

describe('store actions for anim params', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('setEnterAnimDir updates enterAnimDir and commits', () => {
    const store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
    store.addObject('circle');
    const obj = store.project.objects[0];
    store.setEnterAnimDir(obj.id, 'RIGHT');
    expect(store.objectById(obj.id)?.enterAnimDir).toBe('RIGHT');
  });

  it('setEnterAnimScale updates enterAnimScale and commits', () => {
    const store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
    store.addObject('circle');
    const obj = store.project.objects[0];
    store.setEnterAnimScale(obj.id, 2.0);
    expect(store.objectById(obj.id)?.enterAnimScale).toBe(2.0);
  });

  it('setExitAnimScale updates exitAnimScale and commits', () => {
    const store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
    store.addObject('circle');
    const obj = store.project.objects[0];
    store.setExitAnimScale(obj.id, 1.8);
    expect(store.objectById(obj.id)?.exitAnimScale).toBe(1.8);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit -- --reporter=verbose extended-anim-presets
```
Expected: FAIL — `availableEnterAnims` not exported, actions not defined.

- [ ] **Step 3: Add new entries to `ENTER_ANIMS`**

Open `services/web/src/store/project.ts`. Find `ENTER_ANIMS`. Add 4 entries **before the closing `];`**:

```ts
  { value: 'draw_border_fill', label: 'Draw Border Fill', icon: '⬜', desc: 'Trace border, then fill (shapes)' },
  { value: 'grow_arrow',       label: 'Grow Arrow',       icon: '➤', desc: 'Grow from tail to tip (arrows only)' },
  { value: 'grow_from_edge',   label: 'Grow From Edge',   icon: '▷', desc: 'Expand from one edge (set direction below)' },
  { value: 'fade_in_large',    label: 'Fade In Large',    icon: '⤢', desc: 'Fade in while shrinking from large (scale > 1 = from bigger)' },
```

- [ ] **Step 4: Add new entries to `EXIT_ANIMS`**

Find `EXIT_ANIMS`. Add 2 entries **before the closing `];`**:

```ts
  { value: 'unwrite',       label: 'Unwrite',        icon: '✘', desc: 'Reverse Write effect' },
  { value: 'fade_out_large', label: 'Fade Out Large', icon: '⤡', desc: 'Fade out while growing to large (scale > 1 = grow bigger)' },
```

- [ ] **Step 5: Add `availableEnterAnims` and `availableExitAnims` helpers**

Add the following immediately after the `EXIT_ANIMS` constant (before `// ─── Shape palette ───`):

```ts
const VMOBJECT_ONLY_ENTER = new Set(['write', 'draw', 'draw_border_fill', 'grow_arrow', 'grow_from_edge', 'unwrite']);
const ARROW_ONLY_ENTER    = new Set(['grow_arrow']);
const TEXT_ONLY_ENTER     = new Set(['typewriter']);
const TEXT_ONLY_EXIT      = new Set(['typewriter_out']);
const VMOBJECT_ONLY_EXIT  = new Set(['unwrite', 'uncreate']);

export function availableEnterAnims(type: string): typeof ENTER_ANIMS {
  return ENTER_ANIMS.filter((a) => {
    if (ARROW_ONLY_ENTER.has(a.value) && type !== 'arrow' && type !== 'double_arrow') return false;
    if (TEXT_ONLY_ENTER.has(a.value)  && type !== 'text') return false;
    if (VMOBJECT_ONLY_ENTER.has(a.value) && type === 'image') return false;
    return true;
  });
}

export function availableExitAnims(type: string): typeof EXIT_ANIMS {
  return EXIT_ANIMS.filter((a) => {
    if (TEXT_ONLY_EXIT.has(a.value)     && type !== 'text') return false;
    if (VMOBJECT_ONLY_EXIT.has(a.value) && type === 'image') return false;
    return true;
  });
}
```

- [ ] **Step 6: Add 3 store actions**

Find the Pinia store `actions` object. Add these three actions alongside existing ones (e.g., near `setAnnotationTarget`):

```ts
    setEnterAnimDir(objId: string, dir: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN') {
      const obj = this.objectById(objId);
      if (!obj) return;
      obj.enterAnimDir = dir;
      this.commitState();
    },
    setEnterAnimScale(objId: string, scale: number) {
      const obj = this.objectById(objId);
      if (!obj) return;
      obj.enterAnimScale = scale;
      this.commitState();
    },
    setExitAnimScale(objId: string, scale: number) {
      const obj = this.objectById(objId);
      if (!obj) return;
      obj.exitAnimScale = scale;
      this.commitState();
    },
```

- [ ] **Step 7: Run tests — expect pass**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit -- --reporter=verbose extended-anim-presets
```
Expected: all filter + store action tests PASS.

- [ ] **Step 8: Commit**

```bash
git add services/web/src/store/project.ts services/web/tests/components/extended-anim-presets.test.ts
git commit -m "feat(store): extend ENTER/EXIT_ANIMS, add availableEnterAnims/availableExitAnims helpers, add anim param actions"
```

---

## Task 4: Codegen string tests

**Files:**
- Modify: `services/web/tests/components/extended-anim-presets.test.ts`

- [ ] **Step 1: Add codegen tests to the test file**

Append the following `describe` block to the existing test file:

```ts
import { generateScene } from '../../../packages/manim-codegen/src/index.js';
import type { Project } from '../../../packages/manim-codegen/src/types.js';

function makeProject(overrides: Record<string, unknown>): Project {
  return {
    name: 'Test',
    sceneType: '2d',
    objects: [
      {
        id: 'obj1',
        type: 'circle',
        name: 'c',
        x: 960, y: 540,
        width: 100, height: 100,
        fill: '#fff',
        opacity: 1,
        enterTime: 0,
        duration: 3,
        enterAnimDur: 0.5,
        exitAnimDur: 0.5,
        ...overrides,
      },
    ],
    tracks: [],
    cameraTrack: [],
    fps: 60,
    width: 1920,
    height: 1080,
    background: '#000',
    cameraType: 'static',
    duration: 5,
  } as unknown as Project;
}

describe('extended anim presets codegen', () => {
  it('draw_border_fill emits DrawBorderThenFill', () => {
    const code = generateScene(makeProject({ enterAnim: 'draw_border_fill' }));
    expect(code).toContain('self.play(DrawBorderThenFill(obj1), run_time=0.5)');
  });

  it('grow_arrow emits GrowArrow', () => {
    const code = generateScene(makeProject({ type: 'arrow', enterAnim: 'grow_arrow' }));
    expect(code).toContain('self.play(GrowArrow(obj1), run_time=0.5)');
  });

  it('grow_from_edge LEFT emits GrowFromEdge(edge=LEFT)', () => {
    const code = generateScene(makeProject({ enterAnim: 'grow_from_edge', enterAnimDir: 'LEFT' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=LEFT), run_time=0.5)');
  });

  it('grow_from_edge RIGHT emits GrowFromEdge(edge=RIGHT)', () => {
    const code = generateScene(makeProject({ enterAnim: 'grow_from_edge', enterAnimDir: 'RIGHT' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=RIGHT), run_time=0.5)');
  });

  it('grow_from_edge UP emits GrowFromEdge(edge=UP)', () => {
    const code = generateScene(makeProject({ enterAnim: 'grow_from_edge', enterAnimDir: 'UP' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=UP), run_time=0.5)');
  });

  it('grow_from_edge DOWN emits GrowFromEdge(edge=DOWN)', () => {
    const code = generateScene(makeProject({ enterAnim: 'grow_from_edge', enterAnimDir: 'DOWN' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=DOWN), run_time=0.5)');
  });

  it('grow_from_edge defaults to LEFT when enterAnimDir absent', () => {
    const code = generateScene(makeProject({ enterAnim: 'grow_from_edge' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=LEFT), run_time=0.5)');
  });

  it('fade_in_large scale=1.5 emits FadeIn(scale=1.5)', () => {
    const code = generateScene(makeProject({ enterAnim: 'fade_in_large', enterAnimScale: 1.5 }));
    expect(code).toContain('self.play(FadeIn(obj1, scale=1.5), run_time=0.5)');
  });

  it('fade_in_large scale=2.0 emits FadeIn(scale=2.0)', () => {
    const code = generateScene(makeProject({ enterAnim: 'fade_in_large', enterAnimScale: 2.0 }));
    expect(code).toContain('self.play(FadeIn(obj1, scale=2.0), run_time=0.5)');
  });

  it('fade_in_large defaults scale to 1.5 when absent', () => {
    const code = generateScene(makeProject({ enterAnim: 'fade_in_large' }));
    expect(code).toContain('self.play(FadeIn(obj1, scale=1.5), run_time=0.5)');
  });

  it('unwrite emits Unwrite', () => {
    const proj = makeProject({ enterAnim: 'fade_in', exitAnim: 'unwrite' });
    const code = generateScene(proj);
    expect(code).toContain('self.play(Unwrite(obj1), run_time=0.5)');
  });

  it('fade_out_large scale=1.5 emits FadeOut(scale=1.5)', () => {
    const proj = makeProject({ enterAnim: 'fade_in', exitAnim: 'fade_out_large', exitAnimScale: 1.5 });
    const code = generateScene(proj);
    expect(code).toContain('self.play(FadeOut(obj1, scale=1.5), run_time=0.5)');
  });

  it('existing fade_in still emits FadeIn without scale (regression)', () => {
    const code = generateScene(makeProject({ enterAnim: 'fade_in' }));
    expect(code).toContain('self.play(FadeIn(obj1), run_time=0.5)');
    expect(code).not.toContain('scale=');
  });
});
```

- [ ] **Step 2: Run codegen tests**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit -- --reporter=verbose extended-anim-presets
```
Expected: codegen tests PASS (Task 2 already implemented the cases).

- [ ] **Step 3: Commit**

```bash
git add services/web/tests/components/extended-anim-presets.test.ts
git commit -m "test(codegen): byte-stability tests for all 6 new anim presets"
```

---

## Task 5: Canvas preview — playback engine

**Files:**
- Modify: `services/web/src/engine/playback.ts`

- [ ] **Step 1: Add 4 enter preview cases**

In `playback.ts`, find the enter switch (`switch (enterAnim)`). Locate `case 'bounce_in':` and its closing `}`. Insert the following **after** that case and **before** the closing `}` of the switch:

```ts
          case 'draw_border_fill':
            // Approximate: opacity + slight scale (same as draw/write)
            overrides.opacity = eased * (obj.opacity ?? 1);
            overrides.scaleX = 0.8 + 0.2 * eased;
            overrides.scaleY = 0.8 + 0.2 * eased;
            changed = true;
            break;
          case 'grow_arrow':
            // Same as grow_in
            overrides.scaleX = eased;
            overrides.scaleY = eased;
            overrides.opacity = Math.min(1, eased * 2) * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'grow_from_edge': {
            const dir = (obj.enterAnimDir ?? 'LEFT') as string;
            if (dir === 'RIGHT') overrides.x = (obj.x ?? 0) + (1 - eased) * 600;
            else if (dir === 'UP') overrides.y = (obj.y ?? 0) - (1 - eased) * 400;
            else if (dir === 'DOWN') overrides.y = (obj.y ?? 0) + (1 - eased) * 400;
            else overrides.x = (obj.x ?? 0) - (1 - eased) * 600; // LEFT (default)
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          }
          case 'fade_in_large': {
            const startScale = obj.enterAnimScale ?? 1.5;
            const sc = startScale - (startScale - 1) * eased;
            overrides.scaleX = sc;
            overrides.scaleY = sc;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          }
```

- [ ] **Step 2: Add 2 exit preview cases**

In the exit switch (`switch (exitAnim)`), locate `case 'spin_out':` and its closing. Insert after `spin_out` and before the closing `}` of the switch:

```ts
          case 'unwrite':
            // Approximate: same as fade_out
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fade_out_large': {
            const endScale = obj.exitAnimScale ?? 1.5;
            const sc = 1 + (endScale - 1) * (1 - eased);
            overrides.scaleX = sc * (overrides.scaleX ?? 1);
            overrides.scaleY = sc * (overrides.scaleY ?? 1);
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          }
```

- [ ] **Step 3: Verify typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit
```
Expected: all tests pass (555+ with new ones).

- [ ] **Step 5: Commit**

```bash
git add services/web/src/engine/playback.ts
git commit -m "feat(playback): canvas preview for 6 new anim presets"
```

---

## Task 6: Round-trip parser

**Files:**
- Modify: `services/web/src/export/manim.ts`

The parser reads each line from the generated Python and maps back to the object model.
The current pattern (from line ~2252) is: `m = line.match(/<regex>)`. We follow that pattern.

- [ ] **Step 1: Add round-trip tests first**

Append to `services/web/tests/components/extended-anim-presets.test.ts`:

```ts
import { parseManimScript } from '../../src/export/manim.js';

describe('extended anim presets round-trip', () => {
  function roundTrip(enterAnim: string, extra?: Record<string, unknown>) {
    const proj = makeProject({ enterAnim, ...extra });
    const code = generateScene(proj);
    const parsed = parseManimScript(code);
    return parsed.objects[0];
  }

  function roundTripExit(exitAnim: string, extra?: Record<string, unknown>) {
    const proj = makeProject({ enterAnim: 'fade_in', exitAnim, ...extra });
    const code = generateScene(proj);
    const parsed = parseManimScript(code);
    return parsed.objects[0];
  }

  it('draw_border_fill round-trips', () => {
    const obj = roundTrip('draw_border_fill');
    expect(obj.enterAnim).toBe('draw_border_fill');
  });

  it('grow_arrow round-trips', () => {
    const obj = roundTrip('grow_arrow', { type: 'arrow' });
    expect(obj.enterAnim).toBe('grow_arrow');
  });

  it('grow_from_edge RIGHT round-trips', () => {
    const obj = roundTrip('grow_from_edge', { enterAnimDir: 'RIGHT' });
    expect(obj.enterAnim).toBe('grow_from_edge');
    expect(obj.enterAnimDir).toBe('RIGHT');
  });

  it('grow_from_edge UP round-trips', () => {
    const obj = roundTrip('grow_from_edge', { enterAnimDir: 'UP' });
    expect(obj.enterAnim).toBe('grow_from_edge');
    expect(obj.enterAnimDir).toBe('UP');
  });

  it('fade_in_large scale=1.5 round-trips', () => {
    const obj = roundTrip('fade_in_large', { enterAnimScale: 1.5 });
    expect(obj.enterAnim).toBe('fade_in_large');
    expect(obj.enterAnimScale).toBeCloseTo(1.5);
  });

  it('fade_in_large scale=2.0 round-trips', () => {
    const obj = roundTrip('fade_in_large', { enterAnimScale: 2.0 });
    expect(obj.enterAnim).toBe('fade_in_large');
    expect(obj.enterAnimScale).toBeCloseTo(2.0);
  });

  it('unwrite exit round-trips', () => {
    const obj = roundTripExit('unwrite');
    expect(obj.exitAnim).toBe('unwrite');
  });

  it('fade_out_large scale=1.5 exit round-trips', () => {
    const obj = roundTripExit('fade_out_large', { exitAnimScale: 1.5 });
    expect(obj.exitAnim).toBe('fade_out_large');
    expect(obj.exitAnimScale).toBeCloseTo(1.5);
  });

  it('plain FadeIn still parses as fade_in (regression)', () => {
    const obj = roundTrip('fade_in');
    expect(obj.enterAnim).toBe('fade_in');
  });
});
```

- [ ] **Step 2: Run — expect round-trip tests to fail**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit -- --reporter=verbose extended-anim-presets
```
Expected: round-trip `describe` block FAIL.

- [ ] **Step 3: Add parser branches**

In `services/web/src/export/manim.ts`, find the block starting around line 2252 with:
```ts
    m = line.match(/^self\.play\(FadeIn\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
```

**Replace** that single `FadeIn` match with a two-branch version that detects `scale=`:

```ts
    // FadeIn with scale → fade_in_large
    m = line.match(/^self\.play\(FadeIn\((\w+),\s*scale=([\d.]+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'fade_in_large';
        objById[id].enterAnimScale = parseFloat(m[2]);
      }
      ct += parseFloat(m[3] || '0.5');
      continue;
    }
    // Plain FadeIn → fade_in
    m = line.match(/^self\.play\(FadeIn\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'fade_in';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }
```

Then add the remaining 4 new enter + 2 exit branches. Find the block right after the `AddTextLetterByLetter` match and **insert before** the `ReplacementTransform` match:

```ts
    m = line.match(/^self\.play\(DrawBorderThenFill\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'draw_border_fill';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(GrowArrow\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'grow_arrow';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(GrowFromEdge\((\w+),\s*edge=(\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'grow_from_edge';
        objById[id].enterAnimDir = m[2] as 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
      }
      ct += parseFloat(m[3] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(Unwrite\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].exitAnim = 'unwrite';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }
```

For `FadeOut` exit — there is an existing plain match at around line 2460 in `manim.ts`:
```ts
    m = line.match(/^self\.play\(FadeOut\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
```
The plain regex will NOT match `FadeOut(n, scale=1.5)` (comma after `\w+` prevents it), but add the scale-aware version **immediately before** that existing match anyway, for clarity:

```ts
    // FadeOut with scale → fade_out_large
    m = line.match(/^self\.play\(FadeOut\((\w+),\s*scale=([\d.]+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].exitAnim = 'fade_out_large';
        objById[id].exitAnimScale = parseFloat(m[2]);
      }
      ct += parseFloat(m[3] || '0.5');
      continue;
    }
```

- [ ] **Step 4: Run round-trip tests — expect pass**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit -- --reporter=verbose extended-anim-presets
```
Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit
```
Expected: all tests pass (no regressions in existing parser tests).

- [ ] **Step 6: Commit**

```bash
git add services/web/src/export/manim.ts services/web/tests/components/extended-anim-presets.test.ts
git commit -m "feat(parser): round-trip parser for 6 new anim presets + regression guard for plain FadeIn/FadeOut"
```

---

## Task 7: Inspector UI

**Files:**
- Modify: `services/web/src/components/inspector/panels/ObjectInspector.vue`

- [ ] **Step 1: Update imports**

In the `<script setup lang="ts">` block, change:
```ts
import { ENTER_ANIMS, EXIT_ANIMS } from '../../../store/project.js';
```
to:
```ts
import { ENTER_ANIMS, EXIT_ANIMS, availableEnterAnims, availableExitAnims } from '../../../store/project.js';
```
(`ENTER_ANIMS`/`EXIT_ANIMS` stay — they're still used for the `enterAnimDesc`/`exitAnimDesc` lookups.)

- [ ] **Step 2: Replace static list refs with computed filtered lists**

Find:
```ts
const enterAnims = ENTER_ANIMS;
const exitAnims = EXIT_ANIMS;
```
Replace with:
```ts
const enterAnims = computed(() => availableEnterAnims(obj.value?.type ?? ''));
const exitAnims  = computed(() => availableExitAnims(obj.value?.type ?? ''));
```

- [ ] **Step 3: Auto-reset on incompatible selection**

Add a watcher that resets the selected animation when the object type changes and the current selection is no longer in the filtered list. Insert after the `enterAnims`/`exitAnims` computed declarations:

```ts
import { computed, watch } from 'vue';
```
(update the existing `import { computed } from 'vue'` line)

```ts
watch(
  () => obj.value?.type,
  () => {
    if (!obj.value) return;
    const validEnter = enterAnims.value.map((a) => a.value);
    const validExit  = exitAnims.value.map((a) => a.value);
    if (obj.value.enterAnim && !validEnter.includes(obj.value.enterAnim)) {
      u('enterAnim', 'fade_in');
    }
    if (obj.value.exitAnim && !validExit.includes(obj.value.exitAnim)) {
      u('exitAnim', 'none');
    }
  }
);
```

- [ ] **Step 4: Update `enterAnimDesc` and `exitAnimDesc` computed**

Find:
```ts
const enterAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = ENTER_ANIMS.find((a) => a.value === (obj.value.enterAnim || 'fade_in'));
  return a ? a.desc : '';
});
const exitAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = EXIT_ANIMS.find((a) => a.value === (obj.value.exitAnim || 'fade_out'));
  return a ? a.desc : '';
});
```
Replace with (use the full lists for description lookup — already imported in Step 1):
```ts
const enterAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = ENTER_ANIMS.find((a) => a.value === (obj.value!.enterAnim || 'fade_in'));
  return a ? a.desc : '';
});
const exitAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = EXIT_ANIMS.find((a) => a.value === (obj.value!.exitAnim || 'fade_out'));
  return a ? a.desc : '';
});
```
(Keep `ENTER_ANIMS`/`EXIT_ANIMS` in imports for desc lookup, just remove them from the binding.)

- [ ] **Step 5: Add parameter controls in template**

In the `<template>` section, find the Entrance `<Section>` block:
```html
      <p class="text-[8px] text-studio-text-muted/40 leading-snug">{{ enterAnimDesc }}</p>
```
Insert **before** that `<p>` line:
```html
      <!-- grow_from_edge: direction picker -->
      <div v-if="obj.enterAnim === 'grow_from_edge'" class="flex items-center gap-2">
        <span class="text-[9px] text-studio-text-muted w-14">Direction</span>
        <select
          class="select text-xs"
          :value="obj.enterAnimDir || 'LEFT'"
          @change="store.setEnterAnimDir(obj.id, ($event.target as HTMLSelectElement).value as 'LEFT'|'RIGHT'|'UP'|'DOWN')"
        >
          <option value="LEFT">← Left</option>
          <option value="RIGHT">→ Right</option>
          <option value="UP">↑ Up</option>
          <option value="DOWN">↓ Down</option>
        </select>
      </div>
      <!-- fade_in_large: scale -->
      <div v-if="obj.enterAnim === 'fade_in_large'" class="flex items-center gap-2">
        <span class="text-[9px] text-studio-text-muted w-14">Scale</span>
        <input
          class="input input-sm w-16"
          type="number"
          min="1.1"
          max="5.0"
          step="0.1"
          :value="obj.enterAnimScale ?? 1.5"
          @change="store.setEnterAnimScale(obj.id, Number(($event.target as HTMLInputElement).value))"
        />
      </div>
```

Find the Exit `<Section>` block with the same `<p>` desc line and insert **before** it:
```html
      <!-- fade_out_large: scale -->
      <div v-if="obj.exitAnim === 'fade_out_large'" class="flex items-center gap-2">
        <span class="text-[9px] text-studio-text-muted w-14">Scale</span>
        <input
          class="input input-sm w-16"
          type="number"
          min="1.1"
          max="5.0"
          step="0.1"
          :value="obj.exitAnimScale ?? 1.5"
          @change="store.setExitAnimScale(obj.id, Number(($event.target as HTMLInputElement).value))"
        />
      </div>
```

- [ ] **Step 6: Typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add services/web/src/components/inspector/panels/ObjectInspector.vue
git commit -m "feat(inspector): filtered anim dropdown + direction/scale param controls for new presets"
```

---

## Task 8: Final integration check

- [ ] **Step 1: Run all test suites**

```bash
cd D:/PYTHON/Manim-Editor && npm run test:unit && npm test --workspace services/api && npm test --workspace packages/manim-codegen
```
Expected: all pass.

- [ ] **Step 2: Run lint and typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run lint && npm run typecheck && npm run format:check
```
Expected: no errors.

- [ ] **Step 3: Smoke-test in browser (if Docker available)**

1. Start the editor: `cd services/web && npm run dev`
2. Create a new Visual project
3. Add a `circle` → Entrance dropdown: `Draw Border Fill`, `Grow From Edge` should appear; `Typewriter`, `Grow Arrow` should NOT appear
4. Change object to `arrow` → `Grow Arrow` should appear
5. Select `Grow From Edge` → Direction picker appears below
6. Select `fade_in_large` → Scale input appears below
7. Add `fade_out_large` exit → Scale input appears below
8. Use "Generated Code" view to confirm `DrawBorderThenFill`, `GrowFromEdge(obj, edge=LEFT)`, `FadeIn(obj, scale=1.5)` appear in the Python output

- [ ] **Step 4: Final commit (if any formatting fixes)**

```bash
cd D:/PYTHON/Manim-Editor && npm run format
git add -A
git commit -m "style: prettier format extended anim presets"
```
(Skip if `format:check` already passed.)
