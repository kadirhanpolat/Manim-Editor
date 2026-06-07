<template>
  <!-- Matrix grid editor -->
  <Section label="Matrix">
    <div class="space-y-2">
      <div v-for="(row, r) in obj.matrixData" :key="'mr' + r" class="flex gap-1">
        <input
          v-for="(cell, c) in row"
          :key="'mc' + r + '-' + c"
          data-test="matrix-cell"
          class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="cell"
          @input="store.setMatrixCell(obj.id, r, c, $event.target.value)"
        />
      </div>
      <div class="flex gap-1 pt-1">
        <button
          data-test="matrix-add-row"
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="store.addMatrixRow(obj.id)"
        >
          + Row
        </button>
        <button
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="store.removeMatrixRow(obj.id)"
        >
          − Row
        </button>
        <button
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="store.addMatrixColumn(obj.id)"
        >
          + Col
        </button>
        <button
          class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted"
          @click="store.removeMatrixColumn(obj.id)"
        >
          − Col
        </button>
      </div>
      <div class="flex gap-1 items-center pt-1">
        <span class="text-[10px] text-studio-text-muted">Brackets</span>
        <button
          class="flex-1 py-1 text-[11px] rounded border"
          :class="
            obj.bracket === '['
              ? 'border-studio-accent text-studio-accent'
              : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'
          "
          @click="store.setMatrixBracket(obj.id, '[')"
        >
          [ ]
        </button>
        <button
          class="flex-1 py-1 text-[11px] rounded border"
          :class="
            obj.bracket === '('
              ? 'border-studio-accent text-studio-accent'
              : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'
          "
          @click="store.setMatrixBracket(obj.id, '(')"
        >
          ( )
        </button>
        <button
          class="flex-1 py-1 text-[11px] rounded border"
          :class="
            obj.bracket === '|'
              ? 'border-studio-accent text-studio-accent'
              : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'
          "
          @click="store.setMatrixBracket(obj.id, '|')"
        >
          | |
        </button>
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
