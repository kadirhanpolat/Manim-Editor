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

describe('bezier codegen', () => {
  it('emits VMobject + set_points_smoothly + set_stroke', () => {
    store.addObject('bezier', 960, 540);
    const py = generateManimScript(store.project);
    expect(py).toMatch(/= VMobject\(\)/);
    expect(py).toMatch(/\.set_points_smoothly\(\[\[/);
    expect(py).toMatch(/\.set_stroke\(color=/);
  });

  it('round-trips vertices through the parser', () => {
    const o = store.addObject('bezier', 960, 540);
    store.updateObject(o.id, {
      vertices: [
        [-100, 0],
        [0, -80],
        [100, 0],
      ],
    });
    const parsed = parseManimScript(generateManimScript(store.project));
    const bz = parsed.objects.find((x) => x.type === 'bezier');
    expect(bz).toBeTruthy();
    expect(bz.vertices.length).toBe(3);
    expect(bz.vertices[0][0]).toBeCloseTo(-100, -1);
    expect(bz.vertices[1][1]).toBeCloseTo(-80, -1);
  });
});
