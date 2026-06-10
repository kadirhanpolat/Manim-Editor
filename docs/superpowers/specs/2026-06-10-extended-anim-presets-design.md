# Extended Animation Presets — Design

**Tarih:** 2026-06-10
**Kapsam:** 4 yeni giriş + 2 yeni çıkış animasyon preseti, per-tip filtreleme, yön/ölçek parametreleri
**Base branch:** `main`

---

## Hedef

Mevcut 12 giriş + 10 çıkış animasyon presetini matematik eğitim videolarında sık kullanılan
Manim animasyonlarıyla genişlet. Her presete uygun nesne tiplerini sınırlandıran bir filtre
mekanizması ekle; yön ve ölçek gibi animasyon parametrelerini inspector'dan kontrol edilebilir
hale getir.

## Non-Goals

- Mevcut 12+10 presetin davranışını değiştirmek
- Canvas önizlemesinde render-exact animasyon doğruluğu (yaklaşık önizleme yeterli)
- `GrowFromEdge`'in çıkış yönlü karşılığı (`ShrinkToEdge` Manim'de standart değil)
- `ShowPassingFlash`, `Broadcast`, `Succession` gibi klip-düzeyinde animasyonlar (ayrı kapsam)

---

## Yeni Animasyonlar

### Giriş (4 yeni)

| Anahtar | Manim sınıfı | Parametre | Geçerli tipler |
|---|---|---|---|
| `draw_border_fill` | `DrawBorderThenFill` | — | `image` hariç tümü |
| `grow_arrow` | `GrowArrow` | — | `arrow`, `double_arrow` |
| `grow_from_edge` | `GrowFromEdge(edge=…)` | `enterAnimDir`: `LEFT\|RIGHT\|UP\|DOWN` (varsayılan `LEFT`) | `image` hariç tümü |
| `fade_in_large` | `FadeIn(scale=…)` | `enterAnimScale`: float (varsayılan `1.5`) | tümü |

### Çıkış (2 yeni)

| Anahtar | Manim sınıfı | Parametre | Geçerli tipler |
|---|---|---|---|
| `unwrite` | `Unwrite` | — | `image` hariç tümü |
| `fade_out_large` | `FadeOut(scale=…)` | `exitAnimScale`: float (varsayılan `1.5`) | tümü |

### Mevcut presetlere geriye dönük kısıt

Yeni filtre mekanizmasıyla birlikte mevcut presetler de kısıtlanır (davranış değişmez,
sadece uygunsuz tipler için inspector'da artık gösterilmez):

| Preset | Kısıt |
|---|---|
| `write` | `image` hariç tümü |
| `draw` (Create) | `image` hariç tümü |
| `uncreate` | `image` hariç tümü |
| `typewriter` | `text` |
| `typewriter_out` | `text` |

---

## Veri Modeli

`SceneObject`'e 3 opsiyonel alan eklenir (`@manim/codegen/src/types.ts`):

```ts
enterAnimDir?:   'LEFT' | 'RIGHT' | 'UP' | 'DOWN'  // grow_from_edge yönü
enterAnimScale?: number   // fade_in_large ölçeği  (varsayılan 1.5)
exitAnimScale?:  number   // fade_out_large ölçeği (varsayılan 1.5)
```

Mevcut `enterAnim`, `exitAnim`, `enterAnimDur`, `exitAnimDur` alanları değişmez.

---

## Store Değişiklikleri

**`services/web/src/store/project.ts`**

Yeni action'lar (hepsi `commitState()` çağırır):

```ts
setEnterAnimDir(objId: string, dir: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'): void
setEnterAnimScale(objId: string, scale: number): void
setExitAnimScale(objId: string, scale: number): void
```

---

## Inspector UI

**`services/web/src/components/inspector/panels/ObjectInspector.vue`**

### Filtrelenmiş dropdown

`ENTER_ANIMS`/`EXIT_ANIMS` listeleri `project.ts`'de zaten mevcut. Aynı dosyaya iki
exported helper eklenir (test edilebilirlik için `project.ts`'den export edilir):

```ts
// services/web/src/store/project.ts
export function availableEnterAnims(type: string): typeof ENTER_ANIMS
export function availableExitAnims(type: string): typeof EXIT_ANIMS
```

`ObjectInspector.vue`'da `enterAnims`/`exitAnims` computed'ı `availableEnterAnims(obj.type)`
/ `availableExitAnims(obj.type)` ile güncellenir (önceden `ENTER_ANIMS`/`EXIT_ANIMS` sabit
referansıydı).

Dropdown seçili animasyon nesne tipiyle artık uyumsuzsa (örn. `arrow` tipinden `circle`'a
geçildi, `grow_arrow` seçiliydi) `enterAnim` otomatik olarak `'fade_in'`'e, `exitAnim`
`'none'`'a sıfırlanır (`commitState()` ile).

### Koşullu parametre kontrolleri

```
[Giriş Animasyonu ▼]           [0.5s]
  grow_from_edge seçiliyse →   [Yön ▼: Sol | Sağ | Yukarı | Aşağı]
  fade_in_large  seçiliyse →   [Ölçek: 1.5 ]

[Çıkış Animasyonu ▼]           [0.5s]
  fade_out_large seçiliyse →   [Ölçek: 1.5 ]
```

Atom bileşenler: yön için `<select>` (mevcut `AnnotationSettings.vue` target picker
paterniyle aynı); ölçek için mevcut `Num` bileşeni (min 1.1, max 5.0, adım 0.1).

---

## Codegen (`@manim/codegen/src/index.ts`)

### Giriş case'leri (mevcut `switch (enterAnim)` bloğuna eklenir)

```ts
case 'draw_border_fill':
  enterCode = `self.play(DrawBorderThenFill(${n})${rt})`;
  break;
case 'grow_arrow':
  enterCode = `self.play(GrowArrow(${n})${rt})`;
  break;
case 'grow_from_edge': {
  const dir = (o.enterAnimDir ?? 'LEFT') as string;
  enterCode = `self.play(GrowFromEdge(${n}, edge=${dir})${rt})`;
  break;
}
case 'fade_in_large': {
  const sc = (o.enterAnimScale ?? 1.5).toFixed(1);
  enterCode = `self.play(FadeIn(${n}, scale=${sc})${rt})`;
  break;
}
```

### Çıkış case'leri

```ts
case 'unwrite':
  exitCode = `self.play(Unwrite(${n})${rt})`;
  break;
case 'fade_out_large': {
  const sc = (o.exitAnimScale ?? 1.5).toFixed(1);
  exitCode = `self.play(FadeOut(${n}, scale=${sc})${rt})`;
  break;
}
```

---

## Canvas Önizleme (`engine/playback.ts`)

Yaklaşık simülasyonlar (tam doğruluk beklenmez):

| Preset | Önizleme davranışı |
|---|---|
| `draw_border_fill` | `draw` ile aynı (opacity 0→1) |
| `grow_arrow` | `grow_in` ile aynı (scale 0→1) |
| `grow_from_edge` | yöne göre karşılık gelen `fly_in_*` ile aynı (shift simülasyonu) |
| `fade_in_large` | opacity 0→1 + scale `enterAnimScale`→1 |
| `unwrite` | `fade_out` ile aynı (opacity 1→0) |
| `fade_out_large` | opacity 1→0 + scale 1→`exitAnimScale` |

---

## Round-Trip Parser (`services/web/src/export/manim.ts`)

Yeni regex dalları (tek satır constructor kuralı):

```ts
/self\.play\(DrawBorderThenFill\((\w+)/
/self\.play\(GrowArrow\((\w+)/
/self\.play\(GrowFromEdge\((\w+),\s*edge=(\w+)/      // dir → enterAnimDir
/self\.play\(FadeIn\((\w+),\s*scale=([\d.]+)/         // scale varsa → fade_in_large
/self\.play\(Unwrite\((\w+)/
/self\.play\(FadeOut\((\w+),\s*scale=([\d.]+)/         // scale varsa → fade_out_large
```

`FadeIn(n)` (scale yok) → mevcut `fade_in` olarak kalır.
`FadeOut(n)` (scale yok) → mevcut `fade_out` olarak kalır.

---

## Testler

**`services/web/tests/components/extended-anim-presets.test.ts`**

### 1. Codegen string testleri (byte-kararlılık)

- Her 6 yeni preset için sabit girdi → beklenen Python satırı
- `grow_from_edge`: LEFT / RIGHT / UP / DOWN dört yön
- `fade_in_large`: scale=1.5 ve scale=2.0
- `fade_out_large`: scale=1.5
- Eski presetlerin çıktısı değişmedi (regresyon guard)

### 2. Tip filtresi testleri

```ts
availableEnterAnims('image')   // grow_arrow yok; draw_border_fill yok; typewriter yok
availableEnterAnims('arrow')   // grow_arrow var
availableEnterAnims('text')    // typewriter var
availableEnterAnims('circle')  // typewriter yok; grow_arrow yok
availableExitAnims('image')    // unwrite yok; typewriter_out yok
```

### 3. Round-trip testleri

`generateScene` → `parseManimScript` → orijinal `enterAnim`/`exitAnim` +
`enterAnimDir`/`enterAnimScale`/`exitAnimScale` alanlarına eşleşme (her 6 yeni preset).

### 4. Store action testleri

- `setEnterAnimDir` doğru nesneyi günceller, `commitState()` çağrılır
- `setEnterAnimScale` doğru nesneyi günceller, `commitState()` çağrılır
- `setExitAnimScale` doğru nesneyi günceller, `commitState()` çağrılır

---

## Dosyalar

| Dosya | Değişiklik |
|---|---|
| `packages/manim-codegen/src/types.ts` | `enterAnimDir`, `enterAnimScale`, `exitAnimScale` alanları |
| `packages/manim-codegen/src/index.ts` | 6 yeni animasyon case'i |
| `services/web/src/store/project.ts` | 3 yeni action |
| `services/web/src/export/manim.ts` | 6 yeni parser dalı |
| `services/web/src/engine/playback.ts` | 6 yeni önizleme davranışı |
| `services/web/src/components/inspector/panels/ObjectInspector.vue` | filtrelenmiş dropdown + parametre kontrolleri |
| `services/web/tests/components/extended-anim-presets.test.ts` | yeni test dosyası |

---

## Bilinen Kısıtlamalar

- **Canvas önizleme yaklaşık:** `DrawBorderThenFill`'in iki fazlı çizim efekti önizlemede
  simüle edilmez; Manim render'ında doğru görünür.
- **`grow_arrow` fallback yok:** Yanlış tipe atanmasını engellemek için filtreleme zorunludur;
  `GrowArrow` yalnızca Manim `Arrow` sınıfında çalışır.
- **`FadeIn(scale=…)` anlambilimi:** Manim'de `scale > 1` büyükten küçüğe (zoom out giriş);
  `scale < 1` küçükten normale. Inspector'da bunu açıklayan kısa bir ipucu notu eklenir.
