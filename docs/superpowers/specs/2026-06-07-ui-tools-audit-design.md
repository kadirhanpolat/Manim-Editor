# UI Araç Denetimi (UI Tools Audit) — 2026-06-07

## Amaç

Editördeki **tüm UI araçlarını tek tek** doğrulamak: her aracın zinciri
(ekleme UI → store default → canvas preview → inspector → codegen → round-trip)
doğru davranıyor mu? Hiçbir tip atlanmadan.

Yöntem (kullanıcı onayı): **1 → 3 → 2**
1. Kod denetimi + mevcut testler (baseline + bulgular)
2. Eksik unit testleri yaz (otomatik "her aracı dene")
3. Playwright E2E (gerçek tarayıcıda her butona tıkla)

## Baseline

- Engine: 114/114 ✅
- Unit (Vitest): 495/495 ✅
- `python -m ast` codegen-validity testi: 6/6 ✅ (Python PATH'te)

## UI Araç Envanteri

| Yüzey | Araçlar |
|-------|---------|
| **AssetSidebar — Shapes** | rectangle, square, circle, ellipse, triangle, star, polygon, polygon_free, bezier, arrow, heart, line, ray, dot, dot_grid, latex, axes, annulus, arc, sector, double_arrow, parametric, matrix, brace, angle |
| **AssetSidebar — Data & Coordinates** | table, complex_plane, polar_plane, graph, vector_field, vector_components, coord_point |
| **AssetSidebar — 3D Shapes** | sphere, cube, prism, cone, cylinder, torus, axes3d, surface |
| **AssetSidebar — Text / Assets** | text, image (upload), svg_asset (upload) |
| **Toolbar — Tools** | select, hand, scale, rotate |
| **Toolbar — Shapes** | heart, square, circle, dot, dot_grid |
| **Toolbar — 3D** | sphere, cube, cone, cylinder, torus, axes3d |
| **Toolbar — Transform** | 2 nesne seçiliyken morph |
| **MotionPicker (clip ekleme)** | move, scale, fade, rotate, indicate, flash, wiggle, circumscribe, focus_on, count (yalnız counter) |
| **Canvas** | path çizimi (path_move), sürükle-taşı, transform handle, vertex handle |
| **Topbar menüleri** | File/Edit/View/Tools/Help |
| **Inspector panelleri** | Layout, Style, Timing, Animation, Audio, Keyframe, Position3D, Effects + per-type settings |
| **Timeline** | clip, kamera track, keyframe lane, easing popup |

## Bulgular (Yöntem 1 — kod denetimi)

### F1 — `counter` nesnesi UI'dan eklenemiyor (BUG)
- Tam destek var: store default (`value/numDecimals/suffix/useInteger`), codegen
  (`case 'counter'` → `DecimalNumber`/`Integer`), preview (`counterCfg`), inspector
  (`CounterSettings`), MotionPicker `count` butonu.
- **Ama hiçbir palette'te (AssetSidebar / Toolbar) ekleme butonu yok.** Git geçmişi:
  hiç eklenmemiş (kasıtlı kaldırma değil, atlanmış).
- Sonuç: `count` clip özelliği (`createCount`, "Select 1 counter to animate")
  pratikte erişilemez — counter nesnesi olmadan count clip oluşturulamıyor.
- **Düzeltme:** AssetSidebar "Data & Coordinates" grubuna `counter` butonu ekle.

### F2 — (GEÇERSİZ) Toolbar 3D listesi eksik → aslında F6
- İlk denetimde "Toolbar `shapes3D` prism/surface içermiyor" sanıldı ve eklendi.
- Sonra E2E ile görüldü ki **`Toolbar.vue` hiç mount edilmiyor** (bkz. F6).
  Düzeltme ölü bileşene yapılmış olurdu → **geri alındı.** Gerçek palette
  (AssetSidebar) zaten prism + surface dahil 8 3D tipini sunuyor.

### F3 — `numberplane` UI'dan eklenemiyor (BUG)
- Tam destek: store default, codegen (`case 'numberplane'` → `NumberPlane`),
  inspector (registry `numberplane → PlaneRangeSettings`).
- Palette'te yok (yalnız `complex_plane`/`polar_plane` var).
- **Düzeltme:** AssetSidebar "Data & Coordinates" grubuna `numberplane` butonu ekle.

### F4 — `numberline` yarım (import-only) → ÇÖZÜLDÜ
- store default (`xRange`) + codegen (`NumberLine`) + canvas preview + parser
  round-trip zaten vardı; eksik olan **inspector + palette** idi.
- **Çözüm:** `NumberLineSettings.vue` eklendi (X Min/Max/Step + Length), registry'e
  kaydedildi (`numberline → NumberLineSettings`), AssetSidebar "Data & Coordinates"e
  `numberline` butonu eklendi. Artık tam erişilebilir/düzenlenebilir.
  Test: `object-settings.test.js` (NumberLineSettings) + audit reachability.

### F5 — stage-configs karakterizasyon testinde stderr gürültüsü (kozmetik)
- `text config is stable` testinde bir hata stack'i stderr'e basılıyor ama test
  geçiyor (jsdom/Konva ölçüm uyarısı). İşlevsel etki yok; not edildi.

### F6 — `Toolbar.vue` mount edilmeyen ölü kod (E2E ile bulundu)
- App.vue yalnızca `AssetSidebar`'ı render ediyor; `Toolbar.vue` hiçbir yerde
  import edilmiyor (yalnız testlerde). İçindeki select/hand/scale/rotate araç
  butonları + hızlı şekiller canlı UI'da görünmüyor.
- Etkileşim araçları gerçekte **klavye kısayollarıyla** set ediliyor: `V`=select,
  `H`=hand (App.vue `handleKeydown`). **`scale`/`rotate` activeTool modlarının
  canlı UI'da erişilebilir bir tetikleyicisi yok** (yalnız ölü Toolbar'daydı);
  scale/rotate pratikte transform handle'ları + Motion clip'leri ile yapılıyor.
- **Çözüm (sonradan):** `Toolbar.vue` **silindi** (ölü kod). `activeTool`
  taraması doğruladı: yalnız `select` (drag/seçim) ve `hand` (pan) tüketiliyor;
  `scale`/`rotate` değerlerini **hiçbir kod okumuyor** (vestigial) — gerçek
  scale/rotate Konva Transformer handle'ları + Motion clip'leriyle yapılıyor,
  bu yüzden `S`/`R` kısayolu eklenmedi (anlamsız olurdu).

### F7 — (BONUS, düzeltildi) Temiz kurulumda `vitest` jsdom'u bulamıyor
- `npm install` workspace hoisting'i `vitest`'i köke, `jsdom`'u `services/web`'e
  koyuyor → kök-hoist vitest jsdom'u çözemiyor → **temiz klonda `npm test:unit`
  patlıyor** (`Cannot find package 'jsdom'`). Playwright kurarken node_modules
  silinince ortaya çıktı.
- **Düzeltme:** kök `package.json` devDependencies'e `jsdom` eklendi (kök-hoist
  vitest artık çözüyor). Latent bir altyapı hatası kalıcı olarak giderildi.

## Sonuçlar (tamamlandı)

### Düzeltmeler
- **F1:** AssetSidebar "Data & Coordinates"e `counter` butonu eklendi.
- **F3:** AssetSidebar "Data & Coordinates"e `numberplane` butonu eklendi.
- **F7:** kök `package.json`'a `jsdom` devDependency eklendi (temiz kurulum onarımı).
- **F2:** geri alındı (ölü Toolbar.vue'ya yapılmıştı — bkz. F6).

### Yöntem 3 — `services/web/tests/components/ui-tools-audit.test.js` (18 test)
- Canlı palette (AssetSidebar) her shape/data/3D kart + text için `addObject`
  doğru tipi üretiyor.
- **Reachability invariantı:** inspector kayıtlı her tip palette'ten erişilebilir
  (F1/F3 regresyon koruması).
- Her erişilebilir tip → `generateManimScript` `MainScene` üretir, `undefined`
  sızıntısı yok.
- MotionPicker: move/scale/fade/rotate + 5 emphasis butonu doğru clip'i üretir;
  count yalnız counter'da görünür ve count clip oluşturur.
- Etkileşim modları (`setActiveTool`) + AssetSidebar transform 2-seçim gating.
- (ObjectInspector her tip için hatasız mount: zaten
  `properties-panel.characterization.test.js` kapsıyor.)

### Yöntem 2 — `e2e/` izole Playwright paketi (9 test, Chromium)
- Workspace dışı ayrı paket (`e2e/node_modules`) → hoisting'i bozmaz.
- Özel port 5188 + `reuseExistingServer:false` (5173'te başka bir Vite app çalışıyor).
- DEV-only `window.__projectStore` hook'u (main.js) ile store doğrulanıyor.
- Boot + tüm 2D kartlar + text + F1(counter→count) + F3(numberplane) + 3D
  (prism/surface/sphere) + MotionPicker clip'leri + klavye araçları (V/H) +
  transform gating — hepsi gerçek tarayıcıda yeşil.

## Kabul Kriterleri — KARŞILANDI

- Mevcut testler yeşil: **513 unit + 114 engine** (495+18 yeni, regresyon yok).
- Audit testleri F1/F3'ü kanıtlıyor + regresyonu yakalıyor.
- E2E her palette/clip/tool akışını gerçek tarayıcıda doğruluyor (9/9).
- Prod build temiz (`npm run build` ✓).

## Açık Öneriler — TÜMÜ KAPANDI
- ~~F6: `Toolbar.vue` ölü kod~~ → **çözüldü:** silindi; `scale`/`rotate`
  vestigial olduğu için kısayol eklenmedi.
- ~~F4: `numberline` import-only~~ → **çözüldü:** `NumberLineSettings` + palette
  butonu eklendi; artık tam araç.
