import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Num from '../../src/components/inspector/ui/Num.vue';

describe('Num scrubbing', () => {
  it('label has num-label class and ew-resize cursor', () => {
    const w = mount(Num, { props: { label: 'X', value: 10, step: 1 } });
    const label = w.find('.num-label');
    expect(label.exists()).toBe(true);
    expect(label.classes()).toContain('cursor-ew-resize');
  });

  it('emits input on mousedown + document mousemove 50px right', async () => {
    const w = mount(Num, { props: { label: 'X', value: 10, step: 1 } });
    const label = w.find('.num-label');
    await label.trigger('mousedown', { clientX: 100 });
    // 50px right = +0.5 units (50/100 * step=1)
    const moveEvent = new MouseEvent('mousemove', { clientX: 150, shiftKey: false });
    document.dispatchEvent(moveEvent);
    await w.vm.$nextTick();
    const emitted = w.emitted('input') as number[][];
    expect(emitted).toBeTruthy();
    expect(emitted![emitted!.length - 1]![0]).toBeCloseTo(10.5, 1);
  });
});
