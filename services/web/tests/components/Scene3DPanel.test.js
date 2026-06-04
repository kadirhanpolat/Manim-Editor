import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import Scene3DPanel from '../../src/components/inspector/Scene3DPanel.vue';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.setSceneType('3d');
  store.commitState();
});

describe('Scene3DPanel', () => {
  it('zoom slider updates store', async () => {
    const wrapper = mount(Scene3DPanel);
    const zoom = wrapper.get('[data-testid="cam-zoom"]');
    await zoom.setValue('2');
    expect(store.project.camera3d.zoom).toBeCloseTo(2);
  });

  it('orbit (phi) + focal distance show in perspective, hide in axis views', async () => {
    store.setCamera3d({ view: 'perspective' });
    const wrapper = mount(Scene3DPanel);
    expect(wrapper.find('[data-testid="cam-phi"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="focal-distance"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cam-zoom"]').exists()).toBe(true);

    store.setCamera3d({ view: 'top' });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="cam-phi"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="focal-distance"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="cam-zoom"]').exists()).toBe(true); // zoom always shown
  });
});
