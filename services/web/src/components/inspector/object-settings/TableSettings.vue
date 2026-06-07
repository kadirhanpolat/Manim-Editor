<template>
  <!-- Table grid editor -->
  <Section label="Table">
    <div class="space-y-2">
      <div v-for="(row, r) in obj.cellData" :key="'tr' + r" class="flex gap-1">
        <input
          v-for="(cell, c) in row"
          :key="'tc' + r + '-' + c"
          data-test="table-cell"
          class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="cell"
          @input="store.setTableCell(obj.id, r, c, $event.target.value)"
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
          :checked="obj.mathMode"
          @change="store.setTableMathMode(obj.id, $event.target.checked)"
        />
        <label for="table-math-mode" class="text-[11px] text-studio-text-muted"
          >Math mode (MathTable)</label
        >
      </div>
      <div class="space-y-1 pt-1">
        <label class="block text-[10px] text-studio-text-muted">Row labels (comma-separated)</label>
        <input
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="(obj.rowLabels || []).join(', ')"
          @change="
            store.setTableRowLabels(
              obj.id,
              $event.target.value
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length)
            )
          "
        />
      </div>
      <div class="space-y-1">
        <label class="block text-[10px] text-studio-text-muted">Col labels (comma-separated)</label>
        <input
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="(obj.colLabels || []).join(', ')"
          @change="
            store.setTableColLabels(
              obj.id,
              $event.target.value
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length)
            )
          "
        />
      </div>
    </div>
  </Section>
</template>

<script setup>
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;
</script>
