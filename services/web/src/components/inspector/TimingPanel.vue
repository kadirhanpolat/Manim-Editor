<template>
  <div class="timing-panel px-4 py-3 border-b border-studio-border">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-studio-text-muted uppercase tracking-wider">Timing</span>
    </div>
    
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Start (s)</label>
        <input type="number" :value="element.timing.start" @input="updateTiming('start', parseFloat($event.target.value))" min="0" step="0.1" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Duration (s)</label>
        <input type="number" :value="element.timing.duration" @input="updateTiming('duration', parseFloat($event.target.value))" min="0.1" step="0.1" class="input text-sm" />
      </div>
    </div>
    
    <div class="mt-3">
      <div class="h-2 bg-studio-bg rounded-full overflow-hidden">
        <div class="h-full bg-studio-accent rounded-full transition-all" :style="previewStyle"></div>
      </div>
      <div class="flex justify-between mt-1">
        <span class="text-[10px] text-studio-text-muted">{{ element.timing.start.toFixed(1) }}s</span>
        <span class="text-[10px] text-studio-text-muted">{{ endTime.toFixed(1) }}s</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useProjectStore } from '../../store/project.js'

const props = defineProps({ element: { type: Object, required: true } })
const emit = defineEmits(['update'])

const store = useProjectStore()

const endTime = computed(() => props.element.timing.start + props.element.timing.duration)
const totalDuration = computed(() => store.computedDuration)
const previewStyle = computed(() => {
  const start = (props.element.timing.start / totalDuration.value) * 100
  const width = (props.element.timing.duration / totalDuration.value) * 100
  return { marginLeft: start + '%', width: width + '%' }
})

function updateTiming(key, value) {
  emit('update', {
    timing: { ...props.element.timing, [key]: Math.max(key === 'duration' ? 0.1 : 0, value || 0) }
  })
}
</script>
