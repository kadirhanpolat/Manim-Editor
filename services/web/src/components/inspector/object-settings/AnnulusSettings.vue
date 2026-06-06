<template>
      <!-- Annulus settings -->
      <Section label="Annulus">
        <div class="grid grid-cols-2 gap-1.5">
          <Num label="Inner radius" :value="obj.innerRadius || 35" :min="0" @input="u('innerRadius', $event)" />
          <Num label="Outer radius" :value="obj.outerRadius || 70" :min="1" @input="u('outerRadius', $event)" />
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
