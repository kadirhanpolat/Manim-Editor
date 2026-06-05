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

describe('matrix store', () => {
  it('seeds a default 2x2 matrix with bracket "["', () => {
    store.addObject('matrix', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('matrix');
    expect(o.matrixData).toEqual([['1', '0'], ['0', '1']]);
    expect(o.bracket).toBe('[');
  });

  it('setMatrixCell updates one entry (coerced to string)', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.setMatrixCell(id, 0, 1, 5);
    expect(store.project.objects[0].matrixData[0][1]).toBe('5');
  });

  it('addMatrixRow / addMatrixColumn grow the grid with "0" fill', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.addMatrixRow(id);
    store.addMatrixColumn(id);
    const d = store.project.objects[0].matrixData;
    expect(d.length).toBe(3);
    expect(d[0].length).toBe(3);
    expect(d[2]).toEqual(['0', '0', '0']);
  });

  it('removeMatrixRow / removeMatrixColumn shrink but never below 1x1', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.removeMatrixRow(id);
    store.removeMatrixColumn(id);
    let d = store.project.objects[0].matrixData;
    expect(d.length).toBe(1);
    expect(d[0].length).toBe(1);
    store.removeMatrixRow(id);
    store.removeMatrixColumn(id);
    d = store.project.objects[0].matrixData;
    expect(d.length).toBe(1);
    expect(d[0].length).toBe(1);
  });

  it('setMatrixBracket only accepts [ ( |', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.setMatrixBracket(id, '(');
    expect(store.project.objects[0].bracket).toBe('(');
    store.setMatrixBracket(id, 'x');
    expect(store.project.objects[0].bracket).toBe('(');
  });
});
