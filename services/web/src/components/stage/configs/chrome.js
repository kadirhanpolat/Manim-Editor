// Chrome + background config builders for StageCanvas.
// Pure functions — no Vue refs. All live values come through ctx.
// ctx fields used: stg, vs, ox, oy, is3D, proj3DScale, projCx, projCy,
//                  themeAccent, themeSurface, cam3d.
import { project3D } from '../../../engine/projection3d.js';

// ── Module constants ───────────────────────────────────────────────────────
const REF_AXIS_LEN  = 4;
const FLOOR_GRID_EXT = 5;
const AXIS_COLORS = { x: '#f87171', y: '#4ade80', z: '#60a5fa' };

// ── Module-private helpers ─────────────────────────────────────────────────

// Orthographic-forced projection for the faint reference gizmo.
// Uses the resting camera (cam3d) but forces orthographic mode so the axes
// remain a clean symmetric cross regardless of the perspective setting.
function isoRef(x3d, y3d, z3d, cx, cy, scale, cam3d) {
  const c = cam3d;
  return project3D(
    { x3d, y3d, z3d },
    { phi: c.phi, theta: c.theta, zoom: c.zoom, mode: 'orthographic' },
    cx, cy, scale
  );
}

// Liang–Barsky segment clip to rect [rx0,ry0,rx1,ry1].
// Returns trimmed [x0,y0,x1,y1] or null if fully outside.
function _clipSeg(x0, y0, x1, y1, rx0, ry0, rx1, ry1) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy], q = [x0 - rx0, rx1 - x0, y0 - ry0, ry1 - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; }
    else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

// Build a clipped axis segment config.
function _axCfg(a, b, stroke, r) {
  const c = _clipSeg(a.px, a.py, b.px, b.py, r[0], r[1], r[2], r[3]);
  return c ? { points: c, stroke, strokeWidth: 1.5, opacity: 0.3, dash: [5, 5], listening: false } : null;
}

// Build a clipped floor-grid line config.
function _gridCfg(a, b, r) {
  const c = _clipSeg(a.px, a.py, b.px, b.py, r[0], r[1], r[2], r[3]);
  return c ? { points: c, stroke: '#64748b', strokeWidth: 1, opacity: 0.1, listening: false } : null;
}

// Build an axis label config (returns null if the point falls outside the rect).
function _lblCfg(p, text, fill, r) {
  if (p.px < r[0] || p.px > r[2] || p.py < r[1] || p.py > r[3]) return null;
  return { x: p.px + 4, y: p.py - 7, text, fontSize: 12, fontStyle: 'bold', fill, opacity: 0.5, listening: false };
}

// Clip rect = the visible black backdrop (not the full Konva stage).
function _isoRect(ctx) {
  const w = ctx.stg.width * ctx.vs, h = ctx.stg.height * ctx.vs;
  return [ctx.ox, ctx.oy, ctx.ox + w, ctx.oy + h];
}

// ── Exported pure functions ────────────────────────────────────────────────

export function bgConfig(ctx) {
  return {
    x: ctx.ox, y: ctx.oy,
    width: ctx.stg.width * ctx.vs, height: ctx.stg.height * ctx.vs,
    fill: ctx.stg.backgroundColor || '#000000',
    opacity: ctx.stg.backgroundOpacity ?? 1,
    cornerRadius: 4,
    shadowColor: '#000', shadowBlur: 40, shadowOpacity: 0.6,
  };
}

export function gridLines(ctx) {
  const lines = [];
  const x0 = ctx.ox, y0 = ctx.oy, w = ctx.stg.width * ctx.vs, h = ctx.stg.height * ctx.vs;
  const gs = ctx.stg.gridSize || 8;
  const gridColor = ctx.stg.gridColor || '#ffffff';
  const gridOpacity = ctx.stg.gridOpacity ?? 0.12;
  for (let i = 1; i < gs; i++) {
    lines.push({ points: [x0 + w / gs * i, y0, x0 + w / gs * i, y0 + h], stroke: gridColor, strokeWidth: 0.5, opacity: gridOpacity, dash: [4, 8], listening: false });
    lines.push({ points: [x0, y0 + h / gs * i, x0 + w, y0 + h / gs * i], stroke: gridColor, strokeWidth: 0.5, opacity: gridOpacity, dash: [4, 8], listening: false });
  }
  return lines;
}

export function centerH(ctx) {
  const gridOpacity = ctx.stg.gridOpacity ?? 0.12;
  return { points: [ctx.ox, ctx.oy + ctx.stg.height * ctx.vs / 2, ctx.ox + ctx.stg.width * ctx.vs, ctx.oy + ctx.stg.height * ctx.vs / 2], stroke: ctx.themeAccent, strokeWidth: 0.5, opacity: gridOpacity + 0.06, dash: [8, 4], listening: false };
}

export function centerV(ctx) {
  const gridOpacity = ctx.stg.gridOpacity ?? 0.12;
  return { points: [ctx.ox + ctx.stg.width * ctx.vs / 2, ctx.oy, ctx.ox + ctx.stg.width * ctx.vs / 2, ctx.oy + ctx.stg.height * ctx.vs], stroke: ctx.themeAccent, strokeWidth: 0.5, opacity: gridOpacity + 0.06, dash: [8, 4], listening: false };
}

export function refAxesIso(ctx) {
  if (!ctx.is3D) return [];
  const L = REF_AXIS_LEN, s = ctx.proj3DScale, cx = ctx.projCx, cy = ctx.projCy;
  const r = _isoRect(ctx);
  const ir = (x, y, z) => isoRef(x, y, z, cx, cy, s, ctx.cam3d);
  return [
    _axCfg(ir(-L, 0, 0), ir(L, 0, 0), AXIS_COLORS.x, r),
    _axCfg(ir(0, -L, 0), ir(0, L, 0), AXIS_COLORS.y, r),
    _axCfg(ir(0, 0, -L), ir(0, 0, L), AXIS_COLORS.z, r),
  ].filter(Boolean);
}

export function refLabelsIso(ctx) {
  if (!ctx.is3D) return [];
  const L = REF_AXIS_LEN, s = ctx.proj3DScale, cx = ctx.projCx, cy = ctx.projCy;
  const r = _isoRect(ctx);
  const ir = (x, y, z) => isoRef(x, y, z, cx, cy, s, ctx.cam3d);
  return [
    _lblCfg(ir(L, 0, 0), 'X', AXIS_COLORS.x, r),
    _lblCfg(ir(0, L, 0), 'Y', AXIS_COLORS.y, r),
    _lblCfg(ir(0, 0, L), 'Z', AXIS_COLORS.z, r),
  ].filter(Boolean);
}

export function floorGridIso(ctx) {
  if (!ctx.is3D) return [];
  const G = FLOOR_GRID_EXT, s = ctx.proj3DScale, cx = ctx.projCx, cy = ctx.projCy;
  const r = _isoRect(ctx);
  const ir = (x, y, z) => isoRef(x, y, z, cx, cy, s, ctx.cam3d);
  const out = [];
  for (let i = -G; i <= G; i++) {
    if (i === 0) continue;
    const a = _gridCfg(ir(-G, i, 0), ir(G, i, 0), r); if (a) out.push(a);
    const b = _gridCfg(ir(i, -G, 0), ir(i, G, 0), r); if (b) out.push(b);
  }
  return out;
}
