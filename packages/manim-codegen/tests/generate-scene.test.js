import { describe, it, expect } from 'vitest';
import { generateScene } from '../src/index.js';

const resolveAsset = (obj, ext) => `${obj.name || 'asset'}.${ext}`;

function baseProject(extra = {}) {
  return {
    name: 'T', stage: { width: 1920, height: 1080 },
    objects: [], tracks: [], cameraTrack: [], ...extra,
  };
}

describe('generateScene', () => {
  it('emits a Scene subclass and importable header', () => {
    const code = generateScene(baseProject(), { resolveAsset });
    expect(code).toContain('from manim import *');
    expect(code).toContain('class MainScene(');
    expect(code).toContain('def construct(self):');
  });

  it('renders a camera-only project (camera-aware empty guard)', () => {
    const code = generateScene(baseProject({
      cameraType: 'moving',
      cameraTrack: [{ id: 'cam1', type: 'camera_move', startTime: 0, duration: 1, params: { x: 0, y: 0, zoom: 2 } }],
    }), { resolveAsset });
    expect(code).toContain('MovingCameraScene');
    expect(code).toContain('self.camera.frame.animate');
  });
});
