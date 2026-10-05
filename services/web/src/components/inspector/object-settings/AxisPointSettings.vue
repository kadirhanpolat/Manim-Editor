<template>
  <!-- axis_point: a point placed by its value on an axes object -->
  <Section label="Axis Point">
    <div class="space-y-2">
      <div>
        <label class="block text-[10px] text-studio-text-muted mb-1">Axes</label>
        <select
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.targetId ?? ''"
          aria-label="Target axes"
          @change="onTargetChange($event)"
        >
          <option value="">— select —</option>
          <option v-for="candidate in axesObjects" :key="candidate.id" :value="candidate.id">
            {{ candidate.name || candidate.type }} ({{ candidate.id.slice(0, 6) }})
          </option>
        </select>
        <p v-if="!obj.targetId" class="text-[10px] text-yellow-400 mt-1">
          Choose the axes this point sits on
        </p>
      </div>

      <div class="grid grid-cols-2 gap-1.5">
        <Num
          label="x value"
          :value="(obj.valueX as number) ?? 0"
          :step="0.1"
          @input="u('valueX', $event)"
        />
        <Num
          label="y value"
          :value="(obj.valueY as number) ?? 0"
          :step="0.1"
          @input="u('valueY', $event)"
        />
      </div>

      <div>
        <label class="block text-[10px] text-studio-text-muted mb-1">Label (LaTeX)</label>
        <input
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="(obj.label as string) ?? ''"
          placeholder="e.g. P_1"
          aria-label="Point label"
          @change="u('label', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <label class="flex items-center gap-2 text-[11px] text-studio-text">
        <input
          type="checkbox"
          :checked="!!obj.showGuides"
          aria-label="Show guide lines to the axes"
          @change="u('showGuides', ($event.target as HTMLInputElement).checked)"
        />
        Dashed guides to the axes
      </label>

      <ColorRow
        label="Color"
        :value="(obj.fill as string) ?? '#f97316'"
        @input="onColorChange($event)"
      />
      <Num
        label="Size (px)"
        :value="(obj.width as number) ?? 22"
        :min="4"
        @input="onSizeChange($event)"
      />
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import ColorRow from '../ui/ColorRow.vue';
import Num from '../ui/Num.vue';

const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });

const store = useProjectStore();
const { u } = useObjectUpdate(() => props.obj);

const AXES_TYPES = new Set(['axes', 'numberplane', 'complex_plane']);
const axesObjects = computed(() => store.project.objects.filter((o) => AXES_TYPES.has(o.type)));

function onTargetChange(e: Event) {
  store.setAnnotationTarget(props.obj.id, (e.target as HTMLSelectElement).value);
}

function onColorChange(value: string) {
  store.updateObject(props.obj.id, { fill: value, stroke: value });
}

function onSizeChange(value: number) {
  store.updateObject(props.obj.id, { width: value, height: value });
}
</script>
