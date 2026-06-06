<template>
      <!-- Star settings -->
      <Section label="Star Settings">
        <div class="grid grid-cols-2 gap-1.5">
          <Num label="Arms" :value="obj.starArms || 5" :min="3" :max="20" @input="u('starArms', $event)" />
          <Num label="Inner Ratio" :value="(obj.innerRatio || 0.4)" :min="0.1" :max="0.9" :step="0.05" @input="u('innerRatio', $event)" />
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
