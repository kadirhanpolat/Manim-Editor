import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  // Initialize history with a snapshot of the blank project
  store.commitState();
});

describe('addObject', () => {
  it('adds a circle to the project', () => {
    const obj = store.addObject('circle', 960, 540);
    expect(obj.type).toBe('circle');
    expect(store.project.objects).toHaveLength(1);
    expect(store.project.objects[0].id).toBe(obj.id);
  });

  it('sets sensible defaults', () => {
    const obj = store.addObject('rectangle', 100, 100);
    expect(obj.width).toBeGreaterThan(0);
    expect(obj.height).toBeGreaterThan(0);
    expect(obj.opacity).toBe(1);
    expect(obj.enterAnim).toBe('fade_in');
  });
});

describe('deleteObject', () => {
  it('removes object and its clips', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addClip(0, { type: 'fade', sourceId: obj.id, startTime: 0, duration: 1 });
    store.deleteObject(obj.id);
    expect(store.project.objects).toHaveLength(0);
    expect(store.project.tracks[0].clips).toHaveLength(0);
  });
});

describe('undo/redo', () => {
  it('reverts addObject', () => {
    store.addObject('circle', 960, 540);
    expect(store.project.objects).toHaveLength(1);
    store.undo();
    expect(store.project.objects).toHaveLength(0);
  });

  it('redo reapplies after undo', () => {
    store.addObject('circle', 960, 540);
    store.undo();
    store.redo();
    expect(store.project.objects).toHaveLength(1);
  });
});

describe('groupObjects', () => {
  it('groups two objects', () => {
    const a = store.addObject('circle', 400, 400);
    const b = store.addObject('square', 600, 400);
    const group = store.groupObjects([a.id, b.id]);
    expect(group).not.toBeNull();
    expect(store.project.groups).toHaveLength(1);
    expect(store.project.groups[0].childIds).toContain(a.id);
  });

  it('returns null for fewer than 2 objects', () => {
    const a = store.addObject('circle', 400, 400);
    const result = store.groupObjects([a.id]);
    expect(result).toBeNull();
  });
});

import TEMPLATES from '../../src/templates/index.js';

describe('TEMPLATES', () => {
  it('has 5 entries', () => {
    expect(TEMPLATES).toHaveLength(5);
  });

  it('each non-blank template returns a valid project with required object fields', () => {
    const REQUIRED_FIELDS = ['id', 'type', 'x', 'y', 'width', 'height', 'rotation', 'fill', 'stroke', 'opacity', 'zOrder', 'enterTime', 'duration', 'enterAnim', 'exitAnim'];
    for (const tpl of TEMPLATES.filter(t => t.project !== null)) {
      const p = tpl.project();
      expect(p.objects.length).toBeGreaterThan(0);
      expect(p.stage).toBeDefined();
      expect(Array.isArray(p.tracks)).toBe(true);
      for (const obj of p.objects) {
        for (const field of REQUIRED_FIELDS) {
          expect(obj[field], `${tpl.id} template object missing field: ${field}`).toBeDefined();
        }
      }
    }
  });
});
