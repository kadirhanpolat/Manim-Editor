import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { useProjectStore } from '../../../src/store/project.js';
import { buildMenus } from '../../../src/components/topbar/menus.js';
import NewProjectDialog from '../../../src/components/topbar/NewProjectDialog.vue';
import MenuBar from '../../../src/components/topbar/MenuBar.vue';

beforeEach(() => {
  setActivePinia(createPinia());
  useProjectStore().newProject('T', 'visual');
});

describe('buildMenus', () => {
  it('returns the 5 top-level menus and wires injected callbacks', () => {
    const loadProject = vi.fn();
    const canGroup = ref(false);
    const menus = buildMenus({
      mod: 'Ctrl+', isMac: false, store: {},
      isSaving: ref(false), canGroup, gridVisible: ref(true), snapEnabled: ref(false), currentTheme: ref('dark'),
      newProject: vi.fn(), loadProject, saveProject: vi.fn(), saveToServer: vi.fn(), browseServer: vi.fn(),
      openExport: vi.fn(), openRender: vi.fn(), showShortcuts: vi.fn(), showAbout: vi.fn(),
      toggleGrid: vi.fn(), toggleSnap: vi.fn(), groupSelected: vi.fn(),
    });
    expect(menus.map(m => m.id)).toEqual(['file', 'edit', 'view', 'tools', 'help']);
    const open = menus[0].items.find(i => i.id === 'f-open');
    open.action();
    expect(loadProject).toHaveBeenCalled();
    const group = menus[1].items.find(i => i.id === 'e-group');
    expect(group.disabled()).toBe(true);
    canGroup.value = true;
    expect(group.disabled()).toBe(false);
  });
});

describe('NewProjectDialog', () => {
  it('Create calls store.newProject and emits close', async () => {
    const store = useProjectStore();
    // Spy after the store is initialized so we only capture the dialog call
    const spy = vi.spyOn(store, 'newProject');
    const w = mount(NewProjectDialog, { props: { show: true } });
    await w.vm.$nextTick();
    await w.find('.np-input').setValue('Hello');
    await w.find('.np-btn-create').trigger('click');
    expect(spy).toHaveBeenCalledWith('Hello', 'visual');
    expect(w.emitted('close')).toBeTruthy();
  });

  it('Cancel emits close without creating', async () => {
    const store = useProjectStore();
    const spy = vi.spyOn(store, 'newProject');
    const w = mount(NewProjectDialog, { props: { show: true } });
    await w.find('.np-btn-cancel').trigger('click');
    expect(spy).not.toHaveBeenCalled();
    expect(w.emitted('close')).toBeTruthy();
  });
});

describe('MenuBar', () => {
  it('clicking a label opens its dropdown; clicking an item runs action + closes', async () => {
    const action = vi.fn();
    const m = [{ id: 'file', label: 'File', items: [{ id: 'x', label: 'Item X', action }] }];
    const w = mount(MenuBar, { props: { menus: m, collapsed: false } });
    await w.find('.menu-label').trigger('click');
    await w.vm.$nextTick();
    expect(w.find('.menu-dropdown').exists()).toBe(true);
    await w.find('.menu-item').trigger('click');
    expect(action).toHaveBeenCalled();
    expect(w.find('.menu-dropdown').exists()).toBe(false);
  });
});
