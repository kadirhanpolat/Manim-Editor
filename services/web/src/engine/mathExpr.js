/**
 * Whitelisted math-expression compiler for canvas previews.
 * Exposes an `np.*` + PI/TAU/E scope so a preview evaluates the same names
 * Manim resolves at render time (numpy as np, manim PI/TAU).
 * Whitelist must stay in sync with safeMathExpr() in codegen.js and manim.js.
 */
const SCOPE =
  'const np={sin:Math.sin,cos:Math.cos,tan:Math.tan,arcsin:Math.asin,arccos:Math.acos,' +
  'arctan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,log:Math.log,sign:Math.sign,' +
  'power:Math.pow,floor:Math.floor,ceil:Math.ceil,pi:Math.PI,e:Math.E};' +
  'const PI=Math.PI,TAU=2*Math.PI,E=Math.E;';

export function isSafeExpr(expr) {
  if (!expr || typeof expr !== 'string') return false;
  const e = expr.trim();
  if (!e) return false;
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(e)) return false;
  if (/import|eval|exec|open|__/.test(e)) return false;
  if (/\b(fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|require|process|globalThis|window|document|console|alert|prompt|Function|constructor|prototype|random|Date|localStorage|sessionStorage|navigator|location|Reflect|Proxy|Symbol)\b/.test(e)) return false;
  return true;
}

/**
 * Returns a `(...vars) => number` function, or null if the expression is unsafe
 * or won't evaluate. `varName` is a single identifier (e.g. 'x') or an array of
 * identifiers (e.g. ['x', 'y']) for multivariate expressions like a 3D surface.
 */
export function compileExpr(expr, varName = 'x') {
  const names = Array.isArray(varName) ? varName : [varName];
  if (!names.every(v => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v))) return null;
  if (!isSafeExpr(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...names, '"use strict";' + SCOPE + 'return (' + expr.trim() + ');');
    const probe = fn(...names.map(() => 1)); // reject ReferenceError (undefined functions) early
    if (typeof probe !== 'number') return null;
    return fn;
  } catch {
    return null;
  }
}
