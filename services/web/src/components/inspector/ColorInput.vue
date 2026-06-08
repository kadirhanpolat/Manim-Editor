<template>
  <div class="color-input-wrapper flex items-center gap-2">
    <input
      type="color"
      :value="validatedValue"
      @input="handleColorPicker"
      class="color-picker w-8 h-8 rounded cursor-pointer border-0 p-0"
    />
    <input
      type="text"
      :value="displayValue"
      @input="handleTextInput"
      @blur="validateOnBlur"
      :class="['hex-input text-sm flex-1 px-2 py-1 rounded border', isValid ? '' : 'invalid']"
      :style="{
        background: 'var(--studio-bg)',
        color: 'var(--studio-text)',
        borderColor: isValid ? 'var(--studio-border)' : 'var(--studio-danger)',
      }"
      placeholder="#000000"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const HEX_REGEX = /^#[0-9A-F]{6}$/i;

const props = defineProps({
  value: { type: String, default: '#000000' },
});
const emit = defineEmits(['input', 'change']);

const displayValue = ref(props.value || '#000000');
const isValid = ref(true);

const validatedValue = computed(() => {
  // Ensure the color picker always gets a valid 6-digit hex
  if (HEX_REGEX.test(displayValue.value)) return displayValue.value.toLowerCase();
  // Default fallback
  return '#000000';
});

watch(
  () => props.value,
  (newVal) => {
    if (newVal && newVal !== displayValue.value) {
      displayValue.value = newVal;
      isValid.value = HEX_REGEX.test(newVal);
    }
  }
);

function handleColorPicker(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  displayValue.value = value;
  isValid.value = true;
  emit('input', value);
  emit('change', value);
}

function handleTextInput(event: Event) {
  let value = (event.target as HTMLInputElement).value;

  // Auto-add # if missing and user types hex chars
  if (value && !value.startsWith('#') && /^[0-9A-F]/i.test(value)) {
    value = '#' + value;
  }

  displayValue.value = value;

  // Only emit if valid
  if (HEX_REGEX.test(value)) {
    isValid.value = true;
    emit('input', value.toLowerCase());
    emit('change', value.toLowerCase());
  } else {
    isValid.value = false;
  }
}

function validateOnBlur() {
  if (!HEX_REGEX.test(displayValue.value)) {
    // Reset to last valid value or default
    displayValue.value = props.value || '#000000';
    isValid.value = true;
  }
}
</script>

<style scoped>
.color-picker {
  overflow: hidden;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.hex-input {
  font-family: monospace;
  text-transform: uppercase;
}

.hex-input:focus {
  outline: none;
  border-color: var(--studio-accent) !important;
}

.hex-input.invalid {
  border-color: var(--studio-danger) !important;
}
</style>
