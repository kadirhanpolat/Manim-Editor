import { EASING_MAP, FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS, DASH_TYPES, SHADOW_TYPES } from './constants.js';

export function rf(e)   { return EASING_MAP[e] || 'rate_functions.smooth'; }
export function rfOpt(e) { const r = rf(e); return r === 'rate_functions.smooth' ? '' : `, rate_func=${r}`; }
export function vn(id)   { let n = id.replace(/[^a-zA-Z0-9_]/g, '_'); return /^[0-9]/.test(n) ? 'o_' + n : n; }
export function rtOpt(d) { return Math.abs(d - 1) < 0.01 ? '' : `, run_time=${d.toFixed(1)}`; }

/** Validate and format a color value for Manim. Returns quoted hex string or null. */
export function hex(h) {
  if (!h || typeof h !== 'string') return null;
  const s = h.trim();
  if (!s || s === 'transparent' || s === 'none') return null;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return `"${s}"`;
  return null;
}

/** Ensure a numeric value is valid and positive, with a fallback. */
export function safeNum(val, fallback) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  return (Number.isFinite(n) && n > 0) ? n : fallback;
}

/** Clamp opacity to [0, 1]. */
export function safeOpacity(val) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

export function safeMathExpr(expr, fallback = 'x**2') {
  if (!expr || typeof expr !== 'string') return fallback;
  const t = expr.trim();
  if (!t) return fallback;
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(t)) return fallback;
  if (/import|eval|exec|open|__/.test(t)) return fallback;
  return t;
}

/** Sanitise text for Python string literals. */
export function safeText(s) {
  if (!s || typeof s !== 'string') return 'Text';
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

/** Escape a label for a NON-raw Python string passed to MathTex/get_tex (one backslash
    survives so LaTeX commands typeset; mirrors the `latex` case — avoids the \\int line-break bug). */
export function safeLatex(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

/** Sanitize a Matrix entry to a safe Manim display string (no eval; strips quotes/backslashes/newlines). */
export function safeMatrixEntry(s) {
  const t = String(s == null ? '' : s).replace(/\\/g, '').replace(/"/g, '').replace(/[\n\r]/g, '').slice(0, 32);
  return t.length ? t : '0';
}

/** Manim Matrix bracket args: '' for default '[', explicit left/right_bracket otherwise. */
export function matrixBrackets(b) {
  if (b === '(') return ', left_bracket="(", right_bracket=")"';
  if (b === '|') return ', left_bracket="|", right_bracket="|"';
  return '';
}

// ── Style effect helpers (KEEP BYTE-IDENTICAL with services/api/src/compiler/codegen.js) ──

/** Fill opacity expression: byte-identical to bare master when fillOpacity is 1/absent. */
export function fillOpacityExpr(obj, master) {
  const f = obj.fillOpacity;
  if (f == null || f === 1) return `${master}`;
  return `${+(master * f).toFixed(3)}`;
}
/** Stroke opacity arg: emitted only when strokeOpacity is set and < 1. */
export function strokeOpacityArg(obj, master) {
  const s = obj.strokeOpacity;
  if (s == null || s === 1) return '';
  return `, opacity=${+(master * s).toFixed(3)}`;
}
/** set_color_by_gradient line, or null when no valid gradient. */
export function gradientLine(n, obj) {
  if (!obj.gradient || !Array.isArray(obj.gradient.colors)) return null;
  const cols = obj.gradient.colors.map(c => hex(c)).filter(Boolean);
  if (cols.length < 2) return null;
  return `${n}.set_color_by_gradient(${cols.join(', ')})`;
}
/** Dashed-wrap lines (fill-preserving VGroup), or [] when no dash. */
export function dashedLines(n, obj) {
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
export function roundCornersLine(n, obj, sw) {
  if (!obj.cornerRadius || obj.cornerRadius <= 0) return null;
  if (!['polygon', 'triangle', 'star'].includes(obj.type)) return null;
  return `${n}.round_corners(radius=${(obj.cornerRadius / sw * FRAME_WIDTH).toFixed(3)})`;
}
/** Drop-shadow lines (shifted dark copy + VGroup), or [] when no shadow. */
export function shadowLines(n, obj, sw, sh) {
  const s = obj.shadow;
  if (!s || !SHADOW_TYPES.has(obj.type)) return [];
  const color = hex(s.color) || '"#000000"';
  const op = +(Number.isFinite(s.opacity) ? s.opacity : 0.4);
  const dxm = ((Number.isFinite(s.dx) ? s.dx : 8) / sw * FRAME_WIDTH).toFixed(3);
  const dym = ((-(Number.isFinite(s.dy) ? s.dy : 8)) / sh * FRAME_HEIGHT).toFixed(3);
  return [
    `_shadow_${n} = ${n}.copy().set_color(${color}).set_opacity(${op}).shift([${dxm}, ${dym}, 0])`,
    `${n} = VGroup(_shadow_${n}, ${n})`,
  ];
}

export function stageToManim(x, y, w, h) {
  return { x: ((x / w) - 0.5) * FRAME_WIDTH, y: -((y / h) - 0.5) * FRAME_HEIGHT };
}

// path_move noktalarını Python koordinat string'ine çevirir.
// 3D nokta (x3d alanı varsa) doğrudan Manim biriminde; aksi halde 2D piksel → Manim.
export function pathPointsPy(path, sw, sh) {
  const is3dPath = path[0] && 'x3d' in path[0];
  return path.map(p => {
    if (is3dPath) {
      return `[${(p.x3d ?? 0).toFixed(3)}, ${(p.y3d ?? 0).toFixed(3)}, ${(p.z3d ?? 0).toFixed(3)}]`;
    }
    const m = stageToManim(p.x, p.y, sw, sh);
    return `[${m.x.toFixed(3)}, ${m.y.toFixed(3)}, 0]`;
  }).join(', ');
}

/** Check if a font is a common system font (not requiring download from Google Fonts) */
export function isSystemFont(fontFamily) {
  const systemFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Georgia',
    'Courier New', 'Courier', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Impact', 'Comic Sans MS', 'Lucida Console', 'Monaco',
    'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'
  ];
  return systemFonts.some(f => f.toLowerCase() === fontFamily.toLowerCase());
}

export function fmt3d(n) {
  // Format a 3D numeric param: strip trailing zeros but keep at least 1 decimal place
  return n.toFixed(3).replace(/(\.\d*[1-9])0+$/, '$1').replace(/\.0{3}$/, '.0');
}
