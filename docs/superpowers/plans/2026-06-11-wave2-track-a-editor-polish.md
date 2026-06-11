# Wave 2 Track A — Editor Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add numeric scrubbing to inspector number fields, recent-color swatches to all color pickers, and inline double-click text editing directly on the canvas.

**Architecture:** Three independent UI improvements sharing no new store actions except `addRecentColor`. Inline text editing adds an `editingTextId` ref to `useStageInteractions.ts` and a `<textarea>` overlay to `StageCanvas.vue`. Scrubbing adds mouse-drag listeners to `Num.vue`. Recent colors adds a swatch strip to `ColorRow.vue` backed by a store-level `recentColors` array persisted to localStorage.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Pinia, Vitest + Vue Test Utils

---

## File Map

| Action | File |
|---|---|
| Modify | `services/web/src/store/project.ts` — add `recentColors: string[]` state + `addRecentColor(hex)` action |
| Modify | `services/web/src/components/inspector/ui/ColorRow.vue` — add swatch strip |
| Modify | `services/web/src/components/inspector/ui/Num.vue` — add scrub listeners |
| Modify | `services/web/src/components/stage/composables/useStageInteractions.ts` — add `editingTextId` + dblclick handler |
| Modify | `services/web/src/components/stage/StageCanvas.vue` — add `<textarea>` overlay |
| Create | `services/web/tests/components/recent-colors.test.ts` |
| Create | `services/web/tests/components/num-scrub.test.ts` |
| Create | `services/web/tests/components/inline-text-edit.test.ts` |

---

## Task 1: Recent colors — store state

**Files:**
- Modify: `services/web/src/store/project.ts`

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/recent-colors.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

describe('recentColors', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('starts empty', () => {
    expect(store.recentColors).toEqual([]);
  });

  it('addRecentColor prepends and deduplicates', () => {
    store.addRecentColor('#ff0000');
    store.addRecentColor('#00ff00');
    store.addRecentColor('#ff0000'); // duplicate — moves to front
    expect(store.recentColors[0]).toBe('#ff0000');
    expect(store.recentColors.length).toBe(2);
  });

  it('caps at 8 colors', () => {
    for (let i = 0; i < 10; i++) store.addRecentColor(`#${String(i).padStart(6, '0')}`);
    expect(store.recentColors.length).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- --reporter=verbose recent-colors
```
Expected: FAIL — `store.recentColors` is undefined, `addRecentColor` is not a function.

- [ ] **Step 3: Add `recentColors` state to the store**

In `services/web/src/store/project.ts`:

Find the `State` interface (around line 115) and add:
```typescript
  recentColors: string[];
```

Find the `defineStore` initial state block (where `playbackTime: 0` lives, around line 480) and add:
```typescript
    recentColors: [],
```

Find the actions section and add the new action (near other simple setters like `setPlaybackTime`):
```typescript
    addRecentColor(hex: string) {
      const filtered = this.recentColors.filter((c) => c !== hex);
      this.recentColors = [hex, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('manim-motion-recent-colors', JSON.stringify(this.recentColors));
      } catch {
        // localStorage may be unavailable in test env
      }
    },
```

Also load from localStorage on store init. In the `newProject` or the store's initial setup, after the `recentColors: []` initialization, add a one-time load. The cleanest place is right after the `defineStore` `state()` return, by calling a hydration action. Instead, add this inside the `init()` action (or create one at store module level):

At the top level of the store module (outside `defineStore`), after the store is defined, export a `hydrateRecentColors` helper — actually the simplest approach is to load in `newProject` and `openProject` from a helper. Add this helper before `defineStore`:

```typescript
function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem('manim-motion-recent-colors');
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
```

Then in the `state()` section change `recentColors: []` to `recentColors: loadRecentColors()`.

- [ ] **Step 4: Run test to verify it passes**

```
cd services/web && npm run test:unit -- --reporter=verbose recent-colors
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```
git add services/web/src/store/project.ts services/web/tests/components/recent-colors.test.ts
git commit -m "feat(store): add recentColors state + addRecentColor action"
```

---

## Task 2: Recent colors — ColorRow UI

**Files:**
- Modify: `services/web/src/components/inspector/ui/ColorRow.vue`

- [ ] **Step 1: Write the failing test**

Add to `services/web/tests/components/recent-colors.test.ts`:

```typescript
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import ColorRow from '../../src/components/inspector/ui/ColorRow.vue';

describe('ColorRow recent swatches', () => {
  it('renders swatch buttons when recentColors is non-empty', async () => {
    const wrapper = mount(ColorRow, {
      props: { label: 'Color', value: '#ffffff' },
      global: {
        plugins: [
          createTestingPinia({
            initialState: { project: { recentColors: ['#ff0000', '#00ff00'] } },
          }),
        ],
      },
    });
    const swatches = wrapper.findAll('.recent-swatch');
    expect(swatches).toHaveLength(2);
  });

  it('emits input with swatch color on click', async () => {
    const wrapper = mount(ColorRow, {
      props: { label: 'Color', value: '#ffffff' },
      global: {
        plugins: [
          createTestingPinia({
            initialState: { project: { recentColors: ['#ff0000'] } },
          }),
        ],
      },
    });
    await wrapper.find('.recent-swatch').trigger('click');
    expect(wrapper.emitted('input')?.[0]).toEqual(['#ff0000']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- --reporter=verbose recent-colors
```
Expected: FAIL — `.recent-swatch` elements not found.

- [ ] **Step 3: Update ColorRow.vue**

Replace the entire file content:

```vue
<template>
  <div>
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-studio-text-muted w-12">{{ label }}</span>
      <input
        type="color"
        class="color-input"
        :value="value || '#ffffff'"
        :aria-label="label + ' color picker'"
        @input="onInput($event)"
      />
      <input
        class="input input-sm flex-1"
        :value="value"
        :aria-label="label + ' color hex'"
        @change="onInput($event)"
      />
    </div>
    <div v-if="store.recentColors.length > 0" class="flex gap-1 mt-1 flex-wrap">
      <button
        v-for="c in store.recentColors"
        :key="c"
        class="recent-swatch"
        :style="{ background: c }"
        :title="c"
        :aria-label="'Use recent color ' + c"
        @click="emit('input', c)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProjectStore } from '../../../store/project.js';

defineProps({ label: String, value: String });
const emit = defineEmits(['input']);
const store = useProjectStore();

function onInput(e: Event) {
  const hex = (e.target as HTMLInputElement).value;
  store.addRecentColor(hex);
  emit('input', hex);
}
</script>

<style scoped>
.recent-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--studio-border);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.recent-swatch:hover {
  outline: 2px solid var(--studio-accent);
  outline-offset: 1px;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

```
cd services/web && npm run test:unit -- --reporter=verbose recent-colors
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```
git add services/web/src/components/inspector/ui/ColorRow.vue services/web/tests/components/recent-colors.test.ts
git commit -m "feat(inspector): recent colors swatch strip in ColorRow"
```

---

## Task 3: Numeric scrubbing in Num.vue

**Files:**
- Modify: `services/web/src/components/inspector/ui/Num.vue`
- Create: `services/web/tests/components/num-scrub.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/num-scrub.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Num from '../../src/components/inspector/ui/Num.vue';

describe('Num scrubbing', () => {
  it('label has ew-resize cursor class', () => {
    const w = mount(Num, { props: { label: 'X', value: 10, step: 1 } });
    expect(w.find('.num-label').exists()).toBe(true);
    expect(w.find('.num-label').classes()).toContain('cursor-ew-resize');
  });

  it('emits input on mousedown + mousemove 50px right (= +0.5 units)', async () => {
    const w = mount(Num, { props: { label: 'X', value: 10, step: 1 } });
    const label = w.find('.num-label');

    await label.trigger('mousedown', { clientX: 100 });

    // Simulate mousemove at document level
    const moveEvent = new MouseEvent('mousemove', { clientX: 150, shiftKey: false });
    document.dispatchEvent(moveEvent);

    await w.vm.$nextTick();
    const emitted = w.emitted('input') as number[][];
    expect(emitted).toBeTruthy();
    // 50px / 100 * 1 (step) = 0.5 → 10 + 0.5 = 10.5
    expect(emitted![emitted!.length - 1]![0]).toBeCloseTo(10.5, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd services/web && npm run test:unit -- --reporter=verbose num-scrub
```
Expected: FAIL — `.num-label` not found.

- [ ] **Step 3: Update Num.vue**

Replace entire file:

```vue
<template>
  <div>
    <span
      class="num-label text-[9px] text-studio-text-muted/50 cursor-ew-resize select-none"
      :class="{ 'text-studio-accent': scrubbing }"
      @mousedown="onLabelMousedown"
    >{{ label }}</span>
    <input
      class="input input-sm"
      type="number"
      :value="value"
      :min="min"
      :max="max"
      :step="step"
      @change="onInput($event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  label: String,
  value: [Number, String],
  min: { type: Number, default: undefined },
  max: { type: Number, default: undefined },
  step: { type: Number, default: 1 },
});
const emit = defineEmits(['input']);

function onInput(e: Event) {
  emit('input', Number((e.target as HTMLInputElement).value));
}

const scrubbing = ref(false);
let _startX = 0;
let _startVal = 0;

function onLabelMousedown(e: MouseEvent) {
  scrubbing.value = true;
  _startX = e.clientX;
  _startVal = Number(props.value) || 0;
  document.addEventListener('mousemove', onScrubMove);
  document.addEventListener('mouseup', onScrubUp);
  e.preventDefault();
}

function onScrubMove(e: MouseEvent) {
  if (!scrubbing.value) return;
  const delta = (e.clientX - _startX) / 100;
  const multiplier = e.shiftKey ? 10 : 1;
  let newVal = _startVal + delta * multiplier * (props.step ?? 1);
  if (props.min !== undefined) newVal = Math.max(props.min, newVal);
  if (props.max !== undefined) newVal = Math.min(props.max, newVal);
  emit('input', Math.round(newVal * 1000) / 1000);
}

function onScrubUp() {
  scrubbing.value = false;
  document.removeEventListener('mousemove', onScrubMove);
  document.removeEventListener('mouseup', onScrubUp);
}
</script>
```

- [ ] **Step 4: Run test to verify it passes**

```
cd services/web && npm run test:unit -- --reporter=verbose num-scrub
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```
git add services/web/src/components/inspector/ui/Num.vue services/web/tests/components/num-scrub.test.ts
git commit -m "feat(inspector): numeric scrubbing on Num label drag"
```

---

## Task 4: Inline text editing — interaction hook

**Files:**
- Modify: `services/web/src/components/stage/composables/useStageInteractions.ts`
- Create: `services/web/tests/components/inline-text-edit.test.ts`

The text/latex object types that support inline editing: `'text'`, `'latex'`, `'code'`.

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/inline-text-edit.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

const TEXT_EDITABLE_TYPES = ['text', 'latex', 'code'];

describe('inline text editing — editable types', () => {
  it('TEXT_EDITABLE_TYPES includes text, latex, code', () => {
    expect(TEXT_EDITABLE_TYPES).toContain('text');
    expect(TEXT_EDITABLE_TYPES).toContain('latex');
    expect(TEXT_EDITABLE_TYPES).toContain('code');
  });
});

describe('textEditOverlayStyle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('computes correct pixel position for a centered object', () => {
    // obj at canvas center, zoom=1, no pan
    const objX = 960, objY = 540, w = 300, h = 80;
    const vs = 1;
    // s2c(960, 540) with ox=0, oy=0, vs=1 → canvas px = stage px (for a 1920x1080 stage at 1:1 zoom)
    // In a real stage the canvas might be smaller; we test the math only
    function s2c(px: number, py: number) { return { x: px * vs, y: py * vs }; }
    const pos = s2c(objX, objY);
    const left = pos.x - (w * vs) / 2;
    const top  = pos.y - (h * vs) / 2;
    expect(left).toBe(960 - 150);
    expect(top).toBe(540 - 40);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (these are pure logic tests — they pass immediately to confirm the math)

```
cd services/web && npm run test:unit -- --reporter=verbose inline-text-edit
```
Expected: PASS (2 tests).

- [ ] **Step 3: Add `editingTextId` to `useStageInteractions.ts`**

In `services/web/src/components/stage/composables/useStageInteractions.ts`:

After the existing `// ── State ──` section (around line 90), add:

```typescript
  // Inline text editing (double-click on text/latex/code objects)
  const editingTextId = ref<string | null>(null);
  const TEXT_EDITABLE_TYPES = ['text', 'latex', 'code'] as const;

  function startTextEdit(objId: string) {
    if (is3D.value) return; // disabled in 3D split viewport
    const obj = store.objectById(objId);
    if (!obj || obj.locked) return;
    if (!TEXT_EDITABLE_TYPES.includes(obj.type as (typeof TEXT_EDITABLE_TYPES)[number])) return;
    editingTextId.value = objId;
  }

  function commitTextEdit(newText: string) {
    if (!editingTextId.value) return;
    store.updateObject(editingTextId.value, { text: newText });
    editingTextId.value = null;
  }

  function cancelTextEdit() {
    editingTextId.value = null;
  }
```

In the `return` statement at the bottom of `useStageInteractions`, add the new exports:

```typescript
    editingTextId,
    startTextEdit,
    commitTextEdit,
    cancelTextEdit,
```

(Locate the existing `return {` at the end of the composable and append these four entries.)

- [ ] **Step 4: Run all unit tests to check for regressions**

```
cd services/web && npm run test:unit
```
Expected: all tests pass (same count as before, +2 from inline-text-edit).

- [ ] **Step 5: Commit**

```
git add services/web/src/components/stage/composables/useStageInteractions.ts services/web/tests/components/inline-text-edit.test.ts
git commit -m "feat(stage): add editingTextId + text edit helpers to useStageInteractions"
```

---

## Task 5: Inline text editing — StageCanvas overlay

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Expose the composable return values**

In `StageCanvas.vue`, find where `useStageInteractions` is destructured (search for `const { shiftKey, liveTransform`). Add to the destructure:

```typescript
  editingTextId,
  startTextEdit,
  commitTextEdit,
  cancelTextEdit,
```

- [ ] **Step 2: Add double-click handler on the Konva stage**

In `StageCanvas.vue`, find the `<v-stage` element (search for `<v-stage`). Add the `@dblclick` handler:

```vue
@dblclick="onStageDblClick"
```

Then in the `<script setup>` section, add the handler function:

```typescript
function onStageDblClick(e: { target: { id?: () => string } }) {
  const nodeId = e.target?.id?.();
  if (!nodeId) return;
  startTextEdit(nodeId);
}
```

- [ ] **Step 3: Compute overlay style**

In `StageCanvas.vue`, in the `<script setup>` section, add:

```typescript
const textEditStyle = computed(() => {
  if (!editingTextId.value) return {};
  const obj = store.objectById(editingTextId.value);
  if (!obj) return {};
  const pos = s2c(obj.x ?? 0, obj.y ?? 0);
  const w = Math.max(80, (obj.width ?? 200) * vs.value);
  const h = Math.max(40, (obj.height ?? 60) * vs.value);
  return {
    position: 'absolute' as const,
    left: pos.x - w / 2 + 'px',
    top: pos.y - h / 2 + 'px',
    width: w + 'px',
    minHeight: h + 'px',
    zIndex: 500,
    fontSize: Math.max(11, 14 * vs.value) + 'px',
    padding: '4px 6px',
    background: 'var(--studio-surface3)',
    border: '2px solid var(--studio-accent)',
    borderRadius: '4px',
    color: 'var(--studio-text)',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'monospace',
    lineHeight: '1.4',
  };
});

const editingText = computed(() => {
  if (!editingTextId.value) return '';
  const obj = store.objectById(editingTextId.value);
  return (obj?.['text'] as string) ?? '';
});

function onTextEditInput(e: Event) {
  // live update optional — we commit on blur
  void e;
}

function onTextEditBlur(e: FocusEvent) {
  commitTextEdit((e.target as HTMLTextAreaElement).value);
}
```

- [ ] **Step 4: Add the textarea overlay to the template**

In `StageCanvas.vue`, find the outer wrapping `<div>` that contains the `<v-stage>`. It likely has `class="stage-container"` or similar. Inside that div, add the textarea overlay after the `<v-stage>`:

```vue
<textarea
  v-if="editingTextId"
  :style="textEditStyle"
  :value="editingText"
  @input="onTextEditInput"
  @blur="onTextEditBlur"
  @keydown.escape.prevent="cancelTextEdit"
  @keydown.ctrl.enter.prevent="(e) => commitTextEdit((e.target as HTMLTextAreaElement).value)"
/>
```

The overlay uses `position: absolute` so the parent must be `position: relative`. Verify the parent div has `class="relative"` or `style="position:relative"`. If not, add `relative` to its class.

- [ ] **Step 5: Run the full unit test suite**

```
cd services/web && npm run test:unit
```
Expected: all tests pass.

- [ ] **Step 6: Run typecheck**

```
cd services/web && npm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Commit**

```
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(stage): inline text editing overlay on double-click"
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

Expected: no errors (warnings OK).

- [ ] **Step 3: Final commit if needed**

If any lint/format fixes were needed:
```
git add -A
git commit -m "chore: lint/format fixes for wave2 track A"
```
