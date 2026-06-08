<template>
  <div class="flex border-b border-studio-border/30 h-10">
    <div
      class="flex-shrink-0 flex items-center px-2 bg-studio-bg/20 border-r border-studio-border/30 text-[10px] text-studio-text-muted/60"
      :style="{ width: labelW + 'px' }"
    >
      {{ track.name }}
      <span v-if="track.clips.length" class="ml-auto text-[9px] text-studio-accent">{{
        track.clips.length
      }}</span>
    </div>
    <div class="track-bg relative flex-1 overflow-hidden" @click.self="deselect">
      <div :style="{ width: totalW + 'px' }" class="h-full relative">
        <TimelineClip v-for="clip in track.clips" :key="clip.id" :clip="clip" :pps="pps" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Track } from '@manim/codegen';
import { useProjectStore } from '../../store/project.js';
import TimelineClip from './TimelineClip.vue';

const props = defineProps({
  track: { type: Object as () => Track, required: true },
  pps: { type: Number, required: true },
  labelW: { type: Number, required: true },
});

const store = useProjectStore();

const totalW = computed(() => store.computedDuration * props.pps + 50);

function deselect() {
  store.deselectAll();
}
</script>

<style scoped>
.track-bg {
  background-image: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 79px,
    rgba(255, 255, 255, 0.015) 79px,
    rgba(255, 255, 255, 0.015) 80px
  );
}
</style>
