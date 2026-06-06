import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import FontSelector from '../../src/components/inspector/FontSelector.vue';

// Two pages of fonts so we can exercise pagination / "load more".
const PAGE1 = [
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
];
const PAGE2 = [
  { family: 'Merriweather', category: 'serif' },
];

// hasMore is `fonts.length < total`. total=5 with a 2-font page 1 keeps the "load more"
// button visible (2 < 5) so the pagination path is exercised.
function mockFetch() {
  let call = 0;
  return vi.fn(async () => {
    call += 1;
    const fonts = call === 1 ? PAGE1 : PAGE2;
    return { json: async () => ({ fonts, total: 5 }) };
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FontSelector (behavior lock)', () => {
  it('opens the dropdown on focus and lists fetched fonts', async () => {
    const w = mount(FontSelector, { props: { value: 'Roboto' } });
    await w.find('input').trigger('focus');
    await flushPromises();
    expect(w.find('.font-dropdown').exists()).toBe(true);
    const items = w.findAll('.font-item');
    expect(items.length).toBe(2);
    expect(w.text()).toContain('Roboto');
    expect(w.text()).toContain('Lato');
  });

  it('selecting a font emits input with the family', async () => {
    const w = mount(FontSelector, { props: { value: 'Roboto' } });
    await w.find('input').trigger('focus');
    await flushPromises();
    await w.findAll('.font-item')[1].trigger('mousedown');
    expect(w.emitted('input')[0]).toEqual(['Lato']);
  });

  it('"load more" appends the next page', async () => {
    const w = mount(FontSelector, { props: { value: 'Roboto' } });
    await w.find('input').trigger('focus');
    await flushPromises();
    expect(w.findAll('.font-item').length).toBe(2);
    // hasMore: offset(2) + 0 < total(3) → load-more button visible
    await w.find('.load-more-btn').trigger('mousedown');
    await flushPromises();
    expect(w.findAll('.font-item').length).toBe(3);
    expect(w.text()).toContain('Merriweather');
  });
});
