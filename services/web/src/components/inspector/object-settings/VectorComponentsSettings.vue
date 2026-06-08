<template>
  <Section label="Vector">
    <div class="grid grid-cols-2 gap-1.5">
      <Num label="Vx" :value="o.vx ?? 120" @input="u('vx', $event)" />
      <Num label="Vy" :value="o.vy ?? -80" @input="u('vy', $event)" />
    </div>
    <p class="text-[10px] text-studio-text-muted mt-1.5">
      Object-relative px; Vy &lt; 0 points up. x/y components shown red/green.
    </p>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject, VectorComponentsObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const o = computed(() => props.obj as VectorComponentsObject);
</script>
