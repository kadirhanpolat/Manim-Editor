# Math Annotation Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three "bound annotation" object types — `surrounding_rect` (`SurroundingRectangle`), `underline` (`Underline`), `cross` (`Cross`) — that visually mark up a target object in the scene.

**Architecture:** Each annotation stores a `targetId` field referencing its target. The canvas computes its Konva visual from the target's bounding box via a new `objectBounds(id)` method in `StageCtx`. Codegen emits the Manim constructor referencing the target by Manim variable name (`vn(targetId)`). A topological sort in `generateScene` ensures annotations are emitted after their targets. Annotation types skip the generic `move_to` post-construction block.

**Tech Stack:** Vue 3 + Pinia (`project.ts`), Konva.js (`relational.ts`), `@manim/codegen` TypeScript package, `manim.ts` regex parser, Vitest.

---

## File Map

| File | Change |
|---|---|
| `packages/manim-codegen/src/constants.ts` | Add `ANNOTATION_TYPES` set |
| `packages/manim-codegen/src/objects.ts` | 3 new case arms; gate post-construction block |
| `packages/manim-codegen/src/index.ts` | Topological sort before object loop |
| `services/web/src/store/project.ts` | SHAPE_DEFAULTS, nameMap, `setAnnotationTarget`, cascade delete |
| `services/web/src/export/manim.ts` | Generator mirror + 3 parser branches |
| `services/web/src/components/stage/configs/context.ts` | `objectBounds` in `StageCtx` + `CTX_KEYS` |
| `services/web/src/components/stage/configs/relational.ts` | 3 builder functions |
| `services/web/src/components/stage/StageCanvas.vue` | `objectBounds` impl + 3 template branches |
| `services/web/src/components/inspector/object-settings/AnnotationSettings.vue` | New component (create) |
| `services/web/src/components/inspector/object-settings/index.ts` | 3 registry entries |
| `services/web/src/components/sidebar/AssetSidebar.vue` | 3 palette cards |
| `services/web/tests/components/annotation-tools.test.ts` | Store + codegen + round-trip + cascade tests (create) |
| `services/web/tests/components/ui-tools-audit.test.ts` | Add 3 types to REGISTERED_TYPES |

---

## Task 1: Store — SHAPE_DEFAULTS, nameMap, setAnnotationTarget, cascade delete

**Files:**
- Modify: `services/web/src/store/project.ts`
- Create: `services/web/tests/components/annotation-tools.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `services/web/tests/components/annotation-tools.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store: ReturnType<typeof useProjectStore>;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('annotation store — seeding', () => {
  it('surrounding_rect seeds with color, strokeWidth, buff, cornerRadius, empty targetId', () => {
    store.addObject('surrounding_rect', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('surrounding_rect');
    expect(o.color).toBe('#facc15');
    expect(o.strokeWidth).toBe(2);
    expect(o.buff).toBe(10);
    expect(o.cornerRadius).toBe(0);
    expect(o.targetId).toBe('');
  });

  it('underline seeds with color, strokeWidth, buff, empty targetId', () => {
    store.addObject('underline', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('underline');
    expect(o.color).toBe('#f97316');
    expect(o.strokeWidth).toBe(2);
    expect(o.buff).toBe(6);
    expect(o.targetId).toBe('');
  });

  it('cross seeds with color, strokeWidth, empty targetId', () => {
    store.addObject('cross', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('cross');
    expect(o.color).toBe('#ef4444');
    expect(o.strokeWidth).toBe(3);
    expect(o.targetId).toBe('');
  });
});

describe('annotation store — setAnnotationTarget', () => {
  it('updates targetId and commits state', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('surrounding_rect', 960, 540);
    const ann = store.project.objects[1];
    const histLen = store.history.length;
    store.setAnnotationTarget(ann.id, circle.id);
    expect(ann.targetId).toBe(circle.id);
    expect(store.history.length).toBe(histLen + 1);
  });

  it('no-ops if object not found', () => {
    const histLen = store.history.length;
    store.setAnnotationTarget('nonexistent', 'target');
    expect(store.history.length).toBe(histLen);
  });
});

describe('annotation store — cascade delete', () => {
  it('deleting a target also deletes all bound annotations', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('surrounding_rect', 960, 540);
    const ann1 = store.project.objects[1];
    store.addObject('underline', 960, 540);
    const ann2 = store.project.objects[2];
    store.setAnnotationTarget(ann1.id, circle.id);
    store.setAnnotationTarget(ann2.id, circle.id);

    store.deleteObject(circle.id);

    expect(store.project.objects.find(o => o.id === ann1.id)).toBeUndefined();
    expect(store.project.objects.find(o => o.id === ann2.id)).toBeUndefined();
    expect(store.project.objects.find(o => o.id === circle.id)).toBeUndefined();
  });

  it('deleting a non-targeted object does not cascade to unrelated annotations', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('rectangle', 960, 540);
    const rect = store.project.objects[1];
    store.addObject('surrounding_rect', 960, 540);
    const ann = store.project.objects[2];
    store.setAnnotationTarget(ann.id, circle.id);

    store.deleteObject(rect.id);

    expect(store.project.objects.find(o => o.id === ann.id)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd services/web && npm run test:unit -- annotation-tools
```

Expected: FAIL — `addObject('surrounding_rect')` likely hits the fallback `circle` default.

- [ ] **Step 3: Add SHAPE_DEFAULTS entries**

In `services/web/src/store/project.ts`, find the `export const SHAPE_DEFAULTS = {` block and add after the last existing entry (before the closing `}`):

```ts
  surrounding_rect: { width: 160, height: 80, fill: '#facc15', stroke: '#facc15', strokeWidth: 2, color: '#facc15', buff: 10, cornerRadius: 0, targetId: '' },
  underline:        { width: 160, height: 20, fill: '#f97316', stroke: '#f97316', strokeWidth: 2, color: '#f97316', buff: 6, targetId: '' },
  cross:            { width: 160, height: 80, fill: '#ef4444', stroke: '#ef4444', strokeWidth: 3, color: '#ef4444', targetId: '' },
```

- [ ] **Step 4: Add nameMap entries**

In the same file, inside the `addObject` action, find the `const nameMap = {` block and add before the closing `}`:

```ts
        surrounding_rect: 'Çerçeve',
        underline: 'Altı Çizgi',
        cross: 'Üstü Çizili',
```

- [ ] **Step 5: Add setAnnotationTarget action**

In `services/web/src/store/project.ts`, find another setter action (e.g. `setRelationalLabel`) and add the new action after it:

```ts
    setAnnotationTarget(objId: string, targetId: string) {
      const obj = this.objectById(objId);
      if (!obj) return;
      obj.targetId = targetId;
      this.commitState();
    },
```

- [ ] **Step 6: Add cascade delete in deleteObject**

In `deleteObject`, find the line `this.isDirty = true;` near the end and add BEFORE it:

```ts
      // Cascade: remove annotation objects bound to this target
      const ANNOTATION_TYPES = new Set(['surrounding_rect', 'underline', 'cross']);
      const boundAnnotations = this.project.objects
        .filter(o => ANNOTATION_TYPES.has(o.type as string) && o.targetId === id)
        .map(o => o.id);
      for (const annId of boundAnnotations) {
        const ai = this.project.objects.findIndex(o => o.id === annId);
        if (ai !== -1) this.project.objects.splice(ai, 1);
        const si = this.selectedObjectIds.indexOf(annId);
        if (si !== -1) this.selectedObjectIds.splice(si, 1);
      }
```

- [ ] **Step 7: Run tests and confirm they pass**

```
cd services/web && npm run test:unit -- annotation-tools
```

Expected: All annotation store tests PASS.

- [ ] **Step 8: Commit**

```bash
git add services/web/src/store/project.ts services/web/tests/components/annotation-tools.test.ts
git commit -m "feat(store): add surrounding_rect/underline/cross annotation types with cascade delete"
```

---

## Task 2: @manim/codegen — ANNOTATION_TYPES constant + objectCode cases

**Files:**
- Modify: `packages/manim-codegen/src/constants.ts`
- Modify: `packages/manim-codegen/src/objects.ts`

- [ ] **Step 1: Add ANNOTATION_TYPES to constants.ts**

In `packages/manim-codegen/src/constants.ts`, add after the `SHADOW_TYPES` set:

```ts
export const ANNOTATION_TYPES: Set<string> = new Set([
  'surrounding_rect',
  'underline',
  'cross',
]);
```

- [ ] **Step 2: Write failing codegen tests**

Add to `services/web/tests/components/annotation-tools.test.ts`:

```ts
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;

function makeProject(objects: object[]) {
  return {
    name: 'T', sceneType: '2d',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    sceneDuration: 5, fps: 60,
    objects, tracks: [], cameraTrack: [], assets: [], groups: [],
  };
}

function baseObj(id: string, type: string, extra: object = {}) {
  return {
    id, type,
    x: 960, y: 540, width: 160, height: 80,
    fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
    opacity: 1, rotation: 0, zOrder: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none',
    enterAnimDur: 0.5, exitAnimDur: 0.5,
    ...extra,
  };
}

describe('annotation codegen', () => {
  it('surrounding_rect emits SurroundingRectangle referencing target variable', () => {
    const circle = baseObj('circle1', 'circle', { width: 120, height: 120 });
    const ann = baseObj('ann1', 'surrounding_rect', {
      color: '#facc15', strokeWidth: 2, buff: 10, cornerRadius: 0, targetId: 'circle1',
    });
    const s = generateManimScript(makeProject([circle, ann]));
    expect(s).toMatch(/ann1 = SurroundingRectangle\(circle1,/);
    expect(s).toMatch(/color="#facc15"/);
    expect(s).toMatch(/buff=0\.07/);
    expect(s).toMatch(/corner_radius=0\.000/);
  });

  it('surrounding_rect does NOT emit move_to', () => {
    const circle = baseObj('circle1', 'circle', { width: 120, height: 120 });
    const ann = baseObj('ann1', 'surrounding_rect', {
      color: '#facc15', strokeWidth: 2, buff: 10, cornerRadius: 0, targetId: 'circle1',
    });
    const s = generateManimScript(makeProject([circle, ann]));
    // Only the circle should have move_to, not the annotation
    const lines = s.split('\n').filter(l => l.includes('ann1') && l.includes('move_to'));
    expect(lines).toHaveLength(0);
  });

  it('underline emits Underline referencing target', () => {
    const latex = baseObj('lbl1', 'latex', { latex: 'E=mc^2' });
    const ann = baseObj('ann2', 'underline', {
      color: '#f97316', strokeWidth: 2, buff: 6, targetId: 'lbl1',
    });
    const s = generateManimScript(makeProject([latex, ann]));
    expect(s).toMatch(/ann2 = Underline\(lbl1,/);
    expect(s).toMatch(/color="#f97316"/);
  });

  it('cross emits Cross referencing target', () => {
    const latex = baseObj('lbl1', 'latex', { latex: 'wrong' });
    const ann = baseObj('ann3', 'cross', {
      color: '#ef4444', strokeWidth: 3, targetId: 'lbl1',
    });
    const s = generateManimScript(makeProject([latex, ann]));
    expect(s).toMatch(/ann3 = Cross\(lbl1,/);
    expect(s).toMatch(/stroke_color="#ef4444"/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
cd services/web && npm run test:unit -- annotation-tools
```

Expected: FAIL — `SurroundingRectangle` / `Underline` / `Cross` not emitted yet.

- [ ] **Step 4: Import ANNOTATION_TYPES in objects.ts**

In `packages/manim-codegen/src/objects.ts`, add `ANNOTATION_TYPES` to the import from `./constants.js`:

```ts
import {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  FRAME_X_RADIUS,
  FRAME_Y_RADIUS,
  GRADIENT_TYPES,
  ANNOTATION_TYPES,
} from './constants.js';
```

- [ ] **Step 5: Add 3 case arms to the switch in objectCode**

In `packages/manim-codegen/src/objects.ts`, find `case 'numberline':` (near line 563) and add AFTER its `break;` but BEFORE `default:`:

```ts
    case 'surrounding_rect': {
      const target = vn(o.targetId as string || '');
      const buffM = safeNum((o.buff as number ?? 10) / sw * FRAME_WIDTH, 0.1);
      const crM = safeNum((o.cornerRadius as number ?? 0) / sw * FRAME_WIDTH, 0);
      lines.push(
        `${n} = SurroundingRectangle(${target}, color=${fill}, stroke_width=${sw2}, buff=${buffM.toFixed(3)}, corner_radius=${crM.toFixed(3)})`
      );
      break;
    }
    case 'underline': {
      const target = vn(o.targetId as string || '');
      const buffM = safeNum((o.buff as number ?? 6) / sw * FRAME_WIDTH, 0.05);
      lines.push(
        `${n} = Underline(${target}, color=${fill}, stroke_width=${sw2}, buff=${buffM.toFixed(3)})`
      );
      break;
    }
    case 'cross': {
      const target = vn(o.targetId as string || '');
      lines.push(
        `${n} = Cross(${target}, stroke_color=${fill}, stroke_width=${sw2})`
      );
      break;
    }
```

- [ ] **Step 6: Gate the post-construction block to skip annotation types**

In `packages/manim-codegen/src/objects.ts`, find the post-construction block after the switch (lines starting with `const rc = roundCornersLine`). Wrap the entire block with an annotation guard:

```ts
  if (!ANNOTATION_TYPES.has(o.type)) {
    const rc = roundCornersLine(n, o, sw);
    if (rc) lines.push(rc);
    const gl = gradientLine(n, o);
    if (gl && GRADIENT_TYPES.has(o.type)) lines.push(gl);
    for (const dl of dashedLines(n, o)) lines.push(dl);
    for (const sl of shadowLines(n, o, sw, sh)) lines.push(sl);
    lines.push(`${n}.move_to([${mp.x.toFixed(3)}, ${mp.y.toFixed(3)}, 0])`);
    if (o.rotation) lines.push(`${n}.rotate(${((o.rotation * Math.PI) / 180).toFixed(4)})`);
  }
  return lines;
```

- [ ] **Step 7: Run tests and confirm they pass**

```
cd services/web && npm run test:unit -- annotation-tools
```

Also run the full codegen package tests:

```
npm test --workspace packages/manim-codegen
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/manim-codegen/src/constants.ts packages/manim-codegen/src/objects.ts
git commit -m "feat(codegen): add surrounding_rect/underline/cross annotation object cases"
```

---

## Task 3: @manim/codegen — topological sort in generateScene

**Files:**
- Modify: `packages/manim-codegen/src/index.ts`

- [ ] **Step 1: Write failing topological sort test**

Add to `services/web/tests/components/annotation-tools.test.ts`:

```ts
describe('annotation codegen — topological sort', () => {
  it('annotation is always emitted after its target regardless of array order', () => {
    // Annotation placed BEFORE target in the array
    const ann = baseObj('ann1', 'surrounding_rect', {
      color: '#facc15', strokeWidth: 2, buff: 10, cornerRadius: 0, targetId: 'circle1',
    });
    const circle = baseObj('circle1', 'circle', { width: 120, height: 120 });
    const s = generateManimScript(makeProject([ann, circle]));
    const lines = s.split('\n');
    const circleIdx = lines.findIndex(l => l.includes('circle1 = Circle'));
    const annIdx = lines.findIndex(l => l.includes('ann1 = SurroundingRectangle'));
    expect(circleIdx).toBeGreaterThan(-1);
    expect(annIdx).toBeGreaterThan(-1);
    expect(annIdx).toBeGreaterThan(circleIdx);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- annotation-tools
```

Expected: FAIL — annotation may appear before target if it's first in the array.

- [ ] **Step 3: Add topological sort to index.ts**

In `packages/manim-codegen/src/index.ts`, add the sort import at the top:

```ts
import { ANNOTATION_TYPES } from './constants.js';
```

Then in the `generateScene` function, find the line `for (const o of project.objects) {` (inside the `// ── Object definitions ──` block) and add the sort BEFORE the loop:

```ts
  // Sort: annotation objects must be emitted after their targets
  const sortedObjects = [
    ...(project.objects || []).filter(o => !ANNOTATION_TYPES.has(o.type)),
    ...(project.objects || []).filter(o => ANNOTATION_TYPES.has(o.type)),
  ];

  for (const o of sortedObjects) {
```

Also update `oMap` to use `sortedObjects`:

```ts
  for (const o of sortedObjects) {
    oMap[o.id] = o;
```

- [ ] **Step 4: Run tests and confirm they pass**

```
cd services/web && npm run test:unit -- annotation-tools
```

Expected: All topological sort tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/manim-codegen/src/index.ts
git commit -m "feat(codegen): topological sort ensures annotations emit after their targets"
```

---

## Task 4: manim.ts — round-trip parser branches

> `generateManimScript` in `manim.ts` is a one-line wrapper over `generateScene` from
> `@manim/codegen` — there is no generator code to mirror. Only the parser (`parseManimScript`)
> needs new branches.

**Files:**
- Modify: `services/web/src/export/manim.ts`

- [ ] **Step 1: Write failing round-trip tests**

Add to `services/web/tests/components/annotation-tools.test.ts`:

```ts
import { parseManimScript } from '../../src/export/manim.js';

describe('annotation round-trip', () => {
  it('surrounding_rect round-trips (type, color, buff, cornerRadius, targetId)', () => {
    const circle = baseObj('circle1', 'circle', { width: 120, height: 120 });
    const ann = baseObj('ann1', 'surrounding_rect', {
      color: '#facc15', strokeWidth: 2, buff: 10, cornerRadius: 0, targetId: 'circle1',
    });
    const project = makeProject([circle, ann]);
    const parsed = parseManimScript(generateManimScript(project as any), SW, SH);
    const parsedAnn = parsed.objects.find((o: any) => o.type === 'surrounding_rect');
    expect(parsedAnn).toBeDefined();
    expect(parsedAnn!.color).toBe('#facc15');
    expect(parsedAnn!.targetId).toBe('circle1');
    expect(Number(parsedAnn!.buff)).toBeCloseTo(10, 0);
    expect(Number(parsedAnn!.cornerRadius)).toBeCloseTo(0, 1);
  });

  it('underline round-trips (type, color, buff, targetId)', () => {
    const latex = baseObj('lbl1', 'latex', { latex: 'E=mc^2' });
    const ann = baseObj('ann2', 'underline', {
      color: '#f97316', strokeWidth: 2, buff: 6, targetId: 'lbl1',
    });
    const parsed = parseManimScript(
      generateManimScript(makeProject([latex, ann]) as any), SW, SH
    );
    const parsedAnn = parsed.objects.find((o: any) => o.type === 'underline');
    expect(parsedAnn).toBeDefined();
    expect(parsedAnn!.targetId).toBe('lbl1');
    expect(parsedAnn!.color).toBe('#f97316');
  });

  it('cross round-trips (type, color, strokeWidth, targetId)', () => {
    const latex = baseObj('lbl1', 'latex', { latex: 'wrong' });
    const ann = baseObj('ann3', 'cross', {
      color: '#ef4444', strokeWidth: 3, targetId: 'lbl1',
    });
    const parsed = parseManimScript(
      generateManimScript(makeProject([latex, ann]) as any), SW, SH
    );
    const parsedAnn = parsed.objects.find((o: any) => o.type === 'cross');
    expect(parsedAnn).toBeDefined();
    expect(parsedAnn!.targetId).toBe('lbl1');
    expect(parsedAnn!.color).toBe('#ef4444');
    expect(Number(parsedAnn!.strokeWidth)).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd services/web && npm run test:unit -- annotation-tools
```

Expected: FAIL — parser does not recognize annotation constructors yet.

- [ ] **Step 3: Add parser branches to manim.ts**

In `services/web/src/export/manim.ts`, find `parseManimScript`. It iterates script lines and uses regex to reconstruct objects. Add three new branches (follow the brace/angle pattern):

The generated script lines look like:
```
ann1 = SurroundingRectangle(circle1, color="#facc15", stroke_width=2, buff=0.074, corner_radius=0.000)
ann2 = Underline(lbl1, color="#f97316", stroke_width=2, buff=0.044)
ann3 = Cross(lbl1, stroke_color="#ef4444", stroke_width=3)
```

In `parseManimScript`, the `varMap: Record<string, string>` maps Python variable names → object IDs.
`varMap['circle1']` gives the circle's ID — use this directly as `targetId`.

Add these branches inside the per-line parser loop, following the same structure as the `BraceBetweenPoints` branch (around line 1016):

```ts
    // surrounding_rect — SurroundingRectangle
    m = line.match(
      /^(\w+)\s*=\s*SurroundingRectangle\((\w+),\s*color="(#[0-9a-fA-F]+)",\s*stroke_width=([\d.]+),\s*buff=([\d.]+),\s*corner_radius=([\d.]+)\)/
    );
    if (m) {
      const [, varName, targetVar, color, sw2, buff, cr] = m;
      const targetId = varMap[targetVar] || '';
      const buffPx = Math.round(parseFloat(buff) / FRAME_WIDTH * sw);
      const crPx = Math.round(parseFloat(cr) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id, type: 'surrounding_rect',
        name: varName,
        x: sw / 2, y: sh / 2, width: 160, height: 80,
        fill: color, stroke: color, strokeWidth: parseFloat(sw2),
        color, buff: buffPx, cornerRadius: crPx, targetId,
        opacity: 1, rotation: 0, zOrder: objIdx,
        enterTime: 0, duration: ct || 5,
        enterAnim: 'none', exitAnim: 'none', enterAnimDur: 0.5, exitAnimDur: 0.5,
      };
      varMap[varName] = id;
      objById[id] = obj;
      objects.push(obj);
      continue;
    }

    // underline — Underline
    m = line.match(
      /^(\w+)\s*=\s*Underline\((\w+),\s*color="(#[0-9a-fA-F]+)",\s*stroke_width=([\d.]+),\s*buff=([\d.]+)\)/
    );
    if (m) {
      const [, varName, targetVar, color, sw2, buff] = m;
      const targetId = varMap[targetVar] || '';
      const buffPx = Math.round(parseFloat(buff) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id, type: 'underline',
        name: varName,
        x: sw / 2, y: sh / 2, width: 160, height: 20,
        fill: color, stroke: color, strokeWidth: parseFloat(sw2),
        color, buff: buffPx, targetId,
        opacity: 1, rotation: 0, zOrder: objIdx,
        enterTime: 0, duration: ct || 5,
        enterAnim: 'none', exitAnim: 'none', enterAnimDur: 0.5, exitAnimDur: 0.5,
      };
      varMap[varName] = id;
      objById[id] = obj;
      objects.push(obj);
      continue;
    }

    // cross — Cross
    m = line.match(
      /^(\w+)\s*=\s*Cross\((\w+),\s*stroke_color="(#[0-9a-fA-F]+)",\s*stroke_width=([\d.]+)\)/
    );
    if (m) {
      const [, varName, targetVar, color, sw2] = m;
      const targetId = varMap[targetVar] || '';
      const id = uid('obj');
      const obj: SceneObject = {
        id, type: 'cross',
        name: varName,
        x: sw / 2, y: sh / 2, width: 160, height: 80,
        fill: color, stroke: color, strokeWidth: parseFloat(sw2),
        color, targetId,
        opacity: 1, rotation: 0, zOrder: objIdx,
        enterTime: 0, duration: ct || 5,
        enterAnim: 'none', exitAnim: 'none', enterAnimDur: 0.5, exitAnimDur: 0.5,
      };
      varMap[varName] = id;
      objById[id] = obj;
      objects.push(obj);
      continue;
    }
```

**Note:** Check which variable holds "current time" (`ct`) and "scene duration" in the parser's scope, and use the same variables (e.g. `sceneDuration` or `ct`). The brace parser around line 1020 shows the exact field assignments to follow.

- [ ] **Step 4: Run tests and confirm they pass**

```
cd services/web && npm run test:unit -- annotation-tools
```

Expected: All round-trip tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/export/manim.ts services/web/tests/components/annotation-tools.test.ts
git commit -m "feat(parser): add surrounding_rect/underline/cross round-trip parser branches"
```

---

## Task 5: Canvas context — objectBounds in StageCtx

**Files:**
- Modify: `services/web/src/components/stage/configs/context.ts`
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Add objectBounds to StageCtx interface**

In `services/web/src/components/stage/configs/context.ts`, add to the `StageCtx` interface after `selectedObjectIds`:

```ts
  /**
   * Return the canvas-coordinate bounding box for a scene object by ID,
   * or null if the object is not found / not visible.
   */
  objectBounds: (id: string) => { x: number; y: number; width: number; height: number } | null;
```

Add `'objectBounds'` to `CTX_KEYS`:

```ts
  'objectBounds',
```

- [ ] **Step 2: Implement objectBounds in StageCanvas.vue**

In `services/web/src/components/stage/StageCanvas.vue`, find the `ctx` computed object (where all `StageCtx` fields are assembled). Add `objectBounds` as a method:

```ts
        objectBounds(id: string) {
          const target = store.objectById(id);
          if (!target || target.visible === false) return null;
          const effTarget = eff(target);
          const pos = s2c(
            (effTarget.x as number) - (effTarget.width as number) / 2,
            (effTarget.y as number) - (effTarget.height as number) / 2
          );
          return {
            x: pos.x,
            y: pos.y,
            width: ((effTarget.width as number) || 0) * vs,
            height: ((effTarget.height as number) || 0) * vs,
          };
        },
```

- [ ] **Step 3: Run typecheck**

```
npm run typecheck
```

Expected: PASS — no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/stage/configs/context.ts services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): add objectBounds to StageCtx for annotation position resolution"
```

---

## Task 6: Canvas preview — relational.ts builders + StageCanvas template

**Files:**
- Modify: `services/web/src/components/stage/configs/relational.ts`
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Add 3 builder functions to relational.ts**

In `services/web/src/components/stage/configs/relational.ts`, add at the end of the file:

```ts
export function surroundingRectCfg(
  obj: SceneObject,
  ctx: StageCtx
): Record<string, unknown> | null {
  const bounds = ctx.objectBounds(obj.targetId as string);
  if (!bounds) return null;
  const buff = ((obj.buff as number | undefined) ?? 10) * ctx.vs;
  return {
    x: bounds.x - buff,
    y: bounds.y - buff,
    width: bounds.width + buff * 2,
    height: bounds.height + buff * 2,
    stroke: (obj.color as string | undefined) || '#facc15',
    strokeWidth: ((obj.strokeWidth as number | undefined) ?? 2) * ctx.vs,
    cornerRadius: ((obj.cornerRadius as number | undefined) ?? 0) * ctx.vs,
    fill: 'transparent',
    listening: false,
  };
}

export function underlineCfg(
  obj: SceneObject,
  ctx: StageCtx
): Record<string, unknown> | null {
  const bounds = ctx.objectBounds(obj.targetId as string);
  if (!bounds) return null;
  const buff = ((obj.buff as number | undefined) ?? 6) * ctx.vs;
  return {
    points: [
      bounds.x, bounds.y + bounds.height + buff,
      bounds.x + bounds.width, bounds.y + bounds.height + buff,
    ],
    stroke: (obj.color as string | undefined) || '#f97316',
    strokeWidth: ((obj.strokeWidth as number | undefined) ?? 2) * ctx.vs,
    listening: false,
  };
}

export function crossCfg(
  obj: SceneObject,
  ctx: StageCtx
): Array<Record<string, unknown>> | null {
  const bounds = ctx.objectBounds(obj.targetId as string);
  if (!bounds) return null;
  const stroke = (obj.color as string | undefined) || '#ef4444';
  const strokeWidth = ((obj.strokeWidth as number | undefined) ?? 3) * ctx.vs;
  return [
    {
      points: [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height],
      stroke, strokeWidth, listening: false,
    },
    {
      points: [bounds.x + bounds.width, bounds.y, bounds.x, bounds.y + bounds.height],
      stroke, strokeWidth, listening: false,
    },
  ];
}
```

- [ ] **Step 2: Add template branches in StageCanvas.vue**

In `services/web/src/components/stage/StageCanvas.vue`, find the imports section and add:

```ts
import {
  // ... existing imports ...
  surroundingRectCfg,
  underlineCfg,
  crossCfg,
} from './configs/relational.js';
```

In the `<template>`, find where relational objects (brace/angle) are rendered and add a branch for each annotation type. Brace/angle are typically rendered as `<v-group>` with sub-nodes. Annotations are simpler — `surrounding_rect` uses a single `<v-rect>`, `underline` uses `<v-line>`, `cross` uses two `<v-line>` nodes:

```html
<!-- surrounding_rect -->
<template v-if="obj.type === 'surrounding_rect'">
  <v-rect
    v-if="surroundingRectCfg(obj, ctx)"
    :config="surroundingRectCfg(obj, ctx)"
  />
</template>

<!-- underline -->
<template v-if="obj.type === 'underline'">
  <v-line
    v-if="underlineCfg(obj, ctx)"
    :config="underlineCfg(obj, ctx)"
  />
</template>

<!-- cross -->
<template v-if="obj.type === 'cross'">
  <template v-if="crossCfg(obj, ctx)">
    <v-line
      v-for="(lineCfg, li) in crossCfg(obj, ctx)"
      :key="li"
      :config="lineCfg"
    />
  </template>
</template>
```

Place the `:key` attribute on the `<template v-for>` tag (not the `<v-line>`), per the Vue 3 rule in CLAUDE.md.

- [ ] **Step 3: Run typecheck and lint**

```
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/stage/configs/relational.ts services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): add surrounding_rect/underline/cross annotation preview builders"
```

---

## Task 7: Inspector — AnnotationSettings.vue + registry

**Files:**
- Create: `services/web/src/components/inspector/object-settings/AnnotationSettings.vue`
- Modify: `services/web/src/components/inspector/object-settings/index.ts`

- [ ] **Step 1: Create AnnotationSettings.vue**

Create `services/web/src/components/inspector/object-settings/AnnotationSettings.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import type { SceneObject } from '@manim/codegen';
import Section from '../ui/Section.vue';
import ColorRow from '../ui/ColorRow.vue';
import Num from '../ui/Num.vue';
import { useObjectUpdate } from '../useObjectUpdate.js';

const props = defineProps({
  obj: { type: Object as () => SceneObject, required: true },
});

const store = useProjectStore();
const { u } = useObjectUpdate(props);

const targetOptions = computed(() =>
  store.project.objects
    .filter(o => o.id !== props.obj.id)
    .map(o => ({ value: o.id, label: (o.name as string) || o.id }))
);

function setTarget(e: Event) {
  store.setAnnotationTarget(props.obj.id, (e.target as HTMLSelectElement).value);
}
</script>

<template>
  <Section label="Hedef Nesne">
    <div v-if="!obj.targetId" style="color: #f97316; font-size: 12px; margin-bottom: 6px">
      Hedef nesne seçin
    </div>
    <select
      :value="obj.targetId"
      style="width: 100%; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; padding: 4px 6px; font-size: 13px"
      @change="setTarget"
    >
      <option value="">— seçilmedi —</option>
      <option v-for="opt in targetOptions" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </Section>

  <Section label="Renk">
    <ColorRow label="Renk" :value="(obj.color as string) || '#ffffff'" @update="u('color', $event)" />
  </Section>

  <Section label="Çizgi">
    <Num label="Kalınlık" :value="(obj.strokeWidth as number) ?? 2" @update="u('strokeWidth', $event)" />
    <Num v-if="obj.type !== 'cross'" label="Boşluk (buff px)" :value="(obj.buff as number) ?? 0" @update="u('buff', $event)" />
    <Num v-if="obj.type === 'surrounding_rect'" label="Köşe Yarıçapı (px)" :value="(obj.cornerRadius as number) ?? 0" @update="u('cornerRadius', $event)" />
  </Section>
</template>
```

- [ ] **Step 2: Register in index.ts**

In `services/web/src/components/inspector/object-settings/index.ts`, import the component and add three entries to the registry map:

```ts
import AnnotationSettings from './AnnotationSettings.vue';

// In the registry object/map:
surrounding_rect: AnnotationSettings,
underline: AnnotationSettings,
cross: AnnotationSettings,
```

- [ ] **Step 3: Run typecheck**

```
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/object-settings/AnnotationSettings.vue services/web/src/components/inspector/object-settings/index.ts
git commit -m "feat(inspector): add AnnotationSettings panel for surrounding_rect/underline/cross"
```

---

## Task 8: Palette + ui-tools-audit guard

**Files:**
- Modify: `services/web/src/components/sidebar/AssetSidebar.vue`
- Modify: `services/web/tests/components/ui-tools-audit.test.ts`

- [ ] **Step 1: Add 3 types to REGISTERED_TYPES in ui-tools-audit.test.ts**

In `services/web/tests/components/ui-tools-audit.test.ts`, find the `const REGISTERED_TYPES = [` array and add:

```ts
  'surrounding_rect',
  'underline',
  'cross',
```

- [ ] **Step 2: Run audit test to see it fail**

```
cd services/web && npm run test:unit -- ui-tools-audit
```

Expected: FAIL — palette does not yet expose these types.

- [ ] **Step 3: Add palette cards to AssetSidebar.vue**

In `services/web/src/components/sidebar/AssetSidebar.vue`, find the `shapes` (or `shapesData`) array where `brace`, `angle` are listed. Add the three annotation cards to the same section (or create a new "Vurgu & Annotation" subsection):

```ts
{ type: 'surrounding_rect', label: 'Çerçeve', icon: '□' },
{ type: 'underline',        label: 'Altı Çizgi', icon: '‾' },
{ type: 'cross',            label: 'Üstü Çizili', icon: '✕' },
```

Each card must be a `.shape-card` element and call `store.addObject(type)` on click, following the same pattern as existing cards.

- [ ] **Step 4: Run audit test and confirm it passes**

```
cd services/web && npm run test:unit -- ui-tools-audit
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

```
cd services/web && npm run test:unit
cd services/web && npm test
npm test --workspace packages/manim-codegen
npm run typecheck
npm run lint
```

Expected: All suites PASS, no TypeScript errors, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add services/web/src/components/sidebar/AssetSidebar.vue services/web/tests/components/ui-tools-audit.test.ts
git commit -m "feat(palette): add surrounding_rect/underline/cross annotation cards to AssetSidebar"
```

---

## Final Checklist

- [ ] All 8 tasks committed to `main`
- [ ] `npm run test:unit` — green
- [ ] `npm test` (engine tests) — green
- [ ] `npm test --workspace packages/manim-codegen` — green
- [ ] `npm run typecheck` — green
- [ ] `npm run lint` — green
- [ ] Manual smoke: add a `latex` object + a `surrounding_rect`, pick the latex as target, confirm the yellow box appears in canvas and the generated Python contains `SurroundingRectangle`
