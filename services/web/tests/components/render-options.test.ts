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
