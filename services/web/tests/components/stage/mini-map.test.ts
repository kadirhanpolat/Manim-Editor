import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StageMiniMap from '../../../src/components/stage/StageMiniMap.vue';

function makeRootBox() {
  return {
    left: 0,
    top: 0,
    width: 160,
    height: 112,
    right: 160,
    bottom: 112,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

describe('StageMiniMap', () => {
  it('renders the stage frame, objects, and viewport frame', () => {
    const w = mount(StageMiniMap, {
      props: {
        is3d: false,
        stageWidth: 1000,
        stageHeight: 500,
        viewportWidth: 500,
        viewportHeight: 250,
        ox: 0,
        oy: 0,
        vs: 0.5,
        accent: '#4CEEF9',
        objects: [{ id: 'box', x: 500, y: 250, width: 100, height: 80 }],
      },
    });

    expect(w.find('[data-test="stage-minimap"]').exists()).toBe(true);
    expect(w.find('[data-test="minimap-stage-frame"]').exists()).toBe(true);
    expect(w.findAll('[data-test="minimap-object-frame"]')).toHaveLength(1);

    const viewport = w.find('[data-test="minimap-viewport-frame"]');
    expect(viewport.attributes('width')).toBe('140');
    expect(viewport.attributes('height')).toBe('70');
  });

  it('emits a focus point when the minimap is clicked', async () => {
    const w = mount(StageMiniMap, {
      props: {
        is3d: false,
        stageWidth: 1000,
        stageHeight: 500,
        viewportWidth: 500,
        viewportHeight: 250,
        ox: 0,
        oy: 0,
        vs: 0.5,
        accent: '#4CEEF9',
        objects: [],
      },
    });

    Object.defineProperty(w.find('[data-test="stage-minimap"]').element, 'getBoundingClientRect', {
      value: () => makeRootBox(),
    });

    await w.find('[data-test="stage-minimap"]').trigger('mousedown', {
      clientX: 80,
      clientY: 56,
    });

    expect(w.emitted('focus')?.[0]?.[0].x).toBeCloseTo(500);
    expect(w.emitted('focus')?.[0]?.[0].y).toBeCloseTo(250);
  });
});
