import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store: ReturnType<typeof useProjectStore>;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('annotation store — seeding', () => {
  it('surrounding_rect seeds with color, strokeWidth, buff, cornerRadius, empty targetId', () => {
    store.addObject('surrounding_rect', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('surrounding_rect');
    expect(o.color).toBe('#facc15');
    expect(o.strokeWidth).toBe(2);
    expect(o.buff).toBe(10);
    expect(o.cornerRadius).toBe(0);
    expect(o.targetId).toBe('');
  });

  it('underline seeds with color, strokeWidth, buff, empty targetId', () => {
    store.addObject('underline', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('underline');
    expect(o.color).toBe('#f97316');
    expect(o.strokeWidth).toBe(2);
    expect(o.buff).toBe(6);
    expect(o.targetId).toBe('');
  });

  it('cross seeds with color, strokeWidth, empty targetId', () => {
    store.addObject('cross', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('cross');
    expect(o.color).toBe('#ef4444');
    expect(o.strokeWidth).toBe(3);
    expect(o.targetId).toBe('');
  });
});

describe('annotation store — setAnnotationTarget', () => {
  it('updates targetId and commits state', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('surrounding_rect', 960, 540);
    const ann = store.project.objects[1];
    const histLen = store.history.past.length;
    store.setAnnotationTarget(ann.id, circle.id);
    expect(ann.targetId).toBe(circle.id);
    expect(store.history.past.length).toBe(histLen + 1);
  });

  it('no-ops if object not found', () => {
    const histLen = store.history.past.length;
    store.setAnnotationTarget('nonexistent', 'target');
    expect(store.history.past.length).toBe(histLen);
  });
});

describe('annotation store — cascade delete', () => {
  it('deleting a target also deletes all bound annotations', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('surrounding_rect', 960, 540);
    const ann1 = store.project.objects[1];
    store.addObject('underline', 960, 540);
    const ann2 = store.project.objects[2];
    store.setAnnotationTarget(ann1.id, circle.id);
    store.setAnnotationTarget(ann2.id, circle.id);

    store.deleteObject(circle.id);

    expect(store.project.objects.find((o) => o.id === ann1.id)).toBeUndefined();
    expect(store.project.objects.find((o) => o.id === ann2.id)).toBeUndefined();
    expect(store.project.objects.find((o) => o.id === circle.id)).toBeUndefined();
  });

  it('deleting a non-targeted object does not cascade to unrelated annotations', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('rectangle', 960, 540);
    const rect = store.project.objects[1];
    store.addObject('surrounding_rect', 960, 540);
    const ann = store.project.objects[2];
    store.setAnnotationTarget(ann.id, circle.id);

    store.deleteObject(rect.id);

    expect(store.project.objects.find((o) => o.id === ann.id)).toBeDefined();
  });
});
