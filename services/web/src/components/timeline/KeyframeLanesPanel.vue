<template>
  <div v-if="sourceObj" class="border-b border-studio-border/30">
    <!-- Lane header -->
    <div class="flex border-b border-studio-border/20" style="height:22px">
      <div
        class="flex-shrink-0 flex items-center px-2 bg-studio-bg/20 border-r border-studio-border/50 text-[9px] text-studio-accent font-medium"
        :style="{ width: labelW + 'px' }"
      >
        ◆ Keyframes
      </div>
      <div class="flex-1 relative overflow-hidden text-[9px] text-studio-text-muted flex items-center px-2 gap-3">
        <span>{{ sourceObj.name }}</span>
        <button
          v-for="p in addableProps"
          :key="p"
          class="text-studio-accent/70 hover:text-studio-accent leading-none"
          :title="`${p} için keyframe ekle`"
          @click="addPropLane(p)"
        >+ {{ p }}</button>
      </div>
    </div>

    <!-- Existing lanes -->
    <KeyframeLane
      v-for="prop in activePropLanes"
      :key="prop"
      :objId="sourceObj.id"
      :prop="prop"
      :pps="pps"
      :labelW="labelW"
      :totalW="totalW"
      @openEasingPopup="$emit('openEasingPopup', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
import KeyframeLane from './KeyframeLane.vue';

const KEYFRAMEABLE_PROPS = ['x', 'y', 'opacity', 'rotation', 'scaleX', 'scaleY', 'width', 'height', 'strokeWidth', 'fontSize'];
const KEYFRAMEABLE_PROPS_3D = ['x3d', 'y3d', 'z3d', 'rx', 'ry', 'rz', 'opacity'];
const OBJ_3D_TYPES = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];

const props = defineProps({
  pps:    { type: Number, required: true },
  labelW: { type: Number, required: true },
  totalW: { type: Number, required: true },
});

defineEmits(['openEasingPopup']);

const store = useProjectStore();
const selectedClip = computed(() => store.selectedClip);
// Keyframes are a per-object property, so resolve the object from the selected
// clip when there is one, otherwise from the directly selected object.
const sourceObj = computed(() => {
  const clip = selectedClip.value;
  if (clip?.sourceId) return store.objectById(clip.sourceId);
  return store.selectedObject || null;
});

const activePropLanes = computed(() => {
  const obj = sourceObj.value;
  if (!obj?.keyframes) return [];
  return Object.keys(obj.keyframes);
});

const addableProps = computed(() => {
  const obj = sourceObj.value;
  if (!obj) return [];
  const base = OBJ_3D_TYPES.includes(obj.type) ? KEYFRAMEABLE_PROPS_3D : KEYFRAMEABLE_PROPS;
  const active = new Set(activePropLanes.value);
  return base.filter(p => !active.has(p));
});

function addPropLane(prop) {
  if (!sourceObj.value) return;
  const val = sourceObj.value[prop] ?? 0;
  store.addKeyframe(sourceObj.value.id, prop, store.playbackTime ?? 0, val);
}
</script>
