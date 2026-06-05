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

describe('effects panel — shadow + round', () => {
  it('shows the corner-radius control for a triangle', () => {
    store.addObject('triangle', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    expect(mount(PropertiesPanel).find('[data-test="corner-radius"]').exists()).toBe(true);
  });

  it('shows a shadow toggle for a circle and enabling writes a shadow', async () => {
    store.addObject('circle', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    const toggle = wrapper.find('[data-test="shadow-toggle"]');
    expect(toggle.exists()).toBe(true);
    await toggle.trigger('click');
    expect(store.project.objects[0].shadow).toBeTruthy();
  });
});
