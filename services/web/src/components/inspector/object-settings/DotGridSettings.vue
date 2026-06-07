<template>
  <!-- Dot Grid -->
  <Section label="Grid Settings">
    <div class="grid grid-cols-2 gap-1.5">
      <Num
        label="Columns"
        :value="obj.gridCols || 5"
        :min="1"
        :max="20"
        @input="u('gridCols', $event)"
      />
      <Num
        label="Rows"
        :value="obj.gridRows || 5"
        :min="1"
        :max="20"
        @input="u('gridRows', $event)"
      />
      <Num
        label="Spacing"
        :value="obj.dotSpacing || 40"
        :min="5"
        @input="u('dotSpacing', $event)"
      />
      <Num label="Radius" :value="obj.dotRadius || 5" :min="1" @input="u('dotRadius', $event)" />
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
