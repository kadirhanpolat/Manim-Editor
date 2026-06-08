import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;

function makeProject(objects: object[]) {
  return {
    name: 'T', sceneType: '2d',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    sceneDuration: 5, fps: 60,
    objects, tracks: [], cameraTrack: [], assets: [], groups: [],
  };
}

function baseObj(id: string, type: string, extra: object = {}) {
  return {
    id, type,
    x: 960, y: 540, width: 160, height: 80,
    fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
    opacity: 1, rotation: 0, zOrder: 0,
    enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none',
    enterAnimDur: 0.5, exitAnimDur: 0.5,
    ...extra,
  };
}

let store: ReturnType<typeof useProjectStore>;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('annotation store — seeding', () => {
  it('surrounding_rect seeds with color, strokeWidth, buff, cornerRadius, empty targetId', () => {
    store.addObject('surrounding_rect', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('surrounding_rect');
    expect(o.color).toBe('#facc15');
    expect(o.strokeWidth).toBe(2);
    expect(o.buff).toBe(10);
    expect(o.cornerRadius).toBe(0);
    expect(o.targetId).toBe('');
  });

  it('underline seeds with color, strokeWidth, buff, empty targetId', () => {
    store.addObject('underline', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('underline');
    expect(o.color).toBe('#f97316');
    expect(o.strokeWidth).toBe(2);
    expect(o.buff).toBe(6);
    expect(o.targetId).toBe('');
  });

  it('cross seeds with color, strokeWidth, empty targetId', () => {
    store.addObject('cross', 960, 540);
    const o = store.project.objects[0];
    expect(o.type).toBe('cross');
    expect(o.color).toBe('#ef4444');
    expect(o.strokeWidth).toBe(3);
    expect(o.targetId).toBe('');
  });
});

describe('annotation store — setAnnotationTarget', () => {
  it('updates targetId and commits state', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('surrounding_rect', 960, 540);
    const ann = store.project.objects[1];
    const histLen = store.history.past.length;
    store.setAnnotationTarget(ann.id, circle.id);
    expect(ann.targetId).toBe(circle.id);
    expect(store.history.past.length).toBe(histLen + 1);
  });

  it('no-ops if object not found', () => {
    const histLen = store.history.past.length;
    store.setAnnotationTarget('nonexistent', 'target');
    expect(store.history.past.length).toBe(histLen);
  });
});

describe('annotation store — cascade delete', () => {
  it('deleting a target also deletes all bound annotations', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('surrounding_rect', 960, 540);
    const ann1 = store.project.objects[1];
    store.addObject('underline', 960, 540);
    const ann2 = store.project.objects[2];
    store.setAnnotationTarget(ann1.id, circle.id);
    store.setAnnotationTarget(ann2.id, circle.id);

    store.deleteObject(circle.id);

    expect(store.project.objects.find((o) => o.id === ann1.id)).toBeUndefined();
    expect(store.project.objects.find((o) => o.id === ann2.id)).toBeUndefined();
    expect(store.project.objects.find((o) => o.id === circle.id)).toBeUndefined();
  });

  it('deleting a non-targeted object does not cascade to unrelated annotations', () => {
    store.addObject('circle', 960, 540);
    const circle = store.project.objects[0];
    store.addObject('rectangle', 960, 540);
    const rect = store.project.objects[1];
    store.addObject('surrounding_rect', 960, 540);
    const ann = store.project.objects[2];
    store.setAnnotationTarget(ann.id, circle.id);

    store.deleteObject(rect.id);

    expect(store.project.objects.find((o) => o.id === ann.id)).toBeDefined();
  });
});

describe('annotation codegen', () => {
  it('surrounding_rect emits SurroundingRectangle referencing target variable', () => {
    const circle = baseObj('circle1', 'circle', { width: 120, height: 120 });
    const ann = baseObj('ann1', 'surrounding_rect', {
      color: '#facc15', strokeWidth: 2, buff: 10, cornerRadius: 0, targetId: 'circle1',
    });
    const s = generateManimScript(makeProject([circle, ann]));
    expect(s).toMatch(/ann1 = SurroundingRectangle\(circle1,/);
    expect(s).toMatch(/color="#facc15"/);
    expect(s).toMatch(/buff=0\.07/);
    expect(s).toMatch(/corner_radius=0\.000/);
  });

  it('surrounding_rect does NOT emit move_to', () => {
    const circle = baseObj('circle1', 'circle', { width: 120, height: 120 });
    const ann = baseObj('ann1', 'surrounding_rect', {
      color: '#facc15', strokeWidth: 2, buff: 10, cornerRadius: 0, targetId: 'circle1',
    });
    const s = generateManimScript(makeProject([circle, ann]));
    const lines = s.split('\n').filter(l => l.includes('ann1') && l.includes('move_to'));
    expect(lines).toHaveLength(0);
  });

  it('underline emits Underline referencing target', () => {
    const latex = baseObj('lbl1', 'latex', { latex: 'E=mc^2' });
    const ann = baseObj('ann2', 'underline', {
      color: '#f97316', strokeWidth: 2, buff: 6, targetId: 'lbl1',
    });
    const s = generateManimScript(makeProject([latex, ann]));
    expect(s).toMatch(/ann2 = Underline\(lbl1,/);
    expect(s).toMatch(/color="#f97316"/);
  });

  it('cross emits Cross referencing target', () => {
    const latex = baseObj('lbl1', 'latex', { latex: 'wrong' });
    const ann = baseObj('ann3', 'cross', {
      color: '#ef4444', strokeWidth: 3, targetId: 'lbl1',
    });
    const s = generateManimScript(makeProject([latex, ann]));
    expect(s).toMatch(/ann3 = Cross\(lbl1,/);
    expect(s).toMatch(/stroke_color="#ef4444"/);
  });
});
