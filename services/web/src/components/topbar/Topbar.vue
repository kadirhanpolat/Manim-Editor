<template>
  <div ref="root" class="menubar-root">
    <header class="menubar-header" aria-label="Application toolbar">
      <!-- Brand: official logo from assets (public folder) -->
      <div class="menubar-brand">
        <img
          src="/ManimMotionLogoNoTextNoBG.svg"
          alt=""
          class="brand-logo"
          width="24"
          height="24"
        />
        <span class="brand-name">Manim</span>
        <span class="brand-sub">Motion</span>
      </div>

      <MenuBar :menus="menus" :collapsed="collapsed" />

      <!-- Center: editable project name (absolute so it stays visually centered) -->
      <div class="menubar-center">
        <span class="tb-title-label">title:</span>
        <input
          class="tb-project-input"
          :value="projectName"
          placeholder="Project name"
          title="Project name"
          aria-label="Project name"
          @change="updateName(($event.target as HTMLInputElement).value)"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
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
          title="Toggle 2D/3D scene mode"
          @click="store.setSceneType(project.sceneType === '3d' ? '2d' : '3d')"
        >
          {{ project.sceneType === '3d' ? '3D' : '2D' }}
        </button>
        <button
          class="tb-toggle"
          :class="{ on: project.cameraType === 'moving' }"
          title="Toggle Moving Camera (MovingCameraScene)"
          aria-label="Toggle Moving Camera (MovingCameraScene)"
          @click="toggleCamera"
        >
          🎥
        </button>
        <button
          class="tb-toggle"
          :class="{ on: gridVisible }"
          title="Grid"
          aria-label="Grid"
          @click="toggleGrid"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="18" height="18" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
        <button
          class="tb-toggle"
          :class="{ on: snapEnabled }"
          title="Snap"
          aria-label="Snap"
          @click="toggleSnap"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 3L3 21" />
            <path d="M21 3v7h-7" />
          </svg>
        </button>
        <span class="tb-dim">{{ stageW }}&times;{{ stageH }}</span>
        <button
          class="tb-render-btn"
          :class="{ busy: isRendering }"
          :disabled="isRendering"
          title="Render HQ via Docker"
          @click="openRender"
        >
          <svg
            v-if="!isRendering"
            class="tb-play-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg
            v-else
            class="tb-render-spin tb-spinner-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke-dasharray="45 20" />
          </svg>
          <span class="tb-render-label">Render</span>
        </button>
      </div>
    </header>

    <!-- New Project dialog -->
    <NewProjectDialog :show="showNewProjectDialog" @close="showNewProjectDialog = false" />
    <ProjectSnapshotsDialog
      :show="showProjectSnapshotsDialog"
      @close="showProjectSnapshotsDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useProjectStore } from '../../store/project.js';
import { generateManimScript } from '../../export/manim.js';
import { buildMenus } from './menus.js';
import NewProjectDialog from './NewProjectDialog.vue';
import ProjectSnapshotsDialog from './ProjectSnapshotsDialog.vue';
import MenuBar from './MenuBar.vue';

const store = useProjectStore();

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

// Reactive state
const collapsed = ref(false);
const showNewProjectDialog = ref(false);
const showProjectSnapshotsDialog = ref(false);

// Non-reactive instance vars
let _resizeObs: ResizeObserver | null = null;

// Template refs
const root = ref<HTMLDivElement | null>(null);

// Computed store properties
const project = computed(() => store.project);
const projectName = computed(() => store.project.name);
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

const menus = computed(() =>
  buildMenus({
    mod,
    isMac,
    store,
    isSaving,
    canGroup,
    gridVisible,
    snapEnabled,
    currentTheme,
    newProject,
    loadProject,
    loadPackage,
    saveProject,
    savePackage,
    saveToServer,
    browseServer,
    openSnapshots,
    openExport,
    openRender,
    showShortcuts,
    showAbout,
    toggleGrid,
    toggleSnap,
    groupSelected,
  })
);

onMounted(() => {
  checkCollapse();
  _resizeObs = new ResizeObserver(() => checkCollapse());
  if (root.value) _resizeObs.observe(root.value);
  store.setTheme(store.theme);
});

onBeforeUnmount(() => {
  if (_resizeObs) _resizeObs.disconnect();
});

function checkCollapse() {
  const w = root.value ? root.value.clientWidth : window.innerWidth;
  collapsed.value = w < 640;
}

// ── Actions ──
function updateName(name: string) {
  store.project.name = name.trim() || 'My Animation';
  store.isDirty = true;
}
function toggleGrid() {
  store.toggleGrid();
}
function toggleSnap() {
  store.toggleSnap();
}
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
async function loadPackage() {
  if (store.isDirty && !confirm('Discard unsaved changes?')) return;
  await store.loadPackageFromFile();
}
function saveProject() {
  store.saveToFile();
}
function savePackage() {
  store.savePackageToFile();
}

async function saveToServer() {
  try {
    const ok = await store.checkApi();
    if (!ok) {
      store.setError('Server not available. Make sure Docker is running.');
      return;
    }
    await store.saveToServer();
  } catch {
    // ignore
  }
}
function browseServer() {
  store.showProjectBrowser = true;
  store.listServerProjects();
}
function openSnapshots() {
  showProjectSnapshotsDialog.value = true;
}
function openExport() {
  if (store.project.editorMode === 'code') {
    if (!store.project.codeSource || store.project.codeSource.trim().length === 0) {
      store.setError('Write some Manim code first!');
      return;
    }
    store.exportCode = store.project.codeSource;
  } else {
    if (store.project.objects.length === 0) {
      store.setError('Add some objects to the stage first!');
      return;
    }
    store.exportCode = generateManimScript(store.project);
  }
  store.showExportDialog = true;
}
function openRender() {
  if (store.hasPendingAudio) {
    store.setError('Audio generation is still in progress. Please wait before rendering.');
    return;
  }
  if (store.project.editorMode === 'code') {
    if (!store.project.codeSource || store.project.codeSource.trim().length === 0) {
      store.setError('Write some Manim code first!');
      return;
    }
  } else {
    if (store.project.objects.length === 0) {
      store.setError('Add some objects to the stage first!');
      return;
    }
  }
  store.showRenderDialog = true;
}

function showShortcuts() {
  store.setError(
    'Shortcuts: V=Select, H=Hand, Space=Play, Del=Delete, ' +
      (isMac ? '⌘' : 'Ctrl+') +
      'Z=Undo, ' +
      (isMac ? '⇧⌘Z' : 'Ctrl+Y') +
      '=Redo, ' +
      (isMac ? '⌘' : 'Ctrl+') +
      'C/V=Copy/Paste, ' +
      (isMac ? '⌘' : 'Ctrl+') +
      'G=Group, ' +
      (isMac ? '⌘' : 'Ctrl+') +
      'K=Command Palette, ' +
      (isMac ? '⌘' : 'Ctrl+') +
      'S=Save'
  );
}
function showAbout() {
  store.setError('Manim Motion — Visual animation editor powered by Manim');
}
</script>

<style scoped>
.menubar-root {
  position: relative;
  flex-shrink: 0;
}

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
.brand-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--studio-text);
  letter-spacing: -0.3px;
}
.brand-sub {
  font-size: 13px;
  font-weight: 400;
  color: var(--studio-text-secondary);
  letter-spacing: -0.3px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: var(--studio-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.1s;
}
.tb-toggle:hover {
  background: var(--studio-border);
  color: var(--studio-text);
}
.tb-toggle.on {
  background: var(--studio-accent-subtle);
  color: var(--studio-accent);
}

.tb-dim {
  font-size: 9px;
  color: var(--studio-text-muted);
  font-family: var(--font-mono, monospace);
}
.tb-scene-type {
  width: auto;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.tb-divider {
  width: 1px;
  height: 14px;
  background: var(--studio-border);
}

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
  transition:
    background 0.15s,
    opacity 0.15s;
}
.tb-render-btn:hover:not(:disabled) {
  background: var(--studio-success-hover);
}
.tb-render-btn:disabled {
  opacity: 0.8;
  cursor: default;
}
.tb-render-btn.busy {
  background: var(--studio-text-muted);
}
.tb-play-icon,
.tb-spinner-icon {
  flex-shrink: 0;
}
.tb-render-label {
  white-space: nowrap;
}
.tb-render-spin {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.tb-project-input {
  background: var(--studio-surface);
  border: 1px solid var(--studio-border);
  font-size: 13px;
  font-weight: 500;
  color: var(--studio-text);
  width: 120px;
  padding: 4px 8px;
  border-radius: 4px;
  transition:
    background 0.1s,
    border-color 0.1s;
  outline: none;
}
.tb-project-input::placeholder {
  color: var(--studio-text-muted);
}
.tb-project-input:hover {
  background: var(--studio-surface2);
  border-color: var(--studio-border);
}
.tb-project-input:focus {
  background: var(--studio-surface2);
  border-color: var(--studio-accent);
  box-shadow: 0 0 0 2px rgb(var(--c-accent) / 0.2);
}

.tb-unsaved {
  font-size: 9px;
  font-weight: 600;
  color: var(--studio-warning);
}
</style>
