<template>
  <!-- New Project dialog -->
  <transition name="menu-pop">
    <div v-if="show" class="np-overlay" @click.self="cancelNewProject">
      <div class="np-dialog" role="dialog" aria-modal="true" aria-labelledby="np-dialog-title">
        <h2 id="np-dialog-title" class="np-title">New Project</h2>

        <label class="np-label">Project Name</label>
        <input
          ref="npNameInput"
          v-model="newProjectName"
          class="np-input"
          placeholder="My Animation"
          @keydown.enter="confirmNewProject"
        />

        <label class="np-label" style="margin-top: 12px">Editor Mode</label>
        <div class="np-mode-row">
          <button
            class="np-mode-btn"
            :class="{ active: newProjectMode === 'visual' }"
            @click="newProjectMode = 'visual'"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            <span class="np-mode-label">Visual (UI)</span>
            <span class="np-mode-desc">Drag-and-drop canvas, timeline, shapes</span>
          </button>
          <button
            class="np-mode-btn"
            :class="{ active: newProjectMode === 'code' }"
            @click="newProjectMode = 'code'"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span class="np-mode-label">Code Only</span>
            <span class="np-mode-desc">Full Manim power, write Python directly</span>
          </button>
        </div>

        <!-- Template selector (only for visual mode) -->
        <template v-if="newProjectMode === 'visual'">
          <label class="np-label" style="margin-top: 12px">Template</label>

          <!-- Category chips -->
          <div class="np-cat-chips">
            <button
              v-for="cat in ALL_CATEGORIES"
              :key="cat"
              class="np-cat-chip"
              :class="{ active: selectedCategory === cat }"
              @click="selectedCategory = cat"
            >
              {{ CATEGORY_LABELS[cat] }}
            </button>
          </div>

          <!-- Template grid (scrollable) -->
          <div class="np-tpl-grid">
            <button
              v-for="tpl in filteredTemplates"
              :key="tpl.id"
              class="np-mode-btn"
              :class="{
                active:
                  (newProjectTemplate && newProjectTemplate.id === tpl.id) ||
                  (!newProjectTemplate && tpl.id === 'blank'),
              }"
              style="text-align: left; padding: 10px 12px"
              @click="newProjectTemplate = tpl.id === 'blank' ? null : tpl"
            >
              <span style="font-size: 18px; display: block; margin-bottom: 4px">{{
                tpl.icon
              }}</span>
              <span class="np-mode-label">{{ displayTemplateText(tpl.label) }}</span>
              <span class="np-mode-desc">{{ displayTemplateText(tpl.description) }}</span>
            </button>
          </div>
        </template>

        <div class="np-actions">
          <button class="np-btn np-btn-cancel" @click="cancelNewProject">Cancel</button>
          <button class="np-btn np-btn-create" @click="confirmNewProject">Create Project</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
import TEMPLATES, { type Template, type TemplateCategory } from '../../templates/index.js';

const props = defineProps({ show: { type: Boolean, default: false } });
const emit = defineEmits(['close']);
const store = useProjectStore();

const templates = TEMPLATES;

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  general: 'General',
  calculus: 'Calculus',
  linear_algebra: 'Linear Algebra',
  trigonometry: 'Trigonometry',
  statistics: 'Statistics',
  programming: 'Programming',
};

const ALL_CATEGORIES: Array<'all' | TemplateCategory> = [
  'all',
  'general',
  'calculus',
  'linear_algebra',
  'trigonometry',
  'statistics',
  'programming',
];

const selectedCategory = ref<'all' | TemplateCategory>('all');

const TEMPLATE_TEXT_MAP: Record<string, string> = {
  'Boş Proje': 'Blank Project',
  'Sıfırdan başla': 'Start from scratch',
  'Formül Tanıtım': 'Formula Reveal',
  'LaTeX formülü yazma efektiyle ortaya çıkar': 'Reveal a LaTeX formula with a writing effect',
  'Formül': 'Formula',
  'Şekil Dönüşümü': 'Shape Transform',
  'Bir şekil diğerine morph olur': 'Morph one shape into another',
  'Kaynak': 'Source',
  'Hedef': 'Target',
  'Başlık Slaydı': 'Title Slide',
  'Başlık ve alt başlık kademeli giriş': 'Title and subtitle fade in sequentially',
  'Başlık': 'Title',
  'Alt Başlık': 'Subtitle',
  'Alt başlık açıklaması': 'Subtitle description',
  'Koordinat Sistemi': 'Coordinate System',
  'Eksenler sahneye çizilir': 'Axes are drawn onto the stage',
  'Limit Yaklaşımı': 'Limit Approach',
  'x → c yaklaşımı ile limit kavramı': 'Visualize the limit concept as x approaches c',
  'Düzlem': 'Plane',
  'x yaklaşan nokta': 'Point approaching x',
  'Limit noktası': 'Limit point',
  'Türev Teğet': 'Derivative Tangent',
  'Bir noktada türev ve teğet çizgisi gösterimi': 'Show the derivative and tangent line at a point',
  'Türev': 'Derivative',
  'İntegral Alan': 'Integral Area',
  'Belirli integral ve Riemann alanı gösterimi': 'Show a definite integral and Riemann area',
  'Vektör Toplama': 'Vector Addition',
  'İki vektörün bileşke toplamı gösterimi': 'Show the resultant sum of two vectors',
  'u vektörü': 'u vector',
  'v vektörü': 'v vector',
  'Bileşke': 'Resultant',
  'Matris Çarpımı': 'Matrix Multiplication',
  'İki 2×2 matrisin çarpımı': 'Multiply two 2×2 matrices',
  'Çarpı': 'Cross',
  'Sonuç': 'Result',
  'Birim Çember': 'Unit Circle',
  'Trigonometrik birim çember ve sin/cos gösterimi': 'Trigonometric unit circle with sin/cos display',
  'Sin & Cos Grafiği': 'Sine & Cosine Graph',
  'Sinüs ve kosinüs dalgaları karşılaştırması': 'Compare the sine and cosine waves',
  'Normal Dağılım': 'Normal Distribution',
  'Gauss çanı eğrisi ve ±1σ alanı': 'Gaussian bell curve with the ±1σ region',
  'Teorem İspatı': 'Theorem Proof',
  'Teorem ifadesi, kanıt adımları ve sonuç': 'Theorem statement, proof steps, and conclusion',
  'Kanıt başlığı': 'Proof title',
  'Kanıt:': 'Proof:',
  'Kanıt metni': 'Proof text',
  'Dik üçgende hipotenüs karesi, diğer iki kenar karelerinin toplamına eşittir.':
    'In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.',
  'Algoritma Adımları': 'Algorithm Steps',
  'Üç adımlı akış şeması: Başlat → İşle → Bitir': 'Three-step flowchart: Start → Process → End',
  'Adım 1 kutusu': 'Step 1 box',
  'Adım 2 kutusu': 'Step 2 box',
  'Adım 3 kutusu': 'Step 3 box',
  'Başlat': 'Start',
  'İşle': 'Process',
  'Bitir': 'End',
};

function displayTemplateText(text: string): string {
  return TEMPLATE_TEXT_MAP[text] ?? text;
}

function localizeTemplateValue(value: unknown): unknown {
  if (typeof value === 'string') return displayTemplateText(value);
  if (Array.isArray(value)) return value.map((entry) => localizeTemplateValue(entry));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'id') out[key] = entry;
    else out[key] = localizeTemplateValue(entry);
  }
  return out;
}

const filteredTemplates = computed(() =>
  selectedCategory.value === 'all'
    ? templates
    : templates.filter((t) => t.category === selectedCategory.value)
);

const newProjectName = ref('My Animation');
const newProjectMode = ref('visual');
const newProjectTemplate = ref<Template | null>(null);
const npNameInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.show,
  (open) => {
    if (open) {
      newProjectName.value = 'My Animation';
      newProjectMode.value = 'visual';
      newProjectTemplate.value = null;
      selectedCategory.value = 'all';
      nextTick(() => {
        npNameInput.value?.focus();
      });
    }
  }
);

function confirmNewProject() {
  const name = newProjectName.value.trim() || 'My Animation';
  const tpl = newProjectTemplate.value;
  if (tpl && tpl.project) {
    const projectData = localizeTemplateValue(tpl.project()) as Record<string, unknown>;
    projectData['name'] = name;
    projectData['id'] = null;
    store._stopPollRender();
    store.playbackTime = 0;
    store.playbackPlaying = false;
    store.frameState = { objectOverrides: {}, morphShapes: [], hiddenIds: new Set() };
    store.renderStatus = null;
    store.renderJobId = null;
    store.renderVideoUrl = null;
    store.renderLog = '';
    store.renderError = null;
    store.importJSON(JSON.stringify(projectData));
  } else {
    store.newProject(name, newProjectMode.value);
  }
  emit('close');
}
function cancelNewProject() {
  emit('close');
}
</script>

<style scoped>
/* ── New Project Dialog ── */
.np-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}
.np-dialog {
  background: var(--studio-surface);
  border: 1px solid var(--studio-border);
  border-radius: 14px;
  padding: 28px 32px;
  width: 520px;
  max-width: 95vw;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}
.np-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--studio-text);
  margin: 0 0 18px;
}
.np-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--studio-text-muted);
  margin-bottom: 6px;
}
.np-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--studio-border);
  background: var(--studio-bg);
  color: var(--studio-text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.np-input:focus {
  border-color: var(--studio-accent);
  box-shadow: 0 0 0 2px rgb(var(--c-accent) / 0.2);
}
.np-mode-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.np-mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 10px;
  border-radius: 10px;
  border: 2px solid var(--studio-border);
  background: var(--studio-bg);
  color: var(--studio-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.np-mode-btn:hover {
  border-color: var(--studio-accent);
  color: var(--studio-text);
}
.np-mode-btn.active {
  border-color: var(--studio-accent);
  background: var(--studio-accent-subtle);
  color: var(--studio-accent);
}
.np-mode-label {
  font-size: 13px;
  font-weight: 600;
  margin-top: 4px;
}
.np-mode-desc {
  font-size: 10px;
  opacity: 0.65;
  line-height: 1.3;
}
.np-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
.np-btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.12s;
}
.np-btn-cancel {
  background: var(--studio-border);
  color: var(--studio-text-muted);
}
.np-btn-cancel:hover {
  background: var(--studio-border);
  color: var(--studio-text);
}
.np-btn-create {
  background: var(--studio-accent);
  color: #fff;
}
.np-btn-create:hover {
  filter: brightness(1.1);
}

/* ── Category chips ── */
.np-cat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  margin-bottom: 8px;
}
.np-cat-chip {
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--studio-border);
  background: var(--studio-bg);
  color: var(--studio-text-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.np-cat-chip:hover {
  border-color: var(--studio-accent);
  color: var(--studio-text);
}
.np-cat-chip.active {
  border-color: var(--studio-accent);
  background: var(--studio-accent-subtle);
  color: var(--studio-accent);
}

/* ── Template grid (scrollable) ── */
.np-tpl-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

/* ── menu-pop transition ── */
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
