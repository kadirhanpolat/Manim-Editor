<template>
  <!-- Polygon settings -->
  <Section label="Polygon Settings">
    <Num label="Sides" :value="(obj.sides as number | undefined) ?? 6" :min="3" :max="20" @input="u('sides', $event)" />
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
