<template>
  <div>
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-studio-text-muted w-12">{{ label }}</span>
      <input
        type="color"
        class="color-input"
        :value="value || '#ffffff'"
        :aria-label="label + ' color picker'"
        @input="onInput($event)"
      />
      <input
        class="input input-sm flex-1"
        :value="value"
        :aria-label="label + ' color hex'"
        @change="onInput($event)"
      />
    </div>
    <div v-if="store.recentColors.length > 0" class="flex gap-1 mt-1 flex-wrap">
      <button
        v-for="c in store.recentColors"
        :key="c"
        class="recent-swatch"
        :style="{ background: c }"
        :title="c"
        :aria-label="'Use recent color ' + c"
        @click="emit('input', c)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProjectStore } from '../../../store/project.js';

defineProps({ label: String, value: String });
const emit = defineEmits(['input']);
const store = useProjectStore();

function onInput(e: Event) {
  const hex = (e.target as HTMLInputElement).value;
  store.addRecentColor(hex);
  emit('input', hex);
}
</script>

<style scoped>
.recent-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--studio-border);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.recent-swatch:hover {
  outline: 2px solid var(--studio-accent);
  outline-offset: 1px;
}
</style>
