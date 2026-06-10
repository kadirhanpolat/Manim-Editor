import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import api, { DEFAULT_RENDER_OPTIONS } from '../../src/api.js';

let store: ReturnType<typeof useProjectStore>;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('render export options — api client', () => {
  it('DEFAULT_RENDER_OPTIONS preserves today’s behavior (mp4 / 1920x1080 / 60)', () => {
    expect(DEFAULT_RENDER_OPTIONS).toEqual({ format: 'mp4', resolution: '1920x1080', fps: 60 });
  });

  it('getLatestUrl defaults to .mp4 and follows an explicit extension', () => {
    expect(api.renders.getLatestUrl('p1')).toMatch(/\/api\/renders\/p1\/latest\.mp4\?t=\d+/);
    expect(api.renders.getLatestUrl('p1', 'gif')).toMatch(/\/api\/renders\/p1\/latest\.gif\?t=\d+/);
    expect(api.renders.getLatestUrl('p1', 'webm')).toMatch(
      /\/api\/renders\/p1\/latest\.webm\?t=\d+/
    );
  });
});

describe('render export options — store', () => {
  it('defaults renderFormat to mp4', () => {
    expect(store.renderFormat).toBe('mp4');
  });

  it('renderOnServer records the chosen format before any network call', async () => {
    // The fetch inside saveToServer fails in jsdom (no server) and is caught by
    // renderOnServer's try/catch — renderFormat is set synchronously before it.
    await store.renderOnServer({ format: 'webm', resolution: '1280x720', fps: 30 });
    expect(store.renderFormat).toBe('webm');
    expect(store.showRenderDialog).toBe(true);
  });

  it('renderOnServer without arguments keeps today’s defaults', async () => {
    await store.renderOnServer();
    expect(store.renderFormat).toBe('mp4');
    expect(store.renderQuality).toBe('high');
  });
});
