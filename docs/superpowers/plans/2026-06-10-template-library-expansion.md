# Template Kütüphanesi Genişletme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `templates/index.ts`'e kategori sistemi ve 10 yeni matematik/programlama şablonu ekle; `NewProjectDialog.vue`'ya kategori chip filtresi koy.

**Architecture:** `TemplateCategory` tipi `templates/index.ts`'e, `category` alanı `Template` interface'ine eklenir. `NewProjectDialog.vue`'da `selectedCategory` ref + `filteredTemplates` computed ile chip filtresi çalışır. 10 yeni şablon mevcut nesne tipleriyle (axes, matrix, vector_components, numberplane, vb.) oluşturulur — yeni nesne tipi eklenmez.

**Tech Stack:** Vue 3 + `<script setup lang="ts">`, Pinia (`useProjectStore`, `uid`), `@manim/codegen` (`generateManimScript`), Vitest, `@vue/test-utils`

---

## Dosya Haritası

| Dosya | Değişiklik |
|---|---|
| `services/web/src/templates/index.ts` | `TemplateCategory` tipi, `Template.category` alanı, mevcut 5'e `'general'` atama, 10 yeni factory |
| `services/web/src/components/topbar/NewProjectDialog.vue` | `selectedCategory` ref, `filteredTemplates` computed, chip UI, scroll grid |
| `services/web/tests/components/template-library.test.ts` | Yeni: veri bütünlüğü, filtre, codegen, snapshot testleri |

---

### Task 1: TemplateCategory tipi ve mevcut şablonlara category ekle

**Files:**
- Modify: `services/web/src/templates/index.ts`

- [ ] **Step 1: `TemplateCategory` tipi ekle ve `Template` interface'ini güncelle**

`services/web/src/templates/index.ts` dosyasını aç. Satır 1'deki `import` bloğundan SONRA, `TemplateProject` interface'inden ÖNCE şu tipi ekle:

```ts
export type TemplateCategory =
  | 'general'
  | 'calculus'
  | 'linear_algebra'
  | 'trigonometry'
  | 'statistics'
  | 'programming';
```

Ardından `Template` interface'ini şu hale getir:

```ts
export interface Template {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  project: (() => TemplateProject) | null;
}
```

- [ ] **Step 2: Mevcut 5 şablona `category: 'general'` ekle**

`TEMPLATES` array'indeki her 5 nesneye `category: 'general'` alanı ekle:

- `blank` → `category: 'general'`
- `formula_reveal` → `category: 'general'`
- `shape_transform` → `category: 'general'`
- `title_slide` → `category: 'general'`
- `axes_intro` → `category: 'general'`

- [ ] **Step 3: Typecheck çalıştır**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck 2>&1 | tail -10
```

Beklenen: hata yok (eski şablonlarda `category` alanı eksikse TypeScript hatası — Step 2 doğru uygulandıysa geçer).

- [ ] **Step 4: Commit**

```bash
cd D:/PYTHON/Manim-Editor && git add services/web/src/templates/index.ts && git commit -m "feat(templates): add TemplateCategory type and category field to existing templates"
```

---

### Task 2: Test dosyasını yaz (TDD — önce testler)

**Files:**
- Create: `services/web/tests/components/template-library.test.ts`

- [ ] **Step 1: Test dosyasını oluştur**

```ts
// services/web/tests/components/template-library.test.ts
import { describe, it, expect } from 'vitest';
import TEMPLATES, { type TemplateCategory } from '../../src/templates/index.js';
import { generateManimScript } from '../../src/export/manim.js';
import type { Project } from '@manim/codegen';

const VALID_CATEGORIES: TemplateCategory[] = [
  'general',
  'calculus',
  'linear_algebra',
  'trigonometry',
  'statistics',
  'programming',
];

describe('template veri bütünlüğü', () => {
  it('her şablonun geçerli bir category değeri var', () => {
    TEMPLATES.forEach((t) => {
      expect(VALID_CATEGORIES).toContain(t.category);
    });
  });

  it('her şablonun id, label, icon alanları dolu', () => {
    TEMPLATES.forEach((t) => {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeGreaterThan(0);
    });
  });

  it('null olmayan her şablonun project() fonksiyonu en az 1 nesne döndürür', () => {
    TEMPLATES.filter((t) => t.project !== null).forEach((t) => {
      const proj = t.project!();
      expect(proj.objects.length).toBeGreaterThan(0);
      expect(proj.sceneDuration).toBeGreaterThan(0);
    });
  });
});

describe('kategori filtresi', () => {
  it('calculus kategorisinde 3 şablon var', () => {
    const result = TEMPLATES.filter((t) => t.category === 'calculus');
    expect(result).toHaveLength(3);
  });

  it('linear_algebra kategorisinde 2 şablon var', () => {
    expect(TEMPLATES.filter((t) => t.category === 'linear_algebra')).toHaveLength(2);
  });

  it('trigonometry kategorisinde 2 şablon var', () => {
    expect(TEMPLATES.filter((t) => t.category === 'trigonometry')).toHaveLength(2);
  });

  it('statistics kategorisinde 1 şablon var', () => {
    expect(TEMPLATES.filter((t) => t.category === 'statistics')).toHaveLength(1);
  });

  it('programming kategorisinde 1 şablon var', () => {
    expect(TEMPLATES.filter((t) => t.category === 'programming')).toHaveLength(1);
  });

  it('toplam şablon sayısı 15 veya daha fazla', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(15);
  });
});

describe('codegen geçerliliği', () => {
  it('her şablonun project() çıktısı geçerli Manim kodu üretir', () => {
    TEMPLATES.filter((t) => t.project !== null).forEach((t) => {
      const proj = t.project!();
      const code = generateManimScript(proj as unknown as Project);
      expect(code).toContain('class MainScene');
      expect(code).not.toContain('undefined');
    });
  });

  it('calculus şablonları axes veya numberplane içerir', () => {
    const calculus = TEMPLATES.filter((t) => t.category === 'calculus');
    calculus.forEach((t) => {
      const proj = t.project!();
      const hasAxesOrPlane = proj.objects.some(
        (o) => o.type === 'axes' || o.type === 'numberplane'
      );
      expect(hasAxesOrPlane).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Testleri çalıştır — başarısız olduklarını doğrula**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npx vitest run tests/components/template-library.test.ts 2>&1 | tail -20
```

Beklenen: `calculus kategorisinde 3 şablon var` ve `toplam şablon sayısı 15+` testleri FAIL (henüz 10 yeni şablon eklenmedi).

- [ ] **Step 3: Commit**

```bash
cd D:/PYTHON/Manim-Editor && git add services/web/tests/components/template-library.test.ts && git commit -m "test(templates): add template library tests (failing — TDD)"
```

---

### Task 3: Calculus şablonları (limit_approach, derivative_tangent, integral_area)

**Files:**
- Modify: `services/web/src/templates/index.ts`

Mevcut `TEMPLATES` array'inin sonundaki `];` kapanış parantezinden ÖNCE aşağıdaki 3 şablonu ekle.

> **Axes graph alan referansı:** `area`: `{ enabled, xMin, xMax, color, opacity }` — `riemann`: `{ enabled, xMin, xMax, dx, type('left'|'right'|'center'), color }` — `tangent`: `{ enabled, x }` (CLAUDE.md `axes` tipinden).

- [ ] **Step 1: `limit_approach` şablonunu ekle**

```ts
  {
    id: 'limit_approach',
    label: 'Limit Yaklaşımı',
    description: 'x → c yaklaşımı ile limit kavramı',
    icon: 'lim',
    category: 'calculus',
    project: () => {
      const np = uid('obj');
      const d1 = uid('obj');
      const d2 = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Limit Yaklaşımı',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 6,
        objects: [
          {
            id: np, type: 'numberplane', name: 'Düzlem',
            x: 960, y: 540, width: 1000, height: 620,
            rotation: 0, fill: '#1e293b', stroke: '#334155', strokeWidth: 1,
            opacity: 1, zOrder: 0,
            xRange: [-5, 5, 1], yRange: [-3, 3, 1],
            enterTime: 0, duration: 5,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.0, exitAnimDur: 0.5,
          },
          {
            id: d1, type: 'dot', name: 'x yaklaşan nokta',
            x: 800, y: 540, width: 20, height: 20,
            rotation: 0, fill: '#ef4444', stroke: '#ef4444', strokeWidth: 0,
            opacity: 1, zOrder: 2,
            enterTime: 1.2, duration: 4.8,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
          {
            id: d2, type: 'dot', name: 'Limit noktası',
            x: 960, y: 540, width: 24, height: 24,
            rotation: 0, fill: '#f97316', stroke: '#f97316', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            enterTime: 2.0, duration: 4,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Limit',
            x: 960, y: 160, width: 480, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 4,
            latex: '\\lim_{x \\to 0} f(x) = L',
            enterTime: 1.5, duration: 4.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 2: `derivative_tangent` şablonunu ekle**

```ts
  {
    id: 'derivative_tangent',
    label: 'Türev Teğet',
    description: 'Bir noktada türev ve teğet çizgisi gösterimi',
    icon: '∂',
    category: 'calculus',
    project: () => {
      const ax = uid('obj');
      const lbl = uid('obj');
      const gid = uid('obj');
      return {
        name: 'Türev Teğet',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 8,
        objects: [
          {
            id: ax, type: 'axes', name: 'Eksenler',
            x: 960, y: 560, width: 900, height: 560,
            rotation: 0, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            xRange: [-3, 3, 1], yRange: [-1, 5, 1],
            graphs: [{
              id: gid,
              expression: 'x**2',
              color: '#3b82f6',
              xMin: -2.5,
              xMax: 2.5,
              strokeWidth: 3,
              tangent: { enabled: true, x: 1 },
            }],
            enterTime: 0, duration: 7,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.5, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Türev',
            x: 960, y: 160, width: 500, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            latex: "f'(x) = 2x,\\quad f'(1) = 2",
            enterTime: 2.0, duration: 6.0,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 3: `integral_area` şablonunu ekle**

```ts
  {
    id: 'integral_area',
    label: 'İntegral Alan',
    description: 'Belirli integral ve Riemann alanı gösterimi',
    icon: '∫',
    category: 'calculus',
    project: () => {
      const ax = uid('obj');
      const lbl = uid('obj');
      const gid = uid('obj');
      return {
        name: 'İntegral Alan',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: ax, type: 'axes', name: 'Eksenler',
            x: 960, y: 570, width: 900, height: 560,
            rotation: 0, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            xRange: [0, 4, 1], yRange: [0, 5, 1],
            graphs: [{
              id: gid,
              expression: 'x**2',
              color: '#3b82f6',
              xMin: 0,
              xMax: 3,
              strokeWidth: 3,
              area: { enabled: true, xMin: 0, xMax: 3, color: '#3b82f6', opacity: 0.3 },
              riemann: { enabled: true, xMin: 0, xMax: 3, dx: 0.5, type: 'right', color: '#22c55e' },
            }],
            enterTime: 0, duration: 6,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.5, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'İntegral',
            x: 960, y: 160, width: 440, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            latex: '\\int_0^3 x^2\\,dx = 9',
            enterTime: 2.0, duration: 5.0,
            enterAnim: 'write', exitAnim: 'none',
            enterAnimDur: 1.0, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 4: Calculus testlerini çalıştır**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npx vitest run tests/components/template-library.test.ts 2>&1 | tail -15
```

Beklenen: `calculus kategorisinde 3 şablon var` PASS; diğer eksik kategoriler hâlâ FAIL.

- [ ] **Step 5: Commit**

```bash
cd D:/PYTHON/Manim-Editor && git add services/web/src/templates/index.ts && git commit -m "feat(templates): add calculus templates (limit, derivative, integral)"
```

---

### Task 4: Linear Algebra + Trigonometry şablonları

**Files:**
- Modify: `services/web/src/templates/index.ts`

> **`vector_components` alan referansı:** `vx`/`vy` (px; vy < 0 = yukarı), `x`/`y` nesnenin başlangıç noktası (sahne koordinatı). Nesne hem ana oku hem bileşen oklarını VGroup olarak oluşturur.
>
> **`matrix` alan referansı:** `matrixData: string[][]`, `bracket: '['|'('|'|'`.

- [ ] **Step 1: `vector_addition` şablonunu ekle**

```ts
  {
    id: 'vector_addition',
    label: 'Vektör Toplama',
    description: 'İki vektörün bileşke toplamı gösterimi',
    icon: '→',
    category: 'linear_algebra',
    project: () => {
      const vc1 = uid('obj');
      const vc2 = uid('obj');
      const res = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Vektör Toplama',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: vc1, type: 'vector_components', name: 'u vektörü',
            x: 480, y: 750, width: 400, height: 300,
            rotation: 0, fill: '#3b82f6', stroke: '#3b82f6', strokeWidth: 3,
            opacity: 1, zOrder: 0,
            vx: 400, vy: -300,
            enterTime: 0, duration: 6,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.8, exitAnimDur: 0.5,
          },
          {
            id: vc2, type: 'vector_components', name: 'v vektörü',
            x: 880, y: 450, width: 300, height: 250,
            rotation: 0, fill: '#22c55e', stroke: '#22c55e', strokeWidth: 3,
            opacity: 1, zOrder: 1,
            vx: 300, vy: -200,
            enterTime: 1.0, duration: 5,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.8, exitAnimDur: 0.5,
          },
          {
            id: res, type: 'arrow', name: 'Bileşke',
            x: 480, y: 750, width: 700, height: 500,
            rotation: 0, fill: '#f97316', stroke: '#f97316', strokeWidth: 4,
            opacity: 1, zOrder: 2,
            enterTime: 2.0, duration: 4,
            enterAnim: 'grow_arrow', exitAnim: 'none',
            enterAnimDur: 0.8, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Formül',
            x: 960, y: 160, width: 400, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            latex: '\\vec{u} + \\vec{v} = \\vec{w}',
            enterTime: 2.5, duration: 4.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 2: `matrix_product` şablonunu ekle**

```ts
  {
    id: 'matrix_product',
    label: 'Matris Çarpımı',
    description: 'İki 2×2 matrisin çarpımı',
    icon: '⊗',
    category: 'linear_algebra',
    project: () => {
      const mA = uid('obj');
      const mB = uid('obj');
      const mC = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Matris Çarpımı',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: mA, type: 'matrix', name: 'A',
            x: 480, y: 540, width: 200, height: 160,
            rotation: 0, fill: '#3b82f6', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 0,
            matrixData: [['1', '2'], ['3', '4']],
            bracket: '[',
            enterTime: 0, duration: 6,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.6, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Çarpı',
            x: 720, y: 540, width: 80, height: 60,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            latex: '\\cdot',
            enterTime: 0.7, duration: 5.3,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
          {
            id: mB, type: 'matrix', name: 'B',
            x: 960, y: 540, width: 200, height: 160,
            rotation: 0, fill: '#22c55e', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 2,
            matrixData: [['5', '6'], ['7', '8']],
            bracket: '[',
            enterTime: 0.7, duration: 5.3,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.6, exitAnimDur: 0.5,
          },
          {
            id: mC, type: 'matrix', name: 'Sonuç',
            x: 1380, y: 540, width: 240, height: 160,
            rotation: 0, fill: '#f97316', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            matrixData: [['19', '22'], ['43', '50']],
            bracket: '[',
            enterTime: 2.0, duration: 4,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.6, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 3: `unit_circle` şablonunu ekle**

```ts
  {
    id: 'unit_circle',
    label: 'Birim Çember',
    description: 'Trigonometrik birim çember ve sin/cos gösterimi',
    icon: '○',
    category: 'trigonometry',
    project: () => {
      const np = uid('obj');
      const circ = uid('obj');
      const pt = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Birim Çember',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: np, type: 'numberplane', name: 'Düzlem',
            x: 960, y: 540, width: 700, height: 700,
            rotation: 0, fill: '#1e293b', stroke: '#334155', strokeWidth: 1,
            opacity: 1, zOrder: 0,
            xRange: [-2, 2, 1], yRange: [-2, 2, 1],
            enterTime: 0, duration: 6,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.0, exitAnimDur: 0.5,
          },
          {
            id: circ, type: 'circle', name: 'Birim Çember',
            x: 960, y: 540, width: 270, height: 270,
            rotation: 0, fill: 'transparent', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 1,
            enterTime: 1.0, duration: 5,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.2, exitAnimDur: 0.5,
          },
          {
            id: pt, type: 'coord_point', name: 'P noktası',
            x: 1056, y: 445, width: 20, height: 20,
            rotation: 0, fill: '#ef4444', stroke: '#ef4444', strokeWidth: 0,
            opacity: 1, zOrder: 2,
            decimals: 2,
            enterTime: 2.2, duration: 4.8,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'sin/cos',
            x: 960, y: 160, width: 400, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            latex: 'P = (\\cos\\theta,\\,\\sin\\theta)',
            enterTime: 2.5, duration: 4.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 4: `sin_cos_wave` şablonunu ekle**

```ts
  {
    id: 'sin_cos_wave',
    label: 'Sin & Cos Grafiği',
    description: 'Sinüs ve kosinüs dalgaları karşılaştırması',
    icon: '∿',
    category: 'trigonometry',
    project: () => {
      const ax = uid('obj');
      const g1 = uid('obj');
      const g2 = uid('obj');
      return {
        name: 'Sin & Cos Grafiği',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: ax, type: 'axes', name: 'Eksenler',
            x: 960, y: 560, width: 1100, height: 500,
            rotation: 0, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            xRange: [0, 6.28, 1.57], yRange: [-1.5, 1.5, 0.5],
            graphs: [
              {
                id: g1,
                expression: 'sin(x)',
                color: '#3b82f6',
                xMin: 0,
                xMax: 6.28,
                strokeWidth: 3,
              },
              {
                id: g2,
                expression: 'cos(x)',
                color: '#f97316',
                xMin: 0,
                xMax: 6.28,
                strokeWidth: 3,
              },
            ],
            enterTime: 0, duration: 6,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 2.0, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 5: Testleri çalıştır**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npx vitest run tests/components/template-library.test.ts 2>&1 | tail -15
```

Beklenen: `linear_algebra` (2) ve `trigonometry` (2) testleri PASS; `statistics` ve `programming` hâlâ FAIL.

- [ ] **Step 6: Commit**

```bash
cd D:/PYTHON/Manim-Editor && git add services/web/src/templates/index.ts && git commit -m "feat(templates): add linear algebra and trigonometry templates"
```

---

### Task 5: Statistics + General + Programming şablonları

**Files:**
- Modify: `services/web/src/templates/index.ts`

- [ ] **Step 1: `normal_distribution` şablonunu ekle**

```ts
  {
    id: 'normal_distribution',
    label: 'Normal Dağılım',
    description: 'Gauss eğrisi ve ±1σ alanı gösterimi',
    icon: '⌒',
    category: 'statistics',
    project: () => {
      const ax = uid('obj');
      const lbl = uid('obj');
      const gid = uid('obj');
      return {
        name: 'Normal Dağılım',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 6,
        objects: [
          {
            id: ax, type: 'axes', name: 'Eksenler',
            x: 960, y: 580, width: 1000, height: 500,
            rotation: 0, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            xRange: [-4, 4, 1], yRange: [0, 0.5, 0.1],
            graphs: [{
              id: gid,
              expression: '2.718**(-(x**2)/2)/2.507',
              color: '#3b82f6',
              xMin: -4,
              xMax: 4,
              strokeWidth: 3,
              area: { enabled: true, xMin: -1, xMax: 1, color: '#3b82f6', opacity: 0.35 },
            }],
            enterTime: 0, duration: 5,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.5, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Formül',
            x: 960, y: 160, width: 480, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            latex: '\\mathcal{N}(0,1),\\quad P(|X|\\leq 1)\\approx 68\\%',
            enterTime: 1.8, duration: 4.2,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 2: `theorem_proof` şablonunu ekle**

```ts
  {
    id: 'theorem_proof',
    label: 'Teorem İspatı',
    description: 'Teorem ifadesi ve adım adım kanıt sunumu',
    icon: '∎',
    category: 'general',
    project: () => {
      const thm = uid('obj');
      const hdr = uid('obj');
      const desc = uid('obj');
      const qed = uid('obj');
      return {
        name: 'Teorem İspatı',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 10,
        objects: [
          {
            id: thm, type: 'latex', name: 'Teorem',
            x: 960, y: 280, width: 700, height: 100,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 0,
            latex: 'a^2 + b^2 = c^2',
            enterTime: 0, duration: 9,
            enterAnim: 'write', exitAnim: 'none',
            enterAnimDur: 1.5, exitAnimDur: 0.5,
          },
          {
            id: hdr, type: 'text', name: 'Kanıt Başlığı',
            x: 960, y: 430, width: 300, height: 50,
            rotation: 0, fill: '#94a3b8', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            content: 'Kanıt:',
            fontSize: 28, fontFamily: 'Roboto', textAlign: 'center',
            fontWeight: 'bold', fontStyle: 'normal',
            enterTime: 2.0, duration: 7,
            enterAnim: 'fly_in_bottom', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: desc, type: 'text', name: 'Açıklama',
            x: 960, y: 550, width: 800, height: 80,
            rotation: 0, fill: '#cbd5e1', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 2,
            content: 'Bir dik üçgenin hipotenüsünün karesi, diğer iki kenarın karelerinin toplamına eşittir.',
            fontSize: 22, fontFamily: 'Roboto', textAlign: 'center',
            fontWeight: 'normal', fontStyle: 'normal',
            enterTime: 3.0, duration: 6,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.8, exitAnimDur: 0.5,
          },
          {
            id: qed, type: 'latex', name: 'QED',
            x: 1600, y: 820, width: 80, height: 60,
            rotation: 0, fill: '#94a3b8', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            latex: '\\square',
            enterTime: 6.0, duration: 3,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 3: `algo_steps` şablonunu ekle**

```ts
  {
    id: 'algo_steps',
    label: 'Algoritma Adımları',
    description: 'Adım adım akış diyagramı gösterimi',
    icon: '⚙',
    category: 'programming',
    project: () => {
      const r1 = uid('obj'); const r2 = uid('obj'); const r3 = uid('obj');
      const t1 = uid('obj'); const t2 = uid('obj'); const t3 = uid('obj');
      const a1 = uid('obj'); const a2 = uid('obj');
      return {
        name: 'Algoritma Adımları',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 8,
        objects: [
          {
            id: r1, type: 'rectangle', name: 'Adım 1 Kutu',
            x: 320, y: 540, width: 280, height: 120,
            rotation: 0, fill: '#1e3a5f', stroke: '#3b82f6', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            enterTime: 0, duration: 7,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: t1, type: 'text', name: 'Başlat',
            x: 320, y: 540, width: 260, height: 50,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            content: 'Başlat', fontSize: 28, fontFamily: 'Roboto',
            textAlign: 'center', fontWeight: 'bold', fontStyle: 'normal',
            enterTime: 0.5, duration: 6.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
          {
            id: a1, type: 'arrow', name: 'Ok 1',
            x: 600, y: 540, width: 120, height: 20,
            rotation: 0, fill: '#94a3b8', stroke: '#94a3b8', strokeWidth: 2,
            opacity: 1, zOrder: 2,
            enterTime: 1.0, duration: 6,
            enterAnim: 'grow_arrow', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: r2, type: 'rectangle', name: 'Adım 2 Kutu',
            x: 960, y: 540, width: 280, height: 120,
            rotation: 0, fill: '#1a3a2f', stroke: '#22c55e', strokeWidth: 2,
            opacity: 1, zOrder: 3,
            enterTime: 1.5, duration: 5.5,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: t2, type: 'text', name: 'İşle',
            x: 960, y: 540, width: 260, height: 50,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 4,
            content: 'İşle', fontSize: 28, fontFamily: 'Roboto',
            textAlign: 'center', fontWeight: 'bold', fontStyle: 'normal',
            enterTime: 2.0, duration: 5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
          {
            id: a2, type: 'arrow', name: 'Ok 2',
            x: 1240, y: 540, width: 120, height: 20,
            rotation: 0, fill: '#94a3b8', stroke: '#94a3b8', strokeWidth: 2,
            opacity: 1, zOrder: 5,
            enterTime: 2.5, duration: 4.5,
            enterAnim: 'grow_arrow', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: r3, type: 'rectangle', name: 'Adım 3 Kutu',
            x: 1600, y: 540, width: 280, height: 120,
            rotation: 0, fill: '#3a1a1a', stroke: '#f97316', strokeWidth: 2,
            opacity: 1, zOrder: 6,
            enterTime: 3.0, duration: 4,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: t3, type: 'text', name: 'Bitir',
            x: 1600, y: 540, width: 260, height: 50,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 7,
            content: 'Bitir', fontSize: 28, fontFamily: 'Roboto',
            textAlign: 'center', fontWeight: 'bold', fontStyle: 'normal',
            enterTime: 3.5, duration: 3.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
```

- [ ] **Step 4: Tüm testleri çalıştır**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npx vitest run tests/components/template-library.test.ts 2>&1 | tail -20
```

Beklenen: Tüm 8 test PASS.

- [ ] **Step 5: Tam test suite**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit 2>&1 | tail -5
```

Beklenen: tüm testler geçer.

- [ ] **Step 6: Commit**

```bash
cd D:/PYTHON/Manim-Editor && git add services/web/src/templates/index.ts && git commit -m "feat(templates): add statistics, general, and programming templates"
```

---

### Task 6: NewProjectDialog UI — kategori chip filtresi

**Files:**
- Modify: `services/web/src/components/topbar/NewProjectDialog.vue`

- [ ] **Step 1: `<script setup>` bloğunu güncelle**

Mevcut `<script setup>` içindeki import satırını bul:

```ts
import TEMPLATES from '../../templates/index.js';
import type { Template } from '../../templates/index.js';
```

Şu hale getir:

```ts
import TEMPLATES from '../../templates/index.js';
import type { Template, TemplateCategory } from '../../templates/index.js';
```

Ardından `const templates = TEMPLATES;` satırından SONRA şunları ekle:

```ts
type CategoryFilter = 'all' | TemplateCategory;

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'Tümü',
  general: 'Genel',
  calculus: 'Calculus',
  linear_algebra: 'Lineer Cebir',
  trigonometry: 'Trigonometri',
  statistics: 'İstatistik',
  programming: 'Programlama',
};

const CATEGORY_KEYS: CategoryFilter[] = [
  'all', 'general', 'calculus', 'linear_algebra', 'trigonometry', 'statistics', 'programming',
];

const selectedCategory = ref<CategoryFilter>('all');

const filteredTemplates = computed(() =>
  selectedCategory.value === 'all'
    ? templates
    : templates.filter((t) => t.category === selectedCategory.value)
);
```

Ayrıca `watch` içine `selectedCategory.value = 'all';` sıfırlamasını ekle:

```ts
watch(
  () => props.show,
  (open) => {
    if (open) {
      newProjectName.value = 'My Animation';
      newProjectMode.value = 'visual';
      newProjectTemplate.value = null;
      selectedCategory.value = 'all';   // ← ekle
      nextTick(() => {
        npNameInput.value?.focus();
      });
    }
  }
);
```

`import { ref, watch, nextTick } from 'vue';` satırına `computed` ekle:

```ts
import { ref, watch, nextTick, computed } from 'vue';
```

- [ ] **Step 2: Template `<template>` bloğunu güncelle**

Template içindeki `<template v-if="newProjectMode === 'visual'">` bloğunu bul (satır 60–82). Tüm bloğu şu hale getir:

```html
<!-- Template selector (only for visual mode) -->
<template v-if="newProjectMode === 'visual'">
  <label class="np-label" style="margin-top: 12px">Şablon</label>
  <!-- Category chips -->
  <div class="np-cat-chips">
    <button
      v-for="cat in CATEGORY_KEYS"
      :key="cat"
      class="np-cat-chip"
      :class="{ active: selectedCategory === cat }"
      @click="selectedCategory = cat; newProjectTemplate = null"
    >
      {{ CATEGORY_LABELS[cat] }}
    </button>
  </div>
  <!-- Template grid (scrollable) -->
  <div class="np-tpl-grid">
    <button
      v-for="tpl in filteredTemplates"
      :key="tpl.id"
      class="np-mode-btn"
      :class="{
        active:
          (newProjectTemplate && newProjectTemplate.id === tpl.id) ||
          (!newProjectTemplate && tpl.id === 'blank'),
      }"
      style="text-align: left; padding: 10px 12px"
      @click="newProjectTemplate = tpl.id === 'blank' ? null : tpl"
    >
      <span style="font-size: 18px; display: block; margin-bottom: 4px">{{
        tpl.icon
      }}</span>
      <span class="np-mode-label">{{ tpl.label }}</span>
      <span class="np-mode-desc">{{ tpl.description }}</span>
    </button>
  </div>
</template>
```

- [ ] **Step 3: CSS ekle**

`<style scoped>` bloğunun sonuna (son `}` kapanışından ÖNCE) ekle:

```css
/* ── Template category chips ── */
.np-cat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 6px;
}
.np-cat-chip {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--studio-border);
  background: var(--studio-bg);
  color: var(--studio-text-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.np-cat-chip:hover {
  border-color: var(--studio-accent);
  color: var(--studio-text);
}
.np-cat-chip.active {
  border-color: var(--studio-accent);
  background: var(--studio-accent-subtle);
  color: var(--studio-accent);
}
/* ── Scrollable template grid ── */
.np-tpl-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
  max-height: 320px;
  overflow-y: auto;
}
```

- [ ] **Step 4: Typecheck + lint çalıştır**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck 2>&1 | tail -10
cd D:/PYTHON/Manim-Editor && npm run lint 2>&1 | tail -10
```

Beklenen: hata yok.

- [ ] **Step 5: Snapshot testleri güncelle (eğer değişdiyse)**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npx vitest run -u tests/components/inspector/properties-panel.characterization.test.ts 2>&1 | tail -5
```

`NewProjectDialog` için snapshot yoksa bu adımı geç.

- [ ] **Step 6: Tüm unit testleri çalıştır**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit 2>&1 | tail -5
```

Beklenen: tüm testler geçer.

- [ ] **Step 7: Commit**

```bash
cd D:/PYTHON/Manim-Editor && git add services/web/src/components/topbar/NewProjectDialog.vue && git commit -m "feat(dialog): add category chip filter to NewProjectDialog template selector"
```

---

### Task 7: Final entegrasyon kontrolü

**Files:** Değişiklik yok — sadece doğrulama.

- [ ] **Step 1: Tam unit test suite**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit 2>&1 | tail -5
```

Beklenen: 607+ test, hepsi PASS.

- [ ] **Step 2: Engine testleri**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm test 2>&1 | tail -5
```

Beklenen: 114 test, hepsi PASS.

- [ ] **Step 3: Lint + format + typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run lint 2>&1 | tail -5 && npm run format:check 2>&1 | tail -3 && npm run typecheck 2>&1 | tail -5
```

Beklenen: lint → 0 hata; format → `All matched files use Prettier code style!`; typecheck → hata yok.

- [ ] **Step 4: Prettier uygula (gerekirse)**

Eğer format:check hata verdiyse:

```bash
cd D:/PYTHON/Manim-Editor && npm run format && git add services/web/src/templates/index.ts services/web/src/components/topbar/NewProjectDialog.vue services/web/tests/components/template-library.test.ts && git commit -m "style: prettier format template library expansion"
```

- [ ] **Step 5: Codegen ve API testleri**

```bash
cd D:/PYTHON/Manim-Editor && npm test --workspace packages/manim-codegen 2>&1 | tail -5 && npm test --workspace services/api 2>&1 | tail -5
```

Beklenen: 6 codegen + 43 API testi PASS.
