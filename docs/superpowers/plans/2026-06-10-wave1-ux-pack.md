# Wave 1 Track D — Editor UX Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click context menu, marquee multi-selection with group drag, object lock/hide (preview + codegen, with annotation cascade), and localStorage autosave with restore prompt.
**Branch:** feat/wave1-ux-pack (worktree+branch created by the orchestrator)
**Architecture:** All new behaviors are built on the existing Pinia store (`useProjectStore`) as small store actions, pure testable helpers (`engine/marquee.ts`, `engine/visibility.ts`, `configs/chrome.ts:lockConfig`), and thin wiring in `StageCanvas.vue`/`useStageInteractions.ts`. The codegen hidden-filter lives entirely in `packages/manim-codegen/src/index.ts` (plus two optional fields in `types.ts`), preserving byte-identical output for projects that never set `hidden`/`locked`.
**Tech Stack:** Vue 3 `<script setup lang="ts">` + Pinia + Konva (vue-konva), strict TypeScript, Vitest + @vue/test-utils (jsdom), `@manim/codegen` npm-workspace package.

---

## Context primer (verified against the code on 2026-06-10 — anchor edits by content, line numbers are reference hints)

**Repo layout relevant to this track:**

| File | Role |
|---|---|
| `services/web/src/store/project.ts` (~2482 lines) | Pinia store. Selection state is `selectedObjectIds: string[]`. Clipboard is `clipboard: SceneObject[]`. |
| `services/web/src/components/stage/StageCanvas.vue` (~1159 lines) | Canvas orchestrator. Objects render via `v-for="obj in sortedObjects"` (sorted by `zOrder`, line ~867) gated by `isVis(obj.id)` (line ~998). Config builders are wrapped at lines ~1011–1149 as `const rectCfg = (o: SceneObject) => shapes2d.rectCfg(o, ctx.value);`. |
| `services/web/src/components/stage/composables/useStageInteractions.ts` (484 lines) | `handleStageMouseDown` (empty-canvas → `store.deselectAll()` or pan), `onObjDown` (select + cancelBubble), `onDragEnd`, `updateTransformer`, `polygonHandles`. |
| `services/web/src/components/stage/configs/chrome.ts` | Pure config builders (no Vue refs). Safe to extend — Track C does NOT touch it. |
| `services/web/src/engine/types.ts` | Re-exports `SceneObject` from `@manim/codegen` as `StageObject` (alias, line 14). Adding fields to codegen `SceneObject` flows everywhere. |
| `packages/manim-codegen/src/index.ts` (613 lines) | `generateScene`. Object loop at ~115, annotation topological sort at ~110, groups `VGroup` emit at ~129, clips collection ~142, enter loop ~160, `generateKeyframeSteps(project, …)` call ~432, exit loop ~468. |
| `packages/manim-codegen/src/types.ts` | `SceneObject` interface (lines 72–124, `zOrder?: number` at 83), `Project` (objects/tracks/groups). |
| `services/web/src/App.vue` (~1451 lines) | `onMounted` at ~915 (playback engine + keydown listener + `store.checkApi()`), `handleKeydown` at ~932 (Ctrl+C/V → `copySelection`/`pasteSelection`, Delete → `deleteObject`), `startRender` at ~1055 (**DO NOT TOUCH — Track B owns that region**). Uses `confirm()` at ~1106. Notice toast = `store.notice` channel. |
| `services/web/src/components/timeline/Timeline.vue` (443 lines) | Object bar rows at lines 98–133; label cell at 103–111 (`selectObj`, `objColor`, `isObjSelected` in script; top-level `const store` is template-visible via script setup). |
| `services/web/src/components/timeline/KeyframeLane.vue` line 74 | The only existing contextmenu usage: `@contextmenu.prevent="rightClickKf(kf)"` (pattern reference). |
| `services/web/src/components/topbar/MenuBar.vue` lines 342–402 | `.menu-dropdown` / `.menu-item` / `.menu-sep` CSS to mirror in `ContextMenu.vue`. Note: the menus file is **`menus.ts`** (not `menus.js`). |
| `services/web/src/main.ts` | DEV-only `window.__projectStore` e2e hook — **untouched by this plan** (autosave installs from `App.vue`). |

**Existing store actions this plan calls (verified — do NOT re-create):**
`copySelection()`, `pasteSelection()` (pastes clones at +20/+20, sets `zOrder = objects.length`), `deleteObject(id)` (cascade-deletes annotations + clips + group membership, commits), `selectObject(id, addToSelection)`, `selectClip(id)`, `deselectAll()`, `updateObject(id, updates)` (sets `isDirty`, `_debouncedCommit`), `commitState()`, `undo()/redo()`, `notify(msg)`/`clearNotice()`/`setError(msg)`, `newProject(name, mode)`, `importJSON(str)`, `saveToFile()`, `loadFromFile()`, `saveToServer()`, `loadFromServer(id)`, `objectById(id)` (getter factory), `addObject(type, x, y)` (sets `isDirty=true` + `commitState()`).

**Actions that do NOT exist (this plan adds them):** duplicate, cut, select-all, bring-to-front/send-to-back, lock/hide toggles, multi-object translate.

**Z-order reality:** every object gets `zOrder: objects.length` at creation; the canvas draws by `zOrder` (`sortedObjects`), while codegen/Manim draw by **array order**. The new `bringToFront`/`sendToBack` actions therefore reorder the `objects[]` array AND renumber every `zOrder = index`, keeping both representations consistent.

**Group-drag reality:** multi-select EXISTS (shift/ctrl-click pushes into `selectedObjectIds`; the Konva Transformer attaches to all selected nodes), but group-drag does NOT — `onDragEnd` updates only the dragged object. Task 6 adds it via a new `translateObjects` store action applied on dragend (companion objects move on mouseup, not live during the drag — accepted limitation, noted in code comment).

**Preview-hide integration decision:** `StageCanvas.isVis(id)` is the single render gate used by every template branch (2D and 3D). Hidden objects are filtered there (plus the annotation cascade), via a pure helper. `engine/playback.ts` is NOT touched — its `hiddenIds` set is transform-clip mechanics only.

**Pre-existing `visible: true` field:** objects already carry a near-dead `visible` field (only read by `ctx.objectBounds`, set by the .py parser). We deliberately add a separate `hidden?: boolean` per spec and leave `visible` alone.

**Coordination constraints (parallel tracks):**
- `App.vue`: Track B owns the render-dialog region (`startRender` ~1055, render dialog template). This plan touches ONLY the `onMounted`/`onBeforeUnmount` block (~915–929) + one import line. No wholesale reformat.
- `store/project.ts`: Track C owns the `addObject` defaults region. This plan only INSERTS new actions at three anchors (after `deleteObject`, after `deselectAll`, after `pasteSelection`).
- `@manim/codegen`: touch ONLY `index.ts` + `types.ts`. Track C owns `objects.ts`/`helpers.ts`/`constants.ts`. (`types.ts` is shared with C — C appends per-type interfaces at the bottom; we add 2 lines inside `SceneObject`. Disjoint regions.)
- `configs/text.ts` / `configs/dataObjects.ts` builder bodies: owned by Track C — we never edit them; lock decoration happens at the StageCanvas wrapper call sites + a new helper in `chrome.ts`.
- Konva pointer wiring (`@contextmenu`, marquee mousemove) is jsdom-untestable; the logic lives in pure helpers/store actions/composables (all unit-tested with mock deps). Konva wiring itself is covered by manual smoke + the existing e2e port-5188 `window.__projectStore` hook. **No new e2e tests in this wave.**

**Test boilerplate used throughout** (copied from `services/web/tests/components/store.test.ts` / `effects-panel.test.ts`):

```ts
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
```

**Import rule reminder:** relative imports in `.ts`/`lang=ts` KEEP the `.js` extension (`./types.js`). Never "fix" to `.ts`.

---

### Task 1: SceneObject `locked`/`hidden` fields + new store actions

**Files:**
- Modify: `packages/manim-codegen/src/types.ts` (SceneObject interface, after `zOrder?: number;` at line ~83)
- Modify: `services/web/src/store/project.ts` (3 insertion anchors: after `deleteObject` ~line 1244, after `deselectAll` ~line 1364, after `pasteSelection` ~line 2052)
- Test: `services/web/tests/components/ux-pack-store.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/ux-pack-store.test.ts`:

```ts
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

describe('toggleLocked / toggleHidden', () => {
  it('toggleLocked sets locked=true and deletes the field when toggled back (legacy-absent)', () => {
    const obj = store.addObject('circle', 400, 400);
    store.toggleLocked(obj.id);
    expect(store.project.objects[0].locked).toBe(true);
    store.toggleLocked(obj.id);
    expect('locked' in store.project.objects[0]).toBe(false);
  });

  it('toggleHidden sets hidden=true and deletes the field when toggled back', () => {
    const obj = store.addObject('circle', 400, 400);
    store.toggleHidden(obj.id);
    expect(store.project.objects[0].hidden).toBe(true);
    store.toggleHidden(obj.id);
    expect('hidden' in store.project.objects[0]).toBe(false);
  });

  it('toggleHidden is undoable (commitState was called)', () => {
    const obj = store.addObject('circle', 400, 400);
    store.toggleHidden(obj.id);
    expect(store.project.objects[0].hidden).toBe(true);
    store.undo();
    expect(store.project.objects[0].hidden).toBeUndefined();
  });

  it('ignores unknown ids', () => {
    store.toggleLocked('nope');
    store.toggleHidden('nope');
    expect(store.project.objects).toHaveLength(0);
  });
});

describe('bringToFront / sendToBack', () => {
  it('bringToFront moves the object to the end of objects[] and renumbers zOrder = index', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    const c = store.addObject('triangle', 300, 300);
    store.bringToFront(a.id);
    expect(store.project.objects.map((o) => o.id)).toEqual([b.id, c.id, a.id]);
    expect(store.project.objects.map((o) => o.zOrder)).toEqual([0, 1, 2]);
  });

  it('sendToBack moves the object to the start and renumbers zOrder', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    const c = store.addObject('triangle', 300, 300);
    store.sendToBack(c.id);
    expect(store.project.objects.map((o) => o.id)).toEqual([c.id, a.id, b.id]);
    expect(store.project.objects.map((o) => o.zOrder)).toEqual([0, 1, 2]);
  });

  it('is undoable', () => {
    const a = store.addObject('circle', 100, 100);
    store.addObject('square', 200, 200);
    store.bringToFront(a.id);
    store.undo();
    expect(store.project.objects[0].id).toBe(a.id);
  });
});

describe('duplicateSelection', () => {
  it('clones selected objects at +20/+20, selects the clones, leaves the clipboard alone', () => {
    const a = store.addObject('circle', 400, 400);
    store.selectObject(a.id);
    store.duplicateSelection();
    expect(store.project.objects).toHaveLength(2);
    const clone = store.project.objects[1];
    expect(clone.id).not.toBe(a.id);
    expect(clone.x).toBe(420);
    expect(clone.y).toBe(420);
    expect(clone.name).toBe(a.name + ' copy');
    expect(store.selectedObjectIds).toEqual([clone.id]);
    expect(store.clipboard).toHaveLength(0);
  });

  it('does nothing with empty selection', () => {
    store.addObject('circle', 400, 400);
    store.deselectAll();
    store.duplicateSelection();
    expect(store.project.objects).toHaveLength(1);
  });
});

describe('cutSelection', () => {
  it('copies to clipboard then deletes the selected objects', () => {
    const a = store.addObject('circle', 400, 400);
    const b = store.addObject('square', 500, 500);
    store.selectObject(a.id);
    store.selectObject(b.id, true);
    store.cutSelection();
    expect(store.project.objects).toHaveLength(0);
    expect(store.clipboard).toHaveLength(2);
    store.pasteSelection();
    expect(store.project.objects).toHaveLength(2);
  });
});

describe('selectAllObjects', () => {
  it('selects every object and clears clip selection', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    store.selectAllObjects();
    expect(store.selectedObjectIds).toEqual([a.id, b.id]);
    expect(store.selectedClipId).toBe(null);
  });
});

describe('translateObjects', () => {
  it('moves every given object by dx/dy', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    store.translateObjects([a.id, b.id], 50, -10);
    expect([store.project.objects[0].x, store.project.objects[0].y]).toEqual([150, 90]);
    expect([store.project.objects[1].x, store.project.objects[1].y]).toEqual([250, 190]);
  });

  it('skips locked objects', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    store.toggleLocked(b.id);
    store.translateObjects([a.id, b.id], 50, 0);
    expect(store.project.objects[0].x).toBe(150);
    expect(store.project.objects[1].x).toBe(200);
  });

  it('is a no-op for dx=0, dy=0 (no history entry)', () => {
    const a = store.addObject('circle', 100, 100);
    const before = store.history.past.length;
    store.translateObjects([a.id], 0, 0);
    expect(store.history.past.length).toBe(before);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd services/web && npx vitest run tests/components/ux-pack-store.test.ts
```

Expected failure: `TypeError: store.toggleLocked is not a function` (and the same for each new action).

- [ ] **Step 3: Minimal implementation**

3a. In `packages/manim-codegen/src/types.ts`, inside `export interface SceneObject` directly after the line `zOrder?: number;` (line ~83), add:

```ts
  // editor UX (Wave 1 Track D) — both optional; absent = legacy behavior
  locked?: boolean; // canvas: not clickable/draggable; timeline still selects. No codegen effect.
  hidden?: boolean; // not drawn in preview AND skipped by generateScene.
```

3b. In `services/web/src/store/project.ts`, insert after the closing `},` of `deleteObject` (line ~1244, just before the `// ══… Groups` comment block):

```ts
    toggleLocked(id: string) {
      const obj = this.project.objects.find((o) => o.id === id);
      if (!obj) return;
      if (obj.locked) delete obj.locked;
      else obj.locked = true;
      this.isDirty = true;
      this.commitState();
    },

    toggleHidden(id: string) {
      const obj = this.project.objects.find((o) => o.id === id);
      if (!obj) return;
      if (obj.hidden) delete obj.hidden;
      else obj.hidden = true;
      this.isDirty = true;
      this.commitState();
    },

    /** Move the object to the end of objects[] (top of the draw order) and
     *  renumber every zOrder to its array index — keeps the canvas sort
     *  (zOrder) and the codegen/Manim add-order (array order) consistent. */
    bringToFront(id: string) {
      const idx = this.project.objects.findIndex((o) => o.id === id);
      if (idx === -1) return;
      const [obj] = this.project.objects.splice(idx, 1);
      this.project.objects.push(obj);
      this.project.objects.forEach((o, i) => {
        o.zOrder = i;
      });
      this.isDirty = true;
      this.commitState();
    },

    sendToBack(id: string) {
      const idx = this.project.objects.findIndex((o) => o.id === id);
      if (idx === -1) return;
      const [obj] = this.project.objects.splice(idx, 1);
      this.project.objects.unshift(obj);
      this.project.objects.forEach((o, i) => {
        o.zOrder = i;
      });
      this.isDirty = true;
      this.commitState();
    },

    /** Shift several objects by the same project-coordinate delta (multi-selection
     *  group drag). Locked objects are skipped. One commit for the whole move. */
    translateObjects(ids: string[], dx: number, dy: number) {
      if (!dx && !dy) return;
      let moved = false;
      for (const id of ids) {
        const obj = this.project.objects.find((o) => o.id === id);
        if (!obj || obj.locked) continue;
        obj.x = Math.round((obj.x ?? 0) + dx);
        obj.y = Math.round((obj.y ?? 0) + dy);
        moved = true;
      }
      if (!moved) return;
      this.isDirty = true;
      this.commitState();
    },
```

3c. Insert after the closing `},` of `deselectAll` (line ~1364, before `setActiveTool`):

```ts
    selectAllObjects() {
      this.selectedObjectIds = this.project.objects.map((o) => o.id);
      this.selectedClipId = null;
    },
```

3d. Insert after the closing `},` of `pasteSelection` (line ~2052, before the `// ══… UI helpers` comment):

```ts
    /** Clone the current selection in place (paste semantics without touching
     *  the clipboard) and select the clones. */
    duplicateSelection() {
      const selected = this.selectedObjectIds
        .map((id) => this.project.objects.find((o) => o.id === id))
        .filter(Boolean) as SceneObject[];
      if (selected.length === 0) return;
      const newIds: string[] = [];
      for (const original of selected) {
        const clone = JSON.parse(JSON.stringify(original)) as SceneObject;
        clone.id = uid('obj');
        clone.x = (clone.x || 0) + 20;
        clone.y = (clone.y || 0) + 20;
        clone.name = clone.name + ' copy';
        clone.zOrder = this.project.objects.length;
        this.project.objects.push(clone);
        newIds.push(clone.id);
      }
      this.selectedObjectIds = newIds;
      this.selectedClipId = null;
      this.isDirty = true;
      this.commitState();
    },

    /** Copy the selection to the clipboard, then delete it. */
    cutSelection() {
      if (this.selectedObjectIds.length === 0) return;
      this.copySelection();
      const ids = [...this.selectedObjectIds];
      for (const id of ids) this.deleteObject(id);
    },
```

(`uid` and `SceneObject` are already imported/in scope in `project.ts` — `pasteSelection` directly above uses both patterns.)

- [ ] **Step 4: Run test, expect PASS**

```
cd services/web && npx vitest run tests/components/ux-pack-store.test.ts
```

Also confirm no regression: `cd services/web && npx vitest run tests/components/store.test.ts`

- [ ] **Step 5: Commit**

```
npx prettier --write packages/manim-codegen/src/types.ts services/web/src/store/project.ts services/web/tests/components/ux-pack-store.test.ts
git add packages/manim-codegen/src/types.ts services/web/src/store/project.ts services/web/tests/components/ux-pack-store.test.ts
git commit -m "feat(store): lock/hide, z-order, duplicate/cut/select-all, translate actions" -m "Adds optional SceneObject.locked/hidden fields (absent = legacy) and the store actions toggleLocked, toggleHidden, bringToFront, sendToBack, duplicateSelection, cutSelection, selectAllObjects, translateObjects." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Codegen hidden-filter + annotation cascade (byte-stability guarded)

**Files:**
- Modify: `packages/manim-codegen/src/index.ts` ONLY (Track C owns `objects.ts`/`helpers.ts`/`constants.ts`; `keyframes.ts` is handled by passing a filtered project copy)
- Test: `services/web/tests/components/hidden-codegen.test.ts` (new — mirrors `manim-export.test.ts` style; exercises the package through the web wrapper `generateManimScript`)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/hidden-codegen.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920,
  SH = 1080;

function makeObj(id, type = 'circle', extra = {}) {
  return {
    id,
    type,
    x: SW / 2,
    y: SH / 2,
    width: 200,
    height: 200,
    fill: '#ffffff',
    stroke: 'transparent',
    strokeWidth: 2,
    opacity: 1,
    rotation: 0,
    enterTime: 0,
    duration: 5,
    enterAnim: 'fade_in',
    exitAnim: 'none',
    ...extra,
  };
}

function makeProject(objects, clips = [], extra = {}) {
  return {
    name: 'Test',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    objects,
    groups: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips }],
    ...extra,
  };
}

describe('codegen hidden filter — byte stability (legacy projects unchanged)', () => {
  it('locked:true never changes the generated script (byte-identical)', () => {
    const plain = makeProject([makeObj('obj1'), makeObj('obj2', 'square')]);
    const locked = makeProject([
      makeObj('obj1', 'circle', { locked: true }),
      makeObj('obj2', 'square'),
    ]);
    expect(generateManimScript(locked)).toBe(generateManimScript(plain));
  });

  it('hidden:false is byte-identical to the field being absent', () => {
    const plain = makeProject([makeObj('obj1')]);
    const explicit = makeProject([makeObj('obj1', 'circle', { hidden: false })]);
    expect(generateManimScript(explicit)).toBe(generateManimScript(plain));
  });

  it('a project with no hidden fields still emits all objects', () => {
    const script = generateManimScript(makeProject([makeObj('obj1'), makeObj('obj2', 'square')]));
    expect(script).toContain('obj1 = Circle(');
    expect(script).toContain('obj2 = ');
  });
});

describe('codegen hidden filter — skipping', () => {
  it('hiding an object is byte-identical to the object not existing at all', () => {
    const withHidden = makeProject([makeObj('obj1'), makeObj('obj2', 'square', { hidden: true })]);
    const without = makeProject([makeObj('obj1')]);
    expect(generateManimScript(withHidden)).toBe(generateManimScript(without));
  });

  it('clips referencing a hidden object are dropped (no NameError in Python)', () => {
    const clip = {
      id: 'c1',
      type: 'move',
      sourceId: 'obj2',
      startTime: 1,
      duration: 1,
      easing: 'ease_in_out',
      params: { toX: 100, toY: 100 },
    };
    const withHidden = makeProject(
      [makeObj('obj1'), makeObj('obj2', 'square', { hidden: true })],
      [clip]
    );
    const without = makeProject([makeObj('obj1')], []);
    expect(generateManimScript(withHidden)).toBe(generateManimScript(without));
    expect(generateManimScript(withHidden)).not.toContain('obj2');
  });

  it('cascade: an annotation whose target is hidden is skipped too', () => {
    const withHidden = makeProject([
      makeObj('obj1', 'circle', { hidden: true }),
      makeObj('obj2', 'square'),
      makeObj('obj3', 'underline', { targetId: 'obj1', color: '#f97316', strokeWidth: 4, buff: 10 }),
    ]);
    const without = makeProject([makeObj('obj2', 'square')]);
    expect(generateManimScript(withHidden)).toBe(generateManimScript(without));
    expect(generateManimScript(withHidden)).not.toContain('Underline');
  });

  it('groups: a hidden child is dropped from the VGroup, visible siblings remain', () => {
    const project = makeProject(
      [makeObj('obj1'), makeObj('obj2', 'square', { hidden: true })],
      [],
      { groups: [{ id: 'g1', name: 'G', childIds: ['obj1', 'obj2'] }] }
    );
    const script = generateManimScript(project);
    expect(script).toContain('= VGroup(obj1)');
    expect(script).not.toContain('obj2');
  });

  it('keyframes on a hidden object emit no _kf_ steps', () => {
    const project = makeProject([
      makeObj('obj1'),
      makeObj('obj2', 'square', {
        hidden: true,
        keyframes: {
          x: [
            { time: 0, value: 100, easing: { type: 'linear' } },
            { time: 2, value: 800, easing: { type: 'linear' } },
          ],
        },
      }),
    ]);
    expect(generateManimScript(project)).not.toContain('_kf_');
  });

  it('all objects hidden falls back to the empty-scene self.wait(1)', () => {
    const project = makeProject([makeObj('obj1', 'circle', { hidden: true })]);
    expect(generateManimScript(project)).toContain('self.wait(1)');
    expect(generateManimScript(project)).not.toContain('Circle(');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd services/web && npx vitest run tests/components/hidden-codegen.test.ts
```

Expected: the byte-stability tests pass (nothing changed yet) but every test in `codegen hidden filter — skipping` FAILS (hidden objects are still emitted, e.g. `expect(script).not.toContain('obj2')` fails).

- [ ] **Step 3: Minimal implementation**

All edits in `packages/manim-codegen/src/index.ts`.

3a. Directly after the `const L: string[] = [], sw = …, sh = …;` declaration (line ~10–12), insert:

```ts
  // ── Hidden filter (editor UX) ────────────────────────────────────────────
  // Objects with hidden === true are skipped entirely. Cascade: an annotation
  // (surrounding_rect / underline / cross) whose target is hidden would emit a
  // reference to an undefined Python name — skip it too. Clips referencing a
  // hidden object are dropped for the same reason. When no object carries the
  // field, every derived collection equals its legacy counterpart and the
  // output stays byte-identical.
  const allObjects = project.objects || [];
  const hiddenIds = new Set<string>(
    allObjects.filter((o) => o.hidden === true).map((o) => o.id)
  );
  for (const o of allObjects) {
    if (
      ANNOTATION_TYPES.has(o.type) &&
      typeof o.targetId === 'string' &&
      hiddenIds.has(o.targetId)
    ) {
      hiddenIds.add(o.id);
    }
  }
  const visibleObjects = allObjects.filter((o) => !hiddenIds.has(o.id));
  const clipRefsHidden = (c: Clip): boolean => {
    const refs = [c.sourceId, c.targetId, (c as Clip & { objectId?: string }).objectId];
    return refs.some((id) => typeof id === 'string' && hiddenIds.has(id));
  };
```

(`ANNOTATION_TYPES` is already imported on line 1; `Clip` is already imported for the `const clips: Clip[]` declaration. If `o.targetId` is typed `unknown` via the index signature, the `typeof … === 'string'` check narrows it.)

3b. Fonts loop (line ~16): change `for (const obj of project.objects || []) {` → `for (const obj of visibleObjects) {`

3c. Empty-scene check (line ~86): change `project.objects.length === 0 &&` → `visibleObjects.length === 0 &&`

3d. Annotation topological sort (lines ~110–113): change both `(project.objects || [])` occurrences to `visibleObjects`:

```ts
  const sortedObjects = [
    ...visibleObjects.filter((o) => !ANNOTATION_TYPES.has(o.type)),
    ...visibleObjects.filter((o) => ANNOTATION_TYPES.has(o.type)),
  ];
```

3e. Groups loop (lines ~129–137): filter child ids —

```ts
    for (const g of groups) {
      if (!g.childIds || g.childIds.length === 0) continue;
      const visibleChildIds = g.childIds.filter((id) => !hiddenIds.has(id));
      if (visibleChildIds.length === 0) continue;
      const childVars = visibleChildIds
        .map((id) => vn(id))
        .filter(Boolean)
        .join(', ');
      const gn = vn(g.id);
      L.push(`${indent}${gn} = VGroup(${childVars})`);
    }
```

3f. Clips collection (line ~143): change `for (const t of project.tracks) for (const c of t.clips) clips.push(c);` →

```ts
  for (const t of project.tracks)
    for (const c of t.clips) if (!clipRefsHidden(c)) clips.push(c);
```

3g. Enter loop (line ~160): change `for (const o of project.objects) {` → `for (const o of visibleObjects) {`

3h. Keyframe steps call (line ~432): change `generateKeyframeSteps(project, steps, sw, sh);` →

```ts
  generateKeyframeSteps({ ...project, objects: visibleObjects }, steps, sw, sh);
```

3i. Exit loop (line ~468): change `for (const o of project.objects) {` → `for (const o of visibleObjects) {`

- [ ] **Step 4: Run test, expect PASS**

```
cd services/web && npx vitest run tests/components/hidden-codegen.test.ts
```

Then run the full codegen regression suites (byte-parity guards):

```
cd services/web && npx vitest run tests/components/manim-export.test.ts tests/components/effects-codegen.test.ts tests/components/phase26-effects-codegen.test.ts
npm test --workspace packages/manim-codegen
```

All must pass unchanged.

- [ ] **Step 5: Commit**

```
npx prettier --write packages/manim-codegen/src/index.ts services/web/tests/components/hidden-codegen.test.ts
git add packages/manim-codegen/src/index.ts services/web/tests/components/hidden-codegen.test.ts
git commit -m "feat(codegen): skip hidden objects in generateScene with annotation/clip/group cascade" -m "hidden:true objects (and annotations targeting them, clips referencing them, group members) are filtered before emission; byte-identical output for projects without the field, guarded by equality tests." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Preview hide — pure visibility helper + `StageCanvas.isVis`

**Files:**
- Create: `services/web/src/engine/visibility.ts`
- Modify: `services/web/src/components/stage/StageCanvas.vue` (the `isVis` function, line ~998, + one import)
- Test: `services/web/tests/components/lock-hide-preview.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/lock-hide-preview.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isPreviewHidden } from '../../src/engine/visibility.js';

const byIdFactory = (objs) => (id) => objs.find((o) => o.id === id) || null;

describe('isPreviewHidden', () => {
  it('false for a plain object (legacy: field absent)', () => {
    const o = { id: 'a', type: 'circle' };
    expect(isPreviewHidden(o, byIdFactory([o]))).toBe(false);
  });

  it('true when hidden === true', () => {
    const o = { id: 'a', type: 'circle', hidden: true };
    expect(isPreviewHidden(o, byIdFactory([o]))).toBe(true);
  });

  it('false when hidden === false', () => {
    const o = { id: 'a', type: 'circle', hidden: false };
    expect(isPreviewHidden(o, byIdFactory([o]))).toBe(false);
  });

  it('cascade: annotation of a hidden target is hidden (surrounding_rect/underline/cross)', () => {
    const target = { id: 't', type: 'circle', hidden: true };
    for (const type of ['surrounding_rect', 'underline', 'cross']) {
      const ann = { id: 'ann', type, targetId: 't' };
      expect(isPreviewHidden(ann, byIdFactory([target, ann]))).toBe(true);
    }
  });

  it('annotation of a visible target stays visible', () => {
    const target = { id: 't', type: 'circle' };
    const ann = { id: 'ann', type: 'underline', targetId: 't' };
    expect(isPreviewHidden(ann, byIdFactory([target, ann]))).toBe(false);
  });

  it('null/undefined object is not hidden (caller treats as fall-through)', () => {
    expect(isPreviewHidden(null, byIdFactory([]))).toBe(false);
    expect(isPreviewHidden(undefined, byIdFactory([]))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd services/web && npx vitest run tests/components/lock-hide-preview.test.ts
```

Expected: `Failed to load … src/engine/visibility.js` (module does not exist).

- [ ] **Step 3: Minimal implementation**

3a. Create `services/web/src/engine/visibility.ts`:

```ts
// Pure preview-visibility predicate — no Vue, no Konva (testable like projection3d).
// The static `hidden` field gate for the canvas. Playback's transform-clip
// hiddenIds set (frameState.hiddenIds) is a separate mechanism and stays in
// StageCanvas.isVis.
import type { StageObject } from './types.js';

// Local mirror of the annotation set — precedent: store/project.ts deleteObject
// keeps its own local copy as well (the codegen constant is not re-exported
// from the @manim/codegen barrel).
const ANNOTATION_TYPES = new Set(['surrounding_rect', 'underline', 'cross']);

/**
 * True if the object must not be drawn in the preview:
 * - its own `hidden` flag is true, or
 * - it is an annotation whose target object is hidden (cascade — mirrors the
 *   codegen NameError cascade in @manim/codegen generateScene).
 */
export function isPreviewHidden(
  obj: StageObject | null | undefined,
  objectById: (id: string) => StageObject | null
): boolean {
  if (!obj) return false;
  if (obj.hidden === true) return true;
  if (ANNOTATION_TYPES.has(obj.type) && typeof obj.targetId === 'string') {
    const target = objectById(obj.targetId);
    if (target && target.hidden === true) return true;
  }
  return false;
}
```

3b. In `services/web/src/components/stage/StageCanvas.vue`:

Add to the imports block (next to `import { applyOverrides } from '../../engine/blending.js';`):

```ts
import { isPreviewHidden } from '../../engine/visibility.js';
```

Replace the `isVis` function (line ~998):

```ts
function isVis(id: string): boolean {
  // Static hide (hidden flag + annotation-of-hidden-target cascade)
  if (isPreviewHidden(store.objectById(id), (i) => store.objectById(i))) return false;
  // Playback transform-clip hide
  const h = frameState.value.hiddenIds;
  if (h instanceof Set) return !h.has(id);
  return true;
}
```

- [ ] **Step 4: Run test, expect PASS**

```
cd services/web && npx vitest run tests/components/lock-hide-preview.test.ts
```

Then the full unit suite to confirm StageCanvas-dependent snapshots still pass: `cd services/web && npm run test:unit`

- [ ] **Step 5: Commit**

```
npx prettier --write services/web/src/engine/visibility.ts services/web/src/components/stage/StageCanvas.vue services/web/tests/components/lock-hide-preview.test.ts
git add services/web/src/engine/visibility.ts services/web/src/components/stage/StageCanvas.vue services/web/tests/components/lock-hide-preview.test.ts
git commit -m "feat(preview): hidden objects (and annotations of hidden targets) are not drawn" -m "Pure isPreviewHidden helper in engine/visibility.ts; StageCanvas.isVis gates every 2D/3D template branch through it." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Lock enforcement on canvas interactions

**Files:**
- Modify: `services/web/src/components/stage/configs/chrome.ts` (append pure `lockConfig` helper — Track C does not touch this file)
- Modify: `services/web/src/components/stage/composables/useStageInteractions.ts` (`onObjDown` line ~313, `onDragEnd` line ~320, `polygonHandles` line ~119, `updateTransformer` line ~457)
- Modify: `services/web/src/components/stage/StageCanvas.vue` (decorate draggable config wrappers, lines ~1011–1019 and ~1085–1124)
- Test: `services/web/tests/components/lock-interactions.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/lock-interactions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';
import { useProjectStore } from '../../src/store/project.js';
import { lockConfig } from '../../src/components/stage/configs/chrome.js';
import { useStageInteractions } from '../../src/components/stage/composables/useStageInteractions.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

// Minimal Deps mock — Konva refs are null (updateTransformer self-guards),
// coordinate fns are identity.
function makeDeps(extra = {}) {
  return {
    konvaStage: ref(null),
    objectsLayer: ref(null),
    transformer: ref(null),
    vs: computed(() => 1),
    ox: computed(() => 0),
    oy: computed(() => 0),
    s2c: (x, y) => ({ x, y }),
    c2s: (x, y) => ({ x, y }),
    unprojectView: () => ({}),
    themeAccent: computed(() => '#7c5cff'),
    startPan: () => {},
    is3D: computed(() => false),
    pathDrawing: ref(false),
    pathPoints: ref([]),
    pathSourceId: ref(null),
    ...extra,
  };
}

describe('lockConfig (pure)', () => {
  it('forces draggable=false and listening=false when obj.locked', () => {
    const cfg = lockConfig({ x: 1, draggable: true }, { locked: true });
    expect(cfg.draggable).toBe(false);
    expect(cfg.listening).toBe(false);
  });

  it('returns the config untouched when not locked (legacy path)', () => {
    const original = { x: 1, draggable: true };
    const cfg = lockConfig(original, {});
    expect(cfg).toBe(original);
    expect(cfg.draggable).toBe(true);
    expect('listening' in cfg).toBe(false);
  });
});

describe('onObjDown lock guard', () => {
  it('selects an unlocked object', () => {
    const obj = store.addObject('circle', 400, 400);
    const { onObjDown } = useStageInteractions(store, makeDeps());
    onObjDown(obj.id, { target: {}, evt: { shiftKey: false, ctrlKey: false, metaKey: false } });
    expect(store.selectedObjectIds).toEqual([obj.id]);
  });

  it('ignores a locked object (no selection, event falls through to the stage)', () => {
    const obj = store.addObject('circle', 400, 400);
    store.toggleLocked(obj.id);
    const { onObjDown } = useStageInteractions(store, makeDeps());
    const evt = { target: {}, evt: { shiftKey: false, ctrlKey: false, metaKey: false } };
    onObjDown(obj.id, evt);
    expect(store.selectedObjectIds).toEqual([]);
    expect(evt.cancelBubble).toBeUndefined();
  });
});

describe('onDragEnd lock guard', () => {
  it('refuses to move a locked object', () => {
    store.project.stage.snapEnabled = false;
    const obj = store.addObject('circle', 400, 400);
    store.toggleLocked(obj.id);
    const { onDragEnd } = useStageInteractions(store, makeDeps());
    onDragEnd(obj.id, { target: { x: () => 700, y: () => 700 } });
    expect(store.project.objects[0].x).toBe(400);
    expect(store.project.objects[0].y).toBe(400);
  });
});

describe('polygonHandles lock guard', () => {
  it('returns null for a locked polygon_free (no draggable vertex handles)', () => {
    const obj = store.addObject('polygon_free', 400, 400);
    store.selectObject(obj.id);
    const deps = makeDeps();
    const { polygonHandles } = useStageInteractions(store, deps);
    expect(polygonHandles.value).not.toBe(null);
    store.toggleLocked(obj.id);
    expect(polygonHandles.value).toBe(null);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd services/web && npx vitest run tests/components/lock-interactions.test.ts
```

Expected: `lockConfig` is not exported from `chrome.js` (SyntaxError/undefined), and the `onObjDown`/`onDragEnd`/`polygonHandles` lock tests fail (locked object still gets selected/moved/handled).

- [ ] **Step 3: Minimal implementation**

3a. Append to `services/web/src/components/stage/configs/chrome.ts` (end of file, after the existing exports):

```ts
// ── Lock decoration ────────────────────────────────────────────────────────
/**
 * Figma-style lock: a locked object is click-through on the canvas.
 * `listening:false` removes the node from Konva hit detection entirely (no
 * select, no drag — clicks fall through to the stage), `draggable:false` is
 * belt-and-braces. Unlocked objects pass through untouched (legacy path).
 */
export function lockConfig<T extends Record<string, unknown>>(
  cfg: T,
  obj: { locked?: boolean }
): T {
  if (obj.locked) {
    (cfg as Record<string, unknown>).draggable = false;
    (cfg as Record<string, unknown>).listening = false;
  }
  return cfg;
}
```

3b. In `services/web/src/components/stage/composables/useStageInteractions.ts`:

`onObjDown` (line ~313) — add the guard as the FIRST statement:

```ts
  function onObjDown(id: string, e: KonvaEvt<MouseEvent>): void {
    // Locked objects are click-through: no selection, no cancelBubble — the
    // event falls through to handleStageMouseDown (deselect / marquee start).
    const lockedObj = store.objectById(id);
    if (lockedObj && lockedObj.locked) return;
    (e as unknown as { cancelBubble: boolean }).cancelBubble = true;
    const ev = e.evt;
    store.selectObject(id, ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey));
    void nextTick(() => nextTick(() => updateTransformer()));
  }
```

`onDragEnd` (line ~320) — add directly after the existing `if (!obj) return;`:

```ts
    if (obj.locked) return; // belt-and-braces: never commit a locked move
```

`polygonHandles` (line ~119) — add directly after the existing `if (!obj) return null;`:

```ts
    if (obj.locked) return null; // locked: no draggable vertex/relational handles
```

`updateTransformer` (line ~457) — extend the existing filter so locked objects never get resize/rotate anchors (they can still be SELECTED from the timeline; only canvas manipulation is blocked):

```ts
    const ids = store.selectedObjectIds.filter((id) => {
      const o = store.objectById(id);
      return !o || (o.type !== 'polygon_free' && !o.locked);
    });
```

3c. In `services/web/src/components/stage/StageCanvas.vue`:

Add `lockConfig` to the chrome import usage — `chrome` is already imported as a namespace (`import * as chrome from './configs/chrome.js';`), so define one local alias near the wrapper block (just above `// ── 3D shape config wrappers …`, line ~1010):

```ts
// Lock decoration for every wrapper whose builder emits a draggable /
// hit-target config (locked ⇒ listening:false ⇒ click-through).
const L = chrome.lockConfig;
```

Then decorate exactly these wrappers (one-line mechanical change each, pattern `const xCfg = (o: SceneObject) => L(builder(o, ctx.value), o);`):

- shapes2d (17): `rectCfg`, `circleCfg`, `ellipseCfg`, `dotCfg`, `heartCfg`, `triangleCfg`, `polygonFreeCfg`, `bezierCfg`, `parametricCfg`, `starCfg`, `polygonCfg`, `lineCfg`, `arrowCfg`, `annulusCfg`, `sectorCfg`, `arcCfg`, `doubleArrowCfg`
- text (3): `textCfg`, `counterCfg`, `latexBgCfg`
- dataObjects hit/group surfaces (7): `groupCfg`, `imageCfg`, `dotGridHitCfg`, `matrixHitCfg`, `tableHitCfg`, `graphHitCfg`, `vectorFieldHitCfg`
- axes (1): `axesBgCfg`
- relational single-config (3): `relationalHitCfg`, `surroundingRectCfg`, `underlineCfg`
- 3D draggables (2): `sphere3dCfg`, `obj3dCenter`

Example (before → after):

```ts
const rectCfg = (o: SceneObject) => shapes2d.rectCfg(o, ctx.value);
// becomes
const rectCfg = (o: SceneObject) => L(shapes2d.rectCfg(o, ctx.value), o);
```

Multi-part/array builders (`crossCfg`, `rayCfgs`, `coordPointCfgs`, `vectorComponentsCfgs`, `braceLineCfg`, `angle*`, matrix/table cell arrays, graph vertex/edge arrays, `vectorFieldArrows`, cube/prism/cone/torus/surface face arrays) are NOT decorated — none of their builders set `draggable` (verified: `draggable:` appears only in `shapes2d.ts`, `text.ts`, `dataObjects.ts`, `objects3d.ts`), and the `onObjDown` guard from 3b blocks selection for them.

- [ ] **Step 4: Run test, expect PASS**

```
cd services/web && npx vitest run tests/components/lock-interactions.test.ts
cd services/web && npm run test:unit
```

(The full run guards the wrapper edits against the existing stage config snapshot tests.)

- [ ] **Step 5: Commit**

```
npx prettier --write services/web/src/components/stage/configs/chrome.ts services/web/src/components/stage/composables/useStageInteractions.ts services/web/src/components/stage/StageCanvas.vue services/web/tests/components/lock-interactions.test.ts
git add services/web/src/components/stage/configs/chrome.ts services/web/src/components/stage/composables/useStageInteractions.ts services/web/src/components/stage/StageCanvas.vue services/web/tests/components/lock-interactions.test.ts
git commit -m "feat(stage): enforce object lock on canvas (click-through, no drag/resize/handles)" -m "lockConfig decoration on draggable config wrappers + guards in onObjDown/onDragEnd/polygonHandles/updateTransformer. Locked objects stay selectable from the timeline." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Timeline eye/lock toggle icons on object bars

**Files:**
- Modify: `services/web/src/components/timeline/Timeline.vue` (label cell template lines 103–111 + a small CSS rule in the `<style>` block)
- Test: `services/web/tests/components/timeline-lock-hide.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/timeline-lock-hide.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import Timeline from '../../src/components/timeline/Timeline.vue';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.addObject('circle', 960, 540); // named "Circle 1"
  store.commitState();
});

describe('Timeline lock/hide icons', () => {
  it('renders an eye and a lock button with aria-labels for each object row', () => {
    const w = mount(Timeline);
    expect(w.find('[aria-label="Hide Circle 1"]').exists()).toBe(true);
    expect(w.find('[aria-label="Lock Circle 1"]').exists()).toBe(true);
  });

  it('clicking the eye toggles obj.hidden and flips the aria-label', async () => {
    const w = mount(Timeline);
    await w.find('[aria-label="Hide Circle 1"]').trigger('click');
    expect(store.project.objects[0].hidden).toBe(true);
    expect(w.find('[aria-label="Show Circle 1"]').exists()).toBe(true);
  });

  it('clicking the lock toggles obj.locked', async () => {
    const w = mount(Timeline);
    await w.find('[aria-label="Lock Circle 1"]').trigger('click');
    expect(store.project.objects[0].locked).toBe(true);
    expect(w.find('[aria-label="Unlock Circle 1"]').exists()).toBe(true);
  });

  it('icon clicks do not change the selection (@click.stop)', async () => {
    const w = mount(Timeline);
    store.deselectAll();
    await w.find('[aria-label="Hide Circle 1"]').trigger('click');
    expect(store.selectedObjectIds).toEqual([]);
  });

  it('a locked object can still be selected from the timeline row', async () => {
    store.toggleLocked(store.project.objects[0].id);
    const w = mount(Timeline);
    await w.find('.obj-bar').trigger('click');
    expect(store.selectedObjectIds).toEqual([store.project.objects[0].id]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd services/web && npx vitest run tests/components/timeline-lock-hide.test.ts
```

Expected: `expect(w.find('[aria-label="Hide Circle 1"]').exists()).toBe(true)` fails (buttons don't exist yet).

- [ ] **Step 3: Minimal implementation**

In `services/web/src/components/timeline/Timeline.vue`, replace the label cell content (current lines 103–111):

```html
          <div
            class="flex-shrink-0 flex items-center gap-1.5 px-2 bg-studio-bg/30 border-r border-studio-border/50 text-[10px] font-medium cursor-pointer"
            :class="isObjSelected(obj.id) ? 'text-studio-text' : 'text-studio-text-muted'"
            :style="{ width: labelW + 'px' }"
            @click.stop="selectObj(obj.id, $event)"
          >
            <span class="obj-bar-dot" :style="{ background: objColor(obj) }"></span>
            <span class="truncate">{{ obj.name }}</span>
          </div>
```

with:

```html
          <div
            class="flex-shrink-0 flex items-center gap-1.5 px-2 bg-studio-bg/30 border-r border-studio-border/50 text-[10px] font-medium cursor-pointer"
            :class="isObjSelected(obj.id) ? 'text-studio-text' : 'text-studio-text-muted'"
            :style="{ width: labelW + 'px' }"
            @click.stop="selectObj(obj.id, $event)"
          >
            <span class="obj-bar-dot" :style="{ background: objColor(obj) }"></span>
            <span class="truncate flex-1" :class="{ 'opacity-40': obj.hidden }">{{
              obj.name
            }}</span>
            <button
              class="obj-bar-icon"
              :class="{ on: obj.hidden }"
              :aria-label="(obj.hidden ? 'Show ' : 'Hide ') + obj.name"
              :title="obj.hidden ? 'Show' : 'Hide'"
              @click.stop="store.toggleHidden(obj.id)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
                <line v-if="obj.hidden" x1="3" y1="3" x2="21" y2="21" />
              </svg>
            </button>
            <button
              class="obj-bar-icon"
              :class="{ on: obj.locked }"
              :aria-label="(obj.locked ? 'Unlock ' : 'Lock ') + obj.name"
              :title="obj.locked ? 'Unlock' : 'Lock'"
              @click.stop="store.toggleLocked(obj.id)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path v-if="obj.locked" d="M8 11V7a4 4 0 0 1 8 0v4" />
                <path v-else d="M8 11V7a4 4 0 0 1 7.9-.8" />
              </svg>
            </button>
          </div>
```

(`store` is a top-level `const` in Timeline's `<script setup>` — confirmed used at lines ~237/325 — so it is template-visible; no script change needed.)

Add to the `<style>` block of `Timeline.vue` (next to the existing `.obj-bar-dot` rule):

```css
.obj-bar-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 1px;
  border-radius: 3px;
  color: var(--studio-text-muted);
  opacity: 0.55;
  transition: opacity 0.1s;
}
.obj-bar-icon:hover {
  opacity: 1;
}
.obj-bar-icon.on {
  opacity: 1;
  color: var(--studio-accent);
}
```

- [ ] **Step 4: Run test, expect PASS**

```
cd services/web && npx vitest run tests/components/timeline-lock-hide.test.ts
```

- [ ] **Step 5: Commit**

```
npx prettier --write services/web/src/components/timeline/Timeline.vue services/web/tests/components/timeline-lock-hide.test.ts
git add services/web/src/components/timeline/Timeline.vue services/web/tests/components/timeline-lock-hide.test.ts
git commit -m "feat(timeline): eye/lock toggle icons on object bars (aria-labelled)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Marquee selection (pure helper + composable + overlay) and multi-selection group drag

**Files:**
- Create: `services/web/src/engine/marquee.ts` (pure, no Konva — like `engine/projection3d.ts`)
- Modify: `services/web/src/components/stage/composables/useStageInteractions.ts` (marquee state + `handleStageMouseDown` empty-canvas branch + new `handleStageMouseMove`/`handleStageMouseUp` + group-drag in `onDragEnd` + return block)
- Modify: `services/web/src/components/stage/StageCanvas.vue` (v-stage `@mousemove`/`@mouseup`, marquee overlay layer, composable destructure)
- Test: `services/web/tests/components/marquee.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/marquee.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';
import {
  normalizeRect,
  objectStageBounds,
  marqueeHit,
  marqueeSelectIds,
} from '../../src/engine/marquee.js';
import { useProjectStore } from '../../src/store/project.js';
import { useStageInteractions } from '../../src/components/stage/composables/useStageInteractions.js';

describe('marquee geometry (pure)', () => {
  it('normalizeRect handles any drag direction', () => {
    expect(normalizeRect(10, 10, 30, 40)).toEqual({ x: 10, y: 10, width: 20, height: 30 });
    expect(normalizeRect(30, 40, 10, 10)).toEqual({ x: 10, y: 10, width: 20, height: 30 });
  });

  it('objectStageBounds is center-based (matches ctx.objectBounds semantics)', () => {
    expect(objectStageBounds({ id: 'a', type: 'circle', x: 100, y: 100, width: 40, height: 40 })).toEqual(
      { x: 80, y: 80, width: 40, height: 40 }
    );
  });

  it('marqueeHit: intersection counts, containment not required', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(marqueeHit(rect, { x: 90, y: 90, width: 50, height: 50 })).toBe(true); // overlap
    expect(marqueeHit(rect, { x: 200, y: 0, width: 10, height: 10 })).toBe(false); // outside
    expect(marqueeHit(rect, null)).toBe(false);
  });

  it('marqueeSelectIds skips locked and hidden objects', () => {
    const objs = [
      { id: 'a', type: 'circle', x: 50, y: 50, width: 20, height: 20 },
      { id: 'b', type: 'circle', x: 50, y: 50, width: 20, height: 20, locked: true },
      { id: 'c', type: 'circle', x: 50, y: 50, width: 20, height: 20, hidden: true },
      { id: 'd', type: 'circle', x: 500, y: 500, width: 20, height: 20 },
    ];
    expect(marqueeSelectIds({ x: 0, y: 0, width: 100, height: 100 }, objs)).toEqual(['a']);
  });
});

describe('marquee interaction flow (composable with fake stage)', () => {
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  function makeFakeStage(pointer) {
    return {
      getPointerPosition: () => pointer.value,
      name: () => '',
      getParent: () => null,
    };
  }

  function makeDeps(fakeStage, { is3D = false } = {}) {
    return {
      konvaStage: ref({ getNode: () => fakeStage }),
      objectsLayer: ref(null),
      transformer: ref(null),
      vs: computed(() => 1),
      ox: computed(() => 0),
      oy: computed(() => 0),
      s2c: (x, y) => ({ x, y }),
      c2s: (x, y) => ({ x, y }), // identity: canvas coords == project coords in tests
      unprojectView: () => ({}),
      themeAccent: computed(() => '#7c5cff'),
      startPan: () => {},
      is3D: computed(() => is3D),
      pathDrawing: ref(false),
      pathPoints: ref([]),
      pathSourceId: ref(null),
    };
  }

  it('drag on empty canvas selects intersecting objects, skipping locked ones', () => {
    const a = store.addObject('circle', 100, 100); // bbox approx 50..150 (default size)
    const b = store.addObject('circle', 120, 120);
    const c = store.addObject('circle', 1500, 900); // far away
    store.toggleLocked(b.id);

    const pointer = { value: { x: 10, y: 10 } };
    const fakeStage = makeFakeStage(pointer);
    const itx = useStageInteractions(store, makeDeps(fakeStage));

    itx.handleStageMouseDown({ target: fakeStage, evt: { shiftKey: false } });
    expect(itx.marquee.value).toEqual({ x1: 10, y1: 10, x2: 10, y2: 10 });

    pointer.value = { x: 300, y: 300 };
    itx.handleStageMouseMove();
    expect(itx.marquee.value.x2).toBe(300);

    itx.handleStageMouseUp();
    expect(itx.marquee.value).toBe(null);
    expect(store.selectedObjectIds).toContain(a.id);
    expect(store.selectedObjectIds).not.toContain(b.id); // locked
    expect(store.selectedObjectIds).not.toContain(c.id); // outside
  });

  it('a tiny drag (<3px) is a plain click: selection just cleared, none selected', () => {
    store.addObject('circle', 100, 100);
    store.selectAllObjects();
    const pointer = { value: { x: 10, y: 10 } };
    const fakeStage = makeFakeStage(pointer);
    const itx = useStageInteractions(store, makeDeps(fakeStage));
    itx.handleStageMouseDown({ target: fakeStage, evt: { shiftKey: false } });
    pointer.value = { x: 11, y: 11 };
    itx.handleStageMouseMove();
    itx.handleStageMouseUp();
    expect(store.selectedObjectIds).toEqual([]);
  });

  it('marquee is disabled in 3D mode', () => {
    const pointer = { value: { x: 10, y: 10 } };
    const fakeStage = makeFakeStage(pointer);
    const itx = useStageInteractions(store, makeDeps(fakeStage, { is3D: true }));
    itx.handleStageMouseDown({ target: fakeStage, evt: { shiftKey: false } });
    expect(itx.marquee.value).toBe(null);
  });
});

describe('multi-selection group drag (onDragEnd delta fan-out)', () => {
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.project.stage.snapEnabled = false;
    store.commitState();
  });

  it('dragging one selected object moves the whole multi-selection by the same delta', () => {
    const a = store.addObject('circle', 400, 400);
    const b = store.addObject('circle', 600, 500);
    store.selectObject(a.id);
    store.selectObject(b.id, true);

    const deps = {
      konvaStage: ref(null),
      objectsLayer: ref(null),
      transformer: ref(null),
      vs: computed(() => 1),
      ox: computed(() => 0),
      oy: computed(() => 0),
      s2c: (x, y) => ({ x, y }),
      c2s: (x, y) => ({ x, y }),
      unprojectView: () => ({}),
      themeAccent: computed(() => '#7c5cff'),
      startPan: () => {},
      is3D: computed(() => false),
      pathDrawing: ref(false),
      pathPoints: ref([]),
      pathSourceId: ref(null),
    };
    const { onDragEnd } = useStageInteractions(store, deps);
    // circle uses center positioning: node x/y == new project x/y (identity c2s)
    onDragEnd(a.id, { target: { x: () => 500, y: () => 450 } });
    expect([store.project.objects[0].x, store.project.objects[0].y]).toEqual([500, 450]);
    expect([store.project.objects[1].x, store.project.objects[1].y]).toEqual([700, 550]);
  });

  it('single selection keeps the existing behavior (only the dragged object moves)', () => {
    const a = store.addObject('circle', 400, 400);
    const b = store.addObject('circle', 600, 500);
    store.selectObject(a.id);
    const deps = {
      konvaStage: ref(null),
      objectsLayer: ref(null),
      transformer: ref(null),
      vs: computed(() => 1),
      ox: computed(() => 0),
      oy: computed(() => 0),
      s2c: (x, y) => ({ x, y }),
      c2s: (x, y) => ({ x, y }),
      unprojectView: () => ({}),
      themeAccent: computed(() => '#7c5cff'),
      startPan: () => {},
      is3D: computed(() => false),
      pathDrawing: ref(false),
      pathPoints: ref([]),
      pathSourceId: ref(null),
    };
    const { onDragEnd } = useStageInteractions(store, deps);
    onDragEnd(a.id, { target: { x: () => 500, y: () => 450 } });
    expect([store.project.objects[0].x, store.project.objects[0].y]).toEqual([500, 450]);
    expect([store.project.objects[1].x, store.project.objects[1].y]).toEqual([600, 500]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd services/web && npx vitest run tests/components/marquee.test.ts
```

Expected: `Failed to load … src/engine/marquee.js` (module does not exist); after creating it, the composable tests fail (`itx.marquee` undefined, group drag not fanning out).

- [ ] **Step 3: Minimal implementation**

3a. Create `services/web/src/engine/marquee.ts`:

```ts
// Pure marquee-selection geometry — no Konva, no Vue (testable like projection3d).
// All rects are axis-aligned. Object bounds are CENTER-based in project
// coordinates (0–1920 × 0–1080), matching StageCanvas ctx.objectBounds.
import type { StageObject } from './types.js';

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalize two drag corners (any direction) into an x/y/w/h rect. */
export function normalizeRect(x1: number, y1: number, x2: number, y2: number): MarqueeRect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Center-based axis-aligned bounding box of an object in project coords. */
export function objectStageBounds(obj: StageObject): MarqueeRect {
  const w = obj.width ?? 0;
  const h = obj.height ?? 0;
  return { x: (obj.x ?? 0) - w / 2, y: (obj.y ?? 0) - h / 2, width: w, height: h };
}

/** True when the marquee rect INTERSECTS the object bounds (Figma semantics —
 *  touching counts, full containment is not required). */
export function marqueeHit(rect: MarqueeRect, objBounds: MarqueeRect | null): boolean {
  if (!objBounds) return false;
  return (
    rect.x <= objBounds.x + objBounds.width &&
    rect.x + rect.width >= objBounds.x &&
    rect.y <= objBounds.y + objBounds.height &&
    rect.y + rect.height >= objBounds.y
  );
}

/** Ids of objects the marquee selects. Locked and hidden objects are skipped. */
export function marqueeSelectIds(rect: MarqueeRect, objects: StageObject[]): string[] {
  return objects
    .filter((o) => !o.locked && o.hidden !== true && marqueeHit(rect, objectStageBounds(o)))
    .map((o) => o.id);
}
```

3b. In `services/web/src/components/stage/composables/useStageInteractions.ts`:

Add the import (top of file, with the other engine imports):

```ts
import { normalizeRect, marqueeSelectIds } from '../../../engine/marquee.js';
```

Add marquee state next to the existing `// ── State ──` block (after `liveTransform`):

```ts
  // Marquee selection (2D select tool only). Canvas-pixel coords.
  const marquee = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
```

In `handleStageMouseDown`, replace the final empty-canvas branch (currently):

```ts
    if (t === (s as KonvaNodeLike) || t.name?.() !== 'stageObject') {
      if (store.activeTool === 'hand') startPan(e as unknown as { evt: MouseEvent });
      else store.deselectAll();
    }
```

with:

```ts
    if (t === (s as KonvaNodeLike) || t.name?.() !== 'stageObject') {
      if (store.activeTool === 'hand') {
        startPan(e as unknown as { evt: MouseEvent });
      } else {
        store.deselectAll();
        // Marquee selection: 2D select tool only (the 3D split viewport keeps
        // its drag semantics; path-draw mode returns earlier in this handler).
        if (!is3D.value && store.activeTool === 'select') {
          const pos = s.getPointerPosition?.();
          if (pos) marquee.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
        }
      }
    }
```

Add the two new handlers after `handleStageMouseDown`:

```ts
  function handleStageMouseMove(): void {
    if (!marquee.value) return;
    const s = konvaStage.value?.getNode() as KonvaStagelike | undefined;
    const pos = s?.getPointerPosition?.();
    if (!pos) return;
    marquee.value = { ...marquee.value, x2: pos.x, y2: pos.y };
  }

  function handleStageMouseUp(): void {
    const m = marquee.value;
    if (!m) return;
    marquee.value = null;
    const r = normalizeRect(m.x1, m.y1, m.x2, m.y2);
    if (r.width < 3 && r.height < 3) return; // plain click — deselect already ran
    // Canvas rect → project-coordinate rect, then pure hit-test.
    const p1 = c2s(r.x, r.y);
    const p2 = c2s(r.x + r.width, r.y + r.height);
    const stageRect = normalizeRect(p1.x, p1.y, p2.x, p2.y);
    const ids = marqueeSelectIds(stageRect, store.project.objects);
    store.selectedObjectIds = ids;
    store.selectedClipId = null;
    void nextTick(() => nextTick(() => updateTransformer()));
  }
```

In `onDragEnd`, after the snap block and before the existing `store.updateObject(id, …)` line, replace the tail:

```ts
    store.updateObject(id, { x: Math.round(newX), y: Math.round(newY) });
```

with:

```ts
    // Multi-selection group drag: fan the dragged delta out to the whole
    // selection in one commit. Companions move on mouseup (not live during the
    // drag) — accepted limitation; live ghosting would need per-node dragmove
    // wiring on ~35 template branches.
    const sel = store.selectedObjectIds;
    if (sel.length > 1 && sel.includes(id)) {
      const dx = Math.round(newX) - (obj.x ?? 0);
      const dy = Math.round(newY) - (obj.y ?? 0);
      store.translateObjects([...sel], dx, dy);
      return;
    }
    store.updateObject(id, { x: Math.round(newX), y: Math.round(newY) });
```

Extend the composable's return block with the new members:

```ts
  return {
    shiftKey,
    liveTransform,
    marquee,
    polygonHandles,
    groupBounds,
    trConfig,
    onVertexDrag,
    onVertexDragEnd,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    onObjDown,
    onDragEnd,
    onDrag3DEnd,
    onTransform,
    onTransformEnd,
    onTextDblClick,
    updateTransformer,
  };
```

3c. In `services/web/src/components/stage/StageCanvas.vue`:

Add the three new members to the interactions destructure (line ~891):

```ts
const {
  shiftKey,
  liveTransform,
  marquee,
  polygonHandles,
  groupBounds,
  trConfig,
  onVertexDrag,
  onVertexDragEnd,
  handleStageMouseDown,
  handleStageMouseMove,
  handleStageMouseUp,
  onObjDown,
  onDragEnd,
  onDrag3DEnd,
  onTransform,
  onTransformEnd,
  onTextDblClick,
  updateTransformer,
} = useStageInteractions(store, { …unchanged deps… });
```

Wire the stage events (template line ~14–20):

```html
      <v-stage
        ref="konvaStage"
        :config="stageConfig"
        @mousedown="handleStageMouseDown"
        @mousemove="handleStageMouseMove"
        @mouseup="handleStageMouseUp"
        @dblclick="onStageDblClick"
        @wheel="handleWheel"
      >
```

Add the overlay layer immediately BEFORE the `<!-- Selection transformer -->` layer (line ~733):

```html
        <!-- Marquee selection overlay -->
        <v-layer v-if="marqueeRect">
          <v-rect :config="marqueeRect" />
        </v-layer>
```

Add the computed near the other chrome computeds (after `floorGridIso`, line ~1077):

```ts
// ── Marquee overlay ──
const marqueeRect = computed(() => {
  const m = marquee.value;
  if (!m) return null;
  const r = { x: Math.min(m.x1, m.x2), y: Math.min(m.y1, m.y2), width: Math.abs(m.x2 - m.x1), height: Math.abs(m.y2 - m.y1) };
  return {
    ...r,
    fill: themeAccent.value + '22',
    stroke: themeAccent.value,
    strokeWidth: 1,
    dash: [4, 4],
    listening: false,
  };
});
```

- [ ] **Step 4: Run test, expect PASS**

```
cd services/web && npx vitest run tests/components/marquee.test.ts
cd services/web && npm run test:unit
```

(Manual smoke later: drag on empty canvas in 2D draws the dashed rect; 3D split viewport unaffected.)

- [ ] **Step 5: Commit**

```
npx prettier --write services/web/src/engine/marquee.ts services/web/src/components/stage/composables/useStageInteractions.ts services/web/src/components/stage/StageCanvas.vue services/web/tests/components/marquee.test.ts
git add services/web/src/engine/marquee.ts services/web/src/components/stage/composables/useStageInteractions.ts services/web/src/components/stage/StageCanvas.vue services/web/tests/components/marquee.test.ts
git commit -m "feat(stage): marquee selection (2D-only) + multi-selection group drag" -m "Pure marqueeHit/marqueeSelectIds in engine/marquee.ts; marquee state + handlers in useStageInteractions; dashed overlay rect layer; onDragEnd fans the drag delta out to the whole selection via translateObjects." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: ContextMenu.vue + canvas right-click wiring

**Files:**
- Create: `services/web/src/components/stage/ContextMenu.vue`
- Modify: `services/web/src/components/stage/StageCanvas.vue` (v-stage `@contextmenu`, `ctxMenu` state + `ctxMenuItems` computed + component mount + import)
- Test: `services/web/tests/components/context-menu.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/context-menu.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ContextMenu from '../../src/components/stage/ContextMenu.vue';

function makeItems(overrides = {}) {
  return [
    { id: 'copy', label: 'Copy', action: vi.fn() },
    { id: 'sep1', separator: true },
    { id: 'paste', label: 'Paste', disabled: true, action: vi.fn() },
    ...((overrides.extra as never[]) || []),
  ];
}

describe('ContextMenu', () => {
  it('renders labelled buttons and separators at the given position', () => {
    const w = mount(ContextMenu, { props: { x: 100, y: 120, items: makeItems() } });
    const menu = w.find('[role="menu"]');
    expect(menu.exists()).toBe(true);
    expect(w.findAll('button.menu-item')).toHaveLength(2);
    expect(w.find('.menu-sep').exists()).toBe(true);
    expect(w.text()).toContain('Copy');
  });

  it('clicking an item runs its action and emits close', async () => {
    const items = makeItems();
    const w = mount(ContextMenu, { props: { x: 0, y: 0, items } });
    await w.findAll('button.menu-item')[0].trigger('click');
    expect(items[0].action).toHaveBeenCalledTimes(1);
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('a disabled item neither runs nor closes', async () => {
    const items = makeItems();
    const w = mount(ContextMenu, { props: { x: 0, y: 0, items } });
    await w.findAll('button.menu-item')[1].trigger('click');
    expect(items[2].action).not.toHaveBeenCalled();
    expect(w.emitted('close')).toBeUndefined();
  });

  it('Escape emits close', async () => {
    const w = mount(ContextMenu, { props: { x: 0, y: 0, items: makeItems() }, attachTo: document.body });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await w.vm.$nextTick();
    expect(w.emitted('close')).toHaveLength(1);
    w.unmount();
  });

  it('mousedown outside the menu emits close', async () => {
    const w = mount(ContextMenu, { props: { x: 0, y: 0, items: makeItems() }, attachTo: document.body });
    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await w.vm.$nextTick();
    expect(w.emitted('close')).toHaveLength(1);
    w.unmount();
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd services/web && npx vitest run tests/components/context-menu.test.ts
```

Expected: `Failed to resolve import … ContextMenu.vue` (component does not exist).

- [ ] **Step 3: Minimal implementation**

3a. Create `services/web/src/components/stage/ContextMenu.vue` (styling mirrors `MenuBar.vue`'s `.menu-dropdown`/`.menu-item`/`.menu-sep`, lines 342–402):

```vue
<template>
  <div class="ctx-menu" role="menu" aria-label="Canvas context menu" :style="posStyle">
    <template v-for="item in items" :key="item.id">
      <div v-if="item.separator" class="menu-sep"></div>
      <button
        v-else
        class="menu-item"
        :class="{ disabled: item.disabled }"
        :disabled="item.disabled"
        role="menuitem"
        :aria-label="item.label"
        @click="onItem(item)"
      >
        <span class="mi-label">{{ item.label }}</span>
      </button>
    </template>
  </div>
</template>

<script lang="ts">
export interface ContextMenuItem {
  id: string;
  label?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
}
</script>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  items: { type: Array as () => ContextMenuItem[], required: true },
});
const emit = defineEmits(['close']);

const rootEl = ref<HTMLElement | null>(null);

const MENU_W = 180;
const ITEM_H = 28;
const posStyle = computed(() => {
  // Clamp to the viewport so the menu never opens off-screen.
  const estH = props.items.length * ITEM_H + 8;
  const left = Math.min(props.x, Math.max(0, window.innerWidth - MENU_W - 4));
  const top = Math.min(props.y, Math.max(0, window.innerHeight - estH - 4));
  return { left: left + 'px', top: top + 'px' };
});

function onItem(item: ContextMenuItem) {
  if (item.disabled) return;
  item.action?.();
  emit('close');
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
function onWindowMousedown(e: MouseEvent) {
  const root = rootEl.value ?? null;
  if (root && e.target instanceof Node && root.contains(e.target)) return;
  emit('close');
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown);
  // capture phase so a mousedown on the Konva canvas (which stops propagation
  // at the container) still closes the menu.
  window.addEventListener('mousedown', onWindowMousedown, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown);
  window.removeEventListener('mousedown', onWindowMousedown, true);
});
</script>

<style scoped>
.ctx-menu {
  position: fixed;
  min-width: 180px;
  background: var(--studio-surface3);
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  z-index: 300;
}
.menu-sep {
  height: 1px;
  margin: 4px 8px;
  background: var(--studio-divider);
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--studio-text);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.08s;
  text-align: left;
  outline: none;
}
.menu-item:hover {
  background: var(--studio-accent-subtle);
}
.menu-item.disabled {
  opacity: 0.4;
  cursor: default;
}
.menu-item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--studio-focus-ring);
}
.mi-label {
  flex: 1;
  white-space: nowrap;
}
</style>
```

Then add `ref="rootEl"` to the root div: `<div ref="rootEl" class="ctx-menu" …>`.

3b. In `services/web/src/components/stage/StageCanvas.vue`:

Import (script setup, next to the composable imports):

```ts
import ContextMenu from './ContextMenu.vue';
import type { ContextMenuItem } from './ContextMenu.vue';
```

Wire the stage event (the `<v-stage>` opening tag, extending Task 6's version):

```html
      <v-stage
        ref="konvaStage"
        :config="stageConfig"
        @mousedown="handleStageMouseDown"
        @mousemove="handleStageMouseMove"
        @mouseup="handleStageMouseUp"
        @dblclick="onStageDblClick"
        @wheel="handleWheel"
        @contextmenu="onStageContextMenu"
      >
```

Mount the menu after the 3D view selector overlay div (template line ~755, inside the `ref="container"` div):

```html
      <!-- Right-click context menu -->
      <ContextMenu
        v-if="ctxMenu"
        :x="ctxMenu.x"
        :y="ctxMenu.y"
        :items="ctxMenuItems"
        @close="ctxMenu = null"
      />
```

Script additions (place after the `onViewChange` function, line ~1154):

```ts
// ── Right-click context menu ──
const ctxMenu = ref<{ x: number; y: number; objId: string | null } | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onStageContextMenu(e: any) {
  e.evt.preventDefault();
  if (pathDrawing.value) return;
  // Walk up from the Konva target to find a stage object (same parent-walk as
  // handleStageMouseDown). Locked objects have listening:false, so a
  // right-click over one lands on the stage → empty-canvas menu (unlock via
  // the timeline lock icon).
  let node = e.target;
  let objId: string | null = null;
  while (node) {
    if (node.name?.() === 'stageObject' && node.id?.()) {
      objId = node.id();
      break;
    }
    node = node.getParent ? node.getParent() : null;
  }
  if (objId && !store.selectedObjectIds.includes(objId)) store.selectObject(objId);
  ctxMenu.value = { x: e.evt.clientX, y: e.evt.clientY, objId };
}

const ctxMenuItems = computed<ContextMenuItem[]>(() => {
  const m = ctxMenu.value;
  if (!m) return [];
  if (m.objId) {
    const objId = m.objId;
    const obj = store.objectById(objId);
    // Cut/copy/paste/duplicate/delete act on the SELECTION (the right-clicked
    // object was selected in onStageContextMenu); z-order and lock/hide act on
    // the right-clicked object itself.
    return [
      { id: 'cut', label: 'Cut', action: () => store.cutSelection() },
      { id: 'copy', label: 'Copy', action: () => store.copySelection() },
      {
        id: 'paste',
        label: 'Paste',
        disabled: store.clipboard.length === 0,
        action: () => store.pasteSelection(),
      },
      { id: 'duplicate', label: 'Duplicate', action: () => store.duplicateSelection() },
      {
        id: 'delete',
        label: 'Delete',
        action: () => [...store.selectedObjectIds].forEach((id) => store.deleteObject(id)),
      },
      { id: 'sep1', separator: true },
      { id: 'front', label: 'Bring to Front', action: () => store.bringToFront(objId) },
      { id: 'back', label: 'Send to Back', action: () => store.sendToBack(objId) },
      { id: 'sep2', separator: true },
      {
        id: 'lock',
        label: obj?.locked ? 'Unlock' : 'Lock',
        action: () => store.toggleLocked(objId),
      },
      {
        id: 'hide',
        label: obj?.hidden ? 'Show' : 'Hide',
        action: () => store.toggleHidden(objId),
      },
    ];
  }
  return [
    {
      id: 'paste',
      label: 'Paste',
      disabled: store.clipboard.length === 0,
      action: () => store.pasteSelection(),
    },
    {
      id: 'selectall',
      label: 'Select All',
      disabled: store.project.objects.length === 0,
      action: () => store.selectAllObjects(),
    },
  ];
});
```

(Every action above is an existing store action or one added in Task 1 — no new store code in this task. The Konva `@contextmenu` wiring itself is jsdom-untestable; covered by manual smoke.)

- [ ] **Step 4: Run test, expect PASS**

```
cd services/web && npx vitest run tests/components/context-menu.test.ts
cd services/web && npm run test:unit
```

- [ ] **Step 5: Commit**

```
npx prettier --write services/web/src/components/stage/ContextMenu.vue services/web/src/components/stage/StageCanvas.vue services/web/tests/components/context-menu.test.ts
git add services/web/src/components/stage/ContextMenu.vue services/web/src/components/stage/StageCanvas.vue services/web/tests/components/context-menu.test.ts
git commit -m "feat(stage): right-click context menu on canvas (object + empty-area variants)" -m "New ContextMenu.vue (fixed overlay, Esc/outside-click close, MenuBar styling); object menu: cut/copy/paste/duplicate/delete, bring-to-front/send-to-back, lock, hide; empty-canvas menu: paste, select all. Timeline clip menu stays out of scope (Wave 2)." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Autosave module + restore prompt

**Files:**
- Create: `services/web/src/autosave.ts`
- Modify: `services/web/src/App.vue` (ONLY the `onMounted`/`onBeforeUnmount` block at lines ~915–929 + one import + one module-scope variable — do NOT touch `startRender`/render-dialog regions, Track B owns those)
- Test: `services/web/tests/components/autosave.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/autosave.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { AUTOSAVE_KEY, initAutosave, readAutosave, clearAutosave } from '../../src/autosave.js';

let store;
let dispose;
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
  dispose = initAutosave(store);
});
afterEach(() => {
  dispose?.();
  vi.useRealTimers();
  localStorage.clear();
});

describe('autosave write (2s debounce, isDirty-gated)', () => {
  it('writes { project, savedAt } to localStorage 2s after a dirty mutation', () => {
    store.addObject('circle', 400, 400); // sets isDirty = true
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null); // not yet (debounced)
    vi.advanceTimersByTime(2100);
    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY));
    expect(saved.project.objects).toHaveLength(1);
    expect(typeof saved.savedAt).toBe('number');
  });

  it('debounces: rapid mutations produce one write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(1000);
    store.addObject('square', 500, 500);
    vi.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalledWith(AUTOSAVE_KEY, expect.anything());
    vi.advanceTimersByTime(1100);
    const writes = spy.mock.calls.filter(([k]) => k === AUTOSAVE_KEY);
    expect(writes).toHaveLength(1);
    spy.mockRestore();
  });

  it('does not write while the store is clean (isDirty=false)', () => {
    store.setPlaybackTime(1.5); // mutates state but not isDirty
    vi.advanceTimersByTime(3000);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
  });

  it('uses its own key (no collision with manim-motion-theme)', () => {
    expect(AUTOSAVE_KEY).toBe('manim-motion-autosave');
    expect(AUTOSAVE_KEY).not.toBe('manim-motion-theme');
  });
});

describe('autosave clear hooks ($onAction)', () => {
  it('newProject clears the key', () => {
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(2100);
    expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBe(null);
    store.newProject('Fresh', 'visual');
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
  });

  it('importJSON (Open) clears the key', () => {
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(2100);
    const json = store.exportJSON();
    store.importJSON(json);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
  });

  it('saveToFile (successful save) clears the key', () => {
    // jsdom lacks URL.createObjectURL — stub the blob plumbing saveToFile uses
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    try {
      store.addObject('circle', 400, 400);
      vi.advanceTimersByTime(2100);
      expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBe(null);
      store.saveToFile();
      expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe('readAutosave / clearAutosave / restore round-trip', () => {
  it('readAutosave returns the parsed payload, null when absent or corrupt', () => {
    expect(readAutosave()).toBe(null);
    localStorage.setItem(AUTOSAVE_KEY, 'not json');
    expect(readAutosave()).toBe(null);
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ project: { a: 1 }, savedAt: 5 }));
    expect(readAutosave()).toEqual({ project: { a: 1 }, savedAt: 5 });
  });

  it('clearAutosave removes only our key', () => {
    localStorage.setItem(AUTOSAVE_KEY, '{}');
    localStorage.setItem('manim-motion-theme', 'dark');
    clearAutosave();
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
    expect(localStorage.getItem('manim-motion-theme')).toBe('dark');
  });

  it('a saved project restores through importJSON', () => {
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(2100);
    const saved = readAutosave();
    store.newProject('Blank', 'visual'); // wipes (and clears the key)
    expect(store.project.objects).toHaveLength(0);
    const ok = store.importJSON(JSON.stringify(saved.project));
    expect(ok).toBe(true);
    expect(store.project.objects).toHaveLength(1);
  });

  it('dispose() stops both the subscriber and the action hook', () => {
    dispose();
    dispose = null;
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(3000);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd services/web && npx vitest run tests/components/autosave.test.ts
```

Expected: `Failed to load … src/autosave.js` (module does not exist).

- [ ] **Step 3: Minimal implementation**

3a. Create `services/web/src/autosave.ts`:

```ts
// Autosave — debounced localStorage snapshot of the project + restore helpers.
//
// Mechanism: Pinia store.$subscribe with { flush: 'sync' } (deterministic in
// app and tests), gated on state.isDirty so clean states (fresh boot, just
// saved, playback-only mutations) never write. Clearing rides store.$onAction:
// New / Open / successful save all reset the key without editing the store
// file itself (coordination: another track owns other store regions).
//
// Known trade-off: the debounce timer resets on EVERY dirty-state mutation, so
// during continuous playback of an unsaved project the write fires ~2s after
// the next idle moment. Assets are URL references inside project JSON, so
// payloads stay small. Does not touch `manim-motion-theme`.
import type { useProjectStore } from './store/project.js';

type ProjectStore = ReturnType<typeof useProjectStore>;

export const AUTOSAVE_KEY = 'manim-motion-autosave';
const DEBOUNCE_MS = 2000;

/** Store actions after which the autosave is stale and must be cleared. */
const CLEAR_ACTIONS = new Set([
  'newProject', // File → New
  'importJSON', // File → Open (loadFromFile delegates here)
  'loadFromServer', // server Open
  'saveToFile', // successful local save
  'saveToServer', // successful server save (after() only runs on resolve)
]);

export interface AutosavePayload {
  project: unknown;
  savedAt: number;
}

export function readAutosave(): AutosavePayload | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutosavePayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.project) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/** Install the autosave subscriber + clear hooks. Returns a dispose fn. */
export function initAutosave(store: ProjectStore, debounceMs = DEBOUNCE_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = store.$subscribe(
    (_mutation, state) => {
      if (!state.isDirty) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try {
          const payload: AutosavePayload = {
            project: JSON.parse(JSON.stringify(state.project)),
            savedAt: Date.now(),
          };
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
        } catch {
          /* quota / serialization failure — autosave is best-effort */
        }
      }, debounceMs);
    },
    { flush: 'sync', detached: true }
  );

  const unsubscribeAction = store.$onAction(({ name, after }) => {
    if (!CLEAR_ACTIONS.has(name)) return;
    after(() => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      clearAutosave();
    });
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
    unsubscribeAction();
  };
}
```

3b. In `services/web/src/App.vue` — touch ONLY these spots:

Import (with the other local imports near `import * as api from './api.js';`):

```ts
import { initAutosave, readAutosave, clearAutosave } from './autosave.js';
```

Module-scope holder (directly above the `// ── Lifecycle ──` comment, line ~914):

```ts
let _disposeAutosave: (() => void) | null = null;
```

Replace the `onMounted` block (lines ~915–923):

```ts
onMounted(() => {
  const engine = getPlaybackEngine();
  engine.onTimeUpdate((t) => store.setPlaybackTime(t));
  engine.onFrame((state) => store.setFrameState(state));
  window.addEventListener('keydown', handleKeydown);

  // Autosave: offer to restore a previous session's unsaved work, THEN start
  // the subscriber. The app always boots into a blank default project, so any
  // existing autosave is newer than the loaded state. Restore runs before
  // initAutosave so importJSON's clear-hook doesn't wipe the key mid-restore;
  // the key survives until the next New/Open/Save (crash-safe).
  const saved = readAutosave();
  if (saved) {
    const when = new Date(saved.savedAt).toLocaleString();
    if (confirm(`Unsaved work from a previous session (${when}) was found. Restore it?`)) {
      store.importJSON(JSON.stringify(saved.project));
    } else {
      clearAutosave();
    }
  }
  _disposeAutosave = initAutosave(store);

  // Check API availability on startup
  store.checkApi();
});
```

Extend `onBeforeUnmount` (lines ~925–929) with one line:

```ts
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  getPlaybackEngine().destroy();
  store._stopPollRender();
  _disposeAutosave?.();
});
```

(`confirm()` matches App.vue's existing dialog pattern at lines ~1106/1113. The DEV-only `window.__projectStore` hook in `main.ts` is untouched; Playwright e2e runs in a fresh browser context, so no autosave exists and the prompt never fires there.)

- [ ] **Step 4: Run test, expect PASS**

```
cd services/web && npx vitest run tests/components/autosave.test.ts
cd services/web && npm run test:unit
```

(Manual smoke: add an object in the dev app, wait 2 s, check DevTools → Application → Local Storage for `manim-motion-autosave`; reload → restore prompt appears; File → New clears it.)

- [ ] **Step 5: Commit**

```
npx prettier --write services/web/src/autosave.ts services/web/src/App.vue services/web/tests/components/autosave.test.ts
git add services/web/src/autosave.ts services/web/src/App.vue services/web/tests/components/autosave.test.ts
git commit -m "feat(autosave): debounced localStorage autosave with startup restore prompt" -m "store.\$subscribe (flush sync, isDirty-gated, 2s debounce) writes {project, savedAt} to manim-motion-autosave; store.\$onAction clears on newProject/importJSON/loadFromServer/saveToFile/saveToServer; App.vue onMounted offers restore via confirm()." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Final verification (full gate)

**Files:** none (verification only; commit only if prettier/lint fixes are needed)

- [ ] **Step 1: Run the complete gate from the repo root**

```
cd services/web && npm run test:unit        # 618 existing + ~45 new, all green
cd services/web && npm test                 # 114 engine tests (tsx)
npm test --workspace services/api           # 43 api tests
npm test --workspace packages/manim-codegen # 6 codegen tests
npm run lint                                # ESLint: errors fail, warnings allowed
npm run typecheck                           # build:codegen + vue-tsc (web) + tsc (api)
npm run format:check                        # Prettier
```

- [ ] **Step 2: Targeted regression sweep for this track's risk surface**

```
cd services/web && npx vitest run tests/components/manim-export.test.ts tests/components/effects-codegen.test.ts tests/components/phase26-effects-codegen.test.ts tests/components/hidden-codegen.test.ts tests/components/ux-pack-store.test.ts tests/components/marquee.test.ts tests/components/lock-interactions.test.ts tests/components/lock-hide-preview.test.ts tests/components/timeline-lock-hide.test.ts tests/components/context-menu.test.ts tests/components/autosave.test.ts tests/components/store.test.ts
```

- [ ] **Step 3: Manual smoke checklist (dev server `cd services/web && npm run dev`)**

- Right-click an object → menu shows Cut/Copy/Paste/Duplicate/Delete/Bring to Front/Send to Back/Lock/Hide; every entry works; Esc and outside-click close it.
- Right-click empty canvas → Paste (disabled when clipboard empty) + Select All.
- Drag on empty 2D canvas → dashed marquee; intersecting objects get selected; dragging one of them moves the whole selection on mouseup.
- Switch the project to 3D (`Scene3DPanel`) → empty-canvas drag does NOT draw a marquee; 3D object drag still works.
- Lock an object via the timeline lock icon → canvas clicks pass through it, transformer never attaches, timeline row still selects it; unlock restores everything.
- Hide an object via the eye icon → it vanishes from the canvas; Export `.py` → the object, its clips, and any annotation targeting it are absent; un-hide restores codegen.
- Edit something, wait 2 s, reload the page → restore prompt; accept → project returns; File → New → key cleared (DevTools → Local Storage).

- [ ] **Step 4: Commit any formatting deltas (only if the gate produced fixes)**

```
git add -A
git commit -m "chore: formatting/lint fixes from final gate" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Spec-coverage self-check (Track D → tasks)

| Spec line | Task(s) |
|---|---|
| Right-click context menu (object + empty canvas), existing actions + small new ones, Esc/outside close, timeline clip menu OUT | 1 (actions), 7 (component + wiring) |
| Marquee selection: drag on empty 2D canvas, intersection rule as pure exported `marqueeHit`, multi-selection drags together, 3D disabled | 1 (`translateObjects`), 6 |
| Lock: optional `locked?`, not clickable/draggable on canvas, still timeline-selectable, icons with aria-labels | 1 (field+action), 4 (enforcement), 5 (icons) |
| Hide: optional `hidden?`, not drawn in preview, skipped by codegen, annotation-of-hidden-target cascade (NameError guard), known `.py` round-trip loss | 1 (field+action), 2 (codegen+cascade+byte tests), 3 (preview), 5 (icons) |
| Autosave: 2 s debounce, `{project, savedAt}` under `manim-motion-autosave`, restore prompt on mount, clear on New/Open/save, theme key untouched, e2e hook unbroken | 8 |
| Byte-identical legacy codegen when fields absent | 2 (equality regression tests) |
