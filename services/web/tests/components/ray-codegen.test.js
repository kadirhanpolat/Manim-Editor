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

describe('ray codegen', () => {
  it('emits a Dot source + Arrow + VGroup', () => {
    store.addObject('ray', 960, 540);
    const py = generateManimScript(store.project);
    expect(py).toMatch(/_dot = Dot\(\[0, 0, 0\], color=/);
    expect(py).toMatch(/_ray = Arrow\(\[0, 0, 0\], \[/);
    expect(py).toMatch(/= VGroup\(\w+_dot, \w+_ray\)/);
  });

  it('round-trips angle/length through the parser', () => {
    const o = store.addObject('ray', 960, 540);
    store.updateObject(o.id, { angle: 45, length: 280 });
    const parsed = parseManimScript(generateManimScript(store.project));
    const ray = parsed.objects.find(x => x.type === 'ray');
    expect(ray).toBeTruthy();
    expect(ray.length).toBeCloseTo(280, 0);
    expect(ray.angle).toBeCloseTo(45, 0);
  });
});
