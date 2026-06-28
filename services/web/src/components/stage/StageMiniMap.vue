<template>
  <button
    v-if="!is3d"
    ref="rootRef"
    type="button"
    data-test="stage-minimap"
    class="absolute bottom-2 left-2 z-overlay overflow-hidden rounded border border-studio-border/80 bg-studio-surface/95 shadow-lg"
    style="width: 160px; height: 112px"
    :title="title"
    :aria-label="title"
    @mousedown.prevent.stop="onPointerDown"
  >
    <svg class="block h-full w-full" viewBox="0 0 160 112" role="presentation">
      <rect x="0" y="0" width="160" height="112" fill="rgba(8, 14, 20, 0.88)" />
      <g v-if="stageScale > 0">
        <rect
          data-test="minimap-stage-frame"
          :x="stageOffset.x"
          :y="stageOffset.y"
          :width="stageWidth * stageScale"
          :height="stageHeight * stageScale"
          fill="rgba(255, 255, 255, 0.02)"
          stroke="rgba(255, 255, 255, 0.10)"
          stroke-width="1"
        />
        <rect
          v-for="rect in objectRects"
          :key="rect.key"
          data-test="minimap-object-frame"
          :x="stageOffset.x + rect.x * stageScale"
          :y="stageOffset.y + rect.y * stageScale"
          :width="rect.width * stageScale"
          :height="rect.height * stageScale"
          :fill="accentFill"
          :stroke="accentStroke"
          stroke-width="0.8"
        />
        <rect
          data-test="minimap-viewport-frame"
          :x="stageOffset.x + viewportRect.x * stageScale"
          :y="stageOffset.y + viewportRect.y * stageScale"
          :width="viewportRect.width * stageScale"
          :height="viewportRect.height * stageScale"
          fill="rgba(255, 255, 255, 0.02)"
          :stroke="accentStroke"
          stroke-width="1.25"
        />
      </g>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

type Bounds = { x: number; y: number; width: number; height: number };
type StageObjectLike = { id: string; x?: number; y?: number; width?: number; height?: number; hidden?: boolean };

const props = defineProps<{
  is3d: boolean;
  stageWidth: number;
  stageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  ox: number;
  oy: number;
  vs: number;
  accent: string;
  objects: StageObjectLike[];
  getObjectBounds?: (id: string) => Bounds | null;
}>();

const emit = defineEmits<{
  (e: 'focus', point: { x: number; y: number }): void;
}>();

const title = 'Mini-map';
const rootRef = ref<HTMLElement | null>(null);
const MINI_W = 160;
const MINI_H = 112;
const PAD = 10;

const stageScale = computed(() => {
  if (props.stageWidth <= 0 || props.stageHeight <= 0) return 0;
  return Math.min((MINI_W - PAD * 2) / props.stageWidth, (MINI_H - PAD * 2) / props.stageHeight);
});

const stageOffset = computed(() => ({
  x: (MINI_W - props.stageWidth * stageScale.value) / 2,
  y: (MINI_H - props.stageHeight * stageScale.value) / 2,
}));

const accentFill = computed(() => `${props.accent}22`);
const accentStroke = computed(() => props.accent);

function toStageRect(bounds: Bounds): Bounds {
  const x1 = (bounds.x - props.ox) / props.vs;
  const y1 = (bounds.y - props.oy) / props.vs;
  const x2 = (bounds.x + bounds.width - props.ox) / props.vs;
  const y2 = (bounds.y + bounds.height - props.oy) / props.vs;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function fallbackRect(obj: StageObjectLike): Bounds | null {
  const width = obj.width ?? 0;
  const height = obj.height ?? 0;
  if (width <= 0 || height <= 0) return null;
  return {
    x: (obj.x ?? 0) - width / 2,
    y: (obj.y ?? 0) - height / 2,
    width,
    height,
  };
}

const objectRects = computed(() =>
  props.objects
    .filter((obj) => !obj.hidden)
    .map((obj) => {
      const bounds = props.getObjectBounds?.(obj.id);
      const rect = bounds ? toStageRect(bounds) : fallbackRect(obj);
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      return { key: obj.id, ...rect };
    })
    .filter((rect): rect is Bounds & { key: string } => rect !== null)
);

const viewportRect = computed(() => {
  if (props.vs <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = -props.ox / props.vs;
  const top = -props.oy / props.vs;
  return {
    x: left,
    y: top,
    width: props.viewportWidth / props.vs,
    height: props.viewportHeight / props.vs,
  };
});

function onPointerDown(e: MouseEvent) {
  const root = rootRef.value;
  if (!root || stageScale.value <= 0) return;
  const rect = root.getBoundingClientRect();
  const x = (e.clientX - rect.left - stageOffset.value.x) / stageScale.value;
  const y = (e.clientY - rect.top - stageOffset.value.y) / stageScale.value;
  emit('focus', {
    x: Math.max(0, Math.min(props.stageWidth, x)),
    y: Math.max(0, Math.min(props.stageHeight, y)),
  });
}
</script>
