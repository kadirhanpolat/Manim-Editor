<template>
  <div class="px-4 py-3 border-b border-studio-border">
    <span class="text-xs text-studio-text-muted uppercase tracking-wider">3D Camera Preview</span>

    <!-- Camera angle (drives the iso preview projection) -->
    <div class="mt-2">
      <label class="flex items-center justify-between text-xs text-studio-text-muted mb-1">
        <span>Phi (φ) — tilt</span>
        <span class="tabular-nums text-studio-text">{{ Math.round(cam.phi ?? 75) }}°</span>
      </label>
      <input
        type="range" data-testid="cam-phi" min="0" max="180" step="1"
        :value="cam.phi ?? 75"
        @input="store.project.camera3d.phi = Number($event.target.value)"
        @change="store.commitState()"
        class="w-full accent-studio-accent"
      />
    </div>
    <div class="mt-2">
      <label class="flex items-center justify-between text-xs text-studio-text-muted mb-1">
        <span>Theta (θ) — rotate</span>
        <span class="tabular-nums text-studio-text">{{ Math.round(cam.theta ?? -45) }}°</span>
      </label>
      <input
        type="range" data-testid="cam-theta" min="-180" max="180" step="1"
        :value="cam.theta ?? -45"
        @input="store.project.camera3d.theta = Number($event.target.value)"
        @change="store.commitState()"
        class="w-full accent-studio-accent"
      />
    </div>
    <div class="mt-2">
      <label class="flex items-center justify-between text-xs text-studio-text-muted mb-1">
        <span>Zoom</span>
        <span class="tabular-nums text-studio-text">{{ (cam.zoom ?? 1).toFixed(2) }}×</span>
      </label>
      <input
        type="range" data-testid="cam-zoom" min="0.3" max="3" step="0.05"
        :value="cam.zoom ?? 1"
        @input="store.project.camera3d.zoom = Number($event.target.value)"
        @change="store.commitState()"
        class="w-full accent-studio-accent"
      />
    </div>
    <button
      class="mt-2 w-full text-[10px] py-1 rounded bg-studio-bg hover:bg-studio-border text-studio-text-muted transition-colors"
      @click="store.setCamera3d({ phi: 75, theta: -45, zoom: 1 })"
    >Reset angle (75° / −45° / 1×)</button>

    <div class="mt-3">
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
        @change="store.setCamera3d({ focalDistance: parseFloat($event.target.value) || 8 })"
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
