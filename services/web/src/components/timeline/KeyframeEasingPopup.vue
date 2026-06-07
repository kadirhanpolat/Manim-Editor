<template>
  <div
    v-if="visible"
    class="keyframe-popup fixed z-50 bg-studio-surface border border-studio-border rounded-lg shadow-xl p-3"
    :style="{ left: posX + 'px', top: posY + 'px', width: '200px' }"
    @mousedown.stop
  >
    <div class="text-[10px] text-studio-text-muted mb-2">Segment easing · {{ prop }}</div>

    <!-- Bezier preview SVG -->
    <svg class="w-full rounded bg-studio-bg mb-2" height="60" viewBox="0 0 180 60">
      <path :d="curvePath" stroke="#ffd700" stroke-width="1.5" fill="none" />
      <line
        :x1="10"
        :y1="50"
        :x2="h1x"
        :y2="h1y"
        stroke="#4a90d9"
        stroke-width="1"
        stroke-dasharray="2"
      />
      <line
        :x1="170"
        :y1="10"
        :x2="h2x"
        :y2="h2y"
        stroke="#4a90d9"
        stroke-width="1"
        stroke-dasharray="2"
      />
      <circle
        :cx="h1x"
        :cy="h1y"
        r="4"
        fill="none"
        stroke="#4a90d9"
        stroke-width="1.5"
        class="cursor-grab"
        @mousedown.prevent="startHandleDrag(0, $event)"
      />
      <circle
        :cx="h2x"
        :cy="h2y"
        r="4"
        fill="none"
        stroke="#4a90d9"
        stroke-width="1.5"
        class="cursor-grab"
        @mousedown.prevent="startHandleDrag(1, $event)"
      />
      <circle cx="10" cy="50" r="3" fill="#ffd700" />
      <circle cx="170" cy="10" r="3" fill="#ffd700" />
    </svg>

    <!-- Preset buttons -->
    <div class="flex flex-wrap gap-1 mb-2">
      <button
        v-for="preset in PRESETS"
        :key="preset.name"
        class="px-1.5 py-0.5 text-[9px] rounded border transition-colors"
        :class="
          activePreset === preset.name
            ? 'bg-studio-accent border-studio-accent text-white'
            : 'border-studio-border text-studio-text-muted hover:border-studio-accent/60'
        "
        @click="applyPreset(preset)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- codegenMode selector -->
    <div class="text-[9px] text-studio-text-muted mb-1">Codegen</div>
    <select
      :value="codegenMode"
      class="w-full text-[10px] bg-studio-bg border border-studio-border rounded px-1 py-0.5"
      @change="setCodegenMode($event.target.value)"
    >
      <option value="UpdateFromAlphaFunc">UpdateFromFunc</option>
      <option value="animate">animate</option>
      <option value="ValueTracker">ValueTracker</option>
    </select>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '../../store/project.js';

const PRESETS = [
  { name: 'linear', label: 'Linear', handles: [0, 0, 1, 1] },
  { name: 'ease_in', label: 'Ease In', handles: [0.42, 0, 1, 1] },
  { name: 'ease_out', label: 'Ease Out', handles: [0, 0, 0.58, 1] },
  { name: 'ease_in_out', label: 'In-Out', handles: [0.42, 0, 0.58, 1] },
];

const props = defineProps({
  payload: { type: Object, default: null }, // { objId, prop, k1, k2, event }
});

defineEmits(['close']);
const store = useProjectStore();

const visible = computed(() => !!props.payload);
const prop = computed(() => props.payload?.prop);
const posX = ref(0);
const posY = ref(0);
const handles = ref([0.42, 0, 0.58, 1]);

watch(
  () => props.payload,
  (p) => {
    if (!p) return;
    posX.value = Math.min(p.event.clientX + 10, window.innerWidth - 220);
    posY.value = Math.min(p.event.clientY + 10, window.innerHeight - 230);
    const e = p.k1.easing;
    handles.value =
      e?.type === 'bezier' && e.handles
        ? [...e.handles]
        : PRESETS.find((pr) => pr.name === e?.type)?.handles || [0.42, 0, 0.58, 1];
  }
);

// SVG coordinate mapping: control point (0,0)→(10,50), (1,1)→(170,10)
const h1x = computed(() => 10 + handles.value[0] * 160);
const h1y = computed(() => 50 - handles.value[1] * 40);
const h2x = computed(() => 10 + handles.value[2] * 160);
const h2y = computed(() => 50 - handles.value[3] * 40);

const curvePath = computed(
  () => `M10,50 C${h1x.value},${h1y.value} ${h2x.value},${h2y.value} 170,10`
);

const activePreset = computed(() => {
  const h = handles.value;
  return (
    PRESETS.find(
      (pr) =>
        Math.abs(pr.handles[0] - h[0]) < 0.01 &&
        Math.abs(pr.handles[1] - h[1]) < 0.01 &&
        Math.abs(pr.handles[2] - h[2]) < 0.01 &&
        Math.abs(pr.handles[3] - h[3]) < 0.01
    )?.name || null
  );
});

const codegenMode = computed(() => {
  const p = props.payload;
  if (!p) return 'UpdateFromAlphaFunc';
  const obj = store.objectById(p.objId);
  return (
    obj?.keyframeCodegen?.[p.prop] ||
    store.project.keyframeDefaults?.codegenMode ||
    'UpdateFromAlphaFunc'
  );
});

function applyPreset(preset) {
  handles.value = [...preset.handles];
  saveEasing({ type: preset.name });
}

function saveEasing(easing) {
  const p = props.payload;
  if (!p) return;
  store.updateKeyframeEasing(p.objId, p.prop, p.k1.time, easing);
}

function setCodegenMode(mode) {
  const p = props.payload;
  if (!p) return;
  store.setKeyframeCodegen(p.objId, p.prop, mode);
}

function startHandleDrag(handleIdx, e) {
  const svgEl = e.target.closest('svg');
  const rect = svgEl.getBoundingClientRect();
  const move = (ev) => {
    const rx = Math.max(0, Math.min(1, (ev.clientX - rect.left - 10) / 160));
    const ry = Math.max(0, Math.min(1, (50 - (ev.clientY - rect.top)) / 40));
    const h = [...handles.value];
    if (handleIdx === 0) {
      h[0] = rx;
      h[1] = ry;
    } else {
      h[2] = rx;
      h[3] = ry;
    }
    handles.value = h;
    saveEasing({ type: 'bezier', handles: h });
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}
</script>
