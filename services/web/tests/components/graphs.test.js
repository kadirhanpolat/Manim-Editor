import { describe, it, expect, beforeEach } from 'vitest';
import { store, actions, getters } from '../../src/store/project.js';

beforeEach(() => {
  actions.newProject('Test', 'visual');
  actions.commitState();
});

describe('addObject axes graphs field', () => {
  it('axes object gets empty graphs array', () => {
    const obj = actions.addObject('axes', 960, 540);
    expect(obj.type).toBe('axes');
    expect(Array.isArray(obj.graphs)).toBe(true);
    expect(obj.graphs).toHaveLength(0);
  });

  it('numberplane object gets xRange and yRange', () => {
    const obj = actions.addObject('numberplane', 960, 540);
    expect(obj.type).toBe('numberplane');
    expect(obj.xRange).toBeDefined();
    expect(obj.yRange).toBeDefined();
  });

  it('numberline object gets xRange', () => {
    const obj = actions.addObject('numberline', 960, 540);
    expect(obj.type).toBe('numberline');
    expect(obj.xRange).toBeDefined();
  });
});

describe('addGraph / removeGraph', () => {
  it('adds a graph to an axes object', () => {
    const obj = actions.addObject('axes', 960, 540);
    const graph = actions.addGraph(obj.id, { expression: 'x**2', color: '#ff0000' });
    expect(graph).not.toBeNull();
    expect(graph.expression).toBe('x**2');
    const updated = getters.objectById(obj.id);
    expect(updated.graphs).toHaveLength(1);
  });

  it('removes a graph from an axes object', () => {
    const obj = actions.addObject('axes', 960, 540);
    const graph = actions.addGraph(obj.id, { expression: 'x**2' });
    actions.removeGraph(obj.id, graph.id);
    const updated = getters.objectById(obj.id);
    expect(updated.graphs).toHaveLength(0);
  });

  it('returns null when adding graph to non-axes object', () => {
    const obj = actions.addObject('circle', 960, 540);
    const result = actions.addGraph(obj.id, { expression: 'x**2' });
    expect(result).toBeNull();
  });
});
