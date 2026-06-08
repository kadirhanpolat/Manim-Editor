import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import ErrorBoundary from '../../src/components/ErrorBoundary.vue';

const Boom = defineComponent({
  setup() {
    throw new Error('kaboom');
  },
  render() {
    return h('div');
  },
});

const Ok = defineComponent({
  render() {
    return h('div', { class: 'ok-child' }, 'healthy');
  },
});

describe('ErrorBoundary', () => {
  it('renders slot content when the child is healthy', () => {
    const wrapper = mount(ErrorBoundary, { slots: { default: () => h(Ok) } });
    expect(wrapper.find('.ok-child').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('isolates a throwing child and shows the fallback (with label + message)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mount(ErrorBoundary, {
      props: { label: 'test panel' },
      slots: { default: () => h(Boom) },
    });
    await nextTick();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test panel');
    expect(wrapper.text()).toContain('kaboom');
    expect(wrapper.find('.ok-child').exists()).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('retry re-renders the slot (recovers once the cause is gone)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    const Flaky = defineComponent({
      setup() {
        if (shouldThrow) throw new Error('flaky');
      },
      render() {
        return h('div', { class: 'recovered' }, 'ok now');
      },
    });
    const wrapper = mount(ErrorBoundary, {
      props: { label: 'p' },
      slots: { default: () => h(Flaky) },
    });
    await nextTick();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);

    shouldThrow = false; // cause resolved
    await wrapper.find('.eb-retry').trigger('click');
    await nextTick();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('.recovered').exists()).toBe(true);
    spy.mockRestore();
  });
});
