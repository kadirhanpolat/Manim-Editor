<template>
  <!-- Arc / Sector settings -->
  <Section :label="obj.type === 'arc' ? 'Arc' : 'Sector'">
    <div class="grid grid-cols-3 gap-1.5">
      <Num label="Radius" :value="obj.radius || 70" :min="1" @input="u('radius', $event)" />
      <Num label="Start°" :value="obj.startAngle || 0" @input="u('startAngle', $event)" />
      <Num label="Sweep°" :value="obj.sweepAngle || 90" @input="u('sweepAngle', $event)" />
    </div>
  </Section>
</template>

<script setup>
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>
