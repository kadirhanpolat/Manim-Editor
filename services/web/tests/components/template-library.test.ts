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
