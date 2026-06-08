import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('setClipAudio', () => {
  it('adds audio field to a clip', () => {
    const clip = store.addClip(0, {
      type: 'move',
      startTime: 0,
      duration: 2,
      sourceId: 'obj1',
      params: {},
    });
    store.setClipAudio(clip.id, {
      type: 'gtts',
      text: 'Merhaba',
      lang: 'tr',
      syncMode: 'auto',
      status: 'pending',
    });
    const found = store.project.tracks[0].clips.find((c) => c.id === clip.id);
    expect(found.audio.type).toBe('gtts');
    expect(found.audio.text).toBe('Merhaba');
    expect(found.audio.status).toBe('pending');
  });

  it('auto syncMode updates clip.duration when audio becomes ready', () => {
    const clip = store.addClip(0, {
      type: 'move',
      startTime: 0,
      duration: 2,
      sourceId: 'obj1',
      params: {},
    });
    store.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    store.setClipAudio(clip.id, {
      type: 'gtts',
      syncMode: 'auto',
      status: 'ready',
      duration: 3.5,
      src: '/data/assets/audio/x.wav',
    });
    const found = store.project.tracks[0].clips.find((c) => c.id === clip.id);
    expect(found.duration).toBe(3.5);
  });

  it('manual syncMode does not change clip.duration when audio becomes ready', () => {
    const clip = store.addClip(0, {
      type: 'move',
      startTime: 0,
      duration: 2,
      sourceId: 'obj1',
      params: {},
    });
    store.setClipAudio(clip.id, {
      type: 'file',
      syncMode: 'manual',
      status: 'ready',
      duration: 4.0,
      src: '/data/assets/audio/x.wav',
    });
    const found = store.project.tracks[0].clips.find((c) => c.id === clip.id);
    expect(found.duration).toBe(2); // unchanged
  });
});

describe('removeClipAudio', () => {
  it('removes audio field from clip', () => {
    const clip = store.addClip(0, {
      type: 'move',
      startTime: 0,
      duration: 2,
      sourceId: 'obj1',
      params: {},
    });
    store.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    store.removeClipAudio(clip.id);
    const found = store.project.tracks[0].clips.find((c) => c.id === clip.id);
    expect(found.audio).toBeUndefined();
  });

  it('is a no-op for clip without audio', () => {
    const clip = store.addClip(0, {
      type: 'move',
      startTime: 0,
      duration: 2,
      sourceId: 'obj1',
      params: {},
    });
    expect(() => store.removeClipAudio(clip.id)).not.toThrow();
  });
});

describe('hasPendingAudio getter', () => {
  it('returns false when no clips have audio', () => {
    expect(store.hasPendingAudio).toBe(false);
  });

  it('returns true when a clip has pending audio', () => {
    const clip = store.addClip(0, {
      type: 'move',
      startTime: 0,
      duration: 2,
      sourceId: 'obj1',
      params: {},
    });
    store.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    expect(store.hasPendingAudio).toBe(true);
  });

  it('returns false when all audio is ready', () => {
    const clip = store.addClip(0, {
      type: 'move',
      startTime: 0,
      duration: 2,
      sourceId: 'obj1',
      params: {},
    });
    store.setClipAudio(clip.id, {
      type: 'gtts',
      syncMode: 'auto',
      status: 'ready',
      src: '/data/assets/audio/x.wav',
    });
    expect(store.hasPendingAudio).toBe(false);
  });
});
