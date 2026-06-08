<template>
  <!-- Effects -->
  <Section v-if="canGradient || canDash || canRound || canShadow" label="Effects">
    <div class="space-y-2">
      <!-- Gradient -->
      <div v-if="canGradient">
        <button
          data-test="gradient-toggle"
          class="flex items-center justify-between w-full text-[10px] text-studio-text-muted"
          @click="toggleGradient"
        >
          <span>Gradient</span>
          <span :class="obj.gradient ? 'text-studio-accent' : ''">{{
            obj.gradient ? 'On' : 'Off'
          }}</span>
        </button>
        <div v-if="obj.gradient" class="mt-1.5 space-y-1.5">
          <div v-for="(c, i) in obj.gradient.colors ?? []" :key="i" class="flex items-center gap-2">
            <input
              type="color"
              class="color-input"
              :value="c"
              @input="onGradientStopInput(i, $event)"
            />
            <button
              v-if="(obj.gradient.colors ?? []).length > 2"
              class="text-studio-error text-xs px-1"
              :aria-label="'Remove gradient stop ' + (i + 1)"
              @click="removeGradientStop(i)"
            >
              ✕
            </button>
          </div>
          <button class="text-[10px] text-studio-accent" @click="addGradientStop">
            + Add stop
          </button>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-12">Angle</span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              class="flex-1 accent-studio-accent"
              :value="obj.gradient.angle ?? 135"
              aria-label="Gradient angle"
              @input="onGradientAngleInput($event)"
            />
            <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums"
              >{{ obj.gradient.angle ?? 135 }}°</span
            >
          </div>
        </div>
      </div>

      <!-- Rounded corners -->
      <div v-if="canRound" data-test="corner-radius" class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Corner radius</span>
        <input
          class="input input-sm w-16"
          type="number"
          min="0"
          step="1"
          :value="obj.cornerRadius || 0"
          @change="onCornerRadiusChange($event)"
        />
      </div>

      <!-- Drop shadow -->
      <div v-if="canShadow" class="space-y-1 border-t border-studio-border/40 pt-2">
        <button
          data-test="shadow-toggle"
          class="w-full py-1 text-[11px] rounded border"
          :class="
            obj.shadow
              ? 'border-studio-accent text-studio-accent'
              : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'
          "
          @click="
            store.setShadow(
              obj.id,
              obj.shadow ? null : { color: '#000000', opacity: 0.4, dx: 8, dy: 8, blur: 12 }
            )
          "
        >
          {{ obj.shadow ? 'Drop shadow: on' : 'Drop shadow: off' }}
        </button>
        <div v-if="obj.shadow" class="grid grid-cols-2 gap-1 items-center">
          <label class="text-[10px] text-studio-text-muted">Color</label>
          <input
            type="color"
            class="w-full h-6 rounded bg-studio-bg border border-studio-border"
            :value="obj.shadow.color"
            @input="onShadowColorInput($event)"
          />
          <label class="text-[10px] text-studio-text-muted">Opacity</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            class="input input-sm"
            :value="obj.shadow.opacity"
            @input="onShadowOpacityInput($event)"
          />
          <label class="text-[10px] text-studio-text-muted">Offset X</label>
          <input
            type="number"
            step="1"
            class="input input-sm"
            :value="obj.shadow.dx"
            @input="onShadowDxInput($event)"
          />
          <label class="text-[10px] text-studio-text-muted">Offset Y</label>
          <input
            type="number"
            step="1"
            class="input input-sm"
            :value="obj.shadow.dy"
            @input="onShadowDyInput($event)"
          />
          <label class="text-[10px] text-studio-text-muted">Blur (preview)</label>
          <input
            type="number"
            step="1"
            min="0"
            class="input input-sm"
            :value="obj.shadow.blur"
            @input="onShadowBlurInput($event)"
          />
        </div>
      </div>

      <!-- Fill opacity -->
      <div v-if="canGradient" class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Fill opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="flex-1 accent-studio-accent"
          :value="obj.fillOpacity ?? 1"
          aria-label="Fill opacity"
          @input="onFillOpacityInput($event)"
        />
        <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums"
          >{{ Math.round((obj.fillOpacity ?? 1) * 100) }}%</span
        >
      </div>

      <!-- Stroke opacity -->
      <div v-if="canGradient" class="flex items-center gap-2">
        <span class="text-[10px] text-studio-text-muted w-20">Stroke opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="flex-1 accent-studio-accent"
          :value="obj.strokeOpacity ?? 1"
          aria-label="Stroke opacity"
          @input="onStrokeOpacityInput($event)"
        />
        <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums"
          >{{ Math.round((obj.strokeOpacity ?? 1) * 100) }}%</span
        >
      </div>

      <!-- Dashed stroke -->
      <div v-if="canDash">
        <button
          class="flex items-center justify-between w-full text-[10px] text-studio-text-muted"
          @click="toggleDash"
        >
          <span>Dashed stroke</span>
          <span :class="obj.dash ? 'text-studio-accent' : ''">{{ obj.dash ? 'On' : 'Off' }}</span>
        </button>
        <div v-if="obj.dash" class="mt-1.5 space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-16">Density</span>
            <input
              type="range"
              min="2"
              max="60"
              step="1"
              class="flex-1 accent-studio-accent"
              :value="obj.dash.numDashes"
              aria-label="Dash density"
              @input="onDashFieldInput('numDashes', $event)"
            />
            <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{
              obj.dash.numDashes
            }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-16">Ratio</span>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              class="flex-1 accent-studio-accent"
              :value="obj.dash.ratio"
              aria-label="Dash ratio"
              @input="onDashFieldInput('ratio', $event)"
            />
            <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{
              obj.dash.ratio
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';

const props = defineProps({ obj: { type: Object as () => SceneObject, required: true } });
const store = useProjectStore();
const { u } = useObjectUpdate(() => props.obj);
const obj = computed(() => props.obj);

const GRADIENT_TYPES = new Set([
  'rectangle',
  'square',
  'circle',
  'ellipse',
  'triangle',
  'star',
  'polygon',
  'heart',
  'annulus',
  'sector',
  'polygon_free',
]);
const DASH_TYPES = new Set([
  'rectangle',
  'square',
  'circle',
  'ellipse',
  'triangle',
  'star',
  'polygon',
  'heart',
  'line',
  'arrow',
  'annulus',
  'sector',
  'arc',
  'double_arrow',
  'polygon_free',
  'parametric',
]);
const ROUND_TYPES = new Set(['rectangle', 'square', 'polygon', 'triangle', 'star']);
const SHADOW_TYPES = new Set([
  'rectangle',
  'square',
  'circle',
  'ellipse',
  'triangle',
  'star',
  'polygon',
  'heart',
  'annulus',
  'sector',
  'polygon_free',
  'text',
  'latex',
]);
const canGradient = computed(() => obj.value && GRADIENT_TYPES.has(obj.value.type));
const canDash = computed(() => obj.value && DASH_TYPES.has(obj.value.type));
const canRound = computed(() => obj.value && ROUND_TYPES.has(obj.value.type));
const canShadow = computed(() => obj.value && SHADOW_TYPES.has(obj.value.type));

function toggleGradient() {
  if (!obj.value) return;
  if (obj.value.gradient) store.setGradient(obj.value.id, null);
  else
    store.setGradient(obj.value.id, {
      colors: [obj.value.fill || '#3b82f6', '#8b5cf6'],
      angle: 135,
    });
}
function setGradientStop(i: number, color: string) {
  const g = obj.value.gradient;
  if (!g) return;
  const colors = [...(g.colors ?? [])];
  colors[i] = color;
  store.setGradient(obj.value.id, { angle: g.angle, colors });
}
function onGradientStopInput(i: number, e: Event) {
  setGradientStop(i, (e.target as HTMLInputElement).value);
}
function addGradientStop() {
  const g = obj.value.gradient;
  if (!g) return;
  store.setGradient(obj.value.id, { angle: g.angle, colors: [...(g.colors ?? []), '#ffffff'] });
}
function removeGradientStop(i: number) {
  const g = obj.value.gradient;
  if (!g || (g.colors ?? []).length <= 2) return;
  store.setGradient(obj.value.id, {
    angle: g.angle,
    colors: (g.colors ?? []).filter((_, j) => j !== i),
  });
}
function setGradientAngle(deg: unknown) {
  const g = obj.value.gradient;
  if (!g) return;
  store.setGradient(obj.value.id, { colors: g.colors ?? [], angle: Number(deg) });
}
function onGradientAngleInput(e: Event) {
  setGradientAngle((e.target as HTMLInputElement).value);
}
function onCornerRadiusChange(e: Event) {
  store.setCornerRadius(obj.value.id, Number((e.target as HTMLInputElement).value));
}
function onShadowColorInput(e: Event) {
  if (!obj.value.shadow) return;
  store.setShadow(obj.value.id, {
    ...obj.value.shadow,
    color: (e.target as HTMLInputElement).value,
  });
}
function onShadowOpacityInput(e: Event) {
  if (!obj.value.shadow) return;
  store.setShadow(obj.value.id, {
    ...obj.value.shadow,
    opacity: Number((e.target as HTMLInputElement).value),
  });
}
function onShadowDxInput(e: Event) {
  if (!obj.value.shadow) return;
  store.setShadow(obj.value.id, {
    ...obj.value.shadow,
    dx: Number((e.target as HTMLInputElement).value),
  });
}
function onShadowDyInput(e: Event) {
  if (!obj.value.shadow) return;
  store.setShadow(obj.value.id, {
    ...obj.value.shadow,
    dy: Number((e.target as HTMLInputElement).value),
  });
}
function onShadowBlurInput(e: Event) {
  if (!obj.value.shadow) return;
  store.setShadow(obj.value.id, {
    ...obj.value.shadow,
    blur: Number((e.target as HTMLInputElement).value),
  });
}
function onFillOpacityInput(e: Event) {
  u('fillOpacity', Number((e.target as HTMLInputElement).value));
}
function onStrokeOpacityInput(e: Event) {
  u('strokeOpacity', Number((e.target as HTMLInputElement).value));
}
function toggleDash() {
  if (!obj.value) return;
  if (obj.value.dash) store.setDash(obj.value.id, null);
  else store.setDash(obj.value.id, { numDashes: 12, ratio: 0.5 });
}
function setDashField(key: string, val: unknown) {
  const d = obj.value.dash ?? { numDashes: 12, ratio: 0.5 };
  store.setDash(obj.value.id, { ...d, [key]: Number(val) });
}
function onDashFieldInput(key: string, e: Event) {
  setDashField(key, (e.target as HTMLInputElement).value);
}
</script>
