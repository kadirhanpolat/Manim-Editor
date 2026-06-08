<template>
  <!-- Annulus settings -->
  <Section label="Annulus">
    <div class="grid grid-cols-2 gap-1.5">
      <Num
        label="Inner radius"
        :value="(obj.innerRadius as number | undefined) ?? 35"
        :min="0"
        @input="u('innerRadius', $event)"
      />
      <Num
        label="Outer radius"
        :value="(obj.outerRadius as number | undefined) ?? 70"
        :min="1"
        @input="u('outerRadius', $event)"
      />
    </div>
  </Section>
</template>

<script setup lang="ts">
import type { SceneObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>
