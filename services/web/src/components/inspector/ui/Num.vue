<template>
  <div>
    <span
      class="num-label text-[9px] text-studio-text-muted/50 cursor-ew-resize select-none"
      :class="{ 'text-yellow-400': scrubbing }"
      @mousedown="onLabelMousedown"
    >{{ label }}</span>
    <input
      class="input input-sm"
      type="number"
      :value="value"
      :min="min"
      :max="max"
      :step="step"
      @change="onInput($event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  label: String,
  value: [Number, String],
  min: { type: Number, default: undefined },
  max: { type: Number, default: undefined },
  step: { type: Number, default: 1 },
});
const emit = defineEmits(['input']);

function onInput(e: Event) {
  emit('input', Number((e.target as HTMLInputElement).value));
}

const scrubbing = ref(false);
let _startX = 0;
let _startVal = 0;

function onLabelMousedown(e: MouseEvent) {
  scrubbing.value = true;
  _startX = e.clientX;
  _startVal = Number(props.value) || 0;
  document.addEventListener('mousemove', onScrubMove);
  document.addEventListener('mouseup', onScrubUp);
  e.preventDefault();
}

function onScrubMove(e: MouseEvent) {
  if (!scrubbing.value) return;
  const delta = (e.clientX - _startX) / 100;
  const multiplier = e.shiftKey ? 10 : 1;
  let newVal = _startVal + delta * multiplier * (props.step ?? 1);
  if (props.min !== undefined) newVal = Math.max(props.min, newVal);
  if (props.max !== undefined) newVal = Math.min(props.max, newVal);
  emit('input', Math.round(newVal * 1000) / 1000);
}

function onScrubUp() {
  scrubbing.value = false;
  document.removeEventListener('mousemove', onScrubMove);
  document.removeEventListener('mouseup', onScrubUp);
}
</script>
