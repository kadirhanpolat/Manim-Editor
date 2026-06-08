<template>
  <div class="animation-panel px-4 py-3 border-b border-studio-border">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-studio-text-muted uppercase tracking-wider">Animations</span>
    </div>

    <div class="mb-4">
      <label class="block text-xs text-studio-text-muted mb-2">Entrance</label>
      <select
        :value="inType"
        @change="updateAnim('in', 'type', ($event.target as HTMLSelectElement).value)"
        class="select text-sm mb-2"
      >
        <option v-for="a in entranceAnims" :key="a.type" :value="a.type">{{ a.label }}</option>
      </select>
      <div class="flex items-center gap-2">
        <span class="text-xs text-studio-text-muted">Duration:</span>
        <input
          type="number"
          :value="inDur"
          @input="updateAnim('in', 'duration', parseFloat(($event.target as HTMLInputElement).value))"
          min="0.1"
          step="0.1"
          class="input text-sm w-20"
        />
        <span class="text-xs text-studio-text-muted">s</span>
      </div>
    </div>

    <div>
      <label class="block text-xs text-studio-text-muted mb-2">Exit</label>
      <select
        :value="outType"
        @change="updateAnim('out', 'type', ($event.target as HTMLSelectElement).value)"
        class="select text-sm mb-2"
      >
        <option v-for="a in exitAnims" :key="a.type" :value="a.type">{{ a.label }}</option>
      </select>
      <div class="flex items-center gap-2">
        <span class="text-xs text-studio-text-muted">Duration:</span>
        <input
          type="number"
          :value="outDur"
          @input="updateAnim('out', 'duration', parseFloat(($event.target as HTMLInputElement).value))"
          min="0.1"
          step="0.1"
          class="input text-sm w-20"
        />
        <span class="text-xs text-studio-text-muted">s</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import {
  getEntranceAnimationsForType,
  getExitAnimationsForType,
} from '../../constants/animations.js';

const props = defineProps({ element: { type: Object as () => SceneObject, required: true } });
const emit = defineEmits(['update']);

type AnimDir = Record<string, Record<string, unknown>>;

const entranceAnims = computed(() => getEntranceAnimationsForType(props.element.type));
const exitAnims = computed(() => getExitAnimationsForType(props.element.type));
const animField = computed(() => (props.element as unknown as { anim?: AnimDir }).anim);
const inType = computed(() => animField.value?.['in']?.['type'] as string || 'FADE_IN');
const inDur = computed(() => animField.value?.['in']?.['duration'] as number || 0.5);
const outType = computed(() => animField.value?.['out']?.['type'] as string || 'FADE_OUT');
const outDur = computed(() => animField.value?.['out']?.['duration'] as number || 0.5);

function updateAnim(dir: string, key: string, val: unknown) {
  const curr = animField.value?.[dir] || {};
  emit('update', { anim: { ...animField.value, [dir]: { ...curr, [key]: val } } });
}
</script>
