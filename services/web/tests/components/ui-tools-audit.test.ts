// UI Tools Audit - "enter every UI tool and verify it behaves correctly".
//
// Exercises the LIVE add/clip/tool UI surfaces the way a user does - by
// clicking the rendered buttons - and asserts the full chain reacts:
// store.addObject fires, the object type is valid, codegen produces a scene,
// and every inspector type is reachable from the palette.
//
// NOTE: AssetSidebar is the LIVE palette (mounted by App.vue). Toolbar.vue is
// orphaned dead code (App.vue imports AssetSidebar, never Toolbar) - see audit
// finding F6 - so it is intentionally NOT treated as a reachable tool here.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';
import { settingsComponentFor } from '../../src/components/inspector/object-settings/index.js';
import {
  INSPECTOR_TYPES,
  IMPORT_ONLY_TYPES,
  THREE_D_TYPES,
} from '../../src/components/inspector/capability-matrix.js';
import AssetSidebar from '../../src/components/sidebar/AssetSidebar.vue';
import MotionPicker from '../../src/components/inspector/object-settings/MotionPicker.vue';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Audit', 'visual');
});

// Click every add-button in the mounted AssetSidebar and collect the types
// passed to store.addObject. 3D mode so the 3D section also renders.
function collectPaletteTypes() {
  store.project.sceneType = '3d';
  const spy = vi.spyOn(store, 'addObject');
  const w = mount(AssetSidebar);
  for (const c of w.findAll('.shape-card')) c.trigger('click');
  // The "Add Text" button is not a .shape-card.
  const textBtn = w.findAll('button').find((b) => /add text/i.test(b.attributes('title') || ''));
  if (textBtn) textBtn.trigger('click');
  w.unmount();
  const types = spy.mock.calls.map((c) => c[0]);
  spy.mockRestore();
  return types;
}

describe('palette reachability', () => {
  it('AssetSidebar adds an object for every shape/data/3D card + text', () => {
    const types = collectPaletteTypes();
    expect(types.length).toBeGreaterThan(30);
    for (const t of [
      'rectangle',
      'bezier',
      'table',
      'graph',
      'counter',
      'numberplane',
      'surface',
      'prism',
      'text',
      'code',
      'bar_chart',
    ]) {
      expect(types, `palette should offer ${t}`).toContain(t);
    }
  });

  it('every inspector type is reachable from the palette (F1/F3 guard)', () => {
    const reachable = new Set([...collectPaletteTypes(), ...IMPORT_ONLY_TYPES]);
    const orphaned = INSPECTOR_TYPES.filter((t) => !reachable.has(t));
    expect(orphaned, `types with an inspector but no add button: ${orphaned.join(', ')}`).toEqual(
      []
    );
  });

  it('counter is reachable so the count clip is usable (F1)', () => {
    expect(new Set(collectPaletteTypes()).has('counter')).toBe(true);
  });

  it('numberplane is reachable (F3)', () => {
    expect(new Set(collectPaletteTypes()).has('numberplane')).toBe(true);
  });

  it('numberline is reachable and now editable (F4)', () => {
    expect(new Set(collectPaletteTypes()).has('numberline')).toBe(true);
    expect(settingsComponentFor('numberline')).toBeTruthy();
  });

  it('asset-only types have no shape-button settings component', () => {
    for (const t of IMPORT_ONLY_TYPES) expect(settingsComponentFor(t)).toBe(null);
  });
});

describe('codegen validity for every reachable object type', () => {
  it('produces a MainScene for each type without "undefined" leakage', () => {
    const reachable = [...new Set([...collectPaletteTypes(), ...IMPORT_ONLY_TYPES])];
    for (const type of reachable) {
      setActivePinia(createPinia());
      const s = useProjectStore();
      s.newProject('Gen', 'visual');
      if (THREE_D_TYPES.includes(type as (typeof THREE_D_TYPES)[number])) s.project.sceneType = '3d';
      s.addObject(type, 960, 540);
      const code = generateManimScript(s.project);
      expect(code, type).toContain('class MainScene');
      expect(code, `${type} leaked "undefined"`).not.toMatch(/\bundefined\b/);
    }
  });
});

describe('MotionPicker clip tools', () => {
  function mountFor(type) {
    store.addObject(type, 960, 540);
    const obj = store.project.objects[store.project.objects.length - 1];
    store.selectObject(obj.id);
    return { w: mount(MotionPicker, { props: { obj } }), obj };
  }

  for (const t of ['move', 'scale', 'fade', 'rotate']) {
    it(`"${t}" button creates a ${t} clip`, async () => {
      const spy = vi.spyOn(store, 'createAnimation');
      const { w } = mountFor('circle');
      await w.find(`.anim-btn.${t}`).trigger('click');
      expect(spy).toHaveBeenCalledWith(t, expect.any(Object));
    });
  }

  for (const t of ['indicate', 'flash', 'wiggle', 'circumscribe', 'focus_on']) {
    it(`emphasis "${t}" button creates a ${t} clip`, async () => {
      const spy = vi.spyOn(store, 'createAnimation');
      const { w } = mountFor('circle');
      await w.find(`[data-test="anim-${t}"]`).trigger('click');
      expect(spy).toHaveBeenCalledWith(t, expect.any(Object));
    });
  }

  it('count button is shown only for counter objects and creates a count clip', async () => {
    const { w: wCircle } = mountFor('circle');
    expect(wCircle.find('[data-test="anim-count"]').exists()).toBe(false);
    const spy = vi.spyOn(store, 'createCount');
    const { w: wCounter } = mountFor('counter');
    const btn = wCounter.find('[data-test="anim-count"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(spy).toHaveBeenCalled();
    const counts = store.project.tracks.flatMap((tr) => tr.clips).filter((c) => c.type === 'count');
    expect(counts.length).toBe(1);
  });
});

describe('interaction tools + transform', () => {
  it('store.setActiveTool activates each interaction mode', () => {
    for (const tool of ['select', 'hand', 'scale', 'rotate']) {
      store.setActiveTool(tool);
      expect(store.activeTool).toBe(tool);
    }
  });

  it('AssetSidebar Transform button is gated on exactly 2 selected objects', async () => {
    const w = mount(AssetSidebar);
    const transformBtn = w.findAll('button').find((b) => b.classes('btn-transform'));
    expect(transformBtn.attributes('disabled')).toBeDefined();
    store.addObject('circle', 100, 100);
    store.addObject('square', 200, 200);
    store.selectedObjectIds = store.project.objects.map((o) => o.id);
    await w.vm.$nextTick();
    expect(transformBtn.attributes('disabled')).toBeUndefined();
  });
});
