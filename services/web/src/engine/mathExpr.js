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

/** Returns a `(v) => number` function, or null if the expression is unsafe or won't evaluate. */
export function compileExpr(expr, varName = 'x') {
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(varName)) return null;
  if (!isSafeExpr(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(varName, '"use strict";' + SCOPE + 'return (' + expr.trim() + ');');
    const probe = fn(1);                 // reject ReferenceError (undefined functions) early
    if (typeof probe !== 'number') return null;
    return fn;
  } catch {
    return null;
  }
}
