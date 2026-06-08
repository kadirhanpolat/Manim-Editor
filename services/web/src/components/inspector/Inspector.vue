<template>
  <div class="inspector h-full flex flex-col">
    <div class="panel-header">Inspector</div>

    <div v-if="!selectedElement" class="flex-1 flex items-center justify-center p-4">
      <div class="text-center text-studio-text-muted">
        <div class="text-3xl mb-2 opacity-30">👆</div>
        <p class="text-sm">Select an element to edit its properties</p>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <!-- Element Type Badge -->
      <div class="px-4 py-3 border-b border-studio-border">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 text-xs rounded font-medium" :class="typeBadgeClass">
            {{ selectedElement.type.toUpperCase() }}
          </span>
          <span class="text-sm text-studio-text-muted">{{ selectedElement.id }}</span>
        </div>
      </div>

      <!-- Text Content (for text elements) -->
      <div v-if="selectedElement.type === 'text'" class="px-4 py-3 border-b border-studio-border">
        <label class="block text-xs text-studio-text-muted mb-2">Content</label>
        <textarea
          :value="(selectedElement.content as string | undefined) ?? ''"
          class="input text-sm resize-none"
          rows="2"
          placeholder="Enter text..."
          @input="updateContent(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>

      <!-- 3D Position Panel -->
      <Position3DPanel v-if="is3DObject" :element="selectedElement" @update="updateElement" />

      <!-- Layout Panel -->
      <LayoutPanel :element="selectedElement" @update="updateElement" />

      <!-- Style Panel -->
      <StylePanel :element="selectedElement" @update="updateElement" />

      <!-- Timing Panel -->
      <TimingPanel :element="selectedElement" @update="updateElement" />

      <!-- Animation Panel -->
      <AnimationPanel :element="selectedElement" @update="updateElement" />

      <!-- Rotate Axis Selector (shown when a rotate clip is selected in 3D mode) -->
      <div
        v-if="selectedClip?.type === 'rotate' && store.project.sceneType === '3d'"
        class="px-4 py-3 border-b border-studio-border"
      >
        <label class="block text-xs text-studio-text-muted mb-1">Rotation Axis</label>
        <select
          :value="selectedClip.axis ?? 'Z'"
          class="select text-sm w-full"
          @change="
            store.updateClip(selectedClip!.id!, {
              axis: ($event.target as HTMLSelectElement).value as 'X' | 'Y' | 'Z',
            })
          "
        >
          <option value="X">X (RIGHT)</option>
          <option value="Y">Y (UP)</option>
          <option value="Z">Z (OUT)</option>
        </select>
      </div>

      <!-- Match Terms checkbox (shown when a transform clip is selected and both objects are non-raster) -->
      <div
        v-if="selectedClip?.type === 'transform' && bothNonRaster"
        class="px-4 py-3 border-b border-studio-border"
      >
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="!!selectedClip.matchTerms"
            class="w-3.5 h-3.5"
            @change="
              store.setClipMatchTerms(
                selectedClip!.id!,
                ($event.target as HTMLInputElement).checked
              )
            "
          />
          <span class="text-xs text-studio-text-muted">Match terms</span>
          <span class="text-xs text-studio-text-muted opacity-60"
            >(TransformMatchingTex/Shapes)</span
          >
        </label>
      </div>

      <!-- Count clip controls (shown when a count clip is selected) -->
      <div v-if="selectedClip?.type === 'count'" class="px-4 py-3 border-b border-studio-border">
        <label class="block text-xs text-studio-text-muted mb-2">Count Animation</label>
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-12">From</span>
            <input
              type="number"
              step="1"
              class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
              :value="selectedClip.from ?? 0"
              @change="
                store.updateClip(selectedClip!.id!, {
                  from: Number(($event.target as HTMLInputElement).value),
                });
                store.commitState();
              "
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-12">To</span>
            <input
              type="number"
              step="1"
              class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
              :value="selectedClip.to ?? 100"
              @change="
                store.updateClip(selectedClip!.id!, {
                  to: Number(($event.target as HTMLInputElement).value),
                });
                store.commitState();
              "
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-12">Duration</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
              :value="selectedClip.duration ?? 2"
              @change="
                store.updateClip(selectedClip!.id!, {
                  duration: Math.max(0.1, Number(($event.target as HTMLInputElement).value)),
                });
                store.commitState();
              "
            />
            <span class="text-[10px] text-studio-text-muted">s</span>
          </div>
        </div>
      </div>

      <!-- Audio Panel (shown when a clip is selected) -->
      <AudioPanel v-if="selectedClip" :clip="selectedClip" />

      <!-- Keyframe panel (shown when a keyframe is selected) -->
      <KeyframePanel />

      <!-- Delete Button -->
      <div class="px-4 py-4 border-t border-studio-border mt-auto">
        <button
          class="w-full py-2 text-sm text-studio-error bg-studio-error/10 rounded hover:bg-studio-error/20 transition-colors"
          @click="deleteElement"
        >
          Delete Element
        </button>
      </div>
    </div>

    <!-- 3D Camera Preview Panel (when nothing selected and scene is 3D) -->
    <Scene3DPanel v-if="!selectedElement && store.project.sceneType === '3d'" />

    <!-- Add Element Buttons (when nothing selected) -->
    <div v-if="!selectedElement" class="p-4 border-t border-studio-border">
      <p class="text-xs text-studio-text-muted mb-3">Quick Add</p>
      <div class="flex gap-2">
        <button class="btn btn-secondary text-xs flex-1" @click="addTextElement">+ Text</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../store/project.js';
import LayoutPanel from './LayoutPanel.vue';
import StylePanel from './StylePanel.vue';
import TimingPanel from './TimingPanel.vue';
import AnimationPanel from './AnimationPanel.vue';
import AudioPanel from './AudioPanel.vue';
import KeyframePanel from './KeyframePanel.vue';
import Position3DPanel from './Position3DPanel.vue';
import Scene3DPanel from './Scene3DPanel.vue';

const store = useProjectStore();

const selectedElement = computed(() => store.selectedObject);
const selectedClip = computed(() => store.selectedClip);

const RASTER_TYPES = new Set(['image', 'svg_asset']);
const bothNonRaster = computed(() => {
  const c = selectedClip.value;
  if (!c || c.type !== 'transform') return false;
  const s = store.objectById(c.sourceId ?? '');
  const t = store.objectById(c.targetId ?? '');
  return s && t && !RASTER_TYPES.has(s.type) && !RASTER_TYPES.has(t.type);
});

const OBJ_3D_TYPES = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
const is3DObject = computed(() => OBJ_3D_TYPES.includes(selectedElement.value?.type ?? ''));

const typeBadgeClass = computed(() => {
  if (!selectedElement.value) return '';
  const classes: Record<string, string> = {
    text: 'bg-indigo-600 text-white',
    image: 'bg-emerald-600 text-white',
    svg: 'bg-amber-600 text-white',
  };
  return classes[selectedElement.value.type] || 'bg-slate-600 text-white';
});

function updateElement(updates: Partial<SceneObject>) {
  if (!selectedElement.value) return;
  store.updateObject(selectedElement.value.id, updates);
}

function updateContent(content: string) {
  updateElement({ content } as Partial<SceneObject>);
}

function deleteElement() {
  if (!selectedElement.value) return;
  if (confirm('Delete this element?')) {
    store.deleteObject(selectedElement.value.id);
  }
}

function addTextElement() {
  const element = store.addObject('text', undefined, undefined, { content: 'New Text' });
  store.selectObject(element.id);
}
</script>
