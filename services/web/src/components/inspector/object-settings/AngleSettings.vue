<template>
  <!-- Angle -->
  <Section label="Angle">
    <div class="space-y-2">
      <button
        data-test="angle-right"
        class="w-full py-1 text-[11px] rounded border"
        :class="
          obj.rightAngle
            ? 'border-studio-accent text-studio-accent'
            : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'
        "
        @click="store.setAngleRightMode(obj.id, !obj.rightAngle)"
      >
        Right angle mark
      </button>
      <div v-if="!obj.rightAngle" class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-14">Arc radius</span>
        <input
          type="number"
          step="0.1"
          min="0.1"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.radius"
          @input="setAngleRadius($event)"
        />
      </div>
      <label class="block text-[10px] text-studio-text-muted">Label (LaTeX, optional)</label>
      <input
        data-test="rel-label"
        class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
        :value="obj.label"
        placeholder="e.g. \\theta"
        @input="setRelationalLabel($event)"
      />
      <p class="text-[10px] text-studio-text-muted">
        Drag the vertex + two endpoint handles on the canvas.
      </p>
    </div>
  </Section>
</template>

<script setup lang="ts">
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const obj = props.obj;
function setAngleRadius(e: Event) {
  store.setAngleRadius(obj.id, (e.target as HTMLInputElement).value);
}
function setRelationalLabel(e: Event) {
  store.setRelationalLabel(obj.id, (e.target as HTMLInputElement).value);
}
</script>
