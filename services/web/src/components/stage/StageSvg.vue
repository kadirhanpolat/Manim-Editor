<template>
  <v-group
    :config="config"
    @click="$emit('click', $event)"
    @dragend="$emit('dragend', $event)"
    @transformend="$emit('transformend', $event)"
  >
    <v-image v-if="svgLoaded" :config="svgConfig" />
    <v-group v-else>
      <v-rect :config="placeholderConfig" />
      <v-text :config="labelConfig" />
    </v-group>
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

const svgImage = ref<HTMLImageElement | null>(null);
const svgLoaded = ref(false);

const assetId = computed(() => props.element.assetId as string | undefined);
const asset = computed(() =>
  store.project.assets.find((a: Record<string, unknown>) => a.id === assetId.value)
);

const svgUrl = computed(() => {
  if (!asset.value || !store.project.id) return null;
  return api.assets.getUrl(store.project.id, asset.value.filename as string);
});

const svgConfig = computed(() => ({
  image: svgImage.value,
  x: -50,
  y: -50,
  width: 100,
  height: 100,
}));

const placeholderConfig = computed(() => ({
  x: -50,
  y: -50,
  width: 100,
  height: 100,
  fill: 'transparent',
  stroke:
    ((props.element.style as Record<string, unknown> | undefined)?.strokeColor as
      | string
      | undefined) || '#6366f1',
  strokeWidth: 2,
  dash: [4, 4],
  cornerRadius: 4,
}));

const labelConfig = computed(() => ({
  text: 'SVG',
  x: -20,
  y: -10,
  fontSize: 14,
  fill: '#6366f1',
  fontFamily: 'sans-serif',
}));

watch(
  svgUrl,
  (url: string | null) => {
    if (url) loadSvg(url);
  },
  { immediate: true }
);

async function loadSvg(url: string) {
  try {
    // Load SVG and convert to image for canvas display
    const response = await fetch(url);
    const svgText = await response.text();

    // Create a blob URL for the SVG
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);

    const img = new window.Image();
    img.onload = () => {
      svgImage.value = img;
      svgLoaded.value = true;
      URL.revokeObjectURL(blobUrl);
    };
    img.onerror = () => {
      console.error('Failed to load SVG:', url);
      svgLoaded.value = false;
    };
    img.src = blobUrl;
  } catch (err) {
    console.error('Failed to fetch SVG:', err);
  }
}
</script>
