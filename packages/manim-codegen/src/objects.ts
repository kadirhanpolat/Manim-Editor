import {
  vn,
  hex,
  safeNum,
  safeOpacity,
  safeText,
  safeLatex,
  safeMathExpr,
  latexUnit,
  safeMatrixEntry,
  matrixBrackets,
  pyMultiline,
  fillOpacityExpr,
  strokeOpacityArg,
  gradientLine,
  dashedLines,
  roundCornersLine,
  shadowLines,
  stageToManim,
} from './helpers.js';
import {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  FRAME_X_RADIUS,
  FRAME_Y_RADIUS,
  GRADIENT_TYPES,
  ANNOTATION_TYPES,
  CODE_LANGUAGES,
} from './constants.js';
import type { SceneObject, GenerateOptions } from './types.js';

// ── Object code (single object definition) ──────────────────────────────────

export function objectCode(
  o: SceneObject,
  sw: number,
  sh: number,
  { resolveAsset }: GenerateOptions
): string[] {
  const n = vn(o.id),
    lines: string[] = [];
  const scale = (Math.min(o.width as number, o.height as number) / sw) * FRAME_WIDTH;
  const mp = stageToManim(o.x ?? 0, o.y ?? 0, sw, sh);

  // Helpers for this object
  const fill = hex(o.fill) || '"#FFFFFF"';
  const stroke = hex(o.stroke) || '"#FFFFFF"';
  const opacity = safeOpacity(o.opacity);
  const sw2 = safeNum(o.strokeWidth, 2);
  const hasFill = hex(o.fill) !== null;
  const hasStroke = hex(o.stroke) !== null;

  switch (o.type) {
    case 'heart': {
      const mw = (((o.width as number) / sw) * FRAME_X_RADIUS).toFixed(3);
      const mh = (((o.height as number) / sh) * FRAME_Y_RADIUS).toFixed(3);
      lines.push(`${n} = ParametricFunction(`);
      lines.push(
        `    lambda t: np.array([np.sin(t)**3 * ${mw}, (13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t))/15 * ${mh}, 0]),`
      );
      lines.push(`    t_range=[0, 2*PI], color=${stroke})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      break;
    }
    case 'rectangle':
      {
        const rw = ((o.width as number) / sw) * FRAME_WIDTH,
          rh = ((o.height as number) / sh) * FRAME_HEIGHT;
        if ((o.cornerRadius ?? 0) > 0) {
          const cr = Math.min(
            ((o.cornerRadius as number) / sw) * FRAME_WIDTH,
            Math.min(rw, rh) / 2 - 0.001
          );
          lines.push(
            `${n} = RoundedRectangle(corner_radius=${cr.toFixed(3)}, width=${rw.toFixed(3)}, height=${rh.toFixed(3)})`
          );
        } else {
          lines.push(`${n} = Rectangle(width=${rw.toFixed(3)}, height=${rh.toFixed(3)})`);
        }
      }
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    case 'square':
      if ((o.cornerRadius ?? 0) > 0) {
        const cr = Math.min(((o.cornerRadius as number) / sw) * FRAME_WIDTH, scale / 2 - 0.001);
        lines.push(
          `${n} = RoundedRectangle(corner_radius=${cr.toFixed(3)}, width=${scale.toFixed(3)}, height=${scale.toFixed(3)})`
        );
      } else {
        lines.push(`${n} = Square(side_length=${scale.toFixed(3)})`);
      }
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    case 'circle':
      lines.push(`${n} = Circle(radius=${(scale / 2).toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    case 'annulus': {
      const ri = (safeNum(o.innerRadius, 35) / sw) * FRAME_WIDTH;
      const ro = (safeNum(o.outerRadius, 70) / sw) * FRAME_WIDTH;
      lines.push(`${n} = Annulus(inner_radius=${ri.toFixed(3)}, outer_radius=${ro.toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    }
    case 'arc': {
      const r = (safeNum(o.radius, 70) / sw) * FRAME_WIDTH;
      lines.push(
        `${n} = Arc(radius=${r.toFixed(3)}, start_angle=${+((o.startAngle as number | undefined) ?? 0)} * DEGREES, angle=${+((o.sweepAngle as number | undefined) ?? 0)} * DEGREES)`
      );
      lines.push(
        `${n}.set_stroke(color=${hex(o.stroke) || hex(o.fill) || '"#FFFFFF"'}, width=${sw2}${strokeOpacityArg(o, opacity)})`
      );
      break;
    }
    case 'sector': {
      const r = (safeNum(o.radius, 70) / sw) * FRAME_WIDTH;
      lines.push(
        `${n} = Sector(radius=${r.toFixed(3)}, start_angle=${+((o.startAngle as number | undefined) ?? 0)} * DEGREES, angle=${+((o.sweepAngle as number | undefined) ?? 0)} * DEGREES)`
      );
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    }
    case 'double_arrow': {
      const half = (((o.width as number) / 2 / sw) * FRAME_WIDTH).toFixed(3);
      lines.push(
        `${n} = DoubleArrow(start=LEFT * ${half}, end=RIGHT * ${half}, color=${hex(o.fill) || '"#EF4444"'}, buff=0, stroke_width=${sw2})`
      );
      break;
    }
    case 'ellipse':
      lines.push(
        `${n} = Ellipse(width=${(((o.width as number) / sw) * FRAME_WIDTH).toFixed(3)}, height=${(((o.height as number) / sh) * FRAME_HEIGHT).toFixed(3)})`
      );
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    case 'triangle':
      lines.push(`${n} = Triangle().scale(${scale.toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    case 'star': {
      const arms = safeNum(o.starArms, 5);
      const inner = safeNum(o.innerRatio, 0.4);
      lines.push(
        `${n} = Star(n=${arms}, outer_radius=${(scale / 2).toFixed(3)}, inner_radius=${((scale / 2) * inner).toFixed(3)})`
      );
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    }
    case 'polygon': {
      const sides = safeNum(o.sides, 6);
      lines.push(`${n} = RegularPolygon(n=${sides}).scale(${(scale / 2).toFixed(3)})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    }
    case 'polygon_free': {
      const verts: number[][] =
        Array.isArray(o.vertices) && (o.vertices as unknown[]).length >= 3
          ? (o.vertices as number[][])
          : [
              [-80, -60],
              [80, -60],
              [80, 60],
              [-80, 60],
            ];
      const pts = verts
        .map(
          ([vx, vy]) =>
            `[${((vx / sw) * FRAME_WIDTH).toFixed(3)}, ${((-vy / sh) * FRAME_HEIGHT).toFixed(3)}, 0]`
        )
        .join(', ');
      lines.push(`${n} = Polygon(${pts})`);
      if (hasFill)
        lines.push(`${n}.set_fill(color=${fill}, opacity=${fillOpacityExpr(o, opacity)})`);
      if (hasStroke)
        lines.push(`${n}.set_stroke(color=${stroke}, width=${sw2}${strokeOpacityArg(o, opacity)})`);
      break;
    }
    case 'bezier': {
      const verts: number[][] =
        Array.isArray(o.vertices) && (o.vertices as unknown[]).length >= 2
          ? (o.vertices as number[][])
          : [
              [-110, 30],
              [-40, -55],
              [40, 50],
              [110, -30],
            ];
      const pts = verts
        .map(
          ([vx, vy]) =>
            `[${((vx / sw) * FRAME_WIDTH).toFixed(3)}, ${((-vy / sh) * FRAME_HEIGHT).toFixed(3)}, 0]`
        )
        .join(', ');
      lines.push(`${n} = VMobject()`);
      lines.push(`${n}.set_points_smoothly([${pts}])`);
      lines.push(
        `${n}.set_stroke(color=${stroke || hex(o.fill) || '"#F472B6"'}, width=${sw2}${strokeOpacityArg(o, opacity)})`
      );
      break;
    }
    case 'parametric': {
      const xe = safeMathExpr(o.xExpr, 't');
      const ye = safeMathExpr(o.yExpr, '0');
      const t0 = Number.isFinite(o.tMin as number | undefined) ? (o.tMin as number) : 0;
      const t1 = Number.isFinite(o.tMax as number | undefined) ? (o.tMax as number) : 6.283;
      const col = hex(o.stroke) || hex(o.fill) || '"#10B981"';
      lines.push(
        `${n} = ParametricFunction(lambda t: np.array([${xe}, ${ye}, 0]), t_range=[${t0}, ${t1}], color=${col}, stroke_width=${sw2})`
      );
      break;
    }
    case 'matrix': {
      const data: string[][] =
        Array.isArray(o.matrixData) &&
        (o.matrixData as unknown[]).length &&
        Array.isArray((o.matrixData as unknown[][])[0])
          ? (o.matrixData as string[][])
          : [
              ['1', '0'],
              ['0', '1'],
            ];
      const body = data
        .map((row: string[]) => `[${row.map((c: string) => `"${safeMatrixEntry(c)}"`).join(', ')}]`)
        .join(', ');
      lines.push(`${n} = Matrix([${body}]${matrixBrackets(o.bracket as string | undefined)})`);
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'table': {
      const data: string[][] =
        Array.isArray(o.cellData) &&
        (o.cellData as unknown[]).length &&
        Array.isArray((o.cellData as unknown[][])[0])
          ? (o.cellData as string[][])
          : [
              ['1', '2'],
              ['3', '4'],
            ];
      const body = data
        .map((row: string[]) => `[${row.map((c: string) => `"${safeMatrixEntry(c)}"`).join(', ')}]`)
        .join(', ');
      const cls = o.mathMode ? 'MathTable' : 'Table';
      const wrap = o.mathMode ? 'MathTex' : 'Text';
      const labelArr = (arr: string[]) =>
        `[${arr.map((s: string) => `${wrap}("${safeMatrixEntry(s)}")`).join(', ')}]`;
      let args = `[${body}]`;
      if (Array.isArray(o.rowLabels) && (o.rowLabels as string[]).length)
        args += `, row_labels=${labelArr(o.rowLabels as string[])}`;
      if (Array.isArray(o.colLabels) && (o.colLabels as string[]).length)
        args += `, col_labels=${labelArr(o.colLabels as string[])}`;
      lines.push(`${n} = ${cls}(${args})`);
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'graph': {
      const verts = (Array.isArray(o.vertices) ? (o.vertices as unknown[]) : []).map((v) =>
        safeMatrixEntry(v)
      );
      const vlist = `[${verts.map((v) => `"${v}"`).join(', ')}]`;
      const edges = (Array.isArray(o.edges) ? (o.edges as unknown[]) : []).filter(
        (e) => Array.isArray(e) && (e as unknown[]).length === 2
      ) as [unknown, unknown][];
      const elist = `[${edges.map(([a, b]) => `("${safeMatrixEntry(a)}", "${safeMatrixEntry(b)}")`).join(', ')}]`;
      const pos = (o.positions as Record<string, number[]> | undefined) || {};
      const layout = `{${verts
        .map((v) => {
          const p = pos[v] || [0, 0];
          const mx = (p[0] / sw) * FRAME_WIDTH;
          const my = (-p[1] / sh) * FRAME_HEIGHT;
          return `"${v}": [${mx.toFixed(3)}, ${my.toFixed(3)}, 0]`;
        })
        .join(', ')}}`;
      const cls = o.directed ? 'DiGraph' : 'Graph';
      const lbl = o.showLabels ? ', labels=True' : '';
      lines.push(`${n} = ${cls}(${vlist}, ${elist}, layout=${layout}${lbl})`);
      break;
    }
    case 'vector_field': {
      const fx = safeMathExpr(o.fx, 'y');
      const fy = safeMathExpr(o.fy, '-x');
      const xr = (o.xRange as number[] | undefined) || [-3, 3, 1];
      const yr = (o.yRange as number[] | undefined) || [-2, 2, 1];
      const xs = Number.isFinite(xr[2]) && xr[2] !== 0 ? xr[2] : 1;
      const ys = Number.isFinite(yr[2]) && yr[2] !== 0 ? yr[2] : 1;
      lines.push(
        `${n} = ArrowVectorField(lambda p: (lambda x, y: np.array([${fx}, ${fy}, 0]))(p[0], p[1]), x_range=[${xr[0]}, ${xr[1]}, ${xs}], y_range=[${yr[0]}, ${yr[1]}, ${ys}])`
      );
      break;
    }
    case 'brace': {
      const p1 = Array.isArray(o.p1) ? (o.p1 as number[]) : [-80, 0];
      const p2 = Array.isArray(o.p2) ? (o.p2 as number[]) : [80, 0];
      const a = `[${((p1[0] / sw) * FRAME_WIDTH).toFixed(3)}, ${((-p1[1] / sh) * FRAME_HEIGHT).toFixed(3)}, 0]`;
      const b = `[${((p2[0] / sw) * FRAME_WIDTH).toFixed(3)}, ${((-p2[1] / sh) * FRAME_HEIGHT).toFixed(3)}, 0]`;
      const label = ((o.label as string | undefined) || '').trim();
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
      const V = Array.isArray(o.vertex) ? (o.vertex as number[]) : [-40, 40];
      const P1 = Array.isArray(o.point1) ? (o.point1 as number[]) : [80, 40];
      const P2 = Array.isArray(o.point2) ? (o.point2 as number[]) : [-40, -60];
      const pt = (p: number[]) =>
        `[${((p[0] / sw) * FRAME_WIDTH).toFixed(3)}, ${((-p[1] / sh) * FRAME_HEIGHT).toFixed(3)}, 0]`;
      lines.push(`${n}_l1 = Line(${pt(V)}, ${pt(P1)})`);
      lines.push(`${n}_l2 = Line(${pt(V)}, ${pt(P2)})`);
      const ctor = o.rightAngle
        ? `RightAngle(${n}_l1, ${n}_l2)`
        : `Angle(${n}_l1, ${n}_l2, radius=${Number.isFinite(o.radius as number | undefined) ? o.radius : 0.6})`;
      const label = ((o.label as string | undefined) || '').trim();
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
      const tip = (vx: number, vy: number) =>
        `[${((vx / sw) * FRAME_WIDTH).toFixed(3)}, ${((-vy / sh) * FRAME_HEIGHT).toFixed(3)}, 0]`;
      const vcx = Number.isFinite(o.vx as number | undefined) ? (o.vx as number) : 120;
      const vcy = Number.isFinite(o.vy as number | undefined) ? (o.vy as number) : -80;
      const V = tip(vcx, vcy),
        VX0 = tip(vcx, 0),
        V0Y = tip(0, vcy);
      const col = hex(o.fill) || '"#3b82f6"';
      lines.push(`${n}_main = Arrow([0, 0, 0], ${V}, buff=0, color=${col})`);
      lines.push(`${n}_x = Arrow([0, 0, 0], ${VX0}, buff=0, color="#ef4444")`);
      lines.push(`${n}_y = Arrow([0, 0, 0], ${V0Y}, buff=0, color="#22c55e")`);
      lines.push(`${n}_dx = DashedLine(${V}, ${VX0})`);
      lines.push(`${n}_dy = DashedLine(${V}, ${V0Y})`);
      lines.push(`${n} = VGroup(${n}_main, ${n}_x, ${n}_y, ${n}_dx, ${n}_dy)`);
      break;
    }
    case 'ray': {
      const a = ((Number.isFinite(o.angle) ? (o.angle as number) : 30) * Math.PI) / 180;
      const L = Number.isFinite(o.length as number | undefined) ? (o.length as number) : 200;
      const VX = (((L * Math.cos(a)) / sw) * FRAME_WIDTH).toFixed(3);
      const VY = (((L * Math.sin(a)) / sh) * FRAME_HEIGHT).toFixed(3);
      const col = hex(o.fill) || '"#22d3ee"';
      lines.push(`${n}_dot = Dot([0, 0, 0], color=${col})`);
      lines.push(`${n}_ray = Arrow([0, 0, 0], [${VX}, ${VY}, 0], buff=0, color=${col})`);
      lines.push(`${n} = VGroup(${n}_dot, ${n}_ray)`);
      break;
    }
    case 'coord_point': {
      const col = hex(o.fill) || '"#fbbf24"';
      const d = Number.isFinite(o.decimals as number | undefined)
        ? Math.max(0, Math.trunc(o.decimals as number))
        : 1;
      lines.push(`${n}_dot = Dot([0, 0, 0], color=${col})`);
      lines.push(
        `${n}_label = always_redraw(lambda: MathTex(f"({${n}_dot.get_x():.${d}f}, {${n}_dot.get_y():.${d}f})").next_to(${n}_dot, UR, buff=0.15).set_color(${col}))`
      );
      lines.push(`${n} = VGroup(${n}_dot, ${n}_label)`);
      break;
    }
    case 'line':
      lines.push(
        `${n} = Line(LEFT * ${(((o.width as number) / 2 / sw) * FRAME_WIDTH).toFixed(3)}, RIGHT * ${(((o.width as number) / 2 / sw) * FRAME_WIDTH).toFixed(3)})`
      );
      lines.push(
        `${n}.set_stroke(color=${hex(o.stroke) || hex(o.fill) || '"#FFFFFF"'}, width=${safeNum(o.strokeWidth, 3)})`
      );
      break;
    case 'arrow': {
      const halfLen = (((o.width as number) / 2 / sw) * FRAME_WIDTH).toFixed(3);
      const tipLen = ((FRAME_X_RADIUS / sw) * FRAME_WIDTH).toFixed(3);
      lines.push(
        `${n} = Arrow(start=LEFT * ${halfLen}, end=RIGHT * ${halfLen}, color=${hex(o.fill) || '"#EF4444"'}, buff=0, tip_length=${tipLen}, stroke_width=${sw2}, max_tip_length_to_length_ratio=0.15)`
      );
      break;
    }
    case 'counter': {
      const val = Number.isFinite(o.value as number | undefined) ? (o.value as number) : 0;
      const unit = o.suffix ? `, unit="${latexUnit(o.suffix)}"` : '';
      if (o.useInteger) {
        lines.push(`${n} = Integer(${Math.trunc(val)}${unit})`);
      } else {
        const dec = Number.isFinite(o.numDecimals as number | undefined)
          ? Math.max(0, Math.trunc(o.numDecimals as number))
          : 0;
        lines.push(`${n} = DecimalNumber(${val}, num_decimal_places=${dec}${unit})`);
      }
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'code': {
      const lang = CODE_LANGUAGES.includes(o.language as string)
        ? (o.language as string)
        : 'python';
      const src = pyMultiline((o.codeText as string | undefined) ?? 'print("Hello")');
      const wM = (((o.width as number) || 480) / sw) * FRAME_WIDTH;
      // Single line (regex-parser requirement). fontSize is preview-only; render
      // size is width-driven via scale_to_fit_width (same mechanism as image/svg).
      // add_line_numbers=False matches the preview (which has no line numbers).
      lines.push(
        `${n} = Code(code_string="${src}", language="${lang}", add_line_numbers=False).scale_to_fit_width(${wM.toFixed(3)})`
      );
      break;
    }
    case 'bar_chart': {
      const rawValues = Array.isArray(o.values) ? (o.values as unknown[]) : [3, 5, 2, 6];
      const values = rawValues.map((v) => (Number.isFinite(v as number) ? (v as number) : 0));
      const rawNames = Array.isArray(o.barNames) ? (o.barNames as unknown[]) : [];
      const names = values.map((_, i) =>
        safeMatrixEntry(rawNames[i] ?? String.fromCharCode(65 + (i % 26)))
      );
      const rawColors = Array.isArray(o.barColors) ? (o.barColors as unknown[]) : [];
      const colors = values.map((_, i) => hex(rawColors[i]) || '"#58c4dd"');
      const yMax = safeNum(o.yMax, 8);
      const yStep = +(yMax / 5).toFixed(3);
      const xLen = (((o.width as number) || 600) / sw) * FRAME_WIDTH;
      const yLen = (((o.height as number) || 400) / sh) * FRAME_HEIGHT;
      lines.push(
        `${n} = BarChart(values=[${values.join(', ')}], bar_names=[${names.map((s) => `"${s}"`).join(', ')}], y_range=[0, ${yMax}, ${yStep}], bar_colors=[${colors.join(', ')}], x_length=${xLen.toFixed(1)}, y_length=${yLen.toFixed(1)})`
      );
      break;
    }
    case 'text': {
      const fontFamily = (o.fontFamily as string | undefined) || 'Roboto';
      lines.push(`# Font: ${fontFamily}`);
      lines.push(
        `${n} = Text("${safeText(o.content)}", font_size=${safeNum(o.fontSize, 48)}, color=${fill}, font="${fontFamily}")`
      );
      break;
    }
    case 'dot':
      lines.push(
        `${n} = Dot(radius=${(((o.width as number) / 2 / sw) * FRAME_X_RADIUS).toFixed(3)}, color=${fill})`
      );
      break;
    case 'dot_grid': {
      const c = safeNum(o.gridCols, 5),
        r = safeNum(o.gridRows, 5),
        sp = (safeNum(o.dotSpacing, 40) / sw) * FRAME_WIDTH;
      lines.push(
        `${n} = VGroup(*[Dot(radius=0.06).move_to([c*${sp.toFixed(3)}-${(((c - 1) * sp) / 2).toFixed(3)}, r*${sp.toFixed(3)}-${(((r - 1) * sp) / 2).toFixed(3)}, 0]) for r in range(${r}) for c in range(${c})])`
      );
      if (hasFill) lines.push(`${n}.set_color(${fill})`);
      break;
    }
    case 'image':
      lines.push(
        `${n} = ImageMobject("${resolveAsset(o, 'png')}").scale_to_fit_width(${(((o.width as number) / sw) * FRAME_WIDTH).toFixed(3)})`
      );
      break;
    case 'svg_asset':
      lines.push(
        `${n} = SVGMobject("${resolveAsset(o, 'svg')}").scale_to_fit_width(${(((o.width as number) / sw) * FRAME_WIDTH).toFixed(3)})`
      );
      break;
    case 'latex': {
      // Escape for a normal Python string (NOT raw): a single backslash in the
      // LaTeX (e.g. \int) must survive as one backslash so MathTex typesets the
      // command. Doubling here + a raw r"..." would emit \\int (a LaTeX line
      // break) and render literal "int".
      const texStr = ((o.latex as string | undefined) || 'E = mc^2')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ');
      lines.push(`${n} = MathTex("${texStr}", color=${fill})`);
      lines.push(`${n}.scale(${(scale * 2).toFixed(3)})`);
      break;
    }
    case 'axes': {
      const xr = (o.xRange as number[] | undefined) || [-5, 5, 1];
      const yr = (o.yRange as number[] | undefined) || [-3, 3, 1];
      lines.push(
        `${n} = Axes(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2] ?? 1}], x_length=${(((o.width as number) / sw) * FRAME_WIDTH).toFixed(1)}, y_length=${(((o.height as number) / sh) * FRAME_HEIGHT).toFixed(1)}, tips=True)`
      );
      if (o.graphs && (o.graphs as unknown[]).length > 0) {
        for (const g of o.graphs as GraphDef[]) {
          const gn = `${n}_graph_${g.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          const col = hex(g.color) || '"#F59E0B"';
          const xMin = Number.isFinite(g.xMin) ? g.xMin : xr[0];
          const xMax = Number.isFinite(g.xMax) ? g.xMax : xr[1];
          lines.push(
            `${gn} = ${n}.plot(lambda x: ${safeMathExpr(g.expression)}, x_range=[${xMin}, ${xMax}], color=${col}, stroke_width=${g.strokeWidth || 3})`
          );
          lines.push(`${n}.add(${gn})`);
          if (g.area && g.area.enabled) {
            const an = `${gn}_area`;
            const axMin = Number.isFinite(g.area.xMin) ? g.area.xMin : xMin;
            const axMax = Number.isFinite(g.area.xMax) ? g.area.xMax : xMax;
            const acol = hex(g.area.color) || col;
            const aop = Number.isFinite(g.area.opacity) ? g.area.opacity : 0.5;
            lines.push(
              `${an} = ${n}.get_area(${gn}, x_range=[${axMin}, ${axMax}], color=${acol}, opacity=${aop})`
            );
            lines.push(`${n}.add(${an})`);
          }
          if (g.riemann && g.riemann.enabled) {
            const rn = `${gn}_riemann`;
            const rxMin = Number.isFinite(g.riemann.xMin) ? g.riemann.xMin : xMin;
            const rxMax = Number.isFinite(g.riemann.xMax) ? g.riemann.xMax : xMax;
            const rdx =
              Number.isFinite(g.riemann.dx) && (g.riemann.dx ?? 0) > 0
                ? g.riemann.dx
                : ((rxMax ?? 0) - (rxMin ?? 0)) / 10;
            const rtype = ['left', 'right', 'center'].includes(g.riemann.type ?? '')
              ? g.riemann.type
              : 'left';
            const rcol = hex(g.riemann.color) || col;
            lines.push(
              `${rn} = ${n}.get_riemann_rectangles(${gn}, x_range=[${rxMin}, ${rxMax}], dx=${rdx}, input_sample_type="${rtype}", color=${rcol})`
            );
            lines.push(`${n}.add(${rn})`);
          }
          if (g.tangent && g.tangent.enabled) {
            const tn = `${gn}_tangent`;
            const tx = Number.isFinite(g.tangent.x) ? g.tangent.x : ((xMin ?? 0) + (xMax ?? 0)) / 2;
            const alpha =
              (xMax ?? 0) > (xMin ?? 0)
                ? Math.max(0, Math.min(1, ((tx ?? 0) - (xMin ?? 0)) / ((xMax ?? 0) - (xMin ?? 0))))
                : 0.5;
            const tlen =
              Number.isFinite(g.tangent.length) && (g.tangent.length ?? 0) > 0
                ? g.tangent.length
                : 2;
            const tcol = hex(g.tangent.color) || col;
            lines.push(
              `${tn} = TangentLine(${gn}, alpha=${alpha.toFixed(3)}, length=${tlen}, color=${tcol})`
            );
            lines.push(`${n}.add(${tn})`);
          }
        }
      }
      break;
    }
    case 'numberplane': {
      const xr = (o.xRange as number[] | undefined) || [-5, 5, 1];
      const yr = (o.yRange as number[] | undefined) || [-3, 3, 1];
      const xs = (o.xStep as number | undefined) || 1;
      const ys = (o.yStep as number | undefined) || 1;
      lines.push(
        `${n} = NumberPlane(x_range=[${xr[0]}, ${xr[1]}, ${xs}], y_range=[${yr[0]}, ${yr[1]}, ${ys}], x_length=${(((o.width as number) / sw) * FRAME_WIDTH).toFixed(1)}, y_length=${(((o.height as number) / sh) * FRAME_HEIGHT).toFixed(1)})`
      );
      break;
    }
    case 'complex_plane': {
      const xr = (o.xRange as number[] | undefined) || [-3, 3, 1];
      const yr = (o.yRange as number[] | undefined) || [-2, 2, 1];
      lines.push(
        `${n} = ComplexPlane(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2] ?? 1}], x_length=${(((o.width as number) / sw) * FRAME_WIDTH).toFixed(1)}, y_length=${(((o.height as number) / sh) * FRAME_HEIGHT).toFixed(1)})`
      );
      break;
    }
    case 'polar_plane': {
      const rMax = Number.isFinite(o.radiusMax as number | undefined) ? (o.radiusMax as number) : 4;
      const rStep = Number.isFinite(o.radiusStep as number | undefined)
        ? (o.radiusStep as number)
        : 1;
      const az = Number.isFinite(o.azimuthUnits as number | undefined)
        ? Math.max(1, Math.trunc(o.azimuthUnits as number))
        : 12;
      lines.push(
        `${n} = PolarPlane(radius_max=${rMax}, radius_step=${rStep}, azimuth_units=${az}, size=${((Math.min(o.width as number, o.height as number) / sw) * FRAME_WIDTH).toFixed(1)})`
      );
      break;
    }
    case 'numberline': {
      const xr = (o.xRange as number[] | undefined) || [-5, 5, 1];
      lines.push(
        `${n} = NumberLine(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], length=${(((o.width as number) / sw) * FRAME_WIDTH).toFixed(1)})`
      );
      break;
    }
    case 'surrounding_rect': {
      const target = vn((o.targetId as string) || '');
      const annColor = hex(o.color) || fill;
      const buffM = safeNum((((o.buff as number) ?? 10) / sw) * FRAME_WIDTH, 0.1);
      const crM = safeNum((((o.cornerRadius as number) ?? 0) / sw) * FRAME_WIDTH, 0);
      lines.push(
        `${n} = SurroundingRectangle(${target}, color=${annColor}, stroke_width=${sw2}, buff=${buffM.toFixed(3)}, corner_radius=${crM.toFixed(3)})`
      );
      break;
    }
    case 'underline': {
      const target = vn((o.targetId as string) || '');
      const annColor = hex(o.color) || fill;
      const buffM = safeNum((((o.buff as number) ?? 6) / sw) * FRAME_WIDTH, 0.05);
      lines.push(
        `${n} = Underline(${target}, color=${annColor}, stroke_width=${sw2}, buff=${buffM.toFixed(3)})`
      );
      break;
    }
    case 'cross': {
      const target = vn((o.targetId as string) || '');
      const annColor = hex(o.color) || fill;
      lines.push(`${n} = Cross(${target}, stroke_color=${annColor}, stroke_width=${sw2})`);
      break;
    }
    default:
      lines.push(`${n} = Circle(radius=0.5)  # ${o.type}`);
  }
  if (!ANNOTATION_TYPES.has(o.type)) {
    const rc = roundCornersLine(n, o, sw);
    if (rc) lines.push(rc);
    const gl = gradientLine(n, o);
    if (gl && GRADIENT_TYPES.has(o.type)) lines.push(gl);
    for (const dl of dashedLines(n, o)) lines.push(dl);
    for (const sl of shadowLines(n, o, sw, sh)) lines.push(sl);
    lines.push(`${n}.move_to([${mp.x.toFixed(3)}, ${mp.y.toFixed(3)}, 0])`);
    if (o.rotation) lines.push(`${n}.rotate(${((o.rotation * Math.PI) / 180).toFixed(4)})`);
  }
  return lines;
}

// ── Local helper types for axes graphs ──────────────────────────────────────

interface GraphAreaDef {
  enabled?: boolean;
  xMin?: number;
  xMax?: number;
  color?: string;
  opacity?: number;
}

interface GraphRiemannDef {
  enabled?: boolean;
  xMin?: number;
  xMax?: number;
  dx?: number;
  type?: string;
  color?: string;
}

interface GraphTangentDef {
  enabled?: boolean;
  x?: number;
  length?: number;
  color?: string;
}

interface GraphDef {
  id: string;
  expression?: unknown;
  color?: string;
  xMin?: number;
  xMax?: number;
  strokeWidth?: number;
  area?: GraphAreaDef;
  riemann?: GraphRiemannDef;
  tangent?: GraphTangentDef;
}
