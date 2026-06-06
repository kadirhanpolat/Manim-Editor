import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../../src/store/project.js';

const OBJECT_TYPES = [
  'rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon',
  'line', 'arrow', 'heart', 'dot', 'dot_grid', 'text', 'latex', 'axes',
  'numberplane', 'numberline', 'annulus', 'arc', 'sector', 'double_arrow',
  'polygon_free', 'parametric', 'matrix', 'brace', 'angle', 'counter', 'table',
  'complex_plane', 'polar_plane', 'graph', 'vector_field',
];

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Char', 'visual');
});

describe('PropertiesPanel characterization — object branch', () => {
  for (const type of OBJECT_TYPES) {
    it(`renders identically for ${type}`, () => {
      store.addObject(type, 960, 540);
      const o = store.project.objects[store.project.objects.length - 1];
      store.selectObject(o.id);
      const w = mount(PropertiesPanel);
      expect(w.html()).toMatchSnapshot();
    });
  }
});

describe('PropertiesPanel characterization — canvas branch', () => {
  it('nothing selected (canvas)', () => {
    const w = mount(PropertiesPanel);
    expect(w.html()).toMatchSnapshot();
  });
});
