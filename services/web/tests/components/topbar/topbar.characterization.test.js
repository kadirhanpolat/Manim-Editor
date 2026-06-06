import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Topbar from '../../../src/components/topbar/Topbar.vue';
import { useProjectStore } from '../../../src/store/project.js';

function norm(html) {
  return html
    .replace(/ data-v-[0-9a-f]+(="")?/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function setWidth(px) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => px,
  });
}

let store;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Char', 'visual');
});
afterEach(() => {
  delete HTMLElement.prototype.clientWidth;
  vi.unstubAllGlobals();
});

describe('Topbar characterization', () => {
  it('desktop nav (wide)', async () => {
    setWidth(1000);
    const w = mount(Topbar);
    await nextTick(); // flush onMounted reactivity
    expect(norm(w.html())).toMatchSnapshot();
  });

  it('collapsed hamburger (narrow)', async () => {
    // No setWidth — JSDOM clientWidth defaults to 0 which is < 640
    // onMounted sets collapsed=true; await nextTick() lets Vue re-render
    const w = mount(Topbar);
    await nextTick();
    expect(norm(w.html())).toMatchSnapshot();
  });

  it('new project dialog open', async () => {
    setWidth(1000);
    const w = mount(Topbar);
    await nextTick(); // flush onMounted reactivity (ensure desktop nav is visible)
    // Click the "File" menu label to open the File dropdown
    const fileBtn = w.findAll('.menu-label').find(b => b.text().includes('File'));
    await fileBtn.trigger('click');
    await w.vm.$nextTick();
    // Find and click the "New Project" menu item
    const newProjectItem = w.findAll('.menu-item').find(b => b.text().includes('New Project'));
    await newProjectItem.trigger('click');
    await w.vm.$nextTick();
    expect(norm(w.html())).toMatchSnapshot();
  });
});
