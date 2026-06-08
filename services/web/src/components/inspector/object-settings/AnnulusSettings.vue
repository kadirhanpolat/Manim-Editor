<template>
  <!-- Annulus settings -->
  <Section label="Annulus">
    <div class="grid grid-cols-2 gap-1.5">
      <Num
        label="Inner radius"
        :value="o.innerRadius ?? 35"
        :min="0"
        @input="u('innerRadius', $event)"
      />
      <Num
        label="Outer radius"
        :value="o.outerRadius ?? 70"
        :min="1"
        @input="u('outerRadius', $event)"
      />
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject, AnnulusObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const o = computed(() => props.obj as AnnulusObject);
</script>
