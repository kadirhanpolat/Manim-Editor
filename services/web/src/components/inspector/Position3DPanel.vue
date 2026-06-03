<template>
  <div class="px-4 py-3 border-b border-studio-border">
    <span class="text-xs text-studio-text-muted uppercase tracking-wider">3D Position</span>
    <div class="grid grid-cols-3 gap-2 mt-2">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">X</label>
        <input type="number" :value="element.x3d ?? 0" @input="update('x3d', $event)" step="0.1" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Y</label>
        <input type="number" :value="element.y3d ?? 0" @input="update('y3d', $event)" step="0.1" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Z</label>
        <input type="number" :value="element.z3d ?? 0" @input="update('z3d', $event)" step="0.1" class="input text-sm" />
      </div>
    </div>
    <div class="grid grid-cols-3 gap-2 mt-2">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot X°</label>
        <input type="number" :value="element.rx ?? 0" @input="update('rx', $event)" step="5" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot Y°</label>
        <input type="number" :value="element.ry ?? 0" @input="update('ry', $event)" step="5" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot Z°</label>
        <input type="number" :value="element.rz ?? 0" @input="update('rz', $event)" step="5" class="input text-sm" />
      </div>
    </div>
    <div class="mt-2" v-if="element.resolution !== undefined">
      <label class="block text-xs text-studio-text-muted mb-1">Resolution</label>
      <input type="number" :value="element.resolution ?? 20" @input="update('resolution', $event)" min="4" max="64" step="4" class="input text-sm w-24" />
    </div>
    <div class="mt-2" v-if="element.type === 'axes3d'">
      <label class="block text-xs text-studio-text-muted mb-1">X Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input type="number" :value="element.xRange?.[0] ?? -3" @input="updateRange('xRange', 0, $event)" step="1" class="input text-sm w-16" />
        <span>–</span>
        <input type="number" :value="element.xRange?.[1] ?? 3" @input="updateRange('xRange', 1, $event)" step="1" class="input text-sm w-16" />
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({ element: { type: Object, required: true } });
const emit = defineEmits(['update']);

function update(key, e) {
  emit('update', { [key]: parseFloat(e.target.value) || 0 });
}

function updateRange(field, idx, e) {
  const range = [...(props.element[field] ?? [-3, 3, 1])];
  range[idx] = parseFloat(e.target.value) || 0;
  emit('update', { [field]: range });
}
</script>
