<template>
  <!-- Table grid editor -->
  <Section label="Table">
    <div class="space-y-2">
      <div v-for="(row, r) in cellData" :key="'tr' + r" class="flex gap-1">
        <input
          v-for="(cell, c) in row"
          :key="'tc' + r + '-' + c"
          data-test="table-cell"
          class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="cell"
          @input="onCellInput(r, c, $event)"
        />
      </div>
      <div class="flex gap-1 pt-1">
        <button
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="store.addTableRow(obj.id)"
        >
          + Row
        </button>
        <button
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="store.removeTableRow(obj.id)"
        >
          − Row
        </button>
        <button
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="store.addTableColumn(obj.id)"
        >
          + Col
        </button>
        <button
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="store.removeTableColumn(obj.id)"
        >
          − Col
        </button>
      </div>
      <div class="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="table-math-mode"
          :checked="!!obj.mathMode"
          @change="onMathMode($event)"
        />
        <label for="table-math-mode" class="text-[11px] text-studio-text-muted"
          >Math mode (MathTable)</label
        >
      </div>
      <div class="space-y-1 pt-1">
        <label class="block text-[10px] text-studio-text-muted">Row labels (comma-separated)</label>
        <input
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="rowLabels.join(', ')"
          @change="onRowLabels($event)"
        />
      </div>
      <div class="space-y-1">
        <label class="block text-[10px] text-studio-text-muted">Col labels (comma-separated)</label>
        <input
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="colLabels.join(', ')"
          @change="onColLabels($event)"
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
const cellData = computed(() => (obj.cellData as string[][] | undefined) ?? [[]]);
const rowLabels = computed(() => (obj.rowLabels as string[] | undefined) ?? []);
const colLabels = computed(() => (obj.colLabels as string[] | undefined) ?? []);
function onCellInput(r: number, c: number, e: Event) {
  store.setTableCell(obj.id, r, c, (e.target as HTMLInputElement).value);
}
function onMathMode(e: Event) {
  store.setTableMathMode(obj.id, (e.target as HTMLInputElement).checked);
}
function onRowLabels(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  store.setTableRowLabels(obj.id, val.split(',').map((s) => s.trim()).filter((s) => s.length));
}
function onColLabels(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  store.setTableColLabels(obj.id, val.split(',').map((s) => s.trim()).filter((s) => s.length));
}
</script>
