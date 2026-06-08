// Pure 2D shape Konva config builders.
// Each function takes (obj, ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.
import { compileExpr } from '../../../engine/mathExpr.js';
import type { SceneObject } from '@manim/codegen';
import type { StageCtx } from './context.js';

export function rectCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number,
    eh = e.height as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c((e.x ?? 0) - ew / 2, (e.y ?? 0) - eh / 2);
  const w = L ? L.w : ew * ctx.vs,
    h = L ? L.h : eh * ctx.vs,
    rot = L ? L.rotation : e.rotation || 0;
  const cr = obj.cornerRadius as number | undefined;
  const crPx = (cr != null && cr > 0 ? cr : obj.type === 'square' ? 4 : 2) * ctx.vs;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    width: w,
    height: h,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: rot,
    scaleX: 1,
    scaleY: 1,
    cornerRadius: crPx,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  return ctx.applyEffects(cfg, obj, w, h, false);
}
export function circleCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number,
    eh = e.height as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const r = L ? Math.min(L.w, L.h) / 2 : (Math.min(ew, eh) / 2) * ctx.vs;
  const rot = L ? L.rotation : e.rotation || 0;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    radius: r,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: rot,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  return ctx.applyEffects(cfg, obj, r * 2, r * 2, true);
}
export function ellipseCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number,
    eh = e.height as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const rx = L ? L.w / 2 : (ew / 2) * ctx.vs,
    ry = L ? L.h / 2 : (eh / 2) * ctx.vs,
    rot = L ? L.rotation : e.rotation || 0;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    radiusX: rx,
    radiusY: ry,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: rot,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  return ctx.applyEffects(cfg, obj, rx * 2, ry * 2, true);
}
export function dotCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const p = ctx.s2c(e.x ?? 0, e.y ?? 0);
  return {
    x: p.x,
    y: p.y,
    radius: Math.max(4, ((e.width as number) / 2) * ctx.vs),
    fill: e.fill || '#fff',
    opacity: e.opacity ?? 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 12,
  };
}
export function heartCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number,
    eh = e.height as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const w = L ? L.w : ew * ctx.vs;
  const h = L ? L.h : eh * ctx.vs;
  const rot = L ? L.rotation : e.rotation || 0;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: rot,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
    sceneFunc: (ctx2: Record<string, unknown>, shape: unknown) => {
      const hw = w / 2,
        hh = h / 2;
      (ctx2.beginPath as () => void)();
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 2 * Math.PI;
        const px = ((16 * Math.pow(Math.sin(t), 3)) / 16) * hw;
        const py =
          -((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 15) *
          hh;
        if (i === 0) (ctx2.moveTo as (x: number, y: number) => void)(px, py);
        else (ctx2.lineTo as (x: number, y: number) => void)(px, py);
      }
      (ctx2.closePath as () => void)();
      (ctx2.fillStrokeShape as (shape: unknown) => void)(shape);
    },
  };
  return ctx.applyEffects(cfg, obj, w, h, true);
}
export function triangleCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number,
    eh = e.height as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const hw = L ? L.w / 2 : (ew / 2) * ctx.vs,
    hh = L ? L.h / 2 : (eh / 2) * ctx.vs,
    rot = L ? L.rotation : e.rotation || 0;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    points: [0, -hh, hw, hh, -hw, hh],
    closed: true,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: rot,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  return ctx.applyEffects(cfg, obj, hw * 2, hh * 2, true);
}
export function polygonFreeCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const p = ctx.s2c(e.x ?? 0, e.y ?? 0);
  const rawVerts = obj.vertices as [number, number][] | undefined;
  const verts: [number, number][] =
    Array.isArray(rawVerts) && rawVerts.length >= 3
      ? rawVerts
      : [
          [-80, -60],
          [80, -60],
          [80, 60],
          [-80, 60],
        ];
  const pts = verts.flatMap(([vx, vy]) => [vx * ctx.vs, vy * ctx.vs]);
  const xs = verts.map((v) => v[0]),
    ys = verts.map((v) => v[1]);
  const w = (Math.max(...xs) - Math.min(...xs)) * ctx.vs,
    h = (Math.max(...ys) - Math.min(...ys)) * ctx.vs;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    points: pts,
    closed: true,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: e.rotation || 0,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  return ctx.applyEffects(cfg, obj, w, h, true);
}
// bezier: a smooth open curve through the anchor vertices (Konva tension).
export function bezierCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const p = ctx.s2c(e.x ?? 0, e.y ?? 0);
  const rawVerts = obj.vertices as [number, number][] | undefined;
  const verts: [number, number][] =
    Array.isArray(rawVerts) && rawVerts.length >= 2
      ? rawVerts
      : [
          [-110, 30],
          [-40, -55],
          [40, 50],
          [110, -30],
        ];
  const pts = verts.flatMap(([vx, vy]) => [vx * ctx.vs, vy * ctx.vs]);
  return {
    x: p.x,
    y: p.y,
    points: pts,
    closed: false,
    tension: 0.5,
    stroke: e.stroke || '#f472b6',
    strokeWidth: (((e.strokeWidth as number | undefined) || 3) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: e.rotation || 0,
    lineCap: 'round',
    lineJoin: 'round',
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 12,
  };
}

export function parametricCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const c = ctx.s2c(e.x ?? 0, e.y ?? 0);
  const fx = compileExpr((obj.xExpr as string | undefined) || 'np.cos(t)', 't');
  const fy = compileExpr((obj.yExpr as string | undefined) || 'np.sin(t)', 't');
  const tMinVal = obj.tMin as number | undefined;
  const tMaxVal = obj.tMax as number | undefined;
  const t0 = Number.isFinite(tMinVal) ? (tMinVal as number) : 0;
  const t1 = Number.isFinite(tMaxVal) ? (tMaxVal as number) : 6.283;
  const unit = (ctx.stg.width / 14.222) * ctx.vs; // px per Manim unit
  const pts: number[] = [];
  if (fx && fy && t1 > t0) {
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (t1 - t0) * (i / steps);
      const x = fx(t),
        y = fy(t);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push(x * unit, -y * unit); // y-flip
    }
  }
  const cfg: Record<string, unknown> = {
    x: c.x,
    y: c.y,
    points: pts,
    stroke: e.stroke || '#10b981',
    strokeWidth: (((e.strokeWidth as number | undefined) || 4) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    tension: 0.3,
    rotation: e.rotation || 0,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 12,
    lineCap: 'round',
  };
  let minX = 0,
    maxX = 0,
    minY = 0,
    maxY = 0;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < minX) minX = pts[i];
    if (pts[i] > maxX) maxX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1];
    if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
  return ctx.applyEffects(cfg, obj, maxX - minX, maxY - minY, true);
}
export function starCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number,
    eh = e.height as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const outerRadius = L ? Math.min(L.w, L.h) / 2 : (Math.min(ew, eh) / 2) * ctx.vs;
  const inner = ((obj.innerRatio as number | undefined) || 0.4) * outerRadius;
  const rot = L ? L.rotation : e.rotation || 0;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    numPoints: (obj.starArms as number | undefined) || 5,
    innerRadius: inner,
    outerRadius: outerRadius,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: rot,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  return ctx.applyEffects(cfg, obj, outerRadius * 2, outerRadius * 2, true);
}
export function polygonCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number,
    eh = e.height as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const r = L ? Math.min(L.w, L.h) / 2 : (Math.min(ew, eh) / 2) * ctx.vs;
  const rot = L ? L.rotation : e.rotation || 0;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    sides: (obj.sides as number | undefined) || 6,
    radius: r,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: rot,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  return ctx.applyEffects(cfg, obj, r * 2, r * 2, true);
}
export function lineCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const p = ctx.s2c(e.x ?? 0, e.y ?? 0);
  const hw = ((e.width as number) / 2) * ctx.vs;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    points: [-hw, 0, hw, 0],
    stroke: e.stroke || e.fill || '#94a3b8',
    strokeWidth: Math.max(2, (((e.strokeWidth as number | undefined) || 3) * ctx.vs) / 2),
    opacity: e.opacity ?? 1,
    rotation: e.rotation || 0,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 16,
    lineCap: 'round',
  };
  return ctx.applyEffects(cfg, obj, hw * 2, 0, false);
}
export function arrowCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const hw = L ? L.w / 2 : (ew / 2) * ctx.vs;
  const rot = L ? L.rotation : e.rotation || 0;
  const cfg: Record<string, unknown> = {
    x: p.x,
    y: p.y,
    points: [-hw, 0, hw, 0],
    fill: e.fill,
    stroke: e.stroke || e.fill || '#ef4444',
    strokeWidth: Math.max(2, (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2),
    opacity: e.opacity ?? 1,
    rotation: rot,
    pointerLength: (14 * ctx.vs) / 2,
    pointerWidth: (12 * ctx.vs) / 2,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 16,
    scaleX: 1,
    scaleY: 1,
  };
  return ctx.applyEffects(cfg, obj, hw * 2, 0, false);
}
export function annulusCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const c = ctx.s2c(e.x ?? 0, e.y ?? 0);
  const cfg: Record<string, unknown> = {
    x: c.x,
    y: c.y,
    innerRadius: ((obj.innerRadius as number | undefined) || 35) * ctx.vs,
    outerRadius: ((obj.outerRadius as number | undefined) || 70) * ctx.vs,
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    rotation: e.rotation || 0,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  const d = ((obj.outerRadius as number | undefined) || 70) * 2 * ctx.vs;
  return ctx.applyEffects(cfg, obj, d, d, true);
}
export function sectorCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const c = ctx.s2c(e.x ?? 0, e.y ?? 0);
  const objRadius = (obj.radius as number | undefined) || 70;
  const objSweep = (obj.sweepAngle as number | undefined) || 90;
  const objStart = (obj.startAngle as number | undefined) || 0;
  const cfg: Record<string, unknown> = {
    x: c.x,
    y: c.y,
    radius: objRadius * ctx.vs,
    angle: objSweep,
    rotation: objStart + (e.rotation || 0),
    fill: e.fill,
    stroke: e.stroke,
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
  const d = objRadius * 2 * ctx.vs;
  return ctx.applyEffects(cfg, obj, d, d, true);
}
export function arcCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const c = ctx.s2c(e.x ?? 0, e.y ?? 0);
  const objRadius = (obj.radius as number | undefined) || 70;
  const objStart = (obj.startAngle as number | undefined) || 0;
  const objSweep = (obj.sweepAngle as number | undefined) || 180;
  const r = objRadius * ctx.vs;
  const a0 = (objStart * Math.PI) / 180;
  const a1 = ((objStart + objSweep) * Math.PI) / 180;
  const cfg: Record<string, unknown> = {
    x: c.x,
    y: c.y,
    stroke: e.stroke || '#f97316',
    strokeWidth: (((e.strokeWidth as number | undefined) || 4) * ctx.vs) / 2,
    opacity: e.opacity ?? 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 12,
    sceneFunc: (ctx2: Record<string, unknown>, shape: unknown) => {
      (ctx2.beginPath as () => void)();
      (ctx2.arc as (x: number, y: number, r: number, a0: number, a1: number) => void)(
        0,
        0,
        r,
        -a1,
        -a0
      );
      (ctx2.strokeShape as (shape: unknown) => void)(shape);
    },
  };
  return ctx.applyEffects(cfg, obj, r * 2, r * 2, true);
}
export function doubleArrowCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e = ctx.eff(obj);
  const c = ctx.s2c(e.x ?? 0, e.y ?? 0);
  const ew = (e.width as number | undefined) || 200;
  const half = (ew / 2) * ctx.vs;
  const cfg: Record<string, unknown> = {
    x: c.x,
    y: c.y,
    points: [-half, 0, half, 0],
    pointerAtBeginning: true,
    pointerAtEnding: true,
    pointerLength: (14 * ctx.vs) / 2,
    pointerWidth: (12 * ctx.vs) / 2,
    fill: e.fill || '#ef4444',
    stroke: e.stroke || e.fill || '#ef4444',
    strokeWidth: (((e.strokeWidth as number | undefined) || 2) * ctx.vs) / 2 + 2,
    opacity: e.opacity ?? 1,
    rotation: e.rotation || 0,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 12,
  };
  return ctx.applyEffects(cfg, obj, ew * ctx.vs, 0, false);
}
