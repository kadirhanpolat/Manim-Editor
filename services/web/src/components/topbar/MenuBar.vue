<template>
  <!-- Desktop nav -->
  <nav v-if="!collapsed" class="menubar-nav" role="menubar">
    <div
      v-for="(menu, mi) in menus"
      :key="menu.id"
      class="menu-anchor"
      :ref="(el) => setAnchorRef(menu.id, el)"
    >
      <button
        class="menu-label"
        :class="{ active: openMenuId === menu.id }"
        @click.stop="toggleMenu(menu.id)"
        @mouseenter="hoverMenu(menu.id)"
        @keydown="onLabelKey($event, mi)"
        tabindex="0"
        role="menuitem"
        :aria-haspopup="true"
        :aria-expanded="openMenuId === menu.id"
      >
        {{ menu.label }}
      </button>

      <!-- Dropdown -->
      <transition name="menu-pop">
        <div
          v-if="openMenuId === menu.id"
          class="menu-dropdown"
          role="menu"
          @keydown="onDropdownKey($event, mi)"
        >
          <template v-for="(item, idx) in menu.items" :key="item.id || 's' + idx">
            <div v-if="item.type === 'separator'" class="menu-sep"></div>

            <!-- Submenu (e.g. Theme) -->
            <div
              v-else-if="item.type === 'submenu'"
              class="menu-sub-anchor"
              @mouseenter="hoveredSub = item.id"
              @mouseleave="hoveredSub = null"
            >
              <button
                class="menu-item"
                :class="{ focused: focusIdx === idx }"
                @mouseenter="focusIdx = idx"
                role="menuitem"
                aria-haspopup="true"
              >
                <span class="mi-label">{{ item.label }}</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  class="mi-arrow"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <div v-if="hoveredSub === item.id" class="menu-submenu">
                <button
                  v-for="sub in item.children"
                  :key="sub.id"
                  class="menu-item"
                  :class="{ 'radio-on': sub.active && sub.active() }"
                  @click="executeItem(sub)"
                  role="menuitemradio"
                  :aria-checked="sub.active ? sub.active() : undefined"
                >
                  <span class="mi-radio">{{ sub.active && sub.active() ? '◉' : '○' }}</span>
                  <span class="mi-label">{{ sub.label }}</span>
                </button>
              </div>
            </div>

            <!-- Toggle item (Grid/Snap) -->
            <button
              v-else-if="item.type === 'toggle'"
              class="menu-item"
              :class="{ focused: focusIdx === idx }"
              @click="executeItem(item)"
              @mouseenter="focusIdx = idx"
              role="menuitemcheckbox"
              :aria-checked="item.checked ? item.checked() : false"
            >
              <span class="mi-check">{{ item.checked && item.checked() ? '✓' : '' }}</span>
              <span class="mi-label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="mi-shortcut">{{ item.shortcut }}</span>
            </button>

            <!-- Normal item -->
            <button
              v-else
              class="menu-item"
              :class="{ disabled: item.disabled && item.disabled(), focused: focusIdx === idx }"
              :disabled="item.disabled && item.disabled()"
              @click="executeItem(item)"
              @mouseenter="focusIdx = idx"
              role="menuitem"
            >
              <span class="mi-label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="mi-shortcut">{{ item.shortcut }}</span>
            </button>
          </template>
        </div>
      </transition>
    </div>
  </nav>

  <!-- Collapsed hamburger -->
  <div v-else class="menu-anchor" ref="collapsedAnchor">
    <button
      class="menu-label"
      :class="{ active: openMenuId === '_collapsed' }"
      @click.stop="toggleMenu('_collapsed')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
      Menu
    </button>
    <transition name="menu-pop">
      <div v-if="openMenuId === '_collapsed'" class="menu-dropdown collapsed-dropdown" role="menu">
        <template v-for="menu in menus" :key="menu.id">
          <div class="menu-group-hdr">{{ menu.label }}</div>
          <template v-for="(item, idx) in menu.items" :key="item.id || menu.id + 's' + idx">
            <div v-if="item.type === 'separator'" class="menu-sep"></div>
            <button
              v-else-if="item.type !== 'submenu'"
              class="menu-item"
              :disabled="item.disabled && item.disabled()"
              @click="executeItem(item)"
              role="menuitem"
            >
              <span v-if="item.type === 'toggle'" class="mi-check">{{
                item.checked && item.checked() ? '✓' : ''
              }}</span>
              <span class="mi-label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="mi-shortcut">{{ item.shortcut }}</span>
            </button>
          </template>
        </template>
      </div>
    </transition>
  </div>

  <!-- Backdrop to close menus on click-outside -->
  <div v-if="openMenuId" class="menubar-backdrop" @mousedown="closeMenu"></div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps({
  menus: { type: Array, required: true },
  collapsed: { type: Boolean, default: false },
});
const menus = computed(() => props.menus);

const openMenuId = ref(null);
const focusIdx = ref(-1);
const hoveredSub = ref(null);
let _hoverSwitchedAt = null;

const anchorRefs = reactive({});
function setAnchorRef(id, el) {
  if (el) anchorRefs[id] = el;
  else delete anchorRefs[id];
}

// ── Menu interaction (moved verbatim from Topbar) ──
function toggleMenu(id) {
  if (_hoverSwitchedAt && Date.now() - _hoverSwitchedAt < 300) return;
  if (openMenuId.value === id) {
    closeMenu();
    return;
  }
  openMenuId.value = id;
  focusIdx.value = -1;
  hoveredSub.value = null;
}
function hoverMenu(id) {
  if (openMenuId.value && openMenuId.value !== id) {
    openMenuId.value = id;
    focusIdx.value = -1;
    hoveredSub.value = null;
    _hoverSwitchedAt = Date.now();
  }
}
function closeMenu() {
  openMenuId.value = null;
  focusIdx.value = -1;
  hoveredSub.value = null;
}
function executeItem(item) {
  if (item.disabled && item.disabled()) return;
  if (item.action) item.action();
  if (item.type !== 'toggle' && item.type !== 'submenu') closeMenu();
}
function onLabelKey(e, menuIndex) {
  const ids = menus.value.map((m) => m.id);
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = (menuIndex + 1) % ids.length;
    focusLabel(next);
    if (openMenuId.value) openMenuId.value = ids[next];
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = (menuIndex - 1 + ids.length) % ids.length;
    focusLabel(prev);
    if (openMenuId.value) openMenuId.value = ids[prev];
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleMenu(ids[menuIndex]);
  } else if (e.key === 'ArrowDown' && openMenuId.value) {
    e.preventDefault();
    focusIdx.value = nextFocusable(-1, 1);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu();
  }
}
function focusLabel(index) {
  const id = menus.value[index]?.id;
  if (!id) return;
  nextTick(() => {
    const el = anchorRefs[id];
    const btn = el?.querySelector('button');
    if (btn) btn.focus();
  });
}
function onDropdownKey(e, menuIndex) {
  const menu = menus.value[menuIndex];
  if (!menu) return;
  const items = menu.items;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusIdx.value = nextFocusable(focusIdx.value, 1, items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusIdx.value = nextFocusable(focusIdx.value, -1, items);
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (focusIdx.value >= 0 && items[focusIdx.value]) executeItem(items[focusIdx.value]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu();
    focusLabel(menuIndex);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = (menuIndex + 1) % menus.value.length;
    openMenuId.value = menus.value[next].id;
    focusIdx.value = -1;
    focusLabel(next);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = (menuIndex - 1 + menus.value.length) % menus.value.length;
    openMenuId.value = menus.value[prev].id;
    focusIdx.value = -1;
    focusLabel(prev);
  }
}
function nextFocusable(current, dir, items) {
  const menu = items || menus.value.find((m) => m.id === openMenuId.value)?.items || [];
  let i = current + dir;
  while (i >= 0 && i < menu.length) {
    if (menu[i].type !== 'separator') return i;
    i += dir;
  }
  return current;
}
function _globalKey(e) {
  if (openMenuId.value && e.key === 'Escape') {
    closeMenu();
    e.preventDefault();
    e.stopPropagation();
  }
}
onMounted(() => {
  document.addEventListener('keydown', _globalKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', _globalKey);
});
</script>

<style scoped>
/* ── Menu labels ── */
.menubar-nav {
  display: flex;
  align-items: center;
  gap: 1px;
}
.menu-anchor {
  position: relative;
}

.menu-label {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--studio-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background 0.1s,
    color 0.1s;
  display: flex;
  align-items: center;
  gap: 5px;
  outline: none;
  white-space: nowrap;
}
.menu-label:hover {
  background: var(--studio-border);
  color: var(--studio-text);
}
.menu-label.active {
  background: var(--studio-border);
  color: var(--studio-text);
}
.menu-label:focus-visible {
  box-shadow: 0 0 0 2px var(--studio-focus-ring);
}

/* ── Dropdown ── */
.menu-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  min-width: 200px;
  background: var(--studio-surface3);
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  z-index: 201;
}
.collapsed-dropdown {
  min-width: 240px;
  max-height: 70vh;
  overflow-y: auto;
}

.menu-group-hdr {
  padding: 6px 10px 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--studio-text-muted);
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
.menu-item:hover,
.menu-item.focused {
  background: var(--studio-accent-subtle);
}
.menu-item.disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}
.menu-item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--studio-focus-ring);
}

.mi-label {
  flex: 1;
  white-space: nowrap;
}
.mi-shortcut {
  font-size: 10px;
  color: var(--studio-text-muted);
  margin-left: auto;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}
.mi-check {
  width: 14px;
  text-align: center;
  font-size: 11px;
  color: var(--studio-accent);
  flex-shrink: 0;
}
.mi-radio {
  width: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--studio-accent);
  flex-shrink: 0;
}
.mi-arrow {
  flex-shrink: 0;
  opacity: 0.5;
}

.radio-on .mi-radio {
  color: var(--studio-accent);
}

/* ── Submenu ── */
.menu-sub-anchor {
  position: relative;
}
.menu-submenu {
  position: absolute;
  left: calc(100% + 2px);
  top: -4px;
  min-width: 140px;
  background: var(--studio-surface3);
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  z-index: 202;
}

/* ── Backdrop ── */
.menubar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
  background: transparent;
}

/* ── Transitions ── */
.menu-pop-enter-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}
.menu-pop-leave-active {
  transition: opacity 0.08s ease;
}
.menu-pop-enter {
  opacity: 0;
  transform: translateY(-4px);
}
.menu-pop-leave-to {
  opacity: 0;
}
</style>
