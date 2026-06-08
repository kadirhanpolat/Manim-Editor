<template>
  <div class="px-4 py-3 border-b border-studio-border">
    <span class="text-xs text-studio-text-muted uppercase tracking-wider">3D Camera Preview</span>
    <p class="text-[10px] text-studio-text-muted/60 mt-1">
      View: <span class="text-studio-text capitalize">{{ cam.view ?? 'perspective' }}</span> —
      choose from the overlay on the canvas.
    </p>

    <!-- Orbit angle (perspective only — axis views have fixed angles) -->
    <template v-if="isPerspective">
      <div class="mt-2">
        <label class="flex items-center justify-between text-xs text-studio-text-muted mb-1">
          <span>Phi (φ) — tilt</span>
          <span class="tabular-nums text-studio-text">{{ Math.round(cam.phi ?? 75) }}°</span>
        </label>
        <input
          type="range"
          data-testid="cam-phi"
          min="0"
          max="180"
          step="1"
          :value="cam.phi ?? 75"
          class="w-full accent-studio-accent"
          @input="setPhi($event)"
          @change="store.commitState()"
        />
      </div>
      <div class="mt-2">
        <label class="flex items-center justify-between text-xs text-studio-text-muted mb-1">
          <span>Theta (θ) — rotate</span>
          <span class="tabular-nums text-studio-text">{{ Math.round(cam.theta ?? -45) }}°</span>
        </label>
        <input
          type="range"
          data-testid="cam-theta"
          min="-180"
          max="180"
          step="1"
          :value="cam.theta ?? -45"
          class="w-full accent-studio-accent"
          @input="setTheta($event)"
          @change="store.commitState()"
        />
      </div>
    </template>

    <div class="mt-2">
      <label class="flex items-center justify-between text-xs text-studio-text-muted mb-1">
        <span>Zoom</span>
        <span class="tabular-nums text-studio-text">{{ (cam.zoom ?? 1).toFixed(2) }}×</span>
      </label>
      <input
        type="range"
        data-testid="cam-zoom"
        min="0.3"
        max="3"
        step="0.05"
        :value="cam.zoom ?? 1"
        class="w-full accent-studio-accent"
        @input="setZoom($event)"
        @change="store.commitState()"
      />
    </div>

    <div v-if="isPerspective" class="mt-2">
      <label class="block text-xs text-studio-text-muted mb-1">Focal Distance</label>
      <input
        type="number"
        data-testid="focal-distance"
        :value="cam.focalDistance ?? 8"
        min="2"
        step="1"
        class="input text-sm w-24"
        @change="setFocalDistance($event)"
      />
    </div>

    <button
      class="mt-2 w-full text-[10px] py-1 rounded bg-studio-bg hover:bg-studio-border text-studio-text-muted transition-colors"
      @click="store.setCamera3d({ phi: 75, theta: -45, zoom: 1 })"
    >
      Reset orbit (75° / −45° / 1×)
    </button>
    <p class="text-[10px] text-studio-text-muted/60 mt-2">
      Preview only — does not affect render output.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
const store = useProjectStore();
const cam = computed(() => store.project.camera3d ?? {});
const isPerspective = computed(() => (cam.value.view ?? 'perspective') === 'perspective');

function setPhi(e: Event) {
  store.project.camera3d.phi = Number((e.target as HTMLInputElement).value);
}
function setTheta(e: Event) {
  store.project.camera3d.theta = Number((e.target as HTMLInputElement).value);
}
function setZoom(e: Event) {
  store.project.camera3d.zoom = Number((e.target as HTMLInputElement).value);
}
function setFocalDistance(e: Event) {
  store.setCamera3d({ focalDistance: parseFloat((e.target as HTMLInputElement).value) || 8 });
}
</script>
