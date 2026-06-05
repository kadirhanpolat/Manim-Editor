<template>
  <div class="keyframe-lane flex border-b border-studio-border/20" style="height: 20px;">
    <div
      class="flex-shrink-0 flex items-center gap-1 px-2 text-[9px] text-studio-text-muted/60 bg-studio-bg/10 border-r border-studio-border/30"
      :style="{ width: labelW + 'px' }"
    >
      <span class="truncate flex-1">↳ {{ prop }}</span>
      <button
        class="flex-shrink-0 text-sm font-bold text-studio-accent/80 hover:text-studio-accent leading-none px-1.5"
        title="Playhead konumuna keyframe ekle"
        @click.stop="addAtPlayhead"
      >+</button>
    </div>
    <div
      ref="laneArea"
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
            <!-- wide transparent hit area: single click → easing popup (debounced
                 so a double-click adds a keyframe on the segment instead) -->
            <line
              :x1="kf.time * pps" y1="10" :x2="sortedKeyframes[i + 1].time * pps" y2="10"
              stroke="transparent" stroke-width="16"
              style="pointer-events: all; cursor: pointer"
              @click.stop="onSegClick(kf, sortedKeyframes[i + 1], $event)"
              @dblclick.stop="onSegDblClick($event)"
            />
          </template>
        </svg>
        <!-- Keyframe diamonds -->
        <div
          v-for="kf in sortedKeyframes"
          :key="kf.time"
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform"
          :class="[kf.pinned ? 'cursor-default' : 'cursor-pointer hover:scale-125', { 'scale-150': isSelected(kf) }]"
          :style="{ left: kf.time * pps + 'px' }"
          :title="`t=${kf.time.toFixed(2)}s  v=${kf.value}` + (kf.pinned ? ' (uçta sabit)' : '') + (isSelected(kf) ? ' (seçili)' : '')"
          @click.stop="toggleKf(kf)"
          @contextmenu.prevent="rightClickKf(kf)"
          @mousedown.stop="startDrag(kf, $event)"
        >
          <svg width="12" height="12" viewBox="-6 -6 12 12">
            <!-- locked halo marks a pinned (boundary) keyframe -->
            <circle v-if="kf.pinned" r="5" fill="none" :stroke="modeColor" stroke-width="0.8" stroke-opacity="0.55" />
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
import { computed, ref } from 'vue';
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

const laneArea = ref(null);
function addKfAt(clientX) {
  const el = laneArea.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const t = Math.round(clampToObj((clientX - rect.left) / props.pps) * 100) / 100;
  store.addKeyframe(props.objId, props.prop, t, obj.value?.[props.prop] ?? 0);
}
function onDblClick(e) { addKfAt(e.clientX); }

// Add a keyframe at the playhead (current playback time), clamped to the
// object's visible interval. Upserts within addKeyframe's 0.01s tolerance, so
// re-clicking without moving the playhead just refreshes the existing key.
function addAtPlayhead() {
  store.addKeyframeScaffold(props.objId, props.prop, store.playbackTime ?? 0);
}

// Segment click is debounced: a lone click opens the easing popup after a short
// delay; a double-click within that delay cancels it and adds a keyframe on the
// segment instead (so single = edit easing, double = insert key).
let _segClickTimer = null;
function onSegClick(k1, k2, e) {
  if (_segClickTimer) return;
  const ev = { clientX: e.clientX, clientY: e.clientY };
  _segClickTimer = setTimeout(() => {
    _segClickTimer = null;
    emit('openEasingPopup', { objId: props.objId, prop: props.prop, k1, k2, event: ev });
  }, 220);
}
function onSegDblClick(e) {
  if (_segClickTimer) { clearTimeout(_segClickTimer); _segClickTimer = null; }
  addKfAt(e.clientX);
}

let _dragMoved = false;
function startDrag(kf, e) {
  if (kf.pinned) return;  // boundary keyframes are locked to the object's edges
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
</script>
