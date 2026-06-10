import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import RenderOptionsDialog from '../../src/components/RenderOptionsDialog.vue';
import { DEFAULT_RENDER_OPTIONS, type RenderOptions } from '../../src/api.js';

let store: ReturnType<typeof useProjectStore>;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

function mountDialog(overrides: Partial<RenderOptions> = {}) {
  return mount(RenderOptionsDialog, {
    props: { modelValue: { ...DEFAULT_RENDER_OPTIONS, ...overrides } },
  });
}

describe('RenderOptionsDialog', () => {
  it('renders all nine choices and marks the defaults active (MP4 / 1080p / 60)', () => {
    const w = mountDialog();
    for (const id of [
      'fmt-mp4',
      'fmt-gif',
      'fmt-webm',
      'res-854x480',
      'res-1280x720',
      'res-1920x1080',
      'fps-15',
      'fps-30',
      'fps-60',
    ]) {
      expect(w.find(`[data-testid="${id}"]`).exists()).toBe(true);
    }
    expect(w.get('[data-testid="fmt-mp4"]').classes()).toContain('active');
    expect(w.get('[data-testid="res-1920x1080"]').classes()).toContain('active');
    expect(w.get('[data-testid="fps-60"]').classes()).toContain('active');
  });

  it('clicking GIF emits update:modelValue with format gif, other fields preserved', async () => {
    const w = mountDialog();
    await w.get('[data-testid="fmt-gif"]').trigger('click');
    const emitted = w.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual({ format: 'gif', resolution: '1920x1080', fps: 60 });
  });

  it('clicking 854x480 and 15 fps emits the corresponding patches', async () => {
    const w = mountDialog({ format: 'webm' });
    await w.get('[data-testid="res-854x480"]').trigger('click');
    expect(w.emitted('update:modelValue')![0][0]).toEqual({
      format: 'webm',
      resolution: '854x480',
      fps: 60,
    });
    await w.get('[data-testid="fps-15"]').trigger('click');
    // second emit still patches the ORIGINAL prop (parent owns the state)
    expect(w.emitted('update:modelValue')![1][0]).toEqual({
      format: 'webm',
      resolution: '1920x1080',
      fps: 15,
    });
  });

  it('marks the active resolution from the prop', () => {
    const w = mountDialog({ resolution: '1280x720', fps: 30 });
    expect(w.get('[data-testid="res-1280x720"]').classes()).toContain('active');
    expect(w.get('[data-testid="fps-30"]').classes()).toContain('active');
    expect(w.get('[data-testid="res-1920x1080"]').classes()).not.toContain('active');
  });
});
