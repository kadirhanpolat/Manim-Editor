import { describe, it, expect } from 'vitest';
import { PlaybackEngine } from '../../src/engine/playback.js';

describe('3D camera_move lerp', () => {
  it('interpolates phi/theta/zoom from base and flags is3d', () => {
    const eng = new PlaybackEngine();
    eng.setCamera3dBase({ phi: 75, theta: -45, zoom: 1 });
    const cameraTrack = [
      {
        id: 'cm',
        type: 'camera_move',
        startTime: 0,
        duration: 2,
        easing: 'linear',
        params: { phi: 45, theta: -90, zoom: 2 },
      },
    ];
    const frame = eng.computeFrame(1.0, [], [], cameraTrack); // t=1 of 2 => alpha 0.5
    expect(frame.cameraState.is3d).toBe(true);
    expect(frame.cameraState.phi).toBeCloseTo((75 + 45) / 2, 3); // 60
    expect(frame.cameraState.theta).toBeCloseTo((-45 + -90) / 2, 3); // -67.5
    expect(frame.cameraState.zoom).toBeCloseTo((1 + 2) / 2, 3); // 1.5
  });

  it('2D camera_move still produces {x,y,zoom} without is3d', () => {
    const eng = new PlaybackEngine();
    const cameraTrack = [
      {
        id: 'cm',
        type: 'camera_move',
        startTime: 0,
        duration: 2,
        easing: 'linear',
        params: { targetX: 100, targetY: 200, zoom: 2 },
      },
    ];
    const frame = eng.computeFrame(1.0, [], [], cameraTrack);
    expect(frame.cameraState.is3d).toBeFalsy();
    expect(frame.cameraState.x).toBeCloseTo(50, 3); // 0 -> 100, alpha .5
    expect(frame.cameraState.y).toBeCloseTo(100, 3); // 0 -> 200, alpha .5
  });
});
