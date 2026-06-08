import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';

// NOTE: The client-side manim.js (services/web/src/export/manim.js) does NOT
// yet have AnimationGroup/LaggedStart support — it still uses a sequential clip
// loop. Codegen tests for parallel groups require the API-side codegen
// (services/api/src/compiler/codegen.js) which cannot be imported in Vitest
// without a dedicated Node test runner. The tests below cover the client-side
// generateManimScript function for single-clip and basic move codegen.

function makeProject(objects, clips) {
  return {
    name: 'Test',
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    groups: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips }],
  };
}

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('parallel clip defaults', () => {
  it('new clips have parallel=false and lag_ratio=0', () => {
    const obj = store.addObject('circle', 960, 540);
    const clip = store.addClip(0, {
      type: 'move',
      sourceId: obj.id,
      startTime: 0,
      duration: 1,
      params: { targetX: 100, targetY: 100 },
    });
    expect(clip.parallel).toBe(false);
    expect(clip.lag_ratio).toBe(0);
  });

  it('clip can be set to parallel', () => {
    const obj = store.addObject('circle', 960, 540);
    const clip = store.addClip(0, {
      type: 'move',
      sourceId: obj.id,
      startTime: 0,
      duration: 1,
      params: { targetX: 100, targetY: 100 },
      parallel: true,
      lag_ratio: 0.2,
    });
    expect(clip.parallel).toBe(true);
    expect(clip.lag_ratio).toBe(0.2);
  });
});

describe('client-side codegen (generateManimScript)', () => {
  it('generates self.play for a move clip', () => {
    const objId = 'obj_circle_1';
    const project = makeProject(
      [
        {
          id: objId,
          type: 'circle',
          name: 'c1',
          x: 960,
          y: 540,
          width: 100,
          height: 100,
          fill: '#ff0000',
          stroke: 'transparent',
          strokeWidth: 2,
          opacity: 1,
          rotation: 0,
          enterTime: 0,
          duration: 3,
          enterAnim: 'none',
          exitAnim: 'none',
          zOrder: 0,
        },
      ],
      [
        {
          id: 'clip_1',
          type: 'move',
          sourceId: objId,
          startTime: 0.5,
          duration: 1,
          easing: 'ease_in_out',
          params: { targetX: 200, targetY: 300 },
          parallel: false,
          lag_ratio: 0,
        },
      ]
    );
    const code = generateManimScript(project);
    expect(code).toContain('self.play(');
    expect(code).toContain('.animate.move_to(');
  });

  it('generates self.play for a scale clip with non-default easing', () => {
    const objId = 'obj_rect_1';
    const project = makeProject(
      [
        {
          id: objId,
          type: 'rectangle',
          name: 'r1',
          x: 960,
          y: 540,
          width: 200,
          height: 100,
          fill: '#0000ff',
          stroke: 'transparent',
          strokeWidth: 2,
          opacity: 1,
          rotation: 0,
          enterTime: 0,
          duration: 3,
          enterAnim: 'none',
          exitAnim: 'none',
          zOrder: 0,
        },
      ],
      [
        {
          id: 'clip_2',
          type: 'scale',
          sourceId: objId,
          startTime: 0,
          duration: 1.5,
          easing: 'ease_in_cubic',
          params: { targetScaleX: 2, targetScaleY: 2 },
          parallel: false,
          lag_ratio: 0,
        },
      ]
    );
    const code = generateManimScript(project);
    expect(code).toContain('.animate.scale(2.00)');
    expect(code).toContain('rate_func=rate_functions.ease_in_cubic');
  });

  it('generates FadeOut for a fade clip targeting opacity 0', () => {
    const objId = 'obj_sq_1';
    const project = makeProject(
      [
        {
          id: objId,
          type: 'square',
          name: 's1',
          x: 960,
          y: 540,
          width: 150,
          height: 150,
          fill: '#ffffff',
          stroke: 'transparent',
          strokeWidth: 2,
          opacity: 1,
          rotation: 0,
          enterTime: 0,
          duration: 3,
          enterAnim: 'none',
          exitAnim: 'none',
          zOrder: 0,
        },
      ],
      [
        {
          id: 'clip_3',
          type: 'fade',
          sourceId: objId,
          startTime: 1,
          duration: 0.5,
          easing: 'ease_in_out',
          params: { targetOpacity: 0 },
          parallel: false,
          lag_ratio: 0,
        },
      ]
    );
    const code = generateManimScript(project);
    expect(code).toContain('FadeOut(');
  });
});
