# Manim Motion Editor Ã¢â‚¬â€ GeliÃ…Å¸tirme Yol HaritasÃ„Â±

**Tarih:** 2026-06-02
**Kapsam:** Mevcut ÃƒÂ¶zelliklerin analizi, eksik Manim CE kapasitelerinin tespiti ve ÃƒÂ¶nceliklendirilmiÃ…Å¸ geliÃ…Å¸tirme planÃ„Â±
**YaklaÃ…Å¸Ã„Â±m:** Etki/Maliyet matrisi + aÃ…Å¸amalÃ„Â± uygulama planÃ„Â± (Hibrit)
**Son gÃƒÂ¼ncelleme:** 2026-06-28 Ã¢â‚¬â€ yol haritasÃ„Â± bÃƒÂ¼yÃƒÂ¼k ÃƒÂ¶lÃƒÂ§ÃƒÂ¼de tamamlandÃ„Â± (bkz. Ã‚Â§0)

---

## 0. Durum (2026-06-24)

**Bu yol haritasÃ„Â± bÃƒÂ¼yÃƒÂ¼k ÃƒÂ¶lÃƒÂ§ÃƒÂ¼de tamamlandÃ„Â±.** Orijinal 3 fazÃ„Â±n 14 ana maddesinin **tamamÃ„Â±** teslim edildi; paralel render worker da `renderer-2` servisiyle kapatÃ„Â±ldÃ„Â±. ÃƒÅ“stÃƒÂ¼ne, planda hiÃƒÂ§ olmayan kapsamlÃ„Â± iÃ…Å¸ eklendi: strict TypeScript gÃƒÂ¶ÃƒÂ§ÃƒÂ¼, nesne tipleri 17 Ã¢â€ â€™ ~58, 2D efektler + emphasis animasyonlarÃ„Â±, export formatlarÃ„Â± (MP4/GIF/WebM/PNG/WebM-ÃÂ±) ve ÃƒÂ¼ÃƒÂ§ kalite dalgasÃ„Â± (bkz. Ã‚Â§5).

| Faz | Durum |
|---|---|
| Phase 1 Ã¢â‚¬â€ HÃ„Â±zlÃ„Â± KazanÃ„Â±mlar | Ã¢Å“â€¦ easing Ã‚Â· WebSocket render Ã‚Â· Vitest altyapÃ„Â±sÃ„Â± Ã‚Â· Ã…Å¸ablonlar Ã‚Â· render geÃƒÂ§miÃ…Å¸i Ã‚Â· paralel render worker |
| Phase 2 Ã¢â‚¬â€ YÃƒÂ¼ksek DeÃ„Å¸er | Ã¢Å“â€¦ grafik/NumberPlane Ã‚Â· AnimationGroup/LaggedStart Ã‚Â· path Ã‚Â· kamera |
| Phase 3 Ã¢â‚¬â€ Uzun Vadeli | Ã¢Å“â€¦ ses/voiceover Ã‚Â· Vue 3 gÃƒÂ¶ÃƒÂ§ÃƒÂ¼ Ã‚Â· keyframe sistemi Ã‚Â· 3D sahne |

GÃƒÂ¼ncel sÃƒÂ¼rÃƒÂ¼m **v3.27.0** Ã‚Â· 760 web unit + 122 engine + 55 api + 15 codegen + 17 e2e Ã‚Â· strict TypeScript Ã‚Â· tÃƒÂ¼m CI kapÃ„Â±larÃ„Â± yeÃ…Å¸il.

---

## 1. Mevcut Durum *(2026-06-02 baÃ…Å¸langÃ„Â±ÃƒÂ§ durumu Ã¢â‚¬â€ tarihsel)*

Manim Motion Editor v1.1.0, 4 Docker servisinden oluÃ…Å¸an (Vue 2.7 frontend, Node.js API, Python Manim worker, Redis) bir animasyon editÃƒÂ¶rÃƒÂ¼dÃƒÂ¼r. Temel ÃƒÂ¶zellikler ÃƒÂ§alÃ„Â±Ã…Å¸maktadÃ„Â±r: 17 Ã…Å¸ekil tipi, 5 klip tipi, 11 giriÃ…Å¸ + 9 ÃƒÂ§Ã„Â±kÃ„Â±Ã…Å¸ animasyonu, undo/redo, ÃƒÂ§ift editÃƒÂ¶r modu (Visual + Code-Only), server-side render (480pÃ¢â‚¬â€œ4K).

---

## 2. Etki/Maliyet Matrisi

Efor etiketleri: **S** (1Ã¢â‚¬â€œ3 gÃƒÂ¼n) Ã‚Â· **M** (1Ã¢â‚¬â€œ2 hafta) Ã‚Â· **L** (2Ã¢â‚¬â€œ4 hafta) Ã‚Â· **XL** (1Ã¢â‚¬â€œ3 ay)

### HÃ„Â±zlÃ„Â± KazanÃ„Â±mlar (YÃƒÂ¼ksek Etki, DÃƒÂ¼Ã…Å¸ÃƒÂ¼k Maliyet)

| Madde | GerekÃƒÂ§e | Efor |
|---|---|---|
| Easing mapping dÃƒÂ¼zeltmeleri | `springÃ¢â€ â€™smooth`, `ease_in_out_cubicÃ¢â€ â€™smooth` gibi yanlÃ„Â±Ã…Å¸ eÃ…Å¸lemeler render/ÃƒÂ¶nizleme uyumsuzluÃ„Å¸una yol aÃƒÂ§Ã„Â±yor; `codegen.js` ve `easing.js`'te lokal deÃ„Å¸iÃ…Å¸iklik | S |
| WebSocket render takibi | 2 saniyelik polling kaldÃ„Â±rÃ„Â±lÃ„Â±r, render durumu anlÃ„Â±k push ile iletilir; `queue.js` + frontend `RenderPanel.vue` | S |
| UI bileÃ…Å¸en test altyapÃ„Â±sÃ„Â± | YalnÃ„Â±zca engine mantÃ„Â±Ã„Å¸Ã„Â± test ediliyor; Vue bileÃ…Å¸enlerini kapsayan Vitest/Vue Test Utils altyapÃ„Â±sÃ„Â± kurulur | S |
| Template/preset kÃƒÂ¼tÃƒÂ¼phanesi | HazÃ„Â±r JSON sahneleri (teorem aÃƒÂ§Ã„Â±klama, grafik dÃƒÂ¶nÃƒÂ¼Ã…Å¸ÃƒÂ¼mÃƒÂ¼, formÃƒÂ¼l tanÃ„Â±tÃ„Â±mÃ„Â± vb.) + "Yeni Proje" diyaloÃ„Å¸una Ã…Å¸ablon seÃƒÂ§ici UI | M |

### BÃƒÂ¼yÃƒÂ¼k Bahisler (YÃƒÂ¼ksek Etki, YÃƒÂ¼ksek Maliyet)

| Madde | GerekÃƒÂ§e | Efor |
|---|---|---|
| Fonksiyon grafiÃ„Å¸i / NumberPlane | `Axes` nesnesi altyapÃ„Â±sÃ„Â± mevcut; ÃƒÂ¼zerine `plot(lambda x: ...)`, `NumberPlane`, `NumberLine` desteÃ„Å¸i eklenir; Inspector'a eÃ„Å¸ri tanÃ„Â±mlama UI'Ã„Â± | L |
| AnimationGroup / LaggedStart | Paralel ve gecikmeli animasyon gruplarÃ„Â±; timeline klip sistemi paralel yÃƒÂ¼rÃƒÂ¼tmeyi destekleyecek Ã…Å¸ekilde geniÃ…Å¸ler; codegen'de `AnimationGroup`/`LaggedStart` ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â± | L |
| Path animasyonu (MoveAlongPath) | Bezier/yay eÃ„Å¸risi boyunca hareket; yeni klip tipi `path_move`; canvas'ta eÃ„Å¸ri ÃƒÂ§izim aracÃ„Â±; `MoveAlongPath` codegen | M |
| Kamera animasyonlarÃ„Â± | Yeni `camera` kavramÃ„Â± editÃƒÂ¶re eklenir; `MovingCameraScene` desteÃ„Å¸i; timeline'da kamera klibi; zoom/pan/focus codegen | M |
| Ses / seslendirme | `manim-voiceover` entegrasyonu; timeline'a ses parÃƒÂ§asÃ„Â±; senkronizasyon arayÃƒÂ¼zÃƒÂ¼; renderer'da ffmpeg ses birleÃ…Å¸tirme | L |

### Dolgu (DÃƒÂ¼Ã…Å¸ÃƒÂ¼k Etki, DÃƒÂ¼Ã…Å¸ÃƒÂ¼k Maliyet)

| Madde | GerekÃƒÂ§e | Efor |
|---|---|---|
| Paralel render worker | `docker-compose.yml`'de ikinci renderer servisi; Redis kuyruÃ„Å¸u zaten destekliyor | S |
| Render geÃƒÂ§miÃ…Å¸i | Proje baÃ…Å¸Ã„Â±na son N render'Ã„Â± listele; mevcut `latest.mp4` dosyalanÃ„Â±r | S |

### DÃƒÂ¼Ã…Å¸ÃƒÂ¼k Ãƒâ€“ncelik (DÃƒÂ¼Ã…Å¸ÃƒÂ¼k Etki, YÃƒÂ¼ksek Maliyet)

| Madde | GerekÃƒÂ§e | Efor |
|---|---|---|
| Vue 2 Ã¢â€ â€™ Vue 3 gÃƒÂ¶ÃƒÂ§ÃƒÂ¼ | Vue 2 EOL AralÃ„Â±k 2023; tÃƒÂ¼m bileÃ…Å¸enleri etkileyen kapsamlÃ„Â± yeniden yazÃ„Â±m | XL |
| Keyframe animasyon sistemi | Mevcut klip sistemi ÃƒÂ§oÃ„Å¸u senaryoyu karÃ…Å¸Ã„Â±lÃ„Â±yor; ÃƒÂ¶zellik bazlÃ„Â± keyframe bÃƒÂ¼yÃƒÂ¼k mimari deÃ„Å¸iÃ…Å¸iklik gerektirir | XL |
| 3D sahne desteÃ„Å¸i | `ThreeDScene` Code-Only modda eriÃ…Å¸ilebilir; gÃƒÂ¶rsel editÃƒÂ¶re entegrasyon ÃƒÂ§ok karmaÃ…Å¸Ã„Â±k | XL |

---

## 3. AÃ…Å¸amalÃ„Â± Uygulama PlanÃ„Â±

### Phase 1 Ã¢â‚¬â€ HÃ„Â±zlÃ„Â± KazanÃ„Â±mlar Ã¢Å“â€¦ *(tamamlandÃ„Â±)*

**Hedef:** Mevcut hatalarÃ„Â± gider, geliÃ…Å¸tirme zeminini hazÃ„Â±rla, yeni kullanÃ„Â±cÃ„Â± deneyimini iyileÃ…Å¸tir.

1. **Easing mapping dÃƒÂ¼zeltmeleri**
   - `services/api/src/compiler/codegen.js` iÃƒÂ§indeki `EASING_MAP` gÃƒÂ¼ncellenir
   - `services/web/src/engine/easing.js` ÃƒÂ¶nizleme fonksiyonlarÃ„Â± dÃƒÂ¼zeltilir
   - Render ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â± ile canvas ÃƒÂ¶nizlemesi arasÃ„Â±ndaki gÃƒÂ¶rsel fark giderilir

2. **WebSocket render takibi**
   - `services/api/src/queue.js` Ã¢â€ â€™ `socket.io` veya native WebSocket ile job olaylarÃ„Â± yayÃ„Â±nlanÃ„Â±r
   - `services/web/src/components/render/RenderPanel.vue` Ã¢â€ â€™ polling kaldÃ„Â±rÃ„Â±lÃ„Â±r, socket dinleyici eklenir

3. **UI bileÃ…Å¸en test altyapÃ„Â±sÃ„Â±**
   - `services/web/` altÃ„Â±na Vitest + Vue Test Utils kurulur
   - Kritik bileÃ…Å¸enler iÃƒÂ§in ilk test dosyalarÃ„Â± oluÃ…Å¸turulur: `StageCanvas`, `Timeline`, `Inspector`

4. **Template/preset kÃƒÂ¼tÃƒÂ¼phanesi**
   - `services/web/src/templates/` dizininde JSON sahneleri (en az 5 Ã…Å¸ablon)
   - `App.vue` "Yeni Proje" diyaloÃ„Å¸una Ã…Å¸ablon seÃƒÂ§ici eklenir
   - Ã…Âablonlar: Teorem aÃƒÂ§Ã„Â±klama, Fonksiyon grafiÃ„Å¸i taslaÃ„Å¸Ã„Â±, FormÃƒÂ¼l tanÃ„Â±tÃ„Â±mÃ„Â±, VektÃƒÂ¶r diyagramÃ„Â±, Sunu baÃ…Å¸lÃ„Â±Ã„Å¸Ã„Â±

5. **Paralel render worker** Ã¢Å“â€¦
   - `docker-compose.yml`'de `renderer-2` servisi (aynÃ„Â± image, aynÃ„Â± Redis kuyruÃ„Å¸u)
   - Mevcut iÃ…Å¸ akÃ„Â±Ã…Å¸Ã„Â±na dokunmaz; iki job aynÃ„Â± anda iÃ…Å¸lenebilir

6. **Render geÃƒÂ§miÃ…Å¸i**
   - Proje baÃ…Å¸Ã„Â±na son 5 render dosyalanÃ„Â±r (`render_1.mp4`, `render_2.mp4`...)
   - `RenderPanel.vue`'ya geÃƒÂ§miÃ…Å¸ listesi eklenir

### Phase 2 Ã¢â‚¬â€ YÃƒÂ¼ksek DeÃ„Å¸er Ãƒâ€“zellikler Ã¢Å“â€¦ *(tamamlandÃ„Â±)*

**Hedef:** Manim'in temel matematiksel yeteneklerini gÃƒÂ¶rsel editÃƒÂ¶re taÃ…Å¸Ã„Â±.

1. **Fonksiyon grafiÃ„Å¸i / NumberPlane**
   - Mevcut `axes` nesne tipini geniÃ…Å¸let; ÃƒÂ¼zerine `graph` alt-nesnesi eklenir
   - Inspector'a lambda ifadesi giriÃ…Å¸ alanÃ„Â±
   - `codegen.js`'te `axes.plot(lambda x: ...)` ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â±
   - `NumberPlane`, `NumberLine`, `PolarPlane` yeni Ã…Å¸ekil tipleri olarak eklenir

2. **AnimationGroup / LaggedStart**
   - Timeline'da kliplerin "paralel" veya "sÃ„Â±ralÃ„Â±" moduna geÃƒÂ§iÃ…Å¸
   - Yeni klip ÃƒÂ¶zelliÃ„Å¸i: `parallel: true`, `lag_ratio: float`
   - `codegen.js`'te `AnimationGroup(...)` ve `LaggedStart(...)` ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â±

3. **Path animasyonu (MoveAlongPath)**
   - Yeni klip tipi: `path_move`
   - Canvas'ta Bezier eÃ„Å¸risi ÃƒÂ§izim aracÃ„Â± (Konva path)
   - `codegen.js`'te `MoveAlongPath(obj, path)` ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â±

4. **Kamera animasyonlarÃ„Â±**
   - Proje sahnesine `cameraType: 'moving' | 'static'` alanÃ„Â±
   - Timeline'da `camera` parÃƒÂ§asÃ„Â±; zoom/pan klibi
   - `codegen.js`'te `MovingCameraScene` + `self.camera.frame.animate.move_to(...)` ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â±

5. ~~Paralel render worker~~ *(Phase 1'e taÃ…Å¸Ã„Â±ndÃ„Â±)*

### Phase 3 Ã¢â‚¬â€ Uzun Vadeli Yeniden YapÃ„Â±landÃ„Â±rma Ã¢Å“â€¦ *(tamamlandÃ„Â±)*

**Hedef:** Teknik borcu ÃƒÂ¶de, ekosistemin geri kalanÃ„Â±nÃ„Â± kapat.

1. **Ses / seslendirme (manim-voiceover)**
   - Renderer Docker image'Ã„Â±na `manim-voiceover` + `ffmpeg` eklenir
   - Timeline'a audio parÃƒÂ§asÃ„Â±; ses dosyasÃ„Â± yÃƒÂ¼kleme
   - Zaman senkronizasyonu: ses sÃƒÂ¼resine gÃƒÂ¶re sahne uzatma
   - `codegen.js`'te `VoiceoverScene` ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â±

2. **Vue 2 Ã¢â€ â€™ Vue 3 gÃƒÂ¶ÃƒÂ§ÃƒÂ¼**
   - `Vue.observable` Ã¢â€ â€™ `reactive`/`ref` (Composition API)
   - `Vue.set` kaldÃ„Â±rÃ„Â±lÃ„Â±r (Vue 3'te gerekmiyor)
   - TÃƒÂ¼m bileÃ…Å¸enler Options API Ã¢â€ â€™ Composition API'ye taÃ…Å¸Ã„Â±nÃ„Â±r
   - Vite zaten kullanÃ„Â±lÃ„Â±yor; build sistemi deÃ„Å¸iÃ…Å¸mez

3. **Keyframe animasyon sistemi**
   - Mevcut clip modeli korunur; ÃƒÂ¼zerine per-property keyframe katmanÃ„Â± eklenir
   - Timeline'da keyframe noktalarÃ„Â±; eÃ„Å¸ri editÃƒÂ¶rÃƒÂ¼ (Bezier handle)
   - Playback engine gÃƒÂ¼ncellenir: klip + keyframe interpolasyon birleÃ…Å¸tirilir

4. **3D sahne desteÃ„Å¸i**
   - Proje tipine `sceneType: '2d' | '3d'` eklenir
   - `ThreeDScene` iÃƒÂ§in kamera aÃƒÂ§Ã„Â±sÃ„Â± kontrolÃƒÂ¼ (phi, theta, zoom)
   - Mevcut 2D Ã…Å¸ekillerin 3D koordinatlara dÃƒÂ¶nÃƒÂ¼Ã…Å¸tÃƒÂ¼rÃƒÂ¼lmesi

---

## 4. BaÃ…Å¸arÃ„Â± Kriterleri

| Phase | Kriter |
|---|---|
| Phase 1 | Render ÃƒÂ¶nizleme uyumu %100; yeni kullanÃ„Â±cÃ„Â± Ã…Å¸ablon ile 5 dakikada ilk renderÃ„Â± alÃ„Â±r |
| Phase 2 | Matematik iÃƒÂ§erikli bir eÃ„Å¸itim videosu Code-Only moda gerek kalmadan tamamen gÃƒÂ¶rsel editÃƒÂ¶rde yapÃ„Â±labilir |
| Phase 3 | Vue 3 gÃƒÂ¶ÃƒÂ§ÃƒÂ¼ tamamlandÃ„Â±ktan sonra tÃƒÂ¼m mevcut ÃƒÂ¶zellikler aynÃ„Â± davranÃ„Â±Ã…Å¸Ã„Â± korur; ses senkronize render ÃƒÂ§alÃ„Â±Ã…Å¸Ã„Â±r |

---

## 5. Yol HaritasÃ„Â± Ãƒâ€“tesi Ã¢â‚¬â€ Kalite DalgalarÃ„Â± (2026-06)

Orijinal 3 faz bittikten sonra, planda olmayan kapsamlÃ„Â± bir iÃ…Å¸ ve ÃƒÂ¼ÃƒÂ§ "kalite/gÃƒÂ¼ven dalgasÃ„Â±" eklendi:

- **Wave 1** Ã¢â‚¬â€ showcase Ã…Å¸ablonlarÃ„Â±, ek export formatlarÃ„Â±, iÃƒÂ§erik nesneleri (`code`/`bar_chart`), UX paketi (lock/hide, marquee, context menu, autosave).
- **Wave 2** Ã¢â‚¬â€ editÃƒÂ¶r cilasÃ„Â± (inline text edit, numeric scrub, recent colors), timeline yapÃ„Â±sÃ„Â± (split clip, sahne bÃƒÂ¶lÃƒÂ¼mleri/`next_section`), hassas yerleÃ…Å¸im (cetvel/guide/smart-snap), kalite (elastic/bounce easing, render geÃƒÂ§miÃ…Å¸i).
- **Wave 3 Ã¢â‚¬â€ kalite & gÃƒÂ¼ven** *(post-Wave-2 analizinde "eksikler ÃƒÂ¶zellik deÃ„Å¸il, doÃ„Å¸rulama tarafÃ„Â±nda" tespitiyle)*:
  - **Render-truth harness** Ã¢â‚¬â€ ÃƒÂ¼retilen Python'un gerÃƒÂ§ek Manim CE'de *ÃƒÂ§alÃ„Â±Ã…Å¸tÃ„Â±Ã„Å¸Ã„Â±nÃ„Â±* doÃ„Å¸rular (yalnÃ„Â±zca AST-geÃƒÂ§erli olduÃ„Å¸unu deÃ„Å¸il); opt-in `npm run test:render`.
  - **Golden-frame regression** Ã¢â‚¬â€ render ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â±nÃ„Â± dHash baseline'a karÃ…Å¸Ã„Â± izler (istemsiz sapma korumasÃ„Â±).
  - **Round-trip dayanÃ„Â±klÃ„Â±lÃ„Â±Ã„Å¸Ã„Â±** Ã¢â‚¬â€ `next_section` geri-okuma + parser ÃƒÂ§ok-satÃ„Â±r constructor desteÃ„Å¸i.
- **Wave 4 Ã¢â‚¬â€ workflow & scale follow-up** Ã¢â‚¬â€ komut paleti/nesne arama, grid-aware smart snapping, `vector_field` virgÃƒÂ¼l round-trip dÃƒÂ¼zeltmesi ve render harness'in non-blocking CI job'u.

YapÃ„Â±sal olarak ayrÃ„Â±ca: **strict TypeScript gÃƒÂ¶ÃƒÂ§ÃƒÂ¼** (tÃƒÂ¼m kod tabanÃ„Â±), mimari ayrÃ„Â±Ã…Å¸tÃ„Â±rma (StageCanvas/PropertiesPanel/Topbar + paylaÃ…Å¸Ã„Â±lan `@manim/codegen` paketi), gÃƒÂ¼venlik sertleÃ…Å¸tirmesi (path-traversal guard'larÃ„Â±), performans (bundle 1.7MB Ã¢â€ â€™ ~800kB).

**Kalan aÃƒÂ§Ã„Â±k backlog** *(dÃƒÂ¼Ã…Å¸ÃƒÂ¼k ÃƒÂ¶ncelik)*: yok.

---

## 6. Son Durum Notu (2026-06-29)
- Next production-readiness roadmap: `docs/superpowers/specs/2026-06-29-production-readiness-roadmap.md`.
- README ve e2e kapsamÄ±, tÃ¼m shape kartlarÄ± ile type-specific inspector panellerini kapsayacak ÅŸekilde gÃ¼ncellendi.
- Render akÄ±ÅŸÄ± gerÃ§ek tarayÄ±cÄ± smokenÄ±nda `Render complete!` seviyesine kadar doÄŸrulandÄ±.
- Render dialog now surfaces live queue depth before submission; the API route and queue stats test are in place.
- `start.bat` ile full stack varsayÄ±lan olarak `http://localhost:8758` Ã¼zerinden aÃ§Ä±lÄ±yor.
- Renderer image'Ä±na eksik `history.py` ve `sox` baÄŸÄ±mlÄ±lÄ±klarÄ± eklendi; worker kuyruÄŸu bu eksikle takÄ±lmÄ±yor.
- Son e2e koÅŸusunda 24 Chromium testi yeÅŸil kaldÄ±.
