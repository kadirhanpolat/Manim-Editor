<template>
  <v-group
    :config="config"
    @click="$emit('click', $event)"
    @dragend="$emit('dragend', $event)"
    @transformend="$emit('transformend', $event)"
  >
    <v-image v-if="imageLoaded" :config="imageConfig" />
    <v-rect v-else :config="placeholderConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../store/project.js';
import api from '../../api.js';

const props = defineProps({
  element: { type: Object as () => SceneObject, required: true },
  config: { type: Object as () => Record<string, unknown>, required: true },
});

const store = useProjectStore();

const image = ref<HTMLImageElement | null>(null);
const imageLoaded = ref(false);

const assetId = computed(() => props.element.assetId as string | undefined);
const asset = computed(() => store.project.assets.find((a: Record<string, unknown>) => a.id === assetId.value));

const imageUrl = computed(() => {
  if (!asset.value || !store.project.id) return null;
  return api.assets.getUrl(store.project.id, asset.value.filename as string);
});

const imageConfig = computed(() => ({
  image: image.value,
  x: -50, // Center offset
  y: -50,
  width: 100,
  height: 100,
  opacity: (props.element.style as Record<string, unknown> | undefined)?.opacity ?? 1,
}));

const placeholderConfig = computed(() => ({
  x: -50,
  y: -50,
  width: 100,
  height: 100,
  fill: '#2e2e3e',
  cornerRadius: 4,
}));

watch(
  imageUrl,
  (url: string | null) => {
    if (url) loadImage(url);
  },
  { immediate: true }
);

function loadImage(url: string): void {
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    image.value = img;
    imageLoaded.value = true;
  };
  img.onerror = () => {
    console.error('Failed to load image:', url);
    imageLoaded.value = false;
  };
  img.src = url;
}
</script>
