<template>
  <Section label="Text Content">
    <textarea
      class="input input-sm resize-none"
      rows="3"
      :value="(obj.content as string) || ''"
      placeholder="Enter text..."
      @input="onContent($event)"
    ></textarea>
  </Section>
  <Section label="Text Style">
    <div class="space-y-1.5">
      <ColorRow label="Color" :value="obj.fill as string | undefined" @input="u('fill', $event)" />
      <div class="grid grid-cols-2 gap-1.5">
        <Num
          label="Font Size"
          :value="(obj.fontSize as number | undefined) ?? 48"
          :min="8"
          :max="200"
          @input="u('fontSize', $event)"
        />
        <div>
          <span class="text-[9px] text-studio-text-muted/50">Align</span>
          <div class="flex gap-0.5 mt-0.5">
            <button
              class="align-btn"
              :class="{ active: ((obj.textAlign as string | undefined) ?? 'center') === 'left' }"
              title="Align Left"
              @click="u('textAlign', 'left')"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="18" y2="18" />
              </svg>
            </button>
            <button
              class="align-btn"
              :class="{ active: ((obj.textAlign as string | undefined) ?? 'center') === 'center' }"
              title="Align Center"
              @click="u('textAlign', 'center')"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="6" y1="12" x2="18" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <button
              class="align-btn"
              :class="{ active: ((obj.textAlign as string | undefined) ?? 'center') === 'right' }"
              title="Align Right"
              @click="u('textAlign', 'right')"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="9" y1="12" x2="21" y2="12" />
                <line x1="6" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <FontSelector
          :value="(obj.fontFamily as string | undefined) ?? 'Roboto'"
          @input="u('fontFamily', $event)"
        />
        <div>
          <span class="text-[9px] text-studio-text-muted/50">Weight</span>
          <select
            class="select text-xs"
            :value="(obj.fontWeight as string | undefined) ?? 'normal'"
            @change="onFontWeight($event)"
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>
      </div>
    </div>
  </Section>
</template>

<script setup lang="ts">
import type { SceneObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
import ColorRow from '../ui/ColorRow.vue';
import FontSelector from '../FontSelector.vue';

const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const obj = props.obj;
function onContent(e: Event) {
  u('content', (e.target as HTMLTextAreaElement).value);
}
function onFontWeight(e: Event) {
  u('fontWeight', (e.target as HTMLSelectElement).value);
}
</script>

<style scoped>
.align-btn {
  @apply flex items-center justify-center w-8 h-7 rounded-md border border-studio-border;
  @apply text-studio-text-muted hover:text-studio-text hover:bg-studio-border/50 transition-all;
}
.align-btn.active {
  @apply bg-studio-accent/20 border-studio-accent text-studio-accent;
}
</style>
