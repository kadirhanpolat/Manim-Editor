<template>
  <!-- LaTeX settings -->
  <Section label="LaTeX Expression">
    <textarea
      class="input input-sm resize-none font-mono"
      rows="2"
      :value="obj.latex || ''"
      @input="u('latex', $event.target.value)"
      placeholder="E = mc^2"
    ></textarea>
    <p class="text-[8px] text-studio-text-muted/40 mt-1 leading-snug">
      Raw LaTeX — canvas shows an approximate preview; Manim renders it as MathTex
    </p>
  </Section>
</template>

<script setup>
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>
