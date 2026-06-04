# Teknik Borç — Koordinat Birleştirme + phi-Duyarlı 3D Önizleme — Tasarım Spec

**Tarih:** 2026-06-04
**Kapsam:** İki bağımsız teknik borç tek spec'te: (A) `codegen.js` ↔ `manim.js` arasındaki `FRAME_WIDTH` koordinat sapması, (B) sabit 30° izometrik 3D önizlemenin `camera3d.phi/theta`-duyarlı gerçek küresel-kamera projeksiyonuyla değiştirilmesi.
**Yaklaşım:** Tek paylaşılan kare-genişliği sabitinde (`14.222`) birleştir; iso projeksiyonunu Manim Z-up kamera bazından türet; iki projeksiyon modu (ortografik/perspektif) Ayarlar'dan seçilir, yalnızca önizlemeyi etkiler.

---

## 1. Hedef & Başarı Kriterleri

Roadmap'in tamamı (3 faz + 3D parite) tamamlandı. Bu spec, `CLAUDE.md` "Technical Debt (known)" ve 3D "Known Constraints" bölümlerindeki iki maddeyi kapatır:

- **A. FRAME_WIDTH sapması:** `manim.js` (istemci export) pozisyon için `14 + 2/9 = 14.222` kullanırken `codegen.js` (sunucu render) baştan sona `14` kullanıyor. Ayrıca `manim.js` kendi içinde tutarsız: statik x `14.222`, ama `_kfPropSet` keyframe-x `14`.
- **B. phi sabitliği:** `StageCanvas.vue` `iso()` sabit `cos30/sin30` ile çiziyor; `camera3d.phi/theta`'yı hiç okumuyor. Önizleme yalnızca phi=75° civarında render'a benziyor.

**Doğru değer:** Manim CE varsayılan kare genişliği `14.222` (16:9 en-boy, yükseklik 8). Yani `14.222` doğru, `14` yanlış.

**Başarı kriterleri:**
1. Aynı proje için `codegen.js` ve `manim.js`'in ürettiği `.py`, koordinat ölçeği bakımından özdeş.
2. `manim.js` içinde statik-x ve keyframe-x aynı ölçeğe (`14.222`) düşer.
3. İso önizleme kamera açısı (`phi/theta`) değiştikçe makul biçimde döner; phi=75° dışı açılarda da render'la tutarlı yönelim gösterir.
4. Projeksiyon modu (ortografik/perspektif) Ayarlar'dan seçilebilir; yalnızca önizlemeyi etkiler, `.py` çıktısı değişmez.
5. Playback sırasında 3D `camera_move` klipleri önizleme açısını canlı olarak döndürür.
6. Mevcut tüm unit + engine testleri (gerekli güncellemelerle) ve yeni testler regresyonsuz geçer.

---

## 2. Part A — FRAME_WIDTH Birleştirmesi

### 2a. Paylaşılan Sabitler

`codegen.js`'e, `manim.js`'tekiyle birebir aynı sabit blok eklenir (dosya başında, `stageToManim`'den önce):

```js
const FRAME_WIDTH = 14 + 2 / 9;          // 14.222 — Manim CE default frame width
const FRAME_HEIGHT = 8;
const FRAME_X_RADIUS = FRAME_WIDTH / 2;  // 7.111
```

Yükseklik (`8`) zaten her iki dosyada tutarlı kullanılıyor — değişmez. Yalnızca genişlik ekseni (`14` → `FRAME_WIDTH`, `7` → `FRAME_X_RADIUS`) düzeltilir.

### 2b. `codegen.js` Değişiklikleri

| Konum | Şu an | Olacak |
|---|---|---|
| `stageToManim` (L82) | `((x / sw) - 0.5) * 14` | `* FRAME_WIDTH` |
| Rectangle/Ellipse/Line/Arrow/Image/SVG/Axes/NumberPlane/NumberLine genişlikleri (L198–324) | `obj.width / sw * 14` | `* FRAME_WIDTH` |
| Arrow tip uzunluğu (L257) | `7 / sw * 14` | `FRAME_X_RADIUS / sw * FRAME_WIDTH` |
| `_kfPropSet` (L339) | `const MANIM_W = 14` | `const MANIM_W = FRAME_WIDTH` |
| Kamera `set_width` (L911) | `const sceneWidth = 14` | `const sceneWidth = FRAME_WIDTH` |

### 2c. `manim.js` Değişiklikleri

`manim.js`'in `FRAME_WIDTH`/`FRAME_X_RADIUS` sabitleri zaten var ve şekil/pozisyon yollarında doğru kullanılıyor. Yalnızca üç tutarsız nokta düzeltilir:

| Konum | Şu an | Olacak |
|---|---|---|
| `_kfPropSet` (L336) | `const MANIM_W = 14` | `const MANIM_W = FRAME_WIDTH` |
| Kamera `set_width` üretimi (L826) | `(14 / zoom).toFixed(3)` | `(FRAME_WIDTH / zoom).toFixed(3)` |
| Kamera parser zoom (L1456) | `14 / parseFloat(fw)` | `FRAME_WIDTH / parseFloat(fw)` |

### 2d. Davranış Değişikliği & Round-trip

Bu değişiklik, mevcut projelerin render konumlarını x ekseninde kenarlarda en fazla `(14.222−14)/14.222 ≈ %1.5` kaydırır — bu, render'ı Manim'in gerçek kare ölçeğine *yaklaştıran* kasıtlı bir düzeltmedir.

`14`'e bağlı sabit beklenti içeren mevcut parser/round-trip/codegen testleri yeni değere göre güncellenir (bkz. Bölüm 4).

---

## 3. Part B — phi-Duyarlı 3D Projeksiyon

### 3a. Projeksiyon Matematiği (Manim Z-up)

Kamera kökene bakar; `phi` = +Z ekseninden polar açı, `theta` = XY düzleminde azimut.

```
n = (sinφ·cosθ, sinφ·sinθ, cosφ)        // bakış yönü (orijinden kameraya)
r = (-sinθ, cosθ, 0)                     // ekran-sağ birim vektörü
u = (-cosφ·cosθ, -cosφ·sinθ, sinφ)       // ekran-yukarı birim vektörü  (u = n × r)

screen_x = P·r = -Px·sinθ + Py·cosθ
screen_y = P·u = -cosφ·(Px·cosθ + Py·sinθ) + Pz·sinφ

canvas_px = cx + screen_x · scale · zoom
canvas_py = cy - screen_y · scale · zoom
```

Doğrulama (sabit nokta kontrolü): φ=0, θ=−90° → `screen_x = Px`, `screen_y = Py` (klasik XY: X sağ, Y yukarı, top-down). φ=90° → `u = (0,0,1)` (Z dünya-yukarı ekrana yukarı düşer).

**Perspektif modu:** derinlik `d = P·n`; çarpan `f = D / (D − d)` (D = focal distance). `screen_x, screen_y` `f` ile ölçeklenir. D büyük → ortografiğe yakınsar.

### 3b. `iso()` Yeniden Yazımı (`StageCanvas.vue`)

`iso(x3d, y3d, z3d, cx, cy, scale)` yukarıdaki formülle yeniden yazılır. `cos30`/`sin30` sabitleri kaldırılır. İmza korunur (tüm çağrı yerleri — sphere/cube/torus/axes3d cfg ve path önizleme — değişmeden çalışır). Mod (`orthographic`/`perspective`), `phi`, `theta`, `zoom`, `focalDistance` reaktif kaynaklardan (aşağıda) okunur.

`top()` değişmez — sabit XZ ortografik referans görünümü olarak kalır (phi/theta'dan bağımsız).

### 3c. Reaktif Açı Kaynağı

İso projeksiyonu şu öncelikle açı/zoom okur:
1. `frameState.cameraState` 3D bilgisi taşıyorsa (canlı `camera_move` animasyonu) → onu kullan.
2. Aksi halde `project.camera3d` taban açıları (`phi`, `theta`, `zoom`).

`StageCanvas.vue`'da küçük bir computed (`cam3d`) bu birleştirmeyi yapar ve `iso()` çağrılarına aktarılır (veya `iso()` modül-kapsamı yerine computed'tan okur).

### 3d. Playback 3D Kamera Durumu (`playback.js`)

`computeFrame` içindeki `cameraState` üretimi 3D için genişletilir. Şu an yalnızca `{x, y, zoom}` lerp'leniyor (2D). 3D sahnede `camera_move` klipleri `params.phi/theta/zoom` taşır:

```js
// sceneType === '3d' ise:
frame.cameraState = {
  phi:   lerp(fromPhi,   camClip.params?.phi   ?? base.phi,   easedT),
  theta: lerp(fromTheta, camClip.params?.theta ?? base.theta, easedT),
  zoom:  lerp(fromZoom,  camClip.params?.zoom  ?? 1,          easedT),
  is3d: true,
};
```

`from*` değerleri önceki klibin hedefinden (veya ilk klipte `project.camera3d` tabanından) gelir — mevcut 2D mantığının 3D karşılığı. 2D `cameraState` ({x,y,zoom}) davranışı değişmez; `is3d` bayrağı ikisini ayırır.

### 3e. Projeksiyon Modu Ayarı (Store + UI)

Proje düzeyinde, `keyframeDefaults` desenini izler:

```js
project.camera3d.projection   = 'orthographic' | 'perspective'   // default 'orthographic'
project.camera3d.focalDistance = 8                                // perspektif için, default 8
```

- `store/project.js`: `newProject` / `camera3d` varsayılanlarına bu iki alan eklenir (geriye-dönük uyum: tanımsızsa `'orthographic'` + `8` varsayılır).
- `setCamera3d(params)` mevcut (`Object.assign`) — değişmez; yeni alanları da kabul eder.
- **UI:** `keyframeDefaults`'un düzenlendiği Settings bileşenine projeksiyon modu seçici (orthographic/perspective) + focal distance sayı girişi (yalnızca perspektif modda görünür) eklenir.

Bu ayar **yalnızca önizlemeyi** etkiler. Codegen (`set_camera_orientation`) değişmez — `.py` çıktısı bu alanlardan etkilenmez.

### 3f. Drag Ters-Dönüşü (`onDrag3DEnd`, iso panel)

İki ekran denklemi / üç bilinmeyen → belirsizlik `y3d` sabit tutularak çözülür (mevcut UX: iso drag yalnızca `x3d`/`z3d` günceller). Genel φ/θ için ortografik denklemler (3a) `Px`, `Pz` için 2×2 lineer sisteme indirgenir (`Py = obj.y3d` bilinen):

```
screen_x = -Px·sinθ + Py·cosθ
screen_y = -cosφ·(Px·cosθ + Py·sinθ) + Pz·sinφ
```
`screen_x`'ten `Px` çözülür (`Py` bilinen), sonra `screen_y`'den `Pz` çözülür (`sinφ ≠ 0` varsayımı; φ→0 yakınında `Pz` belirsizleşir — bu durumda `top` panelde sürükleme önerilir, mevcut davranışla tutarlı). Perspektif modda da sürükleme için ortografik ters-dönüş kullanılır (drag preview-only, hassasiyet kritik değil).

`top` panel ters-dönüşü (L875–876) değişmez.

---

## 4. Test Stratejisi

### Engine (`tests/engine.test.mjs` veya yeni `tests/projection.test.mjs`)

Saf, dışa aktarılmış `project3D(P, {phi, theta, zoom, mode, focalDistance})` yardımcı fonksiyonu (StageCanvas'tan ayrıştırılır ki test edilebilsin):

- φ=0, θ=−90° → top-down XY eşlemesi (X sağ, Y yukarı).
- φ=90° → dünya-Z ekrana-yukarı düşer.
- İleri → ters → ileri tutarlılığı (`y3d` sabit): drag round-trip.
- Perspektif modda kameraya yakın nokta (büyük `d`) ortografikten daha büyük ölçeklenir (`f > 1`); uzak nokta küçülür (`f < 1`).

### Codegen (`tests/components/manim-export.test.js` + sunucu codegen testleri)

- **Parite:** Aynı örnek proje için `codegen.js` ve `manim.js` çıktıları aynı `Rectangle(width=...)`, aynı `move_to([...])` x koordinatını üretir (`14.222` ölçeği).
- `_kfPropSet` keyframe-x çıktısı `FRAME_WIDTH` kullanır (statik-x ile aynı ölçek).
- `14`'e bağlı mevcut sabit beklentiler (`.toBe('...')` / regex) `14.222` değerine göre güncellenir.
- Kamera `set_width(FRAME_WIDTH/zoom)` round-trip: parser aynı zoom'u geri verir.

### Playback (`tests/...`)

- 3D `camera_move` klibi `frameState.cameraState.phi/theta/zoom`'u doğru lerp'ler ve `is3d: true` taşır.
- 2D `cameraState` ({x,y,zoom}) regresyonsuz.

`cd services/web && npm run test:unit && npm test` her ikisi de geçmeli.

---

## 5. Doğrulama Render'ı (manuel)

Projeksiyon konvansiyonu (Z-up, açı işaretleri) yalnızca birim testle değil, **gerçek bir Manim render karşılaştırmasıyla** doğrulanır:

1. 3D sahnede birkaç nesne (sphere/cube/axes3d) farklı `x3d/y3d/z3d`'lerde yerleştirilir.
2. `camera3d.phi/theta` birkaç açıya ayarlanır (örn. 60/−30, 45/0, 90/−90).
3. Her açıda: canvas iso önizlemesi ile sunucu render çıktısı (veya export `.py` → yerel `manim`) görsel olarak karşılaştırılır.
4. Nesnelerin göreli konumları / ekran yönelimi eşleşmeli. Eşleşmezse formüldeki açı işareti / eksen ataması düzeltilir.

Bu adım uygulama planında ayrı bir görev olarak yer alır.

---

## 6. Güvenlik

Tüm değişiklikler sayısal sabit/koordinat hesabı; ifade (expression) alanı içermez → `safeMathExpr` whitelist'i etkilenmez, değişmez.

---

## 7. Etkilenen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `services/api/src/compiler/codegen.js` | FRAME_WIDTH sabit bloğu + `14`→`FRAME_WIDTH`, `7`→`FRAME_X_RADIUS` |
| `services/web/src/export/manim.js` | `_kfPropSet`/kamera/parser `14`→`FRAME_WIDTH` |
| `services/web/src/components/stage/StageCanvas.vue` | `iso()` yeniden yaz (phi/theta + perspektif), `cam3d` computed, `onDrag3DEnd` ters-dönüş |
| `services/web/src/engine/playback.js` | 3D `cameraState` phi/theta/zoom lerp + `is3d` bayrağı |
| `services/web/src/store/project.js` | `camera3d.projection` / `focalDistance` varsayılanları |
| Settings bileşeni (`keyframeDefaults`'un düzenlendiği yer) | projeksiyon modu seçici + focal distance girişi |
| `services/web/tests/` (engine + components) | parite, projeksiyon, 3D camera testleri; `14`→`14.222` beklenti güncellemeleri |

---

## 8. Bilinen Kısıtlar & Teknik Borç (sonrası)

- **Perspektif drag:** Perspektif modda sürükleme ortografik ters-dönüş kullanır — uç açılarda küçük sapma olabilir (preview-only, kabul edilmiş).
- **φ→0 belirsizliği:** İso panelde φ çok küçükken `z3d` sürüklemesi belirsizleşir; kullanıcı top panelde sürüklemeye yönlendirilir (mevcut davranış).
- **Render paritesi (perspektif):** Mod yalnızca önizlemeyi etkilediğinden, perspektif seçilirse önizleme ile render arasında hafif fark kalır (kullanıcı kararı — render'a yansıtmama). İleride codegen'e `focal_distance` eklenerek kapatılabilir.
- `top()` paneli phi/theta'dan bağımsız sabit XZ referansı olarak kalır (kasıtlı).
