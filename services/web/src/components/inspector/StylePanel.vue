<template>
  <div class="style-panel px-4 py-3 border-b border-studio-border">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-studio-text-muted uppercase tracking-wider">Style</span>
    </div>

    <template v-if="element.type === 'text'">
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-xs text-studio-text-muted mb-1">Font Size</label>
          <input
            type="number"
            :value="style.size as number"
            min="8"
            max="200"
            class="input text-sm"
            @input="updateStyle('size', parseInt(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div>
          <label class="block text-xs text-studio-text-muted mb-1">Color</label>
          <ColorInput :value="style.color as string" @change="updateStyle('color', $event)" />
        </div>
      </div>
    </template>

    <template v-else-if="element.type === 'image'">
      <div class="mb-3">
        <label class="block text-xs text-studio-text-muted mb-1">Opacity</label>
        <div class="flex items-center gap-3">
          <input
            type="range"
            :value="(style.opacity as number | undefined) || 1"
            min="0"
            max="1"
            step="0.1"
            class="flex-1"
            @input="updateStyle('opacity', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="text-sm text-studio-text-muted w-12"
            >{{ Math.round(((style.opacity as number | undefined) || 1) * 100) }}%</span
          >
        </div>
      </div>
    </template>

    <template v-else-if="element.type === 'svg'">
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-xs text-studio-text-muted mb-1">Stroke</label>
          <ColorInput
            :value="(style.strokeColor as string | undefined) || '#ffffff'"
            @change="updateStyle('strokeColor', $event)"
          />
        </div>
        <div>
          <label class="block text-xs text-studio-text-muted mb-1">Fill</label>
          <ColorInput
            :value="(style.fillColor as string | undefined) || '#ffffff'"
            @change="updateStyle('fillColor', $event)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ColorInput from './ColorInput.vue';
import type { SceneObject } from '@manim/codegen';

const props = defineProps({ element: { type: Object as () => SceneObject, required: true } });
const emit = defineEmits(['update']);

type Style = Record<string, unknown>;
const style = computed(() => (props.element as unknown as { style: Style }).style ?? ({} as Style));

function updateStyle(key: string, value: unknown) {
  emit('update', { style: { ...style.value, [key]: value } });
}
</script>
