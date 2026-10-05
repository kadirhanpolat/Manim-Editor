// Pure axes Konva config builders.
// Each function takes (obj[, extra], ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.

import { compileExpr } from '../../../engine/mathExpr.js';
import { FRAME_WIDTH, RIEMANN_FILL_OPACITY } from '@manim/codegen';
import { latexToUnicode } from '../../../utils/latexPreview.js';
import type { SceneObject } from '@manim/codegen';
import type { StageCtx } from './context.js';

export function axesBgCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const ow = obj.width as number,
    oh = obj.height as number;
  const w = L ? L.w : ow * ctx.vs,
    h = L ? L.h : oh * ctx.vs;
  // listening:true → this rect is the group's hit area so the axes can be
  // selected/dragged on the canvas (the lines/ticks/labels stay non-listening).
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: 'rgba(16,185,129,0.04)',
    stroke: 'rgba(16,185,129,0.15)',
    strokeWidth: 1,
    cornerRadius: 4,
    listening: true,
  };
}

// Shared geometry for the axes preview, mirroring Manim's Axes: the axes cross
// at the origin (0 clamped into each range), span the full width/height, and
// value → canvas mapping is linear over the ranges.
function axesFrame(obj: SceneObject, ctx: StageCtx) {
  const L = ctx.live(obj);
  const w = L ? L.w : (obj.width as number) * ctx.vs;
  const h = L ? L.h : (obj.height as number) * ctx.vs;
  const xr = (obj.xRange as number[] | undefined) || [-5, 5, 1];
  const yr = (obj.yRange as number[] | undefined) || [-3, 3, 1];
  const spanX = xr[1]! - xr[0]! || 1; // an empty range must not divide by zero
  const spanY = yr[1]! - yr[0]! || 1;
  const toCx = (x: number) => clean(((x - xr[0]!) / spanX) * w - w / 2);
  const toCy = (y: number) => clean(-((y - yr[0]!) / spanY) * h + h / 2);
  const gx = planeGridValues(xr[0]!, xr[1]!, xr[2]!);
  const gy = planeGridValues(yr[0]!, yr[1]!, yr[2]!);
  return { w, h, xr, yr, toCx, toCy, gx, gy, ox: toCx(gx.origin), oy: toCy(gy.origin) };
}

const axisStroke = (obj: SceneObject) => (obj.stroke as string | undefined) || '#ffffff';

export function axesXLineCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const f = axesFrame(obj, ctx);
  return {
    points: [-f.w / 2, f.oy, f.w / 2, f.oy],
    stroke: axisStroke(obj),
    strokeWidth: 1.5,
    listening: false,
  };
}

export function axesYLineCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const f = axesFrame(obj, ctx);
  return {
    points: [f.ox, f.h / 2, f.ox, -f.h / 2],
    stroke: axisStroke(obj),
    strokeWidth: 1.5,
    listening: false,
  };
}

export function axesXArrowCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const f = axesFrame(obj, ctx);
  const tip = f.w / 2;
  return {
    points: [tip - 8, f.oy - 5, tip, f.oy, tip - 8, f.oy + 5],
    stroke: axisStroke(obj),
    strokeWidth: 1.5,
    listening: false,
  };
}

export function axesYArrowCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const f = axesFrame(obj, ctx);
  const tip = -f.h / 2;
  return {
    points: [f.ox - 5, tip + 8, f.ox, tip, f.ox + 5, tip + 8],
    stroke: axisStroke(obj),
    strokeWidth: 1.5,
    listening: false,
  };
}

// Ticks on the origin-aligned steps (the origin itself gets none).
export function axesXTicks(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const f = axesFrame(obj, ctx);
  return f.gx.values
    .filter((v) => v !== f.gx.origin)
    .map((v) => ({
      points: [f.toCx(v), f.oy - 4, f.toCx(v), f.oy + 4],
      stroke: axisStroke(obj),
      strokeWidth: 1,
      listening: false,
    }));
}

export function axesYTicks(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const f = axesFrame(obj, ctx);
  return f.gy.values
    .filter((v) => v !== f.gy.origin)
    .map((v) => ({
      points: [f.ox - 4, f.toCy(v), f.ox + 4, f.toCy(v)],
      stroke: axisStroke(obj),
      strokeWidth: 1,
      listening: false,
    }));
}

export function axesLabelCfg(
  obj: SceneObject,
  axis: string,
  ctx: StageCtx
): Record<string, unknown> {
  const f = axesFrame(obj, ctx);
  const base = {
    fontSize: 12,
    fill: axisStroke(obj),
    fontFamily: 'serif',
    fontStyle: 'italic',
    listening: false,
  };
  if (axis === 'x') return { ...base, x: f.w / 2 - 20, y: f.oy + 6, text: 'x' };
  return { ...base, x: f.ox + 6, y: -f.h / 2 + 12, text: 'y' };
}

// Each graph is plotted over its own [xMin, xMax] (codegen: plot(x_range=…)).
export function axesGraphCurves(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const graphs = obj.graphs as Array<Record<string, unknown>> | undefined;
  if (!graphs || graphs.length === 0) return [];
  const f = axesFrame(obj, ctx);
  const curves: Record<string, unknown>[] = [];
  for (const graph of graphs) {
    const fn = compileExpr(graph.expression as string, 'x');
    if (!fn) continue;
    const g0 = Number.isFinite(graph.xMin as number) ? (graph.xMin as number) : f.xr[0]!;
    const g1 = Number.isFinite(graph.xMax as number) ? (graph.xMax as number) : f.xr[1]!;
    const steps = 80;
    const points: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = g0 + (g1 - g0) * (i / steps);
      let y: number;
      try {
        y = fn(x);
      } catch {
        continue;
      }
      if (!Number.isFinite(y)) continue;
      const cx = f.toCx(x);
      const cy = f.toCy(y);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      points.push(cx, cy);
    }
    if (points.length >= 4) {
      curves.push({
        points,
        stroke: (graph.color as string | undefined) || '#f59e0b',
        strokeWidth: (graph.strokeWidth as number | undefined) || 3,
        listening: false,
        tension: 0.3,
      });
    }
  }
  return curves;
}

export function axesAreaRiemann(
  obj: SceneObject,
  ctx: StageCtx
): {
  areas: Record<string, unknown>[];
  rects: Record<string, unknown>[];
  tangents: Record<string, unknown>[];
} {
  const graphs = obj.graphs as Array<Record<string, unknown>> | undefined;
  if (!graphs || graphs.length === 0) return { areas: [], rects: [], tangents: [] };
  const xr = (obj.xRange as number[] | undefined) || [-5, 5, 1],
    yr = (obj.yRange as number[] | undefined) || [-3, 3, 1];
  const xMin = xr[0],
    xMax = xr[1],
    yMin = yr[0],
    yMax = yr[1];
  const pw = (obj.width as number) * ctx.vs,
    ph = (obj.height as number) * ctx.vs;
  const toCx = (x: number) => ((x - xMin) / (xMax - xMin)) * pw - pw / 2;
  const toCy = (y: number) => -((y - yMin) / (yMax - yMin)) * ph + ph / 2;
  const cy0 = toCy(0);
  const areas: Record<string, unknown>[] = [],
    rects: Record<string, unknown>[] = [],
    tangents: Record<string, unknown>[] = [];
  for (const graph of graphs) {
    const fn = compileExpr(graph.expression as string, 'x');
    if (!fn) continue;
    const area = graph.area as Record<string, unknown> | undefined;
    if (area && area.enabled) {
      const a0 = Number.isFinite(area.xMin as number) ? (area.xMin as number) : xMin;
      const a1 = Number.isFinite(area.xMax as number) ? (area.xMax as number) : xMax;
      const pts: number[] = [];
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const x = a0 + (a1 - a0) * (i / steps);
        const y = fn(x);
        if (!Number.isFinite(y)) continue;
        pts.push(toCx(x), toCy(y));
      }
      if (pts.length >= 4) {
        pts.push(toCx(a1), cy0, toCx(a0), cy0); // close down to the x-axis
        areas.push({
          points: pts,
          closed: true,
          fill:
            (area.color as string | undefined) || (graph.color as string | undefined) || '#f59e0b',
          opacity: (area.opacity as number | undefined) ?? 0.5,
          listening: false,
        });
      }
    }
    const riemann = graph.riemann as Record<string, unknown> | undefined;
    if (riemann && riemann.enabled) {
      const r0 = Number.isFinite(riemann.xMin as number) ? (riemann.xMin as number) : xMin;
      const r1 = Number.isFinite(riemann.xMax as number) ? (riemann.xMax as number) : xMax;
      const dxRaw = riemann.dx as number | undefined;
      const dx =
        Number.isFinite(dxRaw) && (dxRaw as number) > 0 ? (dxRaw as number) : (r1 - r0) / 10;
      const type = (riemann.type as string | undefined) || 'left';
      for (let x = r0; x < r1 - 1e-9; x += dx) {
        const sx = type === 'right' ? x + dx : type === 'center' ? x + dx / 2 : x;
        const y = fn(sx);
        if (!Number.isFinite(y)) continue;
        const left = toCx(x),
          right = toCx(Math.min(x + dx, r1));
        rects.push({
          x: left,
          y: toCy(y),
          width: right - left,
          height: cy0 - toCy(y),
          fill:
            (riemann.color as string | undefined) ||
            (graph.color as string | undefined) ||
            '#f59e0b',
          opacity: RIEMANN_FILL_OPACITY,
          stroke: '#fff',
          strokeWidth: 0.5,
          listening: false,
        });
      }
    }
    const tangent = graph.tangent as Record<string, unknown> | undefined;
    if (tangent && tangent.enabled) {
      const txVal = Number.isFinite(tangent.x as number)
        ? (tangent.x as number)
        : (xMin + xMax) / 2;
      const h = (xMax - xMin) / 1000;
      const y0 = fn(txVal),
        slope = (fn(txVal + h) - fn(txVal - h)) / (2 * h);
      if (Number.isFinite(y0) && Number.isFinite(slope)) {
        const dCx = pw / (xMax - xMin),
          dCy = (-slope * ph) / (yMax - yMin);
        const len = Math.hypot(dCx, dCy) || 1;
        const tangentLen = tangent.length as number | undefined;
        const half =
          ((Number.isFinite(tangentLen) ? (tangentLen as number) : 2) * pw) / (xMax - xMin) / 2;
        const ux = dCx / len,
          uy = dCy / len;
        const cx = toCx(txVal),
          cyy = toCy(y0);
        tangents.push({
          points: [cx - ux * half, cyy - uy * half, cx + ux * half, cyy + uy * half],
          stroke:
            (tangent.color as string | undefined) ||
            (graph.color as string | undefined) ||
            '#f59e0b',
          strokeWidth: 2,
          listening: false,
        });
      }
    }
  }
  return { areas, rects, tangents };
}

// ── NumberPlane / ComplexPlane grid ─────────────────────────────────────────
// Mirrors Manim's NumberPlane: the axis origin is 0 clamped into the range;
// background lines step out from it by the range step, and the range ends
// themselves get no line. Colors are Manim's defaults (BLUE_D lines, white axes).
export const PLANE_GRID_COLOR = '#29ABCA';
export const PLANE_AXIS_COLOR = '#FFFFFF';

const clean = (v: number) => Number(v.toFixed(10)) || 0;

// More lines than this per axis are unreadable anyway; a tiny step (0.001
// over -5..5) would otherwise build thousands of Konva lines per render.
const MAX_GRID_LINES = 200;

export function planeGridValues(
  min: number,
  max: number,
  rawStep: number
): { origin: number; values: number[] } {
  const origin = Math.min(max, Math.max(min, 0));
  if (!(rawStep > 0)) return { origin, values: [origin] };
  const step = rawStep * Math.max(1, Math.ceil((max - min) / rawStep / MAX_GRID_LINES));
  const values = [origin];
  for (let v = origin + step; v < max - 1e-9; v += step) values.push(clean(v));
  for (let v = origin - step; v > min + 1e-9; v -= step) values.unshift(clean(v));
  return { origin, values };
}

export function planeGridCfgs(
  obj: SceneObject,
  ctx: StageCtx
): { grid: Record<string, unknown>[]; axes: Record<string, unknown>[] } {
  // Same frame as the axes (live size during a resize, clamped origin).
  const { w, h, toCx, toCy, gx, gy } = axesFrame(obj, ctx);
  const line = (points: number[], stroke: string, strokeWidth: number) => ({
    points,
    stroke,
    strokeWidth,
    listening: false,
  });
  const grid = [
    ...gx.values.map((x) => line([toCx(x), -h / 2, toCx(x), h / 2], PLANE_GRID_COLOR, 1)),
    ...gy.values.map((y) => line([-w / 2, toCy(y), w / 2, toCy(y)], PLANE_GRID_COLOR, 1)),
  ];
  const axes = [
    line([-w / 2, toCy(gy.origin), w / 2, toCy(gy.origin)], PLANE_AXIS_COLOR, 1.5),
    line([toCx(gx.origin), -h / 2, toCx(gx.origin), h / 2], PLANE_AXIS_COLOR, 1.5),
  ];
  return { grid, axes };
}

// ── axis_point: a point placed by its value on an axes object ───────────────
const AXIS_POINT_TARGETS = new Set(['axes', 'numberplane', 'complex_plane']);
const MATHTEX_FONT_SIZE = 48;
const NEXT_TO_BUFF = 0.1; // Manim units, as in next_to(dot, UR, buff=0.1)

export function axisPointCfgs(
  obj: SceneObject,
  ctx: StageCtx
): {
  dot: { x: number; y: number; radius: number; fill: string; listening: boolean };
  guides: Record<string, unknown>[];
  label: Record<string, unknown> | null;
} | null {
  const target = ctx.objectById?.((obj.targetId as string) || '');
  if (!target || !AXIS_POINT_TARGETS.has(target.type)) return null;
  const f = axesFrame(target, ctx);
  const L = ctx.live(target);
  const e = ctx.eff(target);
  const c = L ? { x: L.x, y: L.y } : ctx.s2c((e.x as number) ?? 0, (e.y as number) ?? 0);
  const x = c.x + f.toCx(Number(obj.valueX) || 0);
  const y = c.y + f.toCy(Number(obj.valueY) || 0);
  const fill = (obj.fill as string | undefined) || '#f97316';
  const radius = (((obj.width as number | undefined) ?? 22) / 2) * ctx.vs;
  const guides = obj.showGuides
    ? [
        [x, c.y + f.oy, x, y], // down to the x-axis
        [c.x + f.ox, y, x, y], // across to the y-axis
      ].map((points) => ({ points, stroke: fill, strokeWidth: 2, dash: [6, 4], listening: false }))
    : [];
  const text = latexToUnicode((obj.label as string | undefined) || '');
  let label: Record<string, unknown> | null = null;
  if (text) {
    const fontSize = MATHTEX_FONT_SIZE * ctx.vs;
    const buff = NEXT_TO_BUFF * ((ctx.stg.width as number) / FRAME_WIDTH) * ctx.vs;
    label = {
      x: x + radius + buff,
      y: y - radius - buff - fontSize,
      text,
      fontSize,
      fontFamily: 'serif',
      fontStyle: 'italic',
      fill,
      listening: false,
    };
  }
  return { dot: { x, y, radius, fill, listening: false }, guides, label };
}
