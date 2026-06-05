import { describe, it, expect } from 'vitest';
import { latexToUnicode } from '../../src/utils/latexPreview.js';

describe('latexToUnicode', () => {
  it('renders \\int_a^b with the integral sign and scripts', () => {
    expect(latexToUnicode('\\int_a^b')).toBe('∫ₐᵇ');
  });

  it('handles superscripts on plain text', () => {
    expect(latexToUnicode('E = mc^2')).toBe('E = mc²');
  });

  it('maps greek letters and operators', () => {
    expect(latexToUnicode('\\alpha + \\beta = \\gamma')).toBe('α + β = γ');
    expect(latexToUnicode('\\sum \\infty')).toBe('∑ ∞');
  });

  it('rewrites \\frac and \\sqrt to readable forms', () => {
    expect(latexToUnicode('\\frac{a}{b}')).toBe('(a)/(b)');
    expect(latexToUnicode('\\sqrt{x}')).toBe('√(x)');
  });

  it('handles braced scripts, falling back when unmappable', () => {
    expect(latexToUnicode('x^{2n}')).toBe('x²ⁿ');
    // capital letters have no unicode superscript → readable fallback
    expect(latexToUnicode('x^{AB}')).toBe('x^(AB)');
  });

  it('strips $ delimiters and is safe on empty input', () => {
    expect(latexToUnicode('$x^2$')).toBe('x²');
    expect(latexToUnicode('')).toBe('');
    expect(latexToUnicode(null)).toBe('');
  });
});
