import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

describe('splitClip', () => {
  let store: ReturnType<typeof useProjectStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
  });

  function addObjectAndClip() {
    const obj = store.addObject('circle', 960, 540);
    store.addClip(0, { type: 'fade', objectId: obj.id, startTime: 0, duration: 4 });
    return store.project.tracks[0]!.clips[0]!;
  }

  it('splits a clip at playback time', () => {
    const clip = addObjectAndClip();
    store.setPlaybackTime(2);
    store.splitClip(clip.id);
    const clips = store.project.tracks[0]!.clips;
    expect(clips).toHaveLength(2);
    expect(clips[0]!.startTime).toBe(0);
    expect(clips[0]!.duration).toBe(2);
    expect(clips[1]!.startTime).toBe(2);
    expect(clips[1]!.duration).toBe(2);
    expect(clips[0]!.id).not.toBe(clips[1]!.id);
  });

  it('does nothing if playback time is at clip start boundary', () => {
    const clip = addObjectAndClip();
    store.setPlaybackTime(0);
    store.splitClip(clip.id);
    expect(store.project.tracks[0]!.clips).toHaveLength(1);
  });

  it('does nothing if playback time is after clip end', () => {
    const clip = addObjectAndClip();
    store.setPlaybackTime(5);
    store.splitClip(clip.id);
    expect(store.project.tracks[0]!.clips).toHaveLength(1);
  });

  it('second fragment inherits type and objectId', () => {
    const clip = addObjectAndClip();
    store.setPlaybackTime(1.5);
    store.splitClip(clip.id);
    const clips = store.project.tracks[0]!.clips;
    expect(clips[1]!.type).toBe(clips[0]!.type);
    expect(clips[1]!.objectId).toBe(clips[0]!.objectId);
  });
});
