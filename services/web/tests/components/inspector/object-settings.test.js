import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../../src/store/project.js';
import DotGridSettings from '../../../src/components/inspector/object-settings/DotGridSettings.vue';
import CounterSettings from '../../../src/components/inspector/object-settings/CounterSettings.vue';
import PolarPlaneSettings from '../../../src/components/inspector/object-settings/PolarPlaneSettings.vue';
import TableSettings from '../../../src/components/inspector/object-settings/TableSettings.vue';
import { settingsComponentFor } from '../../../src/components/inspector/object-settings/index.js';

let store;
function makeObj(type) {
  store.addObject(type, 960, 540);
  return store.project.objects[store.project.objects.length - 1];
}
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
});

describe('object-settings registry', () => {
  it('maps known types to a component and unknown types to null', () => {
    expect(settingsComponentFor('dot_grid')).toBeTruthy();
    expect(settingsComponentFor('axes')).toBeTruthy();
    expect(settingsComponentFor('rectangle')).toBe(null);
  });
});

describe('DotGridSettings', () => {
  it('editing Columns calls updateObject with gridCols', async () => {
    const obj = makeObj('dot_grid');
    const spy = vi.spyOn(store, 'updateObject');
    const w = mount(DotGridSettings, { props: { obj } });
    // Num atom wraps an <input type="number"> and emits Number($event.target.value) on change.
    // Index 0 = first Num = Columns field.
    const input = w.findAll('input[type="number"]')[0];
    await input.setValue('7');
    await input.trigger('change');
    expect(spy).toHaveBeenCalledWith(obj.id, { gridCols: 7 });
  });
});

describe('CounterSettings', () => {
  it('editing suffix calls setCounterSuffix', async () => {
    const obj = makeObj('counter');
    const spy = vi.spyOn(store, 'setCounterSuffix');
    const w = mount(CounterSettings, { props: { obj } });
    // Suffix field is the only <input type="text">; @input passes $event.target.value (string).
    const suffix = w.find('input[type="text"]');
    await suffix.setValue('%');
    await suffix.trigger('input');
    expect(spy).toHaveBeenCalledWith(obj.id, '%');
  });
});

describe('PolarPlaneSettings', () => {
  it('editing Radius Max calls setPolarRadiusMax', async () => {
    const obj = makeObj('polar_plane');
    const spy = vi.spyOn(store, 'setPolarRadiusMax');
    const w = mount(PolarPlaneSettings, { props: { obj } });
    // Raw <input type="number"> fields: index 0 = Radius Max, 1 = Radius Step, 2 = Azimuth Units.
    // @change passes $event.target.value as a raw string.
    const input = w.findAll('input[type="number"]')[0];
    await input.setValue('6');
    await input.trigger('change');
    expect(spy).toHaveBeenCalledWith(obj.id, '6');
  });
});

describe('TableSettings', () => {
  it('+ Row calls addTableRow', async () => {
    const obj = makeObj('table');
    const spy = vi.spyOn(store, 'addTableRow');
    const w = mount(TableSettings, { props: { obj } });
    const addRow = w.findAll('button').find(b => b.text() === '+ Row');
    await addRow.trigger('click');
    expect(spy).toHaveBeenCalledWith(obj.id);
  });
});
