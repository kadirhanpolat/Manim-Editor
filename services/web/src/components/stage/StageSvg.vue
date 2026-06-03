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

<script setup>
import { ref, computed, watch } from 'vue';
import { useProjectStore } from '../../store/project.js';
import api from '../../api.js';

const props = defineProps({
  element: { type: Object, required: true },
  config: { type: Object, required: true }
});

const store = useProjectStore();

const svgImage = ref(null);
const svgLoaded = ref(false);

const asset = computed(() => store.project.assets.find(a => a.id === props.element.assetId));

const svgUrl = computed(() => {
  if (!asset.value) return null;
  return api.assets.getUrl(store.project.id, asset.value.filename);
});

const svgConfig = computed(() => ({
  image: svgImage.value,
  x: -50,
  y: -50,
  width: 100,
  height: 100
}));

const placeholderConfig = computed(() => ({
  x: -50,
  y: -50,
  width: 100,
  height: 100,
  fill: 'transparent',
  stroke: props.element.style?.strokeColor || '#6366f1',
  strokeWidth: 2,
  dash: [4, 4],
  cornerRadius: 4
}));

const labelConfig = computed(() => ({
  text: 'SVG',
  x: -20,
  y: -10,
  fontSize: 14,
  fill: '#6366f1',
  fontFamily: 'sans-serif'
}));

watch(svgUrl, (url) => {
  if (url) loadSvg(url);
}, { immediate: true });

async function loadSvg(url) {
  try {
    // Load SVG and convert to image for canvas display
    const response = await fetch(url);
    const svgText = await response.text();

    // Create a blob URL for the SVG
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);

    const img = new Image();
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
