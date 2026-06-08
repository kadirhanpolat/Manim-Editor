# Math Annotation Tools — Design

**Tarih:** 2026-06-08
**Kapsam:** 3 yeni "bound annotation" nesne tipi — `surrounding_rect`, `underline`, `cross`
**Öncelik:** B/D/A/C sıralamasının ilk adımı (kullanıcı seçimi)
**Base branch:** `main`

---

## Hedef

Matematik ders videolarında formüllerin belirli terimlerini veya denklemleri işaretlemek
için kullanılan üç Manim annotation nesnesi editöre eklenir. Her biri hedef bir nesneye
(`targetId`) bağlı "bound annotation" olarak uygulanır — `brace`/`angle`'ın noktaya
bağlandığı gibi, bunlar bir Manim Mobject'e bağlanır.

## Non-Goals

- `always_redraw` ile dinamik takip (hedef klip ile hareket ettiğinde annotation sabit kalır — kabul edilen fark)
- Annotation'ın başka bir annotation'ı hedef alması
- `SurroundingRectangle` dışındaki Manim annotation tipleri (`Circumscribe` zaten emphasis klip olarak mevcut)
- Gradient / dashed / shadow efektleri (bu tipler hiçbir efekt setine eklenmez)

## Nesne Modeli

Her tip mevcut base alanları taşır (`id, type, name, opacity, zOrder, visible,
enterTime, duration, enterAnim, exitAnim, enterAnimDur, exitAnimDur`).

### `surrounding_rect` → `SurroundingRectangle`

```ts
targetId:     string   // hedef nesnenin ID'si
color:        string   // hex renk, varsayılan '#facc15' (sarı)
strokeWidth:  number   // varsayılan 2
buff:         number   // px cinsinden iç boşluk, varsayılan 10px (Manim'de ~0.1 birim)
cornerRadius: number   // px, varsayılan 0 (keskin köşe)
```

### `underline` → `Underline`

```ts
targetId:    string   // hedef nesnenin ID'si
color:       string   // varsayılan '#f97316' (turuncu)
strokeWidth: number   // varsayılan 2
buff:        number   // alt kenardan px mesafe, varsayılan 6px
```

### `cross` → `Cross`

```ts
targetId:    string   // hedef nesnenin ID'si
color:       string   // varsayılan '#ef4444' (kırmızı)
strokeWidth: number   // varsayılan 3
```

**x/y konumu:** Store'da tutulur ama görsel hesaplamada kullanılmaz — konum hedef
nesnenin bounding box'ından türetilir. Kullanıcı annotation'ı sürükleyemez.
`addObject` çağrıldığında `x/y` varsayılan olarak 0, 0 olarak atanır (hedef nesne
daha sonra inspector'dan seçilir).

## Store Değişiklikleri

- `SHAPE_DEFAULTS` + `SHAPE_COLORS` + `addObject` seeding: 3 yeni tip
- `nameMap`: `surrounding_rect: 'Çerçeve'`, `underline: 'Altı Çizgi'`, `cross: 'Üstü Çizili'`
- Yeni action: `setAnnotationTarget(objId, targetId)` — `commitState()` ile
- **Cascade delete:** `deleteObject(targetId)` çağrıldığında `targetId`'ye bağlı tüm
  annotation nesneler de silinir. `project.ts`'deki `deleteObject` action'ı güncellenir.
- Hiçbir tip `GRADIENT_TYPES`, `DASH_TYPES`, `SHADOW_TYPES`'a eklenmez.

## Canvas Önizlemesi

**Dosya:** `services/web/src/components/stage/configs/relational.ts`

Her tip için saf builder fonksiyon:

```ts
// surrounding_rect
export function surroundingRectConfig(obj, ctx) {
  const target = ctx.objectBounds(obj.targetId);
  if (!target) return null;
  const buff = obj.buff ?? 10;
  return {
    x: target.x - buff, y: target.y - buff,
    width: target.width + buff * 2, height: target.height + buff * 2,
    stroke: obj.color, strokeWidth: obj.strokeWidth,
    cornerRadius: obj.cornerRadius ?? 0, fill: 'transparent',
  };
}

// underline
export function underlineConfig(obj, ctx) {
  const target = ctx.objectBounds(obj.targetId);
  if (!target) return null;
  const buff = obj.buff ?? 6;
  return {
    points: [target.x, target.y + target.height + buff,
             target.x + target.width, target.y + target.height + buff],
    stroke: obj.color, strokeWidth: obj.strokeWidth,
  };
}

// cross — iki çapraz çizgi
export function crossConfig(obj, ctx) {
  const target = ctx.objectBounds(obj.targetId);
  if (!target) return null;
  return [
    { points: [target.x, target.y, target.x + target.width, target.y + target.height],
      stroke: obj.color, strokeWidth: obj.strokeWidth },
    { points: [target.x + target.width, target.y, target.x, target.y + target.height],
      stroke: obj.color, strokeWidth: obj.strokeWidth },
  ];
}
```

`configs/context.ts` kontrat tipine yeni `objectBounds(id)` metodu eklenir;
`StageCanvas.vue` bu metodu hesaplar (her nesnenin `eff(obj)` sonrası `x, y, width, height`
alanlarını döndürür, canvas koordinatlarına `s2c` ile dönüştürülmüş).

**Hedef görünmüyorsa** (`visible === false` veya `opacity === 0`) annotation çizilmez
(builder `null` döner, `StageCanvas` null dönen config'i atlar).

## Codegen (`@manim/codegen`)

**Dosya:** `packages/manim-codegen/src/objects.ts`

```python
# surrounding_rect
n = SurroundingRectangle(target, color="#facc15", stroke_width=2, buff=0.1, corner_radius=0.0)

# underline
n = Underline(target, color="#f97316", stroke_width=2, buff=0.05)

# cross
n = Cross(target, stroke_color="#ef4444", stroke_width=3)
```

- `target` = `vn(obj.targetId)`
- `buff` px → Manim birimi: `buff / stageWidth * FRAME_WIDTH`
- `cornerRadius` px → Manim birimi: aynı oran
- `move_to([x, y, 0])` satırı emit **edilmez** — annotation pozisyonu Manim'de
  hedef Mobject'e göre otomatik ayarlanır. `objectCode`'da bu üç tip `move_to`
  post-construction bloğundan hariç tutulur.

**Topological sort (`index.ts`):** `generateScene` nesneleri emit ederken annotation
nesnelerini (`surrounding_rect`, `underline`, `cross`) hedef nesnesinden sonraya taşır.
Mevcut zOrder sıralaması annotation'lar için ikinci sırada kriter olarak kalır.
Döngüsel bağımlılık mümkün değil (annotation başka bir annotation'ı hedef alamaz).

## Parser (Round-Trip)

**Dosya:** `services/web/src/export/manim.ts`

Tek-satır constructorlar regex ile okunur:

```ts
/^(\w+) = SurroundingRectangle\((\w+),\s*color=(.*?),\s*stroke_width=([\d.]+),\s*buff=([\d.]+),\s*corner_radius=([\d.]+)\)/
/^(\w+) = Underline\((\w+),\s*color=(.*?),\s*stroke_width=([\d.]+),\s*buff=([\d.]+)\)/
/^(\w+) = Cross\((\w+),\s*stroke_color=(.*?),\s*stroke_width=([\d.]+)\)/
```

`vn` → ID reverse map ile `targetId` geri çözümlenir.

## Inspector

**Dosya:** `services/web/src/components/inspector/object-settings/AnnotationSettings.vue`
**Kayıt:** `object-settings/index.ts`'e tek satır

Tüm üç tip ortak bir bileşeni paylaşır; tip-spesifik alanlar `v-if` ile gösterilir.

| Alan | Kontrol | Tipler |
|---|---|---|
| Hedef nesne | `<select>` (sahnedeki nesneler) | hepsi |
| color | ColorRow | hepsi |
| strokeWidth | Num | hepsi |
| buff | Num | surrounding_rect, underline |
| cornerRadius | Num | surrounding_rect |

Hedef silindiğinde (`targetId` boş) inspector "Hedef nesne seçin" uyarısı gösterir.

## Palette

`services/web/src/components/sidebar/AssetSidebar.vue` → mevcut `brace`/`angle`
kartlarının yanına "Vurgu & Annotation" grubu altında üç kart eklenir.

`tests/components/ui-tools-audit.test.ts` — üç yeni tipe kart yoksa test başarısız olur
(mevcut davranış).

## Testler

### Store unit testleri
- `setAnnotationTarget` doğru alanı günceller, `commitState()` çağırır
- `deleteObject(targetId)` cascade: bağlı annotation'lar da silinir
- `targetId` boş annotation'da canvas builder `null` döner

### Codegen string testleri (byte-kararlılık)
- Her tip için sabit girdi → beklenen Python çıktısı
- `move_to` satırı emit edilmediği doğrulanır
- Topological sort: annotation hedeften sonra gelir (iki nesneli senaryo)

### Round-trip testleri
- `generateScene` → `parseManimScript` → orijinal veriye eşleşme (her üç tip)

### Parity
- `@manim/codegen` ile `manim.ts` aynı girdi için byte-identical çıktı üretir

## Dosyalar

| Dosya | Değişiklik |
|---|---|
| `packages/manim-codegen/src/objects.ts` | 3 yeni case kolu |
| `packages/manim-codegen/src/index.ts` | topological sort |
| `services/web/src/store/project.ts` | defaults, nameMap, `setAnnotationTarget`, cascade delete |
| `services/web/src/export/manim.ts` | 3 parser branch + generator mirror |
| `services/web/src/components/stage/configs/relational.ts` | 3 builder fonksiyon |
| `services/web/src/components/stage/configs/context.ts` | `objectBounds` kontrat tipi |
| `services/web/src/components/stage/StageCanvas.vue` | 3 yeni tip için template branch |
| `services/web/src/components/inspector/object-settings/AnnotationSettings.vue` | yeni bileşen |
| `services/web/src/components/inspector/object-settings/index.ts` | 3 kayıt satırı |
| `services/web/src/components/sidebar/AssetSidebar.vue` | 3 palette kartı |
| `services/web/tests/components/annotation-tools.test.ts` | store + codegen + round-trip |

## Bilinen Kısıtlamalar

- **Dinamik takip yok:** Hedef bir klip ile hareket ettiğinde annotation Manim
  render'ında sabit kalır. Önizleme de statik. `always_redraw` ile dinamik takip kapsam dışı.
- **Hedef bağımlılığı:** Annotation, `targetId`'si olan nesne tanımlanmadan önce
  emit edilemez — topological sort bunu garanti eder ama zOrder görsel sıralaması
  kullanıcı tarafından bilinçli ayarlanmalıdır.
