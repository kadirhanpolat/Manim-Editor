<template>
      <!-- NumberLine settings (1D — x_range + length) -->
      <Section label="NumberLine Range">
        <div class="space-y-1.5">
          <div class="grid grid-cols-3 gap-1">
            <Num label="X Min" :value="(obj.xRange||[-5,5,1])[0]" :step="1" @input="uRange('xRange', 0, $event)" />
            <Num label="X Max" :value="(obj.xRange||[-5,5,1])[1]" :step="1" @input="uRange('xRange', 1, $event)" />
            <Num label="X Step" :value="(obj.xRange||[-5,5,1])[2]" :min="0.1" :step="0.5" @input="uRange('xRange', 2, $event)" />
          </div>
          <Num label="Length (px)" :value="obj.width" :min="1" @input="u('width', $event)" />
        </div>
      </Section>
</template>

<script setup>
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const { u, uRange } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>
