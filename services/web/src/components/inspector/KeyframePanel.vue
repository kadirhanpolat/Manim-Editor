<template>
  <div v-if="kf" class="px-4 py-3 border-b border-studio-border">
    <div class="text-xs text-studio-text-muted font-medium mb-2 flex items-center gap-1">
      <svg width="10" height="10" viewBox="-5 -5 10 10">
        <polygon points="0,-4 4,0 0,4 -4,0" :fill="modeColor" stroke="white" stroke-width="0.8" />
      </svg>
      Keyframe · {{ kf.prop }}
    </div>

    <!-- Time (read-only) -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-[10px] text-studio-text-muted">Time</span>
      <span class="text-[10px] font-mono text-studio-text">{{ kf.time.toFixed(2) }}s</span>
    </div>

    <!-- Value -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-[10px] text-studio-text-muted">Value</span>
      <input
        type="number"
        :value="kfData?.value ?? ''"
        class="w-20 text-[10px] font-mono text-right bg-studio-bg border border-studio-border rounded px-1 py-0.5"
        @change="updateValue(+($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Mode -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-[10px] text-studio-text-muted">Mode</span>
      <select
        :value="mode"
        class="text-[10px] bg-studio-bg border border-studio-border rounded px-1 py-0.5"
        @change="store.setKeyframeMode(kf!.objId, kf!.prop, ($event.target as HTMLSelectElement).value)"
      >
        <option value="opt-in">Opt-in</option>
        <option value="override">Override</option>
        <option value="additive">Additive</option>
      </select>
    </div>

    <!-- Delete button -->
    <button
      class="w-full mt-1 py-1 text-[10px] text-studio-error bg-studio-error/10 rounded hover:bg-studio-error/20"
      @click="deleteKf"
    >
      Keyframe'i sil
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';

const store = useProjectStore();
const kf = computed(() => store.selectedKeyframeId);
const obj = computed(() => (kf.value ? store.objectById(kf.value.objId) : null));

const kfData = computed(() => {
  const kfv = kf.value;
  if (!kfv || !obj.value?.keyframes?.[kfv.prop]) return null;
  return (
    obj.value.keyframes[kfv.prop].find((k) => Math.abs(k.time - kfv.time) < 0.01) || null
  );
});

const mode = computed(() => {
  if (!kf.value || !obj.value) return 'opt-in';
  return (
    obj.value.keyframeMode?.[kf.value.prop] || store.project.keyframeDefaults?.mode || 'opt-in'
  );
});

const modeColor = computed(
  () => ({ override: '#ffd700', additive: '#ff9d42', 'opt-in': '#60a5fa' })[mode.value] || '#60a5fa'
);

function updateValue(val: number) {
  if (!kf.value || !Number.isFinite(val)) return;
  store.updateKeyframeValue(kf.value.objId, kf.value.prop, kf.value.time, val);
}

function deleteKf() {
  if (!kf.value) return;
  store.removeKeyframe(kf.value.objId, kf.value.prop, kf.value.time);
  store.selectKeyframe(null, null, null);
}
</script>
