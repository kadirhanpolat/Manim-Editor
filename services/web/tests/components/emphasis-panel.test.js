import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('emphasis inspector', () => {
  it('shows an Indicate button for a selected object and clicking creates an indicate clip', async () => {
    store.addObject('circle', 960, 540);
    const id = store.project.objects[0].id;
    store.selectObject(id);
    const wrapper = mount(PropertiesPanel);
    const btn = wrapper.find('[data-test="anim-indicate"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    const clip = store.project.tracks.flatMap(t => t.clips).find(c => c.type === 'indicate');
    expect(clip).toBeTruthy();
    expect(clip.params.scale_factor).toBe(1.2);
    expect(clip.params.color).toBe('#FFFF00');
  });

  it('shows the scale_factor control for a selected indicate clip', () => {
    store.addObject('circle', 960, 540);
    store.selectObject(store.project.objects[0].id);
    store.createAnimation('indicate', { color: '#FFFF00', scale_factor: 1.2 });
    const clipId = store.project.tracks.flatMap(t => t.clips)[0].id;
    store.selectClip(clipId);
    const wrapper = mount(PropertiesPanel);
    expect(wrapper.find('[data-test="emph-scale-factor"]').exists()).toBe(true);
  });
});
