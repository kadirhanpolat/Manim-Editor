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

describe('relational inspector', () => {
  it('shows a Brace section with a label input', () => {
    store.addObject('brace', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    expect(wrapper.html()).toContain('Brace');
    expect(wrapper.find('[data-test="rel-label"]').exists()).toBe(true);
  });

  it('typing a label writes through setRelationalLabel', async () => {
    store.addObject('brace', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    const input = wrapper.find('[data-test="rel-label"]');
    await input.setValue('x');
    await input.trigger('input');
    expect(store.project.objects[0].label).toBe('x');
  });

  it('Angle section shows a right-angle toggle that writes through', async () => {
    store.addObject('angle', 960, 540);
    id = store.project.objects[0].id; store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    expect(wrapper.html()).toContain('Angle');
    await wrapper.find('[data-test="angle-right"]').trigger('click');
    expect(store.project.objects[0].rightAngle).toBe(true);
  });
});
