<template>
  <!-- Graph / DiGraph editor -->
  <Section label="Graph">
    <div class="space-y-2">
      <!-- Toggles -->
      <div class="flex gap-3">
        <label class="flex items-center gap-1.5 text-[11px] text-studio-text-muted cursor-pointer">
          <input type="checkbox" :checked="!!obj.directed" @change="onDirectedChange($event)" />
          Directed
        </label>
        <label class="flex items-center gap-1.5 text-[11px] text-studio-text-muted cursor-pointer">
          <input type="checkbox" :checked="!!obj.showLabels" @change="onShowLabelsChange($event)" />
          Labels
        </label>
      </div>
      <!-- Vertex list -->
      <div class="pt-1">
        <p class="text-[10px] text-studio-text-muted mb-1">Vertices</p>
        <div v-for="v in graphVertices" :key="'gv-' + v" class="flex items-center gap-1 mb-1">
          <input
            class="flex-1 min-w-0 px-1 py-0.5 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
            :value="v"
            @change="onRenameVertex(v, $event)"
          />
          <button
            class="px-1.5 py-0.5 text-[10px] rounded border border-studio-border hover:bg-red-500/20 text-studio-text-muted"
            @click="removeGraphVertex(v)"
          >
            −
          </button>
        </div>
        <button
          class="w-full py-1 text-[10px] rounded border border-dashed border-studio-accent/50 text-studio-accent hover:bg-studio-accent/10"
          @click="addGraphVertexAuto"
        >
          + Add Vertex
        </button>
      </div>
      <!-- Edge list -->
      <div class="pt-1">
        <p class="text-[10px] text-studio-text-muted mb-1">Edges</p>
        <div
          v-for="(edge, ei) in graphEdges"
          :key="'ge-' + ei"
          class="flex items-center gap-1 mb-1"
        >
          <span class="flex-1 px-1 py-0.5 text-[11px] text-studio-text-muted font-mono"
            >{{ edge[0] }} → {{ edge[1] }}</span
          >
          <button
            class="px-1.5 py-0.5 text-[10px] rounded border border-studio-border hover:bg-red-500/20 text-studio-text-muted"
            @click="removeGraphEdge(edge[0], edge[1])"
          >
            −
          </button>
        </div>
        <div class="flex items-center gap-1 mt-1">
          <select
            class="flex-1 min-w-0 px-1 py-0.5 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
            :value="newEdgeFrom"
            @change="onNewEdgeFromChange($event)"
          >
            <option value="">From…</option>
            <option v-for="v in graphVertices" :key="'ef-' + v" :value="v">{{ v }}</option>
          </select>
          <select
            class="flex-1 min-w-0 px-1 py-0.5 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
            :value="newEdgeTo"
            @change="onNewEdgeToChange($event)"
          >
            <option value="">To…</option>
            <option v-for="v in graphVertices" :key="'et-' + v" :value="v">{{ v }}</option>
          </select>
          <button
            class="px-2 py-0.5 text-[10px] rounded border border-studio-accent/50 text-studio-accent hover:bg-studio-accent/10"
            @click="addGraphEdgeFromUI"
          >
            Add
          </button>
        </div>
      </div>
      <p class="text-[10px] text-studio-text-muted/50">
        Drag vertex handles on the canvas to reposition.
      </p>
    </div>
  </Section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const obj = props.obj;
const newEdgeFrom = ref('');
const newEdgeTo = ref('');
const graphVertices = computed(() => (obj.vertices as string[] | undefined) ?? []);
const graphEdges = computed(() => (obj.edges as [string, string][] | undefined) ?? []);
watch(
  () => store.selectedObjectIds,
  () => {
    newEdgeFrom.value = '';
    newEdgeTo.value = '';
  }
);
function graphVertexName(v: unknown): string {
  return String(v || '').trim();
}
function addGraphVertexAuto() {
  store.addGraphVertex(obj.id, undefined);
}
function removeGraphVertex(v: string) {
  store.removeGraphVertex(obj.id, v);
}
function renameGraphVertex(oldV: string, newV: unknown) {
  const nv = graphVertexName(newV);
  if (nv && nv !== oldV) store.renameGraphVertex(obj.id, oldV, nv);
}
function onRenameVertex(oldV: string, e: Event) {
  renameGraphVertex(oldV, (e.target as HTMLInputElement).value);
}
function onDirectedChange(e: Event) {
  store.setGraphDirected(obj.id, (e.target as HTMLInputElement).checked);
}
function onShowLabelsChange(e: Event) {
  store.setGraphShowLabels(obj.id, (e.target as HTMLInputElement).checked);
}
function onNewEdgeFromChange(e: Event) {
  newEdgeFrom.value = (e.target as HTMLSelectElement).value;
}
function onNewEdgeToChange(e: Event) {
  newEdgeTo.value = (e.target as HTMLSelectElement).value;
}
function addGraphEdgeFromUI() {
  const a = newEdgeFrom.value,
    b = newEdgeTo.value;
  if (a && b && a !== b) {
    store.addGraphEdge(obj.id, a, b);
    newEdgeFrom.value = '';
    newEdgeTo.value = '';
  }
}
function removeGraphEdge(a: string, b: string) {
  store.removeGraphEdge(obj.id, a, b);
}
</script>
