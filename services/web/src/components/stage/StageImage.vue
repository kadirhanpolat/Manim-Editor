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

<script setup>
import { ref, computed, watch } from 'vue';
import { useProjectStore } from '../../store/project.js';
import api from '../../api.js';

const props = defineProps({
  element: { type: Object, required: true },
  config: { type: Object, required: true }
});

const store = useProjectStore();

const image = ref(null);
const imageLoaded = ref(false);

const asset = computed(() => store.project.assets.find(a => a.id === props.element.assetId));

const imageUrl = computed(() => {
  if (!asset.value) return null;
  return api.assets.getUrl(store.project.id, asset.value.filename);
});

const imageConfig = computed(() => ({
  image: image.value,
  x: -50, // Center offset
  y: -50,
  width: 100,
  height: 100,
  opacity: props.element.style?.opacity ?? 1
}));

const placeholderConfig = computed(() => ({
  x: -50,
  y: -50,
  width: 100,
  height: 100,
  fill: '#2e2e3e',
  cornerRadius: 4
}));

watch(imageUrl, (url) => {
  if (url) loadImage(url);
}, { immediate: true });

function loadImage(url) {
  const img = new Image();
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
