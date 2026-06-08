<template>
  <div class="px-4 py-3 border-b border-studio-border">
    <span class="text-xs text-studio-text-muted uppercase tracking-wider">3D Position</span>
    <div class="grid grid-cols-3 gap-2 mt-2">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">X</label>
        <input
          type="number"
          :value="element.x3d ?? 0"
          @input="update('x3d', $event)"
          step="0.1"
          class="input text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Y</label>
        <input
          type="number"
          :value="element.y3d ?? 0"
          @input="update('y3d', $event)"
          step="0.1"
          class="input text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Z</label>
        <input
          type="number"
          :value="element.z3d ?? 0"
          @input="update('z3d', $event)"
          step="0.1"
          class="input text-sm"
        />
      </div>
    </div>
    <div class="grid grid-cols-3 gap-2 mt-2">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot X°</label>
        <input
          type="number"
          :value="element.rx ?? 0"
          @input="update('rx', $event)"
          step="5"
          class="input text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot Y°</label>
        <input
          type="number"
          :value="element.ry ?? 0"
          @input="update('ry', $event)"
          step="5"
          class="input text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot Z°</label>
        <input
          type="number"
          :value="element.rz ?? 0"
          @input="update('rz', $event)"
          step="5"
          class="input text-sm"
        />
      </div>
    </div>
    <div class="mt-2" v-if="element.resolution !== undefined">
      <label class="block text-xs text-studio-text-muted mb-1">Resolution</label>
      <input
        type="number"
        :value="element.resolution ?? 20"
        @input="update('resolution', $event)"
        min="4"
        max="64"
        step="4"
        class="input text-sm w-24"
      />
    </div>
    <div class="mt-2" v-if="element.type === 'axes3d'">
      <label class="block text-xs text-studio-text-muted mb-1">X Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input
          type="number"
          data-testid="xRange-min"
          :value="getRange('xRange')[0] ?? -3"
          @input="updateRange('xRange', 0, $event)"
          step="1"
          class="input text-sm w-16"
        />
        <span>–</span>
        <input
          type="number"
          data-testid="xRange-max"
          :value="getRange('xRange')[1] ?? 3"
          @input="updateRange('xRange', 1, $event)"
          step="1"
          class="input text-sm w-16"
        />
      </div>
      <label class="block text-xs text-studio-text-muted mb-1 mt-2">Y Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input
          type="number"
          data-testid="yRange-min"
          :value="getRange('yRange')[0] ?? -3"
          @input="updateRange('yRange', 0, $event)"
          step="1"
          class="input text-sm w-16"
        />
        <span>–</span>
        <input
          type="number"
          data-testid="yRange-max"
          :value="getRange('yRange')[1] ?? 3"
          @input="updateRange('yRange', 1, $event)"
          step="1"
          class="input text-sm w-16"
        />
      </div>
      <label class="block text-xs text-studio-text-muted mb-1 mt-2">Z Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input
          type="number"
          data-testid="zRange-min"
          :value="getRange('zRange')[0] ?? -3"
          @input="updateRange('zRange', 0, $event)"
          step="1"
          class="input text-sm w-16"
        />
        <span>–</span>
        <input
          type="number"
          data-testid="zRange-max"
          :value="getRange('zRange')[1] ?? 3"
          @input="updateRange('zRange', 1, $event)"
          step="1"
          class="input text-sm w-16"
        />
      </div>
    </div>
    <div class="mt-2" v-if="element.type === 'surface'">
      <label class="block text-xs text-studio-text-muted mb-1">z = f(x, y)</label>
      <input
        type="text"
        data-testid="surface-zexpr"
        :value="(element.zExpr as string | undefined) ?? 'x**2 - y**2'"
        @input="$emit('update', { zExpr: ($event.target as HTMLInputElement).value })"
        class="input text-sm w-full"
        placeholder="x**2 - y**2"
      />
      <label class="block text-xs text-studio-text-muted mb-1 mt-2">X Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input
          type="number"
          data-testid="surface-x-min"
          :value="getRange('xRange')[0] ?? -2"
          @input="updateRange('xRange', 0, $event)"
          step="0.5"
          class="input text-sm w-16"
        />
        <span>–</span>
        <input
          type="number"
          data-testid="surface-x-max"
          :value="getRange('xRange')[1] ?? 2"
          @input="updateRange('xRange', 1, $event)"
          step="0.5"
          class="input text-sm w-16"
        />
      </div>
      <label class="block text-xs text-studio-text-muted mb-1 mt-2">Y Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input
          type="number"
          data-testid="surface-y-min"
          :value="getRange('yRange')[0] ?? -2"
          @input="updateRange('yRange', 0, $event)"
          step="0.5"
          class="input text-sm w-16"
        />
        <span>–</span>
        <input
          type="number"
          data-testid="surface-y-max"
          :value="getRange('yRange')[1] ?? 2"
          @input="updateRange('yRange', 1, $event)"
          step="0.5"
          class="input text-sm w-16"
        />
      </div>
    </div>
    <div class="mt-2" v-if="element.type === 'prism'">
      <label class="block text-xs text-studio-text-muted mb-1">Dimensions (W × H × D)</label>
      <div class="grid grid-cols-3 gap-2">
        <input
          type="number"
          data-testid="prism-dimX"
          :value="element.dimX ?? 2"
          @input="update('dimX', $event)"
          step="0.5"
          min="0.1"
          class="input text-sm"
        />
        <input
          type="number"
          data-testid="prism-dimY"
          :value="element.dimY ?? 1"
          @input="update('dimY', $event)"
          step="0.5"
          min="0.1"
          class="input text-sm"
        />
        <input
          type="number"
          data-testid="prism-dimZ"
          :value="element.dimZ ?? 1"
          @input="update('dimZ', $event)"
          step="0.5"
          min="0.1"
          class="input text-sm"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SceneObject } from '@manim/codegen';

const props = defineProps({ element: { type: Object as () => SceneObject, required: true } });
const emit = defineEmits(['update']);

function update(key: string, e: Event) {
  emit('update', { [key]: parseFloat((e.target as HTMLInputElement).value) || 0 });
}

function getRange(field: string): number[] {
  const val = (props.element as unknown as Record<string, unknown>)[field];
  return (val as number[] | undefined) ?? [-3, 3, 1];
}

function updateRange(field: string, idx: number, e: Event) {
  const range = [...getRange(field)];
  range[idx] = parseFloat((e.target as HTMLInputElement).value) || 0;
  emit('update', { [field]: range });
}
</script>
