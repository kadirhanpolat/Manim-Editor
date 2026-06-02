# Teknik Borç Temizliği — Tasarım Dokümanı

**Tarih:** 2026-06-03  
**Kapsam:** Phase 2 sonrası kalan iki teknik borç: `manim.js` client-side exporter güncellemesi ve kamera önizleme düzeltmesi  
**Yaklaşım:** manim.js'i codegen.js ile semantik olarak hizala; kamera önizlemesini CSS transform'dan Konva pipeline'ına taşı

---

## 1. Kapsam

### Etkilenen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `services/web/src/export/manim.js` | Phase 2 generator + parser desteği |
| `services/web/src/components/stage/StageCanvas.vue` | Kamera önizleme Konva-level'a taşınır |
| `services/web/tests/components/manim-export.test.js` | Yeni unit testler |

### Değişmeyen

- `services/api/src/compiler/codegen.js` — dokunulmaz, referans alınır
- `manim.js` public API: `generateManimScript`, `parseManimScript`, `downloadManimScript`
- Mevcut tüm çalışan obje/klip tipleri

---

## 2. manim.js Generator Güncellemeleri

### 2a. Yeni Obje Tipleri

`objCode()` fonksiyonuna eklenir:

**`numberplane`**
```python
obj_id = NumberPlane(
    x_range=[x0, x1, xs],
    y_range=[y0, y1, ys],
    x_length=..., y_length=...
)
```

**`numberline`**
```python
obj_id = NumberLine(x_range=[x0, x1, xs], length=...)
```

**`axes` + `graphs[]`**  
Mevcut `axes` case'ine ek olarak; her graph için:
```python
graph_N = obj_id.plot(lambda x: expr, color="...", x_range=[xMin, xMax])
graph_N.set_stroke(width=strokeWidth)
```
`safeMathExpr` whitelist codegen.js ile aynı regex kullanır.

### 2b. Yeni Klip Tipleri

**`path_move`**
```python
path_N = VMobject()
path_N.set_points_as_corners([
    np.array([x1, y1, 0]),
    np.array([x2, y2, 0]),
    ...
])
self.play(MoveAlongPath(obj_id, path_N), run_time=..., rate_func=...)
```
Path noktaları clip'in `params.points[]` dizisinden alınır (Manim koordinatları).

**`camera_move`**
```python
self.play(
    self.camera.frame.animate
        .move_to([x, y, 0])
        .set_width(14 / zoom),
    run_time=..., rate_func=...
)
```
`cameraTrack[]` kliplerinden üretilir; normal `tracks[]`'den bağımsız işlenir.

### 2c. AnimationGroup / LaggedStart Gruplaması

codegen.js'deki grouping algoritmasının birebir port'u:

- Aynı `startTime`'a sahip `parallel: true` klipleri tek `self.play()` çağrısında gruplandırılır
- `lag_ratio === 0` → `AnimationGroup(...)`
- `lag_ratio > 0` → `LaggedStart(..., lag_ratio=r)`
- Sıralı kliplerle karışık diziler doğru sırayla emit edilir

### 2d. MovingCameraScene Base Class

```python
class MainScene(MovingCameraScene):  # project.cameraType === 'moving'
    def construct(self):
        ...
```
`project.cameraType === 'static'` ya da tanımsızsa `Scene` kullanılır.

---

## 3. manim.js Parser Güncellemeleri

### 3a. Yeni Obje Regex'leri

| Regex Pattern | Üretilen |
|---|---|
| `NumberPlane(x_range=[...], y_range=[...], ...)` | `{ type: 'numberplane', xRange, yRange }` |
| `NumberLine(x_range=[...], ...)` | `{ type: 'numberline', xRange }` |
| `varName.plot(lambda x: expr, color=..., x_range=[...])` | `axes` objesinin `graphs[]`'ine push |

### 3b. Yeni Animasyon Regex'leri

| Regex Pattern | Üretilen |
|---|---|
| `path_N = VMobject()` + sonraki satırlarda `set_points_as_corners([...])` | path noktaları `params.points[]`'e kaydedilir |
| `MoveAlongPath(obj, path_N)` | `{ type: 'path_move', sourceId, params: { points } }` |
| `self.camera.frame.animate.move_to([x,y,0]).set_width(w)` | `cameraTrack`'e `{ type: 'camera_move', params: { x, y, zoom: 14/w } }` |
| `AnimationGroup(anim1, anim2)` | İç animasyonlar ayrıştırılır, `parallel: true`, aynı `startTime` |
| `LaggedStart(anim1, anim2, lag_ratio=r)` | `parallel: true`, `lag_ratio: r` |

### 3c. MovingCameraScene Tespiti

`class \w+\(MovingCameraScene\):` satırı parse edilirse → `project.cameraType = 'moving'`

### 3d. Bilinmeyen Satırlar

Parser'ın tanımadığı satırlar sessizce atlanır. Exception fırlatılmaz.

---

## 4. Kamera Önizleme Düzeltmesi

### Mevcut Sorun

`StageCanvas.vue`'da `cameraStyle()` computed'ı, dış container `<div>`'ine CSS transform uygular:
```js
transform: `translate(${-px}px, ${-py}px) scale(${zoom})`
```
Bu yaklaşım Konva'nın `vs`/`ox`/`oy` koordinat sistemini bypass ettiğinden render çıktısıyla uyuşmuyor.

### Çözüm

CSS transform kaldırılır. Kamera durumu Konva pipeline'ına enjekte edilir:

**`vs` computed güncellemesi:**
```js
vs() {
  const base = Math.min(sx, sy, 1) * 0.92 * this.zoomLevel;
  const cs = store.frameState.cameraState;
  return cs?.zoom ? base * cs.zoom : base;
}
```

**`ox` / `oy` computed güncellemesi:**
```js
ox() {
  const base = (this.containerWidth - this.stg.width * this.vs) / 2 + this.panOffset.x;
  const cs = store.frameState.cameraState;
  if (!cs || (cs.x === 0 && cs.y === 0)) return base;
  // Manim x_manim = ((px/sw) - 0.5) * 14 → px = (x_manim/14 + 0.5) * sw
  // Offset = camera_x_in_stage_pixels * vs
  const camPx = (cs.x / 14 + 0.5) * this.stg.width;
  return base - (camPx - this.stg.width / 2) * this.vs;
}
// oy: benzer mantık, y ekseni ters (Manim y yukarı pozitif)
```

**Container div:**  
`:style="cameraStyle"` binding kaldırılır. `cameraStyle()` computed'ı silinir.

### Sonuç

Kamera zoom/pan preview, Manim'in `set_width(14/zoom)` ve `move_to()` semantiğiyle aynı koordinat dönüşümünü kullanır.

---

## 5. Test Stratejisi

`services/web/tests/components/manim-export.test.js` dosyasına eklenir:

- `axes` + `graphs[]` → üretici doğru `plot()` çıktısı verir
- `numberplane` obje → üretici + parser round-trip
- `path_move` klip → üretici doğru `VMobject + MoveAlongPath` verir; parser geri çevirir
- `camera_move` klip + `cameraType: 'moving'` → `MovingCameraScene` üretilir; parser `cameraTrack`'i doldurur
- `AnimationGroup` gruplaması → iki `parallel: true` klip tek `self.play()` içinde emit edilir
- `LaggedStart` → `lag_ratio > 0` durumu

`StageCanvas.vue` için: kamera önizleme computed'larının `cameraState` ile doğru değer döndürdüğü unit testler.

---

## 6. Başarı Kriterleri

1. Phase 2 ile oluşturulan herhangi bir sahne (fonksiyon grafiği, path animasyonu, kamera, paralel klip), `manim.js`'in ürettiği `.py` ile server-side `codegen.js`'in ürettiği `.py` semantik olarak eşdeğerdir.
2. Bu `.py` kodu parser'dan geçirildiğinde proje JSON'ı orijinaline fonksiyonel olarak eşdeğer şekilde geri döner.
3. Kamera önizlemesi, playback sırasında render çıktısıyla görsel olarak tutarlıdır.
4. Mevcut 29 unit + 89 engine testi geçmeye devam eder.
