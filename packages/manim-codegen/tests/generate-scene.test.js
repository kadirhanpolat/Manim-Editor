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

  // Regression: multi-line clip blocks (count, path_move) must be indented at the
  // construct-body level (8 spaces). They were joined with `\n<indent>` while the
  // emit loop also prefixes every line with <indent>, producing a 16-space double
  // indent → Python IndentationError at render time. (Masked for a long time because
  // the API validator rejected count/path_move clips, so they were never rendered.)
  it('count clip block is single-indented (no double indent)', () => {
    const code = generateScene(baseProject({
      objects: [{ id: 'n1', type: 'counter', x: 960, y: 540, width: 200, height: 80, value: 0, numDecimals: 0, enterTime: 0, duration: 4 }],
      tracks: [{ id: 't1', name: 'T', clips: [
        { id: 'cnt', type: 'count', objectId: 'n1', startTime: 0.5, duration: 3, from: 0, to: 100, easing: 'linear' },
      ] }],
    }), { resolveAsset });
    expect(code).toContain('\n        n1.add_updater(lambda m: m.set_value(');   // 8 spaces ✓
    expect(code).not.toContain('\n                n1.add_updater(');             // 16 spaces ✗
    expect(code).toContain('\n        n1.clear_updaters()');
    // every construct-body line is indented in multiples of 4 (no stray 12/16)
    for (const line of code.split('\n')) {
      if (line.trim() === '') continue;
      const lead = line.length - line.trimStart().length;
      expect(lead % 4).toBe(0);
    }
  });

  it('path_move clip block is single-indented (no double indent)', () => {
    const code = generateScene(baseProject({
      objects: [{ id: 'o1', type: 'circle', x: 200, y: 200, width: 100, height: 100, fill: '#fff', enterTime: 0, duration: 4 }],
      tracks: [{ id: 't1', name: 'T', clips: [
        { id: 'p1', type: 'path_move', objectId: 'o1', startTime: 0.5, duration: 2, easing: 'linear',
          path: [{ x: 200, y: 200 }, { x: 800, y: 400 }, { x: 1200, y: 200 }] },
      ] }],
    }), { resolveAsset });
    expect(code).toContain('\n        path_p1.set_points_as_corners(');   // 8 spaces ✓
    expect(code).not.toContain('\n                path_p1.set_points_as_corners(');  // 16 spaces ✗
  });
});
