/**
 * Manim Python Code Generator — v4 (server-side)
 *
 * Generates a clean Manim CE scene from the normalised project JSON.
 * Mirrors the client-side generator but uses server file paths for assets.
 *
 * Supports: rectangle, square, circle, ellipse, triangle, star, polygon,
 *           line, arrow, heart, dot, dot_grid, text, image, svg_asset, groups
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

// NOTE: keep in sync with services/web/src/export/manim.js EASING_MAP
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

function rf(e)    { return EASING_MAP[e] || 'rate_functions.smooth'; }
function rfOpt(e) { const r = rf(e); return r === 'rate_functions.smooth' ? '' : `, rate_func=${r}`; }
function vn(id)   { let n = id.replace(/[^a-zA-Z0-9_]/g, '_'); return /^[0-9]/.test(n) ? 'o_' + n : n; }
function rtOpt(d) { return Math.abs(d - 1) < 0.01 ? '' : `, run_time=${d.toFixed(1)}`; }

/** Validate and format a color value for Manim. Returns quoted hex string or null. */
function hex(h) {
  if (!h || typeof h !== 'string') return null;
  const s = h.trim();
  if (!s || s === 'transparent' || s === 'none') return null;
  // Accept valid hex colors: #RGB, #RRGGBB, #RRGGBBAA
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return `"${s}"`;
  // Reject anything that isn't a proper hex color
  return null;
}

/** Ensure a numeric value is valid and positive, with a fallback. */
function safeNum(v, fallback) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return (Number.isFinite(n) && n > 0) ? n : fallback;
}

/** Clamp opacity to [0, 1]. */
function safeOpacity(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/** Validate a math expression: only allow characters safe for both Python and JS math. */
function safeMathExpr(expr) {
  if (!expr || typeof expr !== 'string') return 'x**2';
  const trimmed = expr.trim();
  if (!trimmed) return 'x**2';
  // Whitelist: digits, letters (for sin/cos/pi/Math/np etc.), math operators, parens, dot, comma, space
  // Reject anything with underscores (blocks __import__, __builtins__ etc.)
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(trimmed)) return 'x**2';
  // Also reject if it contains 'import', 'eval', 'exec', 'open', '__'
  if (/import|eval|exec|open|__/.test(trimmed)) return 'x**2';
  return trimmed;
}

/** Sanitise text for Python string literals. */
function safeText(s) {
  if (!s || typeof s !== 'string') return 'Text';
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

// Manim frame dimensions (matches Manim CE default)
const FRAME_WIDTH = 14 + 2 / 9;          // 14.222
const FRAME_HEIGHT = 8;
const FRAME_X_RADIUS = FRAME_WIDTH / 2;  // 7.111
const FRAME_Y_RADIUS = FRAME_HEIGHT / 2; // 4

// ── Style effect helpers (KEEP BYTE-IDENTICAL with services/web/src/export/manim.js) ──
const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free']);
const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow', 'annulus', 'arc', 'sector', 'double_arrow', 'polygon_free']);

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

function stageToManim(x, y, sw, sh) {
  return { x: ((x / sw) - 0.5) * FRAME_WIDTH, y: -((y / sh) - 0.5) * FRAME_HEIGHT };
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

// ── 3D Object code ─────────────────────────────────────────────────────────────

function fmt3d(num) {
  // Format a 3D numeric param: strip trailing zeros but keep at least 1 decimal place
  return num.toFixed(3).replace(/(\.\d*[1-9])0+$/, '$1').replace(/\.0{3}$/, '.0');
}

function objectCode3d(obj) {
  const n = vn(obj.id);
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

// ── Object code ─────────────────────────────────────────────────────────────

function objectCode(obj, sw, sh, assetsPath, assetMap) {
  const n = vn(obj.id), lines = [];
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
      const fontVar = `font_${vn(obj.id)}`;
      lines.push(`# Font: ${fontFamily}`);
      lines.push(`${n} = Text("${safeText(obj.content)}", font_size=${safeNum(obj.fontSize, 48)}, color=${fill}, font="${fontFamily}")`);
      break;
    }
    case 'dot':
      lines.push(`${n} = Dot(radius=${(obj.width / 2 / sw * FRAME_X_RADIUS).toFixed(3)}, color=${fill})`);
      break;
    case 'dot_grid': {
      const c = safeNum(obj.gridCols, 5), r = safeNum(obj.gridRows, 5);
      const sp = safeNum(obj.dotSpacing, 40) / sw * FRAME_WIDTH;
      lines.push(`${n} = VGroup(*[Dot(radius=0.06).move_to([c*${sp.toFixed(3)}-${((c - 1) * sp / 2).toFixed(3)}, r*${sp.toFixed(3)}-${((r - 1) * sp / 2).toFixed(3)}, 0]) for r in range(${r}) for c in range(${c})])`);
      if (hasFill)
        lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'image': {
      const asset = obj.assetId ? assetMap[obj.assetId] : null;
      const filename = asset?.filename || `${(obj.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_')}.png`;
      const filePath = `${assetsPath}/${filename}`;
      lines.push(`${n} = ImageMobject("${filePath}").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
    }
    case 'svg_asset': {
      const asset = obj.assetId ? assetMap[obj.assetId] : null;
      const filename = asset?.filename || `${(obj.name || 'asset').replace(/[^a-zA-Z0-9._-]/g, '_')}.svg`;
      const filePath = `${assetsPath}/${filename}`;
      lines.push(`${n} = SVGMobject("${filePath}").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
    }
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
      lines.push(`${n} = Circle(radius=0.5)  # unknown type: ${obj.type}`);
  }

  const gl = gradientLine(n, obj);
  if (gl && GRADIENT_TYPES.has(obj.type)) lines.push(gl);
  for (const dl of dashedLines(n, obj)) lines.push(dl);
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
// the setter expects. UpdateFromAlphaFunc/ValueTracker feed the setter directly,
// so without this an x keyframe of 500px would set_x(500) → far off-screen.
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
    const n = vn(obj.id);
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

// ── Main generator ──────────────────────────────────────────────────────────

export function generatePythonCode(project, assetsPath) {
  const L = [];
  const sw = project.stage.width;
  const sh = project.stage.height;
  const assetMap = project._assetMap || {};

  // Collect unique Google Fonts used by text objects
  const usedFonts = new Set();
  for (const obj of (project.objects || [])) {
    if (obj.type === 'text' && obj.fontFamily) {
      // Only register Google Fonts (not system fonts)
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

  if (!project.objects || project.objects.length === 0) {
    L.push('        self.wait(1)');
    return L.join('\n');
  }

  // Generate font registration and scene content
  // If we have Google Fonts, wrap everything in nested RegisterFont context managers
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

  // Object definitions
  const obj3DTypes = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
  const oMap = {};
  L.push(`${indent}# Objects`);
  for (const obj of project.objects) {
    oMap[obj.id] = obj;
    if (obj3DTypes.includes(obj.type)) {
      objectCode3d(obj).forEach(l => L.push(indent + l));
    } else {
      objectCode(obj, sw, sh, assetsPath, assetMap).forEach(l => L.push(indent + l));
      // Axes: add graph curves as children of the axes object
      if (obj.type === 'axes' && obj.graphs && obj.graphs.length > 0) {
        const nn = vn(obj.id);
        for (const g of obj.graphs) {
          const gn = `${nn}_graph_${g.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          L.push(`${indent}${nn}.add(${gn})`);
        }
      }
    }
    L.push('');
  }

  // Groups
  const groups = project.groups || [];
  if (groups.length > 0) {
    L.push(`${indent}# Groups`);
    for (const g of groups) {
      if (!g.childIds || g.childIds.length === 0) continue;
      const childVars = g.childIds.map(id => vn(id)).filter(Boolean).join(', ');
      const gn = vn(g.id);
      L.push(`${indent}${gn} = VGroup(${childVars})`);
    }
    L.push('');
  }

  // Collect clips
  const clips = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) clips.push(clip);
  }
  clips.sort((a, b) => a.startTime - b.startTime);

  // Determine transform relationships
  const transformSources = new Set();
  const transformTargets = new Set();
  for (const c of clips) {
    if (c.type === 'transform') {
      transformSources.add(c.sourceId);
      if (c.targetId) transformTargets.add(c.targetId);
    }
  }

  // Build animation steps
  const steps = [];

  // Enter (skip transform targets)
  for (const obj of project.objects) {
    if (transformTargets.has(obj.id)) continue;
    const t = obj.enterTime || 0;
    const n = vn(obj.id);
    const dur = obj.enterAnimDur || 0.5;
    const rt = rtOpt(dur);
    const enterAnim = obj.enterAnim || 'fade_in';

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

  // Clip animations — parallel clips grouped into AnimationGroup/LaggedStart
  const clipGroups = [];
  let i = 0;
  while (i < clips.length) {
    const c = clips[i];
    if (c.parallel) {
      const group = [c];
      let j = i + 1;
      while (j < clips.length && clips[j].parallel && Math.abs(clips[j].startTime - c.startTime) < 0.01) {
        group.push(clips[j]);
        j++;
      }
      clipGroups.push({ type: 'group', clips: group, startTime: c.startTime });
      i = j;
    } else {
      clipGroups.push({ type: 'single', clip: c, startTime: c.startTime });
      i++;
    }
  }

  for (const cg of clipGroups) {
    if (cg.type === 'single') {
      const c = cg.clip;
      const objId = c.sourceId ?? c.objectId;
      const sn = vn(objId);
      const dur = c.duration;
      const rtStr = rtOpt(dur);
      const rfStr = rfOpt(c.easing);
      let code;
      switch (c.type) {
        case 'transform': {
          const tn = vn(c.targetId);
          const srcObj = oMap[c.sourceId], tgtObj = oMap[c.targetId];
          const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
          const anim = hasRaster ? 'FadeTransform' : 'ReplacementTransform';
          code = `self.play(${anim}(${sn}, ${tn})${rtStr}${rfStr})`;
          break;
        }
        case 'move': {
          const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
          code = `self.play(${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])${rtStr}${rfStr})`;
          break;
        }
        case 'scale':
          code = `self.play(${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})${rtStr}${rfStr})`;
          break;
        case 'fade': {
          const op = c.params?.targetOpacity ?? 0;
          code = op < 0.01
            ? `self.play(FadeOut(${sn})${rtStr}${rfStr})`
            : `self.play(${sn}.animate.set_opacity(${op.toFixed(2)})${rtStr}${rfStr})`;
          break;
        }
        case 'rotate': {
          const obj = oMap[objId];
          if (is3D && obj && obj3DTypes.includes(obj.type)) {
            const axisMap = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
            const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
            const angleRad = ((c.angle ?? 90) * Math.PI / 180).toFixed(4);
            code = `self.play(Rotate(${sn}, angle=${angleRad}, axis=${axis})${rtStr}${rfStr})`;
          } else {
            const ang = ((c.params?.targetRotation || 360) - (oMap[objId]?.rotation || 0)) * Math.PI / 180;
            code = `self.play(Rotate(${sn}, angle=${ang.toFixed(2)})${rtStr}${rfStr})`;
          }
          break;
        }
        case 'path_move': {
          if (!c.path || c.path.length < 2) break;
          const cn = c.id ? c.id.replace(/[^a-zA-Z0-9_]/g, '_') : sn;
          const pn = `path_${cn}`;
          const ptsStr = pathPointsPy(c.path, sw, sh);
          code = [
            `${pn} = VMobject()`,
            `${pn}.set_points_as_corners([np.array(p) for p in [${ptsStr}]])`,
            `self.play(MoveAlongPath(${sn}, ${pn})${rtStr}${rfStr})`,
          ].join(`\n${indent}`);
          break;
        }
      }
      if (code) steps.push({ time: c.startTime, order: 1, code, dur, audio: c.audio, _clipId: c.id });
    } else {
      // Degenerate case: only one clip marked parallel, treat as sequential
      if (cg.clips.length === 1) {
        const c = cg.clips[0];
        const objId = c.sourceId ?? c.objectId;
        const sn = vn(objId);
        const dur = c.duration;
        const rtStr = rtOpt(dur);
        const rfStr = rfOpt(c.easing);
        let code;
        switch (c.type) {
          case 'transform': {
            const tn = vn(c.targetId);
            const srcObj = oMap[c.sourceId], tgtObj = oMap[c.targetId];
            const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
            const anim = hasRaster ? 'FadeTransform' : 'ReplacementTransform';
            code = `self.play(${anim}(${sn}, ${tn})${rtStr}${rfStr})`;
            break;
          }
          case 'move': {
            const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
            code = `self.play(${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])${rtStr}${rfStr})`;
            break;
          }
          case 'scale':
            code = `self.play(${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})${rtStr}${rfStr})`;
            break;
          case 'fade': {
            const op = c.params?.targetOpacity ?? 0;
            code = op < 0.01
              ? `self.play(FadeOut(${sn})${rtStr}${rfStr})`
              : `self.play(${sn}.animate.set_opacity(${op.toFixed(2)})${rtStr}${rfStr})`;
            break;
          }
          case 'rotate': {
            const obj = oMap[objId];
            if (is3D && obj && obj3DTypes.includes(obj.type)) {
              const axisMap = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
              const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
              const angleRad = ((c.angle ?? 90) * Math.PI / 180).toFixed(4);
              code = `self.play(Rotate(${sn}, angle=${angleRad}, axis=${axis})${rtStr}${rfStr})`;
            } else {
              const ang = ((c.params?.targetRotation || 360) - (oMap[objId]?.rotation || 0)) * Math.PI / 180;
              code = `self.play(Rotate(${sn}, angle=${ang.toFixed(2)})${rtStr}${rfStr})`;
            }
            break;
          }
          case 'path_move': {
            if (!c.path || c.path.length < 2) break;
            const cn = c.id ? c.id.replace(/[^a-zA-Z0-9_]/g, '_') : sn;
            const pn = `path_${cn}`;
            const ptsStr = pathPointsPy(c.path, sw, sh);
            code = [
              `${pn} = VMobject()`,
              `${pn}.set_points_as_corners([np.array(p) for p in [${ptsStr}]])`,
              `self.play(MoveAlongPath(${sn}, ${pn})${rtStr}${rfStr})`,
            ].join(`\n${indent}`);
            break;
          }
        }
        if (code) steps.push({ time: c.startTime, order: 1, code, dur, audio: c.audio, _clipId: c.id });
      } else {
      // Multi-clip parallel group: AnimationGroup or LaggedStart
      const groupClips = cg.clips;
      const dur = Math.max(...groupClips.map(c => c.duration));
      const rtStr = rtOpt(dur);
      const maxLag = Math.max(...groupClips.map(c => c.lag_ratio || 0));

      const animExprs = groupClips.map(c => {
        const objId = c.sourceId ?? c.objectId;
        const sn = vn(objId);
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
            const tn = vn(c.targetId);
            const srcObj = oMap[c.sourceId], tgtObj = oMap[c.targetId];
            const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
            return hasRaster ? `FadeTransform(${sn}, ${tn})` : `ReplacementTransform(${sn}, ${tn})`;
          }
          default: return null;
        }
      }).filter(Boolean);

      if (animExprs.length > 0) {
        const animList = animExprs.join(', ');
        const groupFn = maxLag > 0 ? 'LaggedStart' : 'AnimationGroup';
        const lagStr = maxLag > 0 ? `, lag_ratio=${maxLag.toFixed(2)}` : '';
        // Apply the first clip's easing to the whole group (best approximation)
        const firstEasing = groupClips[0]?.easing || 'ease_in_out';
        const groupRfStr = rfOpt(firstEasing);
        const code = `self.play(${groupFn}(${animList}${lagStr})${rtStr}${groupRfStr})`;
        steps.push({ time: cg.startTime, order: 1, code, dur });
      }
      } // end multi-clip parallel group
    }
  }

  // Keyframe steps
  generateKeyframeSteps(project, steps, sw, sh);

  // Camera clips
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
        // camera frame animate: set_width gives absolute zoom (14/zoom units wide)
        // .scale() is relative/cumulative; set_width is absolute and idempotent
        const sceneWidth = FRAME_WIDTH;
        const zoom = parseFloat((camClip.params?.zoom || 1).toFixed(4));
        const frameWidth = (sceneWidth / zoom).toFixed(3);
        code = `self.play(self.camera.frame.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0]).set_width(${frameWidth})${rtStr}${rfStr})`;
      } else {
        continue;
      }

      steps.push({ time: camClip.startTime, order: 1, code, dur });
    }
  }

  // Exit (skip transform sources)
  for (const obj of project.objects) {
    if (transformSources.has(obj.id)) continue;
    let exitTime = (obj.enterTime || 0) + (obj.duration || 3);
    for (const c of clips) {
      const end = c.startTime + c.duration;
      if ((c.sourceId === obj.id || c.targetId === obj.id) && end > exitTime) exitTime = end + 0.1;
    }
    const n = vn(obj.id);
    const exitAnim = obj.exitAnim || 'none';
    const dur = obj.exitAnimDur || 0.5;
    const rt = rtOpt(dur);

    let exitCode;
    switch (exitAnim) {
      case 'none':
        continue;
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

  // Sort
  steps.sort((a, b) => a.time - b.time || a.order - b.order);

  // Emit
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
      // self.play). Indent EVERY line to the construct body, preserving the
      // block's own relative indentation — prefixing only the first line would
      // leave the def body and trailing self.play at the wrong column.
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

export { objectCode, EASING_MAP };
