import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../src/store/project.js';
import AssetSidebar from '../../src/components/sidebar/AssetSidebar.vue';
import {
  INSPECTOR_CAPABILITY_BY_TYPE,
  INSPECTOR_TYPES,
  IMPORT_ONLY_TYPES,
  SHARED_OBJECT_CONTROLS,
  SHARED_EDITOR_SURFACES,
  THREE_D_TYPES,
} from '../../src/components/inspector/capability-matrix.js';

let store;

beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Matrix', 'visual');
});

function collectPaletteTypes() {
  store.project.sceneType = '3d';
  const spy = vi.spyOn(store, 'addObject');
  const w = mount(AssetSidebar);
  for (const c of w.findAll('.shape-card')) c.trigger('click');
  const textBtn = w.findAll('button').find((b) => /add text/i.test(b.attributes('title') || ''));
  if (textBtn) textBtn.trigger('click');
  w.unmount();
  const types = spy.mock.calls.map((c) => c[0]);
  spy.mockRestore();
  return types;
}

describe('inspector capability matrix', () => {
  it('keeps the shared control surface explicit', () => {
    for (const control of [
      'Name',
      'Position',
      'Size',
      'Rotation',
      'Fill',
      'Stroke',
      'Opacity',
      'Layer order',
      'Duration',
      'Entrance animation',
      'Exit animation',
      'Lock / Hide',
    ]) {
      expect(SHARED_OBJECT_CONTROLS).toContain(control);
    }
    expect(SHARED_EDITOR_SURFACES).toEqual(['ObjectInspector', 'ContextMenu', 'MotionPicker']);
  });

  it('covers every addable palette type and asset import type', () => {
    const reachable = new Set([...collectPaletteTypes(), ...IMPORT_ONLY_TYPES]);
    const matrixTypes = new Set(INSPECTOR_TYPES);
    expect([...reachable].filter((t) => !matrixTypes.has(t))).toEqual([]);
    expect([...matrixTypes].filter((t) => !reachable.has(t))).toEqual([]);
  });

  it('documents representative special panels and notes', () => {
    expect(INSPECTOR_CAPABILITY_BY_TYPE.text.settingsComponent).toBe('TextSettings');
    expect(INSPECTOR_CAPABILITY_BY_TYPE.latex.settingsComponent).toBe('LatexSettings');
    expect(INSPECTOR_CAPABILITY_BY_TYPE.axes3d.notes).toContain('Position3DPanel');
    expect(INSPECTOR_CAPABILITY_BY_TYPE.surface.notes).toContain('zExpr');
    expect(INSPECTOR_CAPABILITY_BY_TYPE.code.settingsComponent).toBe('CodeSettings');
    expect(INSPECTOR_CAPABILITY_BY_TYPE.bar_chart.settingsComponent).toBe('BarChartSettings');
  });

  it('marks all 3D rows as 3D family rows', () => {
    for (const type of THREE_D_TYPES) {
      expect(INSPECTOR_CAPABILITY_BY_TYPE[type].family).toBe('3d');
    }
  });
});
