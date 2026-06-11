import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

describe('recentColors', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('starts empty', () => {
    expect(store.recentColors).toEqual([]);
  });

  it('addRecentColor prepends and deduplicates', () => {
    store.addRecentColor('#ff0000');
    store.addRecentColor('#00ff00');
    store.addRecentColor('#ff0000');
    expect(store.recentColors[0]).toBe('#ff0000');
    expect(store.recentColors.length).toBe(2);
  });

  it('caps at 8 colors', () => {
    for (let i = 0; i < 10; i++) store.addRecentColor(`#${String(i).padStart(6, '0')}`);
    expect(store.recentColors.length).toBe(8);
  });
});
