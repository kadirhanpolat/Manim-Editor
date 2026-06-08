import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
  store.addObject('parametric', 960, 540);
  id = store.project.objects[0].id;
  store.selectObject(id);
});

describe('parametric inspector', () => {
  it('shows x(t) and y(t) inputs', () => {
    const html = mount(PropertiesPanel).html();
    expect(html).toContain('x(t)');
    expect(html).toContain('y(t)');
  });
});
