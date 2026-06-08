<template>
  <!-- Vector Field settings -->
  <Section label="Vector Field">
    <div class="space-y-1.5">
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-8">fx</span>
        <input
          class="input input-sm flex-1"
          :value="o.fx"
          @change="onFx($event)"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-8">fy</span>
        <input
          class="input input-sm flex-1"
          :value="o.fy"
          @change="onFy($event)"
        />
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <Num label="x min" :value="xRange[0]" @input="setXRange(0, $event)" />
        <Num label="x max" :value="xRange[1]" @input="setXRange(1, $event)" />
        <Num label="x step" :value="xRange[2]" @input="setXRange(2, $event)" />
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <Num label="y min" :value="yRange[0]" @input="setYRange(0, $event)" />
        <Num label="y max" :value="yRange[1]" @input="setYRange(1, $event)" />
        <Num label="y step" :value="yRange[2]" @input="setYRange(2, $event)" />
      </div>
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject, VectorFieldObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const o = computed(() => props.obj as VectorFieldObject);
const xRange = computed(() => o.value.xRange ?? [-3, 3, 1]);
const yRange = computed(() => o.value.yRange ?? [-2, 2, 1]);
function onFx(e: Event) {
  store.setFieldExpr(o.value.id, 'fx', (e.target as HTMLInputElement).value);
}
function onFy(e: Event) {
  store.setFieldExpr(o.value.id, 'fy', (e.target as HTMLInputElement).value);
}
function setXRange(idx: number, val: number) {
  const r = [...xRange.value];
  r[idx] = val;
  store.setFieldRange(o.value.id, 'xRange', r);
}
function setYRange(idx: number, val: number) {
  const r = [...yRange.value];
  r[idx] = val;
  store.setFieldRange(o.value.id, 'yRange', r);
}
</script>
