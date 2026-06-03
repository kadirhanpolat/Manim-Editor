<template>
  <div class="timeline-panel bg-studio-surface border-t border-studio-border flex flex-col flex-shrink-0" style="height: 230px;">
    <!-- Header bar with tabs -->
    <div class="h-10 flex items-center px-3 border-b border-studio-border flex-shrink-0 gap-2">
      <!-- Time display -->
      <div class="flex items-center gap-1.5 font-mono text-studio-text-muted">
        <span class="text-xs tabular-nums">{{ fmt(totalDuration) }}</span>
        <span class="text-[10px]">total</span>
      </div>

      <div class="flex-1"></div>

      <!-- Transform badge -->
      <button v-if="canTransform" class="transform-badge" @click="createTransform">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
        Transform A→B
      </button>

      <!-- Zoom -->
      <div class="flex items-center gap-1">
        <button class="text-studio-text-muted hover:text-studio-text text-xs px-1" @click="zoomOut">-</button>
        <span class="text-[10px] text-studio-text-muted w-10 text-center tabular-nums">{{ Math.round(pps) }}px/s</span>
        <button class="text-studio-text-muted hover:text-studio-text text-xs px-1" @click="zoomIn">+</button>
      </div>
    </div>

    <!-- ═════════ TIMELINE ═════════ -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Time ruler -->
      <div class="h-6 border-b border-studio-border/50 relative flex-shrink-0">
        <div class="absolute top-0 left-0 h-full" :style="{ width: totalW + 'px', marginLeft: labelW + 'px' }">
          <div v-for="tk in ticks" :key="tk.t" class="absolute top-0 h-full flex flex-col justify-end" :style="{ left: tk.x + 'px' }">
            <div class="w-px" :class="tk.major ? 'h-3 bg-studio-text-muted/30' : 'h-1.5 bg-studio-border'"></div>
            <span v-if="tk.major" class="text-[8px] text-studio-text-muted/60 ml-0.5 leading-none">{{ tk.label }}</span>
          </div>
        </div>
      </div>

      <!-- Object bars -->
      <div class="border-b border-studio-border/50 flex h-10 flex-shrink-0" v-if="objects.length > 0">
        <div class="flex-shrink-0 flex items-center px-2 bg-studio-bg/30 border-r border-studio-border/50 text-[10px] text-studio-text-muted font-medium" :style="{ width: labelW + 'px' }">
          Objects
        </div>
        <div class="flex-1 relative overflow-hidden">
          <div :style="{ width: totalW + 'px' }" class="h-full relative">
            <div
              v-for="obj in objects"
              :key="'bar-'+obj.id"
              class="obj-bar"
              :class="{ selected: isObjSelected(obj.id), dragging: draggingObjId === obj.id }"
              :style="objBarStyle(obj)"
              @mousedown.stop="startObjDrag(obj, $event)"
              @click.stop="selectObj(obj.id, $event)"
            >
              <div class="resize-handle left" @mousedown.stop="startObjResize(obj, 'left', $event)"></div>
              <span class="obj-bar-dot" :style="{ background: objColor(obj) }"></span>
              <span class="truncate">{{ obj.name }}</span>
              <div class="resize-handle right" @mousedown.stop="startObjResize(obj, 'right', $event)"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Animation tracks -->
      <div class="flex-1 overflow-y-auto overflow-x-hidden">
        <TimelineTrack
          v-for="track in visibleTracks"
          :key="track.id"
          :track="track"
          :pps="pps"
          :labelW="labelW"
        />

        <!-- Camera Track -->
        <div v-if="project.cameraType === 'moving'" class="timeline-row camera-track-row border-b border-studio-border/30 flex flex-shrink-0" style="height: 40px;">
          <div class="flex-shrink-0 flex items-center px-2 bg-studio-bg/30 border-r border-studio-border/50 text-[10px] text-violet-300 font-medium gap-1" :style="{ width: labelW + 'px' }">
            🎥 <span>Camera</span>
            <button class="ml-auto text-[10px] text-studio-accent hover:opacity-80 leading-none" @click="addCameraClip" title="Add camera clip at playhead">+</button>
          </div>
          <div class="flex-1 relative overflow-hidden">
            <div class="track-clips relative h-full" :style="{ width: totalW + 'px' }">
              <div
                v-for="clip in cameraClips"
                :key="clip.id"
                class="absolute top-1 h-6 rounded text-[9px] flex items-center justify-center px-1 cursor-pointer select-none border"
                :class="selectedClipId === clip.id ? 'bg-violet-500/50 border-violet-400' : 'bg-violet-500/20 border-violet-500/40 text-violet-200'"
                :style="{ left: (clip.startTime * pps) + 'px', width: Math.max(20, clip.duration * pps) + 'px' }"
                @click="selectCameraClip(clip.id)"
              >
                ×{{ (clip.params && clip.params.zoom || 1).toFixed(1) }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="totalClipCount === 0 && objects.length > 0" class="px-4 py-3 text-[10px] text-studio-text-muted/60 text-center">
          Select two objects and click "Transform" to create your first animation
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useProjectStore, SHAPE_COLORS } from '../../store/project.js';
import TimelineTrack from './TimelineTrack.vue';

const store = useProjectStore();

const pps = ref(80);
const labelW = ref(90);
const draggingObjId = ref(null);

const totalDuration = computed(() => store.computedDuration);
const objects = computed(() => store.project.objects);
const visibleTracks = computed(() => store.visibleTracks);
const canTransform = computed(() => store.selectedObjectIds.length === 2);
const totalClipCount = computed(() => { let c = 0; for (const t of store.project.tracks) c += t.clips.length; return c; });
const totalW = computed(() => totalDuration.value * pps.value + 50);
const project = computed(() => store.project);
const cameraClips = computed(() => store.project.cameraTrack || []);
const selectedClipId = computed(() => store.selectedClipId);
const ticks = computed(() => {
  const t = []; const iv = pps.value >= 100 ? 0.5 : 1; const miv = pps.value >= 100 ? 1 : 5;
  for (let s = 0; s <= totalDuration.value; s += iv) {
    t.push({ t: s, x: s * pps.value, major: Math.abs(s % miv) < 0.01 || Math.abs(s % miv - miv) < 0.01, label: fmt(s) });
  }
  return t;
});

function fmt(s) { const m = Math.floor(s / 60); const sec = s % 60; return m > 0 ? `${m}:${sec.toFixed(1).padStart(4, '0')}` : `${sec.toFixed(1)}s`; }

function zoomIn() { pps.value = Math.min(300, pps.value * 1.4); }
function zoomOut() { pps.value = Math.max(20, pps.value / 1.4); }

function objBarStyle(obj) {
  const enter = obj.enterTime || 0;
  const dur = obj.duration || 3;
  return { left: `${enter * pps.value}px`, width: `${Math.max(20, dur * pps.value)}px`, background: objColor(obj) + '20', borderColor: objColor(obj) + '60' };
}
function objColor(obj) { return SHAPE_COLORS[obj.type] || '#94a3b8'; }
function isObjSelected(id) { return store.selectedObjectIds.includes(id); }
function selectObj(id, e) { store.selectObject(id, e.shiftKey || e.ctrlKey); }

function startObjDrag(obj, e) {
  selectObj(obj.id, e);
  draggingObjId.value = obj.id;
  const startX = e.clientX;
  const startEnter = obj.enterTime || 0;

  const move = (ev) => {
    const dx = (ev.clientX - startX) / pps.value;
    const newEnter = Math.max(0, Math.round((startEnter + dx) * 10) / 10);
    store.updateObject(obj.id, { enterTime: newEnter });
  };
  const up = () => {
    draggingObjId.value = null;
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function startObjResize(obj, dir, e) {
  e.preventDefault();
  selectObj(obj.id, e);
  draggingObjId.value = obj.id;
  const startX = e.clientX;
  const startEnter = obj.enterTime || 0;
  const startDur = obj.duration || 3;

  const move = (ev) => {
    const dx = (ev.clientX - startX) / pps.value;
    if (dir === 'left') {
      const newEnter = Math.max(0, Math.round((startEnter + dx) * 10) / 10);
      const newDur = Math.max(0.1, Math.round((startDur - dx) * 10) / 10);
      store.updateObject(obj.id, { enterTime: newEnter, duration: newDur });
    } else {
      const newDur = Math.max(0.1, Math.round((startDur + dx) * 10) / 10);
      store.updateObject(obj.id, { duration: newDur });
    }
  };
  const up = () => {
    draggingObjId.value = null;
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function createTransform() {
  const clip = store.createTransform();
  if (clip) store.selectClip(clip.id);
}

function addCameraClip() {
  store.addCameraMoveClip({});
  store.selectedClipId = store.project.cameraTrack[store.project.cameraTrack.length - 1]?.id || null;
}
function selectCameraClip(clipId) {
  store.selectedClipId = clipId;
  store.selectedObjectIds = [];
}
</script>

<style scoped>
.transform-badge {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold;
  @apply bg-purple-600 text-white hover:bg-purple-500 transition-colors;
  @apply shadow-lg shadow-purple-600/20;
}

.obj-bar {
  @apply absolute top-1 bottom-1 rounded-md border flex items-center gap-1 px-1.5 text-[9px] font-medium text-studio-text-muted;
  @apply cursor-grab hover:brightness-125 transition-all;
}
.obj-bar.dragging { @apply cursor-grabbing; }
.obj-bar.selected { @apply ring-1 ring-white/50; }
.obj-bar-dot { @apply w-1.5 h-1.5 rounded-full flex-shrink-0; }

.obj-bar .resize-handle {
  @apply absolute top-0 bottom-0 w-2 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity z-10;
}
.obj-bar .resize-handle.left { @apply left-0; background: linear-gradient(90deg, rgba(255,255,255,0.3), transparent); }
.obj-bar .resize-handle.right { @apply right-0; background: linear-gradient(270deg, rgba(255,255,255,0.3), transparent); }
.obj-bar:hover .resize-handle { @apply opacity-50; }

</style>
