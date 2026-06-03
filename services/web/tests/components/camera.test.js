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

describe('setCameraType', () => {
  it('defaults to static', () => {
    expect(store.project.cameraType).toBe('static');
  });

  it('switches to moving', () => {
    store.setCameraType('moving');
    expect(store.project.cameraType).toBe('moving');
  });

  it('switches back to static', () => {
    store.setCameraType('moving');
    store.setCameraType('static');
    expect(store.project.cameraType).toBe('static');
  });
});

describe('addCameraMoveClip', () => {
  it('adds a camera_move clip to cameraTrack', () => {
    store.setCameraType('moving');
    const clip = store.addCameraMoveClip({ startTime: 1, duration: 2, targetX: 100, targetY: 50, zoom: 1.5 });
    expect(clip.type).toBe('camera_move');
    expect(store.project.cameraTrack).toHaveLength(1);
    expect(store.project.cameraTrack[0].params.zoom).toBe(1.5);
  });

  it('deleteCameraClip removes from cameraTrack', () => {
    store.setCameraType('moving');
    const clip = store.addCameraMoveClip({ startTime: 0, duration: 1 });
    store.deleteCameraClip(clip.id);
    expect(store.project.cameraTrack).toHaveLength(0);
  });
});
