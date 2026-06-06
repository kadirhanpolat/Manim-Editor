<template>
        <Section label="Text Content">
          <textarea class="input input-sm resize-none" rows="3" :value="obj.content || ''" @input="u('content', $event.target.value)" placeholder="Enter text..."></textarea>
        </Section>
        <Section label="Text Style">
          <div class="space-y-1.5">
            <ColorRow label="Color" :value="obj.fill" @input="u('fill', $event)" />
            <div class="grid grid-cols-2 gap-1.5">
              <Num label="Font Size" :value="obj.fontSize || 48" :min="8" :max="200" @input="u('fontSize', $event)" />
              <div>
                <span class="text-[9px] text-studio-text-muted/50">Align</span>
                <div class="flex gap-0.5 mt-0.5">
                  <button
                    class="align-btn"
                    :class="{ active: (obj.textAlign || 'center') === 'left' }"
                    @click="u('textAlign', 'left')"
                    title="Align Left"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
                    </svg>
                  </button>
                  <button
                    class="align-btn"
                    :class="{ active: (obj.textAlign || 'center') === 'center' }"
                    @click="u('textAlign', 'center')"
                    title="Align Center"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
                    </svg>
                  </button>
                  <button
                    class="align-btn"
                    :class="{ active: (obj.textAlign || 'center') === 'right' }"
                    @click="u('textAlign', 'right')"
                    title="Align Right"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              <FontSelector :value="obj.fontFamily || 'Roboto'" @input="u('fontFamily', $event)" />
              <div>
                <span class="text-[9px] text-studio-text-muted/50">Weight</span>
                <select class="select text-xs" :value="obj.fontWeight || 'normal'" @change="u('fontWeight', $event.target.value)">
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
            </div>
          </div>
        </Section>
</template>

<script setup>
import { useProjectStore } from '../../../store/project.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
import ColorRow from '../ui/ColorRow.vue';
import FontSelector from '../FontSelector.vue';

const props = defineProps({ obj: { type: Object, required: true } });
useProjectStore();
const { u } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>

<style scoped>
.align-btn {
  @apply flex items-center justify-center w-8 h-7 rounded-md border border-studio-border;
  @apply text-studio-text-muted hover:text-studio-text hover:bg-studio-border/50 transition-all;
}
.align-btn.active {
  @apply bg-studio-accent/20 border-studio-accent text-studio-accent;
}
</style>
