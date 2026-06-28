import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../src/store/project.js';
import CommandPalette from '../../src/components/command/CommandPalette.vue';

let store: ReturnType<typeof useProjectStore>;

beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Commands', 'visual');
});

function mountPalette() {
  return mount(CommandPalette, { props: { open: true } });
}

describe('CommandPalette', () => {
  it('adds an object from a filtered command', async () => {
    const w = mountPalette();
    await w.find('[data-test="command-search"]').setValue('circle');
    await w.find('[data-test="command-add-circle"]').trigger('click');
    expect(store.project.objects).toHaveLength(1);
    expect(store.project.objects[0].type).toBe('circle');
    expect(store.selectedObjectIds).toEqual([store.project.objects[0].id]);
    expect(w.emitted('close')).toBeTruthy();
  });

  it('selects an existing object by name', async () => {
    const circle = store.addObject('circle', 100, 100, { name: 'Focus Target' });
    store.addObject('square', 200, 200);
    store.deselectAll();
    const w = mountPalette();
    await w.find('[data-test="command-search"]').setValue('focus');
    await w.find(`[data-test="command-select-${circle.id}"]`).trigger('click');
    expect(store.selectedObjectIds).toEqual([circle.id]);
  });

  it('hides 3D add commands until the scene is 3D', async () => {
    const w = mountPalette();
    await w.find('[data-test="command-search"]').setValue('sphere');
    expect(w.find('[data-test="command-add-sphere"]').exists()).toBe(false);
    store.project.sceneType = '3d';
    await w.vm.$nextTick();
    expect(w.find('[data-test="command-add-sphere"]').exists()).toBe(true);
  });

  it('runs view toggle commands', async () => {
    const w = mountPalette();
    expect(store.project.stage.snapEnabled).toBe(true);
    await w.find('[data-test="command-search"]').setValue('disable snap');
    await w.find('[data-test="command-toggle-snap"]').trigger('click');
    expect(store.project.stage.snapEnabled).toBe(false);
  });
});
