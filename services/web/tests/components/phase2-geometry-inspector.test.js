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
});

describe('phase 2 geometry inspector', () => {
  it('shows inner/outer radius for annulus', () => {
    store.addObject('annulus', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    expect(mount(PropertiesPanel).html()).toContain('Inner radius');
  });
  it('shows sweep angle for sector', () => {
    store.addObject('sector', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    expect(mount(PropertiesPanel).html()).toContain('Sweep');
  });
});
