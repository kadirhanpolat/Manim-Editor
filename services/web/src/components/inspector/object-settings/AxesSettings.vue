<template>
  <!-- Axes settings -->
  <Section label="Axes Range">
    <div class="space-y-1.5">
      <div class="grid grid-cols-3 gap-1">
        <Num label="X Min" :value="xRange[0]" :step="1" @input="uRange('xRange', 0, $event)" />
        <Num label="X Max" :value="xRange[1]" :step="1" @input="uRange('xRange', 1, $event)" />
        <Num
          label="X Step"
          :value="xRange[2]"
          :min="0.1"
          :step="0.5"
          @input="uRange('xRange', 2, $event)"
        />
      </div>
      <div class="grid grid-cols-3 gap-1">
        <Num label="Y Min" :value="yRange[0]" :step="1" @input="uRange('yRange', 0, $event)" />
        <Num label="Y Max" :value="yRange[1]" :step="1" @input="uRange('yRange', 1, $event)" />
        <Num
          label="Y Step"
          :value="yRange[2]"
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
      v-for="graph in graphs"
      :key="graph.id"
      class="mb-2 p-2 rounded bg-studio-surface2 border border-studio-border"
    >
      <div class="flex items-center gap-1 mb-1">
        <input
          class="input input-sm flex-1 font-mono text-xs"
          :value="graph.expression"
          placeholder="x**2"
          @change="onGraphExprChange(graph.id, $event)"
        />
        <input
          type="color"
          class="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
          :value="graph.color"
          @input="onGraphColorInput(graph.id, $event)"
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
            @change="onRiemannTypeChange(graph, $event)"
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

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';

interface GraphEntry {
  id: string;
  expression?: string;
  color?: string;
  xMin?: number;
  xMax?: number;
  area?: {
    enabled?: boolean;
    xMin?: number;
    xMax?: number;
    opacity?: number;
    color?: string;
    [k: string]: unknown;
  };
  riemann?: {
    enabled?: boolean;
    xMin?: number;
    xMax?: number;
    dx?: number;
    type?: string;
    color?: string;
    [k: string]: unknown;
  };
  tangent?: {
    enabled?: boolean;
    x?: number;
    length?: number;
    color?: string;
    [k: string]: unknown;
  };
}

const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const { uRange } = useObjectUpdate(() => props.obj);
const obj = props.obj;
const graphs = computed(() => (obj.graphs as GraphEntry[] | undefined) ?? []);
const xRange = computed(() => (obj.xRange as number[] | undefined) ?? [-5, 5, 1]);
const yRange = computed(() => (obj.yRange as number[] | undefined) ?? [-3, 3, 1]);

function onGraphExprChange(graphId: string, e: Event) {
  updateGraph(graphId, 'expression', (e.target as HTMLInputElement).value);
}
function onGraphColorInput(graphId: string, e: Event) {
  updateGraph(graphId, 'color', (e.target as HTMLInputElement).value);
}
function onRiemannTypeChange(graph: GraphEntry, e: Event) {
  setRiemannField(graph, 'type', (e.target as HTMLSelectElement).value);
}

function addGraph() {
  store.addGraph(obj.id);
}
function removeGraph(graphId: string) {
  store.removeGraph(obj.id, graphId);
}
function updateGraph(graphId: string, key: string, value: unknown) {
  store.updateGraph(obj.id, graphId, { [key]: value });
}
function toggleGraphArea(graph: GraphEntry) {
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
function toggleGraphRiemann(graph: GraphEntry) {
  const existing = graph.riemann || {};
  const on = !existing.enabled;
  store.updateGraph(obj.id, graph.id, {
    riemann: on
      ? {
          xMin: graph.xMin,
          xMax: graph.xMax,
          dx: Math.max(0.1, ((graph.xMax ?? 5) - (graph.xMin ?? -5)) / 10),
          type: 'left',
          color: graph.color,
          ...existing,
          enabled: true,
        }
      : { ...existing, enabled: false },
  });
}
function setRiemannField(graph: GraphEntry, key: string, val: unknown) {
  if (graph.riemann)
    store.updateGraph(obj.id, graph.id, { riemann: { ...graph.riemann, [key]: val } });
}
function toggleGraphTangent(graph: GraphEntry) {
  const existing = graph.tangent || {};
  const on = !existing.enabled;
  const midX =
    Number.isFinite(graph.xMin) && Number.isFinite(graph.xMax)
      ? ((graph.xMin ?? 0) + (graph.xMax ?? 0)) / 2
      : 0;
  store.updateGraph(obj.id, graph.id, {
    tangent: on
      ? { x: midX, length: 2, color: graph.color, ...existing, enabled: true }
      : { ...existing, enabled: false },
  });
}
function setTangentField(graph: GraphEntry, key: string, val: unknown) {
  if (graph.tangent)
    store.updateGraph(obj.id, graph.id, { tangent: { ...graph.tangent, [key]: val } });
}
</script>
