<template>
  <!-- NumberPlane / ComplexPlane settings -->
  <Section :label="o.type === 'complex_plane' ? 'ComplexPlane Range' : 'NumberPlane Range'">
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
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject, PlaneObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { uRange } = useObjectUpdate(() => props.obj);
const o = computed(() => props.obj as PlaneObject);
const xRange = computed(() => o.value.xRange ?? [-3, 3, 1]);
const yRange = computed(() => o.value.yRange ?? [-2, 2, 1]);
</script>
