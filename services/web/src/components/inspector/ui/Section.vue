<template>
  <div class="px-3 py-2 border-b border-studio-border/50">
    <label class="text-[10px] text-studio-text-muted/70 uppercase font-bold tracking-wider mb-1 block">{{ label }}</label>
    <slot />
  </div>
</template>

<script setup>
defineProps({ label: String });
</script>
