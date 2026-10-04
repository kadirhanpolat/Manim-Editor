/**
 * Whitelisted math-expression compiler for canvas previews.
 * Exposes an `np.*` + PI/TAU/E scope so a preview evaluates the same names
 * Manim resolves at render time (numpy as np, manim PI/TAU). Expressions are
 * first passed through the codegen's `normalizeMathExpr` (bare `exp(x)` →
 * `np.exp(x)`, `^` → `**`), so preview and render agree on what a user typed.
 * Whitelist must stay in sync with safeMathExpr() in @manim/codegen.
 */
import { normalizeMathExpr } from '@manim/codegen';

const MATH_SCOPE =
  'const np={sin:Math.sin,cos:Math.cos,tan:Math.tan,arcsin:Math.asin,arccos:Math.acos,' +
  'arctan:Math.atan,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,sqrt:Math.sqrt,' +
  'abs:Math.abs,exp:Math.exp,log:Math.log,log10:Math.log10,log2:Math.log2,sign:Math.sign,' +
  'power:Math.pow,floor:Math.floor,ceil:Math.ceil,pi:Math.PI,e:Math.E};' +
  'const PI=Math.PI,TAU=2*Math.PI,E=Math.E;';

/** Characters after which a `-` is a unary minus, not a subtraction. */
const UNARY_CONTEXT = new Set(['', '(', ',', '+', '-', '*', '/', '%']);

/**
 * Python reads `-x**2` as `-(x**2)`; JS rejects a unary operator before `**`
 * (SyntaxError). Rewriting each unary minus to `(-1)*` keeps Python's meaning
 * (`**` binds tighter than `*`) and is valid JS. A minus right after `**`
 * (`x**-2`) is left alone — JS allows it there and the rewrite would change
 * the exponent's precedence.
 */
function toJsExpr(expr: string): string {
  let out = '';
  let prev = ''; // last non-space source char
  let prev2 = '';
  for (const ch of expr) {
    if (ch === '-' && UNARY_CONTEXT.has(prev) && !(prev === '*' && prev2 === '*')) {
      out += '(-1)*';
    } else {
      out += ch;
    }
    if (ch.trim()) {
      prev2 = prev;
      prev = ch;
    }
  }
  return out;
}

export function isSafeExpr(expr: unknown): boolean {
  if (!expr || typeof expr !== 'string') return false;
  const e = expr.trim();
  if (!e) return false;
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(e)) return false;
  if (/import|eval|exec|open|__/.test(e)) return false;
  if (
    /\b(fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|require|process|globalThis|window|document|console|alert|prompt|Function|constructor|prototype|random|Date|localStorage|sessionStorage|navigator|location|Reflect|Proxy|Symbol)\b/.test(
      e
    )
  )
    return false;
  return true;
}

/**
 * Returns a `(...vars) => number` function, or null if the expression is unsafe
 * or won't evaluate. `varName` is a single identifier (e.g. 'x') or an array of
 * identifiers (e.g. ['x', 'y']) for multivariate expressions like a 3D surface.
 */
export function compileExpr(
  expr: string,
  varName: string | string[] = 'x'
): ((...args: number[]) => number) | null {
  const names: string[] = Array.isArray(varName) ? varName : [varName];
  if (!names.every((v) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v))) return null;
  if (!isSafeExpr(expr)) return null;
  try {
    const fn = new Function(
      ...names,
      '"use strict";' + MATH_SCOPE + 'return (' + toJsExpr(normalizeMathExpr(expr.trim())) + ');'
    ) as (...args: number[]) => number;
    const probe = fn(...names.map(() => 1)); // reject ReferenceError (undefined functions) early
    if (typeof probe !== 'number') return null;
    return fn;
  } catch {
    return null;
  }
}
