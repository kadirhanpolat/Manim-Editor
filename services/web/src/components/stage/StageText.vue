<template>
  <v-text
    :config="textConfig"
    @click="$emit('click', $event)"
    @dragend="$emit('dragend', $event)"
    @transformend="$emit('transformend', $event)"
  />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  element: { type: Object, required: true },
  config: { type: Object, required: true }
});

const textConfig = computed(() => ({
  ...props.config,
  text: props.element.content || 'Text',
  fontSize: (props.element.style?.size || 48) * (props.config.scaleX || 1) * 0.5,
  fill: props.element.style?.color || '#ffffff',
  fontFamily: props.element.style?.font || 'sans-serif',
  align: 'center',
  verticalAlign: 'middle',
  // Reset scale since we applied it to fontSize
  scaleX: 1,
  scaleY: 1
}));
</script>
