<template>
  <!-- Star settings -->
  <Section label="Star Settings">
    <div class="grid grid-cols-2 gap-1.5">
      <Num
        label="Arms"
        :value="o.starArms ?? 5"
        :min="3"
        :max="20"
        @input="u('starArms', $event)"
      />
      <Num
        label="Inner Ratio"
        :value="o.innerRatio ?? 0.4"
        :min="0.1"
        :max="0.9"
        :step="0.05"
        @input="u('innerRatio', $event)"
      />
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject, StarObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const o = computed(() => props.obj as StarObject);
</script>
