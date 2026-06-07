<template>
  <!-- Axes settings -->
  <Section label="Axes Range">
    <div class="space-y-1.5">
      <div class="grid grid-cols-3 gap-1">
        <Num
          label="X Min"
          :value="(obj.xRange || [-5, 5, 1])[0]"
          :step="1"
          @input="uRange('xRange', 0, $event)"
        />
        <Num
          label="X Max"
          :value="(obj.xRange || [-5, 5, 1])[1]"
          :step="1"
          @input="uRange('xRange', 1, $event)"
        />
        <Num
          label="X Step"
          :value="(obj.xRange || [-5, 5, 1])[2]"
          :min="0.1"
          :step="0.5"
          @input="uRange('xRange', 2, $event)"
        />
      </div>
      <div class="grid grid-cols-3 gap-1">
        <Num
          label="Y Min"
          :value="(obj.yRange || [-3, 3, 1])[0]"
          :step="1"
          @input="uRange('yRange', 0, $event)"
        />
        <Num
          label="Y Max"
          :value="(obj.yRange || [-3, 3, 1])[1]"
          :step="1"
          @input="uRange('yRange', 1, $event)"
        />
        <Num
          label="Y Step"
          :value="(obj.yRange || [-3, 3, 1])[2]"
          :min="0.1"
          :step="0.5"
          @input="uRange('yRange', 2, $event)"
        />
      </div>
    </div>
  </Section>

  <!-- Axes: Graph Functions -->
  <Section label="Graphs">
    <div
      v-for="graph in obj.graphs || []"
      :key="graph.id"
      class="mb-2 p-2 rounded bg-studio-surface2 border border-studio-border"
    >
      <div class="flex items-center gap-1 mb-1">
        <input
          class="input input-sm flex-1 font-mono text-xs"
          :value="graph.expression"
          placeholder="x**2"
          @change="updateGraph(graph.id, 'expression', $event.target.value)"
        />
        <input
          type="color"
          class="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
          :value="graph.color"
          @input="updateGraph(graph.id, 'color', $event.target.value)"
        />
        <button
          class="text-studio-error hover:opacity-80 text-xs px-1"
          @click="removeGraph(graph.id)"
        >
          ✕
        </button>
      </div>
      <div class="grid grid-cols-2 gap-1">
        <Num label="x min" :value="graph.xMin" @input="updateGraph(graph.id, 'xMin', $event)" />
        <Num label="x max" :value="graph.xMax" @input="updateGraph(graph.id, 'xMax', $event)" />
      </div>
      <div class="flex items-center gap-2 mt-1">
        <button
          data-test="graph-area-toggle"
          class="text-[10px] px-1.5 py-0.5 rounded border border-studio-border"
          :class="
            graph.area && graph.area.enabled ? 'text-studio-accent' : 'text-studio-text-muted'
          "
          @click="toggleGraphArea(graph)"
        >
          Area
        </button>
        <button
          class="text-[10px] px-1.5 py-0.5 rounded border border-studio-border"
          :class="
            graph.riemann && graph.riemann.enabled ? 'text-studio-accent' : 'text-studio-text-muted'
          "
          @click="toggleGraphRiemann(graph)"
        >
          Riemann
        </button>
        <button
          data-test="graph-tangent-toggle"
          class="text-[10px] px-1.5 py-0.5 rounded border border-studio-border"
          :class="
            graph.tangent && graph.tangent.enabled ? 'text-studio-accent' : 'text-studio-text-muted'
          "
          @click="toggleGraphTangent(graph)"
        >
          Tangent
        </button>
      </div>
      <div v-if="graph.riemann && graph.riemann.enabled" class="grid grid-cols-2 gap-1.5 mt-1">
        <Num
          label="dx"
          :value="graph.riemann.dx"
          :min="0.05"
          :step="0.05"
          @input="setRiemannField(graph, 'dx', $event)"
        />
        <div>
          <span class="text-[9px] text-studio-text-muted/50">Sample</span>
          <select
            class="select text-xs"
            :value="graph.riemann.type"
            @change="setRiemannField(graph, 'type', $event.target.value)"
          >
            <option value="left">left</option>
            <option value="right">right</option>
            <option value="center">center</option>
          </select>
        </div>
      </div>
      <div v-if="graph.tangent && graph.tangent.enabled" class="grid grid-cols-2 gap-1.5 mt-1">
        <Num
          label="at x"
          :value="graph.tangent.x"
          :step="0.5"
          @input="setTangentField(graph, 'x', $event)"
        />
        <Num
          label="length"
          :value="graph.tangent.length"
          :min="0.5"
          :step="0.5"
          @input="setTangentField(graph, 'length', $event)"
        />
      </div>
    </div>
    <button
      class="w-full mt-1 py-1 text-xs rounded border border-dashed border-studio-accent/50 text-studio-accent hover:bg-studio-accent/10"
      @click="addGraph"
    >
      + Add Graph
    </button>
  </Section>
</template>

<script setup>
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const { uRange } = useObjectUpdate(() => props.obj);
const obj = props.obj;
function addGraph() {
  store.addGraph(obj.id);
}
function removeGraph(graphId) {
  store.removeGraph(obj.id, graphId);
}
function updateGraph(graphId, key, value) {
  store.updateGraph(obj.id, graphId, { [key]: value });
}
function toggleGraphArea(graph) {
  const existing = graph.area || {};
  const on = !existing.enabled;
  store.updateGraph(obj.id, graph.id, {
    area: on
      ? {
          xMin: graph.xMin,
          xMax: graph.xMax,
          opacity: 0.5,
          color: graph.color,
          ...existing,
          enabled: true,
        }
      : { ...existing, enabled: false },
  });
}
function toggleGraphRiemann(graph) {
  const existing = graph.riemann || {};
  const on = !existing.enabled;
  store.updateGraph(obj.id, graph.id, {
    riemann: on
      ? {
          xMin: graph.xMin,
          xMax: graph.xMax,
          dx: Math.max(0.1, (graph.xMax - graph.xMin) / 10),
          type: 'left',
          color: graph.color,
          ...existing,
          enabled: true,
        }
      : { ...existing, enabled: false },
  });
}
function setRiemannField(graph, key, val) {
  if (graph.riemann)
    store.updateGraph(obj.id, graph.id, { riemann: { ...graph.riemann, [key]: val } });
}
function toggleGraphTangent(graph) {
  const existing = graph.tangent || {};
  const on = !existing.enabled;
  const midX =
    Number.isFinite(graph.xMin) && Number.isFinite(graph.xMax) ? (graph.xMin + graph.xMax) / 2 : 0;
  store.updateGraph(obj.id, graph.id, {
    tangent: on
      ? { x: midX, length: 2, color: graph.color, ...existing, enabled: true }
      : { ...existing, enabled: false },
  });
}
function setTangentField(graph, key, val) {
  if (graph.tangent)
    store.updateGraph(obj.id, graph.id, { tangent: { ...graph.tangent, [key]: val } });
}
</script>
