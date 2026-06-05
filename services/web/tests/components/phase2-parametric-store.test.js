import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('parametric store', () => {
  it('seeds xExpr/yExpr/tMin/tMax', () => {
    store.addObject('parametric', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('parametric');
    expect(o.xExpr).toBe('np.cos(t)');
    expect(o.yExpr).toBe('np.sin(t)');
    expect(o.tMin).toBe(0);
    expect(o.tMax).toBe(6.283);
  });
});
