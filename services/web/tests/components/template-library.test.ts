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
    const calculus = TEMPLATES.filter((t) => t.category === 'calculus' && t.project !== null);
    calculus.forEach((t) => {
      const proj = t.project!();
      const hasAxesOrPlane = proj.objects.some(
        (o) => o.type === 'axes' || o.type === 'numberplane'
      );
      expect(hasAxesOrPlane).toBe(true);
    });
  });
});

// The unit-circle lesson must be geometrically true: one plane unit is the
// circle's radius, P sits on the circle, the angle's second ray ends at P,
// and the cos/sin segments are P's projections.
describe('unit_circle template geometry', () => {
  type Obj = Record<string, unknown> & { x: number; y: number; width: number; height: number };
  const proj = TEMPLATES.find((t) => t.id === 'unit_circle')!.project!() as unknown as {
    objects: Obj[];
  };
  const byName = (name: string): Obj => {
    const o = proj.objects.find((x) => x.name === name);
    if (!o) throw new Error(`missing object ${name}`);
    return o;
  };
  const plane = byName('Düzlem');
  const xr = plane.xRange as number[];
  const unit = plane.width / (xr[1] - xr[0]);

  it('draws the grid step it declares', () => {
    expect(plane.xStep).toBe(xr[2]);
    expect(plane.yStep).toBe((plane.yRange as number[])[2]);
    expect(
      plane.height / ((plane.yRange as number[])[1] - (plane.yRange as number[])[0])
    ).toBeCloseTo(unit, 6);
  });

  it('has a circle of radius one plane unit, centred on the origin', () => {
    const c = byName('Birim Çember');
    expect(c.width / 2).toBeCloseTo(unit, 1);
    expect([c.x, c.y]).toEqual([plane.x, plane.y]);
  });

  it('puts P on the circle, at the end of the angle ray', () => {
    const p = byName('P');
    const ang = byName('Açı θ');
    const dx = p.x - plane.x;
    const dy = p.y - plane.y;
    expect(Math.hypot(dx, dy)).toBeCloseTo(unit, 0);
    expect([ang.x, ang.y]).toEqual([plane.x, plane.y]);
    expect(ang.vertex).toEqual([0, 0]);
    const p2 = ang.point2 as number[];
    expect(p2[0]).toBeCloseTo(dx, 0);
    expect(p2[1]).toBeCloseTo(dy, 0);
    expect(ang.radius as number).toBeLessThan(1); // Manim units, not pixels
  });

  it('projects P onto the axes with the cos and sin segments', () => {
    const p = byName('P');
    const cos = byName('cos θ');
    const sin = byName('sin θ');
    expect(cos.width).toBeCloseTo(p.x - plane.x, 0);
    expect(cos.x).toBeCloseTo((plane.x + p.x) / 2, 0);
    expect(cos.y).toBe(plane.y);
    expect(sin.width).toBeCloseTo(plane.y - p.y, 0);
    expect(Math.abs(sin.rotation as number)).toBe(90);
    expect(sin.x).toBeCloseTo(p.x, 0);
    expect(sin.y).toBeCloseTo((plane.y + p.y) / 2, 0);
  });
});
