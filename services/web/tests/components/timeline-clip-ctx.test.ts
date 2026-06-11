import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import TimelineClip from '../../src/components/timeline/TimelineClip.vue';

describe('TimelineClip context menu', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('renders context menu on right-click', async () => {
    const clip = {
      id: 'c1', type: 'fade', objectId: 'o1',
      startTime: 0, duration: 2, easing: 'ease_in_out', parallel: false,
    };
    const wrapper = mount(TimelineClip, {
      props: { clip, pps: 100 },
      attachTo: document.body,
    });
    await wrapper.trigger('contextmenu');
    expect(wrapper.find('.ctx-menu').exists()).toBe(true);
    wrapper.unmount();
  });

  it('hides context menu when @close is emitted', async () => {
    const clip = {
      id: 'c1', type: 'fade', objectId: 'o1',
      startTime: 0, duration: 2, easing: 'ease_in_out', parallel: false,
    };
    const wrapper = mount(TimelineClip, {
      props: { clip, pps: 100 },
      attachTo: document.body,
    });
    await wrapper.trigger('contextmenu');
    expect(wrapper.find('.ctx-menu').exists()).toBe(true);
    // Close by finding ContextMenu and emitting close
    const ctxMenuWrapper = wrapper.findComponent({ name: 'ContextMenu' });
    await ctxMenuWrapper.vm.$emit('close');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.ctx-menu').exists()).toBe(false);
    wrapper.unmount();
  });
});
