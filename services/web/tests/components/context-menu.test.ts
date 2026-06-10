import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ContextMenu from '../../src/components/stage/ContextMenu.vue';

function makeItems(overrides = {}) {
  return [
    { id: 'copy', label: 'Copy', action: vi.fn() },
    { id: 'sep1', separator: true },
    { id: 'paste', label: 'Paste', disabled: true, action: vi.fn() },
    ...((overrides.extra as never[]) || []),
  ];
}

describe('ContextMenu', () => {
  it('renders labelled buttons and separators at the given position', () => {
    const w = mount(ContextMenu, { props: { x: 100, y: 120, items: makeItems() } });
    const menu = w.find('[role="menu"]');
    expect(menu.exists()).toBe(true);
    expect(w.findAll('button.menu-item')).toHaveLength(2);
    expect(w.find('.menu-sep').exists()).toBe(true);
    expect(w.text()).toContain('Copy');
  });

  it('clicking an item runs its action and emits close', async () => {
    const items = makeItems();
    const w = mount(ContextMenu, { props: { x: 0, y: 0, items } });
    await w.findAll('button.menu-item')[0].trigger('click');
    expect(items[0].action).toHaveBeenCalledTimes(1);
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('a disabled item neither runs nor closes', async () => {
    const items = makeItems();
    const w = mount(ContextMenu, { props: { x: 0, y: 0, items } });
    await w.findAll('button.menu-item')[1].trigger('click');
    expect(items[2].action).not.toHaveBeenCalled();
    expect(w.emitted('close')).toBeUndefined();
  });

  it('Escape emits close', async () => {
    const w = mount(ContextMenu, {
      props: { x: 0, y: 0, items: makeItems() },
      attachTo: document.body,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await w.vm.$nextTick();
    expect(w.emitted('close')).toHaveLength(1);
    w.unmount();
  });

  it('mousedown outside the menu emits close', async () => {
    const w = mount(ContextMenu, {
      props: { x: 0, y: 0, items: makeItems() },
      attachTo: document.body,
    });
    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await w.vm.$nextTick();
    expect(w.emitted('close')).toHaveLength(1);
    w.unmount();
  });
});
