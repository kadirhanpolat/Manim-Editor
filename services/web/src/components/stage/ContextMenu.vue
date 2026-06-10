<template>
  <div ref="rootEl" class="ctx-menu" role="menu" aria-label="Canvas context menu" :style="posStyle">
    <template v-for="item in items" :key="item.id">
      <div v-if="item.separator" class="menu-sep"></div>
      <button
        v-else
        class="menu-item"
        :class="{ disabled: item.disabled }"
        :disabled="item.disabled"
        role="menuitem"
        :aria-label="item.label"
        @click="onItem(item)"
      >
        <span class="mi-label">{{ item.label }}</span>
      </button>
    </template>
  </div>
</template>

<script lang="ts">
export interface ContextMenuItem {
  id: string;
  label?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
}
</script>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  items: { type: Array as () => ContextMenuItem[], required: true },
});
const emit = defineEmits(['close']);

const rootEl = ref<HTMLElement | null>(null);

const MENU_W = 180;
const ITEM_H = 28;
const posStyle = computed(() => {
  // Clamp to the viewport so the menu never opens off-screen.
  const estH = props.items.length * ITEM_H + 8;
  const left = Math.min(props.x, Math.max(0, window.innerWidth - MENU_W - 4));
  const top = Math.min(props.y, Math.max(0, window.innerHeight - estH - 4));
  return { left: left + 'px', top: top + 'px' };
});

function onItem(item: ContextMenuItem) {
  if (item.disabled) return;
  item.action?.();
  emit('close');
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
function onWindowMousedown(e: MouseEvent) {
  const root = rootEl.value ?? null;
  if (root && e.target instanceof Node && root.contains(e.target)) return;
  emit('close');
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown);
  // capture phase so a mousedown on the Konva canvas (which stops propagation
  // at the container) still closes the menu.
  window.addEventListener('mousedown', onWindowMousedown, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown);
  window.removeEventListener('mousedown', onWindowMousedown, true);
});
</script>

<style scoped>
.ctx-menu {
  position: fixed;
  min-width: 180px;
  background: var(--studio-surface3);
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  z-index: 300;
}
.menu-sep {
  height: 1px;
  margin: 4px 8px;
  background: var(--studio-divider);
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--studio-text);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.08s;
  text-align: left;
  outline: none;
}
.menu-item:hover {
  background: var(--studio-accent-subtle);
}
.menu-item.disabled {
  opacity: 0.4;
  cursor: default;
}
.menu-item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--studio-focus-ring);
}
.mi-label {
  flex: 1;
  white-space: nowrap;
}
</style>
