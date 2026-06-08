<template>
  <aside
    class="w-72 bg-studio-surface border-l border-studio-border flex flex-col flex-shrink-0 overflow-y-auto"
    aria-label="Properties panel"
  >
    <!-- Selected keyframe editor (self-gates on a selected keyframe) -->
    <KeyframePanel />

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Object Properties -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <ObjectInspector v-if="obj" />

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Clip Properties -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <ClipInspector v-else-if="clip" />

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Camera Clip Inspector -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <CameraClipInspector v-else-if="cameraClip" />

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Nothing Selected: Show background & canvas props + object list -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <CanvasInspector v-else />
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
import KeyframePanel from './KeyframePanel.vue';
import ObjectInspector from './panels/ObjectInspector.vue';
import ClipInspector from './panels/ClipInspector.vue';
import CameraClipInspector from './panels/CameraClipInspector.vue';
import CanvasInspector from './panels/CanvasInspector.vue';

const store = useProjectStore();
const obj = computed(() => store.selectedObject);
const clip = computed(() => store.selectedClip);
const cameraClip = computed(() => {
  if (!store.selectedClipId) return null;
  return store.project.cameraTrack?.find((c) => c.id === store.selectedClipId) || null;
});
</script>
