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
  it('emits TangentLine at the right alpha when enabled', () => {
    // x=1 in [-3,3] → alpha = (1-(-3))/(3-(-3)) = 0.667
    const py = axesWithTangent({ enabled: true, x: 1, length: 2 });
    expect(py).toMatch(/_tangent = TangentLine\(\w+, alpha=0\.667, length=2/);
  });

  it('omits TangentLine when disabled', () => {
    const py = axesWithTangent({ enabled: false, x: 1, length: 2 });
    expect(py).not.toContain('TangentLine');
  });

  it('clamps alpha into [0,1] for out-of-range x', () => {
    const py = axesWithTangent({ enabled: true, x: 99, length: 2 });
    expect(py).toMatch(/alpha=1\.000/);
  });

  it('round-trips tangent x/length through the parser', () => {
    const parsed = parseManimScript(axesWithTangent({ enabled: true, x: 1, length: 2.5 }));
    const tg = parsed.objects.find(x => x.type === 'axes')?.graphs?.[0]?.tangent;
    expect(tg).toBeTruthy();
    expect(tg.enabled).toBe(true);
    expect(tg.x).toBeCloseTo(1, 1);
    expect(tg.length).toBeCloseTo(2.5, 1);
  });
});
