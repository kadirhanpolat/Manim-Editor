<template>
  <div class="video-preview">
    <div class="relative bg-black rounded-lg overflow-hidden aspect-video">
      <video
        v-if="videoUrl"
        ref="video"
        :key="cacheBuster"
        :src="videoUrl"
        controls
        class="w-full h-full"
        @error="onError"
        @loadeddata="onLoaded"
      >
        Your browser does not support video playback.
      </video>

      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-studio-bg">
        <span class="animate-spin text-2xl">⏳</span>
      </div>

      <div v-if="error" class="absolute inset-0 flex items-center justify-center bg-studio-bg">
        <div class="text-center text-studio-text-muted">
          <div class="text-2xl mb-2">⚠️</div>
          <p class="text-xs">Failed to load video</p>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between mt-2">
      <span class="text-xs text-studio-text-muted">Latest Render</span>
      <a
        :href="videoUrl"
        download="render.mp4"
        class="text-xs text-studio-accent hover:text-studio-accent-hover"
      >
        ⬇ Download
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import api from '../../api.js';

const props = defineProps({
  projectId: { type: String, required: true },
});

const emit = defineEmits(['ready']);

const loading = ref(true);
const error = ref(false);
const cacheBuster = ref(Date.now());

const videoUrl = computed(() => {
  return (
    api.renders.getLatestUrl(props.projectId).replace(/\?t=\d+/, '') + '?t=' + cacheBuster.value
  );
});

watch(
  () => props.projectId,
  () => {
    cacheBuster.value = Date.now();
    loading.value = true;
    error.value = false;
  }
);

function onLoaded() {
  loading.value = false;
  error.value = false;
}

function onError() {
  loading.value = false;
  error.value = true;
}

function refresh() {
  cacheBuster.value = Date.now();
  loading.value = true;
  error.value = false;
}

onMounted(() => {
  emit('ready', refresh);
});
</script>
