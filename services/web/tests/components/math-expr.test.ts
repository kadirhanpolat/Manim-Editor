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
  // Mirrors codegen normalizeMathExpr (EDITOR_FINDINGS #1): bare names and ^
  // must mean the same thing in the preview as in the rendered Python.
  it('accepts bare math functions and constants like the render does', () => {
    expect(compileExpr('exp(-x)', 'x')!(0)).toBeCloseTo(1);
    expect(compileExpr('sin(x) + cos(x)', 'x')!(0)).toBeCloseTo(1);
    expect(compileExpr('sinh(x) + log10(x)', 'x')!(1)).toBeCloseTo(Math.sinh(1));
    expect(compileExpr('pi + e', 'x')!(0)).toBeCloseTo(Math.PI + Math.E);
  });
  it('treats ^ as exponentiation, matching the generated Python', () => {
    expect(compileExpr('x^2', 'x')!(3)).toBe(9);
  });
  // `-x**2` is valid Python (= -(x**2)) but a SyntaxError in JS.
  it('evaluates a leading unary minus before a power like Python', () => {
    expect(compileExpr('-x^2', 'x')!(3)).toBe(-9);
    expect(compileExpr('2*-x**2', 'x')!(3)).toBe(-18);
    expect(compileExpr('-sin(x)^2 + 1', 'x')!(0)).toBeCloseTo(1);
    expect(compileExpr('x**-1', 'x')!(2)).toBeCloseTo(0.5);
    expect(compileExpr('(-x)**2', 'x')!(3)).toBe(9);
    expect(compileExpr('- -x', 'x')!(3)).toBe(3);
  });
});
