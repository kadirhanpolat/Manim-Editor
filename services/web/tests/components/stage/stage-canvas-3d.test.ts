import { beforeAll, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { shallowMount } from '@vue/test-utils';
import StageCanvas from '../../../src/components/stage/StageCanvas.vue';
import { useProjectStore } from '../../../src/store/project.js';

const canvasCtx = {
  clearRect() {},
  fillRect() {},
  fillText() {},
  save() {},
  restore() {},
  translate() {},
  rotate() {},
  beginPath() {},
  stroke() {},
  moveTo() {},
  lineTo() {},
  arc() {},
  closePath() {},
  fill() {},
  set fillStyle(_v) {},
  set strokeStyle(_v) {},
  set font(_v) {},
  set textAlign(_v) {},
};

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLCanvasElement.prototype.getContext = () => canvasCtx as unknown as CanvasRenderingContext2D;
});

function mountStage() {
  setActivePinia(createPinia());
  const store = useProjectStore();
  store.newProject('3D test', 'visual');
  store.project.sceneType = '3d';
  return shallowMount(StageCanvas, {
    global: {
      stubs: {
        'v-arrow': true,
        'v-circle': true,
        'v-ellipse': true,
        'v-group': true,
        'v-image': true,
        'v-layer': true,
        'v-line': true,
        'v-rect': true,
        'v-regular-polygon': true,
        'v-ring': true,
        'v-shape': true,
        'v-stage': true,
        'v-star': true,
        'v-text': true,
        'v-transformer': true,
        'v-wedge': true,
        ContextMenu: true,
        StageMiniMap: true,
      },
    },
  });
}

describe('StageCanvas 3D viewport overlays', () => {
  it('keeps rulers visible in 3D scenes', async () => {
    const w = mountStage();
    await w.vm.$nextTick();
    expect(w.find('canvas.ruler-h').exists()).toBe(true);
    expect(w.find('canvas.ruler-v').exists()).toBe(true);
    expect(w.find('.ruler-corner').exists()).toBe(true);
  });
});
