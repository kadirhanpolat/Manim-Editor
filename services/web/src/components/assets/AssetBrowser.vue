<template>
  <div class="asset-browser h-full flex flex-col">
    <div class="panel-header flex items-center justify-between">
      <span>Assets</span>
      <button class="text-xs px-2 py-1 bg-studio-accent rounded hover:bg-studio-accent-hover" @click="showUploader = true">
        + Upload
      </button>
    </div>
    
    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="assets.length === 0" class="text-center text-studio-text-muted py-8">
        <div class="text-3xl mb-2 opacity-30">📁</div>
        <p class="text-sm">No assets yet</p>
        <p class="text-xs mt-1">Upload images or SVGs</p>
      </div>
      
      <div v-else class="grid grid-cols-2 gap-2">
        <div
          v-for="asset in assets"
          :key="asset.id"
          class="asset-item relative group cursor-grab bg-studio-bg rounded-lg overflow-hidden aspect-square"
          draggable="true"
          @dragstart="onDragStart(asset, $event)"
        >
          <img 
            v-if="asset.type === 'image'"
            :src="getAssetUrl(asset)"
            :alt="asset.filename"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center bg-studio-border">
            <span class="text-2xl">📐</span>
          </div>
          
          <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
            <span class="text-xs text-white truncate flex-1">{{ asset.filename }}</span>
            <button class="text-studio-error hover:text-red-400 ml-1" @click.stop="deleteAsset(asset)">✕</button>
          </div>
          
          <div class="absolute top-1 right-1">
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white uppercase">
              {{ asset.type }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Upload Modal -->
    <div v-if="showUploader" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div class="bg-studio-surface border border-studio-border rounded-lg w-96 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-medium">Upload Assets</h3>
          <button class="text-studio-text-muted hover:text-studio-text" @click="showUploader = false">✕</button>
        </div>
        
        <AssetUploader @uploaded="onAssetUploaded" @close="showUploader = false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
import type { Asset } from '../../store/project.js';
import api from '../../api.js';
import AssetUploader from './AssetUploader.vue';

const store = useProjectStore();

const showUploader = ref(false);

const projectId = computed(() => store.project.id);
const assets = computed(() => store.project.assets || []);

function getAssetUrl(asset: Asset) {
  return api.assets.getUrl(projectId.value ?? '', asset.filename);
}

function onDragStart(asset: Asset, e: DragEvent) {
  e.dataTransfer!.setData('application/json', JSON.stringify(asset));
  e.dataTransfer!.effectAllowed = 'copy';
}

async function deleteAsset(asset: Asset) {
  if (!confirm('Delete this asset?')) return;
  try {
    await api.assets.delete(projectId.value ?? '', asset.filename);
    store.removeAsset(asset.id);
  } catch (err) {
    console.error('Failed to delete asset:', err);
  }
}

function onAssetUploaded(asset: Asset) {
  (store as unknown as { addAsset: (a: Asset) => void }).addAsset(asset);
  showUploader.value = false;
}
</script>
