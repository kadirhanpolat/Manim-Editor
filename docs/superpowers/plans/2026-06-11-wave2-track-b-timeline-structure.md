# Wave 2 Track B — Timeline & Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click context menu to timeline clips (cut/copy/paste/duplicate/delete/split) and scene section markers that emit `self.next_section("Title")` in the generated Python.

**Architecture:** `TimelineClip.vue` gains a `@contextmenu.prevent` handler that opens `ContextMenu.vue` (reused from Wave 1) with clip-specific items. A new `splitClip(clipId)` store action splits at `store.playbackTime`. Scene sections are stored in `store.project.sections`, rendered as vertical markers in `Timeline.vue`, and emitted in `generateScene` before the first animation that starts at or after each section's time. The `Project` type in `@manim/codegen/types.ts` gains an optional `sections` field.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Pinia, `@manim/codegen` (TypeScript strict), Vitest

---

## File Map

| Action | File |
|---|---|
| Modify | `services/web/src/store/project.ts` — `splitClip` + section actions |
| Modify | `packages/manim-codegen/src/types.ts` — add `sections` to `Project` |
| Modify | `packages/manim-codegen/src/index.ts` — emit `next_section` in `generateScene` |
| Modify | `services/web/src/components/timeline/TimelineClip.vue` — `@contextmenu` → context menu |
| Modify | `services/web/src/components/timeline/Timeline.vue` — section markers + toolbar button |
| Create | `services/web/tests/components/split-clip.test.ts` |
| Create | `services/web/tests/components/scene-sections.test.ts` |
| Create | `packages/manim-codegen/tests/sections-codegen.test.ts` |

---

## Task 1: `splitClip` store action

**Files:**
- Modify: `services/web/src/store/project.ts`
- Create: `services/web/tests/components/split-clip.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/split-clip.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

describe('splitClip', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  function addObjectAndClip() {
    store.addObject({ type: 'circle', name: 'C' });
    const obj = store.project.objects[0]!;
    store.addClip({ type: 'fade', objectId: obj.id, startTime: 0, duration: 4 });
    return store.project.tracks[0]!.clips[0]!;
  }

  it('splits a clip at playback time', () => {
    const clip = addObjectAndClip();
    store.setPlaybackTime(2);
    store.splitClip(clip.id);

    const clips = store.project.tracks[0]!.clips;
    expect(clips).toHaveLength(2);
    expect(clips[0]!.startTime).toBe(0);
    expect(clips[0]!.duration).toBe(2);
    expect(clips[1]!.startTime).toBe(2);
    expect(clips[1]!.duration).toBe(2);
    expect(clips[0]!.id).not.toBe(clips[1]!.id);
  });

  it('does nothing if playback time is before clip start', () => {
    const clip = addObjectAndClip();
    store.setPlaybackTime(0); // at start boundary — no split
    store.splitClip(clip.id);
    expect(store.project.tracks[0]!.clips).toHaveLength(1);
  });

  it('does nothing if playback time is after clip end', () => {
    const clip = addObjectAndClip();
    store.setPlaybackTime(5); // beyond clip end
    store.splitClip(clip.id);
    expect(store.project.tracks[0]!.clips).toHaveLength(1);
  });

  it('second fragment inherits type and objectId', () => {
    const clip = addObjectAndClip();
    store.setPlaybackTime(1.5);
    store.splitClip(clip.id);
    const clips = store.project.tracks[0]!.clips;
    expect(clips[1]!.type).toBe(clips[0]!.type);
    expect(clips[1]!.objectId).toBe(clips[0]!.objectId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- --reporter=verbose split-clip
```
Expected: FAIL — `store.splitClip` is not a function.

- [ ] **Step 3: Add `splitClip` to store**

In `services/web/src/store/project.ts`, find the `deleteClip` action (around line 1551) and add `splitClip` nearby:

```typescript
    splitClip(clipId: string) {
      const splitTime = this.playbackTime;
      for (const track of this.project.tracks) {
        const idx = track.clips.findIndex((c) => c.id === clipId);
        if (idx === -1) continue;
        const clip = track.clips[idx]!;
        if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) return;

        const firstDuration = splitTime - clip.startTime;
        const secondDuration = clip.duration - firstDuration;

        const first: typeof clip = { ...clip, duration: firstDuration };
        const second: typeof clip = { ...clip, id: uid(), startTime: splitTime, duration: secondDuration };

        track.clips.splice(idx, 1, first, second);
        this.isDirty = true;
        this.commitState();
        return;
      }
    },
```

- [ ] **Step 4: Run test to verify it passes**

```
cd services/web && npm run test:unit -- --reporter=verbose split-clip
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```
git add services/web/src/store/project.ts services/web/tests/components/split-clip.test.ts
git commit -m "feat(store): splitClip action — splits at playback time"
```

---

## Task 2: Clip right-click context menu

**Files:**
- Modify: `services/web/src/components/timeline/TimelineClip.vue`

`ContextMenu.vue` already lives at `services/web/src/components/stage/ContextMenu.vue` and is imported by `StageCanvas.vue`. Re-import it here.

- [ ] **Step 1: Write the failing test**

Add to `services/web/tests/components/split-clip.test.ts`:

```typescript
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import TimelineClip from '../../src/components/timeline/TimelineClip.vue';

describe('TimelineClip context menu', () => {
  it('renders context menu on right-click', async () => {
    // TimelineClip requires a clip prop and store context
    const clip = { id: 'c1', type: 'fade', objectId: 'o1', startTime: 0, duration: 2, easing: 'ease_in_out', parallel: false };
    const wrapper = mount(TimelineClip, {
      props: { clip, pps: 100 },
      global: { plugins: [createTestingPinia()] },
    });
    await wrapper.trigger('contextmenu');
    expect(wrapper.find('.ctx-menu').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- --reporter=verbose split-clip
```
Expected: FAIL — `.ctx-menu` not found.

- [ ] **Step 3: Add context menu to TimelineClip.vue**

Open `services/web/src/components/timeline/TimelineClip.vue`.

At the top of `<script>`, add an import for `ContextMenu`:

```typescript
import ContextMenu from '../stage/ContextMenu.vue';
import type { ContextMenuItem } from '../stage/ContextMenu.vue';
```

In `<script setup lang="ts">`, add:

```typescript
import { ref, computed } from 'vue';
import { useProjectStore } from '../../store/project.js';

const store = useProjectStore();

const ctxMenu = ref<{ x: number; y: number } | null>(null);

const ctxItems = computed<ContextMenuItem[]>(() => [
  { id: 'copy',      label: 'Kopyala',    action: () => store.copySelection() },
  { id: 'cut',       label: 'Kes',        action: () => store.cutSelection() },
  { id: 'paste',     label: 'Yapıştır',   action: () => store.pasteClipboard(), disabled: store.clipboard.length === 0 },
  { id: 'dup',       label: 'Çoğalt',     action: () => store.duplicateSelection() },
  { id: 'sep1',      separator: true },
  { id: 'split',     label: 'Böl',        action: () => store.splitClip(props.clip.id as string) },
  { id: 'sep2',      separator: true },
  { id: 'delete',    label: 'Sil',        action: () => store.deleteClip(props.clip.id as string) },
]);

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  store.selectClip(props.clip.id as string);
  ctxMenu.value = { x: e.clientX, y: e.clientY };
}
```

In the template, add `@contextmenu.prevent="onContextMenu"` to the root clip div, and append the context menu portal at the bottom:

```vue
<ContextMenu
  v-if="ctxMenu"
  :x="ctxMenu.x"
  :y="ctxMenu.y"
  :items="ctxItems"
  @close="ctxMenu = null"
/>
```

- [ ] **Step 4: Run test to verify it passes**

```
cd services/web && npm run test:unit -- --reporter=verbose split-clip
```
Expected: PASS (5 tests total).

- [ ] **Step 5: Run typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```
git add services/web/src/components/timeline/TimelineClip.vue
git commit -m "feat(timeline): right-click context menu on clips"
```

---

## Task 3: Scene sections — store + codegen types

**Files:**
- Modify: `services/web/src/store/project.ts`
- Modify: `packages/manim-codegen/src/types.ts`
- Create: `services/web/tests/components/scene-sections.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/web/tests/components/scene-sections.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

describe('scene sections store', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('starts with empty sections', () => {
    expect(store.project.sections).toEqual([]);
  });

  it('addSection inserts and sorts by time', () => {
    store.addSection(3, 'Third');
    store.addSection(1, 'First');
    expect(store.project.sections[0]!.time).toBe(1);
    expect(store.project.sections[1]!.time).toBe(3);
  });

  it('removeSection removes by id', () => {
    store.addSection(2, 'Mid');
    const id = store.project.sections[0]!.id;
    store.removeSection(id);
    expect(store.project.sections).toHaveLength(0);
  });

  it('updateSection changes title and re-sorts', () => {
    store.addSection(2, 'Old');
    const id = store.project.sections[0]!.id;
    store.updateSection(id, { title: 'New', time: 0.5 });
    expect(store.project.sections[0]!.title).toBe('New');
    expect(store.project.sections[0]!.time).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- --reporter=verbose scene-sections
```
Expected: FAIL — `store.project.sections` is undefined.

- [ ] **Step 3: Update `StoreProject` interface**

In `services/web/src/store/project.ts`, find `export interface StoreProject` (line 64). Add:

```typescript
  sections: Array<{ id: string; time: number; title: string }>;
```

In `createDefaultProject()`, add:

```typescript
  sections: [],
```

Add the three actions near the camera/section block of the store:

```typescript
    addSection(time: number, title: string) {
      const section = { id: uid(), time, title };
      this.project.sections = [...this.project.sections, section].sort((a, b) => a.time - b.time);
      this.isDirty = true;
      this.commitState();
    },

    removeSection(sectionId: string) {
      this.project.sections = this.project.sections.filter((s) => s.id !== sectionId);
      this.isDirty = true;
      this.commitState();
    },

    updateSection(sectionId: string, patch: Partial<{ time: number; title: string }>) {
      const s = this.project.sections.find((sec) => sec.id === sectionId);
      if (!s) return;
      Object.assign(s, patch);
      this.project.sections = [...this.project.sections].sort((a, b) => a.time - b.time);
      this.isDirty = true;
      this.commitState();
    },
```

- [ ] **Step 4: Update `Project` type in `@manim/codegen`**

In `packages/manim-codegen/src/types.ts`, find the `Project` interface and add:

```typescript
  sections?: Array<{ id: string; time: number; title: string }>;
```

- [ ] **Step 5: Run tests to verify they pass**

```
cd services/web && npm run test:unit -- --reporter=verbose scene-sections
```
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```
git add services/web/src/store/project.ts packages/manim-codegen/src/types.ts services/web/tests/components/scene-sections.test.ts
git commit -m "feat(store,codegen): scene sections state + Project type"
```

---

## Task 4: Scene sections — codegen output

**Files:**
- Modify: `packages/manim-codegen/src/index.ts`
- Create: `packages/manim-codegen/tests/sections-codegen.test.ts`

`generateScene` builds the animation sequence as an array of `self.play(...)` calls. Sections should emit `self.next_section("Title")` immediately before the first animation whose `startTime ≥ section.time`.

- [ ] **Step 1: Write the failing test**

Create `packages/manim-codegen/tests/sections-codegen.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateScene } from '../src/index.js';
import type { Project } from '../src/types.js';

function baseProject(): Project {
  return {
    id: 'p1',
    name: 'Test',
    editorMode: 'visual',
    codeSource: '',
    stage: { width: 1920, height: 1080, background: '#000000' },
    assets: [],
    objects: [{ id: 'o1', type: 'circle', name: 'C', x: 960, y: 540, width: 100, height: 100, color: '#ffffff', opacity: 1 }],
    groups: [],
    tracks: [{ id: 't1', objectId: 'o1', clips: [{ id: 'c1', type: 'fade', objectId: 'o1', startTime: 2, duration: 1, easing: 'ease_in_out', parallel: false }] }],
    sceneDuration: 5,
    cameraType: 'static',
    cameraTrack: [],
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
    sceneType: '2d',
    camera3d: { phi: 75, theta: -45, zoom: 1 },
    sections: [{ id: 's1', time: 2, title: 'Intro' }],
  };
}

describe('scene sections codegen', () => {
  it('emits next_section before the first animation at/after section.time', () => {
    const code = generateScene(baseProject(), { resolveAsset: (s) => s });
    expect(code).toContain('self.next_section("Intro")');
    // next_section must appear before the self.play that uses the clip at t=2
    const nsIdx = code.indexOf('self.next_section("Intro")');
    const playIdx = code.indexOf('self.play(');
    expect(nsIdx).toBeGreaterThan(-1);
    expect(nsIdx).toBeLessThan(playIdx);
  });

  it('skips sections beyond scene duration', () => {
    const p = baseProject();
    p.sections = [{ id: 's2', time: 99, title: 'Never' }];
    const code = generateScene(p, { resolveAsset: (s) => s });
    expect(code).not.toContain('self.next_section("Never")');
  });

  it('generates valid output with no sections', () => {
    const p = baseProject();
    p.sections = [];
    const code = generateScene(p, { resolveAsset: (s) => s });
    expect(code).not.toContain('next_section');
    expect(code).toContain('self.play(');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test --workspace packages/manim-codegen -- --reporter=verbose
```
Expected: FAIL — `next_section` not in output.

- [ ] **Step 3: Add section emission to `generateScene`**

Open `packages/manim-codegen/src/index.ts`.

Inside `generateScene`, find where animation steps are built into the `lines` array. The structure emits steps in time order. Before or alongside that loop, add section injection.

After the existing animation-step building block (typically a loop over sorted clips that builds `self.play(...)` lines), add a helper that injects section markers:

```typescript
  // Inject next_section markers
  const sortedSections = (project.sections ?? [])
    .filter((s) => s.time <= (project.sceneDuration ?? 10))
    .sort((a, b) => a.time - b.time);

  if (sortedSections.length > 0) {
    // Find the index of the first self.play line at or after each section time
    // Animation steps already sorted; walk through and insert markers
    let sIdx = 0;
    const injected: string[] = [];
    for (const line of animLines) {
      // Check if any pending section should fire before this line
      while (sIdx < sortedSections.length) {
        const sec = sortedSections[sIdx]!;
        // Each animLine carries a comment or we track by insertion order.
        // Simpler: rebuild animLines with injected markers by tracking stepTime.
        // (see full implementation note below)
        sIdx++;
      }
      injected.push(line);
    }
  }
```

**Full implementation note:** The exact shape of `generateScene`'s internals varies. The safest approach is:

1. Build the animation steps as before, but alongside each step record its `startTime`.
2. Walk sections and steps together, inserting `self.next_section("Title")` before steps whose `startTime >= section.time`.

Here is a self-contained pattern to splice into `generateScene`. Locate the section of the function that pushes to the lines/output array for `self.play(...)` calls, and replace the push loop with:

```typescript
  // Sort sections ascending
  const sectionQueue = [...(project.sections ?? [])]
    .filter((s) => s.time <= (project.sceneDuration ?? 10))
    .sort((a, b) => a.time - b.time);
  let nextSectionIdx = 0;

  for (const step of sortedSteps) {
    // Emit any sections whose time <= step.startTime
    while (
      nextSectionIdx < sectionQueue.length &&
      sectionQueue[nextSectionIdx]!.time <= step.startTime
    ) {
      lines.push(`        self.next_section("${sectionQueue[nextSectionIdx]!.title}")`);
      nextSectionIdx++;
    }
    lines.push(step.line);
  }
```

Replace `sortedSteps`, `step.startTime`, and `step.line` with the actual variable names used in `generateScene` for the animation sequence. If the function uses a different structure, adapt accordingly — the key invariant is: `next_section` must appear in the output before the first `self.play` whose `startTime ≥ section.time`.

- [ ] **Step 4: Run codegen tests**

```
npm test --workspace packages/manim-codegen -- --reporter=verbose
```
Expected: sections-codegen tests PASS plus all existing tests still pass.

- [ ] **Step 5: Run web unit tests (codegen is shared)**

```
cd services/web && npm run test:unit
```
Expected: all pass.

- [ ] **Step 6: Commit**

```
git add packages/manim-codegen/src/index.ts packages/manim-codegen/tests/sections-codegen.test.ts
git commit -m "feat(codegen): emit next_section() markers before animation steps"
```

---

## Task 5: Scene sections — Timeline UI

**Files:**
- Modify: `services/web/src/components/timeline/Timeline.vue`

- [ ] **Step 1: Add section markers to the timeline ruler**

In `Timeline.vue`, find the time-ruler row (the `<div>` with the playhead and time ticks). Inside the ruler's `<div class="track-clips ...">` (or equivalent scrolling area), add section markers:

```vue
<!-- Section markers -->
<div
  v-for="sec in project.sections"
  :key="sec.id"
  class="section-marker absolute top-0 h-full flex flex-col items-center pointer-events-auto"
  :style="{ left: labelW + sec.time * pps + 'px' }"
  :title="sec.title"
  @dblclick="startSectionEdit(sec.id)"
>
  <div class="w-px h-full bg-studio-accent/60"></div>
  <span
    class="section-label absolute top-0 text-[9px] text-studio-accent/80 px-1 whitespace-nowrap"
    style="transform: translateX(4px)"
  >{{ sec.title }}</span>
</div>
```

In `<script setup>`, add:

```typescript
const editingSectionId = ref<string | null>(null);
const editingSectionTitle = ref('');

function startSectionEdit(id: string) {
  const s = project.value.sections.find((sec) => sec.id === id);
  if (!s) return;
  editingSectionId.value = id;
  editingSectionTitle.value = s.title;
}

function commitSectionEdit() {
  if (!editingSectionId.value) return;
  store.updateSection(editingSectionId.value, { title: editingSectionTitle.value });
  editingSectionId.value = null;
}
```

Replace the static `<span>` in the section marker with an inline input when editing:

```vue
<input
  v-if="editingSectionId === sec.id"
  v-model="editingSectionTitle"
  class="section-title-input text-[9px] bg-studio-surface2 text-studio-accent border border-studio-accent rounded px-1"
  style="width: 80px"
  @blur="commitSectionEdit"
  @keydown.enter.prevent="commitSectionEdit"
  @keydown.escape.prevent="editingSectionId = null"
/>
<span v-else class="section-label ...">{{ sec.title }}</span>
```

- [ ] **Step 2: Add "Add Section" button to timeline toolbar**

Find the timeline toolbar (the top control row in `Timeline.vue` with the zoom/fps controls). Add a button:

```vue
<button
  class="btn btn-xs text-studio-text-muted hover:text-studio-text"
  title="Add section at playhead"
  aria-label="Add section at playhead"
  @click="store.addSection(store.playbackTime, 'Bölüm')"
>
  + Bölüm
</button>
```

- [ ] **Step 3: Run the unit tests and typecheck**

```
cd services/web && npm run test:unit
npm run typecheck
```
Expected: all pass.

- [ ] **Step 4: Commit**

```
git add services/web/src/components/timeline/Timeline.vue
git commit -m "feat(timeline): section markers + add-section button"
```

---

## Task 6: Full gate

- [ ] **Step 1: Run all test suites**

```
cd services/web && npm run test:unit
npm test
npm test --workspace services/api
npm test --workspace packages/manim-codegen
```

Expected: all suites pass.

- [ ] **Step 2: Run lint + typecheck + format**

```
npm run lint
npm run typecheck
npm run format:check
```

Expected: no errors.

- [ ] **Step 3: Final commit if needed**

```
git add -A
git commit -m "chore: lint/format fixes for wave2 track B"
```
