<template>
      <!-- ═══ Motion (Timeline Clips) ═══ -->
      <Section label="Add Motion">
        <p class="text-[8px] text-studio-text-muted/50 mb-1.5">Create a timeline clip animation</p>
        <div class="grid grid-cols-2 gap-1">
          <button class="anim-btn move" @click="anim('move')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            Move
          </button>
          <button class="anim-btn scale" @click="anim('scale')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            Scale
          </button>
          <button class="anim-btn fade" @click="anim('fade')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" opacity="0.5"/></svg>
            Fade
          </button>
          <button class="anim-btn rotate" @click="anim('rotate')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M1 4v6h6M3.51 15a9 9 0 1014.85-3.36L23 8"/></svg>
            Rotate
          </button>
        </div>
        <p class="text-[8px] text-studio-text-muted/50 mb-1.5 mt-2">Emphasis (transient)</p>
        <div class="grid grid-cols-2 gap-1">
          <button data-test="anim-indicate" class="anim-btn emph" @click="anim('indicate')">Indicate</button>
          <button data-test="anim-flash" class="anim-btn emph" @click="anim('flash')">Flash</button>
          <button data-test="anim-wiggle" class="anim-btn emph" @click="anim('wiggle')">Wiggle</button>
          <button data-test="anim-circumscribe" class="anim-btn emph" @click="anim('circumscribe')">Circumscribe</button>
          <button data-test="anim-focus_on" class="anim-btn emph" @click="anim('focus_on')">Focus On</button>
        </div>
        <template v-if="obj.type === 'counter'">
          <p class="text-[8px] text-studio-text-muted/50 mb-1.5 mt-2">Counter</p>
          <div class="grid grid-cols-2 gap-1">
            <button data-test="anim-count" class="anim-btn move col-span-2"
                    @click="store.createCount()">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 9h16M4 15h16"/></svg>
              Count
            </button>
          </div>
        </template>
      </Section>
</template>

<script setup>
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';

const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;

function anim(type) {
  const p = {};
  if (type === 'move') { p.targetX = obj.x + 200; p.targetY = obj.y; }
  if (type === 'scale') { p.targetScaleX = 2; p.targetScaleY = 2; }
  if (type === 'fade') { p.targetOpacity = 0; }
  if (type === 'rotate') { p.targetRotation = (obj.rotation || 0) + 360; }
  if (type === 'indicate') { p.color = '#FFFF00'; p.scale_factor = 1.2; }
  if (type === 'flash') { p.color = '#FFFF00'; p.flash_radius = 0.3; p.line_length = 0.2; p.num_lines = 12; }
  if (type === 'wiggle') { p.scale_value = 1.1; p.rotation_angle = 3.6; p.n_wiggles = 6; }
  if (type === 'circumscribe') { p.color = '#FFFF00'; p.shape = 'Rectangle'; p.fade_out = false; p.time_width = 0.3; }
  if (type === 'focus_on') { p.color = '#FFFFFF'; p.opacity = 0.2; }
  store.createAnimation(type, p);
}
</script>

<style scoped>
.anim-btn {
  @apply flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold text-white/80 transition-all hover:brightness-110 active:scale-95;
}
.anim-btn.move { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.anim-btn.scale { background: linear-gradient(135deg, #22c55e, #10b981); }
.anim-btn.fade { background: linear-gradient(135deg, #f59e0b, #ef4444); }
.anim-btn.rotate { background: linear-gradient(135deg, #ec4899, #f43f5e); }
.anim-btn.emph { background: linear-gradient(135deg, #7c3aed, #a855f7); }
</style>
