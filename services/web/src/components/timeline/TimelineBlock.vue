<template>
  <div
    class="timeline-block absolute top-1 bottom-1 rounded cursor-pointer transition-shadow"
    :class="[typeClass, { 'ring-2 ring-white ring-offset-1 ring-offset-studio-surface': selected }]"
    :style="blockStyle"
    @mousedown="startDrag"
    @click.stop="$emit('click')"
  >
    <!-- Block Content -->
    <div class="h-full px-2 flex items-center overflow-hidden">
      <span class="text-xs truncate text-white/90">
        {{ label }}
      </span>
    </div>

    <!-- Resize Handle Left -->
    <div
      class="resize-handle resize-left absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
      :class="{ 'pointer-events-none opacity-0': audioAutoLocked }"
      @mousedown.stop="startResize('left', $event)"
    ></div>

    <!-- Resize Handle Right -->
    <div
      class="resize-handle resize-right absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
      :class="{ 'pointer-events-none opacity-0': audioAutoLocked }"
      @mousedown.stop="startResize('right', $event)"
    ></div>

    <!-- Audio strip -->
    <div
      v-if="element.audio"
      class="audio-strip absolute left-0 right-0 flex items-center px-1 gap-1 overflow-hidden"
      style="bottom: -14px; height: 12px; font-size: 9px; pointer-events: none"
      :class="{
        'text-blue-400': element.audio.status === 'ready',
        'text-slate-400': element.audio.status === 'pending',
        'text-red-400': element.audio.status === 'error',
      }"
    >
      <span v-if="element.audio.status === 'ready'">&#9834; {{ audioDuration }}</span>
      <span v-if="element.audio.status === 'pending'">&#8987;</span>
      <span v-if="element.audio.status === 'error'">&#9888;</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';

interface TimingShape {
  start: number;
  duration: number;
}

interface AudioShape {
  status?: string;
  syncMode?: string;
  duration?: number | string;
}

interface ElementShape {
  type: string;
  content?: string;
  timing: TimingShape;
  audio?: AudioShape;
}

const props = defineProps({
  element: { type: Object as () => ElementShape, required: true },
  pixelsPerSecond: { type: Number, required: true },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'update-timing', value: Partial<TimingShape>): void;
}>();

const isDragging = ref(false);
const isResizing = ref(false);
const resizeDirection = ref<'left' | 'right' | null>(null);
const dragStartX = ref(0);
const dragStartTime = ref(0);
const dragStartDuration = ref(0);

const label = computed(() => {
  if (props.element.type === 'text') {
    return props.element.content || 'Text';
  }
  return props.element.type.toUpperCase();
});

const typeClass = computed(() => {
  const classes: Record<string, string> = {
    text: 'bg-indigo-600',
    image: 'bg-emerald-600',
    svg: 'bg-amber-600',
  };
  return classes[props.element.type] || 'bg-slate-600';
});

const blockStyle = computed(() => {
  const start = props.element.timing.start;
  const duration = props.element.timing.duration;
  return {
    left: `${start * props.pixelsPerSecond}px`,
    width: `${Math.max(20, duration * props.pixelsPerSecond)}px`,
  };
});

const audioDuration = computed(() => {
  if (props.element.audio?.duration == null) return '';
  return `${parseFloat(String(props.element.audio.duration)).toFixed(1)}s`;
});

const audioAutoLocked = computed(() => {
  return props.element.audio?.syncMode === 'auto' && props.element.audio?.status === 'ready';
});

let _onDrag: ((e: MouseEvent) => void) | null = null;
let _stopDrag: (() => void) | null = null;
let _onResize: ((e: MouseEvent) => void) | null = null;
let _stopResize: (() => void) | null = null;

function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('resize-handle')) return;

  isDragging.value = true;
  dragStartX.value = e.clientX;
  dragStartTime.value = props.element.timing.start;

  _onDrag = (ev: MouseEvent) => {
    if (!isDragging.value) return;
    const deltaX = ev.clientX - dragStartX.value;
    const deltaTime = deltaX / props.pixelsPerSecond;
    const newStart = Math.max(0, dragStartTime.value + deltaTime);
    emit('update-timing', { start: Math.round(newStart * 10) / 10 });
  };
  _stopDrag = () => {
    isDragging.value = false;
    if (_onDrag) document.removeEventListener('mousemove', _onDrag);
    if (_stopDrag) document.removeEventListener('mouseup', _stopDrag);
  };

  document.addEventListener('mousemove', _onDrag);
  document.addEventListener('mouseup', _stopDrag);
}

function startResize(direction: 'left' | 'right', e: MouseEvent) {
  isResizing.value = true;
  resizeDirection.value = direction;
  dragStartX.value = e.clientX;
  dragStartTime.value = props.element.timing.start;
  dragStartDuration.value = props.element.timing.duration;

  _onResize = (ev: MouseEvent) => {
    if (!isResizing.value) return;
    const deltaX = ev.clientX - dragStartX.value;
    const deltaTime = deltaX / props.pixelsPerSecond;
    if (resizeDirection.value === 'left') {
      const newStart = Math.max(0, dragStartTime.value + deltaTime);
      const newDuration = Math.max(0.1, dragStartDuration.value - deltaTime);
      emit('update-timing', {
        start: Math.round(newStart * 10) / 10,
        duration: Math.round(newDuration * 10) / 10,
      });
    } else {
      const newDuration = Math.max(0.1, dragStartDuration.value + deltaTime);
      emit('update-timing', { duration: Math.round(newDuration * 10) / 10 });
    }
  };
  _stopResize = () => {
    isResizing.value = false;
    resizeDirection.value = null;
    if (_onResize) document.removeEventListener('mousemove', _onResize);
    if (_stopResize) document.removeEventListener('mouseup', _stopResize);
  };

  document.addEventListener('mousemove', _onResize);
  document.addEventListener('mouseup', _stopResize);
}

onBeforeUnmount(() => {
  if (_onDrag) document.removeEventListener('mousemove', _onDrag);
  if (_stopDrag) document.removeEventListener('mouseup', _stopDrag);
  if (_onResize) document.removeEventListener('mousemove', _onResize);
  if (_stopResize) document.removeEventListener('mouseup', _stopResize);
});
</script>

<style scoped>
.timeline-block {
  min-width: 20px;
}

.resize-handle {
  opacity: 0;
  transition: opacity 0.15s;
}

.timeline-block:hover .resize-handle {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
}
</style>
