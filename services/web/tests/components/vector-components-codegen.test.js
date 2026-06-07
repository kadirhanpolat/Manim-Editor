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

describe('vector_components codegen', () => {
  it('emits main + x + y arrows, two dashed guides, and a VGroup', () => {
    store.addObject('vector_components', 960, 540);
    const py = generateManimScript(store.project);
    expect(py).toMatch(/_main = Arrow\(\[0, 0, 0\],/);
    expect(py).toContain('color="#ef4444"'); // x component
    expect(py).toContain('color="#22c55e"'); // y component
    expect(py).toMatch(/_dx = DashedLine\(/);
    expect(py).toMatch(/_dy = DashedLine\(/);
    expect(py).toMatch(/= VGroup\(\w+_main, \w+_x, \w+_y, \w+_dx, \w+_dy\)/);
  });

  it('reflects custom vx/vy in the main arrow tip', () => {
    const o = store.addObject('vector_components', 960, 540);
    store.updateObject(o.id, { vx: 240, vy: -135 }); // vy<0 = up in px → +y in Manim
    const py = generateManimScript(store.project);
    const main = py.split('\n').find((l) => l.includes('_main = Arrow'));
    // 240/1920*14.222 ≈ 1.778 ; 135/1080*8 = 1.0
    expect(main).toContain('1.778');
    expect(main).toContain('1.000');
  });

  it('round-trips vx/vy through the .py parser', () => {
    const o = store.addObject('vector_components', 960, 540);
    store.updateObject(o.id, { vx: 200, vy: -100 });
    const parsed = parseManimScript(generateManimScript(store.project));
    const vc = parsed.objects.find((x) => x.type === 'vector_components');
    expect(vc).toBeTruthy();
    expect(vc.vx).toBeCloseTo(200, 0);
    expect(vc.vy).toBeCloseTo(-100, 0);
  });
});
