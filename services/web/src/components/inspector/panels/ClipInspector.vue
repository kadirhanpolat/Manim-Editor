<template>
  <div class="panel-header flex items-center justify-between">
    Animation
    <span class="px-1.5 py-0.5 text-[9px] rounded-md font-bold uppercase" :class="clipBadge">{{
      clip.type
    }}</span>
  </div>

  <Section label="Timing">
    <div class="grid grid-cols-2 gap-1.5">
      <Num
        label="Start (s)"
        :value="clip.startTime"
        :min="0"
        :step="0.1"
        @input="uc('startTime', $event)"
      />
      <Num
        label="Duration (s)"
        :value="clip.duration"
        :min="0.1"
        :step="0.1"
        @input="uc('duration', $event)"
      />
    </div>
  </Section>

  <Section label="Easing">
    <select
      class="select text-xs"
      :value="clip.easing"
      @change="uc('easing', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="e in easings" :key="e.value" :value="e.value">{{ e.label }}</option>
    </select>
  </Section>

  <Section label="Overshoot">
    <div class="flex items-center gap-2">
      <input
        type="range"
        min="0"
        max="0.2"
        step="0.01"
        class="flex-1 accent-purple-500"
        :value="clip.overshoot || 0"
        aria-label="Animation overshoot"
        @input="uc('overshoot', Number(($event.target as HTMLInputElement).value))"
      />
      <span class="text-[10px] text-studio-text-muted w-8 text-right"
        >{{ ((clip.overshoot || 0) * 100).toFixed(0) }}%</span
      >
    </div>
  </Section>

  <Section v-if="clip.type === 'transform'" label="Morph Quality">
    <select
      class="select text-xs"
      :value="clip.morphQuality || 'medium'"
      @change="uc('morphQuality', ($event.target as HTMLSelectElement).value)"
    >
      <option value="low">Low (fast preview)</option>
      <option value="medium">Medium (balanced)</option>
      <option value="high">High (smooth)</option>
    </select>
  </Section>

  <Section v-if="clip.type === 'transform'" label="Objects">
    <div class="text-[10px] text-studio-text-muted space-y-0.5">
      <div>
        From: <strong class="text-studio-text">{{ oName(clip.sourceId) }}</strong>
      </div>
      <div>
        To: <strong class="text-studio-text">{{ oName(clip.targetId) }}</strong>
      </div>
    </div>
  </Section>

  <Section v-if="clip.type === 'move'" label="Target Position">
    <div class="grid grid-cols-2 gap-1.5">
      <Num label="X" :value="clip.params?.targetX ?? 0" @input="up('targetX', $event)" />
      <Num label="Y" :value="clip.params?.targetY ?? 0" @input="up('targetY', $event)" />
    </div>
  </Section>

  <Section v-if="clip.type === 'scale'" label="Target Scale">
    <div class="grid grid-cols-2 gap-1.5">
      <Num
        label="X"
        :value="clip.params?.targetScaleX ?? 1"
        :step="0.1"
        @input="up('targetScaleX', $event)"
      />
      <Num
        label="Y"
        :value="clip.params?.targetScaleY ?? 1"
        :step="0.1"
        @input="up('targetScaleY', $event)"
      />
    </div>
  </Section>

  <Section v-if="clip.type === 'fade'" label="Target Opacity">
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      class="w-full accent-orange-500"
      :value="clip.params?.targetOpacity ?? 0"
      aria-label="Target opacity"
      @input="up('targetOpacity', Number(($event.target as HTMLInputElement).value))"
    />
  </Section>

  <Section v-if="clip.type === 'rotate'" label="Target Rotation">
    <Num
      label="Degrees"
      :value="clip.params?.targetRotation ?? 360"
      @input="up('targetRotation', $event)"
    />
  </Section>

  <Section v-if="clip.type === 'indicate'" label="Indicate">
    <div class="space-y-1.5">
      <input
        type="color"
        class="w-full h-7 rounded"
        :value="p('color', '#FFFF00')"
        @input="up('color', ($event.target as HTMLInputElement).value)"
      />
      <div data-test="emph-scale-factor">
        <Num
          label="Scale factor"
          :value="p('scale_factor', 1.2)"
          :step="0.1"
          @input="up('scale_factor', $event)"
        />
      </div>
    </div>
  </Section>

  <Section v-if="clip.type === 'flash'" label="Flash">
    <div class="space-y-1.5">
      <input
        type="color"
        class="w-full h-7 rounded"
        :value="p('color', '#FFFF00')"
        @input="up('color', ($event.target as HTMLInputElement).value)"
      />
      <Num
        label="Flash radius"
        :value="p('flash_radius', 0.3)"
        :step="0.05"
        @input="up('flash_radius', $event)"
      />
      <Num
        label="Line length"
        :value="p('line_length', 0.2)"
        :step="0.05"
        @input="up('line_length', $event)"
      />
      <Num
        label="Num lines"
        :value="p('num_lines', 12)"
        :step="1"
        @input="up('num_lines', $event)"
      />
    </div>
  </Section>

  <Section v-if="clip.type === 'wiggle'" label="Wiggle">
    <div class="space-y-1.5">
      <Num
        label="Scale value"
        :value="p('scale_value', 1.1)"
        :step="0.05"
        @input="up('scale_value', $event)"
      />
      <Num
        label="Rotation angle (deg)"
        :value="p('rotation_angle', 3.6)"
        :step="0.5"
        @input="up('rotation_angle', $event)"
      />
      <Num
        label="Num wiggles"
        :value="p('n_wiggles', 6)"
        :step="1"
        @input="up('n_wiggles', $event)"
      />
    </div>
  </Section>

  <Section v-if="clip.type === 'circumscribe'" label="Circumscribe">
    <div class="space-y-1.5">
      <input
        type="color"
        class="w-full h-7 rounded"
        :value="p('color', '#FFFF00')"
        @input="up('color', ($event.target as HTMLInputElement).value)"
      />
      <select
        class="select text-sm w-full"
        :value="p('shape', 'Rectangle')"
        @change="up('shape', ($event.target as HTMLSelectElement).value)"
      >
        <option value="Rectangle">Rectangle</option>
        <option value="Circle">Circle</option>
      </select>
      <label class="flex items-center gap-2 text-xs text-studio-text-muted cursor-pointer">
        <input
          type="checkbox"
          :checked="p('fade_out', false)"
          @change="up('fade_out', ($event.target as HTMLInputElement).checked)"
        />
        Fade out
      </label>
      <Num
        label="Time width"
        :value="p('time_width', 0.3)"
        :step="0.05"
        @input="up('time_width', $event)"
      />
    </div>
  </Section>

  <Section v-if="clip.type === 'focus_on'" label="Focus On">
    <div class="space-y-1.5">
      <input
        type="color"
        class="w-full h-7 rounded"
        :value="p('color', '#FFFFFF')"
        @input="up('color', ($event.target as HTMLInputElement).value)"
      />
      <Num
        label="Dim opacity"
        :value="p('opacity', 0.2)"
        :step="0.05"
        @input="up('opacity', $event)"
      />
    </div>
  </Section>

  <Section label="Parallel (AnimationGroup)">
    <div class="space-y-1.5">
      <label class="flex items-center gap-2 text-xs text-studio-text-muted cursor-pointer">
        <input
          type="checkbox"
          :checked="clip.parallel"
          class="accent-violet-500"
          @change="uc('parallel', ($event.target as HTMLInputElement).checked)"
        />
        Run in parallel with same-time clips
      </label>
      <div v-if="clip.parallel" class="flex items-center gap-2">
        <span
          class="text-[9px] text-studio-text-muted w-16"
          title="Applied to the whole parallel group (highest value wins)"
          >Lag ratio</span
        >
        <input
          type="number"
          class="input input-sm w-16"
          :value="clip.lag_ratio || 0"
          min="0"
          max="1"
          step="0.1"
          @input="uc('lag_ratio', Number(($event.target as HTMLInputElement).value))"
        />
        <span class="text-[8px] text-studio-text-muted/50">0 = AnimationGroup</span>
      </div>
    </div>
  </Section>

  <div class="px-3 py-3">
    <button class="btn btn-danger btn-xs w-full" @click="delClip">Delete Animation</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import { EASING_LIST } from '../../../engine/easing.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';

const store = useProjectStore();
const easings = EASING_LIST;
const clip = computed(() => store.selectedClip!);

const clipBadge = computed(() => {
  const m: Record<string, string> = {
    transform: 'bg-purple-600 text-white',
    move: 'bg-blue-600 text-white',
    scale: 'bg-green-600 text-white',
    fade: 'bg-orange-600 text-white',
    rotate: 'bg-pink-600 text-white',
  };
  return m[clip.value?.type ?? ''] || 'bg-gray-600 text-white';
});

function p<T>(key: string, fallback: T): T {
  return (clip.value?.params?.[key] as T | undefined) ?? fallback;
}

function uc(k: string, v: unknown) {
  if (clip.value) store.updateClip(clip.value.id!, { [k]: v });
}
function up(k: string, v: unknown) {
  if (clip.value)
    store.updateClip(clip.value.id!, { params: { ...(clip.value.params || {}), [k]: v } });
}
function oName(id: string | undefined) {
  if (!id) return '(none)';
  const o = store.objectById(id);
  return o ? (o.name ?? id) : '(deleted)';
}
function delClip() {
  if (clip.value) store.deleteClip(clip.value.id!);
}
</script>
