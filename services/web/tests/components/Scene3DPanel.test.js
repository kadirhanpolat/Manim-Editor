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
  it('changing projection select updates store', async () => {
    const wrapper = mount(Scene3DPanel);
    const select = wrapper.get('[data-testid="projection-mode"]');
    await select.setValue('perspective');
    expect(store.project.camera3d.projection).toBe('perspective');
  });

  it('focal distance input visible only in perspective mode', async () => {
    store.setCamera3d({ projection: 'orthographic' });
    const wrapper = mount(Scene3DPanel);
    expect(wrapper.find('[data-testid="focal-distance"]').exists()).toBe(false);
    store.setCamera3d({ projection: 'perspective' });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="focal-distance"]').exists()).toBe(true);
  });
});
