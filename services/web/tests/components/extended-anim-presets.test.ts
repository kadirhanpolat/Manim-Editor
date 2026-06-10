import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  useProjectStore,
  ENTER_ANIMS,
  EXIT_ANIMS,
  availableEnterAnims,
  availableExitAnims,
} from '../../src/store/project.js';

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
