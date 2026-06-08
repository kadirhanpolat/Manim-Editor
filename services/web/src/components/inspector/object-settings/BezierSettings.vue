<template>
  <Section label="Bezier Curve">
    <p class="text-[10px] text-studio-text-muted">
      {{ ((obj.vertices as unknown[] | undefined) ?? []).length }} anchors · drag them on the canvas
      to reshape.
    </p>
    <div class="flex gap-1.5 mt-1.5">
      <button
        class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
        @click="addAnchor"
      >
        + Anchor
      </button>
      <button
        class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
        :disabled="((obj.vertices as unknown[] | undefined) ?? []).length <= 2"
        @click="removeAnchor"
      >
        − Anchor
      </button>
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
function addAnchor() {
  const v = ((obj.vertices as [number, number][] | undefined) ?? []).slice();
  const last = v[v.length - 1] ?? [0, 0];
  v.push([last[0] + 40, -last[1]]);
  store.setPolygonVertices(obj.id, v);
}
function removeAnchor() {
  const v = ((obj.vertices as [number, number][] | undefined) ?? []).slice();
  if (v.length <= 2) return;
  v.pop();
  store.setPolygonVertices(obj.id, v);
}
</script>
