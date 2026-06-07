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
        type="file"
        ref="fileInput"
        @change="onFileSelect"
        accept=".png,.jpg,.jpeg,.svg"
        multiple
        class="hidden"
      />
      
      <div v-if="!uploading">
        <div class="text-4xl mb-3 opacity-50">📤</div>
        <p class="text-sm text-studio-text-muted mb-2">Drag files here or</p>
        <button @click="fileInput.click()" class="btn btn-primary text-sm">
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

<script setup>
import { ref, computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
import api from '../../api.js';

const emit = defineEmits(['uploaded', 'close']);

const store = useProjectStore();

const fileInput = ref(null);
const isDragging = ref(false);
const uploading = ref(false);
const uploadProgress = ref('');
const error = ref(null);

const projectId = computed(() => store.project.id);

function onDrop(e) {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer.files);
  uploadFiles(files);
}

function onFileSelect(e) {
  const files = Array.from(e.target.files);
  uploadFiles(files);
}

async function uploadFiles(files) {
  if (!projectId.value || files.length === 0) return;

  uploading.value = true;
  error.value = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    uploadProgress.value = `${i + 1}/${files.length}`;

    try {
      const asset = await api.assets.upload(projectId.value, file);
      emit('uploaded', asset);
    } catch (err) {
      error.value = `Failed to upload ${file.name}: ${err.message}`;
      break;
    }
  }

  uploading.value = false;
  if (!error.value) {
    emit('close');
  }
}
</script>
