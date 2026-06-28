# Manim Motion Editor — Geliştirme Yol Haritası

**Tarih:** 2026-06-02
**Kapsam:** Mevcut özelliklerin analizi, eksik Manim CE kapasitelerinin tespiti ve önceliklendirilmiş geliştirme planı
**Yaklaşım:** Etki/Maliyet matrisi + aşamalı uygulama planı (Hibrit)
**Son güncelleme:** 2026-06-28 — yol haritası büyük ölçüde tamamlandı (bkz. §0)

---

## 0. Durum (2026-06-24)

**Bu yol haritası büyük ölçüde tamamlandı.** Orijinal 3 fazın 14 ana maddesinin **tamamı** teslim edildi; paralel render worker da `renderer-2` servisiyle kapatıldı. Üstüne, planda hiç olmayan kapsamlı iş eklendi: strict TypeScript göçü, nesne tipleri 17 → ~58, 2D efektler + emphasis animasyonları, export formatları (MP4/GIF/WebM/PNG/WebM-α) ve üç kalite dalgası (bkz. §5).

| Faz | Durum |
|---|---|
| Phase 1 — Hızlı Kazanımlar | ✅ easing · WebSocket render · Vitest altyapısı · şablonlar · render geçmişi · paralel render worker |
| Phase 2 — Yüksek Değer | ✅ grafik/NumberPlane · AnimationGroup/LaggedStart · path · kamera |
| Phase 3 — Uzun Vadeli | ✅ ses/voiceover · Vue 3 göçü · keyframe sistemi · 3D sahne |

Güncel sürüm **v3.27.0** · 760 web unit + 122 engine + 55 api + 15 codegen + 17 e2e · strict TypeScript · tüm CI kapıları yeşil.

---

## 1. Mevcut Durum *(2026-06-02 başlangıç durumu — tarihsel)*

Manim Motion Editor v1.1.0, 4 Docker servisinden oluşan (Vue 2.7 frontend, Node.js API, Python Manim worker, Redis) bir animasyon editörüdür. Temel özellikler çalışmaktadır: 17 şekil tipi, 5 klip tipi, 11 giriş + 9 çıkış animasyonu, undo/redo, çift editör modu (Visual + Code-Only), server-side render (480p–4K).

---

## 2. Etki/Maliyet Matrisi

Efor etiketleri: **S** (1–3 gün) · **M** (1–2 hafta) · **L** (2–4 hafta) · **XL** (1–3 ay)

### Hızlı Kazanımlar (Yüksek Etki, Düşük Maliyet)

| Madde | Gerekçe | Efor |
|---|---|---|
| Easing mapping düzeltmeleri | `spring→smooth`, `ease_in_out_cubic→smooth` gibi yanlış eşlemeler render/önizleme uyumsuzluğuna yol açıyor; `codegen.js` ve `easing.js`'te lokal değişiklik | S |
| WebSocket render takibi | 2 saniyelik polling kaldırılır, render durumu anlık push ile iletilir; `queue.js` + frontend `RenderPanel.vue` | S |
| UI bileşen test altyapısı | Yalnızca engine mantığı test ediliyor; Vue bileşenlerini kapsayan Vitest/Vue Test Utils altyapısı kurulur | S |
| Template/preset kütüphanesi | Hazır JSON sahneleri (teorem açıklama, grafik dönüşümü, formül tanıtımı vb.) + "Yeni Proje" diyaloğuna şablon seçici UI | M |

### Büyük Bahisler (Yüksek Etki, Yüksek Maliyet)

| Madde | Gerekçe | Efor |
|---|---|---|
| Fonksiyon grafiği / NumberPlane | `Axes` nesnesi altyapısı mevcut; üzerine `plot(lambda x: ...)`, `NumberPlane`, `NumberLine` desteği eklenir; Inspector'a eğri tanımlama UI'ı | L |
| AnimationGroup / LaggedStart | Paralel ve gecikmeli animasyon grupları; timeline klip sistemi paralel yürütmeyi destekleyecek şekilde genişler; codegen'de `AnimationGroup`/`LaggedStart` çıktısı | L |
| Path animasyonu (MoveAlongPath) | Bezier/yay eğrisi boyunca hareket; yeni klip tipi `path_move`; canvas'ta eğri çizim aracı; `MoveAlongPath` codegen | M |
| Kamera animasyonları | Yeni `camera` kavramı editöre eklenir; `MovingCameraScene` desteği; timeline'da kamera klibi; zoom/pan/focus codegen | M |
| Ses / seslendirme | `manim-voiceover` entegrasyonu; timeline'a ses parçası; senkronizasyon arayüzü; renderer'da ffmpeg ses birleştirme | L |

### Dolgu (Düşük Etki, Düşük Maliyet)

| Madde | Gerekçe | Efor |
|---|---|---|
| Paralel render worker | `docker-compose.yml`'de ikinci renderer servisi; Redis kuyruğu zaten destekliyor | S |
| Render geçmişi | Proje başına son N render'ı listele; mevcut `latest.mp4` dosyalanır | S |

### Düşük Öncelik (Düşük Etki, Yüksek Maliyet)

| Madde | Gerekçe | Efor |
|---|---|---|
| Vue 2 → Vue 3 göçü | Vue 2 EOL Aralık 2023; tüm bileşenleri etkileyen kapsamlı yeniden yazım | XL |
| Keyframe animasyon sistemi | Mevcut klip sistemi çoğu senaryoyu karşılıyor; özellik bazlı keyframe büyük mimari değişiklik gerektirir | XL |
| 3D sahne desteği | `ThreeDScene` Code-Only modda erişilebilir; görsel editöre entegrasyon çok karmaşık | XL |

---

## 3. Aşamalı Uygulama Planı

### Phase 1 — Hızlı Kazanımlar ✅ *(tamamlandı)*

**Hedef:** Mevcut hataları gider, geliştirme zeminini hazırla, yeni kullanıcı deneyimini iyileştir.

1. **Easing mapping düzeltmeleri**
   - `services/api/src/compiler/codegen.js` içindeki `EASING_MAP` güncellenir
   - `services/web/src/engine/easing.js` önizleme fonksiyonları düzeltilir
   - Render çıktısı ile canvas önizlemesi arasındaki görsel fark giderilir

2. **WebSocket render takibi**
   - `services/api/src/queue.js` → `socket.io` veya native WebSocket ile job olayları yayınlanır
   - `services/web/src/components/render/RenderPanel.vue` → polling kaldırılır, socket dinleyici eklenir

3. **UI bileşen test altyapısı**
   - `services/web/` altına Vitest + Vue Test Utils kurulur
   - Kritik bileşenler için ilk test dosyaları oluşturulur: `StageCanvas`, `Timeline`, `Inspector`

4. **Template/preset kütüphanesi**
   - `services/web/src/templates/` dizininde JSON sahneleri (en az 5 şablon)
   - `App.vue` "Yeni Proje" diyaloğuna şablon seçici eklenir
   - Şablonlar: Teorem açıklama, Fonksiyon grafiği taslağı, Formül tanıtımı, Vektör diyagramı, Sunu başlığı

5. **Paralel render worker** ✅
   - `docker-compose.yml`'de `renderer-2` servisi (aynı image, aynı Redis kuyruğu)
   - Mevcut iş akışına dokunmaz; iki job aynı anda işlenebilir

6. **Render geçmişi**
   - Proje başına son 5 render dosyalanır (`render_1.mp4`, `render_2.mp4`...)
   - `RenderPanel.vue`'ya geçmiş listesi eklenir

### Phase 2 — Yüksek Değer Özellikler ✅ *(tamamlandı)*

**Hedef:** Manim'in temel matematiksel yeteneklerini görsel editöre taşı.

1. **Fonksiyon grafiği / NumberPlane**
   - Mevcut `axes` nesne tipini genişlet; üzerine `graph` alt-nesnesi eklenir
   - Inspector'a lambda ifadesi giriş alanı
   - `codegen.js`'te `axes.plot(lambda x: ...)` çıktısı
   - `NumberPlane`, `NumberLine`, `PolarPlane` yeni şekil tipleri olarak eklenir

2. **AnimationGroup / LaggedStart**
   - Timeline'da kliplerin "paralel" veya "sıralı" moduna geçiş
   - Yeni klip özelliği: `parallel: true`, `lag_ratio: float`
   - `codegen.js`'te `AnimationGroup(...)` ve `LaggedStart(...)` çıktısı

3. **Path animasyonu (MoveAlongPath)**
   - Yeni klip tipi: `path_move`
   - Canvas'ta Bezier eğrisi çizim aracı (Konva path)
   - `codegen.js`'te `MoveAlongPath(obj, path)` çıktısı

4. **Kamera animasyonları**
   - Proje sahnesine `cameraType: 'moving' | 'static'` alanı
   - Timeline'da `camera` parçası; zoom/pan klibi
   - `codegen.js`'te `MovingCameraScene` + `self.camera.frame.animate.move_to(...)` çıktısı

5. ~~Paralel render worker~~ *(Phase 1'e taşındı)*

### Phase 3 — Uzun Vadeli Yeniden Yapılandırma ✅ *(tamamlandı)*

**Hedef:** Teknik borcu öde, ekosistemin geri kalanını kapat.

1. **Ses / seslendirme (manim-voiceover)**
   - Renderer Docker image'ına `manim-voiceover` + `ffmpeg` eklenir
   - Timeline'a audio parçası; ses dosyası yükleme
   - Zaman senkronizasyonu: ses süresine göre sahne uzatma
   - `codegen.js`'te `VoiceoverScene` çıktısı

2. **Vue 2 → Vue 3 göçü**
   - `Vue.observable` → `reactive`/`ref` (Composition API)
   - `Vue.set` kaldırılır (Vue 3'te gerekmiyor)
   - Tüm bileşenler Options API → Composition API'ye taşınır
   - Vite zaten kullanılıyor; build sistemi değişmez

3. **Keyframe animasyon sistemi**
   - Mevcut clip modeli korunur; üzerine per-property keyframe katmanı eklenir
   - Timeline'da keyframe noktaları; eğri editörü (Bezier handle)
   - Playback engine güncellenir: klip + keyframe interpolasyon birleştirilir

4. **3D sahne desteği**
   - Proje tipine `sceneType: '2d' | '3d'` eklenir
   - `ThreeDScene` için kamera açısı kontrolü (phi, theta, zoom)
   - Mevcut 2D şekillerin 3D koordinatlara dönüştürülmesi

---

## 4. Başarı Kriterleri

| Phase | Kriter |
|---|---|
| Phase 1 | Render önizleme uyumu %100; yeni kullanıcı şablon ile 5 dakikada ilk renderı alır |
| Phase 2 | Matematik içerikli bir eğitim videosu Code-Only moda gerek kalmadan tamamen görsel editörde yapılabilir |
| Phase 3 | Vue 3 göçü tamamlandıktan sonra tüm mevcut özellikler aynı davranışı korur; ses senkronize render çalışır |

---

## 5. Yol Haritası Ötesi — Kalite Dalgaları (2026-06)

Orijinal 3 faz bittikten sonra, planda olmayan kapsamlı bir iş ve üç "kalite/güven dalgası" eklendi:

- **Wave 1** — showcase şablonları, ek export formatları, içerik nesneleri (`code`/`bar_chart`), UX paketi (lock/hide, marquee, context menu, autosave).
- **Wave 2** — editör cilası (inline text edit, numeric scrub, recent colors), timeline yapısı (split clip, sahne bölümleri/`next_section`), hassas yerleşim (cetvel/guide/smart-snap), kalite (elastic/bounce easing, render geçmişi).
- **Wave 3 — kalite & güven** *(post-Wave-2 analizinde "eksikler özellik değil, doğrulama tarafında" tespitiyle)*:
  - **Render-truth harness** — üretilen Python'un gerçek Manim CE'de *çalıştığını* doğrular (yalnızca AST-geçerli olduğunu değil); opt-in `npm run test:render`.
  - **Golden-frame regression** — render çıktısını dHash baseline'a karşı izler (istemsiz sapma koruması).
  - **Round-trip dayanıklılığı** — `next_section` geri-okuma + parser çok-satır constructor desteği.
- **Wave 4 — workflow & scale follow-up** — komut paleti/nesne arama, grid-aware smart snapping, `vector_field` virgül round-trip düzeltmesi ve render harness'in non-blocking CI job'u.

Yapısal olarak ayrıca: **strict TypeScript göçü** (tüm kod tabanı), mimari ayrıştırma (StageCanvas/PropertiesPanel/Topbar + paylaşılan `@manim/codegen` paketi), güvenlik sertleştirmesi (path-traversal guard'ları), performans (bundle 1.7MB → ~800kB).

**Kalan açık backlog** *(düşük öncelik)*: yok.
