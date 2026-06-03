# 3D Sahne Desteği — Tasarım Spec

**Tarih:** 2026-06-03
**Kapsam:** Manim Motion Editor'e katmanlı 3D sahne desteği eklenmesi
**Yaklaşım:** 4 bağımsız katman — her biri ayrı ayrı kullanılabilir ve test edilebilir

---

## 1. Hedef & Kullanım Senaryoları

- Matematiği 3D'de anlatmak: dönen şekiller, 3D grafik, kamera uçuşu
- Fizik/mühendislik: vektörler, kuvvetler, 3D koordinat sistemleri
- Genel 3D animasyon: nesneleri 3D uzaya taşımak, perspektif efektleri

**Başarı kriterleri:**
1. 3D nesneler editöre eklenebilsin, konumları ayarlanabilsin, geçerli `.py` render alınsın
2. Split viewport çalışsın + timeline'da 3D animate edilebilsin
3. Tüm mevcut özellikler 3D'de de çalışsın (keyframe, ses, kamera, path)

---

## 2. Mimari: 4 Katman

| Katman | Kapsam | Efor |
|--------|--------|------|
| **1 — Veri + Codegen** | sceneType, 3D nesne tipleri, ThreeDScene .py çıktısı | M |
| **2 — Split Viewport** | İzometrik + tepeden projeksiyon, sürükle-bırak, Inspector z alanı | L |
| **3 — Timeline** | 3D move/rotate/scale klipleri, camera phi/theta animate | M |
| **4 — Tam Parite** | Keyframe, path_move, voiceover 3D bağlamında | L |

Her katman öncekine dayanır ama ayrı branch/PR olarak teslim edilebilir.

---

## 3. Veri Modeli

### Proje düzeyi

```js
store.project.sceneType = '2d' | '3d'  // default: '2d'

store.project.camera3d = {
  phi: 75,    // degrees — Manim default
  theta: -45, // degrees — Manim default
  zoom: 1.0
}
```

Mevcut `'2d'` projeleri etkilenmez. `camera3d` yalnızca `sceneType === '3d'` olduğunda kullanılır.

### 3D nesne tipleri

Yeni nesne tipleri: `sphere`, `cube`, `cone`, `cylinder`, `torus`, `axes3d`

3D nesnelere özgü alanlar (2D nesne alanlarına ek olarak):

```js
obj.x3d = 0        // Manim birimi (-7..+7)
obj.y3d = 0        // Manim birimi (-4..+4)
obj.z3d = 0        // Manim birimi (-4..+4)
obj.rx = 0         // degrees
obj.ry = 0
obj.rz = 0
obj.resolution = 20  // sphere / cone yüzey kalitesi
```

`obj.x`, `obj.y` (2D piksel) 3D nesnelerde kullanılmaz — `x3d/y3d/z3d` Manim birimiyle doğrudan çalışır.

---

## 4. Split Viewport

### Layout

`sceneType === '3d'` olduğunda `StageCanvas.vue` iki mantıksal bölgeye bölünür (tek `<canvas>`):

```
┌─────────────────────┬──────────────────┐
│   PERSPECTIVE       │   TOP (XZ)       │
│   (izometrik proj.) │   (tepeden düz)  │
│                     │                  │
│   ana görünüm       │   konumlandırma  │
└─────────────────────┴──────────────────┘
```

Orta çizgi sürüklenebilir (default: 50/50). `sceneType === '2d'` projelerinde mevcut tek-panel düzen korunur.

### Projeksiyon matematiği

**İzometrik (sol panel):**

```js
const cos30 = Math.cos(Math.PI / 6)
const sin30 = Math.sin(Math.PI / 6)

function iso(x3d, y3d, z3d, cx, cy, scale) {
  const px = (x3d - z3d) * cos30
  const py = -y3d + (x3d + z3d) * sin30
  return { px: cx + px * scale, py: cy + py * scale }
}
```

Manim'in default kamera açısı (`phi=75°, theta=-45°`) izometrik projeksiyonla görsel olarak uyumludur — render çıktısı canvas önizlemesiyle örtüşür.

**Tepeden / XZ düzlemi (sağ panel):**

```js
function top(x3d, z3d, cx2, cy2, scale) {
  return { px: cx2 + x3d * scale, py: cy2 + z3d * scale }
}
```

### Sürükle-bırak

- Sol panelde sürükle → `x3d/z3d` güncellenir (Y ekseni sabit)
- Sağ panelde sürükle → `x3d/z3d` güncellenir (aynı eksenler)
- Y eksenini değiştirmek: Inspector `y3d` alanı veya `Shift + sürükle` (sol panel)

---

## 5. Codegen

### Base class öncelik sırası

```
MovingCameraScene3D > VoiceoverScene3D > ThreeDScene
```

```python
class Scene_<id>(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(
            phi=75 * DEGREES,
            theta=-45 * DEGREES,
            zoom=1.0
        )
```

`camera3d.phi/theta/zoom` değerleri projeden okunur.

### 3D nesne codegen

```python
# sphere
s = Sphere(radius=0.5, resolution=(20, 20))
s.set_color(RED)
s.move_to([0, 0, 0])

# cube
c = Cube(side_length=1.0)
c.set_color(BLUE)
c.move_to([1, 0, 0])

# cone / cylinder / torus — aynı pattern
cone = Cone(base_radius=0.5, height=1.0)
cyl  = Cylinder(radius=0.5, height=1.5)
tor  = Torus(major_radius=1.0, minor_radius=0.3)

# axes3d
ax = ThreeDAxes(
    x_range=[-3, 3, 1],
    y_range=[-3, 3, 1],
    z_range=[-3, 3, 1]
)
```

### Clip codegen (3D)

```python
# move
self.play(s.animate.move_to([2, 1, 0]), run_time=1.5)

# rotate
self.play(Rotate(c, angle=PI/2, axis=OUT), run_time=1.0)
# axis: OUT=Z, RIGHT=X, UP=Y

# scale
self.play(s.animate.scale(1.5), run_time=0.8)
```

`codegen.js` ve `manim.js` her iki dosya senkronize tutulur (mevcut kurala uygun).

---

## 6. Timeline Uzantısı (Katman 3)

- 3D nesneler mevcut `move / rotate / scale` klip tiplerini kullanır; codegen farkı Katman 2'de halledilir
- `camera_move` clipine `phi` ve `theta` alanları eklenir:

```python
self.move_camera(phi=60 * DEGREES, theta=-60 * DEGREES, run_time=2)
```

- Inspector `AnimationPanel`'e `axis: X | Y | Z` seçeneği eklenir (rotate klipleri için)

---

## 7. Tam Parite (Katman 4)

### Keyframe

`_kfPropSet` (`codegen.js` + `manim.js`) `x3d/y3d/z3d/rx/ry/rz` property'lerini destekleyecek şekilde genişler. Koordinat dönüşümü: `stageToManim` yerine doğrudan Manim birimi (zaten `x3d` Manim biriminde).

### path_move (3D)

3D `VMobject` path tanımlanabilir; `MoveAlongPath` codegen 3D koordinatlarla çalışır.

### Voiceover + ThreeDScene

`MovingCameraScene` ve `VoiceoverScene` birleşimi:

```python
class Scene_<id>(ThreeDScene):  # VoiceoverScene mixin Katman 4'te
```

Ses sistemi değişmez; `codegen.js` base class seçimini günceller.

---

## 8. Güvenlik

3D nesne tipleri expression alanı içermez → `safeMathExpr` whitelist değişmez.

---

## 9. Test Stratejisi

- **Katman 1:** `codegen.test.js` — 3D nesne tipleri için `.py` çıktısı doğrulama
- **Katman 2:** `StageCanvas` unit testi — `iso()` ve `top()` projeksiyon fonksiyonları
- **Katman 3:** Engine testi — 3D move/rotate/scale klip hesaplamaları
- **Katman 4:** Mevcut keyframe engine testleri `x3d/y3d/z3d` ile genişler

Her katman kendi test dosyasına sahiptir. `npm run test:unit` ve `npm test` her katman sonrası geçmeli.

---

## 10. Bilinen Kısıtlar & Teknik Borç

- `FRAME_WIDTH` divergence (`manim.js` vs `codegen.js`) 3D nesneleri etkilemez — `x3d` zaten Manim biriminde
- İzometrik projeksiyon `phi=75°` için optimize; farklı kamera açılarında canvas önizlemesi sapabilir (Katman 4'te iyileştirilebilir)
- `ThreeDScene` + `VoiceoverScene` çoklu kalıtım Manim CE'de mixin ile mümkün; Katman 4'te doğrulanmalı
