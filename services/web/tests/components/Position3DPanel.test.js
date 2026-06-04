import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Position3DPanel from '../../src/components/inspector/Position3DPanel.vue';

const axes3d = {
  type: 'axes3d',
  x3d: 0, y3d: 0, z3d: 0, rx: 0, ry: 0, rz: 0,
  xRange: [-3, 3, 1], yRange: [-3, 3, 1], zRange: [-3, 3, 1],
};

describe('Position3DPanel axes3d ranges', () => {
  it('renders y and z range inputs for axes3d', () => {
    const wrapper = mount(Position3DPanel, { props: { element: axes3d } });
    expect(wrapper.find('[data-testid="yRange-min"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="yRange-max"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zRange-min"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zRange-max"]').exists()).toBe(true);
  });

  it('emits update with new yRange on input', async () => {
    const wrapper = mount(Position3DPanel, { props: { element: axes3d } });
    const input = wrapper.find('[data-testid="yRange-max"]');
    await input.setValue('5');
    const events = wrapper.emitted('update');
    expect(events).toBeTruthy();
    const last = events[events.length - 1][0];
    expect(last.yRange).toEqual([-3, 5, 1]);
  });

  it('emits update with new zRange on input', async () => {
    const wrapper = mount(Position3DPanel, { props: { element: axes3d } });
    const input = wrapper.find('[data-testid="zRange-min"]');
    await input.setValue('-5');
    const events = wrapper.emitted('update');
    const last = events[events.length - 1][0];
    expect(last.zRange).toEqual([-5, 3, 1]);
  });
});
