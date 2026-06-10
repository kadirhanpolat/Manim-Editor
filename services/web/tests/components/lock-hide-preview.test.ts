import { describe, it, expect } from 'vitest';
import { isPreviewHidden } from '../../src/engine/visibility.js';

const byIdFactory = (objs) => (id) => objs.find((o) => o.id === id) || null;

describe('isPreviewHidden', () => {
  it('false for a plain object (legacy: field absent)', () => {
    const o = { id: 'a', type: 'circle' };
    expect(isPreviewHidden(o, byIdFactory([o]))).toBe(false);
  });

  it('true when hidden === true', () => {
    const o = { id: 'a', type: 'circle', hidden: true };
    expect(isPreviewHidden(o, byIdFactory([o]))).toBe(true);
  });

  it('false when hidden === false', () => {
    const o = { id: 'a', type: 'circle', hidden: false };
    expect(isPreviewHidden(o, byIdFactory([o]))).toBe(false);
  });

  it('cascade: annotation of a hidden target is hidden (surrounding_rect/underline/cross)', () => {
    const target = { id: 't', type: 'circle', hidden: true };
    for (const type of ['surrounding_rect', 'underline', 'cross']) {
      const ann = { id: 'ann', type, targetId: 't' };
      expect(isPreviewHidden(ann, byIdFactory([target, ann]))).toBe(true);
    }
  });

  it('annotation of a visible target stays visible', () => {
    const target = { id: 't', type: 'circle' };
    const ann = { id: 'ann', type: 'underline', targetId: 't' };
    expect(isPreviewHidden(ann, byIdFactory([target, ann]))).toBe(false);
  });

  it('null/undefined object is not hidden (caller treats as fall-through)', () => {
    expect(isPreviewHidden(null, byIdFactory([]))).toBe(false);
    expect(isPreviewHidden(undefined, byIdFactory([]))).toBe(false);
  });
});
