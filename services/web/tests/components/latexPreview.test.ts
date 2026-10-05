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

  // Template-quality pass: the formulas the palette templates use.
  it('separates function names from what follows, like MathTex', () => {
    expect(latexToUnicode('\\cos\\theta')).toBe('cos θ');
    expect(latexToUnicode('\\sin x')).toBe('sin x');
    expect(latexToUnicode('\\cos^2\\theta + \\sin^2\\theta = 1')).toBe('cos²θ + sin²θ = 1');
  });

  it('keeps symbol subscripts readable (limits)', () => {
    expect(latexToUnicode('\\lim_{x \\to 0} f(x) = L')).toBe('limₓ→₀ f(x) = L');
  });

  it('handles spacing commands, escapes and boxes', () => {
    expect(latexToUnicode('P = (\\cos\\theta,\\ \\sin\\theta)')).toBe('P = (cos θ, sin θ)');
    expect(latexToUnicode('68\\%')).toBe('68%');
    expect(latexToUnicode('\\square')).toBe('□');
  });

  it('renders accents and drops font wrappers', () => {
    // U+20D7 (combining arrow above) is missing from common serif fonts and
    // drew a tofu box; the preview shows the plain letter (render: real arrow).
    expect(latexToUnicode('\\vec{u} + \\vec{v} = \\vec{w}')).toBe('u + v = w');
    expect(latexToUnicode('\\hat{x} \\bar{y}')).toBe('x\u0302 y\u0304'); // combining marks
    expect(latexToUnicode('\\mathcal{N}(0,1)')).toBe('N(0,1)');
    expect(latexToUnicode('x \\in \\mathbb{R}')).toBe('x ∈ ℝ');
    expect(latexToUnicode('\\text{if } x')).toBe('if  x');
  });

  it('strips $ delimiters and is safe on empty input', () => {
    expect(latexToUnicode('$x^2$')).toBe('x²');
    expect(latexToUnicode('')).toBe('');
    expect(latexToUnicode(null)).toBe('');
  });
});
