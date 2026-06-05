import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('polygon_free store', () => {
  it('seeds a default trapezoid (4 vertices)', () => {
    store.addObject('polygon_free', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('polygon_free');
    expect(Array.isArray(o.vertices)).toBe(true);
    expect(o.vertices.length).toBe(4);
  });

  it('setPolygonVertices replaces vertices and ignores < 3', () => {
    store.addObject('polygon_free', 960, 540);
    id = store.project.objects[0].id;
    store.setPolygonVertices(id, [[-50, -50], [50, -50], [50, 50], [-50, 50]]);
    expect(store.objectById(id).vertices.length).toBe(4);
    store.setPolygonVertices(id, [[0, 0], [10, 10]]); // too few — ignored
    expect(store.objectById(id).vertices.length).toBe(4);
  });
});
