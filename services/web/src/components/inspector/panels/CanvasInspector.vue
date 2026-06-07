<template>
  <div class="panel-header">Canvas</div>

  <!-- 3D Camera Preview (projection mode) — only in 3D scenes -->
  <Scene3DPanel v-if="store.project.sceneType === '3d'" />

  <!-- Background Properties -->
  <Section label="Background">
    <div class="space-y-1.5">
      <ColorRow
        label="Color"
        :value="stg.backgroundColor"
        @input="uStage('backgroundColor', $event)"
      />
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-12">Opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="flex-1 accent-studio-accent"
          :value="stg.backgroundOpacity ?? 1"
          @input="uStage('backgroundOpacity', Number($event.target.value))"
        />
        <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums"
          >{{ Math.round((stg.backgroundOpacity ?? 1) * 100) }}%</span
        >
      </div>
    </div>
  </Section>

  <!-- Grid Properties -->
  <Section label="Grid">
    <div class="space-y-1.5">
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            :checked="stg.gridVisible"
            @change="uStage('gridVisible', $event.target.checked)"
            class="accent-studio-accent"
          />
          <span class="text-[10px] text-studio-text-muted">Visible</span>
        </label>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <Num
          label="Divisions"
          :value="stg.gridSize || 8"
          :min="2"
          :max="24"
          @input="uStage('gridSize', $event)"
        />
        <div>
          <span class="text-[9px] text-studio-text-muted/50">Opacity</span>
          <input
            class="input input-sm"
            type="number"
            min="0"
            max="1"
            step="0.02"
            :value="stg.gridOpacity ?? 0.12"
            @change="uStage('gridOpacity', Number($event.target.value))"
          />
        </div>
      </div>
      <ColorRow
        label="Grid Color"
        :value="stg.gridColor || '#ffffff'"
        @input="uStage('gridColor', $event)"
      />
    </div>
  </Section>

  <!-- Snap Settings -->
  <Section label="Snapping">
    <div class="space-y-1.5">
      <label class="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          :checked="stg.snapEnabled"
          @change="uStage('snapEnabled', $event.target.checked)"
          class="accent-studio-accent"
        />
        <span class="text-[10px] text-studio-text-muted">Snap enabled</span>
      </label>
      <label class="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          :checked="stg.snapToGrid"
          @change="uStage('snapToGrid', $event.target.checked)"
          class="accent-studio-accent"
        />
        <span class="text-[10px] text-studio-text-muted">Snap to grid</span>
      </label>
      <label class="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          :checked="stg.snapToCenter"
          @change="uStage('snapToCenter', $event.target.checked)"
          class="accent-studio-accent"
        />
        <span class="text-[10px] text-studio-text-muted">Snap to center</span>
      </label>
      <label class="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          :checked="stg.snapToObjects"
          @change="uStage('snapToObjects', $event.target.checked)"
          class="accent-studio-accent"
        />
        <span class="text-[10px] text-studio-text-muted">Snap to objects</span>
      </label>
    </div>
  </Section>

  <!-- Stage Size -->
  <Section label="Stage Size">
    <div class="grid grid-cols-2 gap-1.5">
      <Num label="Width" :value="stg.width" :min="100" @input="uStage('width', $event)" />
      <Num label="Height" :value="stg.height" :min="100" @input="uStage('height', $event)" />
    </div>
  </Section>

  <!-- Groups list -->
  <Section v-if="groups.length > 0" label="Groups">
    <div class="space-y-1">
      <div
        v-for="g in groups"
        :key="g.id"
        class="flex items-center justify-between px-2 py-1.5 rounded-md bg-studio-bg/50 text-xs"
      >
        <span class="text-studio-text-muted">{{ g.name }} ({{ g.childIds.length }})</span>
        <button class="text-[9px] text-red-400 hover:text-red-300" @click="ungroup(g.id)">
          Ungroup
        </button>
      </div>
    </div>
  </Section>

  <!-- Object list -->
  <div class="border-t border-studio-border p-3 mt-auto">
    <div class="text-[10px] text-studio-text-muted font-bold uppercase tracking-wider mb-2">
      Objects ({{ objs.length }})
    </div>
    <div class="max-h-40 overflow-y-auto space-y-0.5">
      <div
        v-for="o in objs"
        :key="o.id"
        class="obj-list-item"
        :class="{ sel: isSel(o.id) }"
        @click="selObj(o.id, $event)"
      >
        <span
          class="w-2 h-2 rounded-full flex-shrink-0"
          :style="{ background: o.fill || '#666' }"
        ></span>
        <span class="truncate flex-1">{{ o.name }}</span>
        <span class="text-[8px] text-studio-text-muted/50">{{ o.type }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
import ColorRow from '../ui/ColorRow.vue';
import Num from '../ui/Num.vue';
import Scene3DPanel from '../Scene3DPanel.vue';

const store = useProjectStore();
const stg = computed(() => store.project.stage);
const groups = computed(() => store.project.groups || []);
const objs = computed(() => store.project.objects);

function uStage(k, v) {
  store.updateStage({ [k]: v });
}
function ungroup(groupId) {
  store.ungroupObjects(groupId);
}
function isSel(id) {
  return store.selectedObjectIds.includes(id);
}
function selObj(id, e) {
  store.selectObject(id, e.shiftKey || e.ctrlKey);
}
</script>

<style scoped>
.obj-list-item {
  @apply flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors;
  @apply hover:bg-studio-border;
}
.obj-list-item.sel {
  @apply bg-studio-accent/10 text-studio-accent;
}
</style>
