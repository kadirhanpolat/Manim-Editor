<template>
  <v-text
    :config="textConfig"
    @click="$emit('click', $event)"
    @dragend="$emit('dragend', $event)"
    @transformend="$emit('transformend', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';

const props = defineProps({
  element: { type: Object as () => SceneObject, required: true },
  config: { type: Object as () => Record<string, unknown>, required: true },
});

const textConfig = computed(() => {
  const style = props.element.style as Record<string, unknown> | undefined;
  return {
    ...props.config,
    text: (props.element.content as string | undefined) || 'Text',
    fontSize: ((style?.size as number | undefined) || 48) * ((props.config.scaleX as number | undefined) || 1) * 0.5,
    fill: (style?.color as string | undefined) || '#ffffff',
    fontFamily: (style?.font as string | undefined) || 'sans-serif',
    align: 'center',
    verticalAlign: 'middle',
    // Reset scale since we applied it to fontSize
    scaleX: 1,
    scaleY: 1,
  };
});
</script>
