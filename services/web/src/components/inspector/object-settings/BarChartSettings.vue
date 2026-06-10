<template>
  <!-- Bar chart editor (adapted from the Matrix grid editor) -->
  <Section label="Bar Chart">
    <div class="space-y-2">
      <div class="text-[10px] text-studio-text-muted">Values</div>
      <div class="flex gap-1">
        <input
          v-for="(v, i) in values"
          :key="'bv' + i"
          data-test="bar-value"
          type="number"
          step="0.1"
          class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="v"
          @change="onValueChange(i, $event)"
        />
      </div>
      <div class="text-[10px] text-studio-text-muted">Names</div>
      <div class="flex gap-1">
        <input
          v-for="(nm, i) in barNames"
          :key="'bn' + i"
          data-test="bar-name"
          class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="nm"
          @input="onNameInput(i, $event)"
        />
      </div>
      <div class="text-[10px] text-studio-text-muted">Colors</div>
      <div class="flex gap-1">
        <input
          v-for="(c, i) in barColors"
          :key="'bc' + i"
          data-test="bar-color"
          type="color"
          class="w-full min-w-0 h-6 rounded bg-studio-bg border border-studio-border"
          :value="c"
          @input="onColorInput(i, $event)"
        />
      </div>
      <div class="flex gap-1 pt-1">
        <button
          data-test="bar-add"
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="addBar"
        >
          + Bar
        </button>
        <button
          data-test="bar-remove"
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="removeBar"
        >
          − Bar
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Y max</span>
        <input
          data-test="bar-ymax"
          type="number"
          min="0.1"
          step="0.5"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="(obj.yMax as number) ?? 8"
          @change="onYMaxChange($event)"
        />
      </div>
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const obj = props.obj;
const values = computed<number[]>(() => (obj.values as number[] | undefined) ?? []);
const barNames = computed<string[]>(() => (obj.barNames as string[] | undefined) ?? []);
const barColors = computed<string[]>(() => (obj.barColors as string[] | undefined) ?? []);
function commit() {
  store.isDirty = true;
  store.commitState();
}
function onValueChange(i: number, e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  (obj.values as number[])[i] = Number.isFinite(v) ? v : 0;
  commit();
}
function onNameInput(i: number, e: Event) {
  (obj.barNames as string[])[i] = (e.target as HTMLInputElement).value;
  commit();
}
function onColorInput(i: number, e: Event) {
  (obj.barColors as string[])[i] = (e.target as HTMLInputElement).value;
  commit();
}
function addBar() {
  const vs = obj.values as number[];
  vs.push(1);
  (obj.barNames as string[]).push(String.fromCharCode(65 + ((vs.length - 1) % 26)));
  (obj.barColors as string[]).push('#58c4dd');
  commit();
}
function removeBar() {
  const vs = obj.values as number[];
  if (vs.length <= 1) return; // keep at least one bar
  vs.pop();
  (obj.barNames as string[]).pop();
  (obj.barColors as string[]).pop();
  commit();
}
function onYMaxChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  obj.yMax = Number.isFinite(v) && v >= 0.1 ? v : 8; // clamp ≥ 0.1 (mirrors setPolarRadiusMax guard)
  commit();
}
</script>
