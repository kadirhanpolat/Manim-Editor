import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  useProjectStore,
  ENTER_ANIMS,
  EXIT_ANIMS,
  availableEnterAnims,
  availableExitAnims,
} from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';

describe('availableEnterAnims filter', () => {
  it('excludes grow_arrow for non-arrow types', () => {
    const keys = availableEnterAnims('circle').map((a) => a.value);
    expect(keys).not.toContain('grow_arrow');
  });

  it('includes grow_arrow for arrow type', () => {
    const keys = availableEnterAnims('arrow').map((a) => a.value);
    expect(keys).toContain('grow_arrow');
  });

  it('includes grow_arrow for double_arrow type', () => {
    const keys = availableEnterAnims('double_arrow').map((a) => a.value);
    expect(keys).toContain('grow_arrow');
  });

  it('excludes draw_border_fill for image type', () => {
    const keys = availableEnterAnims('image').map((a) => a.value);
    expect(keys).not.toContain('draw_border_fill');
  });

  it('includes draw_border_fill for rectangle type', () => {
    const keys = availableEnterAnims('rectangle').map((a) => a.value);
    expect(keys).toContain('draw_border_fill');
  });

  it('excludes typewriter for circle type', () => {
    const keys = availableEnterAnims('circle').map((a) => a.value);
    expect(keys).not.toContain('typewriter');
  });

  it('includes typewriter for text type', () => {
    const keys = availableEnterAnims('text').map((a) => a.value);
    expect(keys).toContain('typewriter');
  });

  it('excludes write/draw for image type', () => {
    const keys = availableEnterAnims('image').map((a) => a.value);
    expect(keys).not.toContain('write');
    expect(keys).not.toContain('draw');
  });
});

describe('availableExitAnims filter', () => {
  it('excludes unwrite for image type', () => {
    const keys = availableExitAnims('image').map((a) => a.value);
    expect(keys).not.toContain('unwrite');
  });

  it('includes unwrite for latex type', () => {
    const keys = availableExitAnims('latex').map((a) => a.value);
    expect(keys).toContain('unwrite');
  });

  it('excludes typewriter_out for circle type', () => {
    const keys = availableExitAnims('circle').map((a) => a.value);
    expect(keys).not.toContain('typewriter_out');
  });

  it('includes typewriter_out for text type', () => {
    const keys = availableExitAnims('text').map((a) => a.value);
    expect(keys).toContain('typewriter_out');
  });
});

describe('store actions for anim params', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('setEnterAnimDir updates enterAnimDir and commits', () => {
    const store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
    store.addObject('circle');
    const obj = store.project.objects[0];
    store.setEnterAnimDir(obj.id, 'RIGHT');
    expect(store.objectById(obj.id)?.enterAnimDir).toBe('RIGHT');
  });

  it('setEnterAnimScale updates enterAnimScale and commits', () => {
    const store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
    store.addObject('circle');
    const obj = store.project.objects[0];
    store.setEnterAnimScale(obj.id, 2.0);
    expect(store.objectById(obj.id)?.enterAnimScale).toBe(2.0);
  });

  it('setExitAnimScale updates exitAnimScale and commits', () => {
    const store = useProjectStore();
    store.newProject('Test', 'visual');
    store.commitState();
    store.addObject('circle');
    const obj = store.project.objects[0];
    store.setExitAnimScale(obj.id, 1.8);
    expect(store.objectById(obj.id)?.exitAnimScale).toBe(1.8);
  });
});

const SW = 1920,
  SH = 1080;

function makeProject(overrides: Record<string, unknown>) {
  return {
    name: 'Test',
    sceneType: '2d',
    objects: [
      {
        id: 'obj1',
        type: 'circle',
        name: 'c',
        x: SW / 2,
        y: SH / 2,
        width: 100,
        height: 100,
        fill: '#fff',
        stroke: '#fff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 3,
        enterAnimDur: 0.5,
        exitAnimDur: 0.5,
        enterAnim: 'none',
        exitAnim: 'none',
        ...overrides,
      },
    ],
    tracks: [],
    cameraTrack: [],
    fps: 60,
    stage: { width: SW, height: SH },
    background: '#000',
    cameraType: 'static',
    sceneDuration: 5,
    assets: [],
    groups: [],
  };
}

describe('extended anim presets codegen', () => {
  it('draw_border_fill emits DrawBorderThenFill', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'draw_border_fill' }));
    expect(code).toContain('self.play(DrawBorderThenFill(obj1), run_time=0.5)');
  });

  it('grow_arrow emits GrowArrow', () => {
    const code = generateManimScript(makeProject({ type: 'arrow', enterAnim: 'grow_arrow' }));
    expect(code).toContain('self.play(GrowArrow(obj1), run_time=0.5)');
  });

  it('grow_from_edge LEFT emits GrowFromEdge(edge=LEFT)', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'grow_from_edge', enterAnimDir: 'LEFT' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=LEFT), run_time=0.5)');
  });

  it('grow_from_edge RIGHT emits GrowFromEdge(edge=RIGHT)', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'grow_from_edge', enterAnimDir: 'RIGHT' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=RIGHT), run_time=0.5)');
  });

  it('grow_from_edge UP emits GrowFromEdge(edge=UP)', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'grow_from_edge', enterAnimDir: 'UP' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=UP), run_time=0.5)');
  });

  it('grow_from_edge DOWN emits GrowFromEdge(edge=DOWN)', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'grow_from_edge', enterAnimDir: 'DOWN' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=DOWN), run_time=0.5)');
  });

  it('grow_from_edge defaults to LEFT when enterAnimDir absent', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'grow_from_edge' }));
    expect(code).toContain('self.play(GrowFromEdge(obj1, edge=LEFT), run_time=0.5)');
  });

  it('fade_in_large scale=1.5 emits FadeIn(scale=1.5)', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'fade_in_large', enterAnimScale: 1.5 }));
    expect(code).toContain('self.play(FadeIn(obj1, scale=1.5), run_time=0.5)');
  });

  it('fade_in_large scale=2.0 emits FadeIn(scale=2.0)', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'fade_in_large', enterAnimScale: 2.0 }));
    expect(code).toContain('self.play(FadeIn(obj1, scale=2.0), run_time=0.5)');
  });

  it('fade_in_large defaults scale to 1.5 when absent', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'fade_in_large' }));
    expect(code).toContain('self.play(FadeIn(obj1, scale=1.5), run_time=0.5)');
  });

  it('unwrite emits Unwrite', () => {
    const proj = makeProject({ enterAnim: 'fade_in', exitAnim: 'unwrite' });
    const code = generateManimScript(proj);
    expect(code).toContain('self.play(Unwrite(obj1), run_time=0.5)');
  });

  it('fade_out_large scale=1.5 emits FadeOut(scale=1.5)', () => {
    const proj = makeProject({ enterAnim: 'fade_in', exitAnim: 'fade_out_large', exitAnimScale: 1.5 });
    const code = generateManimScript(proj);
    expect(code).toContain('self.play(FadeOut(obj1, scale=1.5), run_time=0.5)');
  });

  it('existing fade_in still emits FadeIn without scale (regression)', () => {
    const code = generateManimScript(makeProject({ enterAnim: 'fade_in' }));
    expect(code).toContain('self.play(FadeIn(obj1), run_time=0.5)');
    expect(code).not.toContain('scale=');
  });
});
