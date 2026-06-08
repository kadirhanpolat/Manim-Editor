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

describe('matrix inspector', () => {
  it('shows a Matrix section with a cell input per entry', () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    expect(wrapper.html()).toContain('Matrix');
    expect(wrapper.findAll('[data-test="matrix-cell"]').length).toBe(4);
  });

  it('editing a cell input writes through setMatrixCell', async () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    const cell = wrapper.findAll('[data-test="matrix-cell"]')[0];
    await cell.setValue('9');
    await cell.trigger('input');
    expect(store.project.objects[0].matrixData[0][0]).toBe('9');
  });

  it('Add Row button grows the grid to 6 cells (3x2)', async () => {
    store.addObject('matrix', 960, 540);
    id = store.project.objects[0].id;
    store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    await wrapper.find('[data-test="matrix-add-row"]').trigger('click');
    expect(store.project.objects[0].matrixData.length).toBe(3);
    expect(wrapper.findAll('[data-test="matrix-cell"]').length).toBe(6);
  });
});
