<template>
  <div class="keyframe-lane flex border-b border-studio-border/20" style="height: 20px;">
    <div
      class="flex-shrink-0 flex items-center px-2 text-[9px] text-studio-text-muted/60 bg-studio-bg/10 border-r border-studio-border/30 truncate"
      :style="{ width: labelW + 'px' }"
    >
      ↳ {{ prop }}
    </div>
    <div
      class="relative flex-1 overflow-hidden cursor-crosshair"
      :style="{ width: totalW + 'px' }"
      @dblclick="onDblClick"
    >
      <div :style="{ width: totalW + 'px' }" class="h-full relative">
        <!-- Segment lines between keyframes (drawn first; diamonds sit on top) -->
        <svg
          v-if="sortedKeyframes.length > 1"
          class="absolute top-0 left-0 w-full h-full pointer-events-none"
          :width="totalW"
          height="20"
        >
          <template v-for="(kf, i) in sortedKeyframes.slice(0, -1)" :key="'seg-' + kf.time">
            <!-- visible thin line -->
            <line
              :x1="kf.time * pps" y1="10" :x2="sortedKeyframes[i + 1].time * pps" y2="10"
              :stroke="modeColor" stroke-width="2" stroke-opacity="0.45" style="pointer-events: none"
            />
            <!-- wide transparent hit area so the segment is easy to click -->
            <line
              :x1="kf.time * pps" y1="10" :x2="sortedKeyframes[i + 1].time * pps" y2="10"
              stroke="transparent" stroke-width="16"
              style="pointer-events: all; cursor: pointer"
              @click.stop="openEasingPopup(kf, sortedKeyframes[i + 1], $event)"
            />
          </template>
        </svg>
        <!-- Keyframe diamonds -->
        <div
          v-for="kf in sortedKeyframes"
          :key="kf.time"
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-transform hover:scale-125"
          :class="{ 'scale-150': isSelected(kf) }"
          :style="{ left: kf.time * pps + 'px' }"
          :title="`t=${kf.time.toFixed(2)}s  v=${kf.value}` + (isSelected(kf) ? ' (selected)' : '')"
          @click.stop="toggleKf(kf)"
          @contextmenu.prevent="rightClickKf(kf)"
          @mousedown.stop="startDrag(kf, $event)"
        >
          <svg width="10" height="10" viewBox="-5 -5 10 10">
            <polygon
              points="0,-4 4,0 0,4 -4,0"
              :fill="isSelected(kf) ? '#ffffff' : modeColor"
              :stroke="isSelected(kf) ? modeColor : 'white'"
              :stroke-width="isSelected(kf) ? 1.4 : 0.8"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';

const props = defineProps({
  objId:  { type: String, required: true },
  prop:   { type: String, required: true },
  pps:    { type: Number, required: true },
  labelW: { type: Number, required: true },
  totalW: { type: Number, required: true },
});

const emit = defineEmits(['openEasingPopup']);

const store = useProjectStore();
const obj = computed(() => store.objectById(props.objId));
const keyframes = computed(() => obj.value?.keyframes?.[props.prop] || []);
const sortedKeyframes = computed(() => [...keyframes.value].sort((a, b) => a.time - b.time));
const mode = computed(() => obj.value?.keyframeMode?.[props.prop] || store.project.keyframeDefaults?.mode || 'opt-in');
const modeColor = computed(() => ({ override: '#ffd700', additive: '#ff9d42', 'opt-in': '#60a5fa' }[mode.value] || '#60a5fa'));

// Keyframes must stay within the object's visible interval [enter, enter+duration].
const objStart = computed(() => obj.value?.enterTime || 0);
const objEnd = computed(() => objStart.value + (obj.value?.duration ?? 3));
function clampToObj(t) { return Math.max(objStart.value, Math.min(objEnd.value, t)); }

function isSelected(kf) {
  const s = store.selectedKeyframeId;
  return !!s && s.objId === props.objId && s.prop === props.prop && Math.abs(s.time - kf.time) < 0.01;
}
function selectKf(kf) {
  store.selectKeyframe(props.objId, props.prop, kf.time);
}
// Click toggles selection: select if not selected, clear if already selected.
// Suppressed right after a drag (the trailing click shouldn't toggle).
function toggleKf(kf) {
  if (_dragMoved) { _dragMoved = false; return; }
  if (isSelected(kf)) store.selectKeyframe(null, null, null);
  else store.selectKeyframe(props.objId, props.prop, kf.time);
}

function rightClickKf(kf) {
  store.removeKeyframe(props.objId, props.prop, kf.time);
}

function onDblClick(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const raw = Math.round(((e.clientX - rect.left) / props.pps) * 100) / 100;
  const t = Math.round(clampToObj(raw) * 100) / 100;
  const currentVal = obj.value?.[props.prop] ?? 0;
  store.addKeyframe(props.objId, props.prop, t, currentVal);
}

let _dragMoved = false;
function startDrag(kf, e) {
  _dragMoved = false;
  // Don't select on mousedown — let the click handler toggle pure clicks.
  // A real drag selects via the move handler below.
  const startX = e.clientX;
  const origTime = kf.time;
  let currentTime = origTime;

  const move = (ev) => {
    const dt = (ev.clientX - startX) / props.pps;
    const newTime = Math.round(clampToObj(origTime + dt) * 100) / 100;
    if (newTime === currentTime) return;
    _dragMoved = true;
    // Mutate store state directly without committing (avoid undo history on every pixel)
    const obj = store.project.objects.find(o => o.id === props.objId);
    if (!obj?.keyframes?.[props.prop]) return;
    const kfArr = obj.keyframes[props.prop];
    const idx = kfArr.findIndex(k => Math.abs(k.time - currentTime) < 0.01);
    if (idx >= 0) {
      kfArr[idx] = { ...kfArr[idx], time: newTime };
      kfArr.sort((a, b) => a.time - b.time);
    }
    store.selectKeyframe(props.objId, props.prop, newTime);
    currentTime = newTime;
  };

  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    store.isDirty = true;
    store.commitState();
  };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function openEasingPopup(k1, k2, e) {
  emit('openEasingPopup', { objId: props.objId, prop: props.prop, k1, k2, event: e });
}
</script>
