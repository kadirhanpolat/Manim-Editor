<template>
  <Section label="Coordinate Point">
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-studio-text-muted w-20">Decimals</span>
      <input
        type="number"
        step="1"
        min="0"
        class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
        :value="obj.decimals ?? 1"
        @change="u('decimals', Math.max(0, Math.trunc(Number((($event.target) as HTMLInputElement).value) || 0)))"
      />
    </div>
    <p class="text-[10px] text-studio-text-muted mt-1.5">
      Label shows the dot's live (x, y) Manim coordinates — updates as it animates (always_redraw).
    </p>
  </Section>
</template>

<script setup lang="ts">
import type { SceneObject } from '@manim/codegen';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>
