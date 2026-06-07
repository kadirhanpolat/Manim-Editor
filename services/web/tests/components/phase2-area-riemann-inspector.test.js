import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PropertiesPanel from '../../src/components/inspector/PropertiesPanel.vue';
import { useProjectStore } from '../../src/store/project.js';

let store, id, gid;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
  store.addObject('axes', 960, 540);
  id = store.project.objects[0].id;
  store.addGraph(id, { expression: 'x**2' });
  gid = store.objectById(id).graphs[0].id;
  store.selectObject(id);
});

describe('area/riemann inspector', () => {
  it('shows Area and Riemann toggles per graph', () => {
    const html = mount(PropertiesPanel).html();
    expect(html).toContain('Area');
    expect(html).toContain('Riemann');
  });
  it('toggling Area calls updateGraph with an enabled area', async () => {
    const spy = vi.spyOn(store, 'updateGraph');
    const w = mount(PropertiesPanel);
    await w.find('[data-test="graph-area-toggle"]').trigger('click');
    expect(spy).toHaveBeenCalled();
    const areaArg = spy.mock.calls.find((c) => c[2] && c[2].area)?.[2].area;
    expect(areaArg.enabled).toBe(true);
  });
});
