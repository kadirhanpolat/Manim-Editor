# Topbar.vue Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 949-line `services/web/src/components/topbar/Topbar.vue` into a reusable `MenuBar.vue` widget, a self-contained `NewProjectDialog.vue` modal, a `menus.js` data factory, and a thin orchestrator — behaviorally identical.

**Architecture:** Characterization snapshot first (with JSDOM `ResizeObserver`/`clientWidth` shims). Then, leaf→root: extract `buildMenus(ctx)` data, the New Project dialog, and the menubar widget; `Topbar.vue` ends as brand + center + right controls + `<MenuBar>` + `<NewProjectDialog>`, owning the command handlers and resize/collapse. All template markup + scoped styles move verbatim; only wiring changes.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest + `@vue/test-utils`.

**Spec:** `docs/superpowers/specs/2026-06-06-topbar-split-design.md`

---

## Conventions (read once)

- **Verbatim move:** locate template/style blocks by their HTML comment markers / class names
  and move them character-for-character. Only `<script setup>` wiring is authored fresh.
- **Snapshot guard:** `tests/components/topbar/topbar.characterization.test.js` (Task 1) must
  stay green with NO `-u` rewrite after every task. `norm()` strips `data-v-*`, comments,
  whitespace. Scoped CSS is NOT in the snapshot — verify style-rule moves by hand.
- **JSDOM shims** (needed to mount Topbar at all): stub `ResizeObserver`; mock `clientWidth`
  to control `collapsed`. Provided in Task 1, reused by later tests.
- Commit after every task. Run `cd services/web && npm run test:unit` (+ `npm run build` where noted).

---

## Task 1: Characterization snapshot baseline

**Files:** Create `services/web/tests/components/topbar/topbar.characterization.test.js`

- [ ] **Step 1: Write the test**

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import Topbar from '../../../src/components/topbar/Topbar.vue';
import { useProjectStore } from '../../../src/store/project.js';

function norm(html) {
  return html
    .replace(/ data-v-[0-9a-f]+(="")?/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// JSDOM has no ResizeObserver and reports clientWidth 0. Stub both so Topbar mounts
// and so we can drive the desktop-vs-collapsed split deterministically.
let widthSpy;
function setWidth(px) {
  widthSpy = Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => px,
  });
}
let store;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Char', 'visual');
});
afterEach(() => {
  delete HTMLElement.prototype.clientWidth;
  vi.unstubAllGlobals();
});

describe('Topbar characterization', () => {
  it('desktop nav (wide)', () => {
    setWidth(1000);
    const w = mount(Topbar);
    expect(norm(w.html())).toMatchSnapshot();
  });

  it('collapsed hamburger (narrow)', () => {
    setWidth(320);
    const w = mount(Topbar);
    expect(norm(w.html())).toMatchSnapshot();
  });

  it('new project dialog open', async () => {
    setWidth(1000);
    const w = mount(Topbar);
    // open the dialog via the File → New Project action path: set the internal flag
    w.vm.showNewProjectDialog = true;
    await w.vm.$nextTick();
    expect(norm(w.html())).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run to capture baseline**

Run: `cd services/web && npx vitest run tests/components/topbar/topbar.characterization.test.js`
Expected: PASS; writes `tests/components/topbar/__snapshots__/topbar.characterization.test.js.snap`.
If `w.vm.showNewProjectDialog` is not exposed (it is a top-level `ref` in `<script setup>`, so
it is exposed on the instance by Vitest's `mount`), and the assignment does not open the dialog,
fall back to: find the File menu label button, click it, then click the "New Project" item, and
snapshot. Keep all three states. (Whatever opens the dialog, capture it once as the baseline.)

- [ ] **Step 3: Run the full suite to confirm no interference**

Run: `cd services/web && npm run test:unit`
Expected: PASS (new file included).

- [ ] **Step 4: Commit**

```bash
git add services/web/tests/components/topbar/
git commit -m "test(topbar): characterization snapshot baseline (ResizeObserver/clientWidth shims)"
```

> From here, the snapshot must stay green and unchanged. Never run vitest with `-u` to mask a diff.

---

## Task 2: Extract `topbar/menus.js`

**Files:** Create `services/web/src/components/topbar/menus.js`; Modify `Topbar.vue`.

- [ ] **Step 1: Create `menus.js`**

Move the body of the current `const menus = computed(() => [ … ])` array into a factory.
Paste the array VERBATIM inside `buildMenus`, replacing the free references with `ctx` members:
`newProject`/`loadProject`/`saveProject`/`saveToServer`/`browseServer`/`openExport`/`openRender`/
`showShortcuts`/`showAbout`/`toggleGrid`/`toggleSnap`/`groupSelected` become `ctx.*`; `mod`/`isMac`/
`store` become `ctx.*`; `isSaving`/`canGroup`/`gridVisible`/`snapEnabled`/`currentTheme` become
`ctx.*` (still read with `.value` inside the closures).

```js
// Declarative menubar data. Pure factory: all behavior comes from ctx.
export function buildMenus(ctx) {
  const {
    mod, isMac, store,
    isSaving, canGroup, gridVisible, snapEnabled, currentTheme,
    newProject, loadProject, saveProject, saveToServer, browseServer,
    openExport, openRender, showShortcuts, showAbout, toggleGrid, toggleSnap, groupSelected,
  } = ctx;
  return [
    {
      id: 'file', label: 'File',
      items: [
        { id: 'f-new',    label: 'New Project',     action: () => newProject() },
        { id: 'f-open',   label: 'Open…',           action: () => loadProject(),  shortcut: `${mod}O` },
        { type: 'separator' },
        { id: 'f-save',   label: 'Save',            action: () => saveProject(),  shortcut: `${mod}S` },
        { id: 'f-sync',   label: 'Save to Server',  action: () => saveToServer(), disabled: () => isSaving.value },
        { id: 'f-browse', label: 'Server Projects…',action: () => browseServer() },
        { type: 'separator' },
        { id: 'f-export', label: 'Export .py',      action: () => openExport() },
      ]
    },
    {
      id: 'edit', label: 'Edit',
      items: [
        { id: 'e-undo',  label: 'Undo',            action: () => store.undo(),           shortcut: `${mod}Z` },
        { id: 'e-redo',  label: 'Redo',            action: () => store.redo(),           shortcut: isMac ? '⇧⌘Z' : 'Ctrl+Y' },
        { type: 'separator' },
        { id: 'e-copy',  label: 'Copy',            action: () => store.copySelection(),  shortcut: `${mod}C` },
        { id: 'e-paste', label: 'Paste',           action: () => store.pasteSelection(), shortcut: `${mod}V` },
        { type: 'separator' },
        { id: 'e-group', label: 'Group Selection', action: () => groupSelected(),        shortcut: `${mod}G`, disabled: () => !canGroup.value },
      ]
    },
    {
      id: 'view', label: 'View',
      items: [
        { id: 'v-grid', label: 'Grid', type: 'toggle', action: () => toggleGrid(), checked: () => gridVisible.value },
        { id: 'v-snap', label: 'Snap', type: 'toggle', action: () => toggleSnap(), checked: () => snapEnabled.value },
        { type: 'separator' },
        {
          id: 'v-theme', label: 'Theme', type: 'submenu',
          children: [
            { id: 'v-t-light', label: 'Light', action: () => store.setTheme('light'), active: () => currentTheme.value === 'light' },
            { id: 'v-t-dark',  label: 'Dark',  action: () => store.setTheme('dark'),  active: () => currentTheme.value === 'dark' },
          ]
        },
      ]
    },
    {
      id: 'tools', label: 'Tools',
      items: [
        { id: 't-render', label: 'Render HQ…', action: () => openRender() },
      ]
    },
    {
      id: 'help', label: 'Help',
      items: [
        { id: 'h-keys',  label: 'Keyboard Shortcuts', action: () => showShortcuts() },
        { type: 'separator' },
        { id: 'h-about', label: 'About Manim Motion',  action: () => showAbout() },
      ]
    }
  ];
}
```

- [ ] **Step 2: Wire into `Topbar.vue`**

Add `import { buildMenus } from './menus.js';`. Replace the whole `const menus = computed(() => [ … ])`
with:
```js
const menus = computed(() => buildMenus({
  mod, isMac, store,
  isSaving, canGroup, gridVisible, snapEnabled, currentTheme,
  newProject, loadProject, saveProject, saveToServer, browseServer,
  openExport, openRender, showShortcuts, showAbout, toggleGrid, toggleSnap, groupSelected,
}));
```
(`menus` is referenced by functions declared later — `computed` is lazy so order is fine, but
keep the `const menus` declaration where it was to be safe.)

- [ ] **Step 3: Verify** — `cd services/web && npx vitest run tests/components/topbar/topbar.characterization.test.js` (3 pass, no rewrite) + `npm run test:unit` (pass).

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/topbar/menus.js services/web/src/components/topbar/Topbar.vue
git commit -m "refactor(topbar): extract menus.js buildMenus(ctx) factory"
```

---

## Task 3: Extract `topbar/NewProjectDialog.vue`

**Files:** Create `services/web/src/components/topbar/NewProjectDialog.vue`; Modify `Topbar.vue`.

- [ ] **Step 1: Create `NewProjectDialog.vue`**

Template: move the `<!-- New Project dialog -->` `<transition name="menu-pop"> … </transition>`
block VERBATIM, with one change: `v-if="showNewProjectDialog"` → `v-if="show"`. Script:

```vue
<script setup>
import { ref, watch, nextTick } from 'vue';
import { useProjectStore } from '../../store/project.js';
import TEMPLATES from '../../templates/index.js';

const props = defineProps({ show: { type: Boolean, default: false } });
const emit = defineEmits(['close']);
const store = useProjectStore();

const templates = TEMPLATES;
const newProjectName = ref('My Animation');
const newProjectMode = ref('visual');
const newProjectTemplate = ref(null);
const npNameInput = ref(null);

watch(() => props.show, (open) => {
  if (open) {
    newProjectName.value = 'My Animation';
    newProjectMode.value = 'visual';
    newProjectTemplate.value = null;
    nextTick(() => { npNameInput.value?.focus(); });
  }
});

function confirmNewProject() {
  const name = newProjectName.value.trim() || 'My Animation';
  const tpl  = newProjectTemplate.value;
  if (tpl && tpl.project) {
    const projectData = tpl.project();
    projectData.name = name;
    projectData.id   = null;
    store._stopPollRender();
    store.playbackTime    = 0;
    store.playbackPlaying = false;
    store.frameState      = { objectOverrides: {}, morphShapes: [], hiddenIds: new Set() };
    store.renderStatus    = null;
    store.renderJobId     = null;
    store.renderVideoUrl  = null;
    store.renderLog       = '';
    store.renderError     = null;
    store.importJSON(JSON.stringify(projectData));
  } else {
    store.newProject(name, newProjectMode.value);
  }
  emit('close');
}
function cancelNewProject() {
  emit('close');
}
</script>
```
Move the `.np-*` style rules (lines `.np-overlay` … `.np-btn-create:hover`) VERBATIM into a
`<style scoped>` block here, and REMOVE them from `Topbar.vue`'s `<style>`.

> Behavioral note: the original `newProject()` reset name/mode before showing and the dialog
> autofocused via `ref`. The `watch(show)` reset + focus replicates both. `cancelNewProject` and
> a completed `confirmNewProject` both close via `emit('close')` (parent flips the flag), matching
> the original which set `showNewProjectDialog=false` and reset fields (now reset on next open).

- [ ] **Step 2: Wire into `Topbar.vue`**

Add `import NewProjectDialog from './NewProjectDialog.vue';`. Replace the `<!-- New Project dialog -->`
block in the template with:
```vue
<NewProjectDialog :show="showNewProjectDialog" @close="showNewProjectDialog = false" />
```
In `<script setup>`: delete `newProjectName`/`newProjectMode`/`newProjectTemplate`/`npNameInput`
refs, the `templates` const, the `generateManimScript`? (NO — `generateManimScript` is used by
`openExport`, keep it), and the `confirmNewProject`/`cancelNewProject` functions. Shrink
`newProject()` to:
```js
function newProject() {
  if (store.isDirty && !confirm('Discard unsaved changes?')) return;
  showNewProjectDialog.value = true;
}
```
Keep `showNewProjectDialog` ref in Topbar. Remove the now-unused `TEMPLATES` import from Topbar
(it moved into the dialog). Keep `reactive`/`nextTick` in Topbar's `vue` import only if still used
(nextTick is used by `focusLabel`; reactive by `anchorRefs` — both still in Topbar until Task 4).

- [ ] **Step 3: Verify** — characterization snapshot (3 pass, no rewrite) + `npm run test:unit` (pass) + `npm run build` (success).

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/topbar/NewProjectDialog.vue services/web/src/components/topbar/Topbar.vue
git commit -m "refactor(topbar): extract NewProjectDialog.vue (controlled modal)"
```

---

## Task 4: Extract `topbar/MenuBar.vue` (Topbar becomes thin)

**Files:** Create `services/web/src/components/topbar/MenuBar.vue`; Modify `Topbar.vue`.

- [ ] **Step 1: Create `MenuBar.vue`**

Template: a root `<template>` containing, in order: the desktop `<nav v-if="!collapsed" …>` block
(lines from `<!-- Desktop nav -->`), the collapsed `<div v-else class="menu-anchor" …>` block
(from `<!-- Collapsed hamburger -->`), and the backdrop `<div v-if="openMenuId" class="menubar-backdrop" @mousedown="closeMenu"></div>`
(from `<!-- Backdrop … -->`). Move them VERBATIM. Script:

```vue
<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps({
  menus: { type: Array, required: true },
  collapsed: { type: Boolean, default: false },
});

const openMenuId = ref(null);
const focusIdx = ref(-1);
const hoveredSub = ref(null);
let _hoverSwitchedAt = null;

const anchorRefs = reactive({});
function setAnchorRef(id, el) {
  if (el) anchorRefs[id] = el;
  else delete anchorRefs[id];
}

function toggleMenu(id) {
  if (_hoverSwitchedAt && Date.now() - _hoverSwitchedAt < 300) return;
  if (openMenuId.value === id) { closeMenu(); return; }
  openMenuId.value = id;
  focusIdx.value = -1;
  hoveredSub.value = null;
}
function hoverMenu(id) {
  if (openMenuId.value && openMenuId.value !== id) {
    openMenuId.value = id;
    focusIdx.value = -1;
    hoveredSub.value = null;
    _hoverSwitchedAt = Date.now();
  }
}
function closeMenu() {
  openMenuId.value = null;
  focusIdx.value = -1;
  hoveredSub.value = null;
}
function executeItem(item) {
  if (item.disabled && item.disabled()) return;
  if (item.action) item.action();
  if (item.type !== 'toggle' && item.type !== 'submenu') closeMenu();
}
function onLabelKey(e, menuIndex) {
  const ids = props.menus.map(m => m.id);
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = (menuIndex + 1) % ids.length;
    focusLabel(next);
    if (openMenuId.value) openMenuId.value = ids[next];
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = (menuIndex - 1 + ids.length) % ids.length;
    focusLabel(prev);
    if (openMenuId.value) openMenuId.value = ids[prev];
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleMenu(ids[menuIndex]);
  } else if (e.key === 'ArrowDown' && openMenuId.value) {
    e.preventDefault();
    focusIdx.value = nextFocusable(-1, 1);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu();
  }
}
function focusLabel(index) {
  const id = props.menus[index]?.id;
  if (!id) return;
  nextTick(() => {
    const el = anchorRefs[id];
    const btn = el?.querySelector('button');
    if (btn) btn.focus();
  });
}
function onDropdownKey(e, menuIndex) {
  const menu = props.menus[menuIndex];
  if (!menu) return;
  const items = menu.items;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusIdx.value = nextFocusable(focusIdx.value, 1, items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusIdx.value = nextFocusable(focusIdx.value, -1, items);
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (focusIdx.value >= 0 && items[focusIdx.value]) executeItem(items[focusIdx.value]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu();
    focusLabel(menuIndex);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = (menuIndex + 1) % props.menus.length;
    openMenuId.value = props.menus[next].id;
    focusIdx.value = -1;
    focusLabel(next);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = (menuIndex - 1 + props.menus.length) % props.menus.length;
    openMenuId.value = props.menus[prev].id;
    focusIdx.value = -1;
    focusLabel(prev);
  }
}
function nextFocusable(current, dir, items) {
  const menu = items || (props.menus.find(m => m.id === openMenuId.value)?.items) || [];
  let i = current + dir;
  while (i >= 0 && i < menu.length) {
    if (menu[i].type !== 'separator') return i;
    i += dir;
  }
  return current;
}
function _globalKey(e) {
  if (openMenuId.value && e.key === 'Escape') {
    closeMenu();
    e.preventDefault();
    e.stopPropagation();
  }
}
onMounted(() => { document.addEventListener('keydown', _globalKey); });
onBeforeUnmount(() => { document.removeEventListener('keydown', _globalKey); });
</script>
```
> The two interaction functions previously read `menus.value` (the computed); in MenuBar they
> read `props.menus` (already the array). Every `menus.value` → `props.menus` in the moved logic.
> The template references `menus` (loop source) — change the `v-for="(menu, mi) in menus"` / `in menus`
> to `props.menus`? NO — in template, `menus` must resolve; expose it. Simplest: keep the template
> using `menus` and add `const menus = computed(() => props.menus)` OR rename loop sources to
> `props.menus`. Use the loop binding `v-for="(menu, mi) in menus"` with a `const menus = props.menus`
> alias in script (a plain alias is reactive since the prop array identity changes on rebuild).

Move ALL menu-related styles VERBATIM into a `<style scoped>` here and REMOVE them from Topbar:
`.menubar-nav`, `.menu-anchor`, `.menu-label`(+states), `.menu-dropdown`, `.collapsed-dropdown`,
`.menu-group-hdr`, `.menu-sep`, `.menu-item`(+states), `.mi-*`, `.radio-on .mi-radio`,
`.menu-sub-anchor`, `.menu-submenu`, `.menu-pop-*` transitions, and `.menubar-backdrop`.

- [ ] **Step 2: Reduce `Topbar.vue`**

In the template, replace the desktop `<nav>` + collapsed `<div v-else>` blocks with a single
`<MenuBar :menus="menus" :collapsed="collapsed" />` (placed where the `<nav>` was, inside
`<header>`), and DELETE the standalone backdrop block (moved into MenuBar). Add
`import MenuBar from './MenuBar.vue';`. In `<script setup>` DELETE everything that moved to MenuBar:
`openMenuId`, `focusIdx`, `hoveredSub`, `_hoverSwitchedAt`, `anchorRefs`/`setAnchorRef`,
`toggleMenu`, `hoverMenu`, `closeMenu`, `executeItem`, `onLabelKey`, `focusLabel`, `onDropdownKey`,
`nextFocusable`, `_globalKey`, and the `document.addEventListener('keydown', _globalKey)` /
`removeEventListener` lines from `onMounted`/`onBeforeUnmount` (keep the ResizeObserver + `checkCollapse`
+ `store.setTheme` parts). Trim Topbar's `vue` import to what remains (`ref, computed, onMounted,
onBeforeUnmount` — drop `reactive`/`nextTick` if now unused). Keep `collapsed`/`checkCollapse`/`root`/
the ResizeObserver and all command handlers + the `menus` computed.

- [ ] **Step 3: Verify** — characterization snapshot (3 pass, no rewrite); `npm run test:unit` (pass); `npm run build` (success — watch the `<template v-for>` key gotcha: the menu loops use keys on `<template>` tags; keep them).

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/topbar/MenuBar.vue services/web/src/components/topbar/Topbar.vue
git commit -m "refactor(topbar): extract MenuBar.vue; Topbar is a thin orchestrator"
```

---

## Task 5: Per-unit tests

**Files:** Create `services/web/tests/components/topbar/topbar-units.test.js`

- [ ] **Step 1: Write the tests**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { useProjectStore } from '../../../src/store/project.js';
import { buildMenus } from '../../../src/components/topbar/menus.js';
import NewProjectDialog from '../../../src/components/topbar/NewProjectDialog.vue';
import MenuBar from '../../../src/components/topbar/MenuBar.vue';

beforeEach(() => {
  setActivePinia(createPinia());
  useProjectStore().newProject('T', 'visual');
});

describe('buildMenus', () => {
  it('returns the 5 top-level menus and wires injected callbacks', () => {
    const loadProject = vi.fn();
    const canGroup = ref(false);
    const menus = buildMenus({
      mod: 'Ctrl+', isMac: false, store: {},
      isSaving: ref(false), canGroup, gridVisible: ref(true), snapEnabled: ref(false), currentTheme: ref('dark'),
      newProject: vi.fn(), loadProject, saveProject: vi.fn(), saveToServer: vi.fn(), browseServer: vi.fn(),
      openExport: vi.fn(), openRender: vi.fn(), showShortcuts: vi.fn(), showAbout: vi.fn(),
      toggleGrid: vi.fn(), toggleSnap: vi.fn(), groupSelected: vi.fn(),
    });
    expect(menus.map(m => m.id)).toEqual(['file', 'edit', 'view', 'tools', 'help']);
    const open = menus[0].items.find(i => i.id === 'f-open');
    open.action();
    expect(loadProject).toHaveBeenCalled();
    const group = menus[1].items.find(i => i.id === 'e-group');
    expect(group.disabled()).toBe(true);   // canGroup false ⇒ disabled
    canGroup.value = true;
    expect(group.disabled()).toBe(false);
  });
});

describe('NewProjectDialog', () => {
  it('Create calls store.newProject and emits close', async () => {
    const store = useProjectStore();
    const spy = vi.spyOn(store, 'newProject');
    const w = mount(NewProjectDialog, { props: { show: true } });
    await w.vm.$nextTick();
    await w.find('.np-input').setValue('Hello');
    await w.find('.np-btn-create').trigger('click');
    expect(spy).toHaveBeenCalledWith('Hello', 'visual');
    expect(w.emitted('close')).toBeTruthy();
  });

  it('Cancel emits close without creating', async () => {
    const store = useProjectStore();
    const spy = vi.spyOn(store, 'newProject');
    const w = mount(NewProjectDialog, { props: { show: true } });
    await w.find('.np-btn-cancel').trigger('click');
    expect(spy).not.toHaveBeenCalled();
    expect(w.emitted('close')).toBeTruthy();
  });
});

describe('MenuBar', () => {
  const menus = [{
    id: 'file', label: 'File',
    items: [{ id: 'x', label: 'Item X', action: () => {} }],
  }];
  it('clicking a label opens its dropdown; clicking an item runs action + closes', async () => {
    const action = vi.fn();
    const m = [{ id: 'file', label: 'File', items: [{ id: 'x', label: 'Item X', action }] }];
    const w = mount(MenuBar, { props: { menus: m, collapsed: false } });
    await w.find('.menu-label').trigger('click');
    expect(w.find('.menu-dropdown').exists()).toBe(true);
    await w.find('.menu-item').trigger('click');
    expect(action).toHaveBeenCalled();
    expect(w.find('.menu-dropdown').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run + fix selectors if needed**

Run: `cd services/web && npx vitest run tests/components/topbar/topbar-units.test.js`
Expected: PASS. If a class selector (`.np-input`, `.np-btn-create`, `.menu-label`, `.menu-item`,
`.menu-dropdown`) does not match because of markup details, read the component and adjust the
selector — keep the asserted behavior (store call / emit / dropdown open-close).

- [ ] **Step 3: Full suite** — `cd services/web && npm run test:unit` → PASS.

- [ ] **Step 4: Commit**

```bash
git add services/web/tests/components/topbar/topbar-units.test.js
git commit -m "test(topbar): unit tests for buildMenus, NewProjectDialog, MenuBar"
```

---

## Task 6: Docs + memory

**Files:** Modify `CLAUDE.md`; Create/append memory.

- [ ] **Step 1: `CLAUDE.md`** — in the Key Files table add a row:
```
| `services/web/src/components/topbar/Topbar.vue` + `MenuBar.vue` / `NewProjectDialog.vue` / `menus.js` | Menubar: thin `Topbar` orchestrator + reusable `MenuBar` widget (keyboard nav/dropdowns) + controlled `NewProjectDialog` modal + `buildMenus(ctx)` data factory (menu items live here) |
```
(Also update the Build/Environment-Gotchas `<template v-for>` note if it names `Topbar.vue` — the
keyed menu loops now live in `MenuBar.vue`.)

- [ ] **Step 2: Memory** — create
`C:\Users\Kadirhan\.claude\projects\D--PYTHON-Manim-Editor\memory\topbar-decomposed.md`:
```markdown
---
name: topbar-decomposed
description: Topbar split into MenuBar widget + NewProjectDialog modal + menus.js factory; menu items live in menus.js
metadata:
  type: project
---

`services/web/src/components/topbar/Topbar.vue` is a thin orchestrator: brand + center
project-name + right controls + `<MenuBar :menus :collapsed>` + `<NewProjectDialog :show @close>`.
The menubar widget (dropdowns, submenu, hamburger, keyboard nav, click-outside backdrop) is
`MenuBar.vue`. The New Project modal (form + template picker + confirm/cancel incl. render-state
reset) is `NewProjectDialog.vue` (controlled by a `show` prop, emits `close`). Menu items are
declarative data in `menus.js` `buildMenus(ctx)` — **to add/change a menu item, edit `menus.js`.**
Command handlers + resize/collapse stay in `Topbar.vue`. Mirrors [[properties-panel-decomposed]]
and [[stagecanvas-decomposed]]. Guarded by `tests/components/topbar/topbar.characterization.test.js`
(needs JSDOM `ResizeObserver` stub + `clientWidth` mock to mount).
```
Then append to `MEMORY.md`:
```
- [Topbar decomposed](topbar-decomposed.md) — Topbar split into MenuBar + NewProjectDialog + menus.js; menu items live in menus.js
```

- [ ] **Step 3: Commit** (code/docs only; memory dir is outside the repo)

```bash
git add CLAUDE.md
git commit -m "docs: reflect Topbar decomposition in CLAUDE.md"
```

---

## Self-review notes (already applied)

- **Spec coverage:** characterization-first (T1), menus.js (T2), NewProjectDialog (T3), MenuBar +
  thin Topbar (T4), per-unit tests (T5), docs/memory (T6). Brand/center/right stay inline per
  spec non-goal.
- **Style moves** explicitly enumerated (`.np-*`→dialog, `.menu-*`/`.menubar-backdrop`→MenuBar,
  brand/center/right→Topbar) because the snapshot can't see scoped CSS.
- **JSDOM shims** (ResizeObserver stub + clientWidth mock) are required to mount Topbar/MenuBar at
  all — provided in T1, reused in T5.
- **`menus.value` → `props.menus`** in every moved MenuBar function; template loop source aliased.
