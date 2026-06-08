<template>
  <div class="timing-panel px-4 py-3 border-b border-studio-border">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-studio-text-muted uppercase tracking-wider">Timing</span>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Start (s)</label>
        <input
          type="number"
          :value="timing.start"
          min="0"
          step="0.1"
          class="input text-sm"
          @input="updateTiming('start', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Duration (s)</label>
        <input
          type="number"
          :value="timing.duration"
          min="0.1"
          step="0.1"
          class="input text-sm"
          @input="updateTiming('duration', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <div class="mt-3">
      <div class="h-2 bg-studio-bg rounded-full overflow-hidden">
        <div
          class="h-full bg-studio-accent rounded-full transition-all"
          :style="previewStyle"
        ></div>
      </div>
      <div class="flex justify-between mt-1">
        <span class="text-[10px] text-studio-text-muted">{{ timing.start.toFixed(1) }}s</span>
        <span class="text-[10px] text-studio-text-muted">{{ endTime.toFixed(1) }}s</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../store/project.js';

const props = defineProps({ element: { type: Object as () => SceneObject, required: true } });
const emit = defineEmits(['update']);

const store = useProjectStore();

type Timing = { start: number; duration: number };
const timing = computed(() => (props.element as unknown as { timing: Timing }).timing);

const endTime = computed(() => timing.value.start + timing.value.duration);
const totalDuration = computed(() => store.computedDuration);
const previewStyle = computed(() => {
  const start = (timing.value.start / totalDuration.value) * 100;
  const width = (timing.value.duration / totalDuration.value) * 100;
  return { marginLeft: start + '%', width: width + '%' };
});

function updateTiming(key: string, value: number) {
  emit('update', {
    timing: { ...timing.value, [key]: Math.max(key === 'duration' ? 0.1 : 0, value || 0) },
  });
}
</script>
