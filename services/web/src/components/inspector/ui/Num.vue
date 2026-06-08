<template>
  <div>
    <span class="text-[9px] text-studio-text-muted/50">{{ label }}</span>
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
defineProps({
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
</script>
