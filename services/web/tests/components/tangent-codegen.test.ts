import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('T', 'visual');
});

function axesWithTangent(tangent) {
  const o = store.addObject('axes', 960, 540);
  store.addGraph(o.id);
  const g = store.objectById(o.id).graphs[0];
  store.updateGraph(o.id, g.id, { expression: 'x**2', xMin: -3, xMax: 3, tangent });
  return generateManimScript(store.project);
}

describe('graph tangent line codegen', () => {
  // TangentLine's alpha is a proportion of the curve's ARC LENGTH, not of x:
  // a linear x→alpha map put the x²-tangent for x=1 at x≈1.39. The point is
  // located on the graph by x instead (checked in Manim 0.20.1: x=1, slope 2).
  it('places the TangentLine at the graph point for x', () => {
    const py = axesWithTangent({ enabled: true, x: 1, length: 2 });
    expect(py).toMatch(
      /_tangent = TangentLine\((\w+), alpha=\1\.proportion_from_point\(\w+\.i2gp\(1, \1\)\), length=2/
    );
  });

  it('omits TangentLine when disabled', () => {
    const py = axesWithTangent({ enabled: false, x: 1, length: 2 });
    expect(py).not.toContain('TangentLine');
  });

  it('clamps x into the graph range', () => {
    const py = axesWithTangent({ enabled: true, x: 99, length: 2 });
    expect(py).toMatch(/\.i2gp\(3, /);
  });

  it('round-trips tangent x/length through the parser', () => {
    const parsed = parseManimScript(axesWithTangent({ enabled: true, x: 1, length: 2.5 }));
    const tg = parsed.objects.find((x) => x.type === 'axes')?.graphs?.[0]?.tangent;
    expect(tg).toBeTruthy();
    expect(tg.enabled).toBe(true);
    expect(tg.x).toBeCloseTo(1, 1);
    expect(tg.length).toBeCloseTo(2.5, 1);
  });
});
