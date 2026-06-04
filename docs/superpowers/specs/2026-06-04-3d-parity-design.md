# 3D Tam Parite — `path_move` + `axes3d` Aralık Editörü — Tasarım Spec

**Tarih:** 2026-06-04
**Kapsam:** 3D sahne desteğinde bilerek ertelenen iki maddeyi tamamlamak: 3D `path_move` yol animasyonu ve `axes3d` için tam aralık (yRange/zRange) editörü
**Yaklaşım:** Mevcut 2D `path_move` altyapısını 3D'ye genişlet; çizim tepeden (XZ) panelde Y sabit; render-doğru codegen + canvas önizlemesi

---

## 1. Hedef & Başarı Kriterleri

3D sahne desteğinin (4 katman) ardından kalan iki net madde:

1. **3D `path_move`** — Şu an `manim.js` / `codegen.js` path noktalarını `stageToManim(...)` ile 2D'ye çevirip `z=0` sabitliyor; 3D uzayda yol animasyonu yok.
2. **`axes3d` tam aralık editörü** — `Position3DPanel.vue` yalnızca `xRange` gösteriyor; `yRange`/`zRange` düzenlenemiyor.

**Başarı kriterleri:**
1. 3D modda bir nesne için tepeden panelde yol çizilebilir; `.py` çıktısı 3D koordinatlı `MoveAlongPath` üretir ve render'da çalışır.
2. Playback sırasında nesne, çizilen 3D yol boyunca canvas önizlemesinde hareket eder (2D `path_move` ile tutarlı).
3. `axes3d` nesnesinin x/y/z aralıkları Inspector'dan düzenlenebilir ve codegen'e yansır.
4. Mevcut tüm unit + engine testleri regresyonsuz geçer.

---

## 2. Veri Modeli

3D modda `addPathMoveClip` yolu **3D nokta** olarak saklar:

```js
clip.path = [{ x3d, y3d, z3d }, ...]   // sceneType === '3d'
clip.path = [{ x, y }, ...]            // 2D modda — değişmez
```

- **Ayrım:** Noktada `x3d` alanının varlığına bakılır (`'x3d' in pts[0]`). Ayrı flag yok — nokta şekli kendini tanımlar; codegen, playback ve parser aynı kontrolü uygular.
- **Y sabit:** Her noktanın `y3d`'si, çizim anında nesnenin mevcut `y3d` değeriyle doldurulur. Tek yol içinde Y değişmez.

---

## 3. Çizim Akışı (`StageCanvas.vue`)

- `startPathDraw(sourceId)` 3D modda **yalnızca top/XZ panelde** yapılan tıklamaları kabul eder. İzometrik (sol) panel tıklamaları yok sayılır — tek 2D tıklamanın 3D'de belirsiz olması bu şekilde önlenir.
- Tıklama → top panel ters dönüşümü:
  ```js
  const x3d = (cx - projCx2.value) / proj3DScale.value;
  const z3d = (cy - projCy2.value) / proj3DScale.value;
  const y3d = obj.y3d ?? 0;   // sabit
  pathPoints.push({ x3d, y3d, z3d });
  ```
- Çizim sırasında önizleme çizgisi + nokta işaretleri **top panelde** gösterilir.
- Commit edilen yol ek olarak **iso panelde de** çizilir (salt-görsel, `listening: false`) — kullanıcı 3D şeklini perspektifte görür.
- Çift tık → `addPathMoveClip(sourceId, [...3D points])`.

`pathCanvasPoints` / `pathPreviewLineCfg` computed'ları, 3D modda noktaları top projeksiyonuyla (`top()`) canvas koordinatına çevirir; 2D modda mevcut `s2c` davranışını korur.

---

## 4. Playback Önizleme (yeni override plumbing)

**Tespit:** 3D cfg fonksiyonları (`sphere3dCfg`, `cube3dCfg`, `generic3dCfg`, `axes3dLines` ve top varyantları) konumu doğrudan `obj.x3d`'den okuyor; `frameState.objectOverrides`'a bakmıyor. Bu yüzden 3D nesneler şu an playback'te hiç animate olmuyor.

### `engine/playback.js`
`path_move` case'i, nokta `x3d` taşıyorsa 3D moda geçer:
- Yay uzunluğu 3D mesafeyle hesaplanır: `len = sqrt(Δx3d² + Δy3d² + Δz3d²)`
- İnterpolasyon `x3d/y3d/z3d` üzerinde lerp yapar.
- Sonuç: `overrides.x3d`, `overrides.y3d`, `overrides.z3d` yazılır.
- 2D yol (`x` alanı) mevcut davranışı (`overrides.x/y`) korur.

### `StageCanvas.vue`
Tek yardımcı eklenir:
```js
function eff3d(obj) {
  const ov = frameState.value.objectOverrides[obj.id] || {};
  return {
    x3d: ov.x3d ?? obj.x3d ?? 0,
    y3d: ov.y3d ?? obj.y3d ?? 0,
    z3d: ov.z3d ?? obj.z3d ?? 0,
  };
}
```
Tüm 3D cfg fonksiyonları (iso + top) `obj.x3d` yerine `eff3d(obj)` kullanır. Yan fayda: ileride 3D move klip önizlemesi de mümkün olur (kapsam dışı ama tasarımca açık).

---

## 5. Codegen (`codegen.js` + `manim.js` — senkron)

`path_move` case'i 3D nokta (`x3d` var) tespit ederse:

```python
path_<id> = VMobject()
path_<id>.set_points_as_corners([np.array(p) for p in [[x, y, z], ...]])
self.play(MoveAlongPath(<obj>, path_<id>), run_time=..., rate_func=...)
```

- `stageToManim` çağrısı atlanır — `x3d/y3d/z3d` zaten Manim biriminde.
- Noktalar `[x3d, y3d, z3d]` olarak doğrudan emit edilir (3 ondalık).
- 2D path_move codegen değişmez.

### Parser
`set_points_as_corners([...])` + `MoveAlongPath(...)` okunurken `project.sceneType === '3d'` ise noktalar `{ x3d, y3d, z3d }` olarak geri kurulur; aksi halde mevcut `{ x, y }` (ters `stageToManim`) davranışı korunur.

`codegen.js` (`vn()`) ve `manim.js` (`v()`) birebir senkron tutulur (mevcut kural).

---

## 6. `axes3d` Aralık Editörü (`Position3DPanel.vue`)

- Mevcut `xRange` (min–max iki-input) bloğunun altına aynı desende `yRange` ve `zRange` blokları eklenir.
- `updateRange(field, idx, e)` zaten genel (`field` parametreli) — değişiklik gerekmez; yalnızca `'yRange'` / `'zRange'` ile çağrılır.
- Codegen tarafı (`objectCode3d`) zaten `obj.yRange` / `obj.zRange` okuyor; ek codegen değişikliği gerekmez. Yalnızca düzenleme UI'ı eksikti.

---

## 7. Güvenlik

3D nokta dizileri ve aralık değerleri sayısaldır; ifade (expression) alanı içermez → `safeMathExpr` whitelist'i etkilenmez, değişmez.

---

## 8. Test Stratejisi

Yeni/genişletilen testler:

- **Codegen** (`3d-path.test.js` veya `3d-layer4.test.js` genişletmesi):
  - 3D `path_move` → `np.array([x, y, z])` 3D koordinatlı `MoveAlongPath` üretir (z ≠ 0 doğrulanır).
  - Round-trip: 3D path içeren `.py` parse edilince `clip.path` 3D noktalara döner.
  - `axes3d` `yRange`/`zRange` codegen'e yansır.
- **Engine** (`engine.test.mjs`):
  - 3D path interpolasyonu `overrides.x3d/y3d/z3d` döndürür; `t=0.5` orta nokta beklenen 3D konumda.
  - 3D yay uzunluğu Δz'yi hesaba katar.

`cd services/web && npm run test:unit && npm test` her ikisi de regresyonsuz geçmeli.

---

## 9. Bilinen Kısıtlar & Teknik Borç

- **Y sabit:** Tek yol içinde Y değişimi yok (kullanıcı kararı). İleride nokta-başına `y3d` düzenleme eklenebilir.
- İzometrik önizleme `phi=75°` varsayımını sürdürür — kamera açısı duyarlı projeksiyon ayrı bir iştir.
- `FRAME_WIDTH` divergence 3D'yi etkilemez (`x3d` zaten Manim biriminde).

---

## 10. Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `services/web/src/store/project.js` | `addPathMoveClip` 3D modda 3D nokta saklar |
| `services/web/src/components/stage/StageCanvas.vue` | Top-panel 3D çizim, `eff3d()` helper, iso path önizleme, `pathCanvasPoints` 3D dalı |
| `services/web/src/engine/playback.js` | `path_move` 3D interpolasyon → `overrides.x3d/y3d/z3d` |
| `services/api/src/compiler/codegen.js` | `path_move` 3D codegen + parser |
| `services/web/src/export/manim.js` | Aynı 3D codegen + parser |
| `services/web/src/components/inspector/Position3DPanel.vue` | `yRange` / `zRange` editörleri |
| `services/web/tests/components/3d-path.test.js` | Yeni — 3D path codegen + round-trip + axes3d range |
| `services/web/tests/engine.test.mjs` | 3D path interpolasyon testi |
