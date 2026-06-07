<template>
  <Section label="Vector">
    <div class="grid grid-cols-2 gap-1.5">
      <Num label="Vx" :value="obj.vx ?? 120" @input="u('vx', $event)" />
      <Num label="Vy" :value="obj.vy ?? -80" @input="u('vy', $event)" />
    </div>
    <p class="text-[10px] text-studio-text-muted mt-1.5">
      Object-relative px; Vy &lt; 0 points up. x/y components shown red/green.
    </p>
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
