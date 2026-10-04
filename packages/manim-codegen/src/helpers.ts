import { EASING_MAP, FRAME_WIDTH, FRAME_HEIGHT, DASH_TYPES, SHADOW_TYPES } from './constants.js';
import type { SceneObject, PathPoint } from './types.js';

export function rf(e: string | undefined): string {
  return (e !== undefined ? EASING_MAP[e] : undefined) || 'rate_functions.smooth';
}
export function rfOpt(e: string | undefined): string {
  const r = rf(e);
  return r === 'rate_functions.smooth' ? '' : `, rate_func=${r}`;
}
export function vn(id: string): string {
  const n = id.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(n) ? 'o_' + n : n;
}
export function rtOpt(d: number): string {
  return Math.abs(d - 1) < 0.01 ? '' : `, run_time=${d.toFixed(1)}`;
}

/** Validate and format a color value for Manim. Returns quoted hex string or null. */
export function hex(h: unknown): string | null {
  if (!h || typeof h !== 'string') return null;
  const s = h.trim();
  if (!s || s === 'transparent' || s === 'none') return null;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return `"${s}"`;
  return null;
}

/** Ensure a numeric value is valid and positive, with a fallback. */
export function safeNum(val: unknown, fallback: number): number {
  const n = typeof val === 'number' ? val : parseFloat(val as string);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Clamp opacity to [0, 1]. */
export function safeOpacity(val: unknown): number {
  const n = typeof val === 'number' ? val : parseFloat(val as string);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/**
 * Arrow tip length in project px, shared by the canvas preview and codegen so
 * both draw the same tip: scales with the stroke (6×, 28 px floor) and is
 * capped at a quarter of the arrow length (Manim's own default ratio). The
 * old constant ≈ 7 px tip was nearly invisible in renders.
 */
export const ARROW_TIP_LENGTH_RATIO = 0.25;
export function arrowTipPx(lengthPx: number, strokeWidth: number): number {
  const base = Math.max(28, 6 * (Number.isFinite(strokeWidth) ? strokeWidth : 0));
  return Math.min(base, ARROW_TIP_LENGTH_RATIO * Math.max(0, lengthPx || 0));
}

/** Bare function names users type that only exist in the scene as `np.<name>`. */
export const NP_FUNCTIONS = [
  'sin',
  'cos',
  'tan',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'exp',
  'log',
  'log10',
  'log2',
  'abs',
  'sign',
  'floor',
  'ceil',
  'power',
] as const;

/** Common spellings that numpy names differently. */
const NP_ALIASES: Record<string, string> = {
  ln: 'log',
  asin: 'arcsin',
  acos: 'arccos',
  atan: 'arctan',
};

const NP_FN_RE = new RegExp(
  `(?<![\\w.])(${[...NP_FUNCTIONS, ...Object.keys(NP_ALIASES)].join('|')})(?=\\s*\\()`,
  'g'
);
const NP_CONST_RE = /(?<![\w.])(pi|e|E)(?![\w(])/g;

/**
 * Rewrite a math expression into the form the generated scene can evaluate:
 * the scene only imports `manim` + `numpy as np`, so bare `exp(x)` / `pi`
 * would raise NameError, and `^` is XOR in Python. Already-prefixed `np.*`
 * calls and manim constants (PI, TAU) are left as-is, so this is idempotent.
 * The preview compiler (engine/mathExpr.ts) applies the same rewrite.
 */
export function normalizeMathExpr(expr: string): string {
  return expr
    .replace(/\^/g, '**')
    .replace(NP_FN_RE, (_m, fn: string) => `np.${NP_ALIASES[fn] ?? fn}`)
    .replace(NP_CONST_RE, (c) => (c === 'pi' ? 'np.pi' : 'np.e'));
}

export function safeMathExpr(expr: unknown, fallback = 'x**2'): string {
  if (!expr || typeof expr !== 'string') return fallback;
  const t = expr.trim();
  if (!t) return fallback;
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(t)) return fallback;
  if (/import|eval|exec|open|__/.test(t)) return fallback;
  return normalizeMathExpr(t);
}

/** Sanitise text for Python string literals. */
export function safeText(s: unknown): string {
  if (!s || typeof s !== 'string') return 'Text';
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

/** Escape a label for a NON-raw Python string passed to MathTex/get_tex (one backslash
    survives so LaTeX commands typeset; mirrors the `latex` case — avoids the \\int line-break bug). */
export function safeLatex(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

/** Escape a DecimalNumber `unit` string. DecimalNumber renders `unit` through the
 *  MathTex pipeline, so LaTeX-special chars (`% & # _ $ { }`) must be backslash-
 *  escaped or they break the render (e.g. `%` starts a LaTeX comment and eats the
 *  rest). We add the LaTeX escape, then double backslashes + escape quotes for the
 *  Python string literal. No-op for plain units (e.g. `" u"`) → byte-identical to
 *  the legacy `safeText`-based output. Inverse: the parser's `unescapeUnit`. */
export function latexUnit(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/([%&#_${}])/g, '\\$1') // LaTeX-escape specials (single backslash)
    .replace(/\\/g, '\\\\') // double all backslashes for the .py literal
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, ' ');
}

/** Sanitize a Matrix entry to a safe Manim display string (no eval; strips quotes/backslashes/newlines). */
export function safeMatrixEntry(s: unknown): string {
  const t = String(s == null ? '' : s)
    .replace(/\\/g, '')
    .replace(/"/g, '')
    .replace(/[\n\r]/g, '')
    .slice(0, 32);
  return t.length ? t : '0';
}

/** Manim Matrix bracket args: '' for default '[', explicit left/right_bracket otherwise. */
export function matrixBrackets(b: string | undefined): string {
  if (b === '(') return ', left_bracket="(", right_bracket=")"';
  if (b === '|') return ', left_bracket="|", right_bracket="|"';
  return '';
}

/** Escape a multiline user string into the body of a single-line Python
 *  double-quoted string literal: backslashes first, then quotes, then
 *  CR/CRLF→\n normalization, then newlines and tabs. Used by the `code`
 *  object's `code_string=` so the one-line regex parser can round-trip it.
 *  Inverse: `unescapePyMultiline` in services/web/src/export/manim.ts. */
export function pyMultiline(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

// ── Style effect helpers (KEEP BYTE-IDENTICAL with services/api/src/compiler/codegen.js) ──

/** Fill opacity expression: byte-identical to bare master when fillOpacity is 1/absent. */
export function fillOpacityExpr(obj: SceneObject, master: number): string {
  const f = obj.fillOpacity;
  if (f == null || f === 1) return `${master}`;
  return `${+(master * (f as number)).toFixed(3)}`;
}
/** Stroke opacity arg: emitted only when strokeOpacity is set and < 1. */
export function strokeOpacityArg(obj: SceneObject, master: number): string {
  const s = obj.strokeOpacity;
  if (s == null || s === 1) return '';
  return `, opacity=${+(master * (s as number)).toFixed(3)}`;
}
/** set_color_by_gradient line, or null when no valid gradient. */
export function gradientLine(n: string, obj: SceneObject): string | null {
  if (!obj.gradient || !Array.isArray(obj.gradient.colors)) return null;
  const cols = obj.gradient.colors.map((c: string) => hex(c)).filter(Boolean);
  if (cols.length < 2) return null;
  return `${n}.set_color_by_gradient(${cols.join(', ')})`;
}
/** Dashed-wrap lines (fill-preserving VGroup), or [] when no dash. */
export function dashedLines(n: string, obj: SceneObject): string[] {
  if (!obj.dash || !DASH_TYPES.has(obj.type)) return [];
  const numDashes = Math.max(2, Math.round(obj.dash.numDashes || 12));
  const ratio = Math.max(0, Math.min(1, obj.dash.ratio ?? 0.5));
  return [
    `_dash_src_${n} = ${n}.copy()`,
    `${n}.set_stroke(width=0)`,
    `${n} = VGroup(${n}, DashedVMobject(_dash_src_${n}, num_dashes=${numDashes}, dashed_ratio=${+ratio}))`,
  ];
}
/** round_corners line for polygon/triangle/star (rect/square use RoundedRectangle), or null. */
export function roundCornersLine(n: string, obj: SceneObject, sw: number): string | null {
  if (!obj.cornerRadius || obj.cornerRadius <= 0) return null;
  if (!['polygon', 'triangle', 'star'].includes(obj.type)) return null;
  return `${n}.round_corners(radius=${((obj.cornerRadius / sw) * FRAME_WIDTH).toFixed(3)})`;
}
/** Drop-shadow lines (shifted dark copy + VGroup), or [] when no shadow. */
export function shadowLines(n: string, obj: SceneObject, sw: number, sh: number): string[] {
  const s = obj.shadow;
  if (!s || !SHADOW_TYPES.has(obj.type)) return [];
  const color = hex(s.color) || '"#000000"';
  const op = +(Number.isFinite(s.opacity) ? s.opacity! : 0.4);
  const dxm = (((Number.isFinite(s.dx) ? s.dx! : 8) / sw) * FRAME_WIDTH).toFixed(3);
  const dym = ((-(Number.isFinite(s.dy) ? s.dy! : 8) / sh) * FRAME_HEIGHT).toFixed(3);
  return [
    `_shadow_${n} = ${n}.copy().set_color(${color}).set_opacity(${op}).shift([${dxm}, ${dym}, 0])`,
    `${n} = VGroup(_shadow_${n}, ${n})`,
  ];
}

export function stageToManim(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: (x / w - 0.5) * FRAME_WIDTH, y: -(y / h - 0.5) * FRAME_HEIGHT };
}

// path_move noktalarını Python koordinat string'ine çevirir.
// 3D nokta (x3d alanı varsa) doğrudan Manim biriminde; aksi halde 2D piksel → Manim.
export function pathPointsPy(path: PathPoint[], sw: number, sh: number): string {
  const is3dPath = path[0] && 'x3d' in path[0];
  return path
    .map((p) => {
      if (is3dPath) {
        return `[${(p.x3d ?? 0).toFixed(3)}, ${(p.y3d ?? 0).toFixed(3)}, ${(p.z3d ?? 0).toFixed(3)}]`;
      }
      const m = stageToManim(p.x ?? 0, p.y ?? 0, sw, sh);
      return `[${m.x.toFixed(3)}, ${m.y.toFixed(3)}, 0]`;
    })
    .join(', ');
}

/** Check if a font is a common system font (not requiring download from Google Fonts) */
export function isSystemFont(fontFamily: string): boolean {
  const systemFonts = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Times',
    'Georgia',
    'Courier New',
    'Courier',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Impact',
    'Comic Sans MS',
    'Lucida Console',
    'Monaco',
    'sans-serif',
    'serif',
    'monospace',
    'cursive',
    'fantasy',
  ];
  return systemFonts.some((f) => f.toLowerCase() === fontFamily.toLowerCase());
}

/**
 * Microsoft core fonts are absent from the Linux render container, where
 * Manim dumps its whole font list and falls back to an arbitrary face. These
 * open Google Fonts are metric-compatible clones, so the render keeps the
 * layout the browser preview (which has the original) shows.
 */
export const RENDER_FONT_SUBSTITUTES: Readonly<Record<string, string>> = {
  arial: 'Arimo',
  helvetica: 'Arimo',
  'times new roman': 'Tinos',
  times: 'Tinos',
  'courier new': 'Cousine',
  courier: 'Cousine',
  georgia: 'Gelasio',
};

export interface RenderFont {
  /** Family name passed to Manim's Text(font=…). */
  font: string;
  /** Download + register it via manim-fonts' RegisterFont. */
  register: boolean;
  /** A system font with no clone: silence Manim's missing-font dump. */
  quiet: boolean;
}

/** How a text object's chosen family is rendered by Manim. */
export function renderFontFor(fontFamily: string): RenderFont {
  const clone = RENDER_FONT_SUBSTITUTES[fontFamily.toLowerCase()];
  if (clone) return { font: clone, register: true, quiet: false };
  if (isSystemFont(fontFamily)) return { font: fontFamily, register: false, quiet: true };
  return { font: fontFamily, register: true, quiet: false };
}

export function fmt3d(n: number): string {
  // Format a 3D numeric param: strip trailing zeros but keep at least 1 decimal place
  return n
    .toFixed(3)
    .replace(/(\.\d*[1-9])0+$/, '$1')
    .replace(/\.0{3}$/, '.0');
}
