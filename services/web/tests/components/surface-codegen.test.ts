import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('T', 'visual');
  store.setSceneType('3d');
});

describe('surface (3D Surface) codegen', () => {
  it('emits Surface(lambda x, y: np.array([x, y, z]), u_range, v_range, resolution)', () => {
    store.addObject('surface', 0, 0);
    const py = generateManimScript(store.project);
    expect(py).toContain('Surface(lambda x, y: np.array([x, y, x**2 - y**2])');
    expect(py).toContain('u_range=[-2.0, 2.0]');
    expect(py).toContain('v_range=[-2.0, 2.0]');
    expect(py).toContain('resolution=(20, 20)');
  });

  it('flows a custom zExpr and ranges through', () => {
    const o = store.addObject('surface', 0, 0);
    store.updateObject(o.id, { zExpr: 'np.sin(x) * np.cos(y)', xRange: [-3, 3], yRange: [-1, 1] });
    const py = generateManimScript(store.project);
    expect(py).toContain('np.array([x, y, np.sin(x) * np.cos(y)])');
    expect(py).toContain('u_range=[-3.0, 3.0]');
    expect(py).toContain('v_range=[-1.0, 1.0]');
  });

  it('sanitizes an unsafe zExpr via safeMathExpr (no injection)', () => {
    const o = store.addObject('surface', 0, 0);
    store.updateObject(o.id, { zExpr: 'import os' });
    const py = generateManimScript(store.project);
    expect(py).not.toContain('import os');
    expect(py).toContain('x, y, x**2 - y**2'); // fell back to default
  });

  it('round-trips zExpr + ranges + resolution through the .py parser', () => {
    const o = store.addObject('surface', 0, 0);
    store.updateObject(o.id, {
      zExpr: 'np.sin(x) - np.cos(y)',
      xRange: [-3, 3],
      yRange: [-1, 1],
      resolution: 24,
    });
    const parsed = parseManimScript(generateManimScript(store.project));
    const surf = parsed.objects.find((x) => x.type === 'surface');
    expect(surf).toBeTruthy();
    expect(surf.zExpr).toBe('np.sin(x) - np.cos(y)');
    expect(surf.xRange).toEqual([-3, 3]);
    expect(surf.yRange).toEqual([-1, 1]);
    expect(surf.resolution).toBe(24);
  });
});
