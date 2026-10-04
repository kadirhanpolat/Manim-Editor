<template>
  <!-- LaTeX settings -->
  <Section label="LaTeX Expression">
    <textarea
      class="input input-sm resize-none font-mono"
      rows="2"
      :value="o.latex ?? ''"
      placeholder="E = mc^2"
      @input="onLatexInput($event)"
    ></textarea>
    <p class="text-[8px] text-studio-text-muted/40 mt-1 leading-snug">
      Raw LaTeX — canvas shows an approximate preview; Manim renders it as MathTex
    </p>
  </Section>
  <Section label="Size">
    <label class="flex items-center gap-1.5 text-[10px] text-studio-text-muted">
      <input
        data-test="latex-fit-box"
        type="checkbox"
        :checked="fitBox"
        aria-label="Fit formula to box"
        @change="onFitChange($event)"
      />
      Fit to box
    </label>
    <div v-if="!fitBox" class="flex items-center gap-2 mt-1.5">
      <span class="text-[10px] text-studio-text-muted w-20">Font size</span>
      <input
        data-test="latex-fontsize"
        type="number"
        min="8"
        max="200"
        step="1"
        aria-label="LaTeX font size"
        class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
        :value="o.fontSize ?? DEFAULT_FONT_SIZE"
        @change="onFontSizeChange($event)"
      />
    </div>
    <p class="text-[8px] text-studio-text-muted/40 mt-1 leading-snug">
      Fit to box scales the formula to fit the object's box; a font size renders it at a fixed size
      like a text object.
    </p>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject, LatexObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const o = computed(() => props.obj as LatexObject);
// Manim's MathTex default font_size
const DEFAULT_FONT_SIZE = 48;
const fitBox = computed(() => typeof o.value.fontSize !== 'number');
function onLatexInput(e: Event) {
  u('latex', (e.target as HTMLTextAreaElement).value);
}
function onFitChange(e: Event) {
  u('fontSize', (e.target as HTMLInputElement).checked ? undefined : DEFAULT_FONT_SIZE);
}
function onFontSizeChange(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(v) && v > 0) u('fontSize', Math.round(v));
}
</script>
