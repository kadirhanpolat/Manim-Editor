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

describe('addObject axes graphs field', () => {
  it('axes object gets empty graphs array', () => {
    const obj = store.addObject('axes', 960, 540);
    expect(obj.type).toBe('axes');
    expect(Array.isArray(obj.graphs)).toBe(true);
    expect(obj.graphs).toHaveLength(0);
  });

  it('numberplane object gets xRange and yRange', () => {
    const obj = store.addObject('numberplane', 960, 540);
    expect(obj.type).toBe('numberplane');
    expect(obj.xRange).toBeDefined();
    expect(obj.yRange).toBeDefined();
  });

  it('numberline object gets xRange', () => {
    const obj = store.addObject('numberline', 960, 540);
    expect(obj.type).toBe('numberline');
    expect(obj.xRange).toBeDefined();
  });
});

describe('addGraph / removeGraph', () => {
  it('adds a graph to an axes object', () => {
    const obj = store.addObject('axes', 960, 540);
    const graph = store.addGraph(obj.id, { expression: 'x**2', color: '#ff0000' });
    expect(graph).not.toBeNull();
    expect(graph.expression).toBe('x**2');
    const updated = store.objectById(obj.id);
    expect(updated.graphs).toHaveLength(1);
  });

  it('removes a graph from an axes object', () => {
    const obj = store.addObject('axes', 960, 540);
    const graph = store.addGraph(obj.id, { expression: 'x**2' });
    store.removeGraph(obj.id, graph.id);
    const updated = store.objectById(obj.id);
    expect(updated.graphs).toHaveLength(0);
  });

  it('returns null when adding graph to non-axes object', () => {
    const obj = store.addObject('circle', 960, 540);
    const result = store.addGraph(obj.id, { expression: 'x**2' });
    expect(result).toBeNull();
  });

  it('updates a graph property on an axes object', () => {
    const obj = store.addObject('axes', 960, 540);
    const graph = store.addGraph(obj.id, { expression: 'x**2', color: '#ff0000' });
    store.updateGraph(obj.id, graph.id, { expression: 'Math.sin(x)', color: '#00ff00' });
    const updated = store.objectById(obj.id);
    expect(updated.graphs[0].expression).toBe('Math.sin(x)');
    expect(updated.graphs[0].color).toBe('#00ff00');
  });
});
