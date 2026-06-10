# Template Kütüphanesi Genişletme — Tasarım

**Tarih:** 2026-06-10
**Kapsam:** 10 yeni matematik/programlama şablonu, Template'e category alanı, NewProjectDialog'da kategori chip filtresi
**Base branch:** `main`

---

## Hedef

Mevcut 5 şablonu (Boş Proje, Formül Tanıtım, Şekil Dönüşümü, Başlık Slaydı, Koordinat Sistemi) matematik eğitimi odaklı 10 yeni şablonla genişlet. Şablon sayısı artınca bulmayı kolaylaştırmak için NewProjectDialog'a kategori chip filtresi ekle.

## Non-Goals

- Yeni nesne tipi ekleme (tüm şablonlar mevcut tiplerle çözülür)
- Arama kutusu veya hover önizleme (kapsam dışı)
- Şablon düzenleme / kaydetme (ayrı kapsam)

---

## Veri Modeli

**`services/web/src/templates/index.ts`**

`Template` interface'ine `category` alanı eklenir:

```ts
export type TemplateCategory =
  | 'general'
  | 'calculus'
  | 'linear_algebra'
  | 'trigonometry'
  | 'statistics'
  | 'programming';

export interface Template {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  project: (() => TemplateProject) | null;
}
```

Mevcut 5 şablon `'general'` kategorisine atanır.

---

## Yeni 10 Şablon

| # | ID | Etiket | Kategori | İkon | Kullanılan Nesne Tipleri |
|---|---|---|---|---|---|
| 1 | `limit_approach` | Limit Yaklaşımı | `calculus` | `lim` | `numberplane`, `dot`, `latex` |
| 2 | `derivative_tangent` | Türev Teğet | `calculus` | `∂` | `axes` (graph+tangent), `latex` |
| 3 | `integral_area` | İntegral Alan | `calculus` | `∫` | `axes` (graph+riemann), `latex` |
| 4 | `vector_addition` | Vektör Toplama | `linear_algebra` | `→` | `vector_components` ×2, `arrow`, `latex` |
| 5 | `matrix_product` | Matris Çarpımı | `linear_algebra` | `⊗` | `matrix` ×3, `latex` |
| 6 | `unit_circle` | Birim Çember | `trigonometry` | `○` | `numberplane`, `circle`, `angle`, `coord_point`, `latex` |
| 7 | `sin_cos_wave` | Sin & Cos Grafiği | `trigonometry` | `∿` | `axes` (graph ×2) |
| 8 | `normal_distribution` | Normal Dağılım | `statistics` | `⌒` | `axes` (graph), `latex` |
| 9 | `theorem_proof` | Teorem İspatı | `general` | `∎` | `latex` ×2, `text` ×2 |
| 10 | `algo_steps` | Algoritma Adımları | `programming` | `⚙` | `text` ×3, `arrow` ×2, `rectangle` ×3 |

### Şablon İçerik Notları

**`limit_approach`**
- `numberplane`: merkez, tam sahne genişliği
- `dot` (kırmızı): x = 1.8 konumunda, `count` animasyonuyla x = 2'ye yaklaşır (enterAnim: `grow_in`)
- `latex`: `\lim_{x \to 2} f(x) = 4`, sahne üst orta
- Sahne süresi: 6s

**`derivative_tangent`**
- `axes`: xRange `[-3,3,1]`, yRange `[-1,5,1]`
- `axes.graphs[0]`: `x**2`, tüm aralık (enterAnim: `draw`)
- `axes.graphs[0].tangent`: `x=1`, teğet çizgisi
- `latex`: `f'(x) = 2x`, `f'(1) = 2`
- Sahne süresi: 7s

**`integral_area`**
- `axes`: xRange `[0,4,1]`, yRange `[0,5,1]`
- `axes.graphs[0]`: `x**2`, xMin=0, xMax=3
- `axes.graphs[0].riemann`: dx=0.5, show çubukları (enterAnim: `draw`)
- `axes.graphs[0].area`: xMin=0, xMax=3
- `latex`: `\int_0^3 x^2\,dx = 9`
- Sahne süresi: 7s

**`vector_addition`**
- 2× `vector_components`: v1 = (300, -200)px, v2 = (200, -300)px
- Sonuç `arrow`: v1+v2 bileşik vektör
- `latex`: `\vec{u} + \vec{v}`
- Sahne süresi: 6s

**`matrix_product`**
- 3× `matrix` 2×2: A, B, A·B
- `latex`: `A \cdot B =`
- enterAnim: `grow_in` sırayla
- Sahne süresi: 7s

**`unit_circle`**
- `numberplane`: r aralığı [-1.5, 1.5]
- `circle`: merkez (960,540), yarıçap = sahnenin ~%18'i, şeffaf dolgu
- `angle`: vertex=merkez, 45° gösterimi
- `coord_point`: P noktası (cos45°, sin45°)
- `latex`: `(\cos\theta,\,\sin\theta)`
- Sahne süresi: 6s

**`sin_cos_wave`**
- `axes`: xRange `[0, 2*3.14159, 1.57]`, yRange `[-1.5, 1.5, 0.5]`
- `graphs[0]`: `sin(x)`, renk mavi (enterAnim: `draw`)
- `graphs[1]`: `cos(x)`, renk kırmızı (enterAnim: `draw`, 1s gecikme)
- Sahne süresi: 7s

**`normal_distribution`**
- `axes`: xRange `[-4,4,1]`, yRange `[0,0.5,0.1]`
- `graphs[0]`: `2.718**(-(x**2)/2)/2.507`, tam Gauss eğrisi
- `graphs[0].area`: xMin=-1, xMax=1 (±1σ bölgesi)
- `latex`: `\mathcal{N}(0,1)`, `68\%`
- Sahne süresi: 6s

**`theorem_proof`**
- `latex`: teorem ifadesi, büyük (enterAnim: `write`)
- `text`: "Kanıt:", küçük üst başlık
- `text`: açıklama satırı (enterAnim: `fly_in_bottom`)
- `latex`: sonuç `\square` (Q.E.D.)
- Sahne süresi: 10s

**`algo_steps`**
- 3× `rectangle` (adım kutusu): Başlat → İşle → Bitir
- 3× `text` adım etiketi
- 2× `arrow` bağlantı
- enterAnim: sıralı `fade_in`, 1s aralıklı
- Sahne süresi: 8s

---

## NewProjectDialog UI

**`services/web/src/components/topbar/NewProjectDialog.vue`**

### Değişiklikler

1. `selectedCategory` ref eklenir (başlangıç: `'all'`)
2. `filteredTemplates` computed:
   ```ts
   const filteredTemplates = computed(() =>
     selectedCategory.value === 'all'
       ? templates
       : templates.filter((t) => t.category === selectedCategory.value)
   );
   ```
3. Template import'una `TemplateCategory` tipi eklenir
4. Kategori chip listesi (Tümü | Genel | Calculus | Lineer Cebir | Trigonometri | İstatistik | Programlama)
5. Grid `overflow-y: auto; max-height: 320px` ile kaydırılabilir

### Kategori Çevirileri (görüntü etiketi)

```ts
const CATEGORY_LABELS: Record<string, string> = {
  all: 'Tümü',
  general: 'Genel',
  calculus: 'Calculus',
  linear_algebra: 'Lineer Cebir',
  trigonometry: 'Trigonometri',
  statistics: 'İstatistik',
  programming: 'Programlama',
};
```

### Layout (metin mockup)

```
[Tümü] [Genel] [Calculus] [Lineer Cebir]
[Trigonometri] [İstatistik] [Programlama]

┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  □   │ │  ∑   │ ...                │  ← kaydırılabilir
└──────┘ └──────┘                    │
                                     ▼
```

---

## Testler

**`services/web/tests/components/template-library.test.ts`** (yeni dosya)

### 1. Veri bütünlüğü

```ts
it('her şablonun geçerli bir category değeri var', () => {
  const valid = ['general','calculus','linear_algebra','trigonometry','statistics','programming'];
  TEMPLATES.forEach(t => expect(valid).toContain(t.category));
});

it('null olmayan her şablonun project() fonksiyonu TemplateProject döndürür', () => {
  TEMPLATES.filter(t => t.project !== null).forEach(t => {
    const proj = t.project!();
    expect(proj.objects.length).toBeGreaterThan(0);
    expect(proj.sceneDuration).toBeGreaterThan(0);
  });
});
```

### 2. Kategori filtresi

```ts
it('calculus filtresi yalnızca calculus şablonları döndürür', () => {
  const result = TEMPLATES.filter(t => t.category === 'calculus');
  expect(result.length).toBe(3); // limit, türev, integral
  result.forEach(t => expect(t.category).toBe('calculus'));
});

it('all filtresi tüm şablonları döndürür', () => {
  expect(TEMPLATES.length).toBeGreaterThanOrEqual(15); // 5 mevcut + 10 yeni
});
```

### 3. Codegen geçerliliği

```ts
it('her şablonun project() çıktısı geçerli Manim kodu üretir', () => {
  TEMPLATES.filter(t => t.project !== null).forEach(t => {
    const code = generateManimScript(t.project!() as unknown as Project);
    expect(code).toContain('class MainScene');
    expect(code).not.toContain('undefined');
  });
});
```

### 4. NewProjectDialog snapshot

Calculus filtresi seçiliyken render snapshot'ı — yalnızca limit/türev/integral kartlarının göründüğü doğrulanır.

---

## Dosyalar

| Dosya | Değişiklik |
|---|---|
| `services/web/src/templates/index.ts` | `TemplateCategory` tipi, `category` alanı mevcut 5'e, 10 yeni factory |
| `services/web/src/components/topbar/NewProjectDialog.vue` | `selectedCategory` ref, `filteredTemplates` computed, kategori chip UI, scroll grid |
| `services/web/tests/components/template-library.test.ts` | Yeni test dosyası (veri, filtre, codegen, snapshot) |

---

## Bilinen Kısıtlamalar

- **Canvas önizleme hassasiyeti:** `sin(x)` ve `cos(x)` graph önizlemesi engine'de `safeMathExpr` ile değerlendirilir; Manim render'ında tam doğruluk beklenir.
- **`2*3.14159` kullanımı:** `sin_cos_wave` şablonunda `π` doğrudan `3.14159` ile yazılır (safeMathExpr whitelist sadece `[0-9a-zA-Z()+\-*/.%^, ]` içerir; `PI` veya `math.pi` desteklenmez).
- **`algo_steps` basit:** Akış şeması tam otomasyon değil; kutu/ok konumları sabit koordinatlarla tanımlanır.
