// EDITOR_FINDINGS #5/#6: the canvas preview must size arrow tips and LaTeX the
// same way the generated Manim code does.
import { describe, it, expect } from 'vitest';
import { arrowTipPx } from '@manim/codegen';
import { makeCtx, OBJECTS } from './fixtures.js';
import * as shapes2d from '../../../src/components/stage/configs/shapes2d.js';
import * as textCfgs from '../../../src/components/stage/configs/text.js';

describe('arrow tip preview parity', () => {
  it('uses the shared arrowTipPx for arrow and double arrow pointers', () => {
    const ctx = makeCtx();
    const vs = ctx.vs as number;
    const arrow = { ...OBJECTS.arrow, width: 400, strokeWidth: 4 };
    const cfg = shapes2d.arrowCfg(arrow as never, ctx as never);
    expect(cfg.pointerLength).toBeCloseTo(arrowTipPx(400, 4) * vs);
    expect(cfg.pointerWidth).toBeCloseTo(arrowTipPx(400, 4) * vs);
    const dbl = shapes2d.doubleArrowCfg({ ...arrow, type: 'double_arrow' } as never, ctx as never);
    expect(dbl.pointerLength).toBeCloseTo(arrowTipPx(400, 4) * vs);
  });
});

describe('latex preview sizing', () => {
  it('uses an explicit fontSize like text objects do', () => {
    const ctx = makeCtx();
    const cfg = textCfgs.latexTextCfg({ ...OBJECTS.latex, fontSize: 36 } as never, ctx as never);
    expect(cfg.fontSize).toBeCloseTo(36 * (ctx.vs as number));
  });

  it('grows the auto-fit font with a taller box (contain fit)', () => {
    const ctx = makeCtx();
    const small = textCfgs.latexTextCfg(
      { ...OBJECTS.latex, width: 600, height: 40 } as never,
      ctx as never
    );
    const tall = textCfgs.latexTextCfg(
      { ...OBJECTS.latex, width: 600, height: 120 } as never,
      ctx as never
    );
    expect(tall.fontSize as number).toBeGreaterThan(small.fontSize as number);
  });

  it('lets a one-line formula fill a short box, at any zoom (no fixed pixel padding)', () => {
    // Manim scales the formula's ink to the box (contain-fit, no padding). A
    // fixed 8 px canvas padding + line-height divisor shrank a 40 px label box
    // to the 6 px floor at editor zoom. Ink height ≈ 0.75 em for one line.
    for (const vs of [0.4, 1]) {
      const cfg = textCfgs.latexTextCfg(
        { ...OBJECTS.latex, latex: 'x', width: 4000, height: 40 } as never,
        makeCtx({ vs }) as never
      );
      expect(cfg.fontSize as number).toBeCloseTo((40 * vs) / 0.75, 1);
      expect(cfg.padding).toBe(0);
    }
  });
});
