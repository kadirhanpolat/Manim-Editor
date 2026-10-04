// The editor's `rotation` is Konva's: positive degrees turn CLOCKWISE on the
// y-down canvas. Manim's `rotate(angle)` turns COUNTER-clockwise for a
// positive angle, so every 2D rotation must be emitted negated or the render
// mirrors what the preview shows.
import { describe, it, expect } from 'vitest';
import { generateScene } from '../src/index.js';

const resolveAsset = (obj: { name?: string }, ext: string) => `${obj.name || 'asset'}.${ext}`;

function rect(extra: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    type: 'rectangle',
    name: 'box',
    x: 960,
    y: 540,
    width: 200,
    height: 100,
    fill: '#ff0000',
    enterTime: 0,
    duration: 3,
    enterAnim: 'none',
    exitAnim: 'none',
    ...extra,
  };
}

function scene(objects: unknown[], clips: unknown[] = []): string {
  return generateScene(
    {
      name: 'T',
      stage: { width: 1920, height: 1080 },
      objects,
      tracks: [{ id: 't1', name: 'Track 1', clips }],
      cameraTrack: [],
    } as never,
    { resolveAsset } as never
  );
}

describe('2D rotation direction', () => {
  it('emits a clockwise object rotation as a negative Manim angle', () => {
    const code = scene([rect({ rotation: 30 })]);
    expect(code).toMatch(/\.rotate\(-0\.5236\)/);
  });

  it('emits a clockwise rotate clip as a negative Rotate angle', () => {
    const code = scene(
      [rect()],
      [
        {
          id: 'c1',
          type: 'rotate',
          objectId: 'r1',
          startTime: 0,
          duration: 1,
          easing: 'linear',
          params: { targetRotation: 90 },
        },
      ]
    );
    expect(code).toMatch(/Rotate\(\w+, angle=-1\.57\)/);
  });

  it('emits rotation keyframes with the same sign convention', () => {
    const code = scene([
      rect({
        keyframes: {
          rotation: [
            { time: 0, value: 0, easing: { type: 'linear' } },
            { time: 1, value: 45, easing: { type: 'linear' } },
          ],
        },
        keyframeCodegen: { rotation: 'animate' },
      }),
    ]);
    expect(code).toMatch(/\.animate\.rotate\(-0\.7854\)/);
    expect(code).not.toMatch(/\.animate\.rotate\(0\.7854\)/);
  });
});
