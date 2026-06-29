import { beforeAll, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { shallowMount } from '@vue/test-utils';
import { performance } from 'node:perf_hooks';
import StageCanvas from '../../../src/components/stage/StageCanvas.vue';
import { useProjectStore } from '../../../src/store/project.js';

const RUN_PROFILE = process.env.RUN_STAGE_PROFILE === '1';

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

function mountStageWithObjects(count: number) {
  setActivePinia(createPinia());
  const store = useProjectStore();
  store.newProject(`Perf ${count}`, 'visual');

  const axes = store.addObject('axes', 960, 540);
  store.updateObject(axes.id, {
    graphs: [
      {
        id: 'g1',
        expression: 'Math.sin(x)',
        color: '#f59e0b',
        xMin: -3,
        xMax: 3,
        strokeWidth: 3,
        area: { enabled: true, xMin: -2, xMax: 2, opacity: 0.3 },
        riemann: { enabled: true, xMin: -2, xMax: 2, dx: 0.2, type: 'left' },
        tangent: { enabled: true, x: 1, length: 2 },
      },
    ],
  });

  const palette = ['circle', 'square', 'triangle', 'ellipse', 'star', 'line', 'arrow'];
  for (let i = 1; i < count; i++) {
    const type = palette[i % palette.length];
    const x = 120 + ((i * 97) % 1680);
    const y = 120 + ((i * 53) % 840);
    store.addObject(type, x, y);
  }

  const stubs = {
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
  };

  const start = performance.now();
  const wrapper = shallowMount(StageCanvas, { global: { stubs } });
  return { wrapper, start };
}

async function profileMount(count: number): Promise<number> {
  const { wrapper, start } = mountStageWithObjects(count);
  await wrapper.vm.$nextTick();
  const elapsed = performance.now() - start;
  wrapper.unmount();
  console.info(`[stage-profile] ${count} objects: ${elapsed.toFixed(1)}ms`);
  return elapsed;
}

describe.skipIf(!RUN_PROFILE)('StageCanvas large-scene profile', () => {
  it('mounts 100, 250, and 500 object scenes without blowing up', async () => {
    const samples = [];
    await profileMount(25);
    for (const count of [100, 250, 500]) {
      const elapsed = await profileMount(count);
      samples.push({ count, elapsed });
      expect(elapsed).toBeLessThan(10_000);
    }
    expect(samples).toHaveLength(3);
  });
});
