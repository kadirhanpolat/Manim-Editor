import {
  vn, hex, safeNum, safeOpacity, safeText, safeLatex, safeMathExpr, latexUnit,
  safeMatrixEntry, matrixBrackets, fillOpacityExpr, strokeOpacityArg,
  gradientLine, dashedLines, roundCornersLine, shadowLines, stageToManim,
} from './helpers.js';
import { FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS, GRADIENT_TYPES } from './constants.js';

// ── Object code (single object definition) ──────────────────────────────────

export function objectCode(obj, sw, sh, { resolveAsset }) {
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
    case 'bezier': {
      const verts = (Array.isArray(obj.vertices) && obj.vertices.length >= 2)
        ? obj.vertices : [[-110, 30], [-40, -55], [40, 50], [110, -30]];
      const pts = verts.map(([vx, vy]) =>
        `[${(vx / sw * FRAME_WIDTH).toFixed(3)}, ${(-vy / sh * FRAME_HEIGHT).toFixed(3)}, 0]`).join(', ');
      lines.push(`${n} = VMobject()`);
      lines.push(`${n}.set_points_smoothly([${pts}])`);
      lines.push(`${n}.set_stroke(color=${stroke || hex(obj.fill) || '"#F472B6"'}, width=${sw2}${strokeOpacityArg(obj, opacity)})`);
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
    case 'table': {
      const data = (Array.isArray(obj.cellData) && obj.cellData.length && Array.isArray(obj.cellData[0]))
        ? obj.cellData : [['1', '2'], ['3', '4']];
      const body = data.map(row => `[${row.map(c => `"${safeMatrixEntry(c)}"`).join(', ')}]`).join(', ');
      const cls = obj.mathMode ? 'MathTable' : 'Table';
      const wrap = obj.mathMode ? 'MathTex' : 'Text';
      const labelArr = (arr) => `[${arr.map(s => `${wrap}("${safeMatrixEntry(s)}")`).join(', ')}]`;
      let args = `[${body}]`;
      if (Array.isArray(obj.rowLabels) && obj.rowLabels.length) args += `, row_labels=${labelArr(obj.rowLabels)}`;
      if (Array.isArray(obj.colLabels) && obj.colLabels.length) args += `, col_labels=${labelArr(obj.colLabels)}`;
      lines.push(`${n} = ${cls}(${args})`);
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'graph': {
      const verts = (Array.isArray(obj.vertices) ? obj.vertices : []).map(v => safeMatrixEntry(v));
      const vlist = `[${verts.map(v => `"${v}"`).join(', ')}]`;
      const edges = (Array.isArray(obj.edges) ? obj.edges : []).filter(e => Array.isArray(e) && e.length === 2);
      const elist = `[${edges.map(([a, b]) => `("${safeMatrixEntry(a)}", "${safeMatrixEntry(b)}")`).join(', ')}]`;
      const pos = obj.positions || {};
      const layout = `{${verts.map(v => { const p = pos[v] || [0, 0]; const mx = (p[0] / sw * FRAME_WIDTH); const my = (-(p[1]) / sh * FRAME_HEIGHT); return `"${v}": [${mx.toFixed(3)}, ${my.toFixed(3)}, 0]`; }).join(', ')}}`;
      const cls = obj.directed ? 'DiGraph' : 'Graph';
      const lbl = obj.showLabels ? ', labels=True' : '';
      lines.push(`${n} = ${cls}(${vlist}, ${elist}, layout=${layout}${lbl})`);
      break;
    }
    case 'vector_field': {
      const fx = safeMathExpr(obj.fx, 'y');
      const fy = safeMathExpr(obj.fy, '-x');
      const xr = obj.xRange || [-3, 3, 1];
      const yr = obj.yRange || [-2, 2, 1];
      const xs = Number.isFinite(xr[2]) && xr[2] !== 0 ? xr[2] : 1;
      const ys = Number.isFinite(yr[2]) && yr[2] !== 0 ? yr[2] : 1;
      lines.push(`${n} = ArrowVectorField(lambda p: (lambda x, y: np.array([${fx}, ${fy}, 0]))(p[0], p[1]), x_range=[${xr[0]}, ${xr[1]}, ${xs}], y_range=[${yr[0]}, ${yr[1]}, ${ys}])`);
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
    case 'vector_components': {
      const tip = (vx, vy) => `[${(vx / sw * FRAME_WIDTH).toFixed(3)}, ${(-vy / sh * FRAME_HEIGHT).toFixed(3)}, 0]`;
      const vcx = Number.isFinite(obj.vx) ? obj.vx : 120;
      const vcy = Number.isFinite(obj.vy) ? obj.vy : -80;
      const V = tip(vcx, vcy), VX0 = tip(vcx, 0), V0Y = tip(0, vcy);
      const col = hex(obj.fill) || '"#3b82f6"';
      lines.push(`${n}_main = Arrow([0, 0, 0], ${V}, buff=0, color=${col})`);
      lines.push(`${n}_x = Arrow([0, 0, 0], ${VX0}, buff=0, color="#ef4444")`);
      lines.push(`${n}_y = Arrow([0, 0, 0], ${V0Y}, buff=0, color="#22c55e")`);
      lines.push(`${n}_dx = DashedLine(${V}, ${VX0})`);
      lines.push(`${n}_dy = DashedLine(${V}, ${V0Y})`);
      lines.push(`${n} = VGroup(${n}_main, ${n}_x, ${n}_y, ${n}_dx, ${n}_dy)`);
      break;
    }
    case 'ray': {
      const a = (Number.isFinite(obj.angle) ? obj.angle : 30) * Math.PI / 180;
      const L = Number.isFinite(obj.length) ? obj.length : 200;
      const VX = (L * Math.cos(a) / sw * FRAME_WIDTH).toFixed(3);
      const VY = (L * Math.sin(a) / sh * FRAME_HEIGHT).toFixed(3);
      const col = hex(obj.fill) || '"#22d3ee"';
      lines.push(`${n}_dot = Dot([0, 0, 0], color=${col})`);
      lines.push(`${n}_ray = Arrow([0, 0, 0], [${VX}, ${VY}, 0], buff=0, color=${col})`);
      lines.push(`${n} = VGroup(${n}_dot, ${n}_ray)`);
      break;
    }
    case 'coord_point': {
      const col = hex(obj.fill) || '"#fbbf24"';
      const d = Number.isFinite(obj.decimals) ? Math.max(0, Math.trunc(obj.decimals)) : 1;
      lines.push(`${n}_dot = Dot([0, 0, 0], color=${col})`);
      lines.push(`${n}_label = always_redraw(lambda: MathTex(f"({${n}_dot.get_x():.${d}f}, {${n}_dot.get_y():.${d}f})").next_to(${n}_dot, UR, buff=0.15).set_color(${col}))`);
      lines.push(`${n} = VGroup(${n}_dot, ${n}_label)`);
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
    case 'counter': {
      const val = Number.isFinite(obj.value) ? obj.value : 0;
      const unit = obj.suffix ? `, unit="${latexUnit(obj.suffix)}"` : '';
      if (obj.useInteger) {
        lines.push(`${n} = Integer(${Math.trunc(val)}${unit})`);
      } else {
        const dec = Number.isFinite(obj.numDecimals) ? Math.max(0, Math.trunc(obj.numDecimals)) : 0;
        lines.push(`${n} = DecimalNumber(${val}, num_decimal_places=${dec}${unit})`);
      }
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
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
      lines.push(`${n} = ImageMobject("${resolveAsset(obj, 'png')}").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
      break;
    case 'svg_asset':
      lines.push(`${n} = SVGMobject("${resolveAsset(obj, 'svg')}").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`);
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
          if (g.tangent && g.tangent.enabled) {
            const tn = `${gn}_tangent`;
            const tx = Number.isFinite(g.tangent.x) ? g.tangent.x : (xMin + xMax) / 2;
            const alpha = (xMax > xMin) ? Math.max(0, Math.min(1, (tx - xMin) / (xMax - xMin))) : 0.5;
            const tlen = (Number.isFinite(g.tangent.length) && g.tangent.length > 0) ? g.tangent.length : 2;
            const tcol = hex(g.tangent.color) || col;
            lines.push(`${tn} = TangentLine(${gn}, alpha=${alpha.toFixed(3)}, length=${tlen}, color=${tcol})`);
            lines.push(`${n}.add(${tn})`);
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
    case 'complex_plane': {
      const xr = obj.xRange || [-3, 3, 1];
      const yr = obj.yRange || [-2, 2, 1];
      lines.push(`${n} = ComplexPlane(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2] ?? 1}], x_length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)}, y_length=${(obj.height / sh * FRAME_HEIGHT).toFixed(1)})`);
      break;
    }
    case 'polar_plane': {
      const rMax = Number.isFinite(obj.radiusMax) ? obj.radiusMax : 4;
      const rStep = Number.isFinite(obj.radiusStep) ? obj.radiusStep : 1;
      const az = Number.isFinite(obj.azimuthUnits) ? Math.max(1, Math.trunc(obj.azimuthUnits)) : 12;
      lines.push(`${n} = PolarPlane(radius_max=${rMax}, radius_step=${rStep}, azimuth_units=${az}, size=${(Math.min(obj.width, obj.height) / sw * FRAME_WIDTH).toFixed(1)})`);
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
