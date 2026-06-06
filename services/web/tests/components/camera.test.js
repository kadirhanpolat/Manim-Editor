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

describe('camera clip undo/redo', () => {
  it('undo removes a freshly added camera clip; redo restores it', () => {
    expect(store.project.cameraTrack).toHaveLength(0);
    store.addCameraMoveClip({ startTime: 0, duration: 2, targetX: 100, zoom: 1.5 });
    expect(store.project.cameraTrack).toHaveLength(1);

    store.undo();
    expect(store.project.cameraTrack).toHaveLength(0);

    store.redo();
    expect(store.project.cameraTrack).toHaveLength(1);
    expect(store.project.cameraTrack[0].params.zoom).toBe(1.5);
  });

  it('undo reverts an edit to a camera clip', () => {
    const clip = store.addCameraMoveClip({ startTime: 0, duration: 2, zoom: 1 });
    store.updateCameraClip(clip.id, { params: { zoom: 3 } });
    expect(store.project.cameraTrack[0].params.zoom).toBe(3);

    store.undo();
    expect(store.project.cameraTrack[0].params.zoom).toBe(1);
  });

  it('undo restores a deleted camera clip', () => {
    const clip = store.addCameraMoveClip({ startTime: 0, duration: 2 });
    store.deleteCameraClip(clip.id);
    expect(store.project.cameraTrack).toHaveLength(0);

    store.undo();
    expect(store.project.cameraTrack).toHaveLength(1);
  });
});

describe('camera/scene state undo', () => {
  it('undo reverts cameraType, sceneType and camera3d changes', () => {
    expect(store.project.cameraType).toBe('static');
    expect(store.project.sceneType).toBe('2d');

    store.setCameraType('moving');
    store.setSceneType('3d');
    store.setCamera3d({ phi: 10 });
    expect(store.project.cameraType).toBe('moving');
    expect(store.project.sceneType).toBe('3d');
    expect(store.project.camera3d.phi).toBe(10);

    store.undo();   // revert camera3d
    expect(store.project.camera3d.phi).toBe(75);

    store.undo();   // revert sceneType
    expect(store.project.sceneType).toBe('2d');

    store.undo();   // revert cameraType
    expect(store.project.cameraType).toBe('static');
  });
});
