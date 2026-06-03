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

describe('sceneType', () => {
  it('defaults to 2d', () => {
    expect(store.project.sceneType).toBe('2d');
  });

  it('setSceneType switches to 3d', () => {
    store.setSceneType('3d');
    expect(store.project.sceneType).toBe('3d');
  });

  it('setSceneType switches back to 2d', () => {
    store.setSceneType('3d');
    store.setSceneType('2d');
    expect(store.project.sceneType).toBe('2d');
  });
});

describe('camera3d', () => {
  it('defaults exist on project', () => {
    expect(store.project.camera3d).toBeDefined();
    expect(store.project.camera3d.phi).toBe(75);
    expect(store.project.camera3d.theta).toBe(-45);
    expect(store.project.camera3d.zoom).toBe(1.0);
  });

  it('setCamera3d updates phi/theta/zoom', () => {
    store.setCamera3d({ phi: 60, theta: -60, zoom: 1.5 });
    expect(store.project.camera3d.phi).toBe(60);
    expect(store.project.camera3d.theta).toBe(-60);
    expect(store.project.camera3d.zoom).toBe(1.5);
  });
});

describe('3D object defaults', () => {
  it('sphere gets x3d/y3d/z3d fields', () => {
    const obj = store.addObject('sphere', 960, 540);
    expect(obj.type).toBe('sphere');
    expect(obj.x3d).toBe(0);
    expect(obj.y3d).toBe(0);
    expect(obj.z3d).toBe(0);
    expect(obj.rx).toBe(0);
    expect(obj.ry).toBe(0);
    expect(obj.rz).toBe(0);
    expect(obj.resolution).toBe(20);
  });

  it('cube gets x3d/y3d/z3d fields', () => {
    const obj = store.addObject('cube', 960, 540);
    expect(obj.type).toBe('cube');
    expect(obj.x3d).toBeDefined();
    expect(obj.y3d).toBeDefined();
    expect(obj.z3d).toBeDefined();
  });

  it('axes3d gets x3d/y3d/z3d and range fields', () => {
    const obj = store.addObject('axes3d', 960, 540);
    expect(obj.type).toBe('axes3d');
    expect(obj.xRange).toEqual([-3, 3, 1]);
    expect(obj.yRange).toEqual([-3, 3, 1]);
    expect(obj.zRange).toEqual([-3, 3, 1]);
  });
});
