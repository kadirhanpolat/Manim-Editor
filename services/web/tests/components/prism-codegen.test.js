import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('T', 'visual');
  store.setSceneType('3d');
});

describe('prism codegen', () => {
  it('emits Prism(dimensions=[w, h, d])', () => {
    store.addObject('prism', 0, 0);
    const py = generateManimScript(store.project);
    expect(py).toMatch(/Prism\(dimensions=\[2\.?\d*, 1\.?\d*, 1\.?\d*\]\)/);
  });

  it('round-trips per-axis dimensions through the parser', () => {
    const o = store.addObject('prism', 0, 0);
    store.updateObject(o.id, { dimX: 3, dimY: 1.5, dimZ: 0.5 });
    const parsed = parseManimScript(generateManimScript(store.project));
    const p = parsed.objects.find(x => x.type === 'prism');
    expect(p).toBeTruthy();
    expect(p.dimX).toBeCloseTo(3, 1);
    expect(p.dimY).toBeCloseTo(1.5, 1);
    expect(p.dimZ).toBeCloseTo(0.5, 1);
  });
});
