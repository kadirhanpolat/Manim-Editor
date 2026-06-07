<template>
  <!-- Graph / DiGraph editor -->
  <Section label="Graph">
    <div class="space-y-2">
      <!-- Toggles -->
      <div class="flex gap-3">
        <label class="flex items-center gap-1.5 text-[11px] text-studio-text-muted cursor-pointer">
          <input
            type="checkbox"
            :checked="obj.directed"
            @change="store.setGraphDirected(obj.id, $event.target.checked)"
          />
          Directed
        </label>
        <label class="flex items-center gap-1.5 text-[11px] text-studio-text-muted cursor-pointer">
          <input
            type="checkbox"
            :checked="obj.showLabels"
            @change="store.setGraphShowLabels(obj.id, $event.target.checked)"
          />
          Labels
        </label>
      </div>
      <!-- Vertex list -->
      <div class="pt-1">
        <p class="text-[10px] text-studio-text-muted mb-1">Vertices</p>
        <div v-for="v in obj.vertices || []" :key="'gv-' + v" class="flex items-center gap-1 mb-1">
          <input
            class="flex-1 min-w-0 px-1 py-0.5 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
            :value="v"
            @change="renameGraphVertex(v, $event.target.value)"
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
          v-for="(edge, ei) in obj.edges || []"
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
            @change="newEdgeFrom = $event.target.value"
          >
            <option value="">From…</option>
            <option v-for="v in obj.vertices || []" :key="'ef-' + v" :value="v">{{ v }}</option>
          </select>
          <select
            class="flex-1 min-w-0 px-1 py-0.5 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
            :value="newEdgeTo"
            @change="newEdgeTo = $event.target.value"
          >
            <option value="">To…</option>
            <option v-for="v in obj.vertices || []" :key="'et-' + v" :value="v">{{ v }}</option>
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

<script setup>
import { ref, watch } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;
const newEdgeFrom = ref('');
const newEdgeTo = ref('');
watch(
  () => store.selectedObjectIds,
  () => {
    newEdgeFrom.value = '';
    newEdgeTo.value = '';
  }
);
function graphVertexName(v) {
  return String(v || '').trim();
}
function addGraphVertexAuto() {
  store.addGraphVertex(obj.id);
}
function removeGraphVertex(v) {
  store.removeGraphVertex(obj.id, v);
}
function renameGraphVertex(oldV, newV) {
  const nv = graphVertexName(newV);
  if (nv && nv !== oldV) store.renameGraphVertex(obj.id, oldV, nv);
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
function removeGraphEdge(a, b) {
  store.removeGraphEdge(obj.id, a, b);
}
</script>
