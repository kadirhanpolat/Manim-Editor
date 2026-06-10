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

describe('toggleLocked / toggleHidden', () => {
  it('toggleLocked sets locked=true and deletes the field when toggled back (legacy-absent)', () => {
    const obj = store.addObject('circle', 400, 400);
    store.toggleLocked(obj.id);
    expect(store.project.objects[0].locked).toBe(true);
    store.toggleLocked(obj.id);
    expect('locked' in store.project.objects[0]).toBe(false);
  });

  it('toggleHidden sets hidden=true and deletes the field when toggled back', () => {
    const obj = store.addObject('circle', 400, 400);
    store.toggleHidden(obj.id);
    expect(store.project.objects[0].hidden).toBe(true);
    store.toggleHidden(obj.id);
    expect('hidden' in store.project.objects[0]).toBe(false);
  });

  it('toggleHidden is undoable (commitState was called)', () => {
    const obj = store.addObject('circle', 400, 400);
    store.toggleHidden(obj.id);
    expect(store.project.objects[0].hidden).toBe(true);
    store.undo();
    expect(store.project.objects[0].hidden).toBeUndefined();
  });

  it('ignores unknown ids', () => {
    store.toggleLocked('nope');
    store.toggleHidden('nope');
    expect(store.project.objects).toHaveLength(0);
  });
});

describe('bringToFront / sendToBack', () => {
  it('bringToFront moves the object to the end of objects[] and renumbers zOrder = index', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    const c = store.addObject('triangle', 300, 300);
    store.bringToFront(a.id);
    expect(store.project.objects.map((o) => o.id)).toEqual([b.id, c.id, a.id]);
    expect(store.project.objects.map((o) => o.zOrder)).toEqual([0, 1, 2]);
  });

  it('sendToBack moves the object to the start and renumbers zOrder', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    const c = store.addObject('triangle', 300, 300);
    store.sendToBack(c.id);
    expect(store.project.objects.map((o) => o.id)).toEqual([c.id, a.id, b.id]);
    expect(store.project.objects.map((o) => o.zOrder)).toEqual([0, 1, 2]);
  });

  it('is undoable', () => {
    const a = store.addObject('circle', 100, 100);
    store.addObject('square', 200, 200);
    store.bringToFront(a.id);
    store.undo();
    expect(store.project.objects[0].id).toBe(a.id);
  });
});

describe('duplicateSelection', () => {
  it('clones selected objects at +20/+20, selects the clones, leaves the clipboard alone', () => {
    const a = store.addObject('circle', 400, 400);
    store.selectObject(a.id);
    store.duplicateSelection();
    expect(store.project.objects).toHaveLength(2);
    const clone = store.project.objects[1];
    expect(clone.id).not.toBe(a.id);
    expect(clone.x).toBe(420);
    expect(clone.y).toBe(420);
    expect(clone.name).toBe(a.name + ' copy');
    expect(store.selectedObjectIds).toEqual([clone.id]);
    expect(store.clipboard).toHaveLength(0);
  });

  it('does nothing with empty selection', () => {
    store.addObject('circle', 400, 400);
    store.deselectAll();
    store.duplicateSelection();
    expect(store.project.objects).toHaveLength(1);
  });
});

describe('cutSelection', () => {
  it('copies to clipboard then deletes the selected objects', () => {
    const a = store.addObject('circle', 400, 400);
    const b = store.addObject('square', 500, 500);
    store.selectObject(a.id);
    store.selectObject(b.id, true);
    store.cutSelection();
    expect(store.project.objects).toHaveLength(0);
    expect(store.clipboard).toHaveLength(2);
    store.pasteSelection();
    expect(store.project.objects).toHaveLength(2);
  });
});

describe('selectAllObjects', () => {
  it('selects every object and clears clip selection', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    store.selectAllObjects();
    expect(store.selectedObjectIds).toEqual([a.id, b.id]);
    expect(store.selectedClipId).toBe(null);
  });
});

describe('translateObjects', () => {
  it('moves every given object by dx/dy', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    store.translateObjects([a.id, b.id], 50, -10);
    expect([store.project.objects[0].x, store.project.objects[0].y]).toEqual([150, 90]);
    expect([store.project.objects[1].x, store.project.objects[1].y]).toEqual([250, 190]);
  });

  it('skips locked objects', () => {
    const a = store.addObject('circle', 100, 100);
    const b = store.addObject('square', 200, 200);
    store.toggleLocked(b.id);
    store.translateObjects([a.id, b.id], 50, 0);
    expect(store.project.objects[0].x).toBe(150);
    expect(store.project.objects[1].x).toBe(200);
  });

  it('is a no-op for dx=0, dy=0 (no history entry)', () => {
    const a = store.addObject('circle', 100, 100);
    const before = store.history.past.length;
    store.translateObjects([a.id], 0, 0);
    expect(store.history.past.length).toBe(before);
  });
});
