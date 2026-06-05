import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store, id;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.addObject('rectangle', 960, 540);
  id = store.project.objects[0].id;
  store.selectObject(id);
});

describe('Effects panel', () => {
  it('shows a corner-radius control for a rectangle', () => {
    const w = mount(PropertiesPanel);
    expect(w.find('[data-test="corner-radius"]').exists()).toBe(true);
  });

  it('hides the corner-radius control for a circle', () => {
    store.project.objects[0].type = 'circle';
    const w = mount(PropertiesPanel);
    expect(w.find('[data-test="corner-radius"]').exists()).toBe(false);
  });

  it('toggling gradient on calls setGradient with two stops', async () => {
    const spy = vi.spyOn(store, 'setGradient');
    const w = mount(PropertiesPanel);
    const toggle = w.find('[data-test="gradient-toggle"]');
    await toggle.trigger('click');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toBe(id);
    expect(spy.mock.calls[0][1].colors.length).toBeGreaterThanOrEqual(2);
  });
});
