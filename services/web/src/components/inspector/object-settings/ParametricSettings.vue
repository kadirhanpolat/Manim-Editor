<template>
  <!-- Parametric settings -->
  <Section label="Parametric">
    <div class="space-y-1.5">
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-8">x(t)</span>
        <input
          class="input input-sm flex-1"
          :value="obj.xExpr as string | undefined"
          @change="onXExpr($event)"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-8">y(t)</span>
        <input
          class="input input-sm flex-1"
          :value="obj.yExpr as string | undefined"
          @change="onYExpr($event)"
        />
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <Num
          label="t min"
          :value="(obj.tMin as number | undefined) ?? 0"
          @input="u('tMin', $event)"
        />
        <Num
          label="t max"
          :value="(obj.tMax as number | undefined) ?? 6.283"
          @input="u('tMax', $event)"
        />
      </div>
    </div>
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
function onXExpr(e: Event) {
  u('xExpr', (e.target as HTMLInputElement).value);
}
function onYExpr(e: Event) {
  u('yExpr', (e.target as HTMLInputElement).value);
}
</script>
