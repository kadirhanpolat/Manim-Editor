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
  it('blocks side-effectful globals', () => {
    expect(compileExpr('fetch(x)', 'x')).toBeNull();
    expect(compileExpr('setTimeout(x)', 'x')).toBeNull();
    expect(compileExpr('Math.random()', 'x')).toBeNull();
    expect(isSafeExpr('window')).toBe(false);
  });
  it('rejects a malformed varName', () => {
    expect(compileExpr('x', 'x, y')).toBeNull();
    expect(compileExpr('x', '1bad')).toBeNull();
  });
  it('still allows the math namespace', () => {
    expect(compileExpr('np.sqrt(np.abs(x)) + np.exp(x) + PI', 'x')(1)).toBeGreaterThan(0);
  });
});
