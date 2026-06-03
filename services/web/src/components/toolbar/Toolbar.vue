<template>
  <aside class="w-12 bg-studio-surface border-r border-studio-border flex flex-col items-center py-2 gap-1 flex-shrink-0">
    <!-- Tools Section -->
    <div class="flex flex-col items-center gap-1 pb-2 border-b border-studio-border w-full px-1">
      <button
        v-for="tool in tools"
        :key="tool.id"
        class="tool-btn"
        :class="{ active: activeTool === tool.id }"
        :data-tooltip="tool.label + ' (' + tool.shortcut + ')'"
        @click="setTool(tool.id)"
      >
        <span v-html="tool.icon" class="text-base"></span>
      </button>
    </div>

    <!-- Shapes Section -->
    <div class="flex flex-col items-center gap-1 pt-2 w-full px-1">
      <span class="text-[9px] text-studio-text-muted uppercase tracking-widest mb-1">Shapes</span>
      <button
        v-for="shape in shapes"
        :key="shape.type"
        class="tool-btn shape-btn"
        :data-tooltip="shape.label"
        @click="addShape(shape.type)"
      >
        <span v-html="shape.icon" class="text-base"></span>
      </button>
    </div>

    <!-- 3D Shapes Section (shown in 3D mode) -->
    <div v-if="is3DMode" class="flex flex-col items-center gap-1 pt-2 border-t border-studio-border w-full px-1">
      <span class="text-[9px] text-studio-text-muted uppercase tracking-widest mb-1">3D</span>
      <button
        v-for="shape in shapes3D"
        :key="shape.type"
        class="tool-btn shape-btn"
        :data-tooltip="shape.label"
        @click="addShape(shape.type)"
      >
        <span v-html="shape.icon" class="text-base"></span>
      </button>
    </div>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Transform button -->
    <div class="border-t border-studio-border pt-2 w-full px-1 flex flex-col items-center gap-1">
      <button
        class="tool-btn"
        :class="{ 'opacity-40 cursor-not-allowed': !canTransform, 'pulse-glow': canTransform }"
        :disabled="!canTransform"
        data-tooltip="Transform (select 2 objects)"
        @click="createTransform"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 3l4 4-4 4"/>
          <path d="M3 11V9a4 4 0 014-4h14"/>
          <path d="M7 21l-4-4 4-4"/>
          <path d="M21 13v2a4 4 0 01-4 4H3"/>
        </svg>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';

const store = useProjectStore();

const is3DMode = computed(() => store.project?.sceneType === '3d');

const tools = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>' },
  { id: 'hand', label: 'Hand / Pan', shortcut: 'H', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 00-4 0v5M14 10V4a2 2 0 00-4 0v6M10 10.5V5a2 2 0 00-4 0v9"/><path d="M18 11a2 2 0 014 0v3a8 8 0 01-8 8h-2c-2.5 0-4-1-5.5-2.5L3 16"/></svg>' },
  { id: 'scale', label: 'Scale', shortcut: 'S', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>' },
  { id: 'rotate', label: 'Rotate', shortcut: 'R', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>' }
];

const shapes = [
  { type: 'heart', label: 'Heart', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' },
  { type: 'square', label: 'Square', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>' },
  { type: 'circle', label: 'Circle', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' },
  { type: 'dot', label: 'Dot', icon: '<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>' },
  { type: 'dot_grid', label: 'Dot Grid', icon: '<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="4" cy="4" r="1.5" fill="currentColor"/><circle cx="12" cy="4" r="1.5" fill="currentColor"/><circle cx="20" cy="4" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="20" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="20" r="1.5" fill="currentColor"/><circle cx="12" cy="20" r="1.5" fill="currentColor"/><circle cx="20" cy="20" r="1.5" fill="currentColor"/></svg>' }
];

const shapes3D = [
  { type: 'sphere',   label: 'Sphere',   icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="4"/><line x1="3" y1="12" x2="21" y2="12"/></svg>' },
  { type: 'cube',     label: 'Cube',     icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' },
  { type: 'cone',     label: 'Cone',     icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L3 20h18L12 2z"/><ellipse cx="12" cy="20" rx="9" ry="2"/></svg>' },
  { type: 'cylinder', label: 'Cylinder', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/></svg>' },
  { type: 'torus',    label: 'Torus',    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="3" ry="1.5"/></svg>' },
  { type: 'axes3d',   label: 'Axes 3D',  icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="4"/><line x1="4" y1="20" x2="20" y2="20"/><line x1="12" y1="12" x2="4" y2="16"/></svg>' },
];

const activeTool = computed(() => store.activeTool);
const canTransform = computed(() => store.selectedObjectIds.length === 2);

function setTool(toolId) {
  store.setActiveTool(toolId);
}

function addShape(type) {
  const stage = store.project.stage;
  const obj = store.addObject(type, stage.width / 2, stage.height / 2);
  store.selectObject(obj.id);
}

function createTransform() {
  if (!canTransform.value) return;
  const clip = store.createTransform();
  if (clip) {
    store.selectClip(clip.id);
  }
}
</script>
