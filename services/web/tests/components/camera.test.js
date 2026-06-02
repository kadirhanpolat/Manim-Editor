import { describe, it, expect, beforeEach } from 'vitest';
import { store, actions } from '../../src/store/project.js';

beforeEach(() => {
  actions.newProject('Test', 'visual');
  actions.commitState();
});

describe('setCameraType', () => {
  it('defaults to static', () => {
    expect(store.project.cameraType).toBe('static');
  });

  it('switches to moving', () => {
    actions.setCameraType('moving');
    expect(store.project.cameraType).toBe('moving');
  });

  it('switches back to static', () => {
    actions.setCameraType('moving');
    actions.setCameraType('static');
    expect(store.project.cameraType).toBe('static');
  });
});

describe('addCameraMoveClip', () => {
  it('adds a camera_move clip to cameraTrack', () => {
    actions.setCameraType('moving');
    const clip = actions.addCameraMoveClip({ startTime: 1, duration: 2, targetX: 100, targetY: 50, zoom: 1.5 });
    expect(clip.type).toBe('camera_move');
    expect(store.project.cameraTrack).toHaveLength(1);
    expect(store.project.cameraTrack[0].params.zoom).toBe(1.5);
  });

  it('deleteCameraClip removes from cameraTrack', () => {
    actions.setCameraType('moving');
    const clip = actions.addCameraMoveClip({ startTime: 0, duration: 1 });
    actions.deleteCameraClip(clip.id);
    expect(store.project.cameraTrack).toHaveLength(0);
  });
});
