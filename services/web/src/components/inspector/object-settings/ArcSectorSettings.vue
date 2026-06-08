<template>
  <!-- Arc / Sector settings -->
  <Section :label="o.type === 'arc' ? 'Arc' : 'Sector'">
    <div class="grid grid-cols-3 gap-1.5">
      <Num
        label="Radius"
        :value="o.radius ?? 70"
        :min="1"
        @input="u('radius', $event)"
      />
      <Num
        label="Start°"
        :value="o.startAngle ?? 0"
        @input="u('startAngle', $event)"
      />
      <Num
        label="Sweep°"
        :value="o.sweepAngle ?? 90"
        @input="u('sweepAngle', $event)"
      />
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject, ArcSectorObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const o = computed(() => props.obj as ArcSectorObject);
</script>
