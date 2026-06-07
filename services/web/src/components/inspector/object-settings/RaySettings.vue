<template>
  <Section label="Ray">
    <div class="grid grid-cols-2 gap-1.5">
      <Num label="Angle°" :value="obj.angle ?? 30" @input="u('angle', $event)" />
      <Num label="Length" :value="obj.length ?? 200" :min="1" @input="u('length', $event)" />
    </div>
    <p class="text-[10px] text-studio-text-muted mt-1.5">
      Source dot at the object position; arrow points at the angle (0° = right, CCW).
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
