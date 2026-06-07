<template>
  <!-- Polygon settings -->
  <Section label="Polygon Settings">
    <Num label="Sides" :value="obj.sides || 6" :min="3" :max="20" @input="u('sides', $event)" />
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
