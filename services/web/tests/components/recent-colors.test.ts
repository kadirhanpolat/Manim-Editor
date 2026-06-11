import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../src/store/project.js';
import ColorRow from '../../src/components/inspector/ui/ColorRow.vue';

describe('recentColors', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('starts empty', () => {
    expect(store.recentColors).toEqual([]);
  });

  it('addRecentColor prepends and deduplicates', () => {
    store.addRecentColor('#ff0000');
    store.addRecentColor('#00ff00');
    store.addRecentColor('#ff0000');
    expect(store.recentColors[0]).toBe('#ff0000');
    expect(store.recentColors.length).toBe(2);
  });

  it('caps at 8 colors', () => {
    for (let i = 0; i < 10; i++) store.addRecentColor(`#${String(i).padStart(6, '0')}`);
    expect(store.recentColors.length).toBe(8);
  });
});

describe('ColorRow recent swatches', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    localStorage.removeItem('manim-motion-recent-colors');
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  it('renders swatch buttons when recentColors is non-empty', async () => {
    store.addRecentColor('#ff0000');
    store.addRecentColor('#00ff00');
    const wrapper = mount(ColorRow, {
      props: { label: 'Color', value: '#ffffff' },
    });
    const swatches = wrapper.findAll('.recent-swatch');
    expect(swatches).toHaveLength(2);
  });

  it('emits input with swatch color on click', async () => {
    store.addRecentColor('#ff0000');
    const wrapper = mount(ColorRow, {
      props: { label: 'Color', value: '#ffffff' },
    });
    await wrapper.find('.recent-swatch').trigger('click');
    expect(wrapper.emitted('input')?.[0]).toEqual(['#ff0000']);
  });
});
