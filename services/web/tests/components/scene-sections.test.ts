import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

describe('scene sections store', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('starts with empty sections', () => {
    expect(store.project.sections).toEqual([]);
  });

  it('addSection inserts and sorts by time', () => {
    store.addSection(3, 'Third');
    store.addSection(1, 'First');
    expect(store.project.sections[0]!.time).toBe(1);
    expect(store.project.sections[1]!.time).toBe(3);
  });

  it('removeSection removes by id', () => {
    store.addSection(2, 'Mid');
    const id = store.project.sections[0]!.id;
    store.removeSection(id);
    expect(store.project.sections).toHaveLength(0);
  });

  it('updateSection changes title and re-sorts', () => {
    store.addSection(2, 'Old');
    const id = store.project.sections[0]!.id;
    store.updateSection(id, { title: 'New', time: 0.5 });
    expect(store.project.sections[0]!.title).toBe('New');
    expect(store.project.sections[0]!.time).toBe(0.5);
  });
});
