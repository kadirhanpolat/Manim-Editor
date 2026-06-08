<template>
  <div class="render-panel p-4">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-studio-text-muted uppercase tracking-wider">Render</span>
    </div>

    <!-- Quality Selector -->
    <div class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Quality</label>
      <select v-model="quality" class="select text-sm">
        <option v-for="q in qualityOptions" :key="q.value" :value="q.value">
          {{ q.label }}
        </option>
      </select>
    </div>

    <!-- Render Button -->
    <button
      @click="startRender"
      :disabled="isRendering || !hasElements || hasPendingAudio"
      class="w-full btn btn-primary mb-3"
      :class="{ 'opacity-50 cursor-not-allowed': isRendering || !hasElements || hasPendingAudio }"
      :title="hasPendingAudio ? 'Waiting for audio generation...' : ''"
    >
      <span v-if="isRendering" class="flex items-center justify-center gap-2">
        <svg
          class="animate-spin w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="12" cy="12" r="10" stroke-dasharray="45 20" />
        </svg>
        Rendering...
      </span>
      <span v-else class="flex items-center justify-center gap-2">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        Render Video
      </span>
    </button>

    <!-- Status -->
    <div v-if="renderStatus" class="mb-3 p-3 rounded text-sm" :class="statusClass">
      <div class="flex items-center gap-2">
        <span>{{ statusIcon }}</span>
        <span class="capitalize">{{ renderStatus }}</span>
      </div>
      <div v-if="renderStatus === 'running'" class="mt-2">
        <div class="h-1 bg-black/20 rounded-full overflow-hidden">
          <div class="h-full bg-white/50 animate-pulse" style="width: 60%"></div>
        </div>
      </div>
    </div>

    <!-- Logs Toggle + Copy -->
    <div v-if="hasLogs" class="flex items-center gap-3 mb-2">
      <button
        @click="showLogs = !showLogs"
        class="text-xs text-studio-text-muted hover:text-studio-text"
      >
        {{ showLogs ? '▼ Hide Logs' : '▶ Show Logs' }}
      </button>
      <button
        @click="copyLogs"
        class="text-xs text-studio-accent hover:opacity-80"
        title="Copy the render log to the clipboard"
      >
        {{ copied ? '✓ Copied' : '⧉ Copy logs' }}
      </button>
    </div>

    <div
      v-if="showLogs && hasLogs"
      class="mb-3 p-2 bg-studio-bg rounded text-xs font-mono max-h-32 overflow-y-auto"
    >
      <pre
        class="whitespace-pre-wrap text-studio-text-muted select-text"
        style="user-select: text"
        >{{ jobLogs }}</pre
      >
    </div>

    <!-- Video Preview -->
    <VideoPreview v-if="hasRender && projectId" :project-id="projectId" :key="renderKey" />

    <div v-else-if="!isRendering" class="text-center text-studio-text-muted py-4">
      <div class="text-2xl mb-2 opacity-30">🎥</div>
      <p class="text-xs">No render yet</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useProjectStore } from '../../store/project.js';
import { QUALITY_PRESETS } from '../../constants/animations.js';
import { renders } from '../../api.js';
import VideoPreview from './VideoPreview.vue';

const store = useProjectStore();

const quality = ref('high');
const qualityOptions = QUALITY_PRESETS;
const showLogs = ref(false);
const copied = ref(false);
async function copyLogs() {
  const text = jobLogs.value || '';
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for non-secure contexts / older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* ignore */
    }
    ta.remove();
  }
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
}
let pollInterval: ReturnType<typeof setInterval> | null = null;
const jobData = ref<Record<string, unknown> | null>(null);
const hasRender = ref(false);
const renderKey = ref(0);

const projectId = computed(() => store.project.id);
const hasElements = computed(() => store.project.objects.length > 0);
const renderStatus = computed(() => store.renderStatus);
const isRendering = computed(() => !!renderStatus.value && ['queued', 'running'].includes(renderStatus.value));
const hasPendingAudio = computed(() => store.hasPendingAudio);

const statusClass = computed(() => {
  const classes: Record<string, string> = {
    queued: 'bg-studio-warning/20 text-studio-warning',
    running: 'bg-studio-accent/20 text-studio-accent',
    completed: 'bg-studio-success/20 text-studio-success',
    failed: 'bg-studio-error/20 text-studio-error',
  };
  return (renderStatus.value && classes[renderStatus.value]) || 'bg-studio-border';
});

const statusIcon = computed(() => {
  const icons: Record<string, string> = {
    queued: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
  };
  return (renderStatus.value && icons[renderStatus.value]) || '•';
});

const hasLogs = computed(() => jobData.value?.['stdout'] || jobData.value?.['stderr']);
const jobLogs = computed(() => (jobData.value?.['stderr'] || jobData.value?.['stdout'] || '') as string);

watch(renderStatus, (status) => {
  if (status === 'completed') {
    hasRender.value = true;
    renderKey.value++;
  }
});

onMounted(() => {
  checkExistingRender();
});
onBeforeUnmount(() => {
  stopPolling();
});

// RenderPanel uses legacy store methods (triggerRender/pollRenderStatus) not typed in store
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storeAny = store as any;

async function checkExistingRender() {
  if (!projectId.value) return;
  try {
    const info = await renders.getInfo(projectId.value) as { hasLatest?: boolean };
    hasRender.value = !!info.hasLatest;
  } catch {
    /* ignore */
  }
}

async function startRender() {
  if (isRendering.value || !hasElements.value || hasPendingAudio.value) return;
  try {
    await storeAny.triggerRender(quality.value);
    startPolling();
  } catch (err) {
    console.error('Render failed:', err);
  }
}

function startPolling() {
  stopPolling();
  pollInterval = setInterval(async () => {
    const status = await storeAny.pollRenderStatus() as Record<string, unknown> | null;
    if (status) {
      jobData.value = status;
      if (['completed', 'failed'].includes(status['status'] as string)) {
        stopPolling();
      }
    }
  }, 1500);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
</script>
