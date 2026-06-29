<template>
  <!-- Annotation: surrounding_rect / underline / cross -->
  <Section label="Annotation">
    <div class="space-y-2">
      <!-- Target picker -->
      <div>
        <label class="block text-[10px] text-studio-text-muted mb-1">Target object</label>
        <select
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.targetId ?? ''"
          @change="onTargetChange($event)"
        >
          <option value="">— select —</option>
          <option v-for="candidate in otherObjects" :key="candidate.id" :value="candidate.id">
            {{ candidate.name || candidate.type }} ({{ candidate.id.slice(0, 6) }})
          </option>
        </select>
        <p v-if="!obj.targetId" class="text-[10px] text-yellow-400 mt-1">Choose a target object</p>
      </div>

      <!-- Color -->
      <ColorRow
        label="Color"
        :value="(obj.color as string) ?? '#ffffff'"
        @input="onColorChange($event)"
      />

      <!-- strokeWidth -->
      <div class="grid grid-cols-2 gap-1.5">
        <Num
          label="Stroke width"
          :value="(obj.strokeWidth as number) ?? 2"
          :min="0.5"
          :step="0.5"
          @input="u('strokeWidth', $event)"
        />

        <!-- buff: surrounding_rect + underline only -->
        <Num
          v-if="obj.type !== 'cross'"
          label="Padding (px)"
          :value="(obj.buff as number) ?? (obj.type === 'underline' ? 6 : 10)"
          :min="0"
          @input="u('buff', $event)"
        />
      </div>

      <!-- cornerRadius: surrounding_rect only -->
      <div v-if="obj.type === 'surrounding_rect'" class="grid grid-cols-2 gap-1.5">
        <Num
          label="Corner radius"
          :value="(obj.cornerRadius as number) ?? 0"
          :min="0"
          @input="u('cornerRadius', $event)"
        />
      </div>
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

const otherObjects = computed(() => store.project.objects.filter((o) => o.id !== props.obj.id));

function onTargetChange(e: Event) {
  store.setAnnotationTarget(props.obj.id, (e.target as HTMLSelectElement).value);
}

function onColorChange(value: string) {
  store.updateObject(props.obj.id, { color: value, fill: value, stroke: value });
}
</script>
