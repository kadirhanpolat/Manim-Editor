<template>
  <!-- PolarPlane settings -->
  <Section label="PolarPlane">
    <div class="space-y-1.5">
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-24">Radius Max</span>
        <input
          type="number"
          step="0.5"
          min="1"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.radiusMax ?? 4"
          @change="store.setPolarRadiusMax(obj.id, $event.target.value)"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-24">Radius Step</span>
        <input
          type="number"
          step="0.5"
          min="0.1"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.radiusStep ?? 1"
          @change="store.setPolarRadiusStep(obj.id, $event.target.value)"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-24">Azimuth Units</span>
        <input
          type="number"
          step="1"
          min="1"
          class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
          :value="obj.azimuthUnits ?? 12"
          @change="store.setPolarAzimuth(obj.id, $event.target.value)"
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
