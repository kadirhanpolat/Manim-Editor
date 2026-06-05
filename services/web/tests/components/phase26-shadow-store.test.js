import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
  store.addObject('circle', 960, 540);
  id = store.project.objects[0].id;
});

describe('setShadow', () => {
  it('sets a shadow object with normalized fields', () => {
    store.setShadow(id, { color: '#101010', opacity: 0.5, dx: 10, dy: 6, blur: 20 });
    expect(store.project.objects[0].shadow).toEqual({ color: '#101010', opacity: 0.5, dx: 10, dy: 6, blur: 20 });
  });

  it('deletes the field on null (byte-identical legacy)', () => {
    store.setShadow(id, { color: '#000000', opacity: 0.4, dx: 8, dy: 8, blur: 12 });
    store.setShadow(id, null);
    expect('shadow' in store.project.objects[0]).toBe(false);
  });

  it('fills defaults for missing fields', () => {
    store.setShadow(id, { dx: 4 });
    expect(store.project.objects[0].shadow).toEqual({ color: '#000000', opacity: 0.4, dx: 4, dy: 8, blur: 12 });
  });
});
