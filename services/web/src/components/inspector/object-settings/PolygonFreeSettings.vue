<template>
  <!-- Free polygon presets -->
  <Section label="Polygon">
    <div class="flex gap-1.5">
      <button
        class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
        @click="applyPolygonPreset('trapezoid')"
      >
        Trapezoid
      </button>
      <button
        data-test="preset-parallelogram"
        class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
        @click="applyPolygonPreset('parallelogram')"
      >
        Parallelogram
      </button>
      <button
        class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
        @click="applyPolygonPreset('free')"
      >
        Free
      </button>
    </div>
    <p class="text-[10px] text-studio-text-muted mt-1.5">
      {{ (obj.vertices || []).length }} vertices · drag corners on canvas
    </p>
  </Section>
</template>

<script setup>
import { useProjectStore } from '../../../store/project.js';
import { presetVertices } from '../../../engine/polygonVertices.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;
function applyPolygonPreset(kind) {
  store.setPolygonVertices(obj.id, presetVertices(kind, obj.width, obj.height));
}
</script>
