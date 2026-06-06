<template>
  <div class="flex items-center gap-2">
    <span class="text-[10px] text-studio-text-muted w-12">{{ label }}</span>
    <input type="color" class="color-input" :value="value || '#ffffff'" @input="$emit('input', $event.target.value)" />
    <input class="input input-sm flex-1" :value="value" @change="$emit('input', $event.target.value)" />
  </div>
</template>

<script setup>
defineProps(['label', 'value']);
defineEmits(['input']);
</script>
