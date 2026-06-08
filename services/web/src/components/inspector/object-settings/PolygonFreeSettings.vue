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
      {{ vertices.length }} vertices · drag corners on canvas
    </p>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import { presetVertices } from '../../../engine/polygonVertices.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const obj = props.obj;
const vertices = computed(() => (obj.vertices as unknown[] | undefined) ?? []);
function applyPolygonPreset(kind: string) {
  store.setPolygonVertices(obj.id, presetVertices(kind, obj.width ?? 200, obj.height ?? 200));
}
</script>
