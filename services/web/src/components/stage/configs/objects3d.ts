// Pure 3D object Konva config builders.
// Each exported function takes (obj, ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.
// ctx fields used: eff3d, iso, proj3DScale, projCx, projCy, cam3d, selectedObjectIds.
import { perspectiveScale } from '../../../engine/projection3d.js';
import { compileExpr } from '../../../engine/mathExpr.js';
import type { SceneObject } from '@manim/codegen';
import type { StageCtx, Eff3dResult, IsoPoint } from './context.js';

// ── Module-private math helpers ───────────────────────────────────────────
const _DEG = Math.PI / 180;
function _basis3d(phi: number, theta: number): { sp: number; cp: number; st: number; ct: number } {
  const ph = phi * _DEG,
    th = theta * _DEG;
  return { sp: Math.sin(ph), cp: Math.cos(ph), st: Math.sin(th), ct: Math.cos(th) };
}
function shade(hex: string, f: number): string {
  let h = (hex || '#888888').replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return hex || '#888888';
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) * f),
    g = cl(((n >> 8) & 255) * f),
    b = cl((n & 255) * f);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
// Project world point (object-relative offset dx,dy,dz) to screen, minus the
// object's projected centre `c` — i.e. coordinates inside a Konva group placed at c.
function _rel(
  ctx: StageCtx,
  e3: Eff3dResult,
  dx: number,
  dy: number,
  dz: number,
  c: IsoPoint
): [number, number] {
  const q = ctx.iso(e3.x3d + dx, e3.y3d + dy, e3.z3d + dz, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  return [q.px - c.px, q.py - c.py];
}
// Project a circle of radius R (in the plane perpendicular to `axis`, offset
// `off` along it) → array of [x,y] points relative to centre c.
function _circlePts(
  ctx: StageCtx,
  e3: Eff3dResult,
  R: number,
  axis: string,
  off: number,
  c: IsoPoint,
  N = 28
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI,
      u = R * Math.cos(a),
      v = R * Math.sin(a);
    out.push(
      axis === 'z'
        ? _rel(ctx, e3, u, v, off, c)
        : axis === 'y'
          ? _rel(ctx, e3, u, off, v, c)
          : _rel(ctx, e3, off, u, v, c)
    );
  }
  return out;
}
const _flat = (pairs: [number, number][]): number[] => pairs.flatMap((p) => p);
// Convex hull (monotone chain) of [x,y] points — used for body silhouettes.
function _hull(pts: [number, number][]): [number, number][] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}
// Clip segment (x0,y0)-(x1,y1) to rect [rx0,ry0,rx1,ry1]; returns trimmed
// [x0,y0,x1,y1] or null if fully outside.
function _clipSeg(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number
): number[] | null {
  let t0 = 0,
    t1 = 1;
  const dx = x1 - x0,
    dy = y1 - y0;
  const p = [-dx, dx, -dy, dy],
    q = [x0 - rx0, rx1 - x0, y0 - ry0, ry1 - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

// ── 3D shape configs ──────────────────────────────────────────────────────
// Sphere: a shaded ball via radial gradient (highlight offset top-left).
export function sphere3dCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e3 = ctx.eff3d(obj);
  const p = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const cam3dZoom = ((ctx.cam3d as Record<string, unknown>).zoom as number) ?? 1;
  const r = Math.max(
    4,
    ((obj.radius as number | undefined) ?? 0.5) *
      ctx.proj3DScale *
      cam3dZoom *
      perspectiveScale(e3, ctx.cam3d)
  );
  const isSelected = (ctx.selectedObjectIds || []).includes(obj.id);
  const fill = (obj.fill as string | undefined) ?? '#e67700';
  return {
    x: p.px,
    y: p.py,
    radius: r,
    fillRadialGradientStartPoint: { x: -r * 0.35, y: -r * 0.35 },
    fillRadialGradientStartRadius: r * 0.05,
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientEndRadius: r * 1.15,
    fillRadialGradientColorStops: [0, shade(fill, 1.55), 0.55, fill, 1, shade(fill, 0.45)],
    opacity: (obj.opacity as number | undefined) ?? 1,
    stroke: isSelected ? '#60a5fa' : shade(fill, 0.4),
    strokeWidth: isSelected ? 2 : 1,
    draggable: true,
  };
}

// A real box — 6 faces, painter-sorted (far→near), shaded by how much each face
// normal points toward the camera. Returned relative to the centre. (hx,hy,hz) are
// the half-extents; cube passes equal ones, prism passes per-axis dimensions.
function boxFaces(
  obj: SceneObject,
  ctx: StageCtx,
  hx: number,
  hy: number,
  hz: number
): Record<string, unknown>[] {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const fill = (obj.fill as string | undefined) ?? '#3b5bdb',
    op = (obj.opacity as number | undefined) ?? 1;
  const sel = (ctx.selectedObjectIds || []).includes(obj.id);
  const cam3d = ctx.cam3d as { phi?: number; theta?: number };
  const b = _basis3d(cam3d.phi ?? 75, cam3d.theta ?? -45);
  const n = { x: b.sp * b.ct, y: b.sp * b.st, z: b.cp }; // direction origin→camera
  const S: [number, number, number][] = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  const corners = S.map((s) => _rel(ctx, e3, s[0] * hx, s[1] * hy, s[2] * hz, c));
  const faces: Array<{ idx: number[]; nrm: [number, number, number] }> = [
    { idx: [0, 1, 2, 3], nrm: [0, 0, -1] },
    { idx: [4, 5, 6, 7], nrm: [0, 0, 1] },
    { idx: [0, 1, 5, 4], nrm: [0, -1, 0] },
    { idx: [3, 2, 6, 7], nrm: [0, 1, 0] },
    { idx: [1, 2, 6, 5], nrm: [1, 0, 0] },
    { idx: [0, 3, 7, 4], nrm: [-1, 0, 0] },
  ];
  const arr: Array<Record<string, unknown> & { depth: number }> = faces.map((f) => {
    const pts: number[] = [];
    let sx = 0,
      sy = 0,
      sz = 0;
    for (const i of f.idx) {
      pts.push(corners[i][0], corners[i][1]);
      sx += S[i][0];
      sy += S[i][1];
      sz += S[i][2];
    }
    const depth =
      (e3.x3d + (sx / 4) * hx) * n.x +
      (e3.y3d + (sy / 4) * hy) * n.y +
      (e3.z3d + (sz / 4) * hz) * n.z;
    const nd = f.nrm[0] * n.x + f.nrm[1] * n.y + f.nrm[2] * n.z;
    return {
      points: pts,
      closed: true,
      opacity: op,
      depth,
      fill: shade(fill, 0.5 + 0.55 * Math.max(0, nd)),
      stroke: sel ? '#60a5fa' : shade(fill, 0.35),
      strokeWidth: sel ? 1.5 : 1,
    };
  });
  arr.sort((a, b) => a.depth - b.depth);
  return arr;
}

export function cube3dFaces(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const h = ((obj.sideLength as number | undefined) ?? 1.0) / 2;
  return boxFaces(obj, ctx, h, h, h);
}

export function prism3dFaces(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  return boxFaces(
    obj,
    ctx,
    ((obj.dimX as number | undefined) ?? 2) / 2,
    ((obj.dimY as number | undefined) ?? 1) / 2,
    ((obj.dimZ as number | undefined) ?? 1) / 2
  );
}

// Projected centre of a 3D object — used to position a Konva group whose
// children (e.g. cube faces) are drawn relative to it (so drag works).
export function obj3dCenter(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const e3 = ctx.eff3d(obj);
  const p = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  return { x: p.px, y: p.py, draggable: true };
}

// Cone / Cylinder: real silhouettes (relative to the object centre).
// Cylinder: body convex-hull + lighter top cap. Cone: base + apex hull.
export function round3dParts(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const fill = (obj.fill as string | undefined) ?? '#888888',
    op = (obj.opacity as number | undefined) ?? 1;
  const sel = (ctx.selectedObjectIds || []).includes(obj.id);
  const edge = sel ? '#60a5fa' : shade(fill, 0.4);
  if (obj.type === 'cylinder') {
    const R = (obj.radius as number | undefined) ?? 0.5,
      hh = ((obj.height as number | undefined) ?? 1.5) / 2;
    const bottom = _circlePts(ctx, e3, R, 'z', -hh, c),
      top = _circlePts(ctx, e3, R, 'z', hh, c);
    return [
      {
        points: _flat(_hull(bottom.concat(top))),
        closed: true,
        fill: shade(fill, 0.72),
        stroke: edge,
        strokeWidth: 1,
        opacity: op,
      },
      {
        points: _flat(top),
        closed: true,
        fill: shade(fill, 1.18),
        stroke: edge,
        strokeWidth: 1,
        opacity: op,
      },
    ];
  }
  // cone
  const R = (obj.radius as number | undefined) ?? 0.5,
    hh = ((obj.height as number | undefined) ?? 1.0) / 2;
  const base = _circlePts(ctx, e3, R, 'z', -hh, c),
    apex = _rel(ctx, e3, 0, 0, hh, c);
  return [
    {
      points: _flat(base),
      closed: true,
      fill: shade(fill, 0.6),
      stroke: edge,
      strokeWidth: 1,
      opacity: op,
    },
    {
      points: _flat(_hull(base.concat([apex]))),
      closed: true,
      fill: shade(fill, 1.0),
      stroke: edge,
      strokeWidth: 1,
      opacity: op,
    },
  ];
}

// Torus: a donut — overlapping shaded "tube" discs sampled around the major
// ring, painter-sorted (near discs cover far ones → the hole appears naturally).
export function torus3dTube(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const Rmaj = (obj.majorRadius as number | undefined) ?? 1.0,
    Rmin = (obj.minorRadius as number | undefined) ?? 0.3;
  const fill = (obj.fill as string | undefined) ?? '#9c36b5',
    op = (obj.opacity as number | undefined) ?? 1;
  const cam3d = ctx.cam3d as { phi?: number; theta?: number; zoom?: number };
  const b = _basis3d(cam3d.phi ?? 75, cam3d.theta ?? -45);
  const n = { x: b.sp * b.ct, y: b.sp * b.st, z: b.cp };
  const tubeR = Math.max(2, Rmin * ctx.proj3DScale * (cam3d.zoom ?? 1));
  const N = 56;
  const segs: Array<{ x: number; y: number; depth: number }> = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI,
      wx = Rmaj * Math.cos(a),
      wy = Rmaj * Math.sin(a);
    const r = _rel(ctx, e3, wx, wy, 0, c);
    segs.push({
      x: r[0],
      y: r[1],
      depth: (e3.x3d + wx) * n.x + (e3.y3d + wy) * n.y + e3.z3d * n.z,
    });
  }
  segs.sort((p, q) => p.depth - q.depth); // far → near
  return segs.map((s) => {
    const t = Math.max(0, Math.min(1, (s.depth / (Rmaj || 1) + 1) / 2)); // 0 far, 1 near
    return { x: s.x, y: s.y, radius: tubeR, opacity: op, fill: shade(fill, 0.5 + 0.75 * t) };
  });
}

// Torus silhouette outline (outer + inner ring) — gives a clean edge and the
// blue selection indicator, consistent with the other shapes.
export function torusOutline(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const Rmaj = (obj.majorRadius as number | undefined) ?? 1.0,
    Rmin = (obj.minorRadius as number | undefined) ?? 0.3;
  const fill = (obj.fill as string | undefined) ?? '#9c36b5';
  const sel = (ctx.selectedObjectIds || []).includes(obj.id);
  const stroke = sel ? '#60a5fa' : shade(fill, 0.45);
  const sw = sel ? 2 : 1;
  return [
    {
      points: _flat(_circlePts(ctx, e3, Rmaj + Rmin, 'z', 0, c)),
      closed: true,
      stroke,
      strokeWidth: sw,
      listening: false,
    },
    {
      points: _flat(_circlePts(ctx, e3, Rmaj - Rmin, 'z', 0, c)),
      closed: true,
      stroke,
      strokeWidth: sw,
      listening: false,
    },
  ];
}

// Surface (z = f(x,y)): a wireframe. N×N samples of z=f(x,y), projected to iso and
// drawn as row + column polylines relative to the projected centre (like cube faces).
// Preview ≈ render divergence: wireframe here, a filled/shaded surface in Manim.
export function surface3dMesh(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const e3 = ctx.eff3d(obj);
  const c = ctx.iso(e3.x3d, e3.y3d, e3.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
  const fn = compileExpr((obj.zExpr as string | undefined) || 'x**2 - y**2', ['x', 'y']);
  const xr = (obj.xRange as number[] | undefined) ?? [-2, 2],
    yr = (obj.yRange as number[] | undefined) ?? [-2, 2];
  const sel = (ctx.selectedObjectIds || []).includes(obj.id);
  const stroke = sel ? '#60a5fa' : ((obj.fill as string | undefined) ?? '#9b59b6');
  const op = (obj.opacity as number | undefined) ?? 1;
  const sw = sel ? 1.5 : 1;
  const N = 12;
  const grid: [number, number][][] = [];
  for (let i = 0; i <= N; i++) {
    grid[i] = [];
    const x = xr[0] + ((xr[1] - xr[0]) * i) / N;
    for (let j = 0; j <= N; j++) {
      const y = yr[0] + ((yr[1] - yr[0]) * j) / N;
      let z = 0;
      if (fn) {
        try {
          z = fn(x, y);
        } catch {
          z = 0;
        }
      }
      if (!Number.isFinite(z)) z = 0;
      grid[i][j] = _rel(ctx, e3, x, y, z, c);
    }
  }
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i <= N; i++)
    out.push({ points: _flat(grid[i]), stroke, strokeWidth: sw, opacity: op, listening: false });
  for (let j = 0; j <= N; j++)
    out.push({
      points: _flat(grid.map((r) => r[j])),
      stroke,
      strokeWidth: sw,
      opacity: op,
      listening: false,
    });
  return out;
}

export function axes3dLines(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const e3 = ctx.eff3d(obj);
  const s = ctx.proj3DScale,
    cx = ctx.projCx,
    cy = ctx.projCy;
  // Compute isoRect from ctx values (mirrors the SFC's isoRect computed)
  const w = (ctx.stg.width as number) * ctx.vs,
    h = (ctx.stg.height as number) * ctx.vs;
  const r = [ctx.ox, ctx.oy, ctx.ox + w, ctx.oy + h];
  const o = ctx.iso(e3.x3d, e3.y3d, e3.z3d, cx, cy, s);
  const ends: [IsoPoint, string][] = [
    [ctx.iso(e3.x3d + 3, e3.y3d, e3.z3d, cx, cy, s), '#ff6b6b'],
    [ctx.iso(e3.x3d, e3.y3d + 3, e3.z3d, cx, cy, s), '#69db7c'],
    [ctx.iso(e3.x3d, e3.y3d, e3.z3d + 3, cx, cy, s), '#74c0fc'],
  ];
  const out: Record<string, unknown>[] = [];
  for (const [end, stroke] of ends) {
    const c = _clipSeg(o.px, o.py, end.px, end.py, r[0], r[1], r[2], r[3]);
    if (c) out.push({ points: c, stroke, strokeWidth: 2, listening: false });
  }
  return out;
}
