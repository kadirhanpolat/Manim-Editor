<template>
  <!-- Brace -->
  <Section label="Brace">
    <div class="space-y-2">
      <label class="block text-[10px] text-studio-text-muted">Label (LaTeX, optional)</label>
      <input
        data-test="rel-label"
        class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
        :value="obj.label"
        placeholder="e.g. x or \\frac{a}{b}"
        @input="setRelationalLabel($event)"
      />
      <p class="text-[10px] text-studio-text-muted">
        Drag the two endpoint handles on the canvas to reshape.
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
function setRelationalLabel(e: Event) {
  store.setRelationalLabel(obj.id, (e.target as HTMLInputElement).value);
}
</script>
