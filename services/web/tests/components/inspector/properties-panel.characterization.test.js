import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../../src/store/project.js';

const OBJECT_TYPES = [
  'rectangle',
  'square',
  'circle',
  'ellipse',
  'triangle',
  'star',
  'polygon',
  'line',
  'arrow',
  'heart',
  'dot',
  'dot_grid',
  'text',
  'latex',
  'axes',
  'numberplane',
  'numberline',
  'annulus',
  'arc',
  'sector',
  'double_arrow',
  'polygon_free',
  'parametric',
  'matrix',
  'brace',
  'angle',
  'counter',
  'table',
  'complex_plane',
  'polar_plane',
  'graph',
  'vector_field',
];

// Normalize away rendering noise that this decomposition legitimately churns but
// which carries NO behavioral meaning, so the snapshot stays a true guard over the
// real content (elements, classes, attribute values, text):
//   1. data-v-xxxxxxxx scoped-style hashes — change as markup moves between components.
//   2. HTML comment nodes — v-if/`<component :is>` placeholders (and decorator comments)
//      appear/disappear as ~20 `<Section v-if="type===X">` blocks collapse into one
//      dynamic `<component :is>` slot. Comments mark only ABSENT conditionals; real
//      content is unaffected.
//   3. inter-tag whitespace — formatting only.
function norm(html) {
  return html
    .replace(/ data-v-[0-9a-f]+(="")?/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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
      expect(norm(w.html())).toMatchSnapshot();
    });
  }
});

describe('PropertiesPanel characterization — canvas branch', () => {
  it('nothing selected (canvas)', () => {
    const w = mount(PropertiesPanel);
    expect(norm(w.html())).toMatchSnapshot();
  });
});
