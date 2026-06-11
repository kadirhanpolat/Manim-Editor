import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

describe('guides store', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('starts with empty guides', () => {
    expect(store.project.guides).toEqual([]);
  });

  it('addGuide adds a guide with correct axis/pos', () => {
    store.addGuide('h', 300);
    expect(store.project.guides).toHaveLength(1);
    expect(store.project.guides[0]!.axis).toBe('h');
    expect(store.project.guides[0]!.pos).toBe(300);
    expect(typeof store.project.guides[0]!.id).toBe('string');
  });

  it('removeGuide removes by id', () => {
    store.addGuide('v', 500);
    const id = store.project.guides[0]!.id;
    store.removeGuide(id);
    expect(store.project.guides).toHaveLength(0);
  });

  it('moveGuide updates pos', () => {
    store.addGuide('h', 100);
    const id = store.project.guides[0]!.id;
    store.moveGuide(id, 250);
    expect(store.project.guides[0]!.pos).toBe(250);
  });
});
