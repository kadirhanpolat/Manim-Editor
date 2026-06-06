<template>
  <div>
    <span class="text-[9px] text-studio-text-muted/50">{{ label }}</span>
    <input class="input input-sm" type="number" :value="value" :min="min" :max="max" :step="step"
           @change="$emit('input', Number($event.target.value))" />
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [Number, String],
  min: { type: Number, default: undefined },
  max: { type: Number, default: undefined },
  step: { type: Number, default: 1 },
});
defineEmits(['input']);
</script>
