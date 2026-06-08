<template>
  <div class="flex items-center gap-2">
    <span class="text-[10px] text-studio-text-muted w-12">{{ label }}</span>
    <input type="color" class="color-input" :value="value || '#ffffff'" @input="onInput($event)" />
    <input class="input input-sm flex-1" :value="value" @change="onInput($event)" />
  </div>
</template>

<script setup lang="ts">
defineProps({ label: String, value: String });
const emit = defineEmits(['input']);
function onInput(e: Event) {
  emit('input', (e.target as HTMLInputElement).value);
}
</script>
