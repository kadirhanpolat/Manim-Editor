// Pure 3D object Konva config builders.
// Each exported function takes (obj, ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.
// ctx fields used: eff3d, iso, proj3DScale, projCx, projCy, cam3d, selectedObjectIds.
import { perspectiveScale } from '../../../engine/projection3d.js';

// ── Module-private math helpers ───────────────────────────────────────────
const _DEG = Math.PI / 180;
function _basis3d(phi, theta) {
  const ph = phi * _DEG, th = theta * _DEG;
  return { sp: Math.sin(ph), cp: Math.cos(ph), st: Math.sin(th), ct: Math.cos(th) };
}
function shade(hex, f) {
  let h = (hex || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); if (Number.isNaN(n)) return hex || '#888888';
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) * f), g = cl(((n >> 8) & 255) * f), b = cl((n & 255) * f);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
// Project world point (object-relative offset dx,dy,dz) to screen, minus the
// object's projected centre `c` — i.e. coordinates inside a Konva group placed at c.
function _rel(ctx, e3, dx, dy, dz, c) {
  const q = ctx.iso(e3.x3d + dx, e3.y3d + dy, e3.z3d + dz, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  return [q.px - c.px, q.py - c.py];
}
// Project a circle of radius R (in the plane perpendicular to `axis`, offset
// `off` along it) → array of [x,y] points relative to centre c.
function _circlePts(ctx, e3, R, axis, off, c, N = 28) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * 2 * Math.PI, u = R * Math.cos(a), v = R * Math.sin(a);
    out.push(axis === 'z' ? _rel(ctx, e3, u, v, off, c) : axis === 'y' ? _rel(ctx, e3, u, off, v, c) : _rel(ctx, e3, off, u, v, c));
  }
  return out;
}
const _flat = (pairs) => pairs.flatMap(p => p);
// Convex hull (monotone chain) of [x,y] points — used for body silhouettes.
function _hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
// Clip segment (x0,y0)-(x1,y1) to rect [rx0,ry0,rx1,ry1]; returns trimmed
// [x0,y0,x1,y1] or null if fully outside.
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

// ── 3D shape configs ──────────────────────────────────────────────────────
// Sphere: a shaded ball via radial gradient (highlight offset top-left).
export function sphere3dCfg(obj, ctx) {
  const e3 = ctx.eff3d(obj);
  const p = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const r = Math.max(4, (obj.radius ?? 0.5) * ctx.proj3DScale * ctx.cam3d.zoom * perspectiveScale(e3, ctx.cam3d));
  const isSelected = (ctx.selectedObjectIds || []).includes(obj.id);
  const fill = obj.fill ?? '#e67700';
  return {
    x: p.px, y: p.py, radius: r,
    fillRadialGradientStartPoint: { x: -r * 0.35, y: -r * 0.35 },
    fillRadialGradientStartRadius: r * 0.05,
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientEndRadius: r * 1.15,
    fillRadialGradientColorStops: [0, shade(fill, 1.55), 0.55, fill, 1, shade(fill, 0.45)],
    opacity: obj.opacity ?? 1,
    stroke: isSelected ? '#60a5fa' : shade(fill, 0.4), strokeWidth: isSelected ? 2 : 1,
    draggable: true,
  };
}

// Cube: a real box — 6 faces, painter-sorted (far→near), shaded by how much
// each face normal points toward the camera. Returned relative to the centre.
export function cube3dFaces(obj, ctx) {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const h = (obj.sideLength ?? 1.0) / 2;
  const fill = obj.fill ?? '#3b5bdb', op = obj.opacity ?? 1;
  const sel = (ctx.selectedObjectIds || []).includes(obj.id);
  const b = _basis3d(ctx.cam3d.phi, ctx.cam3d.theta);
  const n = { x: b.sp * b.ct, y: b.sp * b.st, z: b.cp }; // direction origin→camera
  const S = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const corners = S.map(s => _rel(ctx, e3, s[0] * h, s[1] * h, s[2] * h, c));
  const faces = [
    { idx: [0, 1, 2, 3], nrm: [0, 0, -1] }, { idx: [4, 5, 6, 7], nrm: [0, 0, 1] },
    { idx: [0, 1, 5, 4], nrm: [0, -1, 0] }, { idx: [3, 2, 6, 7], nrm: [0, 1, 0] },
    { idx: [1, 2, 6, 5], nrm: [1, 0, 0] }, { idx: [0, 3, 7, 4], nrm: [-1, 0, 0] },
  ];
  const arr = faces.map(f => {
    const pts = []; let sx = 0, sy = 0, sz = 0;
    for (const i of f.idx) { pts.push(corners[i][0], corners[i][1]); sx += S[i][0]; sy += S[i][1]; sz += S[i][2]; }
    const depth = (e3.x3d + sx / 4 * h) * n.x + (e3.y3d + sy / 4 * h) * n.y + (e3.z3d + sz / 4 * h) * n.z;
    const nd = f.nrm[0] * n.x + f.nrm[1] * n.y + f.nrm[2] * n.z;
    return { points: pts, closed: true, opacity: op, depth,
      fill: shade(fill, 0.5 + 0.55 * Math.max(0, nd)),
      stroke: sel ? '#60a5fa' : shade(fill, 0.35), strokeWidth: sel ? 1.5 : 1 };
  });
  arr.sort((a, b) => a.depth - b.depth);
  return arr;
}

// Projected centre of a 3D object — used to position a Konva group whose
// children (e.g. cube faces) are drawn relative to it (so drag works).
export function obj3dCenter(obj, ctx) {
  const e3 = ctx.eff3d(obj);
  const p = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  return { x: p.px, y: p.py, draggable: true };
}

// Cone / Cylinder: real silhouettes (relative to the object centre).
// Cylinder: body convex-hull + lighter top cap. Cone: base + apex hull.
export function round3dParts(obj, ctx) {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const fill = obj.fill ?? '#888888', op = obj.opacity ?? 1;
  const sel = (ctx.selectedObjectIds || []).includes(obj.id);
  const edge = sel ? '#60a5fa' : shade(fill, 0.4);
  if (obj.type === 'cylinder') {
    const R = obj.radius ?? 0.5, hh = (obj.height ?? 1.5) / 2;
    const bottom = _circlePts(ctx, e3, R, 'z', -hh, c), top = _circlePts(ctx, e3, R, 'z', hh, c);
    return [
      { points: _flat(_hull(bottom.concat(top))), closed: true, fill: shade(fill, 0.72), stroke: edge, strokeWidth: 1, opacity: op },
      { points: _flat(top), closed: true, fill: shade(fill, 1.18), stroke: edge, strokeWidth: 1, opacity: op },
    ];
  }
  // cone
  const R = obj.radius ?? 0.5, hh = (obj.height ?? 1.0) / 2;
  const base = _circlePts(ctx, e3, R, 'z', -hh, c), apex = _rel(ctx, e3, 0, 0, hh, c);
  return [
    { points: _flat(base), closed: true, fill: shade(fill, 0.6), stroke: edge, strokeWidth: 1, opacity: op },
    { points: _flat(_hull(base.concat([apex]))), closed: true, fill: shade(fill, 1.0), stroke: edge, strokeWidth: 1, opacity: op },
  ];
}

// Torus: a donut — overlapping shaded "tube" discs sampled around the major
// ring, painter-sorted (near discs cover far ones → the hole appears naturally).
export function torus3dTube(obj, ctx) {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const Rmaj = obj.majorRadius ?? 1.0, Rmin = obj.minorRadius ?? 0.3;
  const fill = obj.fill ?? '#9c36b5', op = obj.opacity ?? 1;
  const b = _basis3d(ctx.cam3d.phi, ctx.cam3d.theta);
  const n = { x: b.sp * b.ct, y: b.sp * b.st, z: b.cp };
  const tubeR = Math.max(2, Rmin * ctx.proj3DScale * ctx.cam3d.zoom);
  const N = 56;
  const segs = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * 2 * Math.PI, wx = Rmaj * Math.cos(a), wy = Rmaj * Math.sin(a);
    const r = _rel(ctx, e3, wx, wy, 0, c);
    segs.push({ x: r[0], y: r[1], depth: (e3.x3d + wx) * n.x + (e3.y3d + wy) * n.y + e3.z3d * n.z });
  }
  segs.sort((p, q) => p.depth - q.depth); // far → near
  return segs.map(s => {
    const t = Math.max(0, Math.min(1, (s.depth / (Rmaj || 1) + 1) / 2)); // 0 far, 1 near
    return { x: s.x, y: s.y, radius: tubeR, opacity: op, fill: shade(fill, 0.5 + 0.75 * t) };
  });
}

// Torus silhouette outline (outer + inner ring) — gives a clean edge and the
// blue selection indicator, consistent with the other shapes.
export function torusOutline(obj, ctx) {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const Rmaj = obj.majorRadius ?? 1.0, Rmin = obj.minorRadius ?? 0.3;
  const fill = obj.fill ?? '#9c36b5';
  const sel = (ctx.selectedObjectIds || []).includes(obj.id);
  const stroke = sel ? '#60a5fa' : shade(fill, 0.45);
  const sw = sel ? 2 : 1;
  return [
    { points: _flat(_circlePts(ctx, e3, Rmaj + Rmin, 'z', 0, c)), closed: true, stroke, strokeWidth: sw, listening: false },
    { points: _flat(_circlePts(ctx, e3, Rmaj - Rmin, 'z', 0, c)), closed: true, stroke, strokeWidth: sw, listening: false },
  ];
}

export function axes3dLines(obj, ctx) {
  const e3 = ctx.eff3d(obj);
  const s = ctx.proj3DScale, cx = ctx.projCx, cy = ctx.projCy;
  // Compute isoRect from ctx values (mirrors the SFC's isoRect computed)
  const w = ctx.stg.width * ctx.vs, h = ctx.stg.height * ctx.vs;
  const r = [ctx.ox, ctx.oy, ctx.ox + w, ctx.oy + h];
  const o = ctx.iso(e3.x3d, e3.y3d, e3.z3d, cx, cy, s);
  const ends = [
    [ctx.iso(e3.x3d + 3, e3.y3d, e3.z3d, cx, cy, s), '#ff6b6b'],
    [ctx.iso(e3.x3d, e3.y3d + 3, e3.z3d, cx, cy, s), '#69db7c'],
    [ctx.iso(e3.x3d, e3.y3d, e3.z3d + 3, cx, cy, s), '#74c0fc'],
  ];
  return ends.map(([end, stroke]) => {
    const c = _clipSeg(o.px, o.py, end.px, end.py, r[0], r[1], r[2], r[3]);
    return c ? { points: c, stroke, strokeWidth: 2, listening: false } : null;
  }).filter(Boolean);
}
