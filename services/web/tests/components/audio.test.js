import { describe, it, expect, beforeEach } from 'vitest';
import { store, actions, getters } from '../../src/store/project.js';

beforeEach(() => {
  actions.newProject('Test', 'visual');
  actions.commitState();
});

describe('setClipAudio', () => {
  it('adds audio field to a clip', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', text: 'Merhaba', lang: 'tr', syncMode: 'auto', status: 'pending' });
    const found = store.project.tracks[0].clips.find(c => c.id === clip.id);
    expect(found.audio.type).toBe('gtts');
    expect(found.audio.text).toBe('Merhaba');
    expect(found.audio.status).toBe('pending');
  });

  it('auto syncMode updates clip.duration when audio becomes ready', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'ready', duration: 3.5, src: '/data/assets/audio/x.wav' });
    const found = store.project.tracks[0].clips.find(c => c.id === clip.id);
    expect(found.duration).toBe(3.5);
  });

  it('manual syncMode does not change clip.duration when audio becomes ready', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'file', syncMode: 'manual', status: 'ready', duration: 4.0, src: '/data/assets/audio/x.wav' });
    const found = store.project.tracks[0].clips.find(c => c.id === clip.id);
    expect(found.duration).toBe(2); // unchanged
  });
});

describe('removeClipAudio', () => {
  it('removes audio field from clip', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    actions.removeClipAudio(clip.id);
    const found = store.project.tracks[0].clips.find(c => c.id === clip.id);
    expect(found.audio).toBeUndefined();
  });

  it('is a no-op for clip without audio', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    expect(() => actions.removeClipAudio(clip.id)).not.toThrow();
  });
});

describe('hasPendingAudio getter', () => {
  it('returns false when no clips have audio', () => {
    expect(getters.hasPendingAudio()).toBe(false);
  });

  it('returns true when a clip has pending audio', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    expect(getters.hasPendingAudio()).toBe(true);
  });

  it('returns false when all audio is ready', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'ready', src: '/data/assets/audio/x.wav' });
    expect(getters.hasPendingAudio()).toBe(false);
  });
});
