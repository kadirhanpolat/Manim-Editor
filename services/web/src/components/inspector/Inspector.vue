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
          <span 
            class="px-2 py-0.5 text-xs rounded font-medium"
            :class="typeBadgeClass"
          >
            {{ selectedElement.type.toUpperCase() }}
          </span>
          <span class="text-sm text-studio-text-muted">{{ selectedElement.id }}</span>
        </div>
      </div>
      
      <!-- Text Content (for text elements) -->
      <div v-if="selectedElement.type === 'text'" class="px-4 py-3 border-b border-studio-border">
        <label class="block text-xs text-studio-text-muted mb-2">Content</label>
        <textarea
          :value="selectedElement.content"
          @input="updateContent($event.target.value)"
          class="input text-sm resize-none"
          rows="2"
          placeholder="Enter text..."
        ></textarea>
      </div>
      
      <!-- 3D Position Panel -->
      <Position3DPanel
        v-if="is3DObject"
        :element="selectedElement"
        @update="updateElement"
      />

      <!-- Layout Panel -->
      <LayoutPanel
        :element="selectedElement"
        @update="updateElement"
      />
      
      <!-- Style Panel -->
      <StylePanel 
        :element="selectedElement"
        @update="updateElement"
      />
      
      <!-- Timing Panel -->
      <TimingPanel 
        :element="selectedElement"
        @update="updateElement"
      />
      
      <!-- Animation Panel -->
      <AnimationPanel
        :element="selectedElement"
        @update="updateElement"
      />

      <!-- Rotate Axis Selector (shown when a rotate clip is selected in 3D mode) -->
      <div
        v-if="selectedClip?.type === 'rotate' && store.project.sceneType === '3d'"
        class="px-4 py-3 border-b border-studio-border"
      >
        <label class="block text-xs text-studio-text-muted mb-1">Rotation Axis</label>
        <select
          :value="selectedClip.axis ?? 'Z'"
          @change="store.updateClip(selectedClip.id, { axis: $event.target.value })"
          class="select text-sm w-full"
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
            @change="store.setClipMatchTerms(selectedClip.id, $event.target.checked)"
            class="w-3.5 h-3.5"
          />
          <span class="text-xs text-studio-text-muted">Match terms</span>
          <span class="text-xs text-studio-text-muted opacity-60">(TransformMatchingTex/Shapes)</span>
        </label>
      </div>

      <!-- Audio Panel (shown when a clip is selected) -->
      <AudioPanel
        v-if="selectedClip"
        :clip="selectedClip"
      />

      <!-- Keyframe panel (shown when a keyframe is selected) -->
      <KeyframePanel />

      <!-- Delete Button -->
      <div class="px-4 py-4 border-t border-studio-border mt-auto">
        <button 
          @click="deleteElement"
          class="w-full py-2 text-sm text-studio-error bg-studio-error/10 rounded hover:bg-studio-error/20 transition-colors"
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
        <button @click="addTextElement" class="btn btn-secondary text-xs flex-1">
          + Text
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useProjectStore } from '../../store/project.js'
import LayoutPanel from './LayoutPanel.vue'
import StylePanel from './StylePanel.vue'
import TimingPanel from './TimingPanel.vue'
import AnimationPanel from './AnimationPanel.vue'
import AudioPanel from './AudioPanel.vue'
import KeyframePanel from './KeyframePanel.vue'
import Position3DPanel from './Position3DPanel.vue'
import Scene3DPanel from './Scene3DPanel.vue'

const store = useProjectStore()

const selectedElement = computed(() => store.selectedObject)
const selectedClip = computed(() => store.selectedClip)

const RASTER_TYPES = new Set(['image', 'svg_asset'])
const bothNonRaster = computed(() => {
  const c = selectedClip.value
  if (!c || c.type !== 'transform') return false
  const s = store.objectById(c.sourceId)
  const t = store.objectById(c.targetId)
  return s && t && !RASTER_TYPES.has(s.type) && !RASTER_TYPES.has(t.type)
})

const OBJ_3D_TYPES = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d']
const is3DObject = computed(() => OBJ_3D_TYPES.includes(selectedElement.value?.type))

const typeBadgeClass = computed(() => {
  if (!selectedElement.value) return ''
  const classes = {
    text: 'bg-indigo-600 text-white',
    image: 'bg-emerald-600 text-white',
    svg: 'bg-amber-600 text-white'
  }
  return classes[selectedElement.value.type] || 'bg-slate-600 text-white'
})

function updateElement(updates) {
  if (!selectedElement.value) return
  store.updateObject(selectedElement.value.id, updates)
}

function updateContent(content) {
  updateElement({ content })
}

function deleteElement() {
  if (!selectedElement.value) return
  if (confirm('Delete this element?')) {
    store.deleteObject(selectedElement.value.id)
  }
}

function addTextElement() {
  const element = store.addObject('text', undefined, undefined, { content: 'New Text' })
  store.selectObject(element.id)
}
</script>
