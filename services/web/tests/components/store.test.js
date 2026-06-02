import { describe, it, expect, beforeEach } from 'vitest';
import { store, actions } from '../../src/store/project.js';

beforeEach(() => {
  actions.newProject('Test', 'visual');
  // Initialize history with a snapshot of the blank project
  actions.commitState();
});

describe('addObject', () => {
  it('adds a circle to the project', () => {
    const obj = actions.addObject('circle', 960, 540);
    expect(obj.type).toBe('circle');
    expect(store.project.objects).toHaveLength(1);
    expect(store.project.objects[0].id).toBe(obj.id);
  });

  it('sets sensible defaults', () => {
    const obj = actions.addObject('rectangle', 100, 100);
    expect(obj.width).toBeGreaterThan(0);
    expect(obj.height).toBeGreaterThan(0);
    expect(obj.opacity).toBe(1);
    expect(obj.enterAnim).toBe('fade_in');
  });
});

describe('deleteObject', () => {
  it('removes object and its clips', () => {
    const obj = actions.addObject('circle', 960, 540);
    actions.addClip(0, { type: 'fade', sourceId: obj.id, startTime: 0, duration: 1 });
    actions.deleteObject(obj.id);
    expect(store.project.objects).toHaveLength(0);
    expect(store.project.tracks[0].clips).toHaveLength(0);
  });
});

describe('undo/redo', () => {
  it('reverts addObject', () => {
    actions.addObject('circle', 960, 540);
    expect(store.project.objects).toHaveLength(1);
    actions.undo();
    expect(store.project.objects).toHaveLength(0);
  });

  it('redo reapplies after undo', () => {
    actions.addObject('circle', 960, 540);
    actions.undo();
    actions.redo();
    expect(store.project.objects).toHaveLength(1);
  });
});

describe('groupObjects', () => {
  it('groups two objects', () => {
    const a = actions.addObject('circle', 400, 400);
    const b = actions.addObject('square', 600, 400);
    const group = actions.groupObjects([a.id, b.id]);
    expect(group).not.toBeNull();
    expect(store.project.groups).toHaveLength(1);
    expect(store.project.groups[0].childIds).toContain(a.id);
  });

  it('returns null for fewer than 2 objects', () => {
    const a = actions.addObject('circle', 400, 400);
    const result = actions.groupObjects([a.id]);
    expect(result).toBeNull();
  });
});

import TEMPLATES from '../../src/templates/index.js';

describe('TEMPLATES', () => {
  it('has 5 entries', () => {
    expect(TEMPLATES).toHaveLength(5);
  });

  it('each non-blank template returns a valid project', () => {
    for (const tpl of TEMPLATES.filter(t => t.project !== null)) {
      const p = tpl.project();
      expect(p.objects.length).toBeGreaterThan(0);
      expect(p.stage).toBeDefined();
      expect(Array.isArray(p.tracks)).toBe(true);
    }
  });
});
