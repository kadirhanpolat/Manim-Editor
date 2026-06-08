<template>
  <div class="layout-panel px-4 py-3 border-b border-studio-border">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-studio-text-muted uppercase tracking-wider">Layout</span>
    </div>

    <!-- Anchor Grid -->
    <div class="mb-4">
      <label class="block text-xs text-studio-text-muted mb-2">Position Anchor</label>
      <AnchorGrid :value="layout.anchor" @input="updateAnchor" />
    </div>

    <!-- Offset -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Offset X</label>
        <input
          type="number"
          :value="layout.offset[0]"
          step="0.1"
          class="input text-sm"
          @input="updateOffsetX(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Offset Y</label>
        <input
          type="number"
          :value="layout.offset[1]"
          step="0.1"
          class="input text-sm"
          @input="updateOffsetY(($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Scale -->
    <div class="mb-4">
      <label class="block text-xs text-studio-text-muted mb-1">Scale</label>
      <div class="flex items-center gap-3">
        <input
          type="range"
          :value="layout.scale"
          min="0.1"
          max="3"
          step="0.1"
          class="flex-1"
          @input="updateScale(($event.target as HTMLInputElement).value)"
        />
        <input
          type="number"
          :value="layout.scale"
          min="0.1"
          max="3"
          step="0.1"
          class="input text-sm w-20"
          @input="updateScale(($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AnchorGrid from '../stage/AnchorGrid.vue';
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';

const props = defineProps({ element: { type: Object as () => SceneObject, required: true } });
const emit = defineEmits(['update']);

type Layout = { anchor: string; offset: [number, number]; scale: number };

const layout = computed(() => (props.element as unknown as { layout: Layout }).layout);

function getLayout(): Layout {
  return layout.value;
}

function updateAnchor(anchor: string) {
  emit('update', { layout: { ...getLayout(), anchor } });
}

function updateOffsetX(value: string) {
  const layout = getLayout();
  emit('update', {
    layout: {
      ...layout,
      offset: [parseFloat(value) || 0, layout.offset[1]],
    },
  });
}

function updateOffsetY(value: string) {
  const layout = getLayout();
  emit('update', {
    layout: {
      ...layout,
      offset: [layout.offset[0], parseFloat(value) || 0],
    },
  });
}

function updateScale(value: string) {
  emit('update', {
    layout: { ...getLayout(), scale: Math.max(0.1, parseFloat(value) || 1) },
  });
}
</script>
