<template>
  <div class="asset-uploader">
    <div
      class="upload-zone border-2 border-dashed border-studio-border rounded-lg p-8 text-center transition-colors"
      :class="{ 'border-studio-accent bg-studio-accent/10': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".png,.jpg,.jpeg,.svg"
        multiple
        class="hidden"
        @change="onFileSelect"
      />
      
      <div v-if="!uploading">
        <div class="text-4xl mb-3 opacity-50">📤</div>
        <p class="text-sm text-studio-text-muted mb-2">Drag files here or</p>
        <button class="btn btn-primary text-sm" @click="fileInput?.click()">
          Browse Files
        </button>
        <p class="text-xs text-studio-text-muted mt-3">PNG, JPG, SVG (max 50MB)</p>
      </div>
      
      <div v-else class="py-4">
        <div class="animate-spin text-3xl mb-2">⏳</div>
        <p class="text-sm">Uploading {{ uploadProgress }}...</p>
      </div>
    </div>
    
    <div v-if="error" class="mt-3 p-3 bg-studio-error/20 text-studio-error rounded text-sm">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
import type { Asset } from '../../store/project.js';
import api from '../../api.js';

const emit = defineEmits<{
  uploaded: [asset: Asset];
  close: [];
}>();

const store = useProjectStore();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const uploading = ref(false);
const uploadProgress = ref('');
const error = ref<string | null>(null);

const projectId = computed(() => store.project.id);

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer?.files ?? []);
  uploadFiles(files);
}

function onFileSelect(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  uploadFiles(files);
}

async function uploadFiles(files: File[]) {
  if (!projectId.value || files.length === 0) return;

  uploading.value = true;
  error.value = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    uploadProgress.value = `${i + 1}/${files.length}`;

    try {
      const asset = await api.assets.upload(projectId.value, file) as Asset;
      emit('uploaded', asset);
    } catch (err) {
      error.value = `Failed to upload ${file.name}: ${err instanceof Error ? err.message : String(err)}`;
      break;
    }
  }

  uploading.value = false;
  if (!error.value) {
    emit('close');
  }
}
</script>
