<template>
  <!-- NumberPlane / ComplexPlane settings -->
  <Section :label="obj.type === 'complex_plane' ? 'ComplexPlane Range' : 'NumberPlane Range'">
    <div class="space-y-1.5">
      <div class="grid grid-cols-3 gap-1">
        <Num
          label="X Min"
          :value="(obj.xRange || [-3, 3, 1])[0]"
          :step="1"
          @input="uRange('xRange', 0, $event)"
        />
        <Num
          label="X Max"
          :value="(obj.xRange || [-3, 3, 1])[1]"
          :step="1"
          @input="uRange('xRange', 1, $event)"
        />
        <Num
          label="X Step"
          :value="(obj.xRange || [-3, 3, 1])[2]"
          :min="0.1"
          :step="0.5"
          @input="uRange('xRange', 2, $event)"
        />
      </div>
      <div class="grid grid-cols-3 gap-1">
        <Num
          label="Y Min"
          :value="(obj.yRange || [-2, 2, 1])[0]"
          :step="1"
          @input="uRange('yRange', 0, $event)"
        />
        <Num
          label="Y Max"
          :value="(obj.yRange || [-2, 2, 1])[1]"
          :step="1"
          @input="uRange('yRange', 1, $event)"
        />
        <Num
          label="Y Step"
          :value="(obj.yRange || [-2, 2, 1])[2]"
          :min="0.1"
          :step="0.5"
          @input="uRange('yRange', 2, $event)"
        />
      </div>
    </div>
  </Section>
</template>

<script setup>
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const { uRange } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>
