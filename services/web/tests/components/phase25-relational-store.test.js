import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('relational store', () => {
  it('seeds a brace with two points and empty label', () => {
    store.addObject('brace', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('brace');
    expect(o.p1).toEqual([-80, 0]);
    expect(o.p2).toEqual([80, 0]);
    expect(o.label).toBe('');
  });

  it('seeds an angle with vertex + two points, rightAngle false, radius 0.6', () => {
    store.addObject('angle', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('angle');
    expect(o.vertex).toEqual([-40, 40]);
    expect(o.point1).toEqual([80, 40]);
    expect(o.point2).toEqual([-40, -60]);
    expect(o.rightAngle).toBe(false);
    expect(o.radius).toBe(0.6);
  });

  it('setRelationalPoint updates a named point (rounded ints)', () => {
    store.addObject('brace', 960, 540);
    id = store.project.objects[0].id;
    store.setRelationalPoint(id, 'p2', [100.4, -20.6]);
    expect(store.project.objects[0].p2).toEqual([100, -21]);
  });

  it('setRelationalPoint ignores unknown keys', () => {
    store.addObject('angle', 960, 540);
    id = store.project.objects[0].id;
    store.setRelationalPoint(id, 'bogus', [1, 2]);
    expect(store.project.objects[0].bogus).toBeUndefined();
  });

  it('setAngleRightMode and setAngleRadius update angle fields', () => {
    store.addObject('angle', 960, 540);
    id = store.project.objects[0].id;
    store.setAngleRightMode(id, true);
    store.setAngleRadius(id, 1.2);
    expect(store.project.objects[0].rightAngle).toBe(true);
    expect(store.project.objects[0].radius).toBe(1.2);
  });

  it('setRelationalLabel sets/clears the label', () => {
    store.addObject('brace', 960, 540);
    id = store.project.objects[0].id;
    store.setRelationalLabel(id, 'x');
    expect(store.project.objects[0].label).toBe('x');
    store.setRelationalLabel(id, '');
    expect(store.project.objects[0].label).toBe('');
  });
});
