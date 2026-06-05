/**
 * Manim Python Code Exporter + Parser v4
 *
 * CODEGEN:  project JSON → clean Manim CE scene.py
 * PARSER:   Manim code   → project JSON (objects + clips)
 *
 * Supports: rectangle, square, circle, ellipse, triangle, star, polygon,
 *           line, arrow, heart, dot, dot_grid, text, image, svg_asset, groups
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

// NOTE: keep in sync with services/api/src/compiler/codegen.js EASING_MAP
const EASING_MAP = {
  linear:            'linear',
  ease_in:           'rate_functions.ease_in_sine',
  ease_out:          'rate_functions.ease_out_sine',
  ease_in_out:       'rate_functions.smooth',
  ease_in_cubic:     'rate_functions.ease_in_cubic',
  ease_out_cubic:    'rate_functions.ease_out_cubic',
  ease_in_out_cubic: 'rate_functions.ease_in_out_cubic',
  ease_in_quart:     'rate_functions.ease_in_quart',
  ease_out_quart:    'rate_functions.ease_out_quart',
  ease_in_out_quart: 'rate_functions.ease_in_out_quart',
  ease_in_back:      'rate_functions.ease_in_back',
  ease_out_back:     'rate_functions.ease_out_back',
  ease_in_out_back:  'rate_functions.ease_in_out_back',
  ease_out_elastic:  'rate_functions.ease_out_elastic',
  ease_in_elastic:   'rate_functions.ease_in_elastic',
  ease_out_bounce:   'rate_functions.ease_out_bounce',
  spring:            'rate_functions.ease_out_elastic',
};

const EASING_REV = {};
for (const [k, val] of Object.entries(EASING_MAP)) EASING_REV[val] = k;

function rf(e)   { return EASING_MAP[e] || 'rate_functions.smooth'; }
function rfOpt(e) { const r = rf(e); return r === 'rate_functions.smooth' ? '' : `, rate_func=${r}`; }
function v(id)   { let n = id.replace(/[^a-zA-Z0-9_]/g, '_'); return /^[0-9]/.test(n) ? 'o_' + n : n; }
function rtOpt(d) { return Math.abs(d - 1) < 0.01 ? '' : `, run_time=${d.toFixed(1)}`; }

/** Validate and format a color value for Manim. Returns quoted hex string or null. */
function hex(h) {
  if (!h || typeof h !== 'string') return null;
  const s = h.trim();
  if (!s || s === 'transparent' || s === 'none') return null;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return `"${s}"`;
  return null;
}

/** Ensure a numeric value is valid and positive, with a fallback. */
function safeNum(val, fallback) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  return (Number.isFinite(n) && n > 0) ? n : fallback;
}

/** Clamp opacity to [0, 1]. */
function safeOpacity(val) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

function safeMathExpr(expr, fallback = 'x**2') {
  if (!expr || typeof expr !== 'string') return fallback;
  const t = expr.trim();
  if (!t) return fallback;
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(t)) return fallback;
  if (/import|eval|exec|open|__/.test(t)) return fallback;
  return t;
}

/** Sanitise text for Python string literals. */
function safeText(s) {
  if (!s || typeof s !== 'string') return 'Text';
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

/** Escape a label for a NON-raw Python string passed to MathTex/get_tex (one backslash
    survives so LaTeX commands typeset; mirrors the `latex` case — avoids the \\int line-break bug). */
function safeLatex(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

/** Sanitize a Matrix entry to a safe Manim display string (no eval; strips quotes/backslashes/newlines). */
function safeMatrixEntry(s) {
  const t = String(s == null ? '' : s).replace(/\\/g, '').replace(/"/g, '').replace(/[\n\r]/g, '').slice(0, 32);
  return t.length ? t : '0';
}

/** Manim Matrix bracket args: '' for default '[', explicit left/right_bracket otherwise. */
function matrixBrackets(b) {
  if (b === '(') return ', left_bracket="(", right_bracket=")"';
  if (b === '|') return ', left_bracket="|", right_bracket="|"';
  return '';
}

// Manim frame dimensions (matches Manim CE default)
const FRAME_WIDTH = 14 + 2 / 9;   // 14.22
const FRAME_HEIGHT = 8;
const FRAME_X_RADIUS = FRAME_WIDTH / 2;  // 7.11
const FRAME_Y_RADIUS = FRAME_HEIGHT / 2; // 4

// ── Style effect helpers (KEEP BYTE-IDENTICAL with services/api/src/compiler/codegen.js) ──
const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free']);
const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow', 'annulus', 'arc', 'sector', 'double_arrow', 'polygon_free', 'parametric']);
const SHADOW_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free', 'text', 'latex']);

/** Fill opacity expression: byte-identical to bare master when fillOpacity is 1/absent. */
function fillOpacityExpr(obj, master) {
  const f = obj.fillOpacity;
  if (f == null || f === 1) return `${master}`;
  return `${+(master * f).toFixed(3)}`;
}
/** Stroke opacity arg: emitted only when strokeOpacity is set and < 1. */
function strokeOpacityArg(obj, master) {
  const s = obj.strokeOpacity;
  if (s == null || s === 1) return '';
  return `, opacity=${+(master * s).toFixed(3)}`;
}
/** set_color_by_gradient line, or null when no valid gradient. */
function gradientLine(n, obj) {
  if (!obj.gradient || !Array.isArray(obj.gradient.colors)) return null;
  const cols = obj.gradient.colors.map(c => hex(c)).filter(Boolean);
  if (cols.length < 2) return null;
  return `${n}.set_color_by_gradient(${cols.join(', ')})`;
}
/** Dashed-wrap lines (fill-preserving VGroup), or [] when no dash. */
function dashedLines(n, obj) {
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
function roundCornersLine(n, obj, sw) {
  if (!obj.cornerRadius || obj.cornerRadius <= 0) return null;
  if (!['polygon', 'triangle', 'star'].includes(obj.type)) return null;
  return `${n}.round_corners(radius=${(obj.cornerRadius / sw * FRAME_WIDTH).toFixed(3)})`;
}
/** Drop-shadow lines (shifted dark copy + VGroup), or [] when no shadow. */
function shadowLines(n, obj, sw, sh) {
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

/** Inner Manim expression for an emphasis clip (Indicate/Flash/Wiggle/Circumscribe/FocusOn), or null. */
function emphasisExpr(c, sn) {
  const p = c.params || {};
  const col = hex(p.color || '#FFFF00');
  switch (c.type) {
    case 'indicate':
      return `Indicate(${sn}, color=${col}, scale_factor=${(p.scale_factor ?? 1.2).toFixed(2)})`;
    case 'flash':
      return `Flash(${sn}, color=${col}, flash_radius=${(p.flash_radius ?? 0.3).toFixed(2)}, line_length=${(p.line_length ?? 0.2).toFixed(2)}, num_lines=${p.num_lines ?? 12})`;
    case 'wiggle':
      return `Wiggle(${sn}, scale_value=${(p.scale_value ?? 1.1).toFixed(2)}, rotation_angle=${(p.rotation_angle ?? 3.6).toFixed(2)} * DEGREES, n_wiggles=${p.n_wiggles ?? 6})`;
    case 'circumscribe': {
      const shape = p.shape === 'Circle' ? 'Circle' : 'Rectangle';
      const fade = p.fade_out ? 'True' : 'False';
      return `Circumscribe(${sn}, color=${col}, shape=${shape}, fade_out=${fade}, time_width=${(p.time_width ?? 0.3).toFixed(2)})`;
    }
    case 'focus_on':
      return `FocusOn(${sn}, color=${col}, opacity=${(p.opacity ?? 0.2).toFixed(2)})`;
    default:
      return null;
  }
}

// ── 3D Object code ────────────────────────────────────────────────────────────

function fmt3d(n) {
  // Format a 3D numeric param: strip trailing zeros but keep at least 1 decimal place
  return n.toFixed(3).replace(/(\.\d*[1-9])0+$/, '$1').replace(/\.0{3}$/, '.0');
}

function objectCode3d(obj) {
  const n = v(obj.id);
  const lines = [];
  const fill = hex(obj.fill) || '"#FFFFFF"';
  const opacity = safeOpacity(obj.opacity ?? 1);
  const res = Math.max(4, Math.round(obj.resolution ?? 20));

  const pos = () => `[${fmt3d(obj.x3d ?? 0)}, ${fmt3d(obj.y3d ?? 0)}, ${fmt3d(obj.z3d ?? 0)}]`;

  switch (obj.type) {
    case 'sphere':
      lines.push(`${n} = Sphere(radius=${fmt3d(obj.radius ?? 0.5)}, resolution=(${res}, ${res}))`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'cube':
      lines.push(`${n} = Cube(side_length=${fmt3d(obj.sideLength ?? 1.0)})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'cone':
      lines.push(`${n} = Cone(base_radius=${fmt3d(obj.radius ?? 0.5)}, height=${fmt3d(obj.height ?? 1.0)}, resolution=${res})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'cylinder':
      lines.push(`${n} = Cylinder(radius=${fmt3d(obj.radius ?? 0.5)}, height=${fmt3d(obj.height ?? 1.5)}, resolution=${res})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'torus':
      lines.push(`${n} = Torus(major_radius=${fmt3d(obj.majorRadius ?? 1.0)}, minor_radius=${fmt3d(obj.minorRadius ?? 0.3)}, resolution=${res})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'axes3d': {
      const xr = obj.xRange ?? [-3, 3, 1];
      const yr = obj.yRange ?? [-3, 3, 1];
      const zr = obj.zRange ?? [-3, 3, 1];
      lines.push(`${n} = ThreeDAxes(x_range=[${xr[0]}, ${xr[1]}, ${xr[2]}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2]}], z_range=[${zr[0]}, ${zr[1]}, ${zr[2]}])`);
      if ((obj.x3d ?? 0) !== 0 || (obj.y3d ?? 0) !== 0 || (obj.z3d ?? 0) !== 0) {
        lines.push(`${n}.move_to(${pos()})`);
      }
      break;
    }
    default:
      lines.push(`# Unknown 3D type: ${obj.type}`);
  }
  return lines;
}

function stageToManim(x, y, w, h) {
  return { x: ((x / w) - 0.5) * FRAME_WIDTH, y: -((y / h) - 0.5) * FRAME_HEIGHT };
}
function manimToStage(mx, my, w, h) {
  return { x: (mx / FRAME_WIDTH + 0.5) * w, y: (-my / FRAME_HEIGHT + 0.5) * h };
}

// path_move noktalarını Python koordinat string'ine çevirir.
// 3D nokta (x3d alanı varsa) doğrudan Manim biriminde; aksi halde 2D piksel → Manim.
function pathPointsPy(path, sw, sh) {
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
function isSystemFont(fontFamily) {
  const systemFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Georgia',
    'Courier New', 'Courier', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Impact', 'Comic Sans MS', 'Lucida Console', 'Monaco',
    'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'
  ];
  return systemFonts.some(f => f.toLowerCase() === fontFamily.toLowerCase());
}

// ── Object code (single object definition) ──────────────────────────────────

function objCode(obj, sw, sh) {
  const n = v(obj.id), lines = [];
  const scale = Math.min(obj.width, obj.height) / sw * FRAME_WIDTH;
  const mp = stageToManim(obj.x, obj.y, sw, sh);

  // Helpers for this object
  const fill = hex(obj.fill) || '"#FFFFFF"';
  const stroke = hex(obj.stroke) || '"#FFFFFF"';
  const opacity = safeOpacity(obj.opacity);
  const sw2 = safeNum(obj.strokeWidth, 2);
  const hasFill = hex(obj.fill) !== null;
  const hasStroke = hex(obj.stroke) !== null;

  switch (obj.type) {
    case 'heart': {
      const mw = (obj.width / sw * FRAME_X_RADIUS).toFixed(3);
      const mh = (obj.height / sh * FRAME_Y_RADIUS).toFixed(3);
      lines.push(`${n} = ParametricFunction(`);
      lines.push(`    lambda t: np.array([np.sin(t)**3 * ${mw}, (13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t))/15 * ${mh}, 0]),`);
      lines.push(`    t_range=[0, 2*PI], color=${stroke})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      break;
    }
    case 'rectangle':
      {
        const rw = obj.width / sw * FRAME_WIDTH, rh = obj.height / sh * FRAME_HEIGHT;
        if (obj.cornerRadius > 0) {
          const cr = Math.min(obj.cornerRadius / sw * FRAME_WIDTH, Math.min(rw, rh) / 2 - 0.001);
          lines.push(`${n} = RoundedRectangle(corner_radius=${cr.toFixed(3)}, width=${rw.toFixed(3)}, height=${rh.toFixed(3)})`);
        } else {
          lines.push(`${n} = Rectangle(width=${rw.toFixed(3)}, height=${rh.toFixed(3)})`);
        }
      }
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    case 'square':
      if (obj.cornerRadius > 0) {
        const cr = Math.min(obj.cornerRadius / sw * FRAME_WIDTH, scale / 2 - 0.001);
        lines.push(`${n} = RoundedRectangle(corner_radius=${cr.toFixed(3)}, width=${scale.toFixed(3)}, height=${scale.toFixed(3)})`);
      } else {
        lines.push(`${n} = Square(side_length=${scale.toFixed(3)})`);
      }
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    case 'circle':
      lines.push(`${n} = Circle(radius=${(scale / 2).toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    case 'annulus': {
      const ri = safeNum(obj.innerRadius, 35) / sw * FRAME_WIDTH;
      const ro = safeNum(obj.outerRadius, 70) / sw * FRAME_WIDTH;
      lines.push(`${n} = Annulus(inner_radius=${ri.toFixed(3)}, outer_radius=${ro.toFixed(3)})`);
      if (hasFill) lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke) lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
    case 'arc': {
      const r = safeNum(obj.radius, 70) / sw * FRAME_WIDTH;
      lines.push(`${n} = Arc(radius=${r.toFixed(3)}, start_angle=${(+obj.startAngle || 0)} * DEGREES, angle=${(+obj.sweepAngle || 0)} * DEGREES)`);
      lines.push(`${n}.set_stroke(color=${hex(obj.stroke) || hex(obj.fill) || '"#FFFFFF"'}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
    case 'sector': {
      const r = safeNum(obj.radius, 70) / sw * FRAME_WIDTH;
      lines.push(`${n} = Sector(radius=${r.toFixed(3)}, start_angle=${(+obj.startAngle || 0)} * DEGREES, angle=${(+obj.sweepAngle || 0)} * DEGREES)`);
      if (hasFill) lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke) lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
    case 'double_arrow': {
      const half = (obj.width / 2 / sw * FRAME_WIDTH).toFixed(3);
      lines.push(`${n} = DoubleArrow(start=LEFT * ${half}, end=RIGHT * ${half}, color=${hex(obj.fill) || '"#EF4444"'}, buff=0, stroke_width=${sw2})`);
      break;
    }
    case 'ellipse':
      lines.push(`${n} = Ellipse(width=${(obj.width / sw * FRAME_WIDTH).toFixed(3)}, height=${(obj.height / sh * FRAME_HEIGHT).toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    case 'triangle':
      lines.push(`${n} = Triangle().scale(${scale.toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    case 'star': {
      const arms = safeNum(obj.starArms, 5);
      const inner = safeNum(obj.innerRatio, 0.4);
      lines.push(`${n} = Star(n=${arms}, outer_radius=${(scale / 2).toFixed(3)}, inner_radius=${(scale / 2 * inner).toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
    case 'polygon': {
      const sides = safeNum(obj.sides, 6);
      lines.push(`${n} = RegularPolygon(n=${sides}).scale(${(scale / 2).toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
    case 'polygon_free': {
      const verts = (Array.isArray(obj.vertices) && obj.vertices.length >= 3)
        ? obj.vertices : [[-80, -60], [80, -60], [80, 60], [-80, 60]];
      const pts = verts.map(([vx, vy]) =>
        `[${(vx / sw * FRAME_WIDTH).toFixed(3)}, ${(-vy / sh * FRAME_HEIGHT).toFixed(3)}, 0]`).join(', ');
      lines.push(`${n} = Polygon(${pts})`);
      if (hasFill) lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(obj, opacity)})`);
      if (hasStroke) lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
      break;
    }
    case 'parametric': {
      const xe = safeMathExpr(obj.xExpr, 't');
      const ye = safeMathExpr(obj.yExpr, '0');
      const t0 = Number.isFinite(obj.tMin) ? obj.tMin : 0;
      const t1 = Number.isFinite(obj.tMax) ? obj.tMax : 6.283;
      const col = hex(obj.stroke) || hex(obj.fill) || '"#10B981"';
      lines.push(`${n} = ParametricFunction(lambda t: np.array([${xe}, ${ye}, 0]), t_range=[${t0}, ${t1}], color=${col}, stroke_width=${sw2})`);
      break;
    }
    case 'matrix': {
      const data = (Array.isArray(obj.matrixData) && obj.matrixData.length && Array.isArray(obj.matrixData[0]))
        ? obj.matrixData : [['1', '0'], ['0', '1']];
      const body = data.map(row => `[${row.map(c => `"${safeMatrixEntry(c)}"`).join(', ')}]`).join(', ');
      lines.push(`${n} = Matrix([${body}]${matrixBrackets(obj.bracket)})`);
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'brace': {
      const p1 = Array.isArray(obj.p1) ? obj.p1 : [-80, 0];
      const p2 = Array.isArray(obj.p2) ? obj.p2 : [80, 0];
      const a = `[${(p1[0] / sw * FRAME_WIDTH).toFixed(3)}, ${(-p1[1] / sh * FRAME_HEIGHT).toFixed(3)}, 0]`;
      const b = `[${(p2[0] / sw * FRAME_WIDTH).toFixed(3)}, ${(-p2[1] / sh * FRAME_HEIGHT).toFixed(3)}, 0]`;
      const label = (obj.label || '').trim();
      if (label) {
        lines.push(`${n}_brace = BraceBetweenPoints(${a}, ${b})`);
        lines.push(`${n} = VGroup(${n}_brace, ${n}_brace.get_tex("${safeLatex(label)}"))`);
      } else {
        lines.push(`${n} = BraceBetweenPoints(${a}, ${b})`);
      }
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'angle': {
      const V = Array.isArray(obj.vertex) ? obj.vertex : [-40, 40];
      const P1 = Array.isArray(obj.point1) ? obj.point1 : [80, 40];
      const P2 = Array.isArray(obj.point2) ? obj.point2 : [-40, -60];
      const pt = (p) => `[${(p[0] / sw * FRAME_WIDTH).toFixed(3)}, ${(-p[1] / sh * FRAME_HEIGHT).toFixed(3)}, 0]`;
      lines.push(`${n}_l1 = Line(${pt(V)}, ${pt(P1)})`);
      lines.push(`${n}_l2 = Line(${pt(V)}, ${pt(P2)})`);
      const ctor = obj.rightAngle
        ? `RightAngle(${n}_l1, ${n}_l2)`
        : `Angle(${n}_l1, ${n}_l2, radius=${Number.isFinite(obj.radius) ? obj.radius : 0.6})`;
      const label = (obj.label || '').trim();
      if (label) {
        lines.push(`${n}_arc = ${ctor}`);
        lines.push(`${n} = VGroup(${n}_arc, ${n}_arc.get_tex("${safeLatex(label)}"))`);
      } else {
        lines.push(`${n} = ${ctor}`);
      }
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'line':
      lines.push(`${n} = Line(LEFT * ${(obj.width / 2 / sw * FRAME_WIDTH).toFixed(3)}, RIGHT * ${(obj.width / 2 / sw * FRAME_WIDTH).toFixed(3)})`);
      lines.push(`${n}.set_stroke(color=${hex(obj.stroke) || hex(obj.fill) || '"#FFFFFF"'}, width=${safeNum(obj.strokeWidth, 3)})`);
      break;
    case 'arrow': {
      const halfLen = (obj.width / 2 / sw * FRAME_WIDTH).toFixed(3);
      const tipLen = (FRAME_X_RADIUS / sw * FRAME_WIDTH).toFixed(3);
      lines.push(`${n} = Arrow(start=LEFT * ${halfLen}, end=RIGHT * ${halfLen}, color=${hex(obj.fill) || '"#EF4444"'}, buff=0, tip_length=${tipLen}, stroke_width=${sw2}, max_tip_length_to_length_ratio=0.15)`);
      break;
    }
    case 'text': {
      const fontFamily = obj.fontFamily || 'Roboto';
      lines.push(`# Font: ${fontFamily}`);
      lines.push(`${n} = Text("${safeText(obj.content)}", font_size=${safeNum(obj.fontSize, 48)}, color=${fill}, font="${fontFamily}")`);
      break;
    }
    case 'dot':
      lines.push(`${n} = Dot(radius=${(obj.width / 2 / sw * FRAME_X_RADIUS).toFixed(3)}, color=${fill})`);
      break;
    case 'dot_grid': {
      const c = safeNum(obj.gridCols, 5), r = safeNum(obj.gridRows, 5), sp = safeNum(obj.dotSpacing, 40) / sw * FRAME_WIDTH;
      lines.push(`${n} = VGroup(*[Dot(radius=0.06).move_to([c*${sp.toFixed(3)}-${((c - 1) * sp / 2).toFixed(3)}, r*${sp.toFixed(3)}-${((r - 1) * sp / 2).toFixed(3)}, 0]) for r in range(${r}) for c in range(${c})])`);
      if (hasFill)
        lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'image':
      lines.push(`${n} = ImageMobject("${obj.name || 'image'}.png").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
    case 'svg_asset':
      lines.push(`${n} = SVGMobject("${obj.name || 'asset'}.svg").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
    case 'latex': {
      // Escape for a normal Python string (NOT raw): a single backslash in the
      // LaTeX (e.g. \int) must survive as one backslash so MathTex typesets the
      // command. Doubling here + a raw r"..." would emit \\int (a LaTeX line
      // break) and render literal "int".
      const texStr = (obj.latex || 'E = mc^2').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
      lines.push(`${n} = MathTex("${texStr}", color=${fill})`);
      lines.push(`${n}.scale(${(scale * 2).toFixed(3)})`);
      break;
    }
    case 'axes': {
      const xr = obj.xRange || [-5, 5, 1];
      const yr = obj.yRange || [-3, 3, 1];
      lines.push(`${n} = Axes(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2] ?? 1}], x_length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)}, y_length=${(obj.height / sh * FRAME_HEIGHT).toFixed(1)}, tips=True)`);
      if (obj.graphs && obj.graphs.length > 0) {
        for (const g of obj.graphs) {
          const gn = `${n}_graph_${g.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          const col = hex(g.color) || '"#F59E0B"';
          const xMin = Number.isFinite(g.xMin) ? g.xMin : xr[0];
          const xMax = Number.isFinite(g.xMax) ? g.xMax : xr[1];
          lines.push(`${gn} = ${n}.plot(lambda x: ${safeMathExpr(g.expression)}, x_range=[${xMin}, ${xMax}], color=${col}, stroke_width=${g.strokeWidth || 3})`);
          lines.push(`${n}.add(${gn})`);
          if (g.area && g.area.enabled) {
            const an = `${gn}_area`;
            const axMin = Number.isFinite(g.area.xMin) ? g.area.xMin : xMin;
            const axMax = Number.isFinite(g.area.xMax) ? g.area.xMax : xMax;
            const acol = hex(g.area.color) || col;
            const aop = Number.isFinite(g.area.opacity) ? g.area.opacity : 0.5;
            lines.push(`${an} = ${n}.get_area(${gn}, x_range=[${axMin}, ${axMax}], color=${acol}, opacity=${aop})`);
            lines.push(`${n}.add(${an})`);
          }
          if (g.riemann && g.riemann.enabled) {
            const rn = `${gn}_riemann`;
            const rxMin = Number.isFinite(g.riemann.xMin) ? g.riemann.xMin : xMin;
            const rxMax = Number.isFinite(g.riemann.xMax) ? g.riemann.xMax : xMax;
            const rdx = (Number.isFinite(g.riemann.dx) && g.riemann.dx > 0) ? g.riemann.dx : ((rxMax - rxMin) / 10);
            const rtype = ['left', 'right', 'center'].includes(g.riemann.type) ? g.riemann.type : 'left';
            const rcol = hex(g.riemann.color) || col;
            lines.push(`${rn} = ${n}.get_riemann_rectangles(${gn}, x_range=[${rxMin}, ${rxMax}], dx=${rdx}, input_sample_type="${rtype}", color=${rcol})`);
            lines.push(`${n}.add(${rn})`);
          }
        }
      }
      break;
    }
    case 'numberplane': {
      const xr = obj.xRange || [-5, 5, 1];
      const yr = obj.yRange || [-3, 3, 1];
      const xs = obj.xStep || 1;
      const ys = obj.yStep || 1;
      lines.push(`${n} = NumberPlane(x_range=[${xr[0]}, ${xr[1]}, ${xs}], y_range=[${yr[0]}, ${yr[1]}, ${ys}], x_length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)}, y_length=${(obj.height / sh * FRAME_HEIGHT).toFixed(1)})`);
      break;
    }
    case 'numberline': {
      const xr = obj.xRange || [-5, 5, 1];
      lines.push(`${n} = NumberLine(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)})`);
      break;
    }
    default:
      lines.push(`${n} = Circle(radius=0.5)  # ${obj.type}`);
  }
  const rc = roundCornersLine(n, obj, sw);
  if (rc) lines.push(rc);
  const gl = gradientLine(n, obj);
  if (gl && GRADIENT_TYPES.has(obj.type)) lines.push(gl);
  for (const dl of dashedLines(n, obj)) lines.push(dl);
  for (const sl of shadowLines(n, obj, sw, sh)) lines.push(sl);
  lines.push(`${n}.move_to([${mp.x.toFixed(3)}, ${mp.y.toFixed(3)}, 0])`);
  if (obj.rotation) lines.push(`${n}.rotate(${(obj.rotation * Math.PI / 180).toFixed(4)})`);
  return lines;
}

// ── Keyframe helpers ───────────────────────────────────────────────────────

function _kfPropSet(n, prop, value, sw, sh) {
  const MANIM_W = FRAME_WIDTH, MANIM_H = FRAME_HEIGHT;
  switch (prop) {
    case 'x': {
      const mx = ((value / sw) - 0.5) * MANIM_W;
      return `${n}.animate.set_x(${mx.toFixed(4)})`;
    }
    case 'y': {
      const my = (0.5 - value / sh) * MANIM_H;
      return `${n}.animate.set_y(${my.toFixed(4)})`;
    }
    case 'opacity': return `${n}.animate.set_opacity(${Math.max(0, Math.min(1, value)).toFixed(4)})`;
    case 'rotation': return `${n}.animate.rotate(${(value * Math.PI / 180).toFixed(4)})`;
    case 'scaleX': return `${n}.animate.stretch_to_fit_width(${value.toFixed(4)})`;
    case 'scaleY': return `${n}.animate.stretch_to_fit_height(${value.toFixed(4)})`;
    // x3d/y3d/z3d are never routed here — 3D position is always combined into a
    // single move_to by generateKeyframeSteps (a per-axis move_to would zero the
    // other two axes). See the "Combine simultaneous x3d/y3d/z3d" block below.
    case 'rx':  return `${n}.animate.rotate(${(value * Math.PI / 180).toFixed(4)}, axis=RIGHT)`;
    case 'ry':  return `${n}.animate.rotate(${(value * Math.PI / 180).toFixed(4)}, axis=UP)`;
    case 'rz':  return `${n}.animate.rotate(${(value * Math.PI / 180).toFixed(4)}, axis=OUT)`;
    default: return null;
  }
}

function _kfUpdater(prop) {
  switch (prop) {
    case 'x':       return 'set_x';
    case 'y':       return 'set_y';
    case 'opacity': return 'set_opacity';
    default:        return null;
  }
}

// Convert a raw keyframe value (stage pixels for x/y) into the Manim-space value
// the setter expects. UpdateFromAlphaFunc/ValueTracker feed the setter directly.
function _kfValue(prop, value, sw, sh) {
  switch (prop) {
    case 'x':       return ((value / sw) - 0.5) * FRAME_WIDTH;
    case 'y':       return (0.5 - value / sh) * FRAME_HEIGHT;
    case 'opacity': return Math.max(0, Math.min(1, value));
    default:        return value;
  }
}

function generateKeyframeSteps(project, steps, sw, sh) {
  if (!project.objects) return;
  for (const obj of project.objects) {
    if (!obj.keyframes || Object.keys(obj.keyframes).length === 0) continue;
    const n = v(obj.id);
    const defaults = project.keyframeDefaults || {};

    // ── Combine simultaneous x3d/y3d/z3d keyframes into single move_to ──
    // 3D position can only be expressed via move_to, so any keyframed x3d/y3d/z3d
    // is folded in here regardless of its per-prop codegenMode. ValueTracker /
    // UpdateFromAlphaFunc have no 3D setter and would otherwise drop them silently.
    const pos3DProps = ['x3d', 'y3d', 'z3d'];
    const hasPos3D = pos3DProps.some(p => {
      const kfs = obj.keyframes?.[p];
      return kfs && kfs.length >= 2;
    });

    if (hasPos3D) {
      const pos3DKeyframes = {};
      for (const p of pos3DProps) {
        const kfs = obj.keyframes?.[p];
        if (!kfs || kfs.length < 2) continue;
        pos3DKeyframes[p] = [...kfs].sort((a, b) => a.time - b.time);
      }

      // Collect all unique time points across active 3D props
      const allTimes = new Set();
      for (const kfs of Object.values(pos3DKeyframes)) {
        kfs.forEach(kf => allTimes.add(kf.time));
      }
      const sortedTimes = [...allTimes].sort((a, b) => a - b);

      // "last known value at or before time t" helper
      const getVal = (kfs, t) => {
        if (!kfs || kfs.length === 0) return null;
        const last = kfs.filter(k => k.time <= t).pop();
        return last ? last.value : kfs[0].value;
      };

      // Emit one move_to per [t1, t2] segment
      for (let i = 0; i < sortedTimes.length - 1; i++) {
        const t1 = sortedTimes[i], t2 = sortedTimes[i + 1];
        const dur = parseFloat((t2 - t1).toFixed(2));
        const tx = getVal(pos3DKeyframes['x3d'], t2) ?? (obj.x3d ?? 0);
        const ty = getVal(pos3DKeyframes['y3d'], t2) ?? (obj.y3d ?? 0);
        const tz = getVal(pos3DKeyframes['z3d'], t2) ?? (obj.z3d ?? 0);
        const rt = rtOpt(dur);
        steps.push({
          time: t1,
          order: 0.5,
          code: `self.play(${n}.animate.move_to([${tx.toFixed(3)}, ${ty.toFixed(3)}, ${tz.toFixed(3)}])${rt})`,
          dur,
        });
      }
    }

    for (const [prop, keyframes] of Object.entries(obj.keyframes)) {
      // 3D coordinate props are always merged into a single move_to above
      if (pos3DProps.includes(prop)) continue;
      if (!keyframes || keyframes.length < 2) continue;
      const sorted = [...keyframes].sort((a, b) => a.time - b.time);
      const codegenMode = (obj.keyframeCodegen && obj.keyframeCodegen[prop]) ||
        defaults.codegenMode || 'UpdateFromAlphaFunc';

      if (codegenMode === 'animate') {
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i], k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const val = _kfPropSet(n, prop, k2.value, sw, sh);
          if (!val) continue;
          const rt = rtOpt(dur);
          steps.push({ time: k1.time, order: 0.5, code: `self.play(${val}${rt})`, dur });
        }
      } else if (codegenMode === 'ValueTracker') {
        const safeProp = prop.replace(/[^a-zA-Z0-9_]/g, '_');
        const vtSetter = _kfUpdater(prop);
        if (!vtSetter) continue;
        const trackVar = `_vt_${n}_${safeProp}`;
        const initVal = _kfValue(prop, sorted[0].value, sw, sh);
        let block = `${trackVar} = ValueTracker(${(+initVal).toFixed(4)})\n`;
        block += `${n}.add_updater(lambda m: m.${vtSetter}(${trackVar}.get_value()))\n`;
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i], k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const rt = rtOpt(dur);
          block += `self.play(${trackVar}.animate.set_value(${_kfValue(prop, k2.value, sw, sh).toFixed(4)})${rt})\n`;
        }
        block += `${n}.clear_updaters()`;
        steps.push({ time: sorted[0].time, order: 0.5, code: block, dur: sorted[sorted.length - 1].time - sorted[0].time });
      } else {
        // UpdateFromAlphaFunc (default)
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i], k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const safeProp = prop.replace(/[^a-zA-Z0-9_]/g, '_');
          const kfVar = `_kf_${n}_${safeProp}_${i}`;
          const setter = _kfUpdater(prop);
          if (!setter) continue;
          const rt = rtOpt(dur);
          const v0 = _kfValue(prop, k1.value, sw, sh).toFixed(4), v1 = _kfValue(prop, k2.value, sw, sh).toFixed(4);
          const t0 = k1.time.toFixed(4);
          const block =
            `def ${kfVar}_fn(mob, alpha):\n` +
            `    t = ${t0} + alpha * ${dur.toFixed(4)}\n` +
            `    v = ${v0} + (${v1} - ${v0}) * max(0, min(1, (t - ${t0}) / ${dur.toFixed(4)}))\n` +
            `    mob.${setter}(v)\n` +
            `self.play(UpdateFromAlphaFunc(${n}, ${kfVar}_fn, run_time=${dur.toFixed(1)}, rate_func=linear))`;
          steps.push({ time: k1.time, order: 0.5, code: block, dur });
        }
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CODEGEN: project → Manim Python
// ═════════════════════════════════════════════════════════════════════════════

export function generateManimScript(project) {
  const L = [], sw = project.stage.width, sh = project.stage.height;

  // Collect unique Google Fonts used by text objects
  const usedFonts = new Set();
  for (const obj of (project.objects || [])) {
    if (obj.type === 'text' && obj.fontFamily) {
      const font = obj.fontFamily;
      if (font && !isSystemFont(font)) {
        usedFonts.add(font);
      }
    }
  }
  const fontsArray = Array.from(usedFonts);

  // Header
  L.push('"""');
  L.push(`Manim Studio – ${project.name}`);
  L.push('Run:  manim -qh scene.py MainScene');
  L.push('"""');
  L.push('');
  L.push('from manim import *');
  L.push('import numpy as np');
  if (fontsArray.length > 0) {
    L.push('from manim_fonts import RegisterFont');
  }

  const allClips = (project.tracks || []).flatMap(t => t.clips || []);
  const hasReadyAudio = allClips.some(c => c.audio && c.audio.status === 'ready' && c.audio.src);

  if (hasReadyAudio) {
    L.push('from manim_voiceover import VoiceoverScene');
    L.push('from manim_voiceover.services.gtts import GTTSService');
  }

  const is3D = project.sceneType === '3d';
  if (is3D) {
    L.push('from manim.mobject.three_d.three_dimensions import Sphere, Cube, Cone, Cylinder, Torus');
    L.push('from manim import ThreeDAxes, ThreeDScene');
  }

  L.push('');
  L.push('');

  let sceneBase;
  if (is3D) {
    sceneBase = hasReadyAudio ? 'ThreeDScene, VoiceoverScene' : 'ThreeDScene';
  } else if (project.cameraType === 'moving') {
    sceneBase = 'MovingCameraScene';
  } else if (hasReadyAudio) {
    sceneBase = 'VoiceoverScene';
  } else {
    sceneBase = 'Scene';
  }

  L.push(`class MainScene(${sceneBase}):`);
  L.push('    def construct(self):');
  const bgColor = hex(project.stage.backgroundColor) || '"#000000"';
  L.push(`        self.camera.background_color = ${bgColor}`);
  if (hasReadyAudio) {
    L.push('        self.set_speech_service(GTTSService())');
  }
  if (is3D) {
    const cam = project.camera3d ?? { phi: 75, theta: -45, zoom: 1.0 };
    L.push(`        self.set_camera_orientation(`);
    L.push(`            phi=${cam.phi} * DEGREES,`);
    L.push(`            theta=${cam.theta} * DEGREES,`);
    L.push(`            zoom=${(cam.zoom ?? 1.0).toFixed(2)}`);
    L.push(`        )`);
  }
  L.push('');

  if (project.objects.length === 0 && !(Array.isArray(project.cameraTrack) && project.cameraTrack.length > 0)) {
    L.push('        self.wait(1)');
    return L.join('\n');
  }

  // Generate font registration and scene content
  let indent = '        ';
  if (fontsArray.length > 0) {
    L.push(`${indent}# Register Google Fonts`);
    for (let i = 0; i < fontsArray.length; i++) {
      const font = fontsArray[i];
      const varName = `fonts_${i}`;
      L.push(`${indent}with RegisterFont("${font}") as ${varName}:`);
      indent += '    ';
    }
    L.push('');
  }

  // ── Object definitions ──
  const obj3DTypes = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
  const oMap = {};
  L.push(`${indent}# Objects`);
  for (const o of project.objects) {
    oMap[o.id] = o;
    if (obj3DTypes.includes(o.type)) {
      objectCode3d(o).forEach(l => L.push(indent + l));
    } else {
      objCode(o, sw, sh).forEach(l => L.push(indent + l));
    }
    L.push('');
  }

  // ── Groups ──
  const groups = project.groups || [];
  if (groups.length > 0) {
    L.push(`${indent}# Groups`);
    for (const g of groups) {
      if (!g.childIds || g.childIds.length === 0) continue;
      const childVars = g.childIds.map(id => v(id)).filter(Boolean).join(', ');
      const gn = v(g.id);
      L.push(`${indent}${gn} = VGroup(${childVars})`);
    }
    L.push('');
  }

  // ── Collect clips ──
  const clips = [];
  for (const t of project.tracks) for (const c of t.clips) clips.push(c);
  clips.sort((a, b) => a.startTime - b.startTime);

  // ── Determine transform relationships ──
  const transformSources = new Set();
  const transformTargets = new Set();
  for (const c of clips) {
    if (c.type === 'transform') {
      transformSources.add(c.sourceId);
      if (c.targetId) transformTargets.add(c.targetId);
    }
  }

  // ── Build animation steps ──
  const steps = [];

  // Enter: skip objects that are transform targets
  for (const o of project.objects) {
    if (transformTargets.has(o.id)) continue;
    const t = o.enterTime || 0;
    const n = v(o.id);
    const dur = o.enterAnimDur || 0.5;
    const rt = rtOpt(dur);
    const enterAnim = o.enterAnim || 'fade_in';

    let enterCode;
    switch (enterAnim) {
      case 'none':
        enterCode = `self.add(${n})`;
        break;
      case 'fade_in':
        enterCode = `self.play(FadeIn(${n})${rt})`;
        break;
      case 'grow_in':
        enterCode = `self.play(GrowFromCenter(${n})${rt})`;
        break;
      case 'fly_in_left':
        enterCode = `self.play(FadeIn(${n}, shift=RIGHT)${rt})`;
        break;
      case 'fly_in_right':
        enterCode = `self.play(FadeIn(${n}, shift=LEFT)${rt})`;
        break;
      case 'fly_in_top':
        enterCode = `self.play(FadeIn(${n}, shift=DOWN)${rt})`;
        break;
      case 'fly_in_bottom':
        enterCode = `self.play(FadeIn(${n}, shift=UP)${rt})`;
        break;
      case 'draw':
        enterCode = `self.play(Create(${n})${rt})`;
        break;
      case 'write':
        enterCode = `self.play(Write(${n})${rt})`;
        break;
      case 'spin_in':
        enterCode = `self.play(SpinInFromNothing(${n})${rt})`;
        break;
      case 'bounce_in':
        enterCode = `self.play(GrowFromCenter(${n}, rate_func=rate_functions.ease_out_bounce)${rt})`;
        break;
      default:
        enterCode = `self.play(FadeIn(${n})${rt})`;
    }
    steps.push({ time: t, order: 0, code: enterCode, dur: enterAnim === 'none' ? 0 : dur });
  }

  // ── Group parallel clips ──
  const clipGroups = [];
  let gi = 0;
  while (gi < clips.length) {
    const c = clips[gi];
    if (c.parallel) {
      const group = [c];
      let j = gi + 1;
      while (j < clips.length && clips[j].parallel && Math.abs(clips[j].startTime - c.startTime) < 0.01) {
        group.push(clips[j]);
        j++;
      }
      clipGroups.push({ type: 'group', clips: group, startTime: c.startTime });
      gi = j;
    } else {
      clipGroups.push({ type: 'single', clip: c, startTime: c.startTime });
      gi++;
    }
  }

  // ── Build clip animation steps ──
  function singleClipCode(c) {
    const objId = c.sourceId ?? c.objectId;
    const sn = v(objId);
    const dur = c.duration;
    const rtStr = rtOpt(dur);
    const rfStr = rfOpt(c.easing);
    switch (c.type) {
      case 'transform': {
        const tn = v(c.targetId);
        const srcObj = oMap[c.sourceId], tgtObj = oMap[c.targetId];
        const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
        const anim = hasRaster ? 'FadeTransform' : 'ReplacementTransform';
        return { code: `self.play(${anim}(${sn}, ${tn})${rtStr}${rfStr})`, dur };
      }
      case 'move': {
        const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
        return { code: `self.play(${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])${rtStr}${rfStr})`, dur };
      }
      case 'scale':
        return { code: `self.play(${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})${rtStr}${rfStr})`, dur };
      case 'fade': {
        const op = c.params?.targetOpacity ?? 0;
        return { code: op < 0.01 ? `self.play(FadeOut(${sn})${rtStr}${rfStr})` : `self.play(${sn}.animate.set_opacity(${op.toFixed(2)})${rtStr}${rfStr})`, dur };
      }
      case 'rotate': {
        const obj = oMap[objId];
        if (is3D && obj && obj3DTypes.includes(obj.type)) {
          const axisMap = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
          const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
          const angleRad = ((c.angle ?? 90) * Math.PI / 180).toFixed(4);
          return { code: `self.play(Rotate(${sn}, angle=${angleRad}, axis=${axis})${rtStr}${rfStr})`, dur };
        }
        const ang = ((c.params?.targetRotation || 360) - (oMap[objId]?.rotation || 0)) * Math.PI / 180;
        return { code: `self.play(Rotate(${sn}, angle=${ang.toFixed(2)})${rtStr}${rfStr})`, dur };
      }
      case 'path_move': {
        if (!c.path || c.path.length < 2) return null;
        const cn = (c.id || sn).replace(/[^a-zA-Z0-9_]/g, '_');
        const pn = `path_${cn}`;
        const ptsStr = pathPointsPy(c.path, sw, sh);
        const multiLine = [
          `${pn} = VMobject()`,
          `${pn}.set_points_as_corners([np.array(p) for p in [${ptsStr}]])`,
          `self.play(MoveAlongPath(${sn}, ${pn})${rtStr}${rfStr})`,
        ].join(`\n${indent}`);
        return { code: multiLine, dur };
      }
      case 'indicate':
      case 'flash':
      case 'wiggle':
      case 'circumscribe':
      case 'focus_on': {
        const e = emphasisExpr(c, sn);
        return e ? { code: `self.play(${e}${rtStr}${rfStr})`, dur } : null;
      }
      default: return null;
    }
  }

  function animExpr(c) {
    const objId = c.sourceId ?? c.objectId;
    const sn = v(objId);
    switch (c.type) {
      case 'move': {
        const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
        return `${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])`;
      }
      case 'scale':
        return `${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})`;
      case 'fade': {
        const op = c.params?.targetOpacity ?? 0;
        return op < 0.01 ? `FadeOut(${sn})` : `${sn}.animate.set_opacity(${op.toFixed(2)})`;
      }
      case 'rotate': {
        const obj = oMap[objId];
        if (is3D && obj && obj3DTypes.includes(obj.type)) {
          const axisMap = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
          const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
          const angleRad = ((c.angle ?? 90) * Math.PI / 180).toFixed(4);
          return `Rotate(${sn}, angle=${angleRad}, axis=${axis})`;
        }
        const ang = ((c.params?.targetRotation || 360) - (oMap[objId]?.rotation || 0)) * Math.PI / 180;
        return `Rotate(${sn}, angle=${ang.toFixed(2)})`;
      }
      case 'transform': {
        const tn = v(c.targetId);
        const srcObj = oMap[c.sourceId], tgtObj = oMap[c.targetId];
        const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
        return hasRaster ? `FadeTransform(${sn}, ${tn})` : `ReplacementTransform(${sn}, ${tn})`;
      }
      case 'indicate':
      case 'flash':
      case 'wiggle':
      case 'circumscribe':
      case 'focus_on':
        return emphasisExpr(c, sn);
      default: return null;
    }
  }

  for (const cg of clipGroups) {
    if (cg.type === 'single') {
      const result = singleClipCode(cg.clip);
      if (result) steps.push({ time: cg.clip.startTime, order: 1, ...result, audio: cg.clip.audio, _clipId: cg.clip.id });
    } else if (cg.clips.length === 1) {
      const result = singleClipCode(cg.clips[0]);
      if (result) steps.push({ time: cg.startTime, order: 1, ...result, audio: cg.clips[0].audio, _clipId: cg.clips[0].id });
    } else {
      const groupClips = cg.clips;
      const dur = Math.max(...groupClips.map(c => c.duration));
      const rtStr = rtOpt(dur);
      const maxLag = Math.max(...groupClips.map(c => c.lag_ratio || 0));
      const exprs = groupClips.map(animExpr).filter(Boolean);
      if (exprs.length > 0) {
        const groupFn = maxLag > 0 ? 'LaggedStart' : 'AnimationGroup';
        const lagStr = maxLag > 0 ? `, lag_ratio=${maxLag.toFixed(2)}` : '';
        const rfStr = rfOpt(groupClips[0]?.easing || 'ease_in_out');
        steps.push({ time: cg.startTime, order: 1, code: `self.play(${groupFn}(${exprs.join(', ')}${lagStr})${rtStr}${rfStr})`, dur });
      }
    }
  }

  // ── Keyframe steps ──
  generateKeyframeSteps(project, steps, sw, sh);

  // ── Camera clips ──
  if (Array.isArray(project.cameraTrack) && project.cameraTrack.length > 0) {
    for (const camClip of project.cameraTrack) {
      if (camClip.type !== 'camera_move') continue;
      const dur = camClip.duration ?? 1;
      const rtStr = rtOpt(dur);
      const rfStr = rfOpt(camClip.easing);

      let code;
      if (is3D) {
        const p = camClip.params || {};
        const phi = p.phi ?? project.camera3d?.phi ?? 75;
        const theta = p.theta ?? project.camera3d?.theta ?? -45;
        const zoom = p.zoom ?? 1.0;
        code = `self.move_camera(phi=${phi} * DEGREES, theta=${theta} * DEGREES, zoom=${zoom.toFixed(2)}, run_time=${dur})`;
      } else if (project.cameraType === 'moving') {
        const mp = stageToManim(
          camClip.params?.targetX || 0,
          camClip.params?.targetY || 0,
          sw, sh
        );
        const zoom = parseFloat((camClip.params?.zoom || 1).toFixed(4));
        const frameWidth = (FRAME_WIDTH / zoom).toFixed(3);
        code = `self.play(self.camera.frame.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0]).set_width(${frameWidth})${rtStr}${rfStr})`;
      } else {
        continue;
      }

      steps.push({
        time: camClip.startTime,
        order: 1,
        code,
        dur,
      });
    }
  }

  // Exit: skip objects that are transform sources
  for (const o of project.objects) {
    if (transformSources.has(o.id)) continue;
    let exitTime = (o.enterTime || 0) + (o.duration || 3);
    for (const c of clips) {
      const end = c.startTime + c.duration;
      if ((c.sourceId === o.id || c.targetId === o.id) && end > exitTime) exitTime = end + 0.1;
    }
    const n = v(o.id);
    const exitAnim = o.exitAnim || 'none';
    const dur = o.exitAnimDur || 0.5;
    const rt = rtOpt(dur);

    let exitCode;
    switch (exitAnim) {
      case 'none':
        continue; // Skip entirely
      case 'fade_out':
        exitCode = `self.play(FadeOut(${n})${rt})`;
        break;
      case 'shrink_out':
        exitCode = `self.play(ShrinkToCenter(${n})${rt})`;
        break;
      case 'fly_out_left':
        exitCode = `self.play(FadeOut(${n}, shift=LEFT)${rt})`;
        break;
      case 'fly_out_right':
        exitCode = `self.play(FadeOut(${n}, shift=RIGHT)${rt})`;
        break;
      case 'fly_out_top':
        exitCode = `self.play(FadeOut(${n}, shift=UP)${rt})`;
        break;
      case 'fly_out_bottom':
        exitCode = `self.play(FadeOut(${n}, shift=DOWN)${rt})`;
        break;
      case 'uncreate':
        exitCode = `self.play(Uncreate(${n})${rt})`;
        break;
      case 'spin_out':
        exitCode = `self.play(FadeOut(${n}, shift=OUT, scale=0.5)${rt})`;
        break;
      default:
        exitCode = `self.play(FadeOut(${n})${rt})`;
    }
    steps.push({ time: exitTime, order: 2, code: exitCode, dur });
  }

  // Sort: by time, then enter → clip → exit
  steps.sort((a, b) => a.time - b.time || a.order - b.order);

  // ── Emit animation code ──
  L.push(`${indent}# Animation`);
  let t = 0;
  for (const step of steps) {
    const wait = step.time - t;
    if (wait > 0.05) L.push(`${indent}self.wait(${wait.toFixed(1)})`);
    const a = step.audio;
    if (a && a.status === 'ready' && a.src) {
      const trackerId = step._clipId
        ? `tracker_${step._clipId.replace(/[^a-zA-Z0-9]/g, '_')}`
        : `tracker_${steps.indexOf(step)}`;
      L.push(`${indent}with self.voiceover(audio="${a.src}") as ${trackerId}:`);
      if (a.syncMode === 'manual' && a.offset > 0) {
        L.push(`${indent}    self.wait(${parseFloat(a.offset).toFixed(1)})`);
      }
      const innerLines = step.code.split('\n');
      for (const line of innerLines) {
        L.push(`${indent}    ${line.trim()}`);
      }
      if (a.syncMode === 'auto') {
        const dur = parseFloat(step.dur || 1).toFixed(1);
        L.push(`${indent}    self.wait(max(0, ${trackerId}.duration - ${dur}))`);
      }
    } else {
      // step.code may be a multi-line block (e.g. UpdateFromAlphaFunc def +
      // self.play). Indent every line to the construct body, preserving the
      // block's own relative indentation.
      for (const line of step.code.split('\n')) {
        L.push(line ? `${indent}${line}` : '');
      }
    }
    t = step.time + (step.dur || 0.5);
  }

  L.push('');
  L.push(`${indent}self.wait(1)`);
  return L.join('\n');
}

// ═════════════════════════════════════════════════════════════════════════════
// PARSER: Manim Python → project JSON
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Parse Manim Python code back into project objects, tracks, and stage.
 */
export function parseManimScript(code, sw = 1920, sh = 1080) {
  const lines = code.split('\n').map(l => l.trim());
  const objects = [];
  const clips   = [];
  const varMap  = {};
  const objById = {};
  const graphVarMap = {};
  const relLineMap = {};   // <var> → { start: [mx, my], end: [mx, my] } for angle helper Lines
  const pendingShadow = {};   // base var → { color, opacity, dx, dy } awaiting its VGroup line

  let bgColor = '#000000';
  let cameraType = 'static';
  let sceneType = '2d';
  const cameraTrack = [];
  let ct = 0;
  let clipIdx = 0;
  let objIdx  = 0;

  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${(objIdx++).toString(36)}`;

  const pendingPaths = {};  // varName → [{ mx, my, mz }]

  function parseAnimExpr(expr) {
    expr = expr.trim();
    let m2;
    // obj.animate.move_to([x, y, 0])
    m2 = expr.match(/^(\w+)\.animate\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*0\]\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      const sp = manimToStage(parseFloat(m2[2]), parseFloat(m2[3]), sw, sh);
      return { type: 'move', sourceId: id, params: { targetX: Math.round(sp.x), targetY: Math.round(sp.y) } };
    }
    // obj.animate.scale(s)
    m2 = expr.match(/^(\w+)\.animate\.scale\(([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return { type: 'scale', sourceId: id, params: { targetScaleX: parseFloat(m2[2]), targetScaleY: parseFloat(m2[2]) } };
    }
    // obj.animate.set_opacity(o)
    m2 = expr.match(/^(\w+)\.animate\.set_opacity\(([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return { type: 'fade', sourceId: id, params: { targetOpacity: parseFloat(m2[2]) } };
    }
    // FadeOut(obj)
    m2 = expr.match(/^FadeOut\((\w+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return { type: 'fade', sourceId: id, params: { targetOpacity: 0 } };
    }
    // Rotate(obj, angle=a)
    m2 = expr.match(/^Rotate\((\w+),\s*angle=([-\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return { type: 'rotate', sourceId: id, params: { targetRotation: Math.round(parseFloat(m2[2]) * 180 / Math.PI) } };
    }
    // Indicate(obj, color="#hex", scale_factor=f)
    m2 = expr.match(/^Indicate\((\w+),\s*color="([^"]+)",\s*scale_factor=([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'indicate', sourceId: id, params: { color: m2[2], scale_factor: parseFloat(m2[3]) } };
    }
    // Flash(obj, color=, flash_radius=, line_length=, num_lines=)
    m2 = expr.match(/^Flash\((\w+),\s*color="([^"]+)",\s*flash_radius=([\d.]+),\s*line_length=([\d.]+),\s*num_lines=(\d+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'flash', sourceId: id, params: { color: m2[2], flash_radius: parseFloat(m2[3]), line_length: parseFloat(m2[4]), num_lines: parseInt(m2[5], 10) } };
    }
    // Wiggle(obj, scale_value=, rotation_angle=d * DEGREES, n_wiggles=)
    m2 = expr.match(/^Wiggle\((\w+),\s*scale_value=([\d.]+),\s*rotation_angle=([\d.]+) \* DEGREES,\s*n_wiggles=(\d+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'wiggle', sourceId: id, params: { scale_value: parseFloat(m2[2]), rotation_angle: parseFloat(m2[3]), n_wiggles: parseInt(m2[4], 10) } };
    }
    // Circumscribe(obj, color=, shape=Class, fade_out=Bool, time_width=)
    m2 = expr.match(/^Circumscribe\((\w+),\s*color="([^"]+)",\s*shape=(Rectangle|Circle),\s*fade_out=(True|False),\s*time_width=([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'circumscribe', sourceId: id, params: { color: m2[2], shape: m2[3], fade_out: m2[4] === 'True', time_width: parseFloat(m2[5]) } };
    }
    // FocusOn(obj, color=, opacity=)
    m2 = expr.match(/^FocusOn\((\w+),\s*color="([^"]+)",\s*opacity=([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]]; if (!id) return null;
      return { type: 'focus_on', sourceId: id, params: { color: m2[2], opacity: parseFloat(m2[3]) } };
    }
    return null;
  }

  for (const line of lines) {
    let m;

    // MovingCameraScene
    m = line.match(/^class\s+\w+\(MovingCameraScene\)/);
    if (m) { cameraType = 'moving'; continue; }

    // ThreeDScene → 3D sahne
    m = line.match(/^class\s+\w+\(ThreeDScene/);
    if (m) { sceneType = '3d'; continue; }

    // Background
    m = line.match(/self\.camera\.background_color\s*=\s*["']([^"']+)["']/);
    if (m) { bgColor = m[1]; continue; }

    // Square
    m = line.match(/^(\w+)\s*=\s*Square\(side_length=([\d.]+)\)/);
    if (m) {
      const [, name, sl] = m;
      const size = Math.round(parseFloat(sl) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'square', name, x: sw / 2, y: sh / 2, width: size, height: size, fill: '#ffffff', stroke: 'transparent', strokeWidth: 2, opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // RoundedRectangle (rectangle/square with cornerRadius)
    m = line.match(/^(\w+)\s*=\s*RoundedRectangle\(corner_radius=([\d.]+),\s*width=([\d.]+),\s*height=([\d.]+)\)/);
    if (m) {
      const [, name, cr, w, h] = m;
      const width = Math.round(parseFloat(w) / FRAME_WIDTH * sw);
      const height = Math.round(parseFloat(h) / FRAME_HEIGHT * sh);
      const type = Math.abs(parseFloat(w) - parseFloat(h)) < 0.01 ? 'square' : 'rectangle';
      const id = uid('obj');
      const obj = { id, type, name, x: sw / 2, y: sh / 2, width, height,
        cornerRadius: Math.round(parseFloat(cr) / FRAME_WIDTH * sw),
        fill: '#ffffff', stroke: 'transparent', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Rectangle
    m = line.match(/^(\w+)\s*=\s*Rectangle\(width=([\d.]+),\s*height=([\d.]+)\)/);
    if (m) {
      const [, name, w, h] = m;
      const id = uid('obj');
      const obj = { id, type: 'rectangle', name, x: sw / 2, y: sh / 2, width: Math.round(parseFloat(w) / FRAME_WIDTH * sw), height: Math.round(parseFloat(h) / FRAME_HEIGHT * sh), fill: '#ffffff', stroke: 'transparent', strokeWidth: 2, opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Circle
    m = line.match(/^(\w+)\s*=\s*Circle\(radius=([\d.]+)\)/);
    if (m) {
      const [, name, r] = m;
      const size = Math.round(parseFloat(r) * 2 / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'circle', name, x: sw / 2, y: sh / 2, width: size, height: size, fill: '#ffffff', stroke: 'transparent', strokeWidth: 2, opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Annulus
    m = line.match(/^(\w+)\s*=\s*Annulus\(inner_radius=([\d.]+),\s*outer_radius=([\d.]+)\)/);
    if (m) {
      const [, name, ri, ro] = m;
      const innerRadius = Math.round(parseFloat(ri) / FRAME_WIDTH * sw);
      const outerRadius = Math.round(parseFloat(ro) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'annulus', name, x: sw / 2, y: sh / 2, width: outerRadius * 2, height: outerRadius * 2,
        innerRadius, outerRadius, fill: '#14b8a6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Arc
    m = line.match(/^(\w+)\s*=\s*Arc\(radius=([\d.]+),\s*start_angle=([-\d.]+) \* DEGREES,\s*angle=([-\d.]+) \* DEGREES\)/);
    if (m) {
      const [, name, r, a0, sw_] = m;
      const radius = Math.round(parseFloat(r) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'arc', name, x: sw / 2, y: sh / 2, width: radius * 2, height: radius * 2,
        radius, startAngle: parseFloat(a0), sweepAngle: parseFloat(sw_),
        fill: 'transparent', stroke: '#f97316', strokeWidth: 4, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Sector
    m = line.match(/^(\w+)\s*=\s*Sector\(radius=([\d.]+),\s*start_angle=([-\d.]+) \* DEGREES,\s*angle=([-\d.]+) \* DEGREES\)/);
    if (m) {
      const [, name, r, a0, sw_] = m;
      const radius = Math.round(parseFloat(r) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'sector', name, x: sw / 2, y: sh / 2, width: radius * 2, height: radius * 2,
        radius, startAngle: parseFloat(a0), sweepAngle: parseFloat(sw_),
        fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // DoubleArrow
    m = line.match(/^(\w+)\s*=\s*DoubleArrow\(start=LEFT \* ([\d.]+), end=RIGHT \* ([\d.]+), color=["']([^"']+)["']/);
    if (m) {
      const [, name, half, , color] = m;
      const width = Math.round(parseFloat(half) * 2 / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'double_arrow', name, x: sw / 2, y: sh / 2, width, height: 40,
        fill: color, stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Ellipse
    m = line.match(/^(\w+)\s*=\s*Ellipse\(width=([\d.]+),\s*height=([\d.]+)\)/);
    if (m) {
      const [, name, w, h] = m;
      const id = uid('obj');
      const obj = { id, type: 'ellipse', name, x: sw / 2, y: sh / 2, width: Math.round(parseFloat(w) / FRAME_WIDTH * sw), height: Math.round(parseFloat(h) / FRAME_HEIGHT * sh), fill: '#ffffff', stroke: 'transparent', strokeWidth: 2, opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Triangle
    m = line.match(/^(\w+)\s*=\s*Triangle\(\)\.scale\(([\d.]+)\)/);
    if (m) {
      const [, name, sc] = m;
      const size = Math.round(parseFloat(sc) / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'triangle', name, x: sw / 2, y: sh / 2, width: size, height: size, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Star
    m = line.match(/^(\w+)\s*=\s*Star\(n=(\d+),\s*outer_radius=([\d.]+),\s*inner_radius=([\d.]+)\)/);
    if (m) {
      const [, name, arms, outerR, innerR] = m;
      const size = Math.round(parseFloat(outerR) * 2 / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'star', name, x: sw / 2, y: sh / 2, width: size, height: size, starArms: parseInt(arms), innerRatio: parseFloat(innerR) / parseFloat(outerR), fill: '#eab308', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // RegularPolygon
    m = line.match(/^(\w+)\s*=\s*RegularPolygon\(n=(\d+)\)\.scale\(([\d.]+)\)/);
    if (m) {
      const [, name, sides, sc] = m;
      const size = Math.round(parseFloat(sc) * 2 / FRAME_WIDTH * sw);
      const id = uid('obj');
      const obj = { id, type: 'polygon', name, x: sw / 2, y: sh / 2, width: size, height: size, sides: parseInt(sides), fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Polygon (free-vertex)
    m = line.match(/^(\w+)\s*=\s*Polygon\((\[[-\d.]+,\s*[-\d.]+,\s*0\](?:,\s*\[[-\d.]+,\s*[-\d.]+,\s*0\])+)\)/);
    if (m) {
      const [, name, body] = m;
      const verts = [];
      const re = /\[([-\d.]+),\s*([-\d.]+),\s*0\]/g;
      let v;
      while ((v = re.exec(body)) !== null) {
        verts.push([
          Math.round(parseFloat(v[1]) / FRAME_WIDTH * sw),
          Math.round(-parseFloat(v[2]) / FRAME_HEIGHT * sh),
        ]);
      }
      const xs = verts.map(p => p[0]), ys = verts.map(p => p[1]);
      const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
      const id = uid('obj');
      const obj = { id, type: 'polygon_free', name, x: sw / 2, y: sh / 2, width, height, vertices: verts,
        fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Matrix (single-line) — Matrix([["a","b"],...], left_bracket=..., right_bracket=...)
    m = line.match(/^(\w+)\s*=\s*Matrix\(\[(\[.+\])\](?:, left_bracket="([^"]*)", right_bracket="[^"]*")?\)/);
    if (m) {
      const [, name, body, leftBracket] = m;
      const rows = [];
      const rowRe = /\[([^\]]*)\]/g;
      let rm;
      while ((rm = rowRe.exec(body))) {
        const cells = rm[1].match(/"([^"]*)"/g);
        rows.push(cells ? cells.map(c => c.slice(1, -1)) : []);
      }
      const bracket = leftBracket === '(' ? '(' : leftBracket === '|' ? '|' : '[';
      const id = uid('obj');
      const obj = { id, type: 'matrix', name, x: sw / 2, y: sh / 2, width: 160, height: 120,
        matrixData: rows.length ? rows : [['1', '0'], ['0', '1']], bracket,
        fill: '#ffffff', stroke: '#ffffff', strokeWidth: 0, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Angle helper Lines (our naming) — captured into relLineMap, not turned into objects
    m = line.match(/^(\w+_l[12])\s*=\s*Line\(\[([-\d.]+), ([-\d.]+), 0\], \[([-\d.]+), ([-\d.]+), 0\]\)/);
    if (m) {
      relLineMap[m[1]] = { start: [parseFloat(m[2]), parseFloat(m[3])], end: [parseFloat(m[4]), parseFloat(m[5])] };
      continue;
    }

    // Brace — BraceBetweenPoints([..],[..]); the geometry name may be <n> or <n>_brace
    m = line.match(/^(\w+)\s*=\s*BraceBetweenPoints\(\[([-\d.]+), ([-\d.]+), 0\], \[([-\d.]+), ([-\d.]+), 0\]\)/);
    if (m) {
      const [, name, x1, y1, x2, y2] = m;
      const id = uid('obj');
      const obj = { id, type: 'brace', name, x: sw / 2, y: sh / 2, width: 160, height: 60,
        p1: [Math.round(parseFloat(x1) / FRAME_WIDTH * sw), Math.round(-parseFloat(y1) / FRAME_HEIGHT * sh)],
        p2: [Math.round(parseFloat(x2) / FRAME_WIDTH * sw), Math.round(-parseFloat(y2) / FRAME_HEIGHT * sh)],
        label: '', fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Angle / RightAngle — references two helper Lines in relLineMap
    m = line.match(/^(\w+)\s*=\s*(Angle|RightAngle)\((\w+_l1), (\w+_l2)(?:, radius=([-\d.]+))?\)/);
    if (m) {
      const [, name, ctor, l1, l2, rad] = m;
      const L1 = relLineMap[l1], L2 = relLineMap[l2];
      if (L1 && L2) {
        const toPx = (mp) => [Math.round(mp[0] / FRAME_WIDTH * sw), Math.round(-mp[1] / FRAME_HEIGHT * sh)];
        const id = uid('obj');
        const obj = { id, type: 'angle', name, x: sw / 2, y: sh / 2, width: 140, height: 140,
          vertex: toPx(L1.start), point1: toPx(L1.end), point2: toPx(L2.end),
          rightAngle: ctor === 'RightAngle', radius: rad ? parseFloat(rad) : 0.6, label: '',
          fill: '#fbbf24', stroke: '#fbbf24', strokeWidth: 2, opacity: 1, rotation: 0,
          enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
        objects.push(obj); varMap[name] = id; objById[id] = obj;
        continue;
      }
    }

    // VGroup label wrapper for brace/angle — renames base obj to the VGroup var + sets label
    m = line.match(/^(\w+)\s*=\s*VGroup\((\w+(?:_brace|_arc)), \2\.get_tex\("(.*)"\)\)/);
    if (m) {
      const [, vg, base, tex] = m;
      const baseId = varMap[base];
      const target = baseId ? objById[baseId] : null;
      if (target && (target.type === 'brace' || target.type === 'angle')) {
        target.name = vg;
        target.label = tex.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
        delete varMap[base];
        varMap[vg] = target.id;
      }
      continue;
    }

    // round_corners(radius=...) → restore cornerRadius (px) on polygon/triangle/star
    m = line.match(/^(\w+)\.round_corners\(radius=([-\d.]+)\)/);
    if (m) {
      const t = objById[varMap[m[1]]];
      if (t && ['polygon', 'triangle', 'star'].includes(t.type)) {
        t.cornerRadius = Math.round(parseFloat(m[2]) / FRAME_WIDTH * sw);
      }
      continue;
    }

    // Drop-shadow copy line → stash by base var
    m = line.match(/^_shadow_(\w+)\s*=\s*\w+\.copy\(\)\.set_color\("([^"]+)"\)\.set_opacity\(([-\d.]+)\)\.shift\(\[([-\d.]+), ([-\d.]+), 0\]\)/);
    if (m) {
      pendingShadow[m[1]] = {
        color: m[2], opacity: parseFloat(m[3]),
        dx: Math.round(parseFloat(m[4]) / FRAME_WIDTH * sw),
        dy: Math.round(-parseFloat(m[5]) / FRAME_HEIGHT * sh),
      };
      continue;
    }

    // Shadow VGroup wrapper → attach the stashed shadow to the base object
    m = line.match(/^(\w+)\s*=\s*VGroup\(_shadow_(\w+), \2\)/);
    if (m) {
      const ps = pendingShadow[m[2]];
      const t = objById[varMap[m[2]]];
      if (ps && t) { t.shadow = { ...ps, blur: 12 }; delete pendingShadow[m[2]]; }
      continue;
    }

    // Text
    m = line.match(/^(\w+)\s*=\s*Text\("([^"]*)",\s*font_size=(\d+)(?:,\s*color=["']([^"']+)["'])?\)/);
    if (m) {
      const [, name, content, fontSize, color] = m;
      const id = uid('obj');
      const obj = { id, type: 'text', name, content, fontSize: parseInt(fontSize), x: sw / 2, y: sh / 2, width: 200, height: 50, fill: color || '#ffffff', opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Dot (radius in export uses FRAME_X_RADIUS: radius = obj.width/2/sw * FRAME_X_RADIUS)
    m = line.match(/^(\w+)\s*=\s*Dot\((?:radius=([\d.]+))?[^)]*(?:color=["']([^"']+)["'])?\)/);
    if (m) {
      const [, name, r, color] = m;
      const size = r ? Math.round(parseFloat(r) * 2 / FRAME_X_RADIUS * sw) : 20;
      const id = uid('obj');
      const obj = { id, type: 'dot', name, x: sw / 2, y: sh / 2, width: size, height: size, fill: color || '#ffffff', opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // ParametricFunction (single-line parametric object) — must precede the heart matcher
    m = line.match(/^(\w+)\s*=\s*ParametricFunction\(lambda t: np\.array\(\[(.+), 0\]\), t_range=\[([-\d.]+), ([-\d.]+)\], color=["']([^"']+)["'], stroke_width=([\d.]+)\)/);
    if (m) {
      const [, name, body, t0, t1, color, sw_] = m;
      // split "xExpr, yExpr" on the top-level (paren-depth 0) comma
      let depth = 0, splitAt = -1;
      for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) { splitAt = i; break; }
      }
      const xe = (splitAt >= 0 ? body.slice(0, splitAt) : body).trim();
      const ye = (splitAt >= 0 ? body.slice(splitAt + 1) : '0').trim();
      const id = uid('obj');
      const obj = { id, type: 'parametric', name, x: sw / 2, y: sh / 2, width: 160, height: 160,
        xExpr: xe, yExpr: ye, tMin: parseFloat(t0), tMax: parseFloat(t1),
        fill: 'transparent', stroke: color, strokeWidth: parseFloat(sw_), opacity: 1, rotation: 0,
        enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // ParametricFunction (heart)
    m = line.match(/^(\w+)\s*=\s*ParametricFunction\(/);
    if (m) {
      const id = uid('obj');
      const obj = { id, type: 'heart', name: m[1], x: sw / 2, y: sh / 2, width: 120, height: 120, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[m[1]] = id; objById[id] = obj;
      continue;
    }

    // ImageMobject
    m = line.match(/^(\w+)\s*=\s*ImageMobject\(["']([^"']+)["']\)(?:\.scale_to_fit_width\(([\d.]+)\))?/);
    if (m) {
      const [, name, path, w] = m;
      const width = w ? Math.round(parseFloat(w) / FRAME_WIDTH * sw) : 200;
      const id = uid('obj');
      const obj = { id, type: 'image', name, x: sw / 2, y: sh / 2, width, height: Math.round(width * 0.75), fill: '#ffffff', opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // SVGMobject
    m = line.match(/^(\w+)\s*=\s*SVGMobject\(["']([^"']+)["']\)(?:\.scale_to_fit_width\(([\d.]+)\))?/);
    if (m) {
      const [, name, path, w] = m;
      const width = w ? Math.round(parseFloat(w) / FRAME_WIDTH * sw) : 200;
      const id = uid('obj');
      const obj = { id, type: 'svg_asset', name, x: sw / 2, y: sh / 2, width, height: Math.round(width * 0.75), fill: '#ffffff', opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // MathTex (LaTeX) — un-escape the Python string literal (\\ → \, \" → ").
    // Handles both the normal "..." form and the legacy raw r"..." form.
    m = line.match(/^(\w+)\s*=\s*MathTex\(r?"((?:[^"\\]|\\.)*)"(?:,\s*color=["']([^"']+)["'])?\)/);
    if (m) {
      const [, name, rawLatex, color] = m;
      const latex = rawLatex.replace(/\\([\\"])/g, '$1');
      const id = uid('obj');
      const obj = { id, type: 'latex', name, latex, x: sw / 2, y: sh / 2, width: 200, height: 80, fill: color || '#ffffff', opacity: 1, rotation: 0, enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Axes
    m = line.match(/^(\w+)\s*=\s*Axes\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\],\s*y_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
    if (m) {
      const [, name, x0, x1, xs, y0, y1, ys] = m;
      const id = uid('obj');
      const obj = { id, type: 'axes', name, x: sw / 2, y: sh / 2, width: 400, height: 300, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)], yRange: [parseFloat(y0), parseFloat(y1), parseFloat(ys)], enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // NumberPlane
    m = line.match(/^(\w+)\s*=\s*NumberPlane\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\],\s*y_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
    if (m) {
      const [, name, x0, x1, xs, y0, y1, ys] = m;
      const id = uid('obj');
      const obj = { id, type: 'numberplane', name, x: sw / 2, y: sh / 2, width: 400, height: 300, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)], yRange: [parseFloat(y0), parseFloat(y1), parseFloat(ys)], xStep: parseFloat(xs), yStep: parseFloat(ys), enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // NumberLine
    m = line.match(/^(\w+)\s*=\s*NumberLine\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
    if (m) {
      const [, name, x0, x1, xs] = m;
      const id = uid('obj');
      const obj = { id, type: 'numberline', name, x: sw / 2, y: sh / 2, width: 400, height: 60, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)], enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // axes.plot() — adds a graph to the axes object referenced by axesVar
    m = line.match(/^(\w+)\s*=\s*(\w+)\.plot\(lambda x:\s*([^,]+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\](?:,\s*color=["']([^"']+)["'])?(?:,\s*stroke_width=([\d.]+))?\)/);
    if (m) {
      const [, graphVar, axesVar, expr, xMin, xMax, color, sw2] = m;
      const axesId = varMap[axesVar];
      if (axesId && objById[axesId] && objById[axesId].type === 'axes') {
        if (!objById[axesId].graphs) objById[axesId].graphs = [];
        const _g = {
          id: uid('graph').split('_').slice(-2).join('_'),
          expression: expr.trim(),
          color: color || '#F59E0B',
          xMin: parseFloat(xMin),
          xMax: parseFloat(xMax),
          strokeWidth: sw2 ? parseFloat(sw2) : 3,
        };
        objById[axesId].graphs.push(_g);
        graphVarMap[graphVar] = _g;
      }
      continue;
    }

    // axes.get_area(graphVar, ...)
    m = line.match(/^\w+\s*=\s*\w+\.get_area\((\w+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\](?:,\s*color=["']([^"']+)["'])?(?:,\s*opacity=([\d.]+))?\)/);
    if (m) {
      const g = graphVarMap[m[1]];
      if (g) g.area = { enabled: true, xMin: parseFloat(m[2]), xMax: parseFloat(m[3]), color: m[4] || g.color, opacity: m[5] !== undefined ? parseFloat(m[5]) : 0.5 };
      continue;
    }
    // axes.get_riemann_rectangles(graphVar, ...)
    m = line.match(/^\w+\s*=\s*\w+\.get_riemann_rectangles\((\w+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\],\s*dx=([\d.]+),\s*input_sample_type=["'](\w+)["'](?:,\s*color=["']([^"']+)["'])?\)/);
    if (m) {
      const g = graphVarMap[m[1]];
      if (g) g.riemann = { enabled: true, xMin: parseFloat(m[2]), xMax: parseFloat(m[3]), dx: parseFloat(m[4]), type: m[5], color: m[6] || g.color };
      continue;
    }

    // ── 3D object parsers ──

    // Sphere
    m = line.match(/^(\w+)\s*=\s*Sphere\(radius=([\d.]+),\s*resolution=\((\d+),\s*(\d+)\)\)/);
    if (m) {
      const [, name, r, res] = m;
      const id = uid('obj');
      const obj = { id, type: 'sphere', name, x3d: 0, y3d: 0, z3d: 0, radius: parseFloat(r), resolution: parseInt(res), fill: '#ffffff', opacity: 1, enterTime: 0, exitTime: 10, anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } }, zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Cube
    m = line.match(/^(\w+)\s*=\s*Cube\(side_length=([\d.]+)\)/);
    if (m) {
      const [, name, sl] = m;
      const id = uid('obj');
      const obj = { id, type: 'cube', name, x3d: 0, y3d: 0, z3d: 0, sideLength: parseFloat(sl), fill: '#ffffff', opacity: 1, enterTime: 0, exitTime: 10, anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } }, zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Cone
    m = line.match(/^(\w+)\s*=\s*Cone\(base_radius=([\d.]+),\s*height=([\d.]+),\s*resolution=(\d+)\)/);
    if (m) {
      const [, name, r, h, res] = m;
      const id = uid('obj');
      const obj = { id, type: 'cone', name, x3d: 0, y3d: 0, z3d: 0, radius: parseFloat(r), height: parseFloat(h), resolution: parseInt(res), fill: '#ffffff', opacity: 1, enterTime: 0, exitTime: 10, anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } }, zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Cylinder
    m = line.match(/^(\w+)\s*=\s*Cylinder\(radius=([\d.]+),\s*height=([\d.]+),\s*resolution=(\d+)\)/);
    if (m) {
      const [, name, r, h, res] = m;
      const id = uid('obj');
      const obj = { id, type: 'cylinder', name, x3d: 0, y3d: 0, z3d: 0, radius: parseFloat(r), height: parseFloat(h), resolution: parseInt(res), fill: '#ffffff', opacity: 1, enterTime: 0, exitTime: 10, anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } }, zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // Torus
    m = line.match(/^(\w+)\s*=\s*Torus\(major_radius=([\d.]+),\s*minor_radius=([\d.]+),\s*resolution=(\d+)\)/);
    if (m) {
      const [, name, mr, mnr, res] = m;
      const id = uid('obj');
      const obj = { id, type: 'torus', name, x3d: 0, y3d: 0, z3d: 0, majorRadius: parseFloat(mr), minorRadius: parseFloat(mnr), resolution: parseInt(res), fill: '#ffffff', opacity: 1, enterTime: 0, exitTime: 10, anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } }, zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // ThreeDAxes
    m = line.match(/^(\w+)\s*=\s*ThreeDAxes\(/);
    if (m) {
      const name = m[1];
      const xrm = line.match(/x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
      const yrm = line.match(/y_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
      const zrm = line.match(/z_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
      const id = uid('obj');
      const obj = {
        id, type: 'axes3d', name, x3d: 0, y3d: 0, z3d: 0,
        xRange: xrm ? [parseFloat(xrm[1]), parseFloat(xrm[2]), parseFloat(xrm[3])] : [-3, 3, 1],
        yRange: yrm ? [parseFloat(yrm[1]), parseFloat(yrm[2]), parseFloat(yrm[3])] : [-3, 3, 1],
        zRange: zrm ? [parseFloat(zrm[1]), parseFloat(zrm[2]), parseFloat(zrm[3])] : [-3, 3, 1],
        fill: '#ffffff', opacity: 1, enterTime: 0, exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } }, zOrder: objects.length,
      };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // obj.move_to([x, y, z]) — handles both 2D (z=0) and 3D objects
    m = line.match(/^(\w+)\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        const mz = parseFloat(m[4]);
        if (mz !== 0 || objById[id].type === 'sphere' || objById[id].type === 'cube' ||
            objById[id].type === 'cone' || objById[id].type === 'cylinder' ||
            objById[id].type === 'torus' || objById[id].type === 'axes3d') {
          objById[id].x3d = parseFloat(m[2]);
          objById[id].y3d = parseFloat(m[3]);
          objById[id].z3d = mz;
        } else {
          const sp = manimToStage(parseFloat(m[2]), parseFloat(m[3]), sw, sh);
          objById[id].x = Math.round(sp.x);
          objById[id].y = Math.round(sp.y);
        }
      }
      continue;
    }

    // ── Property setters ──

    m = line.match(/^(\w+)\.set_color_by_gradient\(([^)]+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        const colors = m[2].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        if (colors.length >= 2) objById[id].gradient = { colors, angle: 135 };
      }
      continue;
    }

    m = line.match(/^(\w+)\.set_fill\(color=["']([^"']+)["'](?:,\s*opacity=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].fill = m[2];
        if (m[3] !== undefined) {
          const op = parseFloat(m[3]);
          const master = objById[id].opacity ?? 1;
          if (master > 0 && Math.abs(op - master) > 0.001) objById[id].fillOpacity = +(op / master).toFixed(3);
        }
      }
      continue;
    }

    m = line.match(/^(\w+)\.set_stroke\(color=["']([^"']+)["'](?:,\s*width=([\d.]+))?(?:,\s*opacity=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].stroke = m[2];
        if (m[3]) objById[id].strokeWidth = parseFloat(m[3]);
        if (m[4] !== undefined) {
          const op = parseFloat(m[4]);
          const master = objById[id].opacity ?? 1;
          if (master > 0) objById[id].strokeOpacity = +(op / master).toFixed(3);
        }
      }
      continue;
    }

    m = line.match(/^\w+\s*=\s*VGroup\((\w+),\s*DashedVMobject\([^,]+,\s*num_dashes=(\d+),\s*dashed_ratio=([\d.]+)\)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) objById[id].dash = { numDashes: parseInt(m[2]), ratio: parseFloat(m[3]) };
      continue;
    }

    m = line.match(/^(\w+)\.set_color\(["']([^"']+)["']\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) objById[id].fill = m[2];
      continue;
    }

    m = line.match(/^(\w+)\.rotate\(([-\d.]+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) objById[id].rotation = Math.round(parseFloat(m[2]) * 180 / Math.PI * 10) / 10;
      continue;
    }

    // ── Animations ──

    // AnimationGroup / LaggedStart
    m = line.match(/^self\.play\((AnimationGroup|LaggedStart)\(/);
    if (m) {
      const fn = m[1];
      const lagMatch = line.match(/lag_ratio=([\d.]+)/);
      const rtMatch = line.match(/run_time=([\d.]+)/);
      const lagRatio = lagMatch ? parseFloat(lagMatch[1]) : 0;
      const dur = rtMatch ? parseFloat(rtMatch[1]) : 1;

      // Extract inner content by bracket matching starting after "AnimationGroup(" or "LaggedStart("
      const fnStart = line.indexOf(fn + '(') + fn.length + 1;
      let depth = 1, end = fnStart;
      while (end < line.length && depth > 0) {
        if (line[end] === '(' || line[end] === '[') depth++;
        else if (line[end] === ')' || line[end] === ']') depth--;
        end++;
      }
      const inner = line.substring(fnStart, end - 1);

      // Split inner content by ',' respecting bracket depth
      const exprs = [];
      let cur = '', d = 0;
      for (const ch of inner) {
        if (ch === '(' || ch === '[') d++;
        else if (ch === ')' || ch === ']') d--;
        if (ch === ',' && d === 0) {
          const t = cur.trim();
          if (t && !/^(lag_ratio|run_time|rate_func)/.test(t)) exprs.push(t);
          cur = '';
        } else { cur += ch; }
      }
      if (cur.trim() && !/^(lag_ratio|run_time|rate_func)/.test(cur.trim())) exprs.push(cur.trim());

      const parsedClips = exprs.map(e => parseAnimExpr(e)).filter(Boolean);
      for (const pc of parsedClips) {
        clips.push({ id: `clip_${clipIdx++}`, type: pc.type, sourceId: pc.sourceId, startTime: ct, duration: dur, easing: 'ease_in_out', parallel: true, lag_ratio: lagRatio, params: pc.params });
      }
      if (parsedClips.length > 0) ct += dur;
      continue;
    }

    m = line.match(/^self\.wait\(([\d.]+)\)/);
    if (m) { ct += parseFloat(m[1]); continue; }

    m = line.match(/^self\.play\(FadeIn\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) { objById[id].enterTime = ct; objById[id].enterAnim = 'fade_in'; }
      ct += parseFloat(m[2] || 0.5);
      continue;
    }

    m = line.match(/^self\.play\(Create\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) { objById[id].enterTime = ct; objById[id].enterAnim = 'none'; }
      ct += parseFloat(m[2] || 1);
      continue;
    }

    m = line.match(/^self\.play\((?:ReplacementTransform|FadeTransform|Transform)\((\w+),\s*(\w+)\)(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=([^\s)]+))?\)/);
    if (m) {
      const srcId = varMap[m[1]], tgtId = varMap[m[2]];
      if (srcId && tgtId) {
        const dur = parseFloat(m[3] || 1);
        const easing = m[4] ? (EASING_REV[m[4]] || 'ease_in_out') : 'ease_in_out';
        clips.push({ id: `clip_${clipIdx++}`, type: 'transform', sourceId: srcId, targetId: tgtId, startTime: ct, duration: dur, easing });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\(Rotate\((\w+),\s*angle=([-\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[3] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'rotate', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { targetRotation: Math.round(parseFloat(m[2]) * 180 / Math.PI) } });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\(Indicate\((\w+),\s*color="([^"]+)",\s*scale_factor=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[4] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'indicate', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { color: m[2], scale_factor: parseFloat(m[3]) } });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\(Flash\((\w+),\s*color="([^"]+)",\s*flash_radius=([\d.]+),\s*line_length=([\d.]+),\s*num_lines=(\d+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[6] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'flash', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { color: m[2], flash_radius: parseFloat(m[3]), line_length: parseFloat(m[4]), num_lines: parseInt(m[5], 10) } });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\(Wiggle\((\w+),\s*scale_value=([\d.]+),\s*rotation_angle=([\d.]+) \* DEGREES,\s*n_wiggles=(\d+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[5] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'wiggle', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { scale_value: parseFloat(m[2]), rotation_angle: parseFloat(m[3]), n_wiggles: parseInt(m[4], 10) } });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\(Circumscribe\((\w+),\s*color="([^"]+)",\s*shape=(Rectangle|Circle),\s*fade_out=(True|False),\s*time_width=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[6] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'circumscribe', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { color: m[2], shape: m[3], fade_out: m[4] === 'True', time_width: parseFloat(m[5]) } });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\(FocusOn\((\w+),\s*color="([^"]+)",\s*opacity=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[4] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'focus_on', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { color: m[2], opacity: parseFloat(m[3]) } });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\(FadeOut\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) { objById[id].exitAnim = 'fade_out'; objById[id].duration = ct - (objById[id].enterTime || 0) + parseFloat(m[2] || 0.5); }
      ct += parseFloat(m[2] || 0.5);
      continue;
    }

    m = line.match(/^self\.play\((\w+)\.animate\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*0\]\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const sp = manimToStage(parseFloat(m[2]), parseFloat(m[3]), sw, sh);
        const dur = parseFloat(m[4] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'move', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { targetX: Math.round(sp.x), targetY: Math.round(sp.y) } });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\((\w+)\.animate\.scale\(([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[3] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'scale', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { targetScaleX: parseFloat(m[2]), targetScaleY: parseFloat(m[2]) } });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\((\w+)\.animate\.set_opacity\(([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[3] || 1);
        clips.push({ id: `clip_${clipIdx++}`, type: 'fade', sourceId: id, startTime: ct, duration: dur, easing: 'ease_in_out', params: { targetOpacity: parseFloat(m[2]) } });
        ct += dur;
      }
      continue;
    }

    // self.camera.frame.animate.move_to([x,y,0]).set_width(w)
    m = line.match(/^self\.play\(self\.camera\.frame\.animate\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*0\]\)\.set_width\(([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const [, mx, my, fw, rtStr] = m;
      const dur = parseFloat(rtStr || 1);
      const sp = manimToStage(parseFloat(mx), parseFloat(my), sw, sh);
      const zoom = parseFloat((FRAME_WIDTH / parseFloat(fw)).toFixed(4));
      cameraTrack.push({
        id: `cam_${clipIdx++}`,
        type: 'camera_move',
        startTime: ct,
        duration: dur,
        easing: 'ease_in_out',
        params: { targetX: Math.round(sp.x), targetY: Math.round(sp.y), zoom },
      });
      ct += dur;
      continue;
    }

    // VMobject() — start of a path definition
    m = line.match(/^(\w+)\s*=\s*VMobject\(\)/);
    if (m) {
      pendingPaths[m[1]] = [];
      continue;
    }

    // set_points_as_corners — parse Manim coordinate list into pending path
    m = line.match(/^(\w+)\.set_points_as_corners\(\[np\.array\(p\) for p in \[(.+)\]\]\)/);
    if (m) {
      const [, pathVar, pointsStr] = m;
      if (pendingPaths[pathVar] !== undefined) {
        const pointMatches = [...pointsStr.matchAll(/\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/g)];
        pendingPaths[pathVar] = pointMatches.map(pm => ({
          mx: parseFloat(pm[1]),
          my: parseFloat(pm[2]),
          mz: parseFloat(pm[3]),
        }));
      }
      continue;
    }

    // MoveAlongPath — create path_move clip from pending path
    m = line.match(/^self\.play\(MoveAlongPath\((\w+),\s*(\w+)\)(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=([^\s)]+))?\)/);
    if (m) {
      const [, objVar, pathVar, rtStr, rfStr] = m;
      const objId = varMap[objVar];
      const pathPoints = pendingPaths[pathVar];
      if (objId && pathPoints && pathPoints.length >= 2) {
        const dur = parseFloat(rtStr || 1);
        const easing = rfStr ? (EASING_REV[rfStr] || 'linear') : 'linear';
        const path = pathPoints.map(p => {
          if (sceneType === '3d') {
            return { x3d: p.mx, y3d: p.my, z3d: p.mz };
          }
          const sp = manimToStage(p.mx, p.my, sw, sh);
          return { x: Math.round(sp.x), y: Math.round(sp.y) };
        });
        clips.push({ id: `clip_${clipIdx++}`, type: 'path_move', sourceId: objId, startTime: ct, duration: dur, easing, parallel: false, lag_ratio: 0, path });
        ct += dur;
      }
      delete pendingPaths[pathVar];
      continue;
    }
  }

  // Finalize object durations
  for (const obj of objects) {
    if (obj.duration >= 10) obj.duration = Math.max(3, ct + 1 - (obj.enterTime || 0));
  }

  return {
    objects,
    tracks: clips.length > 0 ? [{ id: 'track_parsed', name: 'Track 1', clips }] : [],
    stage: { backgroundColor: bgColor, width: sw, height: sh },
    sceneType,
    cameraType,
    cameraTrack,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// DOWNLOAD helper
// ═════════════════════════════════════════════════════════════════════════════

export function downloadManimScript(project) {
  const script = generateManimScript(project);
  const blob = new Blob([script], { type: 'text/x-python' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'scene.py'; a.click();
  URL.revokeObjectURL(url);
  return script;
}

// Alias for test compatibility and API convenience
export const generateCode = generateManimScript;

export { EASING_MAP };
export default { generateManimScript, parseManimScript, downloadManimScript, generateCode };
