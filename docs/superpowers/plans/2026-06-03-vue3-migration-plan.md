# Vue 2 → Vue 3 Göçü — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vue 2.7 + Vue.observable → Vue 3 + Pinia + Composition API, `@vue/compat` köprüsü kullanarak adım adım, her adımda testler yeşil.

**Architecture:** `@vue/compat` kurularak tüm mevcut Vue 2 kodu Vue 3 altında compat modda çalışır; Pinia store singleton pattern ile backward-compat export'lar korunur; bileşenler leaf→root sırasıyla Composition API'ye çevrilir; Test Utils v2'ye geçilir; son adımda compat kaldırılır.

**Tech Stack:** Vue 3, `@vue/compat`, Pinia, `vue-konva@3`, `@vitejs/plugin-vue`, `@vue/test-utils@2`, Vitest

---

## Dosya Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `services/web/package.json` | `vue@3`, `@vue/compat`, `vue-konva@3`, `pinia`; `@vitejs/plugin-vue2` → `@vitejs/plugin-vue` |
| `services/web/vite.config.js` | plugin-vue2 → plugin-vue; compat alias eklenir |
| `services/web/vitest.config.js` | plugin-vue2 → plugin-vue |
| `services/web/src/main.js` | `new Vue(...)` → `createApp` + `configureCompat` + `app.use(pinia)` |
| `services/web/src/store/project.js` | `Vue.observable` → `defineStore`; `Vue.set` → direct; `pinia` export eklenir |
| `services/web/tests/components/*.test.js` (8 dosya) | `setActivePinia(createPinia())` `beforeEach`; `useProjectStore()` ile erişim |
| `services/web/src/components/inspector/ColorInput.vue` | Options API → Composition API |
| `services/web/src/components/inspector/FontSelector.vue` | Options API → Composition API |
| `services/web/src/components/inspector/AnimationPanel.vue` | Options API → Composition API |
| `services/web/src/components/inspector/LayoutPanel.vue` | Options API → Composition API |
| `services/web/src/components/inspector/StylePanel.vue` | Options API → Composition API |
| `services/web/src/components/inspector/TimingPanel.vue` | Options API → Composition API |
| `services/web/src/components/inspector/AudioPanel.vue` | Options API → Composition API |
| `services/web/src/components/inspector/Inspector.vue` | Options API → Composition API |
| `services/web/src/components/timeline/TimelineTrack.vue` | Options API → Composition API |
| `services/web/src/components/timeline/Timeline.vue` | Options API → Composition API |
| `services/web/src/components/stage/AnchorGrid.vue` | Options API → Composition API |
| `services/web/src/components/stage/StageImage.vue` | Options API → Composition API |
| `services/web/src/components/stage/StageSvg.vue` | Options API → Composition API |
| `services/web/src/components/stage/StageText.vue` | Options API → Composition API |
| `services/web/src/components/stage/StageCanvas.vue` | Options API → Composition API |
| `services/web/src/components/toolbar/Toolbar.vue` | Options API → Composition API |
| `services/web/src/components/assets/AssetBrowser.vue` | Options API → Composition API |
| `services/web/src/components/assets/AssetUploader.vue` | Options API → Composition API |
| `services/web/src/components/sidebar/AssetSidebar.vue` | Options API → Composition API |
| `services/web/src/components/render/VideoPreview.vue` | Options API → Composition API |
| `services/web/src/components/layout/EditorLayout.vue` | Options API → Composition API |
| `services/web/src/App.vue` | Options API → Composition API |

---

## Composition API Dönüşüm Kuralları (Tüm Bileşenler İçin Referans)

```
data() { return { x } }         →  const x = ref(...)
data() { return { obj } }       →  const obj = reactive({...})
computed: { y() { } }           →  const y = computed(() => ...)
methods: { f() { } }            →  function f() { ... }
watch: { x(newVal) { } }        →  watch(x, (newVal) => ...)
mounted() { }                   →  onMounted(() => ...)
beforeDestroy() { }             →  onBeforeUnmount(() => ...)
this.$emit('ev', val)           →  emit('ev', val)   [defineEmits(['ev'])]
this.$refs.name                 →  const name = ref(null)   [template: ref="name"]
this.$nextTick(fn)              →  nextTick(fn)
this.$set(obj, k, v)            →  obj[k] = v   (Vue 3'te artık gerekmiyor)
filters: { f(v) }               →  computed veya inline fonksiyon
props: { x }                    →  const props = defineProps({ x: ... })
this.propName                   →  props.propName
store import                    →  const store = useProjectStore()
import { store, actions, getters } →  import { useProjectStore } from '../store/project.js'
```

Import bloğu (her bileşenin `<script setup>` başına):
```js
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useProjectStore } from '../../store/project.js'  // yolu bileşene göre ayarla

const store = useProjectStore()
```

---

## Task 1: Paket Güncellemesi + @vue/compat Kurulumu

**Files:**
- Modify: `services/web/package.json`
- Modify: `services/web/vite.config.js`
- Modify: `services/web/vitest.config.js`
- Modify: `services/web/src/main.js`

- [ ] **Step 1: Eski paketleri kaldır, yenileri kur**

```bash
cd services/web
npm remove vue vue-konva @vitejs/plugin-vue2 @vue/test-utils
npm install vue@^3.5.0 @vue/compat vue-konva@^3.0.0 @vitejs/plugin-vue pinia @vue/test-utils@^2.4.0
```

Beklenen çıktı: `npm warn deprecated` uyarıları normal, hata olmamalı.

- [ ] **Step 2: `vite.config.js`'i güncelle**

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        compatConfig: { MODE: 2 }
      }
    }
  })],
  resolve: {
    alias: {
      'vue': '@vue/compat'
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true }
    }
  }
});
```

- [ ] **Step 3: `vitest.config.js`'i güncelle**

```js
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        compatConfig: { MODE: 2 }
      }
    }
  })],
  resolve: {
    alias: { 'vue': '@vue/compat' }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'tests/engine.test.mjs'],
  },
});
```

- [ ] **Step 4: `main.js`'i güncelle**

```js
import { createApp, configureCompat } from 'vue';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { pinia } from './store/project.js';
import './styles/main.css';

configureCompat({ MODE: 2 });

const app = createApp(App);
app.use(VueKonva);
app.use(pinia);
app.mount('#app');
```

`pinia` export'u Task 2'de ekleneceğinden geçici olarak şu satırı yorum satırı yap:

```js
// import { pinia } from './store/project.js';
// app.use(pinia);
```

- [ ] **Step 5: Engine testleri çalıştır (değişmemeli)**

```bash
cd services/web && npm test
```

Beklenen: 89 test geçiyor.

- [ ] **Step 6: Unit testleri çalıştır**

```bash
cd services/web && npm run test:unit
```

Beklenen: `@vue/test-utils@2` ile bazı importlar değişecek — hatalar normal, not al.

- [ ] **Step 7: Commit**

```bash
git add services/web/package.json services/web/vite.config.js services/web/vitest.config.js services/web/src/main.js
git commit -m "build: upgrade to Vue 3 + @vue/compat + vue-konva@3"
```

---

## Task 2: Pinia Store Migrasyonu

**Files:**
- Modify: `services/web/src/store/project.js`
- Modify: `services/web/src/main.js`
- Modify: `services/web/tests/components/*.test.js` (8 dosya)

**Strateji:** `Vue.observable` → Pinia `defineStore`. Pinia store instance'ı module-level singleton olarak oluşturulur ve `store`, `actions`, `getters` adıyla backward-compat export edilir — mevcut component importları değişmez. `Vue.set` çağrıları direkt atamaya dönüştürülür.

- [ ] **Step 1: `store/project.js` başına Vue'yu Pinia ile değiştir**

Dosyanın başındaki:
```js
import Vue from 'vue';
```
satırını şununla değiştir:
```js
import { createPinia, defineStore, setActivePinia } from 'pinia';
```

- [ ] **Step 2: `Vue.observable({...})` bloğunu Pinia store ile değiştir**

Şu kodu bul:
```js
export const store = Vue.observable({
  project: createDefaultProject(),
  selectedObjectIds: [],
  // ... (tüm state)
});
```

Şununla değiştir — mevcut state içeriğini olduğu gibi taşı, sadece sarmalayıcıyı değiştir:
```js
export const pinia = createPinia();
setActivePinia(pinia);

const useProjectStore = defineStore('project', {
  state: () => ({
    project: createDefaultProject(),
    selectedObjectIds: [],
    selectedClipId: null,
    activeTool: 'select',
    playbackTime: 0,
    playbackPlaying: false,
    playbackLoop: true,
    frameState: {
      objectOverrides: {},
      morphShapes: [],
      hiddenIds: new Set()
    },
    showExportDialog: false,
    exportCode: '',
    showRenderDialog: false,
    renderJobId: null,
    renderStatus: null,
    renderError: null,
    renderQuality: 'high',
    renderVideoUrl: null,
    renderLog: '',
    showProjectBrowser: false,
    serverProjects: [],
    apiAvailable: null,
    history: { past: [], future: [] },
    clipboard: [],
    isDirty: false,
    error: null,
    loading: false,
    savingToServer: false,
    theme: (typeof localStorage !== 'undefined' && localStorage.getItem('manim-motion-theme')) || 'light'
  })
});

export { useProjectStore };

// Backward-compat singleton — bileşenler Task 3'te useProjectStore()'a geçene kadar
const store = useProjectStore();
export { store };
export { store as actions };  // Pinia actions metodlara bağlı → actions.addObject(...) çalışır

// Pinia'da parametresiz getter'lar property'dir (çağrılmaz).
// Mevcut bileşenler getters.selectedObjects() şeklinde çağırıyor; bu wrapper çalışır.
export const getters = {
  selectedObjects: () => store.selectedObjects,
  selectedObject: () => store.selectedObject,
  selectedClip: () => store.selectedClip,
  computedDuration: () => store.computedDuration,
  visibleTracks: () => store.visibleTracks,
  hasPendingAudio: () => store.hasPendingAudio,
  objectById: (id) => store.objectById(id),
  assetById: (id) => store.assetById(id),
  groupById: (id) => store.groupById(id),
  objectGroup: (objId) => store.objectGroup(objId),
  objectsAtTime: (time) => store.objectsAtTime(time),
};
```

**Önemli:** `actions === store` (Pinia store instance'ı). `getters` ise Pinia getter'larını backward-compat fonksiyon çağrısı olarak saran thin wrapper'dır. Her ikisi de Task 12'de kaldırılır.

- [ ] **Step 3: `getters` bloğunu Pinia store içine getterlar olarak ekle**

Dosyada mevcut `export const getters = { ... }` bloğunun tüm içeriğini `defineStore`'un içine `getters:` bölümü olarak ekle.

Mevcut `getters` objesi store referanslarını `store.x` şeklinde kullanıyor — bu artık `this.x` veya `state.x` olacak (Pinia getter syntax):

```js
// defineStore içine ekle:
getters: {
  selectedObjects: (state) => state.selectedObjectIds.map(id => state.project.objects.find(o => o.id === id)).filter(Boolean),
  selectedObject: (state) => {
    if (state.selectedObjectIds.length !== 1) return null;
    return state.project.objects.find(o => o.id === state.selectedObjectIds[0]) || null;
  },
  selectedClip: (state) => {
    if (!state.selectedClipId) return null;
    for (const track of state.project.tracks) {
      const clip = track.clips.find(c => c.id === state.selectedClipId);
      if (clip) return clip;
    }
    return null;
  },
  objectById: (state) => (id) => state.project.objects.find(o => o.id === id) || null,
  assetById: (state) => (id) => state.project.assets.find(a => a.id === id) || null,
  groupById: (state) => (id) => (state.project.groups || []).find(g => g.id === id) || null,
  objectGroup: (state) => (objId) => (state.project.groups || []).find(g => g.childIds && g.childIds.includes(objId)) || null,
  computedDuration: (state) => {
    let maxEnd = 5;
    for (const obj of state.project.objects) {
      const end = (obj.enterTime || 0) + (obj.duration || 5);
      if (end > maxEnd) maxEnd = end;
    }
    for (const track of state.project.tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }
    return Math.max(state.project.sceneDuration, maxEnd + 1);
  },
  visibleTracks: (state) => {
    const all = state.project.tracks;
    const activeCount = all.filter(t => t.clips.length > 0).length;
    const showCount = Math.min(5, Math.max(1, activeCount + 1));
    return all.slice(0, showCount);
  },
  objectsAtTime: (state) => (time) => state.project.objects.filter(o => {
    const enter = o.enterTime || 0;
    const exit = enter + (o.duration || 999);
    return time >= enter && time < exit;
  }),
  hasPendingAudio: (state) => state.project.tracks.some(t =>
    t.clips.some(c => c.audio && c.audio.status === 'pending')
  ),
},
```

`export const getters = { ... }` bloğunu dosyadan sil.

- [ ] **Step 4: `actions` bloğunu Pinia store içine actions olarak taşı**

Mevcut `export const actions = { ... }` bloğunun içeriğini `defineStore`'un `actions:` bölümüne taşı. Her metodun içindeki `store.x` → `this.x` ve `actions.y()` → `this.y()` olarak güncelle.

Taşıma kuralları:
```
store.project.objects     →  this.project.objects
store.selectedObjectIds   →  this.selectedObjectIds
actions.commitState()     →  this.commitState()
actions.addObject(...)    →  this.addObject(...)
```

`export const actions = { ... }` bloğunu dosyadan sil.

- [ ] **Step 5: Tüm `Vue.set(...)` çağrılarını direkt atamaya dönüştür**

Dosyada grep ile bul:
```bash
grep -n "Vue.set" services/web/src/store/project.js
```

Her `Vue.set(obj, 'key', value)` → `obj.key = value` olarak değiştir.
Her `Vue.set(obj, key, value)` (dinamik key) → `obj[key] = value` olarak değiştir.

Örnek:
```js
// Önce:
Vue.set(obj, key, updates[key]);
// Sonra:
obj[key] = updates[key];

// Önce:
if (!store.project.groups) Vue.set(store.project, 'groups', []);
// Sonra:
if (!this.project.groups) this.project.groups = [];
```

- [ ] **Step 6: `main.js`'te yorum satırlarını aç**

```js
import { createApp, configureCompat } from 'vue';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { pinia } from './store/project.js';
import './styles/main.css';

configureCompat({ MODE: 2 });

const app = createApp(App);
app.use(VueKonva);
app.use(pinia);
app.mount('#app');
```

- [ ] **Step 7: Test dosyalarını Pinia setup ile güncelle**

8 test dosyasının her birinde `beforeEach` bloğunu güncelle. Örnek (`store.test.js`):

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;

beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});
```

Her test dosyasında:
- `import { store, actions } from '../../src/store/project.js'` → `import { useProjectStore } from '../../src/store/project.js'`
- `beforeEach` içinde `setActivePinia(createPinia()); store = useProjectStore(); store.newProject(...)`
- Test içinde `store.xxx` direkt kullan (actions da store'da)
- `actions.addObject(...)` → `store.addObject(...)`
- `getters.xxx(...)` → `store.xxx` (Pinia getter olarak)

- [ ] **Step 8: Engine testleri çalıştır**

```bash
cd services/web && npm test
```

Beklenen: 89 test geçiyor.

- [ ] **Step 9: Unit testleri çalıştır**

```bash
cd services/web && npm run test:unit
```

Beklenen: 62 test geçiyor. Hata varsa store referanslarını kontrol et.

- [ ] **Step 10: Commit**

```bash
git add services/web/src/store/project.js services/web/src/main.js services/web/tests/
git commit -m "feat: migrate store from Vue.observable to Pinia"
```

---

## Task 3: Compat Uyarılarını Gider

**Files:** Uygulama çalıştırılarak tespit edilecek — çoğunlukla `store/project.js` veya bireysel bileşenler.

- [ ] **Step 1: Uygulamayı başlat ve konsolu kontrol et**

```bash
cd services/web && npm run dev
```

Tarayıcıda `http://localhost:5173` aç. DevTools Console'da `[Vue compat]` ile başlayan uyarıları not al.

- [ ] **Step 2: Yaygın uyarılar ve çözümleri**

| Uyarı | Çözüm |
|-------|-------|
| `GLOBAL_PROTOTYPE` | `Vue.prototype.x` → `app.config.globalProperties.x` |
| `GLOBAL_EXTEND` | `Vue.extend(...)` → `defineComponent(...)` |
| `INSTANCE_SET` | `this.$set(obj, k, v)` → `obj[k] = v` |
| `INSTANCE_DELETE` | `this.$delete(arr, i)` → `arr.splice(i, 1)` |
| `OPTIONS_FILTERS` | `{{ val | filter }}` → computed veya inline fonksiyon |
| `INSTANCE_LISTENERS` | `$listeners` → `v-bind="$attrs"` |
| `INSTANCE_SCOPED_SLOTS` | `$scopedSlots` → `$slots` |
| `V_ON_KEYCODE_MODIFIER` | `@keyup.13` → `@keyup.enter` |

- [ ] **Step 3: Her uyarıyı ilgili dosyada gider, tüm testlerin geçtiğini doğrula**

```bash
cd services/web && npm run test:unit && npm test
```

- [ ] **Step 4: Commit**

```bash
git add services/web/src/
git commit -m "fix: resolve all @vue/compat compatibility warnings"
```

---

## Task 4: Inspector Alt Bileşenleri → Composition API

**Files:**
- Modify: `services/web/src/components/inspector/ColorInput.vue`
- Modify: `services/web/src/components/inspector/FontSelector.vue`

Bu bileşenler store'a erişmez — saf props/emits bileşenleridir.

- [ ] **Step 1: `ColorInput.vue`'yu `<script setup>`'a çevir**

```vue
<script setup>
import { ref, computed, watch } from 'vue'

const HEX_REGEX = /^#[0-9A-F]{6}$/i

const props = defineProps({
  value: { type: String, default: '#000000' }
})
const emit = defineEmits(['input', 'change'])

const displayValue = ref(props.value || '#000000')
const isValid = ref(true)

const validatedValue = computed(() => {
  if (HEX_REGEX.test(displayValue.value)) return displayValue.value.toLowerCase()
  return '#000000'
})

watch(() => props.value, (newVal) => {
  if (newVal && newVal !== displayValue.value) {
    displayValue.value = newVal
    isValid.value = HEX_REGEX.test(newVal)
  }
})

function handleColorPicker(event) {
  const value = event.target.value
  displayValue.value = value
  isValid.value = true
  emit('input', value)
  emit('change', value)
}

function handleTextInput(event) {
  let value = event.target.value
  if (value && !value.startsWith('#') && /^[0-9A-F]/i.test(value)) {
    value = '#' + value
  }
  displayValue.value = value
  if (HEX_REGEX.test(value)) {
    isValid.value = true
    emit('input', value.toLowerCase())
    emit('change', value.toLowerCase())
  } else {
    isValid.value = false
  }
}

function validateOnBlur() {
  if (!HEX_REGEX.test(displayValue.value)) {
    displayValue.value = props.value || '#000000'
    isValid.value = true
  }
}
</script>
```

`<template>` ve `<style>` değişmez. `export default { ... }` bloğunu sil.

- [ ] **Step 2: `FontSelector.vue`'yu oku ve aynı dönüşümü uygula**

```bash
cat services/web/src/components/inspector/FontSelector.vue
```

`data() → ref/reactive`, `props → defineProps`, `methods → function`, `$emit → emit`. Store erişimi yoksa basit dönüşüm.

- [ ] **Step 3: Unit testleri çalıştır**

```bash
cd services/web && npm run test:unit
```

Beklenen: 62 test geçiyor.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/ColorInput.vue services/web/src/components/inspector/FontSelector.vue
git commit -m "refactor: migrate ColorInput and FontSelector to Composition API"
```

---

## Task 5: Inspector Panel Bileşenleri → Composition API

**Files:**
- Modify: `services/web/src/components/inspector/AnimationPanel.vue`
- Modify: `services/web/src/components/inspector/LayoutPanel.vue`
- Modify: `services/web/src/components/inspector/StylePanel.vue`
- Modify: `services/web/src/components/inspector/TimingPanel.vue`
- Modify: `services/web/src/components/inspector/AudioPanel.vue`

Bu bileşenler store'a erişir. Her biri için:

- [ ] **Step 1: Dosyayı oku**

```bash
cat services/web/src/components/inspector/AnimationPanel.vue
cat services/web/src/components/inspector/LayoutPanel.vue
cat services/web/src/components/inspector/StylePanel.vue
cat services/web/src/components/inspector/TimingPanel.vue
cat services/web/src/components/inspector/AudioPanel.vue
```

- [ ] **Step 2: Her bileşeni `<script setup>`'a çevir**

Script bölümünü şablona göre yaz:

```vue
<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useProjectStore } from '../../store/project.js'

// Props/emits varsa:
const props = defineProps({ ... })
const emit = defineEmits([...])

const store = useProjectStore()

// data() içeriği → ref/reactive
// computed → computed(...)
// methods → function
// watch → watch(source, handler)
// mounted → onMounted(...)
// beforeDestroy → onBeforeUnmount(...)
// this.store.x → store.x
// actions.y() → store.y()
// getters.z() → store.z (Pinia getter, artık fonksiyon değil; parametre gereken getterlar: store.objectById(id))
</script>
```

`AudioPanel.vue` için özellikle dikkat:
- `beforeDestroy` hook → `onBeforeUnmount` (WebSocket disconnect)
- `this.$emit` → `emit`

- [ ] **Step 3: Unit testleri çalıştır**

```bash
cd services/web && npm run test:unit
```

Beklenen: 62 test geçiyor.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/
git commit -m "refactor: migrate inspector panel components to Composition API"
```

---

## Task 6: Inspector.vue → Composition API

**Files:**
- Modify: `services/web/src/components/inspector/Inspector.vue`

- [ ] **Step 1: Dosyayı oku**

```bash
cat services/web/src/components/inspector/Inspector.vue
```

- [ ] **Step 2: `<script setup>`'a çevir**

```vue
<script setup>
import { computed } from 'vue'
import { useProjectStore } from '../../store/project.js'
import AnimationPanel from './AnimationPanel.vue'
import LayoutPanel from './LayoutPanel.vue'
import StylePanel from './StylePanel.vue'
import TimingPanel from './TimingPanel.vue'
import AudioPanel from './AudioPanel.vue'
import ColorInput from './ColorInput.vue'
import FontSelector from './FontSelector.vue'

const store = useProjectStore()

// computed'lar: getters.selectedObject → store.selectedObject (Pinia getter)
// store.selectedObjectIds → store.selectedObjectIds
// actions.updateObject → store.updateObject
</script>
```

- [ ] **Step 3: Unit testleri çalıştır**

```bash
cd services/web && npm run test:unit
```

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/Inspector.vue
git commit -m "refactor: migrate Inspector.vue to Composition API"
```

---

## Task 7: Timeline Bileşenleri → Composition API

**Files:**
- Modify: `services/web/src/components/timeline/TimelineTrack.vue`
- Modify: `services/web/src/components/timeline/Timeline.vue`

- [ ] **Step 1: Dosyaları oku**

```bash
cat services/web/src/components/timeline/TimelineTrack.vue
cat services/web/src/components/timeline/Timeline.vue
```

- [ ] **Step 2: Her bileşeni `<script setup>`'a çevir**

Genel dönüşüm kurallarını uygula. Timeline.vue'da dikkat:
- Mouse event handler'ları (`mousedown`, `mousemove`, `mouseup`) — Vue 3'te `v-on` direktifi syntax aynı
- Ref'ler (`this.$refs.timeline`) → `const timeline = ref(null)` + template `ref="timeline"`

- [ ] **Step 3: Unit testleri çalıştır**

```bash
cd services/web && npm run test:unit
```

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/timeline/
git commit -m "refactor: migrate timeline components to Composition API"
```

---

## Task 8: Stage Bileşenleri → Composition API

**Files:**
- Modify: `services/web/src/components/stage/AnchorGrid.vue`
- Modify: `services/web/src/components/stage/StageImage.vue`
- Modify: `services/web/src/components/stage/StageSvg.vue`
- Modify: `services/web/src/components/stage/StageText.vue`
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Dosyaları oku**

```bash
cat services/web/src/components/stage/AnchorGrid.vue
cat services/web/src/components/stage/StageImage.vue
cat services/web/src/components/stage/StageSvg.vue
cat services/web/src/components/stage/StageText.vue
cat services/web/src/components/stage/StageCanvas.vue
```

- [ ] **Step 2: AnchorGrid, StageImage, StageSvg, StageText'i çevir**

Genel dönüşüm kurallarını uygula. Bu bileşenler küçük ve çoğunlukla props alır.

- [ ] **Step 3: StageCanvas.vue'yu çevir**

En büyük bileşen. Özellikle dikkat gerektiren noktalar:
- Konva stage/layer referansları: `this.$refs.stage` → `const stage = ref(null)`
- `vue-konva@3`'te `v-stage`, `v-layer`, `v-rect` vb. component API aynı; `config` prop aynı
- `mounted()` lifecycle hook → `onMounted()`
- Playback loop `requestAnimationFrame` → değişmez, Vue-agnostik
- `watch` ile store değişikliklerini izleme → `watch(() => store.xxx, ...)`

```vue
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useProjectStore } from '../../store/project.js'
// ... diğer importlar (geometry, easing, transform, playback)

const store = useProjectStore()
const stage = ref(null)
// ... diğer ref'ler

// computed'lar store getter'ları kullanıyor:
// getters.selectedObject → store.selectedObject
// getters.visibleTracks → store.visibleTracks

onMounted(() => {
  // mevcut mounted() içeriği
})

onBeforeUnmount(() => {
  // mevcut beforeDestroy() içeriği
})
</script>
```

- [ ] **Step 4: Unit testleri çalıştır**

```bash
cd services/web && npm run test:unit
```

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/stage/
git commit -m "refactor: migrate stage components to Composition API"
```

---

## Task 9: Toolbar + Asset Bileşenleri → Composition API

**Files:**
- Modify: `services/web/src/components/toolbar/Toolbar.vue`
- Modify: `services/web/src/components/assets/AssetBrowser.vue`
- Modify: `services/web/src/components/assets/AssetUploader.vue`
- Modify: `services/web/src/components/sidebar/AssetSidebar.vue`
- Modify: `services/web/src/components/render/VideoPreview.vue`

- [ ] **Step 1: Dosyaları oku**

```bash
cat services/web/src/components/toolbar/Toolbar.vue
cat services/web/src/components/assets/AssetBrowser.vue
cat services/web/src/components/assets/AssetUploader.vue
cat services/web/src/components/sidebar/AssetSidebar.vue
cat services/web/src/components/render/VideoPreview.vue
```

- [ ] **Step 2: Her bileşeni `<script setup>`'a çevir**

Genel dönüşüm kurallarını uygula. Store import'larını `useProjectStore()` ile değiştir.

VideoPreview.vue'da WebSocket bağlantısı varsa `onBeforeUnmount` ile temizle.

- [ ] **Step 3: Unit testleri çalıştır**

```bash
cd services/web && npm run test:unit
```

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/toolbar/ services/web/src/components/assets/ services/web/src/components/sidebar/ services/web/src/components/render/
git commit -m "refactor: migrate toolbar and asset components to Composition API"
```

---

## Task 10: EditorLayout + App.vue → Composition API

**Files:**
- Modify: `services/web/src/components/layout/EditorLayout.vue`
- Modify: `services/web/src/App.vue`

- [ ] **Step 1: Dosyaları oku**

```bash
cat services/web/src/components/layout/EditorLayout.vue
cat services/web/src/App.vue
```

- [ ] **Step 2: `EditorLayout.vue`'yu çevir**

Genel dönüşüm kurallarını uygula.

- [ ] **Step 3: `App.vue`'yu çevir**

`App.vue` projenin kök bileşenidir ve muhtemelen birçok store erişimi, dialog yönetimi, keyboard shortcut handler içerir. Özellikle:

- `mounted()` hook'ta keyboard event listener'lar → `onMounted` + `onBeforeUnmount` (temizleme için)
- `window.addEventListener('keydown', ...)` → değişmez
- Tüm `store.x` → `store.x` (useProjectStore() ile)
- `getters.hasPendingAudio()` → `store.hasPendingAudio` (Pinia getter, artık property)

- [ ] **Step 4: Tüm testleri çalıştır**

```bash
cd services/web && npm run test:unit && npm test
```

Beklenen: 62 unit + 89 engine testi geçiyor.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/layout/EditorLayout.vue services/web/src/App.vue
git commit -m "refactor: migrate EditorLayout and App.vue to Composition API"
```

---

## Task 11: Vue Test Utils v2 Güncellemesi

**Files:**
- Modify: `services/web/tests/components/*.test.js` (8 dosya)

Task 2'de `@vue/test-utils@2` zaten kuruldu. Bu task'ta API farklılıklarını gider.

- [ ] **Step 1: `@vue/test-utils@2` API değişikliklerini kontrol et**

Test dosyalarında şu pattern'leri grep ile bul ve gider:

```bash
grep -rn "wrapper.vm.\$set\|createLocalVue\|shallowMount\|mount" services/web/tests/
```

| Vue Test Utils v1 | Vue Test Utils v2 |
|---|---|
| `createLocalVue()` | Artık yok — `createApp` veya global config kullan |
| `wrapper.vm.$set(...)` | `wrapper.vm.xxx = yyy` (Vue 3'te $set yok) |
| `wrapper.trigger('input')` | `await wrapper.trigger('input')` (Promise döner) |
| `wrapper.find('.cls').exists()` | Aynı |
| `wrapper.html()` | Aynı |

- [ ] **Step 2: Tüm test dosyalarını güncelle**

Bulunan her v1 pattern'i v2 eşdeğeriyle değiştir.

- [ ] **Step 3: Tüm testleri çalıştır**

```bash
cd services/web && npm run test:unit && npm test
```

Beklenen: 62 + 89 geçiyor.

- [ ] **Step 4: Commit**

```bash
git add services/web/tests/
git commit -m "refactor: update tests for Vue Test Utils v2"
```

---

## Task 12: @vue/compat Temizliği ve Vue 3 Pure

**Files:**
- Modify: `services/web/package.json`
- Modify: `services/web/vite.config.js`
- Modify: `services/web/vitest.config.js`
- Modify: `services/web/src/main.js`

- [ ] **Step 1: Konsol uyarılarını son kez kontrol et**

```bash
cd services/web && npm run dev
```

Tarayıcı konsolunda `[Vue compat]` uyarısı kalmadığından emin ol. Varsa gider.

- [ ] **Step 2: `@vue/compat`'ı kaldır**

```bash
cd services/web && npm remove @vue/compat
npm install vue@^3.5.0  # sadece pure Vue 3
```

- [ ] **Step 3: `vite.config.js`'ten compat kaldır**

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true }
    }
  }
});
```

- [ ] **Step 4: `vitest.config.js`'ten compat kaldır**

```js
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'tests/engine.test.mjs'],
  },
});
```

- [ ] **Step 5: `main.js`'ten `configureCompat` kaldır**

```js
import { createApp } from 'vue';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { pinia } from './store/project.js';
import './styles/main.css';

const app = createApp(App);
app.use(VueKonva);
app.use(pinia);
app.mount('#app');
```

- [ ] **Step 6: `store/project.js`'teki backward-compat export'ları kaldır**

Dosyanın sonundaki şu satırları sil:
```js
const store = useProjectStore();
export { store };
export { store as actions };
export { store as getters };
```

Artık bileşenler `useProjectStore()` kullandığından bu export'lar kullanılmıyor. Grep ile kontrol et:

```bash
grep -rn "import.*store.*actions.*getters.*project" services/web/src/
```

Sonuç boş olmalı.

- [ ] **Step 7: Tüm testleri çalıştır**

```bash
cd services/web && npm run test:unit && npm test
```

Beklenen: 62 + 89 geçiyor.

- [ ] **Step 8: Uygulamayı başlat ve smoke test yap**

```bash
cd services/web && npm run dev
```

- [ ] Yeni proje oluştur (template seç)
- [ ] Stage'e şekil ekle
- [ ] Inspector'da düzenle
- [ ] Timeline'da clip ekle
- [ ] Code view'a geç
- [ ] Tema değiştir (light/dark)
- [ ] Konsol'da hata/uyarı yok

- [ ] **Step 9: Commit ve push**

```bash
git add services/web/
git commit -m "feat: complete Vue 2 → Vue 3 migration; remove @vue/compat"
git push origin main
```

---

## Notlar

- **`store.objectById(id)`** — Pinia'da factory getter (fonksiyon döndüren getter) şöyle kullanılır: `store.objectById(id)` (Pinia bunu otomatik destekler, `(state) => (id) => ...` syntax'ıyla tanımlıdır).
- **`store.hasPendingAudio`** — Pinia getter; artık `()` olmadan property gibi çağrılır. Template'lerde `store.hasPendingAudio()` → `store.hasPendingAudio`.
- **`uid` export'u** — `uid` fonksiyonu store action'larına taşınmadı; `store/project.js`'te standalone fonksiyon olarak kalır. Import: `import { uid } from '../store/project.js'`.
- **`ENTER_ANIMS`, `EXIT_ANIMS`, `SHAPE_DEFAULTS`, `SHAPE_COLORS`** — Bu const export'lar değişmeden kalır.
