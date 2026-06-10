import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import Timeline from '../../src/components/timeline/Timeline.vue';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.addObject('circle', 960, 540); // named "Circle 1"
  store.commitState();
});

describe('Timeline lock/hide icons', () => {
  it('renders an eye and a lock button with aria-labels for each object row', () => {
    const w = mount(Timeline);
    expect(w.find('[aria-label="Hide Circle 1"]').exists()).toBe(true);
    expect(w.find('[aria-label="Lock Circle 1"]').exists()).toBe(true);
  });

  it('clicking the eye toggles obj.hidden and flips the aria-label', async () => {
    const w = mount(Timeline);
    await w.find('[aria-label="Hide Circle 1"]').trigger('click');
    expect(store.project.objects[0].hidden).toBe(true);
    expect(w.find('[aria-label="Show Circle 1"]').exists()).toBe(true);
  });

  it('clicking the lock toggles obj.locked', async () => {
    const w = mount(Timeline);
    await w.find('[aria-label="Lock Circle 1"]').trigger('click');
    expect(store.project.objects[0].locked).toBe(true);
    expect(w.find('[aria-label="Unlock Circle 1"]').exists()).toBe(true);
  });

  it('icon clicks do not change the selection (@click.stop)', async () => {
    const w = mount(Timeline);
    store.deselectAll();
    await w.find('[aria-label="Hide Circle 1"]').trigger('click');
    expect(store.selectedObjectIds).toEqual([]);
  });

  it('a locked object can still be selected from the timeline row', async () => {
    store.toggleLocked(store.project.objects[0].id);
    const w = mount(Timeline);
    await w.find('.obj-bar').trigger('click');
    expect(store.selectedObjectIds).toEqual([store.project.objects[0].id]);
  });
});
