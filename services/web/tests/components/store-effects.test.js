import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.addObject('rectangle', 960, 540);
  id = store.project.objects[0].id;
  store.commitState();
});

describe('effect store actions', () => {
  it('setGradient sets and clears the field', () => {
    store.setGradient(id, { colors: ['#ff0000', '#00ff00'], angle: 90 });
    expect(store.objectById(id).gradient).toEqual({ colors: ['#ff0000', '#00ff00'], angle: 90 });
    store.setGradient(id, null);
    expect('gradient' in store.objectById(id)).toBe(false);
  });

  it('setCornerRadius sets a positive value and deletes on 0', () => {
    store.setCornerRadius(id, 24);
    expect(store.objectById(id).cornerRadius).toBe(24);
    store.setCornerRadius(id, 0);
    expect('cornerRadius' in store.objectById(id)).toBe(false);
  });

  it('setDash sets and clears, clamping ratio to [0,1]', () => {
    store.setDash(id, { numDashes: 12, ratio: 1.8 });
    expect(store.objectById(id).dash).toEqual({ numDashes: 12, ratio: 1 });
    store.setDash(id, null);
    expect('dash' in store.objectById(id)).toBe(false);
  });

  it('marks the project dirty', () => {
    store.isDirty = false;
    store.setGradient(id, { colors: ['#ff0000', '#00ff00'], angle: 90 });
    expect(store.isDirty).toBe(true);
  });
});
