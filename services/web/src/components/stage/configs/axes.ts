// Pure axes Konva config builders.
// Each function takes (obj[, extra], ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.

import { compileExpr } from '../../../engine/mathExpr.js';
import type { SceneObject } from '@manim/codegen';
import type { StageCtx } from './context.js';

export function axesBgCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const ow = obj.width as number, oh = obj.height as number;
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

export function axesXLineCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const ow = obj.width as number;
  const w = L ? L.w : ow * ctx.vs;
  return {
    points: [-w / 2 + 10, 0, w / 2 - 10, 0],
    stroke: (obj.stroke as string | undefined) || '#ffffff',
    strokeWidth: 1.5,
    listening: false,
  };
}

export function axesYLineCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const oh = obj.height as number;
  const h = L ? L.h : oh * ctx.vs;
  return {
    points: [0, h / 2 - 10, 0, -h / 2 + 10],
    stroke: (obj.stroke as string | undefined) || '#ffffff',
    strokeWidth: 1.5,
    listening: false,
  };
}

export function axesXArrowCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const ow = obj.width as number;
  const w = L ? L.w : ow * ctx.vs;
  const tip = w / 2 - 10;
  return {
    points: [tip - 8, -5, tip, 0, tip - 8, 5],
    stroke: (obj.stroke as string | undefined) || '#ffffff',
    strokeWidth: 1.5,
    listening: false,
  };
}

export function axesYArrowCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const oh = obj.height as number;
  const h = L ? L.h : oh * ctx.vs;
  const tip = -h / 2 + 10;
  return {
    points: [-5, tip + 8, 0, tip, 5, tip + 8],
    stroke: (obj.stroke as string | undefined) || '#ffffff',
    strokeWidth: 1.5,
    listening: false,
  };
}

export function axesXTicks(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const L = ctx.live(obj);
  const ow = obj.width as number;
  const w = L ? L.w : ow * ctx.vs;
  const xr = (obj.xRange as number[] | undefined) || [-5, 5, 1];
  const ticks: Record<string, unknown>[] = [];
  const range = xr[1] - xr[0];
  const step = xr[2] || 1;
  for (let v = xr[0]; v <= xr[1]; v += step) {
    if (Math.abs(v) < 0.001) continue;
    const px = ((v - xr[0]) / range - 0.5) * (w - 20);
    ticks.push({
      points: [px, -4, px, 4],
      stroke: (obj.stroke as string | undefined) || '#ffffff',
      strokeWidth: 1,
      listening: false,
    });
  }
  return ticks;
}

export function axesYTicks(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const L = ctx.live(obj);
  const oh = obj.height as number;
  const h = L ? L.h : oh * ctx.vs;
  const yr = (obj.yRange as number[] | undefined) || [-3, 3, 1];
  const ticks: Record<string, unknown>[] = [];
  const range = yr[1] - yr[0];
  const step = yr[2] || 1;
  for (let v = yr[0]; v <= yr[1]; v += step) {
    if (Math.abs(v) < 0.001) continue;
    const py = -((v - yr[0]) / range - 0.5) * (h - 20);
    ticks.push({
      points: [-4, py, 4, py],
      stroke: (obj.stroke as string | undefined) || '#ffffff',
      strokeWidth: 1,
      listening: false,
    });
  }
  return ticks;
}

export function axesLabelCfg(obj: SceneObject, axis: string, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const ow = obj.width as number, oh = obj.height as number;
  const w = L ? L.w : ow * ctx.vs,
    h = L ? L.h : oh * ctx.vs;
  if (axis === 'x') {
    return {
      x: w / 2 - 20,
      y: 6,
      text: 'x',
      fontSize: 12,
      fill: (obj.stroke as string | undefined) || '#ffffff',
      fontFamily: 'serif',
      fontStyle: 'italic',
      listening: false,
    };
  }
  return {
    x: 6,
    y: -h / 2 + 12,
    text: 'y',
    fontSize: 12,
    fill: (obj.stroke as string | undefined) || '#ffffff',
    fontFamily: 'serif',
    fontStyle: 'italic',
    listening: false,
  };
}

export function axesGraphCurves(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const graphs = obj.graphs as Array<Record<string, unknown>> | undefined;
  if (!graphs || graphs.length === 0) return [];
  const curves: Record<string, unknown>[] = [];
  const xr = (obj.xRange as number[] | undefined) || [-5, 5, 1];
  const yr = (obj.yRange as number[] | undefined) || [-3, 3, 1];
  const xMin = xr[0],
    xMax = xr[1];
  const yMin = yr[0],
    yMax = yr[1];
  const pw = (obj.width as number) * ctx.vs;
  const ph = (obj.height as number) * ctx.vs;

  for (const graph of graphs) {
    const fn = compileExpr(graph.expression as string, 'x');
    if (!fn) continue;

    const steps = 80;
    const points: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (xMax - xMin) * (i / steps);
      let y: number;
      try {
        y = fn(x);
      } catch {
        continue;
      }
      if (!Number.isFinite(y)) continue;
      const cx = ((x - xMin) / (xMax - xMin)) * pw - pw / 2;
      const cy = -((y - yMin) / (yMax - yMin)) * ph + ph / 2;
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
): { areas: Record<string, unknown>[]; rects: Record<string, unknown>[]; tangents: Record<string, unknown>[] } {
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
          fill: (area.color as string | undefined) || (graph.color as string | undefined) || '#f59e0b',
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
        Number.isFinite(dxRaw) && (dxRaw as number) > 0
          ? (dxRaw as number)
          : (r1 - r0) / 10;
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
          fill: (riemann.color as string | undefined) || (graph.color as string | undefined) || '#f59e0b',
          opacity: 0.45,
          stroke: '#fff',
          strokeWidth: 0.5,
          listening: false,
        });
      }
    }
    const tangent = graph.tangent as Record<string, unknown> | undefined;
    if (tangent && tangent.enabled) {
      const txVal = Number.isFinite(tangent.x as number) ? (tangent.x as number) : (xMin + xMax) / 2;
      const h = (xMax - xMin) / 1000;
      const y0 = fn(txVal),
        slope = (fn(txVal + h) - fn(txVal - h)) / (2 * h);
      if (Number.isFinite(y0) && Number.isFinite(slope)) {
        const dCx = pw / (xMax - xMin),
          dCy = (-slope * ph) / (yMax - yMin);
        const len = Math.hypot(dCx, dCy) || 1;
        const tangentLen = tangent.length as number | undefined;
        const half =
          ((Number.isFinite(tangentLen) ? (tangentLen as number) : 2) * pw) /
          (xMax - xMin) /
          2;
        const ux = dCx / len,
          uy = dCy / len;
        const cx = toCx(txVal),
          cyy = toCy(y0);
        tangents.push({
          points: [cx - ux * half, cyy - uy * half, cx + ux * half, cyy + uy * half],
          stroke: (tangent.color as string | undefined) || (graph.color as string | undefined) || '#f59e0b',
          strokeWidth: 2,
          listening: false,
        });
      }
    }
  }
  return { areas, rects, tangents };
}
