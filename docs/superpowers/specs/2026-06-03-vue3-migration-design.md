# Vue 2 → Vue 3 Göçü — Tasarım Dokümanı

**Tarih:** 2026-06-03
**Kapsam:** `services/web` — Vue 2.7 + Vue.observable → Vue 3 + Pinia + Composition API
**Yaklaşım:** @vue/compat köprüsü ile kademeli göç

---

## 1. Kapsam

Yalnızca `services/web` etkilenir. API, renderer ve audio servisleri bu göçten bağımsızdır.

---

## 2. Paket Değişiklikleri

| Kaldırılan | Eklenen |
|---|---|
| `vue@2.7` | `vue@3`, `@vue/compat` (geçici) |
| `@vue/test-utils@1` | `@vue/test-utils@2` |
| — | `pinia` |
| — | `@pinia/testing` |

Konva.js doğrudan kullanılıyor (`vue-konva` yoktur) → değişiklik gerekmez.  
Vite zaten kullanılıyor → build sistemi değişmez.

---

## 3. Göç Adımları

### Adım 1 — @vue/compat Kurulumu

- `package.json`: `vue` → `vue@3`, `@vue/compat` eklenir
- `vite.config.js`: alias `'vue': '@vue/compat'` eklenir
- `main.js`: `new Vue(...)` → `createApp(App)` + `configureCompat({ MODE: 2 })`
- Uygulamayı başlatıp console uyarıları listelenir: `Vue.set`, `$set`, `Vue.delete`, `filters`, `$on`/`$off`/`$once`, `$scopedSlots` vb.
- Tüm uyarılar giderilene kadar bu adım kapatılmaz

**Başarı kriteri:** Uygulama çalışıyor, console'da sıfır compat uyarısı, 47 unit + 89 engine testi geçiyor.

### Adım 2 — Pinia Store Göçü

`services/web/src/store/project.js` tamamen yeniden yazılır:

```js
// Önce
import Vue from 'vue';
export const store = Vue.observable({ objects: [], tracks: [], ... });
export const actions = { commitState() { ... } };

// Sonra
import { defineStore } from 'pinia';
export const useProjectStore = defineStore('project', {
  state: () => ({ objects: [], tracks: [], ... }),
  actions: { commitState() { ... } },
  getters: { ... }
});
```

- `Vue.set(obj, k, v)` → `obj.k = v` (Vue 3 reaktivitesi proxy tabanlı, set gerekmez)
- `Vue.delete(obj, k)` → `delete obj.k`
- `import { store, actions, getters }` kullanımları → `const store = useProjectStore()`
- Test dosyaları: `beforeEach(() => setActivePinia(createPinia()))` ile store sıfırlanır

**Başarı kriteri:** 47 unit + 89 engine testi geçiyor.

### Adım 3 — Bileşen Göçü (Leaf → Root)

Her bileşen Options API'den Composition API'ye çevrilir. Sıra:

```
1. ColorInput, FontSelector
2. AnimationPanel, LayoutPanel, StylePanel, TimingPanel, AudioPanel
3. Inspector.vue
4. TimelineTrack → Timeline.vue
5. StageImage, StageSvg, StageText → StageCanvas.vue
6. Toolbar, AssetBrowser, VideoPreview, AssetSidebar
7. EditorLayout.vue → App.vue
```

Her bileşen çevrildiğinde ilgili test dosyası aynı anda güncellenir.

**Options → Composition dönüşüm kuralları:**

| Vue 2 Options API | Vue 3 Composition API |
|---|---|
| `data() { return { x } }` | `const x = ref(...)` / `reactive({...})` |
| `computed: { y() }` | `const y = computed(() => ...)` |
| `methods: { f() }` | `function f() { ... }` |
| `watch: { x(v) }` | `watch(x, (v) => ...)` |
| `mounted()` | `onMounted(() => ...)` |
| `this.$emit(...)` | `emit(...)` (defineEmits) |
| `this.$refs.x` | `const x = ref(null)` |
| `this.$nextTick(...)` | `nextTick(...)` |
| `filters: { f }` | `computed` veya inline fonksiyon |

**Başarı kriteri:** Her bileşen çevrildikten sonra testler yeşil.

### Adım 4 — Vue Test Utils v1 → v2

- `@vue/test-utils@1` kaldırılır, `@vue/test-utils@2` kurulur
- API büyük ölçüde aynı; `wrapper.vm.$set` kullanımları kaldırılır
- `trigger` artık Promise döner → `await trigger(...)`
- `wrapper.find` davranışı aynı

**Başarı kriteri:** 62 unit testi geçiyor.

### Adım 5 — @vue/compat Temizliği

- `@vue/compat` kaldırılır (`package.json`, `node_modules`)
- `vite.config.js` alias kaldırılır
- `main.js`'ten `configureCompat` kaldırılır
- Vue 3 pure modda `npm run dev` ile son doğrulama

**Başarı kriteri:** Uygulama çalışıyor, console'da hiç uyarı yok, tüm testler geçiyor.

---

## 4. Test Stratejisi

- **89 engine testi** (`tests/engine.test.mjs`): Vue'dan bağımsız, hiçbir adımda değişmez
- **62 unit testi** (`tests/components/`): Her adım sonunda yeşil olmak zorunda
- Hiçbir commit kırık test bırakmaz

---

## 5. Başarı Kriterleri

| Adım | Kriter |
|---|---|
| 1 — compat | Uygulama açılıyor, console'da sıfır compat uyarısı |
| 2 — Pinia | Store API çalışıyor, tüm testler geçiyor |
| 3 — Bileşenler | Her bileşen çevrildiğinde testler yeşil |
| 4 — Test Utils | 62 unit testi v2 ile geçiyor |
| 5 — Temizlik | Vue 3 pure, sıfır uyarı, 47+89 test geçiyor |

---

## 6. Riskler

| Risk | Önlem |
|---|---|
| `Vue.observable` referansları kaçırılır | Codebase'de `Vue.set` / `Vue.observable` grep ile kontrol |
| Pinia store API'si bileşenlerle uyumsuz | Adım 2'de tüm bileşenler `store.*` yerine `useProjectStore()` kullanır |
| Konva event handler'larında `this` binding kayması | `setup()` içinde arrow fonksiyonlar kullanılır |
| compat uyarısız görünen ama bozuk davranış | E2E smoke test: yeni proje oluştur, nesne ekle, render al |
