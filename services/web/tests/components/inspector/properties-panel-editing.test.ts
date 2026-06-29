import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../../src/store/project.js';

let store;

beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Edit', 'visual');
});

describe('PropertiesPanel editing coverage', () => {
  it('writes core geometry and opacity edits for a rectangle', async () => {
    const obj = store.addObject('rectangle', 960, 540);
    store.selectObject(obj.id);
    const w = mount(PropertiesPanel);

    const width = w.find('input[aria-label="Width"]');
    await width.setValue('320');
    await width.trigger('change');
    expect(obj.width).toBe(320);

    const opacity = w.find('input[aria-label="Object opacity"]');
    await opacity.setValue('0.5');
    await opacity.trigger('input');
    expect(obj.opacity).toBeCloseTo(0.5, 2);
  });

  it('writes content and font-size edits for a text object', async () => {
    const obj = store.addObject('text', 960, 540);
    store.selectObject(obj.id);
    const w = mount(PropertiesPanel);

    const textarea = w.find('textarea');
    await textarea.setValue('Hello roadmap');
    await textarea.trigger('input');
    expect(obj.content).toBe('Hello roadmap');

    const fontSize = w.find('input[aria-label="Font Size"]');
    await fontSize.setValue('72');
    await fontSize.trigger('change');
    expect(obj.fontSize).toBe(72);
  });
});
