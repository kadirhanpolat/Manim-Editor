// Approximate LaTeX → Unicode, for the canvas PREVIEW only. Manim does the real
// typesetting from the raw `obj.latex` (MathTex); this just makes `\commands`
// and _/^ scripts legible on the Konva canvas, which can only draw plain text.

const SYMBOLS = {
  // greek (lower)
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  // greek (upper)
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  // big operators
  int: '∫',
  iint: '∬',
  iiint: '∭',
  oint: '∮',
  sum: '∑',
  prod: '∏',
  coprod: '∐',
  // operators / relations
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  pm: '±',
  mp: '∓',
  times: '×',
  div: '÷',
  cdot: '·',
  ast: '∗',
  star: '⋆',
  circ: '∘',
  bullet: '•',
  oplus: '⊕',
  otimes: '⊗',
  leq: '≤',
  le: '≤',
  geq: '≥',
  ge: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  equiv: '≡',
  sim: '∼',
  simeq: '≃',
  cong: '≅',
  propto: '∝',
  ll: '≪',
  gg: '≫',
  subset: '⊂',
  supset: '⊃',
  subseteq: '⊆',
  supseteq: '⊇',
  in: '∈',
  notin: '∉',
  ni: '∋',
  cup: '∪',
  cap: '∩',
  emptyset: '∅',
  varnothing: '∅',
  setminus: '∖',
  forall: '∀',
  exists: '∃',
  nexists: '∄',
  neg: '¬',
  land: '∧',
  lor: '∨',
  // arrows
  rightarrow: '→',
  to: '→',
  leftarrow: '←',
  gets: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  mapsto: '↦',
  uparrow: '↑',
  downarrow: '↓',
  implies: '⟹',
  iff: '⟺',
  // misc
  angle: '∠',
  perp: '⊥',
  parallel: '∥',
  cdots: '⋯',
  ldots: '…',
  dots: '…',
  vdots: '⋮',
  ddots: '⋱',
  hbar: 'ℏ',
  ell: 'ℓ',
  Re: 'ℜ',
  Im: 'ℑ',
  aleph: 'ℵ',
  wp: '℘',
  prime: '′',
  degree: '°',
  deg: '°',
  surd: '√',
};

const SUP = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  a: 'ᵃ',
  b: 'ᵇ',
  c: 'ᶜ',
  d: 'ᵈ',
  e: 'ᵉ',
  f: 'ᶠ',
  g: 'ᵍ',
  h: 'ʰ',
  i: 'ⁱ',
  j: 'ʲ',
  k: 'ᵏ',
  l: 'ˡ',
  m: 'ᵐ',
  n: 'ⁿ',
  o: 'ᵒ',
  p: 'ᵖ',
  r: 'ʳ',
  s: 'ˢ',
  t: 'ᵗ',
  u: 'ᵘ',
  v: 'ᵛ',
  w: 'ʷ',
  x: 'ˣ',
  y: 'ʸ',
  z: 'ᶻ',
};

const SUB = {
  0: '₀',
  1: '₁',
  2: '₂',
  3: '₃',
  4: '₄',
  5: '₅',
  6: '₆',
  7: '₇',
  8: '₈',
  9: '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ',
};

// Map a string to a sub/superscript run; return null if any char is unmappable.
function toScript(str, table) {
  let out = '';
  for (const ch of str) {
    if (!table[ch]) return null;
    out += table[ch];
  }
  return out;
}

export function latexToUnicode(src) {
  if (!src) return '';
  let s = String(src);
  s = s.replace(/\$/g, ''); // drop math delimiters
  s = s.replace(/\\(left|right|displaystyle|textstyle|,|;|:|!|quad|qquad)\b/g, '');
  s = s.replace(/\\\\/g, ' '); // line breaks → space
  s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/\\([a-zA-Z]+)/g, (m, name) => (name in SYMBOLS ? SYMBOLS[name] : name));
  // Scripts in one pass each (braced `{...}` or a single char), so an unmappable
  // fallback like `^(AB)` isn't re-scanned and mangled by a later single-char pass.
  s = s.replace(/\^(\{[^{}]*\}|\S)/g, (m, g) => {
    const braced = g[0] === '{';
    const inner = braced ? g.slice(1, -1) : g;
    return toScript(inner, SUP) ?? (braced ? `^(${inner})` : `^${inner}`);
  });
  s = s.replace(/_(\{[^{}]*\}|\S)/g, (m, g) => {
    const braced = g[0] === '{';
    const inner = braced ? g.slice(1, -1) : g;
    return toScript(inner, SUB) ?? (braced ? `_(${inner})` : `_${inner}`);
  });
  s = s.replace(/[{}]/g, ''); // strip leftover braces
  return s;
}

export default latexToUnicode;
