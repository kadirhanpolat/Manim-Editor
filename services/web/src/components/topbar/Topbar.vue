<template>
  <div class="menubar-root" ref="root">
    <header class="menubar-header">
      <!-- Brand: official logo from assets (public folder) -->
      <div class="menubar-brand">
        <img src="/ManimMotionLogoNoTextNoBG.svg" alt="" class="brand-logo" width="24" height="24" />
        <span class="brand-name">Manim</span>
        <span class="brand-sub">Motion</span>
      </div>

      <!-- Desktop nav -->
      <nav v-if="!collapsed" class="menubar-nav" role="menubar" ref="nav">
        <div
          v-for="(menu, mi) in menus"
          :key="menu.id"
          class="menu-anchor"
          :ref="(el) => setAnchorRef(menu.id, el)"
        >
          <button
            class="menu-label"
            :class="{ active: openMenuId === menu.id }"
            @click.stop="toggleMenu(menu.id)"
            @mouseenter="hoverMenu(menu.id)"
            @keydown="onLabelKey($event, mi)"
            tabindex="0"
            role="menuitem"
            :aria-haspopup="true"
            :aria-expanded="openMenuId === menu.id"
          >{{ menu.label }}</button>

          <!-- Dropdown -->
          <transition name="menu-pop">
            <div
              v-if="openMenuId === menu.id"
              class="menu-dropdown"
              role="menu"
              @keydown="onDropdownKey($event, mi)"
            >
              <template v-for="(item, idx) in menu.items" :key="item.id || ('s' + idx)">
                <div v-if="item.type === 'separator'" class="menu-sep"></div>

                <!-- Submenu (e.g. Theme) -->
                <div
                  v-else-if="item.type === 'submenu'"
                  class="menu-sub-anchor"
                  @mouseenter="hoveredSub = item.id"
                  @mouseleave="hoveredSub = null"
                >
                  <button
                    class="menu-item"
                    :class="{ focused: focusIdx === idx }"
                    @mouseenter="focusIdx = idx"
                    role="menuitem"
                    aria-haspopup="true"
                  >
                    <span class="mi-label">{{ item.label }}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="mi-arrow"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  <div v-if="hoveredSub === item.id" class="menu-submenu">
                    <button
                      v-for="sub in item.children"
                      :key="sub.id"
                      class="menu-item"
                      :class="{ 'radio-on': sub.active && sub.active() }"
                      @click="executeItem(sub)"
                      role="menuitemradio"
                      :aria-checked="sub.active ? sub.active() : undefined"
                    >
                      <span class="mi-radio">{{ sub.active && sub.active() ? '◉' : '○' }}</span>
                      <span class="mi-label">{{ sub.label }}</span>
                    </button>
                  </div>
                </div>

                <!-- Toggle item (Grid/Snap) -->
                <button
                  v-else-if="item.type === 'toggle'"
                  class="menu-item"
                  :class="{ focused: focusIdx === idx }"
                  @click="executeItem(item)"
                  @mouseenter="focusIdx = idx"
                  role="menuitemcheckbox"
                  :aria-checked="item.checked ? item.checked() : false"
                >
                  <span class="mi-check">{{ item.checked && item.checked() ? '✓' : '' }}</span>
                  <span class="mi-label">{{ item.label }}</span>
                  <span v-if="item.shortcut" class="mi-shortcut">{{ item.shortcut }}</span>
                </button>

                <!-- Normal item -->
                <button
                  v-else
                  class="menu-item"
                  :class="{ disabled: item.disabled && item.disabled(), focused: focusIdx === idx }"
                  :disabled="item.disabled && item.disabled()"
                  @click="executeItem(item)"
                  @mouseenter="focusIdx = idx"
                  role="menuitem"
                >
                  <span class="mi-label">{{ item.label }}</span>
                  <span v-if="item.shortcut" class="mi-shortcut">{{ item.shortcut }}</span>
                </button>
              </template>
            </div>
          </transition>
        </div>
      </nav>

      <!-- Collapsed hamburger -->
      <div v-else class="menu-anchor" ref="collapsedAnchor">
        <button class="menu-label" :class="{ active: openMenuId === '_collapsed' }" @click.stop="toggleMenu('_collapsed')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          Menu
        </button>
        <transition name="menu-pop">
          <div v-if="openMenuId === '_collapsed'" class="menu-dropdown collapsed-dropdown" role="menu">
            <template v-for="menu in menus" :key="menu.id">
              <div class="menu-group-hdr">{{ menu.label }}</div>
              <template v-for="(item, idx) in menu.items" :key="item.id || (menu.id + 's' + idx)">
                <div v-if="item.type === 'separator'" class="menu-sep"></div>
                <button
                  v-else-if="item.type !== 'submenu'"
                  class="menu-item"
                  :disabled="item.disabled && item.disabled()"
                  @click="executeItem(item)"
                  role="menuitem"
                >
                  <span v-if="item.type === 'toggle'" class="mi-check">{{ item.checked && item.checked() ? '✓' : '' }}</span>
                  <span class="mi-label">{{ item.label }}</span>
                  <span v-if="item.shortcut" class="mi-shortcut">{{ item.shortcut }}</span>
                </button>
              </template>
            </template>
          </div>
        </transition>
      </div>

      <!-- Center: editable project name (absolute so it stays visually centered) -->
      <div class="menubar-center">
        <span class="tb-title-label">title:</span>
        <input
          class="tb-project-input"
          :value="projectName"
          @change="updateName($event.target.value)"
          @keydown.enter="$event.target.blur()"
          placeholder="Project name"
          title="Project name"
        />
        <span v-if="isDirty" class="tb-unsaved">unsaved</span>
      </div>

      <!-- Spacer so right section stays at the end -->
      <div class="menubar-spacer"></div>

      <!-- Right: secondary controls + render button -->
      <div class="menubar-right">
        <div class="tb-divider"></div>
        <button
          v-if="project && project.editorMode === 'visual'"
          class="tb-toggle tb-scene-type"
          :class="{ on: project.sceneType === '3d' }"
          @click="store.setSceneType(project.sceneType === '3d' ? '2d' : '3d')"
          title="Toggle 2D/3D scene mode"
        >{{ project.sceneType === '3d' ? '3D' : '2D' }}</button>
        <button class="tb-toggle" :class="{ on: project.cameraType === 'moving' }" @click="toggleCamera" title="Toggle Moving Camera (MovingCameraScene)">🎥</button>
        <button class="tb-toggle" :class="{ on: gridVisible }" @click="toggleGrid" title="Grid">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>
        <button class="tb-toggle" :class="{ on: snapEnabled }" @click="toggleSnap" title="Snap">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 3L3 21"/><path d="M21 3v7h-7"/></svg>
        </button>
        <span class="tb-dim">{{ stageW }}&times;{{ stageH }}</span>
        <button
          class="tb-render-btn"
          :class="{ busy: isRendering }"
          :disabled="isRendering"
          @click="openRender"
          title="Render HQ via Docker"
        >
          <svg v-if="!isRendering" class="tb-play-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          <svg v-else class="tb-render-spin tb-spinner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-dasharray="45 20"/></svg>
          <span class="tb-render-label">Render</span>
        </button>
      </div>
    </header>

    <!-- Backdrop to close menus on click-outside -->
    <div v-if="openMenuId" class="menubar-backdrop" @mousedown="closeMenu"></div>

    <!-- New Project dialog -->
    <NewProjectDialog :show="showNewProjectDialog" @close="showNewProjectDialog = false" />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useProjectStore } from '../../store/project.js';
import { generateManimScript } from '../../export/manim.js';
import { buildMenus } from './menus.js';
import NewProjectDialog from './NewProjectDialog.vue';

const store = useProjectStore();

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

// Reactive state
const openMenuId = ref(null);
const focusIdx = ref(-1);
const hoveredSub = ref(null);
const collapsed = ref(false);
const showNewProjectDialog = ref(false);

// Non-reactive instance vars
let _resizeObs = null;
let _hoverSwitchedAt = null;

// Template refs
const root = ref(null);

// Dynamic anchor refs
const anchorRefs = reactive({});
function setAnchorRef(id, el) {
  if (el) anchorRefs[id] = el;
  else delete anchorRefs[id];
}

// Computed store properties
const project = computed(() => store.project);
const projectName = computed(() => store.project.name);
const projectId = computed(() => store.project.id);
const isDirty = computed(() => store.isDirty);
const gridVisible = computed(() => store.project.stage.gridVisible);
const snapEnabled = computed(() => store.project.stage.snapEnabled);
const stageW = computed(() => store.project.stage.width);
const stageH = computed(() => store.project.stage.height);
const isSaving = computed(() => store.savingToServer);
const canGroup = computed(() => store.selectedObjectIds.length >= 2);
const currentTheme = computed(() => store.theme);

const isRendering = computed(() => {
  const s = store.renderStatus;
  return s === 'uploading' || s === 'saving' || s === 'queued' || s === 'running';
});

const menus = computed(() => buildMenus({
  mod, isMac, store,
  isSaving, canGroup, gridVisible, snapEnabled, currentTheme,
  newProject, loadProject, saveProject, saveToServer, browseServer,
  openExport, openRender, showShortcuts, showAbout, toggleGrid, toggleSnap, groupSelected,
}));

onMounted(() => {
  checkCollapse();
  _resizeObs = new ResizeObserver(() => checkCollapse());
  if (root.value) _resizeObs.observe(root.value);
  document.addEventListener('keydown', _globalKey);
  store.setTheme(store.theme);
});

onBeforeUnmount(() => {
  if (_resizeObs) _resizeObs.disconnect();
  document.removeEventListener('keydown', _globalKey);
});

function checkCollapse() {
  const w = root.value ? root.value.clientWidth : window.innerWidth;
  collapsed.value = w < 640;
}

// ── Menu interaction ──
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

// ── Keyboard: label navigation ──
function onLabelKey(e, menuIndex) {
  const ids = menus.value.map(m => m.id);
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
  const id = menus.value[index]?.id;
  if (!id) return;
  nextTick(() => {
    const el = anchorRefs[id];
    const btn = el?.querySelector('button');
    if (btn) btn.focus();
  });
}

// ── Keyboard: dropdown navigation ──
function onDropdownKey(e, menuIndex) {
  const menu = menus.value[menuIndex];
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
    const next = (menuIndex + 1) % menus.value.length;
    openMenuId.value = menus.value[next].id;
    focusIdx.value = -1;
    focusLabel(next);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = (menuIndex - 1 + menus.value.length) % menus.value.length;
    openMenuId.value = menus.value[prev].id;
    focusIdx.value = -1;
    focusLabel(prev);
  }
}
function nextFocusable(current, dir, items) {
  const menu = items || (menus.value.find(m => m.id === openMenuId.value)?.items) || [];
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

// ── Actions ──
function updateName(name) { store.project.name = name.trim() || 'My Animation'; store.isDirty = true; }
function toggleGrid()     { store.toggleGrid(); }
function toggleSnap()     { store.toggleSnap(); }
function toggleCamera() {
  const next = store.project.cameraType === 'moving' ? 'static' : 'moving';
  store.setCameraType(next);
}

function groupSelected() {
  if (!canGroup.value) return;
  store.groupObjects([...store.selectedObjectIds]);
}

function newProject() {
  if (store.isDirty && !confirm('Discard unsaved changes?')) return;
  showNewProjectDialog.value = true;
}
async function loadProject() {
  if (store.isDirty && !confirm('Discard unsaved changes?')) return;
  await store.loadFromFile();
}
function saveProject() { store.saveToFile(); }

async function saveToServer() {
  try {
    const ok = await store.checkApi();
    if (!ok) { store.setError('Server not available. Make sure Docker is running.'); return; }
    await store.saveToServer();
  } catch {}
}
function browseServer() {
  store.showProjectBrowser = true;
  store.listServerProjects();
}
function openExport() {
  if (store.project.editorMode === 'code') {
    if (!store.project.codeSource || store.project.codeSource.trim().length === 0) {
      store.setError('Write some Manim code first!'); return;
    }
    store.exportCode = store.project.codeSource;
  } else {
    if (store.project.objects.length === 0) { store.setError('Add some objects to the stage first!'); return; }
    store.exportCode = generateManimScript(store.project);
  }
  store.showExportDialog = true;
}
function openRender() {
  if (store.hasPendingAudio) {
    store.setError('Audio generation is still in progress. Please wait before rendering.'); return;
  }
  if (store.project.editorMode === 'code') {
    if (!store.project.codeSource || store.project.codeSource.trim().length === 0) {
      store.setError('Write some Manim code first!'); return;
    }
  } else {
    if (store.project.objects.length === 0) { store.setError('Add some objects to the stage first!'); return; }
  }
  store.showRenderDialog = true;
}

function showShortcuts() {
  store.setError(
    'Shortcuts: V=Select, H=Hand, Space=Play, Del=Delete, ' +
    (isMac ? '⌘' : 'Ctrl+') + 'Z=Undo, ' +
    (isMac ? '⇧⌘Z' : 'Ctrl+Y') + '=Redo, ' +
    (isMac ? '⌘' : 'Ctrl+') + 'C/V=Copy/Paste, ' +
    (isMac ? '⌘' : 'Ctrl+') + 'G=Group, ' +
    (isMac ? '⌘' : 'Ctrl+') + 'S=Save'
  );
}
function showAbout() {
  store.setError('Manim Motion — Visual animation editor powered by Manim');
}
</script>

<style scoped>
.menubar-root { position: relative; flex-shrink: 0; }

.menubar-header {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 2px;
  background: var(--studio-surface);
  border-bottom: 1px solid var(--studio-border);
  position: relative;
  z-index: 200;
}

/* ── Brand ── */
.menubar-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 10px;
  flex-shrink: 0;
}
.brand-logo {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  object-fit: contain;
}
.brand-name { font-size: 13px; font-weight: 700; color: var(--studio-text); letter-spacing: -0.3px; }
.brand-sub  { font-size: 13px; font-weight: 400; color: var(--studio-text-secondary); letter-spacing: -0.3px; }

/* ── Menu labels ── */
.menubar-nav { display: flex; align-items: center; gap: 1px; }
.menu-anchor { position: relative; }

.menu-label {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--studio-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  display: flex;
  align-items: center;
  gap: 5px;
  outline: none;
  white-space: nowrap;
}
.menu-label:hover { background: var(--studio-border); color: var(--studio-text); }
.menu-label.active { background: var(--studio-border); color: var(--studio-text); }
.menu-label:focus-visible { box-shadow: 0 0 0 2px var(--studio-focus-ring); }

/* ── Dropdown ── */
.menu-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  min-width: 200px;
  background: var(--studio-surface3);
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  z-index: 201;
}
.collapsed-dropdown { min-width: 240px; max-height: 70vh; overflow-y: auto; }

.menu-group-hdr {
  padding: 6px 10px 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--studio-text-muted);
}

.menu-sep { height: 1px; margin: 4px 8px; background: var(--studio-divider); }

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
.menu-item:hover, .menu-item.focused { background: var(--studio-accent-subtle); }
.menu-item.disabled { opacity: 0.4; cursor: default; pointer-events: none; }
.menu-item:focus-visible { box-shadow: inset 0 0 0 2px var(--studio-focus-ring); }

.mi-label  { flex: 1; white-space: nowrap; }
.mi-shortcut {
  font-size: 10px;
  color: var(--studio-text-muted);
  margin-left: auto;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}
.mi-check { width: 14px; text-align: center; font-size: 11px; color: var(--studio-accent); flex-shrink: 0; }
.mi-radio { width: 14px; text-align: center; font-size: 12px; color: var(--studio-accent); flex-shrink: 0; }
.mi-arrow { flex-shrink: 0; opacity: 0.5; }

.radio-on .mi-radio { color: var(--studio-accent); }

/* ── Submenu ── */
.menu-sub-anchor { position: relative; }
.menu-submenu {
  position: absolute;
  left: calc(100% + 2px);
  top: -4px;
  min-width: 140px;
  background: var(--studio-surface3);
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  z-index: 202;
}

/* ── Center: editable project name (truly centered in header) ── */
.menubar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}
.menubar-center .tb-title-label,
.menubar-center .tb-project-input,
.menubar-center .tb-unsaved {
  pointer-events: auto;
}

.tb-title-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--studio-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.menubar-spacer {
  flex: 1;
  min-width: 0;
}

/* ── Right section ── */
.menubar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.tb-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 4px;
  color: var(--studio-text-muted);
  background: transparent; border: none; cursor: pointer;
  transition: all 0.1s;
}
.tb-toggle:hover { background: var(--studio-border); color: var(--studio-text); }
.tb-toggle.on { background: var(--studio-accent-subtle); color: var(--studio-accent); }

.tb-dim { font-size: 9px; color: var(--studio-text-muted); font-family: var(--font-mono, monospace); }
.tb-scene-type { width: auto; padding: 0 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
.tb-divider { width: 1px; height: 14px; background: var(--studio-border); }

.tb-render-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--studio-success);
  border: none;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.tb-render-btn:hover:not(:disabled) {
  background: var(--studio-success-hover);
}
.tb-render-btn:disabled {
  opacity: 0.8;
  cursor: default;
}
.tb-render-btn.busy { background: var(--studio-text-muted); }
.tb-play-icon, .tb-spinner-icon { flex-shrink: 0; }
.tb-render-label { white-space: nowrap; }
.tb-render-spin { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.tb-project-input {
  background: var(--studio-surface);
  border: 1px solid var(--studio-border);
  font-size: 13px;
  font-weight: 500;
  color: var(--studio-text);
  width: 120px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.1s, border-color 0.1s;
  outline: none;
}
.tb-project-input::placeholder {
  color: var(--studio-text-muted);
}
.tb-project-input:hover { background: var(--studio-surface2); border-color: var(--studio-border); }
.tb-project-input:focus { background: var(--studio-surface2); border-color: var(--studio-accent); box-shadow: 0 0 0 2px rgb(var(--c-accent) / 0.2); }

.tb-unsaved { font-size: 9px; font-weight: 600; color: var(--studio-warning); }

/* ── Backdrop ── */
.menubar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
  background: transparent;
}

/* ── Transitions ── */
.menu-pop-enter-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.menu-pop-leave-active { transition: opacity 0.08s ease; }
.menu-pop-enter { opacity: 0; transform: translateY(-4px); }
.menu-pop-leave-to { opacity: 0; }

</style>
