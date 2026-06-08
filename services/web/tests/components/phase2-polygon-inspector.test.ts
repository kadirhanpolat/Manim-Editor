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
  store.commitState();
  store.addObject('polygon_free', 960, 540);
  id = store.project.objects[0].id;
  store.selectObject(id);
});

describe('polygon_free inspector', () => {
  it('shows a Polygon section with a Parallelogram preset button', () => {
    expect(mount(PropertiesPanel).html()).toContain('Parallelogram');
  });
  it('clicking the Parallelogram preset calls setPolygonVertices', async () => {
    const spy = vi.spyOn(store, 'setPolygonVertices');
    const w = mount(PropertiesPanel);
    await w.find('[data-test="preset-parallelogram"]').trigger('click');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][1].length).toBeGreaterThanOrEqual(3);
  });
});
