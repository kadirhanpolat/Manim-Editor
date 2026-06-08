<template>
  <div class="panel-header flex items-center justify-between">
    Camera Move
    <span class="px-1.5 py-0.5 text-[9px] rounded-md font-bold uppercase bg-cyan-600 text-white"
      >camera</span
    >
  </div>

  <Section label="Target Position">
    <div class="grid grid-cols-2 gap-1.5">
      <Num
        label="X"
        :value="(cc.params && cc.params.targetX) || 0"
        @input="updateCameraClip('targetX', $event)"
      />
      <Num
        label="Y"
        :value="(cc.params && cc.params.targetY) || 0"
        @input="updateCameraClip('targetY', $event)"
      />
    </div>
  </Section>

  <Section label="Zoom">
    <Num
      label="Zoom"
      :value="(cc.params && cc.params.zoom) || 1"
      :min="0.1"
      :step="0.1"
      @input="updateCameraClip('zoom', $event)"
    />
  </Section>

  <Section label="Timing">
    <div class="grid grid-cols-2 gap-1.5">
      <Num
        label="Start (s)"
        :value="cc.startTime"
        :min="0"
        :step="0.1"
        @input="uca('startTime', $event)"
      />
      <Num
        label="Duration (s)"
        :value="cc.duration"
        :min="0.1"
        :step="0.1"
        @input="uca('duration', $event)"
      />
    </div>
  </Section>

  <Section label="Easing">
    <select
      class="select text-xs"
      :value="cc.easing || 'ease_in_out'"
      @change="uca('easing', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="e in easings" :key="e.value" :value="e.value">{{ e.label }}</option>
    </select>
  </Section>

  <div class="px-3 py-3">
    <button class="btn btn-danger btn-xs w-full" @click="delCameraClip">Delete Camera Move</button>
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
const cameraClip = computed(() => {
  if (!store.selectedClipId) return null;
  return store.project.cameraTrack?.find((c) => c.id === store.selectedClipId) || null;
});
// cameraClip is guaranteed non-null when this component is rendered (guarded by parent)
const cc = computed(() => cameraClip.value!);

function updateCameraClip(param: string, value: unknown) {
  if (!cameraClip.value) return;
  store.updateCameraClip(cameraClip.value.id!, { params: { [param]: value } });
}
function uca(key: string, value: unknown) {
  if (!cameraClip.value) return;
  store.updateCameraClip(cameraClip.value.id!, { [key]: value });
}
function delCameraClip() {
  if (!cameraClip.value) return;
  store.deleteCameraClip(cameraClip.value.id!);
  store.selectedClipId = null;
}
</script>
