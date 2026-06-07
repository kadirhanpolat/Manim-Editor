import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';
let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('table object', () => {
  it('emits Table for text cells, no labels', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [
      ['1', '2'],
      ['3', '4'],
    ];
    t.mathMode = false;
    t.rowLabels = [];
    t.colLabels = [];
    const py = generateManimScript(store.project);
    expect(py).toContain('Table([["1", "2"], ["3", "4"]])');
    expect(py).not.toContain('MathTable');
    expect(py).not.toContain('row_labels');
  });
  it('emits MathTable with row/col labels', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [
      ['1', '2'],
      ['3', '4'],
    ];
    t.mathMode = true;
    t.rowLabels = ['a', 'b'];
    t.colLabels = ['x', 'y'];
    const py = generateManimScript(store.project);
    expect(py).toContain('MathTable([["1", "2"], ["3", "4"]]');
    expect(py).toContain('row_labels=[MathTex("a"), MathTex("b")]');
    expect(py).toContain('col_labels=[MathTex("x"), MathTex("y")]');
  });
  it('round-trips a table', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [
      ['1', '2'],
      ['3', '4'],
    ];
    t.mathMode = true;
    t.rowLabels = ['a', 'b'];
    t.colLabels = ['x', 'y'];
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find((o) => o.type === 'table');
    expect(re.cellData).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
    expect(re.mathMode).toBe(true);
    expect(re.rowLabels).toEqual(['a', 'b']);
    expect(re.colLabels).toEqual(['x', 'y']);
  });
});

describe('table actions', () => {
  it('setTableCell / add+remove row+col / mathMode / labels mutate', () => {
    const t = store.addObject('table', 960, 540);
    store.setTableCell(t.id, 0, 1, '9');
    store.addTableRow(t.id);
    store.addTableColumn(t.id);
    store.setTableMathMode(t.id, true);
    store.setTableRowLabels(t.id, ['r1', 'r2', 'r3']);
    store.setTableColLabels(t.id, ['c1', 'c2', 'c3']);
    const re = store.objectById(t.id);
    expect(re.cellData[0][1]).toBe('9');
    expect(re.cellData.length).toBe(3);
    expect(re.cellData[0].length).toBe(3);
    expect(re.mathMode).toBe(true);
    expect(re.rowLabels).toEqual(['r1', 'r2', 'r3']);
    store.removeTableRow(t.id);
    store.removeTableColumn(t.id);
    expect(store.objectById(t.id).cellData.length).toBe(2);
    expect(store.objectById(t.id).cellData[0].length).toBe(2);
  });

  it('removeTableRow/Column splice over-length labels to the new size', () => {
    const t = store.addObject('table', 960, 540);
    // start 2x2; grow to 4 rows / 4 cols so we can set 4 labels then shrink hard
    store.addTableRow(t.id);
    store.addTableRow(t.id);
    store.addTableColumn(t.id);
    store.addTableColumn(t.id);
    store.setTableRowLabels(t.id, ['r1', 'r2', 'r3', 'r4']);
    store.setTableColLabels(t.id, ['c1', 'c2', 'c3', 'c4']);
    // shrink rows 4->2 and cols 4->2
    store.removeTableRow(t.id);
    store.removeTableRow(t.id);
    store.removeTableColumn(t.id);
    store.removeTableColumn(t.id);
    const re = store.objectById(t.id);
    expect(re.cellData.length).toBe(2);
    expect(re.cellData[0].length).toBe(2);
    expect(re.rowLabels.length).toBeLessThanOrEqual(2);
    expect(re.colLabels.length).toBeLessThanOrEqual(2);
  });
});

describe('complex_plane object', () => {
  it('emits ComplexPlane with ranges', () => {
    const p = store.addObject('complex_plane', 960, 540);
    p.xRange = [-3, 3, 1];
    p.yRange = [-2, 2, 1];
    const py = generateManimScript(store.project);
    expect(py).toContain('ComplexPlane(x_range=[-3, 3, 1], y_range=[-2, 2, 1]');
  });
  it('round-trips complex_plane', () => {
    const p = store.addObject('complex_plane', 960, 540);
    p.xRange = [-4, 4, 1];
    p.yRange = [-2, 2, 1];
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find((o) => o.type === 'complex_plane');
    expect(re.xRange).toEqual([-4, 4, 1]);
    expect(re.yRange).toEqual([-2, 2, 1]);
  });
});

describe('polar_plane object', () => {
  it('emits PolarPlane', () => {
    const p = store.addObject('polar_plane', 960, 540);
    p.radiusMax = 4;
    p.radiusStep = 1;
    p.azimuthUnits = 12;
    const py = generateManimScript(store.project);
    expect(py).toContain('PolarPlane(radius_max=4, radius_step=1, azimuth_units=12');
  });
  it('round-trips polar_plane', () => {
    const p = store.addObject('polar_plane', 960, 540);
    p.radiusMax = 5;
    p.radiusStep = 1;
    p.azimuthUnits = 8;
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find((o) => o.type === 'polar_plane');
    expect(re.radiusMax).toBe(5);
    expect(re.azimuthUnits).toBe(8);
    expect(re.radiusStep).toBe(1);
  });
  it('polar setters mutate', () => {
    const p = store.addObject('polar_plane', 960, 540);
    store.setPolarRadiusMax(p.id, 6);
    store.setPolarAzimuth(p.id, 16);
    store.setPolarRadiusStep(p.id, 0.5);
    const re = store.objectById(p.id);
    expect(re.radiusMax).toBe(6);
    expect(re.azimuthUnits).toBe(16);
    expect(re.radiusStep).toBe(0.5);
    store.setPolarRadiusStep(p.id, 0);
    expect(store.objectById(p.id).radiusStep).toBe(0.1);
  });
});

describe('graph object', () => {
  function g() {
    const o = store.addObject('graph', 960, 540);
    o.vertices = ['A', 'B', 'C'];
    o.edges = [
      ['A', 'B'],
      ['B', 'C'],
    ];
    o.positions = { A: [-60, 0], B: [0, -40], C: [60, 0] };
    o.directed = false;
    o.showLabels = true;
    return o;
  }
  it('emits Graph with vertices, edges, layout, labels', () => {
    g();
    const py = generateManimScript(store.project);
    expect(py).toContain('Graph(["A", "B", "C"], [("A", "B"), ("B", "C")]');
    expect(py).toContain('layout={');
    expect(py).toContain('labels=True');
  });
  it('emits DiGraph when directed', () => {
    const o = g();
    o.directed = true;
    expect(generateManimScript(store.project)).toContain('DiGraph(["A", "B", "C"]');
  });
  it('round-trips a graph', () => {
    g();
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find((o) => o.type === 'graph');
    expect(re.vertices).toEqual(['A', 'B', 'C']);
    expect(re.edges).toEqual([
      ['A', 'B'],
      ['B', 'C'],
    ]);
    expect(re.directed).toBe(false);
    expect(re.showLabels).toBe(true);
    expect(Object.keys(re.positions).sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('graph actions', () => {
  it('add/remove vertex + edge, rename, position, toggles', () => {
    const o = store.addObject('graph', 960, 540);
    o.vertices = ['A', 'B'];
    o.edges = [['A', 'B']];
    o.positions = { A: [-50, 0], B: [50, 0] };
    store.addGraphVertex(o.id, 'C');
    store.addGraphEdge(o.id, 'B', 'C');
    store.setGraphVertexPosition(o.id, 'C', [0, 60]);
    store.setGraphDirected(o.id, true);
    store.setGraphShowLabels(o.id, false);
    let re = store.objectById(o.id);
    expect(re.vertices).toContain('C');
    expect(re.edges).toContainEqual(['B', 'C']);
    expect(re.positions.C).toEqual([0, 60]);
    expect(re.directed).toBe(true);
    expect(re.showLabels).toBe(false);
    store.renameGraphVertex(o.id, 'A', 'Z');
    re = store.objectById(o.id);
    expect(re.vertices).toContain('Z');
    expect(re.edges).toContainEqual(['Z', 'B']);
    expect(re.positions.Z).toBeTruthy();
    store.removeGraphVertex(o.id, 'B');
    re = store.objectById(o.id);
    expect(re.vertices).not.toContain('B');
    expect(re.edges.every((e) => !e.includes('B'))).toBe(true);
    expect(re.positions.B).toBeUndefined();
  });
});

describe('vector_field object', () => {
  it('emits ArrowVectorField with whitelisted fx/fy', () => {
    const v = store.addObject('vector_field', 960, 540);
    v.fx = 'y';
    v.fy = '-x';
    v.xRange = [-3, 3, 1];
    v.yRange = [-2, 2, 1];
    const py = generateManimScript(store.project);
    expect(py).toContain(
      'ArrowVectorField(lambda p: (lambda x, y: np.array([y, -x, 0]))(p[0], p[1]), x_range=[-3, 3, 1], y_range=[-2, 2, 1])'
    );
  });
  it('sanitizes a malicious expression to the fallback', () => {
    const v = store.addObject('vector_field', 960, 540);
    v.fx = '__import__("os")';
    v.fy = 'x';
    const py = generateManimScript(store.project);
    expect(py).not.toContain('__import__');
  });
  it('round-trips vector_field', () => {
    const v = store.addObject('vector_field', 960, 540);
    v.fx = 'y';
    v.fy = '-x';
    v.xRange = [-3, 3, 1];
    v.yRange = [-2, 2, 1];
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find((o) => o.type === 'vector_field');
    expect(re.fx).toBe('y');
    expect(re.fy).toBe('-x');
    expect(re.xRange).toEqual([-3, 3, 1]);
  });
  it('field setters mutate', () => {
    const v = store.addObject('vector_field', 960, 540);
    store.setFieldExpr(v.id, 'fx', 'x*y');
    store.setFieldRange(v.id, 'xRange', [-5, 5, 1]);
    const re = store.objectById(v.id);
    expect(re.fx).toBe('x*y');
    expect(re.xRange).toEqual([-5, 5, 1]);
  });
});
