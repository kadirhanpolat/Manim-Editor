<template>
  <!-- Code block settings -->
  <Section label="Code">
    <div class="space-y-1.5">
      <textarea
        data-test="code-text"
        rows="8"
        spellcheck="false"
        class="w-full px-2 py-1 text-[11px] font-mono rounded bg-studio-bg border border-studio-border text-studio-text"
        :value="(obj.codeText as string) ?? ''"
        @input="onCodeInput($event)"
      ></textarea>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Language</span>
        <select
          data-test="code-language"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="(obj.language as string) ?? 'python'"
          @change="onLanguageChange($event)"
        >
          <option v-for="l in CODE_LANGUAGES" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Font size</span>
        <input
          data-test="code-fontsize"
          type="number"
          min="6"
          step="1"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.fontSize ?? 18"
          @change="onFontSizeChange($event)"
        />
      </div>
      <p class="text-[10px] text-studio-text-muted">
        Preview has no syntax highlighting (render uses Pygments). Font size affects the preview
        only — render size follows the block width.
      </p>
    </div>
  </Section>
</template>

<script setup lang="ts">
import type { SceneObject } from '@manim/codegen';
import { CODE_LANGUAGES } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const obj = props.obj;
function commit() {
  store.isDirty = true;
  store.commitState();
}
function onCodeInput(e: Event) {
  obj.codeText = (e.target as HTMLTextAreaElement).value;
  commit();
}
function onLanguageChange(e: Event) {
  obj.language = (e.target as HTMLSelectElement).value;
  commit();
}
function onFontSizeChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  obj.fontSize = Number.isFinite(v) && v >= 6 ? v : 18;
  commit();
}
</script>
