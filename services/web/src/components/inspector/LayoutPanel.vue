<template>
  <div class="layout-panel px-4 py-3 border-b border-studio-border">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-studio-text-muted uppercase tracking-wider">Layout</span>
    </div>
    
    <!-- Anchor Grid -->
    <div class="mb-4">
      <label class="block text-xs text-studio-text-muted mb-2">Position Anchor</label>
      <AnchorGrid 
        :value="element.layout.anchor"
        @input="updateAnchor"
      />
    </div>
    
    <!-- Offset -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Offset X</label>
        <input 
          type="number"
          :value="element.layout.offset[0]"
          @input="updateOffsetX($event.target.value)"
          step="0.1"
          class="input text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Offset Y</label>
        <input 
          type="number"
          :value="element.layout.offset[1]"
          @input="updateOffsetY($event.target.value)"
          step="0.1"
          class="input text-sm"
        />
      </div>
    </div>
    
    <!-- Scale -->
    <div class="mb-4">
      <label class="block text-xs text-studio-text-muted mb-1">Scale</label>
      <div class="flex items-center gap-3">
        <input 
          type="range"
          :value="element.layout.scale"
          @input="updateScale($event.target.value)"
          min="0.1"
          max="3"
          step="0.1"
          class="flex-1"
        />
        <input 
          type="number"
          :value="element.layout.scale"
          @input="updateScale($event.target.value)"
          min="0.1"
          max="3"
          step="0.1"
          class="input text-sm w-20"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import AnchorGrid from '../stage/AnchorGrid.vue'

const props = defineProps({ element: { type: Object, required: true } })
const emit = defineEmits(['update'])

function updateAnchor(anchor) {
  emit('update', { layout: { ...props.element.layout, anchor } })
}

function updateOffsetX(value) {
  emit('update', { layout: { ...props.element.layout, offset: [parseFloat(value) || 0, props.element.layout.offset[1]] } })
}

function updateOffsetY(value) {
  emit('update', { layout: { ...props.element.layout, offset: [props.element.layout.offset[0], parseFloat(value) || 0] } })
}

function updateScale(value) {
  emit('update', { layout: { ...props.element.layout, scale: Math.max(0.1, parseFloat(value) || 1) } })
}
</script>
