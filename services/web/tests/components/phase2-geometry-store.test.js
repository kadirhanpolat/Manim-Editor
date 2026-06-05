import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
});

describe('phase 2 geometry object seeds', () => {
  it('annulus seeds inner/outer radius', () => {
    store.addObject('annulus', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('annulus');
    expect(o.outerRadius).toBeGreaterThan(0);
    expect(o.innerRadius).toBeGreaterThan(0);
    expect(o.innerRadius).toBeLessThan(o.outerRadius);
  });

  it('arc seeds radius and angles', () => {
    store.addObject('arc', 960, 540);
    const o = store.project.objects[0];
    expect(o.radius).toBeGreaterThan(0);
    expect(o.startAngle).toBe(0);
    expect(o.sweepAngle).toBe(180);
  });

  it('sector seeds radius and angles', () => {
    store.addObject('sector', 960, 540);
    const o = store.project.objects[0];
    expect(o.radius).toBeGreaterThan(0);
    expect(o.sweepAngle).toBe(90);
  });

  it('double_arrow is created', () => {
    store.addObject('double_arrow', 960, 540);
    expect(store.project.objects[0].type).toBe('double_arrow');
  });
});
