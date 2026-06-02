# Manim Motion Editor — Teknik Borç Temizliği + Phase 2

**Tarih:** 2026-06-02
**Kapsam:** 3 teknik borç + Phase 2'nin 4 yüksek değerli özelliği
**Yaklaşım:** İki dalgalı paralel (subagent-driven)

---

## 1. Genel Strateji

İki ardışık dalga:

- **Dalga 1** — 3 teknik borç paralel subagentlarla temizlenir. Tamamlanınca Dalga 2 başlar.
- **Dalga 2** — Phase 2'nin 4 özelliği paralel subagentlarla uygulanır.

Subagentlar bağımsız dosya kümelerine dokunduğundan merge konfliktleri minimumdur. `codegen.js`'te her özellik kendi `switch` case'ine yazıldığından çakışma riski düşüktür.

---

## 2. Dalga 1 — Teknik Borçlar

### Borç 1: RenderPanel.vue elements → objects

**Dosya:** `services/web/src/components/render/RenderPanel.vue:93`

**Sorun:** `hasElements` computed property'si `store.project.elements` kullanıyor; doğrusu `store.project.objects`. `elements` undefined olduğundan "Render Video" butonu her zaman devre dışı kalıyor.

**Düzeltme:**
```js
// Mevcut (yanlış)
hasElements() { return store.project.elements.length > 0; }

// Düzeltilmiş
hasElements() { return store.project.objects.length > 0; }
```

---

### Borç 2: api.js renders.list / renders.getInfo tekrarı

**Dosya:** `services/web/src/api.js`

**Sorun:** `renders.getInfo(projectId)` ve `renders.list(projectId)` aynı endpoint'i (`/renders/:id`) çağırıyor. `RenderPanel.vue` bu metodlar yerine doğrudan `fetch()` kullanıyor.

**Düzeltme:**
- `renders.list` kaldırılır; `renders.getInfo` tek metod olarak kalır
- `RenderPanel.vue` doğrudan fetch çağrıları `renders.getInfo` ile değiştirilir
- Tüm çağrı noktaları taranıp `list` referansları güncellenir

---

### Borç 3: templates/index.js uid() uyumsuzluğu

**Dosya:** `services/web/src/templates/index.js`

**Sorun:** Yerel `uid()` `Math.random()` tabanlı (çarpışma riskli); store'daki `uid()` ise `Date.now() + counter` tabanlı (monoton, güvenli). Şablon nesneleri farklı ID formatı üretiyor (`obj_tpl_abc123` vs `obj_1234abcd_1`).

**Düzeltme:**
- Yerel `uid()` kaldırılır
- `store/project.js`'ten `uid` import edilir
- Tüm şablon nesneleri store'un `uid()` ile oluşturulur

---

## 3. Dalga 2 — Phase 2 Özellikleri

### Özellik 1: Fonksiyon Grafiği / NumberPlane

**Etkilenen dosyalar:**
- `store/project.js` — `axes` nesnesine `graphs: []` alt-alanı; `SHAPE_DEFAULTS`'a `numberplane`, `numberline` tipleri
- `services/web/src/components/inspector/` — axes seçiliyken lambda ifadesi giriş alanı (`f(x) = x**2`); renk, aralık (x_min/x_max) ayarı
- `services/api/src/compiler/codegen.js` — yeni case'ler:
  - `axes` case genişler: `graphs` dizisini iterate edip `ax.plot(lambda x: ...)` çıktısı
  - `numberplane` case: `NumberPlane(x_range=..., y_range=...)`
  - `numberline` case: `NumberLine(x_range=...)`
- `services/web/src/engine/geometry.js` — canvas önizlemesinde grafik eğrisi (SVG polyline yaklaşımı)
- `services/web/src/components/stage/StageSvg.vue` — axes seçiliyken grafik çizimi

**Başarı kriteri:** Inspector'da `f(x) = x**2` girilip render alındığında videonun doğru parabolu göstermesi; canvas önizlemesinde yaklaşık eğri görünmesi.

---

### Özellik 2: AnimationGroup / LaggedStart

**Etkilenen dosyalar:**
- `store/project.js` — clip şemasına `parallel: bool` (varsayılan `false`) ve `lag_ratio: float` (varsayılan `0`) alanları
- `services/web/src/components/timeline/TimelineClip.vue` — paralel klipleri aynı satırda yan yana göster; `lag_ratio` girişi
- `services/web/src/components/timeline/TimelineTrack.vue` — paralel klip grubunu görsel olarak ayırt et (arka plan rengi)
- `services/web/src/engine/playback.js` — paralel klipler için grup değerlendirmesi: aynı `t_start`'a sahip `parallel: true` klipleri eş zamanlı işle; `lag_ratio` uygulaması
- `services/api/src/compiler/codegen.js` — paralel klipler `AnimationGroup(...)`, `lag_ratio > 0` ise `LaggedStart(..., lag_ratio=x)` çıktısı

**Başarı kriteri:** İki nesnenin aynı anda veya küçük gecikmeyle hareket ettiği bir sahne Code-Only moda gerek kalmadan visual editörde yapılabilir.

---

### Özellik 3: Path Animasyonu (MoveAlongPath)

**Etkilenen dosyalar:**
- `store/project.js` — yeni klip tipi `path_move`; şema: `{ type: 'path_move', objectId, path: [{x,y}], duration, easing }`
- `services/web/src/components/stage/StageCanvas.vue` — yeni araç: "Path Draw"; tıkla-sürükle Bezier noktaları (Konva.Line); oluşturulan path `path_move` klibi olarak kayıt
- `services/web/src/engine/playback.js` — `path_move` klip tipi: path'teki noktaları `t`'ye göre interpolasyon ile nesneyi konumlandır
- `services/api/src/compiler/codegen.js` — path noktalarından `VMobject` oluşturma + `MoveAlongPath(obj, path)` çıktısı
- `services/web/src/components/inspector/AnimationPanel.vue` — `path_move` seçiliyken path noktalarını tablo olarak göster; düzenleme imkânı

**Başarı kriteri:** Kullanıcı canvas'ta bir eğri çizip nesneyi o eğri boyunca hareket ettirebilir; rendered videoda `MoveAlongPath` çalışır.

---

### Özellik 4: Kamera Animasyonları

**Etkilenen dosyalar:**
- `store/project.js` — projeye `cameraType: 'static' | 'moving'` (varsayılan `'static'`); yeni klip tipi `camera_move`: `{ type: 'camera_move', target: {x,y}, zoom: float, duration, easing }`
- `services/web/src/components/timeline/Timeline.vue` — `cameraType === 'moving'` ise "Camera" parçası göster; `camera_move` kliplerini buraya ekle
- `services/web/src/components/inspector/` — kamera klibi seçiliyken target (x, y) ve zoom alanları
- `services/web/src/engine/playback.js` — `camera_move` klibi: canvas viewport transform ile pan/zoom önizlemesi
- `services/api/src/compiler/codegen.js` — `cameraType === 'moving'` ise `class Scene(MovingCameraScene)` çıktısı; `camera_move` klipleri için `self.camera.frame.animate.move_to(x*RIGHT + y*UP).scale(zoom)` çıktısı
- `services/web/src/components/toolbar/Topbar.vue` — "Kamera" toggle butonu veya proje ayarları

**Başarı kriteri:** Kamera animate modu aktifken zoom + pan içeren bir sahne rendered videoda doğru çalışır.

---

## 4. Bağımlılık ve Risk Analizi

### Dalga 1 bağımsızlığı
- Borç 1, 2, 3 tamamen farklı dosyalar → gerçek paralel çalışma mümkün

### Dalga 2 bağımlılıkları
- Tüm özellikler `codegen.js`'e dokunur — her biri farklı `case` bloğu ekler, çakışma riski düşük
- `playback.js`'e Özellik 2 ve 3 dokunur — farklı klip tipleri, minimal çakışma
- `store/project.js`'e tüm özellikler dokunur — her biri farklı `SHAPE_DEFAULTS` veya clip şeması alanı

### Merge stratejisi
Her subagent kendi branch'inde çalışır (`feature/debt-*`, `feature/phase2-*`). Dalga 2 subagentları Dalga 1 tamamlandıktan sonra main'den fork alır.

---

## 5. Başarı Kriterleri

| Dalga | Kriter |
|---|---|
| Dalga 1 | 3 borç giderildi; `npm run test:unit` + 89 engine testi geçiyor; render butonu çalışıyor |
| Dalga 2 | Phase 2'nin 4 özelliği çalışıyor; matematik içerikli bir sahne Code-Only moda gerek kalmadan visual editörde yapılabiliyor |
