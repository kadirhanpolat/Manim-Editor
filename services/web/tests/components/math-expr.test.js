import { describe, it, expect } from 'vitest';
import { isSafeExpr, compileExpr } from '../../src/engine/mathExpr.js';

describe('mathExpr', () => {
  it('compiles a polynomial in x', () => {
    expect(compileExpr('x**2', 'x')(3)).toBe(9);
  });
  it('exposes np.* and PI so previews match the render namespace', () => {
    expect(compileExpr('np.cos(t)', 't')(0)).toBeCloseTo(1);
    expect(compileExpr('np.sin(t)', 't')(Math.PI / 2)).toBeCloseTo(1);
    expect(compileExpr('PI', 't')(0)).toBeCloseTo(Math.PI);
  });
  it('rejects unsafe input (isSafeExpr false → compile null)', () => {
    expect(isSafeExpr('a; b')).toBe(false);
    expect(compileExpr('__import__("os")', 'x')).toBeNull();
  });
  it('returns null for an undefined function (reference error)', () => {
    expect(compileExpr('foo(x)', 'x')).toBeNull();
  });
});
