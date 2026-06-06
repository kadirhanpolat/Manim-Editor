<template>
      <div class="panel-header flex items-center justify-between">
        Properties
        <span class="px-1.5 py-0.5 text-[9px] rounded-md font-bold uppercase" :class="typeBadge">{{ typeLabel }}</span>
      </div>

      <!-- Name -->
      <Section label="Name">
        <input class="input input-sm" :value="obj.name" @change="u('name', $event.target.value)" />
      </Section>

      <!-- 3D position / rotation / type params (3D objects only) -->
      <Position3DPanel v-if="is3DObject" :element="obj" @update="onObj3DUpdate" />

      <!-- Position & Size (type-aware: match what preview actually renders) -->
      <Section label="Position & Size">
        <div class="grid grid-cols-2 gap-1.5">
          <Num label="X" :value="obj.x" @input="u('x', $event)" />
          <Num label="Y" :value="obj.y" @input="u('y', $event)" />
          <!-- Symmetric shapes: single Size (preview uses min(w,h)) -->
          <template v-if="['circle','star','polygon','dot'].includes(obj.type)">
            <Num label="Size" :value="effectiveSize" :min="1" class="col-span-2" @input="uSize($event)" />
          </template>
          <!-- Line/Arrow: Length only (height unused in preview) -->
          <template v-else-if="['line','arrow'].includes(obj.type)">
            <Num label="Length" :value="obj.width" :min="1" class="col-span-2" @input="u('width', $event)" />
          </template>
          <!-- Text: no width/height (size = fontSize) -->
          <template v-else-if="obj.type === 'text'">
            <!-- X,Y only; fontSize in Text Style -->
          </template>
          <!-- Rect-like: Width + Height -->
          <template v-else>
            <Num label="Width" :value="obj.width" :min="1" @input="u('width', $event)" />
            <Num label="Height" :value="obj.height" :min="1" @input="u('height', $event)" />
          </template>
        </div>
      </Section>

      <!-- 3x3 Alignment Grid -->
      <Section label="Align to Canvas">
        <div class="anchor-grid">
          <div v-for="(row, ri) in anchorGrid" :key="ri" class="flex gap-1">
            <button
              v-for="anchor in row"
              :key="anchor"
              class="anchor-btn"
              :title="anchor.replace('_', ' ')"
              @click="align(anchor)"
            >{{ anchorLabels[anchor] }}</button>
          </div>
        </div>
      </Section>

      <!-- Rotation -->
      <Section label="Rotation">
        <div class="flex items-center gap-2">
          <input class="input input-sm flex-1" type="number" :value="obj.rotation || 0" @change="u('rotation', Number($event.target.value))" />
          <span class="text-[10px] text-studio-text-muted">deg</span>
        </div>
      </Section>

      <!-- Colors -->
      <Section v-if="obj.type !== 'text'" label="Colors">
        <div class="space-y-1.5">
          <ColorRow label="Fill" :value="obj.fill" @input="u('fill', $event)" />
          <ColorRow label="Stroke" :value="obj.stroke" @input="u('stroke', $event)" />
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-12">Stroke W</span>
            <input class="input input-sm w-16" type="number" min="0" step="0.5" :value="obj.strokeWidth" @change="u('strokeWidth', Number($event.target.value))" />
          </div>
        </div>
      </Section>

      <!-- Text Properties -->
      <TextSettings v-if="obj.type === 'text'" :obj="obj" />

      <!-- Opacity -->
      <Section label="Opacity">
        <div class="flex items-center gap-2">
          <input type="range" min="0" max="1" step="0.01" class="flex-1 accent-studio-accent" :value="obj.opacity" @input="u('opacity', Number($event.target.value))" />
          <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{ Math.round((obj.opacity ?? 1) * 100) }}%</span>
        </div>
      </Section>

      <EffectsSection :obj="obj" />

      <!-- Timeline presence -->
      <Section label="Timeline">
        <div class="grid grid-cols-2 gap-1.5">
          <Num label="Enter (s)" :value="obj.enterTime || 0" :min="0" :step="0.1" @input="u('enterTime', $event)" />
          <Num label="Duration (s)" :value="obj.duration || 3" :min="0.1" :step="0.1" @input="u('duration', $event)" />
        </div>
      </Section>

      <component :is="settingsComp" v-if="settingsComp" :obj="obj" />

      <!-- Z-Order -->
      <Section label="Layer Order">
        <input class="input input-sm w-16" type="number" min="0" :value="obj.zOrder || 0" @change="u('zOrder', Number($event.target.value))" />
      </Section>

      <!-- Group info -->
      <Section v-if="objGroup" label="Group">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-studio-text-muted">{{ objGroup.name }}</span>
          <button class="text-[10px] text-studio-accent hover:underline" @click="ungroup(objGroup.id)">Ungroup</button>
        </div>
      </Section>

      <!-- ═══ Entrance Animation ═══ -->
      <Section label="Entrance">
        <div class="space-y-1.5">
          <select class="select text-xs" :value="obj.enterAnim || 'fade_in'" @change="u('enterAnim', $event.target.value)">
            <option v-for="a in enterAnims" :key="a.value" :value="a.value">{{ a.icon }} {{ a.label }}</option>
          </select>
          <div v-if="obj.enterAnim && obj.enterAnim !== 'none'" class="flex items-center gap-2">
            <span class="text-[9px] text-studio-text-muted w-14">Duration</span>
            <input class="input input-sm w-16" type="number" min="0.1" max="5" step="0.1" :value="obj.enterAnimDur || 0.5" @change="u('enterAnimDur', Number($event.target.value))" />
            <span class="text-[9px] text-studio-text-muted">s</span>
          </div>
          <p class="text-[8px] text-studio-text-muted/40 leading-snug">{{ enterAnimDesc }}</p>
        </div>
      </Section>

      <!-- ═══ Exit Animation ═══ -->
      <Section label="Exit">
        <div class="space-y-1.5">
          <select class="select text-xs" :value="obj.exitAnim || 'fade_out'" @change="u('exitAnim', $event.target.value)">
            <option v-for="a in exitAnims" :key="a.value" :value="a.value">{{ a.icon }} {{ a.label }}</option>
          </select>
          <div v-if="obj.exitAnim && obj.exitAnim !== 'none'" class="flex items-center gap-2">
            <span class="text-[9px] text-studio-text-muted w-14">Duration</span>
            <input class="input input-sm w-16" type="number" min="0.1" max="5" step="0.1" :value="obj.exitAnimDur || 0.5" @change="u('exitAnimDur', Number($event.target.value))" />
            <span class="text-[9px] text-studio-text-muted">s</span>
          </div>
          <p class="text-[8px] text-studio-text-muted/40 leading-snug">{{ exitAnimDesc }}</p>
        </div>
      </Section>

      <MotionPicker :obj="obj" />

      <div class="px-3 py-3 mt-auto">
        <button class="btn btn-danger btn-xs w-full" @click="del">Delete Object</button>
      </div>
</template>

<script setup>
import { computed } from 'vue';
import { settingsComponentFor } from '../object-settings/index.js';
import { useProjectStore } from '../../../store/project.js';
import { ENTER_ANIMS, EXIT_ANIMS } from '../../../store/project.js';
import { ANCHOR_GRID, ANCHOR_LABELS } from '../../../constants/anchors.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
import ColorRow from '../ui/ColorRow.vue';
import Position3DPanel from '../Position3DPanel.vue';
import EffectsSection from '../object-settings/EffectsSection.vue';
import TextSettings from '../object-settings/TextSettings.vue';
import MotionPicker from '../object-settings/MotionPicker.vue';

const store = useProjectStore();
const anchorGrid = ANCHOR_GRID;
const anchorLabels = ANCHOR_LABELS;
const enterAnims = ENTER_ANIMS;
const exitAnims = EXIT_ANIMS;

const obj = computed(() => store.selectedObject);
const { u, uSize } = useObjectUpdate(() => obj.value);
const settingsComp = computed(() => settingsComponentFor(obj.value?.type));

const OBJ_3D_TYPES = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
const is3DObject = computed(() => !!obj.value && OBJ_3D_TYPES.includes(obj.value.type));
function onObj3DUpdate(payload) { if (obj.value) store.updateObject(obj.value.id, payload); }

const enterAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = ENTER_ANIMS.find(a => a.value === (obj.value.enterAnim || 'fade_in'));
  return a ? a.desc : '';
});
const exitAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = EXIT_ANIMS.find(a => a.value === (obj.value.exitAnim || 'fade_out'));
  return a ? a.desc : '';
});
const objGroup = computed(() => (obj.value ? store.objectGroup(obj.value.id) : null));
const typeLabel = computed(() => {
  if (!obj.value) return '';
  const m = { dot_grid: 'Dot Grid', svg_asset: 'SVG', rectangle: 'Rectangle', latex: 'LaTeX', axes: 'Axes', polygon: 'Polygon' };
  return m[obj.value.type] || obj.value.type;
});
const typeBadge = computed(() => {
  const m = {
    heart: 'bg-pink-600 text-white', square: 'bg-blue-600 text-white', rectangle: 'bg-blue-600 text-white',
    circle: 'bg-green-600 text-white', ellipse: 'bg-cyan-600 text-white',
    triangle: 'bg-amber-600 text-white', star: 'bg-yellow-600 text-white', polygon: 'bg-purple-600 text-white',
    line: 'bg-gray-600 text-white', arrow: 'bg-red-600 text-white',
    dot: 'bg-gray-600 text-white', dot_grid: 'bg-purple-600 text-white',
    text: 'bg-pink-500 text-white', image: 'bg-amber-600 text-white', svg_asset: 'bg-amber-600 text-white',
    latex: 'bg-purple-600 text-white', axes: 'bg-emerald-600 text-white',
  };
  return m[obj.value?.type] || 'bg-gray-600 text-white';
});
const effectiveSize = computed(() => {
  if (!obj.value) return 0;
  return Math.min(obj.value.width || 0, obj.value.height || 0) || 1;
});

function align(anchor) { if (obj.value) store.alignObject(obj.value.id, anchor); }
function ungroup(groupId) { store.ungroupObjects(groupId); }
function del() { if (obj.value) store.deleteObject(obj.value.id); }
</script>

<style scoped>
.anchor-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background: var(--studio-bg);
  border-radius: 6px;
  width: fit-content;
}
.anchor-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--studio-surface);
  border: 1px solid var(--studio-border);
  border-radius: 4px;
  color: var(--studio-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.anchor-btn:hover {
  background: var(--studio-border);
  color: var(--studio-text);
}
.anchor-btn:active {
  background: var(--studio-accent);
  border-color: var(--studio-accent);
  color: var(--studio-text);
}


</style>
