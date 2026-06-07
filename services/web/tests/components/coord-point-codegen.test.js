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

describe('coord_point codegen', () => {
  it('emits Dot + always_redraw live label + VGroup', () => {
    store.addObject('coord_point', 960, 540);
    const py = generateManimScript(store.project);
    expect(py).toMatch(/_dot = Dot\(\[0, 0, 0\]/);
    expect(py).toMatch(/_label = always_redraw\(lambda: MathTex\(f"/);
    expect(py).toContain('.get_x():.1f');
    expect(py).toMatch(/= VGroup\(\w+_dot, \w+_label\)/);
  });

  it('respects the decimals field in the format spec', () => {
    const o = store.addObject('coord_point', 960, 540);
    store.updateObject(o.id, { decimals: 3 });
    expect(generateManimScript(store.project)).toContain('.get_x():.3f');
  });

  it('round-trips through the parser', () => {
    const o = store.addObject('coord_point', 960, 540);
    store.updateObject(o.id, { decimals: 2 });
    const parsed = parseManimScript(generateManimScript(store.project));
    const cp = parsed.objects.find((x) => x.type === 'coord_point');
    expect(cp).toBeTruthy();
    expect(cp.decimals).toBe(2);
  });
});
