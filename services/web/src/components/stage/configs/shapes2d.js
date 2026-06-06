// Pure 2D shape Konva config builders.
// Each function takes (obj, ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.
import { compileExpr } from '../../../engine/mathExpr.js';

export function rectCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x - e.width / 2, e.y - e.height / 2);
  const w = L ? L.w : e.width * ctx.vs, h = L ? L.h : e.height * ctx.vs, rot = L ? L.rotation : (e.rotation || 0);
  const crPx = (obj.cornerRadius > 0 ? obj.cornerRadius : (obj.type === 'square' ? 4 : 2)) * ctx.vs;
  const cfg = { x: p.x, y: p.y, width: w, height: h, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, cornerRadius: crPx, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return ctx.applyEffects(cfg, obj, w, h, false);
}
export function circleCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y); const r = L ? Math.min(L.w, L.h) / 2 : Math.min(e.width, e.height) / 2 * ctx.vs;
  const rot = L ? L.rotation : (e.rotation || 0);
  const cfg = { x: p.x, y: p.y, radius: r, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return ctx.applyEffects(cfg, obj, r * 2, r * 2, true);
}
export function ellipseCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y);
  const rx = L ? L.w / 2 : (e.width / 2) * ctx.vs, ry = L ? L.h / 2 : (e.height / 2) * ctx.vs, rot = L ? L.rotation : (e.rotation || 0);
  const cfg = { x: p.x, y: p.y, radiusX: rx, radiusY: ry, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return ctx.applyEffects(cfg, obj, rx * 2, ry * 2, true);
}
export function dotCfg(obj, ctx) {
  const e = ctx.eff(obj); const p = ctx.s2c(e.x, e.y);
  return { x: p.x, y: p.y, radius: Math.max(4, e.width / 2 * ctx.vs), fill: e.fill || '#fff', opacity: e.opacity ?? 1, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 12 };
}
export function heartCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y); const w = L ? L.w : e.width * ctx.vs; const h = L ? L.h : e.height * ctx.vs; const rot = L ? L.rotation : (e.rotation || 0);
  const cfg = {
    x: p.x, y: p.y, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2,
    opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1,
    draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10,
    sceneFunc: (ctx2, shape) => {
      const hw = w / 2, hh = h / 2;
      ctx2.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 2 * Math.PI;
        const px = (16 * Math.pow(Math.sin(t), 3) / 16) * hw;
        const py = -(((13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 15)) * hh;
        i === 0 ? ctx2.moveTo(px, py) : ctx2.lineTo(px, py);
      }
      ctx2.closePath(); ctx2.fillStrokeShape(shape);
    }
  };
  return ctx.applyEffects(cfg, obj, w, h, true);
}
export function triangleCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y);
  const hw = L ? L.w / 2 : e.width / 2 * ctx.vs, hh = L ? L.h / 2 : e.height / 2 * ctx.vs, rot = L ? L.rotation : (e.rotation || 0);
  const cfg = { x: p.x, y: p.y, points: [0, -hh, hw, hh, -hw, hh], closed: true, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return ctx.applyEffects(cfg, obj, hw * 2, hh * 2, true);
}
export function polygonFreeCfg(obj, ctx) {
  const e = ctx.eff(obj); const p = ctx.s2c(e.x, e.y);
  const verts = (Array.isArray(obj.vertices) && obj.vertices.length >= 3) ? obj.vertices : [[-80, -60], [80, -60], [80, 60], [-80, 60]];
  const pts = verts.flatMap(([vx, vy]) => [vx * ctx.vs, vy * ctx.vs]);
  const xs = verts.map(v => v[0]), ys = verts.map(v => v[1]);
  const w = (Math.max(...xs) - Math.min(...xs)) * ctx.vs, h = (Math.max(...ys) - Math.min(...ys)) * ctx.vs;
  const cfg = { x: p.x, y: p.y, points: pts, closed: true, fill: e.fill, stroke: e.stroke,
    strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1, rotation: e.rotation || 0,
    scaleX: 1, scaleY: 1, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return ctx.applyEffects(cfg, obj, w, h, true);
}
export function parametricCfg(obj, ctx) {
  const e = ctx.eff(obj); const c = ctx.s2c(e.x, e.y);
  const fx = compileExpr(obj.xExpr || 'np.cos(t)', 't');
  const fy = compileExpr(obj.yExpr || 'np.sin(t)', 't');
  const t0 = Number.isFinite(obj.tMin) ? obj.tMin : 0;
  const t1 = Number.isFinite(obj.tMax) ? obj.tMax : 6.283;
  const unit = (ctx.stg.width / 14.222) * ctx.vs;   // px per Manim unit
  const pts = [];
  if (fx && fy && t1 > t0) {
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (t1 - t0) * (i / steps);
      const x = fx(t), y = fy(t);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push(x * unit, -y * unit);   // y-flip
    }
  }
  const cfg = { x: c.x, y: c.y, points: pts, stroke: e.stroke || '#10b981',
    strokeWidth: (e.strokeWidth || 4) * ctx.vs / 2, opacity: e.opacity ?? 1, tension: 0.3,
    rotation: e.rotation || 0, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 12, lineCap: 'round' };
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < minX) minX = pts[i]; if (pts[i] > maxX) maxX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1]; if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
  return ctx.applyEffects(cfg, obj, maxX - minX, maxY - minY, true);
}
export function starCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y);
  const outerRadius = L ? Math.min(L.w, L.h) / 2 : Math.min(e.width, e.height) / 2 * ctx.vs;
  const inner = (obj.innerRatio || 0.4) * outerRadius; const rot = L ? L.rotation : (e.rotation || 0);
  const cfg = { x: p.x, y: p.y, numPoints: obj.starArms || 5, innerRadius: inner, outerRadius: outerRadius, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return ctx.applyEffects(cfg, obj, outerRadius * 2, outerRadius * 2, true);
}
export function polygonCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y);
  const r = L ? Math.min(L.w, L.h) / 2 : Math.min(e.width, e.height) / 2 * ctx.vs; const rot = L ? L.rotation : (e.rotation || 0);
  const cfg = { x: p.x, y: p.y, sides: obj.sides || 6, radius: r, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  return ctx.applyEffects(cfg, obj, r * 2, r * 2, true);
}
export function lineCfg(obj, ctx) {
  const e = ctx.eff(obj); const p = ctx.s2c(e.x, e.y);
  const hw = e.width / 2 * ctx.vs;
  const cfg = { x: p.x, y: p.y, points: [-hw, 0, hw, 0], stroke: e.stroke || e.fill || '#94a3b8', strokeWidth: Math.max(2, (e.strokeWidth || 3) * ctx.vs / 2), opacity: e.opacity ?? 1, rotation: e.rotation || 0, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 16, lineCap: 'round' };
  return ctx.applyEffects(cfg, obj, hw * 2, 0, false);
}
export function arrowCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y);
  const hw = L ? L.w / 2 : e.width / 2 * ctx.vs; const rot = L ? L.rotation : (e.rotation || 0);
  const cfg = { x: p.x, y: p.y, points: [-hw, 0, hw, 0], fill: e.fill, stroke: e.stroke || e.fill || '#ef4444', strokeWidth: Math.max(2, (e.strokeWidth || 2) * ctx.vs / 2), opacity: e.opacity ?? 1, rotation: rot, pointerLength: 14 * ctx.vs / 2, pointerWidth: 12 * ctx.vs / 2, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 16, scaleX: 1, scaleY: 1 };
  return ctx.applyEffects(cfg, obj, hw * 2, 0, false);
}
export function annulusCfg(obj, ctx) {
  const e = ctx.eff(obj); const c = ctx.s2c(e.x, e.y);
  const cfg = { x: c.x, y: c.y, innerRadius: (obj.innerRadius || 35) * ctx.vs, outerRadius: (obj.outerRadius || 70) * ctx.vs,
    fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1,
    rotation: e.rotation || 0, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  const d = (obj.outerRadius || 70) * 2 * ctx.vs;
  return ctx.applyEffects(cfg, obj, d, d, true);
}
export function sectorCfg(obj, ctx) {
  const e = ctx.eff(obj); const c = ctx.s2c(e.x, e.y);
  const cfg = { x: c.x, y: c.y, radius: (obj.radius || 70) * ctx.vs, angle: obj.sweepAngle || 90, rotation: (obj.startAngle || 0) + (e.rotation || 0),
    fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2, opacity: e.opacity ?? 1,
    draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
  const d = (obj.radius || 70) * 2 * ctx.vs;
  return ctx.applyEffects(cfg, obj, d, d, true);
}
export function arcCfg(obj, ctx) {
  const e = ctx.eff(obj); const c = ctx.s2c(e.x, e.y);
  const r = (obj.radius || 70) * ctx.vs;
  const a0 = (obj.startAngle || 0) * Math.PI / 180;
  const a1 = ((obj.startAngle || 0) + (obj.sweepAngle || 180)) * Math.PI / 180;
  const cfg = { x: c.x, y: c.y, stroke: e.stroke || '#f97316', strokeWidth: (e.strokeWidth || 4) * ctx.vs / 2,
    opacity: e.opacity ?? 1, draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 12,
    sceneFunc: (ctx2, shape) => { ctx2.beginPath(); ctx2.arc(0, 0, r, -a1, -a0); ctx2.strokeShape(shape); } };
  return ctx.applyEffects(cfg, obj, r * 2, r * 2, true);
}
export function doubleArrowCfg(obj, ctx) {
  const e = ctx.eff(obj); const c = ctx.s2c(e.x, e.y); const half = (e.width || 200) / 2 * ctx.vs;
  const cfg = { x: c.x, y: c.y, points: [-half, 0, half, 0], pointerAtBeginning: true, pointerAtEnding: true,
    pointerLength: 14 * ctx.vs / 2, pointerWidth: 12 * ctx.vs / 2, fill: e.fill || '#ef4444', stroke: e.stroke || e.fill || '#ef4444',
    strokeWidth: (e.strokeWidth || 2) * ctx.vs / 2 + 2, opacity: e.opacity ?? 1, rotation: e.rotation || 0,
    draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 12 };
  return ctx.applyEffects(cfg, obj, (e.width || 200) * ctx.vs, 0, false);
}
