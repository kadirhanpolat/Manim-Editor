<template>
  <div
    class="timeline-clip"
    :class="[typeClass, { selected: isSelected }]"
    :style="clipStyle"
    @mousedown.stop="onDown"
    @click.stop="select"
    @contextmenu.prevent="onContextMenu"
  >
    <div class="clip-inner">
      <span class="clip-icon" v-html="typeIcon"></span>
      <span class="clip-label">{{ label }}</span>
      <span
        v-if="clip.parallel"
        class="inline-block ml-1 px-1 text-[8px] rounded bg-violet-500/30 text-violet-300 leading-none align-middle"
        title="Parallel (AnimationGroup)"
        >∥</span
      >
    </div>
    <div class="resize-handle left" @mousedown.stop="resize('left', $event)"></div>
    <div class="resize-handle right" @mousedown.stop="resize('right', $event)"></div>
    <ContextMenu
      v-if="ctxMenu"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="ctxItems"
      @close="ctxMenu = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Clip } from '@manim/codegen';
import { useProjectStore } from '../../store/project.js';
import ContextMenu from '../stage/ContextMenu.vue';
import type { ContextMenuItem } from '../stage/ContextMenu.vue';

const props = defineProps({
  clip: { type: Object as () => Clip, required: true },
  pps: { type: Number, required: true },
});

const store = useProjectStore();

const ICONS = {
  transform:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M17 3l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/></svg>',
  move: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l3 3 3-3"/><path d="M19 9l3 3-3 3"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
  scale:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>',
  fade: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" opacity="0.5"/></svg>',
  rotate:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1014.85-3.36L23 8"/></svg>',
};

const isSelected = computed(() => store.selectedClipId === props.clip.id);
const label = computed(() => {
  const src = props.clip.sourceId ? store.objectById(props.clip.sourceId) : null;
  const tgt = props.clip.targetId ? store.objectById(props.clip.targetId) : null;
  if (props.clip.type === 'transform' && src && tgt) return `${src.name} → ${tgt.name}`;
  const labels: Record<string, string> = {
    transform: 'Transform',
    move: 'Move',
    scale: 'Scale',
    fade: 'Fade',
    rotate: 'Rotate',
  };
  let l = labels[props.clip.type] || props.clip.type;
  if (src) l += ` · ${src.name}`;
  return l;
});
const typeIcon = computed(() => (ICONS as Record<string, string>)[props.clip.type] || '');
const typeClass = computed(
  () =>
    (
      ({
        transform: 'clip-transform',
        move: 'clip-move',
        scale: 'clip-scale',
        fade: 'clip-fade',
        rotate: 'clip-rotate',
      }) as Record<string, string>
    )[props.clip.type] || 'clip-default'
);
const clipStyle = computed(() => ({
  left: `${props.clip.startTime * props.pps}px`,
  width: `${Math.max(28, props.clip.duration * props.pps)}px`,
}));

const ctxMenu = ref<{ x: number; y: number } | null>(null);

const ctxItems = computed<ContextMenuItem[]>(() => [
  { id: 'copy', label: 'Kopyala', action: () => store.copySelection() },
  { id: 'cut', label: 'Kes', action: () => store.cutSelection() },
  {
    id: 'paste',
    label: 'Yapıştır',
    action: () => store.pasteSelection(),
    disabled: store.clipboard.length === 0,
  },
  { id: 'dup', label: 'Çoğalt', action: () => store.duplicateSelection() },
  { id: 'sep1', separator: true },
  { id: 'split', label: 'Böl', action: () => store.splitClip(props.clip.id as string) },
  { id: 'sep2', separator: true },
  { id: 'delete', label: 'Sil', action: () => store.deleteClip(props.clip.id as string) },
]);

function onContextMenu(e: MouseEvent) {
  store.selectClip(props.clip.id ?? null);
  ctxMenu.value = { x: e.clientX, y: e.clientY };
}

function select() {
  store.selectClip(props.clip.id ?? null);
}
function onDown(e: MouseEvent) {
  select();
  const sx = e.clientX,
    st = props.clip.startTime;
  const move = (ev: MouseEvent) => {
    const dt = (ev.clientX - sx) / props.pps;
    store.updateClip(props.clip.id as string, {
      startTime: Math.max(0, Math.round((st + dt) * 10) / 10),
    });
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}
function resize(dir: 'left' | 'right', e: MouseEvent) {
  const sx = e.clientX,
    st = props.clip.startTime,
    sd = props.clip.duration;
  const move = (ev: MouseEvent) => {
    const dt = (ev.clientX - sx) / props.pps;
    if (dir === 'left') {
      store.updateClip(props.clip.id as string, {
        startTime: Math.max(0, Math.round((st + dt) * 10) / 10),
        duration: Math.max(0.1, Math.round((sd - dt) * 10) / 10),
      });
    } else {
      store.updateClip(props.clip.id as string, {
        duration: Math.max(0.1, Math.round((sd + dt) * 10) / 10),
      });
    }
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}
</script>

<style scoped>
.timeline-clip {
  @apply absolute top-1 bottom-1 rounded-md cursor-pointer transition-shadow overflow-hidden;
  min-width: 28px;
}
.timeline-clip.selected {
  @apply ring-2 ring-white/70 ring-offset-1 ring-offset-studio-bg;
}
.clip-inner {
  @apply h-full px-1.5 flex items-center gap-1 overflow-hidden;
}
.clip-icon {
  @apply flex-shrink-0 opacity-80;
}
.clip-label {
  @apply text-[9px] font-semibold text-white/90 truncate;
}

.clip-transform {
  background: linear-gradient(135deg, #9333ea, #6366f1);
}
.clip-move {
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
}
.clip-scale {
  background: linear-gradient(135deg, #22c55e, #10b981);
}
.clip-fade {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
}
.clip-rotate {
  background: linear-gradient(135deg, #ec4899, #f43f5e);
}
.clip-default {
  background: #475569;
}

.resize-handle {
  @apply absolute top-0 bottom-0 w-2 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity;
}
.resize-handle.left {
  @apply left-0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.3), transparent);
}
.resize-handle.right {
  @apply right-0;
  background: linear-gradient(270deg, rgba(255, 255, 255, 0.3), transparent);
}
.timeline-clip:hover .resize-handle {
  @apply opacity-50;
}
</style>
