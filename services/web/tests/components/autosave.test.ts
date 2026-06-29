import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { AUTOSAVE_KEY, initAutosave, readAutosave, clearAutosave } from '../../src/autosave.js';

let store;
let dispose;
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
  dispose = initAutosave(store);
});
afterEach(() => {
  dispose?.();
  vi.useRealTimers();
  localStorage.clear();
});

describe('autosave write (2s debounce, isDirty-gated)', () => {
  it('writes { project, savedAt } to localStorage 2s after a dirty mutation', () => {
    store.addObject('circle', 400, 400); // sets isDirty = true
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null); // not yet (debounced)
    vi.advanceTimersByTime(2100);
    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY));
    expect(saved.project.objects).toHaveLength(1);
    expect(typeof saved.savedAt).toBe('number');
  });

  it('debounces: rapid mutations produce one write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(1000);
    store.addObject('square', 500, 500);
    vi.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalledWith(AUTOSAVE_KEY, expect.anything());
    vi.advanceTimersByTime(1100);
    const writes = spy.mock.calls.filter(([k]) => k === AUTOSAVE_KEY);
    expect(writes).toHaveLength(1);
    spy.mockRestore();
  });

  it('does not write while the store is clean (isDirty=false)', () => {
    store.setPlaybackTime(1.5); // mutates state but not isDirty
    vi.advanceTimersByTime(3000);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
  });

  it('uses its own key (no collision with manim-motion-theme)', () => {
    expect(AUTOSAVE_KEY).toBe('manim-motion-autosave');
    expect(AUTOSAVE_KEY).not.toBe('manim-motion-theme');
  });
});

describe('autosave clear hooks ($onAction)', () => {
  it('newProject clears the key', () => {
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(2100);
    expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBe(null);
    store.newProject('Fresh', 'visual');
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
  });

  it('importJSON (Open) clears the key', () => {
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(2100);
    const json = store.exportJSON();
    store.importJSON(json);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
  });

  it('saveToFile (successful save) clears the key', () => {
    // jsdom lacks URL.createObjectURL — stub the blob plumbing saveToFile uses
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    try {
      store.addObject('circle', 400, 400);
      vi.advanceTimersByTime(2100);
      expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBe(null);
      store.saveToFile();
      expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('savePackageToFile (successful package export) clears the key', () => {
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    try {
      store.addObject('circle', 400, 400);
      vi.advanceTimersByTime(2100);
      expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBe(null);
      store.savePackageToFile();
      expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe('readAutosave / clearAutosave / restore round-trip', () => {
  it('readAutosave returns the parsed payload, null when absent or corrupt', () => {
    expect(readAutosave()).toBe(null);
    localStorage.setItem(AUTOSAVE_KEY, 'not json');
    expect(readAutosave()).toBe(null);
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ project: { a: 1 }, savedAt: 5 }));
    expect(readAutosave()).toEqual({ project: { a: 1 }, savedAt: 5 });
  });

  it('clearAutosave removes only our key', () => {
    localStorage.setItem(AUTOSAVE_KEY, '{}');
    localStorage.setItem('manim-motion-theme', 'dark');
    clearAutosave();
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
    expect(localStorage.getItem('manim-motion-theme')).toBe('dark');
  });

  it('a saved project restores through importJSON', () => {
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(2100);
    const saved = readAutosave();
    store.newProject('Blank', 'visual'); // wipes (and clears the key)
    expect(store.project.objects).toHaveLength(0);
    const ok = store.importJSON(JSON.stringify(saved.project));
    expect(ok).toBe(true);
    expect(store.project.objects).toHaveLength(1);
  });

  it('dispose() stops both the subscriber and the action hook', () => {
    dispose();
    dispose = null;
    store.addObject('circle', 400, 400);
    vi.advanceTimersByTime(3000);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(null);
  });
});
