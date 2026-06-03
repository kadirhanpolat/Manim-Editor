<template>
  <div class="font-selector" ref="container">
    <span class="text-[9px] text-studio-text-muted/50">Font</span>
    <div class="relative">
      <input
        ref="input"
        type="text"
        class="input input-sm w-full pr-6"
        :value="searchQuery"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
        :placeholder="value || 'Search fonts...'"
      />
      <button
        v-if="searchQuery || isOpen"
        class="absolute right-1 top-1/2 -translate-y-1/2 text-studio-text-muted hover:text-studio-text p-0.5"
        @mousedown.prevent="clearSearch"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      <div v-if="!searchQuery && !isOpen" class="absolute right-1 top-1/2 -translate-y-1/2 text-studio-text-muted pointer-events-none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
    </div>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      class="font-dropdown"
      ref="dropdown"
    >
      <!-- Category tabs -->
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="category-tab"
          :class="{ active: selectedCategory === cat.id }"
          @mousedown.prevent="selectCategory(cat.id)"
        >{{ cat.label }}</button>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="font-loading">
        <span class="loading-spinner"></span>
        Loading fonts...
      </div>

      <!-- Font list -->
      <div v-else class="font-list" ref="fontList">
        <div
          v-for="(font, index) in filteredFonts"
          :key="font.family"
          class="font-item"
          :class="{ highlighted: index === highlightedIndex, selected: font.family === value }"
          @mousedown.prevent="selectFont(font.family)"
          @mouseenter="highlightedIndex = index"
        >
          <span
            class="font-preview"
            :style="{ fontFamily: `'${font.family}', ${font.category}` }"
          >{{ font.family }}</span>
          <span class="font-category">{{ font.category }}</span>
        </div>
        <div v-if="filteredFonts.length === 0 && !loading" class="font-empty">
          No fonts found
        </div>
      </div>

      <!-- Load more button -->
      <div v-if="hasMore && !loading" class="load-more">
        <button @mousedown.prevent="loadMore" class="load-more-btn">
          Load more fonts...
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : '';

const props = defineProps({
  value: {
    type: String,
    default: 'Roboto'
  }
})
const emit = defineEmits(['input'])

// Template refs
const input = ref(null)
const fontList = ref(null)

// Reactive state
const isOpen = ref(false)
const searchQuery = ref('')
const fonts = ref([])
const loading = ref(false)
const highlightedIndex = ref(-1)
const selectedCategory = ref('all')
const offset = ref(0)
const total = ref(0)
const limit = ref(50)
const categories = ref([
  { id: 'all', label: 'All' },
  { id: 'sans-serif', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'handwriting', label: 'Script' },
  { id: 'monospace', label: 'Mono' }
])
const debounceTimer = ref(null)
const previewStylesLoaded = ref(new Set())

// Computed
const filteredFonts = computed(() => fonts.value)
const hasMore = computed(() => offset.value + fonts.value.length < total.value)

// Methods
async function fetchFonts(reset = false) {
  if (loading.value) return

  loading.value = true

  try {
    const params = new URLSearchParams({
      limit: limit.value,
      offset: reset ? 0 : offset.value
    })

    if (searchQuery.value) {
      params.set('search', searchQuery.value)
    }

    if (selectedCategory.value !== 'all') {
      params.set('category', selectedCategory.value)
    }

    const response = await fetch(`${API_BASE}/api/fonts?${params}`)
    const data = await response.json()

    if (reset) {
      fonts.value = data.fonts
      offset.value = 0
    } else {
      fonts.value = [...fonts.value, ...data.fonts]
    }

    total.value = data.total
    offset.value = fonts.value.length

    // Load Google Fonts preview styles for visible fonts
    loadPreviewStyles(data.fonts.slice(0, 20))
  } catch (error) {
    console.error('Error fetching fonts:', error)
  } finally {
    loading.value = false
  }
}

function loadPreviewStyles(fontItems) {
  const fontsToLoad = fontItems.filter(f => !previewStylesLoaded.value.has(f.family))
  if (fontsToLoad.length === 0) return

  const families = fontsToLoad.map(f => f.family.replace(/ /g, '+')).join('|')
  const link = document.createElement('link')
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`
  link.rel = 'stylesheet'
  document.head.appendChild(link)

  fontsToLoad.forEach(f => previewStylesLoaded.value.add(f.family))
}

function onInput(event) {
  searchQuery.value = event.target.value
  highlightedIndex.value = -1

  // Debounce search
  clearTimeout(debounceTimer.value)
  debounceTimer.value = setTimeout(() => {
    fetchFonts(true)
  }, 300)
}

function onFocus() {
  isOpen.value = true
  if (fonts.value.length === 0) {
    fetchFonts(true)
  }
}

function onBlur() {
  // Delay to allow click on dropdown
  setTimeout(() => {
    isOpen.value = false
    searchQuery.value = ''
    highlightedIndex.value = -1
  }, 200)
}

function onKeydown(event) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (highlightedIndex.value < filteredFonts.value.length - 1) {
        highlightedIndex.value++
        scrollToHighlighted()
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (highlightedIndex.value > 0) {
        highlightedIndex.value--
        scrollToHighlighted()
      }
      break
    case 'Enter':
      event.preventDefault()
      if (highlightedIndex.value >= 0 && filteredFonts.value[highlightedIndex.value]) {
        selectFont(filteredFonts.value[highlightedIndex.value].family)
      }
      break
    case 'Escape':
      event.preventDefault()
      isOpen.value = false
      input.value?.blur()
      break
  }
}

function scrollToHighlighted() {
  nextTick(() => {
    const list = fontList.value
    const item = list?.children[highlightedIndex.value]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  })
}

function selectFont(family) {
  emit('input', family)
  isOpen.value = false
  searchQuery.value = ''
  highlightedIndex.value = -1
}

function selectCategory(category) {
  selectedCategory.value = category
  highlightedIndex.value = -1
  fetchFonts(true)
}

function clearSearch() {
  searchQuery.value = ''
  highlightedIndex.value = -1
  fetchFonts(true)
  input.value?.focus()
}

function loadMore() {
  fetchFonts(false)
}

onBeforeUnmount(() => {
  clearTimeout(debounceTimer.value)
})
</script>

<style scoped>
.font-selector {
  position: relative;
}

.font-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--studio-surface3);
  border: 1px solid var(--studio-border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  margin-top: 4px;
  overflow: hidden;
}

.category-tabs {
  display: flex;
  gap: 2px;
  padding: 6px;
  background: var(--studio-bg);
  border-bottom: 1px solid var(--studio-border);
  overflow-x: auto;
}

.category-tab {
  padding: 4px 8px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--studio-text-muted);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.category-tab:hover {
  background: var(--studio-border);
  color: var(--studio-text);
}

.category-tab.active {
  background: var(--studio-accent);
  color: var(--studio-text);
}

.font-list {
  max-height: 240px;
  overflow-y: auto;
}

.font-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.1s;
}

.font-item:hover,
.font-item.highlighted {
  background: var(--studio-accent-subtle);
}

.font-item.selected {
  background: var(--studio-accent);
  color: var(--studio-text);
}

.font-item.selected .font-category {
  color: rgba(255, 255, 255, 0.7);
}

.font-preview {
  font-size: 13px;
  color: var(--studio-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-category {
  font-size: 9px;
  color: var(--studio-text-muted);
  text-transform: capitalize;
  flex-shrink: 0;
  margin-left: 8px;
}

.font-loading,
.font-empty {
  padding: 20px;
  text-align: center;
  font-size: 11px;
  color: var(--studio-text-muted);
}

.loading-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--studio-border);
  border-top-color: var(--studio-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.load-more {
  padding: 6px;
  border-top: 1px solid var(--studio-border);
  background: var(--studio-bg);
}

.load-more-btn {
  width: 100%;
  padding: 6px;
  font-size: 10px;
  color: var(--studio-accent);
  background: transparent;
  border: 1px dashed var(--studio-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.load-more-btn:hover {
  background: var(--studio-border);
  border-style: solid;
}
</style>
