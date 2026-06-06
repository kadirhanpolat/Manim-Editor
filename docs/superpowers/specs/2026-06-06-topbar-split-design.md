# Topbar.vue Decomposition — Design

**Date:** 2026-06-06
**Status:** Approved (design), pending spec review → implementation planning
**Scope:** Break `services/web/src/components/topbar/Topbar.vue` (949 lines: ~255 template
+ ~350 script + ~340 style) into a reusable menubar widget, a self-contained New Project
dialog, a declarative menu-data factory, and a thin orchestrator.
**Base branch:** branch off `main` (`refactor/topbar-split`).
**Predecessor:** follows the same playbook as `2026-06-06-properties-panel-split-design.md`
(characterization-snapshot first, verbatim markup moves, per-unit tests after).

## Problem

`Topbar.vue` is the second-largest component (949 lines) and has **zero test coverage**.
It mixes five unrelated concerns in one SFC:

1. The declarative `menus` data (File/Edit/View/Tools/Help — items, actions, shortcuts,
   toggles, the Theme submenu) — ~55 lines.
2. The **menubar widget**: desktop `<nav>` with per-menu dropdowns, the Theme submenu, the
   collapsed hamburger variant, the click-outside backdrop, and the full keyboard-nav state
   machine (`toggleMenu`/`hoverMenu`/`closeMenu`/`executeItem`/`onLabelKey`/`focusLabel`/
   `onDropdownKey`/`nextFocusable`/`_globalKey` + `anchorRefs`).
3. The **command handlers**: `newProject`/`loadProject`/`saveProject`/`saveToServer`/
   `browseServer`/`openExport`/`openRender`/`toggleGrid`/`toggleSnap`/`toggleCamera`/
   `groupSelected`/`updateName`/`showShortcuts`/`showAbout`.
4. The **New Project dialog**: a self-contained modal (its own form state, template picker,
   confirm/cancel logic incl. render-state reset + `importJSON`, and ~100 lines of `.np-*`
   styles).
5. The **center** (editable project name) + **right** controls (2D/3D, camera, grid, snap,
   stage dims, Render button) + brand.

## Goal

One clear responsibility per file. `Topbar.vue` becomes a thin orchestrator: brand + center
+ right controls + `<MenuBar>` + `<NewProjectDialog>`, owning the command handlers and the
resize/collapse logic. The menubar becomes a reusable widget driven by menu data; the dialog
becomes an independently testable modal; the menu data moves to a pure factory. Output is
**behaviorally identical** — guarded by a characterization snapshot + new per-unit tests.

## Non-Goals

- No visual/UX change. The bar renders identically (snapshot-locked).
- No change to the store, codegen, or any command's behavior (handlers move verbatim).
- Not extracting the brand / center-name / right-controls into their own components — they
  stay inline in the thin `Topbar.vue` (small, low-churn, orchestrator-owned).
- `Inspector.vue` and other large files are out of scope (separate work).

## Architecture

### 1. `topbar/menus.js` — declarative menu-data factory

A pure factory exporting `buildMenus(ctx)` that returns the menu array (the current `menus`
computed body, moved verbatim). `ctx` carries everything the item closures reference:

```js
// buildMenus(ctx) — ctx assembled by Topbar:
{
  mod, isMac, store,                                  // mod string, isMac bool, Pinia store
  isSaving, canGroup, gridVisible, snapEnabled, currentTheme,  // computed refs (item closures read .value)
  newProject, loadProject, saveProject, saveToServer, browseServer,
  openExport, openRender, showShortcuts, showAbout, toggleGrid, toggleSnap, groupSelected, // command fns
}
```

Item closures stay byte-identical (`action: () => loadProject()`, `disabled: () => isSaving.value`,
`checked: () => gridVisible.value`, `children: [{ action: () => store.setTheme('light'), … }]`).
`store.undo/redo/copySelection/pasteSelection/setTheme` are reached via `ctx.store`. Topbar
holds `const menus = computed(() => buildMenus({ … }))` (kept a `computed` for parity, though
the structure is effectively static with lazy reactive getters).

### 2. `topbar/MenuBar.vue` — the menubar widget

**Props:** `menus` (Array), `collapsed` (Boolean).
**Owns** all menu interaction state + handlers (moved verbatim): `openMenuId`, `focusIdx`,
`hoveredSub`, `anchorRefs`/`setAnchorRef`, the non-reactive `_hoverSwitchedAt`, and
`toggleMenu`/`hoverMenu`/`closeMenu`/`executeItem`/`onLabelKey`/`focusLabel`/`onDropdownKey`/
`nextFocusable`. **Template:** the desktop `<nav v-if="!collapsed">` block, the
`<div v-else>` collapsed hamburger block, AND the click-outside backdrop
(`<div v-if="openMenuId" class="menubar-backdrop">`) — all depend on this component's state.
The global Escape handler `_globalKey` + its `document.addEventListener` in
`onMounted`/`onBeforeUnmount` move here too (it only closes the menu). **Styles:** all
`.menu-*`, `.menubar-nav`, `.collapsed-dropdown`, `.menu-group-hdr`, `.mi-*`, `.radio-on`,
`.menu-sub*`, `.menu-pop*` transitions, and `.menubar-backdrop`.

> The `nav` template ref in the original is unused by logic (only `root` is observed) — it is
> dropped or carried as-is; it has no behavioral effect. (Implementer keeps markup verbatim;
> the unused `ref="nav"` simply moves with the `<nav>`.)

### 3. `topbar/NewProjectDialog.vue` — self-contained modal

**Props:** `show` (Boolean). **Emits:** `close`. **Owns** its form state (`newProjectName`,
`newProjectMode`, `newProjectTemplate`), `templates` (from `../../templates/index.js`), the
`npNameInput` ref, and `confirmNewProject`/`cancelNewProject` (moved verbatim, incl. the
template instantiation + render/playback-state reset + `importJSON`, reached via the store it
imports directly). On `show` → true it resets the fields (`name='My Animation'`, `mode='visual'`,
`template=null`) and focuses the name input (replicating the original `newProject()` pre-show
reset + the dialog's autofocus). `cancelNewProject` and a successful `confirmNewProject` both
`emit('close')`. **Template:** the `<!-- New Project dialog -->` `<transition>` block, verbatim,
with `showNewProjectDialog` → the `show` prop and the close paths emitting `close`. **Styles:**
all `.np-*` rules.

### 4. `Topbar.vue` — thin orchestrator

**Template:** `.menubar-root` (keeps `ref="root"`) → `<header>` with brand + `<MenuBar :menus="menus" :collapsed="collapsed" />`
+ center project-name + spacer + right controls; then `<NewProjectDialog :show="showNewProjectDialog" @close="showNewProjectDialog = false" />`.
**Script:** store; `isMac`/`mod`; the display computeds (`project`/`projectName`/`isDirty`/
`gridVisible`/`snapEnabled`/`stageW`/`stageH`/`isSaving`/`canGroup`/`currentTheme`/`isRendering`);
`collapsed` ref + `checkCollapse` + the `ResizeObserver` wiring in `onMounted`/`onBeforeUnmount`
(+ `store.setTheme(store.theme)` on mount stays here); `root` ref; `showNewProjectDialog` ref;
the command handlers (`newProject` now just does the dirty-check + `showNewProjectDialog = true`;
the rest verbatim); and `const menus = computed(() => buildMenus({ … }))`. **Styles:** brand
(`.menubar-brand`/`.brand-*`), `.menubar-header`/`.menubar-root`, `.menubar-center`/`.tb-title-label`/
`.tb-project-input`/`.tb-unsaved`, `.menubar-spacer`, `.menubar-right`/`.tb-*` (toggle, dim,
scene-type, divider, render-btn, play/spinner). (`.menu-*`/`.menubar-backdrop` → MenuBar;
`.np-*` → NewProjectDialog.)

## Resulting file layout

```
topbar/
  Topbar.vue          # thin orchestrator: brand + MenuBar + center + right + NewProjectDialog
  MenuBar.vue         # nav/dropdowns/submenu/hamburger/backdrop + keyboard nav (props: menus, collapsed)
  NewProjectDialog.vue# modal (props: show; emits: close); owns form + confirm/cancel
  menus.js            # buildMenus(ctx) → menu data array
```

## Testing

Topbar has no tests today; this adds the first. Mirrors the PropertiesPanel approach.

**Harness note (critical):** mounting `Topbar` needs two JSDOM shims —
1. `ResizeObserver` is absent in JSDOM and the component does `new ResizeObserver(...)` in
   `onMounted`; stub it globally (`vi.stubGlobal('ResizeObserver', class { observe(){} unobserve(){} disconnect(){} })`).
2. `collapsed` is derived from `root.clientWidth` (0 in JSDOM ⇒ collapsed=true). To snapshot
   the **desktop** nav, set a wide width before mount (e.g. `Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 })`), restore after.

1. **Characterization snapshot** (`tests/components/topbar/topbar.characterization.test.js`),
   captured FIRST against the current monolith and kept green/unchanged through every task.
   Same `norm()` as the inspector test (strip `data-v-*`, HTML comments, collapse whitespace).
   States: (a) desktop, menus closed (wide clientWidth); (b) collapsed hamburger (clientWidth 0);
   (c) New Project dialog open (set `showNewProjectDialog`/the dialog's `show` true). These cover
   brand + right controls + center + both menu variants + the dialog.
2. **Per-unit tests** (added during/after extraction):
   - `menus.js`: `buildMenus` with stub callbacks returns the 5 top-level menus with expected
     ids/labels; a `File→Open` item's `action()` invokes the injected `loadProject`; `Edit→Group`
     `disabled()` reflects the injected `canGroup`.
   - `NewProjectDialog.vue`: mount with `show:true`; clicking **Create Project** with a name calls
     `store.newProject(name, 'visual')` (and emits `close`); **Cancel** emits `close` without mutating.
   - `MenuBar.vue`: mount with a small `menus` prop + `collapsed:false`; clicking a label opens its
     dropdown; clicking a normal item runs its `action` and closes.

Scoped CSS is NOT in the snapshot (JSDOM ignores it), so the `.menu-*`/`.np-*`/`.tb-*` style
moves between SFCs must be verified by hand (each rule lands in exactly one component, no
orphaned class usage) — the same lesson as the CanvasInspector `.obj-list-item` fix.

## Work order (green at every step)

1. Characterization snapshot baseline (with the ResizeObserver/clientWidth shims) → commit.
2. `menus.js` — extract `buildMenus`; Topbar imports it (`menus = computed(() => buildMenus({…}))`).
   Snapshot green.
3. `NewProjectDialog.vue` — extract modal (verbatim template + `.np-*` styles + confirm/cancel
   + form state); Topbar renders `<NewProjectDialog :show … @close …>` and `newProject()` shrinks
   to the dirty-check + open. Snapshot green.
4. `MenuBar.vue` — extract the nav/hamburger/backdrop + interaction state + keyboard nav +
   `.menu-*`/`.menubar-backdrop` styles + the `_globalKey` listener; Topbar renders
   `<MenuBar :menus :collapsed />`. Snapshot green.
5. Per-unit tests for the three new units.
6. Docs/memory: `CLAUDE.md` (note Topbar is decomposed; menu items live in `menus.js`) + a memory
   pointer (mirrors `properties-panel-decomposed`/`stagecanvas-decomposed`).

## Verification

- `cd services/web && npm run test:unit` (+ the new topbar tests) and `npm test` (engine) pass
  at every commit.
- The characterization snapshot is unchanged from the baseline through the final commit.
- `npm run build` succeeds (watch the Vue 3 `<template v-for>` key gotcha — the menu loops use
  `<template v-for :key>`; keep keys on the `<template>` tags when markup moves into MenuBar).

## Known constraints / accepted divergences

- The characterization snapshot is taken in JSDOM with shimmed `ResizeObserver`/`clientWidth`;
  the desktop vs collapsed split is driven by the mocked width. This captures rendered markup,
  not real layout/measurement behavior (the `ResizeObserver`-driven responsive collapse is
  covered only structurally, not by an actual resize).
- `confirmNewProject` moves into `NewProjectDialog` with its store-reset block verbatim — the
  dialog therefore imports the store directly (it is a stateful modal, not a pure presentational
  component). This is intentional: it keeps all New-Project concerns in one file.
