import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('T', 'visual');
});

describe('counter integer mode', () => {
  it('useInteger emits Integer(...) not DecimalNumber', () => {
    const o = store.addObject('counter', 960, 540);
    store.updateObject(o.id, { value: 42, useInteger: true });
    const py = generateManimScript(store.project);
    expect(py).toContain('Integer(42)');
    expect(py).not.toContain('DecimalNumber');
  });

  it('default counter still emits DecimalNumber', () => {
    store.addObject('counter', 960, 540);
    expect(generateManimScript(store.project)).toContain('DecimalNumber(');
  });

  it('Integer with a suffix emits a unit', () => {
    const o = store.addObject('counter', 960, 540);
    store.updateObject(o.id, { value: 7, useInteger: true, suffix: '%' });
    expect(generateManimScript(store.project)).toMatch(/Integer\(7, unit="/);
  });

  it('round-trips Integer mode', () => {
    const o = store.addObject('counter', 960, 540);
    store.updateObject(o.id, { value: 99, useInteger: true });
    const parsed = parseManimScript(generateManimScript(store.project));
    const c = parsed.objects.find(x => x.type === 'counter');
    expect(c.useInteger).toBe(true);
    expect(c.value).toBe(99);
  });
});
