import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';
let store;
beforeEach(() => { setActivePinia(createPinia()); store = useProjectStore(); store.newProject('Test', 'visual'); store.commitState(); });

describe('table object', () => {
  it('emits Table for text cells, no labels', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [['1','2'],['3','4']]; t.mathMode = false; t.rowLabels = []; t.colLabels = [];
    const py = generateManimScript(store.project);
    expect(py).toContain('Table([["1", "2"], ["3", "4"]])');
    expect(py).not.toContain('MathTable');
    expect(py).not.toContain('row_labels');
  });
  it('emits MathTable with row/col labels', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [['1','2'],['3','4']]; t.mathMode = true; t.rowLabels = ['a','b']; t.colLabels = ['x','y'];
    const py = generateManimScript(store.project);
    expect(py).toContain('MathTable([["1", "2"], ["3", "4"]]');
    expect(py).toContain('row_labels=[MathTex("a"), MathTex("b")]');
    expect(py).toContain('col_labels=[MathTex("x"), MathTex("y")]');
  });
  it('round-trips a table', () => {
    const t = store.addObject('table', 960, 540);
    t.cellData = [['1','2'],['3','4']]; t.mathMode = true; t.rowLabels = ['a','b']; t.colLabels = ['x','y'];
    const parsed = parseManimScript(generateManimScript(store.project));
    const re = parsed.objects.find(o => o.type === 'table');
    expect(re.cellData).toEqual([['1','2'],['3','4']]);
    expect(re.mathMode).toBe(true);
    expect(re.rowLabels).toEqual(['a','b']);
    expect(re.colLabels).toEqual(['x','y']);
  });
});

describe('table actions', () => {
  it('setTableCell / add+remove row+col / mathMode / labels mutate', () => {
    const t = store.addObject('table', 960, 540);
    store.setTableCell(t.id, 0, 1, '9');
    store.addTableRow(t.id); store.addTableColumn(t.id);
    store.setTableMathMode(t.id, true);
    store.setTableRowLabels(t.id, ['r1','r2','r3']);
    store.setTableColLabels(t.id, ['c1','c2','c3']);
    const re = store.objectById(t.id);
    expect(re.cellData[0][1]).toBe('9');
    expect(re.cellData.length).toBe(3);
    expect(re.cellData[0].length).toBe(3);
    expect(re.mathMode).toBe(true);
    expect(re.rowLabels).toEqual(['r1','r2','r3']);
    store.removeTableRow(t.id); store.removeTableColumn(t.id);
    expect(store.objectById(t.id).cellData.length).toBe(2);
    expect(store.objectById(t.id).cellData[0].length).toBe(2);
  });
});
