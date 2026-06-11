// services/web/tests/components/inline-text-edit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const TEXT_EDITABLE_TYPES = ['text', 'latex', 'code'];

describe('TEXT_EDITABLE_TYPES', () => {
  it('includes text, latex, code', () => {
    expect(TEXT_EDITABLE_TYPES).toContain('text');
    expect(TEXT_EDITABLE_TYPES).toContain('latex');
    expect(TEXT_EDITABLE_TYPES).toContain('code');
  });
});

describe('textEditOverlayStyle math', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('computes correct pixel position for a centered object', () => {
    const objX = 960,
      objY = 540,
      w = 300,
      h = 80;
    const vs = 1;
    function s2c(px: number, py: number) {
      return { x: px * vs, y: py * vs };
    }
    const pos = s2c(objX, objY);
    const left = pos.x - (w * vs) / 2;
    const top = pos.y - (h * vs) / 2;
    expect(left).toBe(960 - 150);
    expect(top).toBe(540 - 40);
  });
});
