<template>
  <div
    v-if="props.open"
    class="command-backdrop"
    data-test="command-palette"
    @mousedown.self="close"
  >
    <section class="command-panel" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="command-search-row">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref="searchInput"
          v-model="query"
          class="command-search"
          data-test="command-search"
          placeholder="Search commands and objects"
          @keydown.down.prevent="moveActive(1)"
          @keydown.up.prevent="moveActive(-1)"
          @keydown.enter.prevent="runActive"
          @keydown.esc.prevent="close"
        />
        <kbd>{{ modKey }}K</kbd>
      </div>

      <div class="command-results" role="listbox" aria-label="Commands">
        <button
          v-for="(command, index) in visibleCommands"
          :key="command.id"
          class="command-row"
          :class="{ active: index === activeIndex }"
          :data-test="'command-' + command.id"
          role="option"
          :aria-selected="index === activeIndex"
          @mousemove="activeIndex = index"
          @click="runCommand(command)"
        >
          <span class="command-row-main">{{ command.label }}</span>
          <span class="command-row-detail">{{ command.detail }}</span>
        </button>
        <div v-if="visibleCommands.length === 0" class="command-empty" role="status">
          No matching commands
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useProjectStore } from '../../store/project.js';

interface AddableSpec {
  type: string;
  label: string;
  group: string;
  is3D?: boolean;
}

interface CommandItem {
  id: string;
  label: string;
  detail: string;
  tokens: string;
  run: () => void;
}

const props = defineProps<{ open: boolean }>();
const emit = defineEmits(['close']);

const store = useProjectStore();
const query = ref('');
const activeIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);
const modKey = computed(() =>
  typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Cmd+' : 'Ctrl+'
);

const ADDABLE_OBJECTS: AddableSpec[] = [
  { type: 'rectangle', label: 'Rectangle', group: 'Shapes' },
  { type: 'square', label: 'Square', group: 'Shapes' },
  { type: 'circle', label: 'Circle', group: 'Shapes' },
  { type: 'ellipse', label: 'Ellipse', group: 'Shapes' },
  { type: 'triangle', label: 'Triangle', group: 'Shapes' },
  { type: 'star', label: 'Star', group: 'Shapes' },
  { type: 'polygon', label: 'Polygon', group: 'Shapes' },
  { type: 'polygon_free', label: 'Free Polygon', group: 'Shapes' },
  { type: 'bezier', label: 'Bezier', group: 'Shapes' },
  { type: 'arrow', label: 'Arrow', group: 'Shapes' },
  { type: 'heart', label: 'Heart', group: 'Shapes' },
  { type: 'line', label: 'Line', group: 'Shapes' },
  { type: 'ray', label: 'Ray', group: 'Shapes' },
  { type: 'dot', label: 'Dot', group: 'Shapes' },
  { type: 'dot_grid', label: 'Dot Grid', group: 'Shapes' },
  { type: 'latex', label: 'LaTeX', group: 'Text' },
  { type: 'text', label: 'Text', group: 'Text' },
  { type: 'axes', label: 'Axes', group: 'Data' },
  { type: 'numberplane', label: 'Number Plane', group: 'Data' },
  { type: 'numberline', label: 'Number Line', group: 'Data' },
  { type: 'table', label: 'Table', group: 'Data' },
  { type: 'complex_plane', label: 'Complex Plane', group: 'Data' },
  { type: 'polar_plane', label: 'Polar Plane', group: 'Data' },
  { type: 'graph', label: 'Graph', group: 'Data' },
  { type: 'vector_field', label: 'Vector Field', group: 'Data' },
  { type: 'vector_components', label: 'Vector Components', group: 'Data' },
  { type: 'coord_point', label: 'Coord Point', group: 'Data' },
  { type: 'counter', label: 'Counter', group: 'Data' },
  { type: 'matrix', label: 'Matrix', group: 'Data' },
  { type: 'code', label: 'Code Block', group: 'Content' },
  { type: 'bar_chart', label: 'Bar Chart', group: 'Content' },
  { type: 'annulus', label: 'Annulus', group: 'Geometry' },
  { type: 'arc', label: 'Arc', group: 'Geometry' },
  { type: 'sector', label: 'Sector', group: 'Geometry' },
  { type: 'double_arrow', label: 'Double Arrow', group: 'Geometry' },
  { type: 'brace', label: 'Brace', group: 'Annotations' },
  { type: 'angle', label: 'Angle', group: 'Annotations' },
  { type: 'surrounding_rect', label: 'Surrounding Rectangle', group: 'Annotations' },
  { type: 'underline', label: 'Underline', group: 'Annotations' },
  { type: 'cross', label: 'Cross', group: 'Annotations' },
  { type: 'sphere', label: 'Sphere', group: '3D', is3D: true },
  { type: 'cube', label: 'Cube', group: '3D', is3D: true },
  { type: 'prism', label: 'Prism', group: '3D', is3D: true },
  { type: 'cone', label: 'Cone', group: '3D', is3D: true },
  { type: 'cylinder', label: 'Cylinder', group: '3D', is3D: true },
  { type: 'torus', label: 'Torus', group: '3D', is3D: true },
  { type: 'axes3d', label: 'Axes 3D', group: '3D', is3D: true },
  { type: 'surface', label: 'Surface', group: '3D', is3D: true },
];

const commands = computed<CommandItem[]>(() => {
  const items: CommandItem[] = [];
  const canAddObjects = store.project.editorMode === 'visual';
  if (canAddObjects) {
    for (const spec of ADDABLE_OBJECTS) {
      if (spec.is3D && store.project.sceneType !== '3d') continue;
      items.push({
        id: 'add-' + spec.type,
        label: 'Add ' + spec.label,
        detail: spec.group,
        tokens: ['add', 'create', spec.type, spec.label, spec.group].join(' '),
        run: () => {
          const obj = store.addObject(spec.type);
          store.selectObject(obj.id);
        },
      });
    }
  }

  for (const obj of store.project.objects) {
    const state = [obj.hidden ? 'hidden' : '', obj.locked ? 'locked' : ''].filter(Boolean);
    items.push({
      id: 'select-' + obj.id,
      label: obj.name || obj.type,
      detail: ['Select object', obj.type, ...state].join(' - '),
      tokens: ['select', 'find', obj.id, obj.name, obj.type, ...state].filter(Boolean).join(' '),
      run: () => {
        store.selectObject(obj.id);
        store.selectedClipId = null;
      },
    });
  }

  items.push(
    {
      id: 'select-all',
      label: 'Select All Objects',
      detail: 'Edit',
      tokens: 'select all objects',
      run: () => store.selectAllObjects(),
    },
    {
      id: 'clear-selection',
      label: 'Clear Selection',
      detail: 'Edit',
      tokens: 'clear deselect selection',
      run: () => store.deselectAll(),
    },
    {
      id: 'toggle-grid',
      label: store.project.stage.gridVisible ? 'Hide Grid' : 'Show Grid',
      detail: 'View',
      tokens: 'toggle grid show hide',
      run: () => store.toggleGrid(),
    },
    {
      id: 'toggle-snap',
      label: store.project.stage.snapEnabled ? 'Disable Snap' : 'Enable Snap',
      detail: 'View',
      tokens: 'toggle snap snapping grid guides',
      run: () => store.toggleSnap(),
    }
  );

  return items;
});

const visibleCommands = computed(() => {
  const q = query.value.trim().toLowerCase();
  const items = q
    ? commands.value.filter((command) =>
        [command.label, command.detail, command.tokens].join(' ').toLowerCase().includes(q)
      )
    : commands.value;
  return items.slice(0, 40);
});

watch(
  () => visibleCommands.value.length,
  (len) => {
    if (activeIndex.value >= len) activeIndex.value = Math.max(0, len - 1);
  }
);

watch(
  () => query.value,
  () => {
    activeIndex.value = 0;
  }
);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    query.value = '';
    activeIndex.value = 0;
    void nextTick(() => searchInput.value?.focus());
  },
  { immediate: true }
);

function moveActive(delta: number) {
  const len = visibleCommands.value.length;
  if (!len) return;
  activeIndex.value = (activeIndex.value + delta + len) % len;
}

function runActive() {
  const command = visibleCommands.value[activeIndex.value];
  if (command) runCommand(command);
}

function runCommand(command: CommandItem) {
  command.run();
  close();
}

function close() {
  emit('close');
}
</script>

<style scoped>
.command-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  background: rgb(0 0 0 / 0.42);
}

.command-panel {
  width: min(640px, calc(100vw - 32px));
  max-height: min(620px, calc(100vh - 120px));
  overflow: hidden;
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  background: var(--studio-surface);
  color: var(--studio-text);
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.45);
}

.command-search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--studio-border);
  color: var(--studio-text-muted);
}

.command-search {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--studio-text);
  font-size: 14px;
}

.command-search::placeholder {
  color: var(--studio-text-muted);
}

kbd {
  padding: 2px 6px;
  border: 1px solid var(--studio-border);
  border-radius: 4px;
  background: var(--studio-surface2);
  color: var(--studio-text-muted);
  font-size: 10px;
  font-family: var(--font-mono, monospace);
}

.command-results {
  max-height: 520px;
  overflow-y: auto;
  padding: 6px;
}

.command-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  min-height: 38px;
  align-items: center;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--studio-text);
  text-align: left;
  cursor: pointer;
}

.command-row:hover,
.command-row.active {
  background: var(--studio-accent-subtle);
}

.command-row-main {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.command-row-detail {
  color: var(--studio-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.command-empty {
  padding: 28px 12px;
  text-align: center;
  color: var(--studio-text-muted);
  font-size: 12px;
}
</style>
