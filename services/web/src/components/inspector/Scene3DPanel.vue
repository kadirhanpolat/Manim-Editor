<template>
  <div class="px-4 py-3 border-b border-studio-border">
    <span class="text-xs text-studio-text-muted uppercase tracking-wider">3D Camera Preview</span>
    <div class="mt-2">
      <label class="block text-xs text-studio-text-muted mb-1">Projection</label>
      <select
        data-testid="projection-mode"
        :value="cam.projection ?? 'orthographic'"
        @change="store.setCamera3d({ projection: $event.target.value })"
        class="input text-sm w-full"
      >
        <option value="orthographic">Orthographic</option>
        <option value="perspective">Perspective</option>
      </select>
      <p class="text-[10px] text-studio-text-muted/60 mt-1">Preview only — does not affect render output.</p>
    </div>
    <div class="mt-2" v-if="(cam.projection ?? 'orthographic') === 'perspective'">
      <label class="block text-xs text-studio-text-muted mb-1">Focal Distance</label>
      <input
        type="number"
        data-testid="focal-distance"
        :value="cam.focalDistance ?? 8"
        @input="store.setCamera3d({ focalDistance: parseFloat($event.target.value) || 8 })"
        min="2" step="1" class="input text-sm w-24"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
const store = useProjectStore();
const cam = computed(() => store.project.camera3d ?? {});
</script>
