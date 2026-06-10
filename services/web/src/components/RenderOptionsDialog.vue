<template>
  <div class="ro-panel">
    <div>
      <label class="ro-label">Format</label>
      <div class="ro-row">
        <button
          v-for="f in FORMATS"
          :key="f.value"
          type="button"
          class="ro-btn"
          :class="{ active: modelValue.format === f.value }"
          :data-testid="'fmt-' + f.value"
          @click="set({ format: f.value })"
        >
          <span class="ro-btn-label">{{ f.label }}</span>
          <span class="ro-btn-desc">{{ f.desc }}</span>
        </button>
      </div>
    </div>

    <div class="mt-3">
      <label class="ro-label">Resolution</label>
      <div class="ro-row">
        <button
          v-for="r in RESOLUTIONS"
          :key="r.value"
          type="button"
          class="ro-btn"
          :class="{ active: modelValue.resolution === r.value }"
          :data-testid="'res-' + r.value"
          @click="set({ resolution: r.value })"
        >
          <span class="ro-btn-label">{{ r.label }}</span>
          <span class="ro-btn-desc">{{ r.desc }}</span>
        </button>
      </div>
    </div>

    <div class="mt-3">
      <label class="ro-label">Frame Rate</label>
      <div class="ro-row">
        <button
          v-for="f in FPS_CHOICES"
          :key="f.value"
          type="button"
          class="ro-btn"
          :class="{ active: modelValue.fps === f.value }"
          :data-testid="'fps-' + f.value"
          @click="set({ fps: f.value })"
        >
          <span class="ro-btn-label">{{ f.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RenderOptions } from '../api.js';

const props = defineProps({
  modelValue: { type: Object as () => RenderOptions, required: true },
});
const emit = defineEmits(['update:modelValue']);

const FORMATS = [
  { value: 'mp4', label: 'MP4', desc: 'H.264 video' },
  { value: 'gif', label: 'GIF', desc: 'Animated image' },
  { value: 'webm', label: 'WebM', desc: 'VP9 video' },
] as const;

const RESOLUTIONS = [
  { value: '854x480', label: '480p', desc: '854×480' },
  { value: '1280x720', label: '720p', desc: '1280×720' },
  { value: '1920x1080', label: '1080p', desc: '1920×1080' },
  { value: '2560x1440', label: '2K', desc: '2560×1440' },
  { value: '3840x2160', label: '4K', desc: '3840×2160' },
] as const;

const FPS_CHOICES = [
  { value: 15, label: '15 fps' },
  { value: 30, label: '30 fps' },
  { value: 60, label: '60 fps' },
] as const;

function set(patch: Partial<RenderOptions>) {
  emit('update:modelValue', { ...props.modelValue, ...patch });
}
</script>

<style scoped>
.ro-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  color: var(--studio-text-muted);
}
.ro-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.ro-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
  border: 1px solid var(--studio-border, #333);
  border-radius: 8px;
  background: var(--studio-bg, #111);
  color: inherit;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.ro-btn:hover {
  border-color: var(--studio-accent, #6366f1);
}
.ro-btn.active {
  border-color: var(--studio-accent, #6366f1);
  background: color-mix(in srgb, var(--studio-accent, #6366f1) 15%, transparent);
}
.ro-btn-label {
  font-size: 12px;
  font-weight: 600;
}
.ro-btn-desc {
  font-size: 9px;
  color: var(--studio-text-muted, #888);
}
.mt-3 {
  margin-top: 12px;
}
</style>
