# Keyframe Animasyon Sistemi — Tasarım Dokümanı

**Tarih:** 2026-06-03
**Kapsam:** Nesne bazlı global keyframe sistemi — per-property keyframe katmanı, Bezier eğri editörü, 3 davranış modu, 3 codegen modu

---

## 1. Genel Bakış

Mevcut klip modeli korunur. Her nesne objesine global, absolute-zamanlı bir `keyframes` katmanı eklenir. Keyframe'ler kliplerden bağımsız yaşar — klip silinse bile nesne üzerinde kalır. Per-property davranış modu ve codegen modu ayarlanabilir.

---

## 2. Veri Modeli

Her nesne objesine aşağıdaki alanlar eklenir:

```js
obj.keyframes = {
  x: [
    { time: 0.5, value: 300, easing: { type: 'bezier', handles: [0.4, 0, 0.6, 1] } },
    { time: 1.8, value: 800, easing: { type: 'linear' } }
  ],
  opacity: [ ... ],
  // diğer sayısal Inspector alanları...
}

obj.keyframeMode = {
  x: 'override',       // 'override' | 'additive' | 'opt-in'
  opacity: 'additive',
  // tanımlanmayan propertyler proje geneli default'u kullanır
}

obj.keyframeCodegen = {
  x: 'UpdateFromAlphaFunc',  // 'UpdateFromAlphaFunc' | 'animate' | 'ValueTracker'
  // tanımlanmayan propertyler proje geneli default'u kullanır
}
```

**Proje geneli varsayılanlar** (`store.project`):

```js
project.keyframeDefaults = {
  mode: 'opt-in',               // tüm propertyler için fallback
  codegenMode: 'UpdateFromAlphaFunc'
}
```

**Keyframe nesnesi alanları:**

| Alan | Tip | Açıklama |
|------|-----|----------|
| `time` | number | Absolute saniye (sahne başından itibaren) |
| `value` | number | O andaki property değeri |
| `easing.type` | string | `'bezier'` \| `'linear'` \| `'ease_in'` \| `'ease_out'` \| `'ease_in_out'` |
| `easing.handles` | number[4] | Sadece `type: 'bezier'` için: `[x1, y1, x2, y2]` (CSS cubic-bezier formatı) |

**Kapsam:** Tüm sayısal Inspector alanları keyframe'lenebilir. Sayısal olmayan alanlar (tip, renk string'i, boolean) kapsam dışı.

---

## 3. Timeline UI

### 3.1 Keyframe Şeridi

- Bir klip seçilince, o nesnenin keyframe'i olan her property için klip satırının altında bir şerit açılır.
- Keyframe'i olmayan propertyler için `+ keyframe ekle` butonu gösterilir.
- Şeritler `Timeline.vue` içinde mevcut klip satırının hemen altına render edilir.
- Şerit yüksekliği: 20px (nokta + küçük eğri önizleme için yeterli).

### 3.2 Keyframe Noktaları

| Etkileşim | Sonuç |
|-----------|-------|
| Sol tık | Keyframe seçilir; Inspector'da `time`, `value`, `keyframeMode` gösterilir |
| Sağ tık | Bağlam menüsü: Sil, Modu değiştir |
| Çift tık (boş alan) | O zamana yeni keyframe eklenir; mevcut nesne değeri alınır |
| Sürükle | Keyframe zamanı değişir |

- Görsel: Elmas (◆) şekli, `override` → sarı, `additive` → turuncu, `opt-in` → mavi.
- Zaman ölçeği: Mevcut `pxPerSec` kullanılır — zoom/pan otomatik çalışır.

### 3.3 Segment Bezier Popup

İki keyframe arasındaki alana tıklayınca yüzer popup açılır. Popup içeriği:

- **Bezier eğrisi önizlemesi:** SVG, handle'lar sürüklenebilir
- **Preset butonlar:** Linear, Ease In, Ease Out, Ease In-Out
- **`codegenMode` seçici:** UpdateFromAlphaFunc / animate / ValueTracker

Popup, timeline'ın üzerinde görünür (z-index), tıklanan segment koordinatına yakın konumlanır. Dışarı tıklayınca kapanır.

---

## 4. Playback Engine

### 4.1 Frame Hesaplama Sırası

`services/web/src/engine/playback.js` her property için şu sırayı izler:

1. Klip animasyonu hesaplanır → `clipValue`
2. `obj.keyframes[prop]` varsa `interpolateKeyframes(keyframes, time)` çağrılır → `keyframeValue`
3. `obj.keyframeMode[prop]` (veya `project.keyframeDefaults.mode`) ile birleştirilir:
   - `override` → `keyframeValue` kullanılır
   - `additive` → `clipValue + keyframeValue`
   - `opt-in` → ilk ve son keyframe arasındaki zaman aralığında `keyframeValue`, dışında `clipValue`

### 4.2 `interpolateKeyframes(keyframes, time)`

Yeni dosya: `services/web/src/engine/keyframe.js`

- İkili arama ile aktif segmenti bulur (O(log n))
- Segment `easing`'ine göre `t` parametresi hesaplanır:
  - `linear` → `t = (time - k1.time) / (k2.time - k1.time)`
  - Bezier → cubic Bezier solver (`easing.handles` ile)
  - Preset'ler (`ease_in` vb.) → önceden tanımlı handle değerlerine map edilir
- `lerp(k1.value, k2.value, t)` döner
- Zaman aralığı dışında: sol/sağ uç keyframe değeri sabit tutulur

**Performans:** `obj.keyframes` boş veya tanımsızsa interpolasyon tamamen atlanır.

---

## 5. Codegen

`services/api/src/compiler/codegen.js` ve `services/web/src/export/manim.js` senkron güncellenir.

Keyframe'li her property için `codegenMode`'a göre çıktı:

### `UpdateFromAlphaFunc` (varsayılan)

Keyframe dizisi codegen sırasında Python listesi olarak inline yazılır; interpolasyon fonksiyonu da üretilen dosyaya eklenir:

```python
_kf_x = [(0.5, 300), (1.8, 800)]  # (time, value) pairs

def _lerp_kf_x(t):
    for i in range(len(_kf_x) - 1):
        t0, v0 = _kf_x[i]; t1, v1 = _kf_x[i+1]
        if t0 <= t <= t1:
            return v0 + (v1 - v0) * (t - t0) / (t1 - t0)
    return _kf_x[-1][1]

def x_func(mob, alpha):
    t = clip_start + alpha * clip_duration
    mob.set_x(_lerp_kf_x(t))

self.play(UpdateFromFunc(obj, x_func, run_time=2.0, rate_func=linear))
```

Bezier easing: `t` parametresi CSS cubic-bezier solver ile hesaplanır (codegen'e yardımcı fonksiyon olarak eklenir).

### `animate` (sıralı)

```python
self.play(obj.animate.set_x(300), run_time=0.5, rate_func=ease_in_out)
self.play(obj.animate.set_x(800), run_time=1.3, rate_func=linear)
```

### `ValueTracker`

```python
x_tracker = ValueTracker(obj.get_x())
obj.add_updater(lambda m: m.set_x(x_tracker.get_value()))
self.play(x_tracker.animate.set_value(800), run_time=1.3)
obj.clear_updaters()
```

**Öncelik kuralı:** Keyframe'li propertyler için o property'nin `codegenMode` kullanılır. Keyframe'siz propertyler mevcut klip codegen'ini kullanır — değişmez.

---

## 6. Store Değişiklikleri

`services/web/src/store/project.js`'e eklenen action'lar:

| Action | Parametreler | Açıklama |
|--------|-------------|----------|
| `addKeyframe` | `(objId, prop, time, value)` | Yeni keyframe ekler; mevcut zamandaysa günceller |
| `removeKeyframe` | `(objId, prop, time)` | Keyframe'i siler |
| `updateKeyframeValue` | `(objId, prop, time, value)` | Değer günceller |
| `updateKeyframeEasing` | `(objId, prop, time, easing)` | Segment easing günceller |
| `setKeyframeMode` | `(objId, prop, mode)` | Per-property mode ayarlar |
| `setKeyframeCodegen` | `(objId, prop, codegenMode)` | Per-property codegenMode ayarlar |

Tüm action'lar `commitState()` çağırır (undo/redo için).

---

## 7. Test Planı

**Engine testleri** (`tests/engine.test.mjs`):
- `interpolateKeyframes`: boş dizi, tek nokta, iki nokta linear, Bezier cubic solver, zaman dışı sabit değer
- `keyframeMode` birleştirme: override / additive / opt-in her kombinasyon
- Bezier handle köşe durumları (handles = [0,0,1,1] → linear eşdeğeri)

**Unit testleri** (`tests/components/*.test.js`):
- Store action'ları: `addKeyframe`, `removeKeyframe`, `updateKeyframeValue`
- Store: per-property default fallback davranışı
- Codegen: 3 `codegenMode` çıktısı snapshot testi
- Codegen: keyframe'siz nesnenin mevcut çıktısının değişmediği regresyon testi

**Hedef:** ~30 yeni test (mevcut 47 unit + 89 engine'e eklenir).

---

## 8. Kapsam Dışı

- Renk (fill/stroke) keyframe'leme — string interpolasyon ayrı problemi, sonraki iterasyon
- Timeline'da keyframe şeridini klip dışında da görme (klip seçili olmadan)
- Keyframe kopyala/yapıştır
- Keyframe şeridinde multi-select
