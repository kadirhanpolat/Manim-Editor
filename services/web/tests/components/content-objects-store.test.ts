import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('addObject defaults — code', () => {
  it('seeds codeText/language/fontSize and a 480x280 box', () => {
    const obj = store.addObject('code', 960, 540);
    expect(obj.type).toBe('code');
    expect(obj.codeText).toBe('def hello():\n    print("Hello")');
    expect(obj.language).toBe('python');
    expect(obj.fontSize).toBe(18);
    expect(obj.width).toBe(480);
    expect(obj.height).toBe(280);
    expect(obj.name).toContain('Code');
  });
  it('codegen produces a scene without "undefined" leakage', () => {
    store.addObject('code', 960, 540);
    const py = generateManimScript(store.project);
    expect(py).toContain('class MainScene');
    expect(py).toContain('Code(code_string=');
    expect(py).not.toMatch(/\bundefined\b/);
  });
});

describe('addObject defaults — bar_chart', () => {
  it('seeds values/barNames/yMax/barColors and a 600x400 box', () => {
    const obj = store.addObject('bar_chart', 960, 540);
    expect(obj.type).toBe('bar_chart');
    expect(obj.values).toEqual([3, 5, 2, 6]);
    expect(obj.barNames).toEqual(['A', 'B', 'C', 'D']);
    expect(obj.yMax).toBe(8);
    expect(obj.barColors).toEqual(['#58c4dd', '#83c167', '#fc6255', '#ffff00']);
    expect(obj.width).toBe(600);
    expect(obj.height).toBe(400);
    expect(obj.name).toContain('Bar Chart');
  });
  it('codegen produces a scene without "undefined" leakage', () => {
    store.addObject('bar_chart', 960, 540);
    const py = generateManimScript(store.project);
    expect(py).toContain('BarChart(values=');
    expect(py).not.toMatch(/\bundefined\b/);
  });
});
