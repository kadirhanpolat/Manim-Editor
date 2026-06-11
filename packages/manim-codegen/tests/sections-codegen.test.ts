import { describe, it, expect } from 'vitest';
import { generateScene } from '../src/index.js';
import type { Project } from '../src/types.js';

function baseProject(): Project {
  return {
    id: 'p1',
    name: 'Test',
    editorMode: 'visual',
    codeSource: '',
    stage: { width: 1920, height: 1080, background: '#000000' },
    assets: [],
    objects: [
      {
        id: 'o1',
        type: 'circle',
        name: 'C',
        x: 960,
        y: 540,
        width: 100,
        height: 100,
        color: '#ffffff',
        opacity: 1,
      },
    ],
    groups: [],
    tracks: [
      {
        id: 't1',
        objectId: 'o1',
        clips: [
          {
            id: 'c1',
            type: 'fade',
            objectId: 'o1',
            startTime: 2,
            duration: 1,
            easing: 'ease_in_out',
            parallel: false,
          },
        ],
      },
    ],
    sceneDuration: 5,
    cameraType: 'static',
    cameraTrack: [],
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
    sceneType: '2d',
    camera3d: { phi: 75, theta: -45, zoom: 1 },
    sections: [{ id: 's1', time: 2, title: 'Intro' }],
  };
}

describe('scene sections codegen', () => {
  it('emits next_section before the first animation at/after section.time', () => {
    const code = generateScene(baseProject(), { resolveAsset: (s) => s });
    expect(code).toContain('self.next_section("Intro")');
    const nsIdx = code.indexOf('self.next_section("Intro")');
    // The fade clip is at startTime=2, which matches section time=2.
    // next_section("Intro") must appear before the FadeOut (fade clip at t=2),
    // but may appear after the FadeIn enter animation (at t=0).
    const fadeOutIdx = code.indexOf('self.play(FadeOut(o1)');
    expect(nsIdx).toBeGreaterThan(-1);
    expect(fadeOutIdx).toBeGreaterThan(-1);
    expect(nsIdx).toBeLessThan(fadeOutIdx);
  });

  it('skips sections beyond scene duration', () => {
    const p = baseProject();
    p.sections = [{ id: 's2', time: 99, title: 'Never' }];
    const code = generateScene(p, { resolveAsset: (s) => s });
    expect(code).not.toContain('self.next_section("Never")');
  });

  it('generates valid output with no sections', () => {
    const p = baseProject();
    p.sections = [];
    const code = generateScene(p, { resolveAsset: (s) => s });
    expect(code).not.toContain('next_section');
    expect(code).toContain('self.play(');
  });
});
