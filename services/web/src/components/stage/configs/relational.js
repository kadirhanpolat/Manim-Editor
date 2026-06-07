// Pure relational (brace / angle) Konva config builders.
// Each function takes (obj[, extra], ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.

export function relationalHitCfg(obj, ctx) {
  const w = (obj.width || 140) * ctx.vs, h = (obj.height || 140) * ctx.vs;
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(76,238,249,0.04)', stroke: ctx.themeAccent, strokeWidth: 1, dash: [6, 4], cornerRadius: 4, listening: true };
}

export function relationalLabelCfg(obj, anchor, ctx) {
  return { x: anchor[0] - 12, y: anchor[1] - 8, width: 24, text: obj.label || '', align: 'center',
    fontSize: Math.max(11, 16 * ctx.vs), fill: obj.fill || '#ffffff', fontStyle: 'italic', listening: false };
}

export function braceLineCfg(obj, ctx) {
  const p1 = obj.p1 || [-80, 0], p2 = obj.p2 || [80, 0];
  const z = ctx.vs;
  const ax = p1[0] * z, ay = p1[1] * z, bx = p2[0] * z, by = p2[1] * z;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const d = 14 * z;
  const mx = (ax + bx) / 2 + nx * d, my = (ay + by) / 2 + ny * d;
  return { points: [ax, ay, ax + nx * d, ay + ny * d, mx, my, bx + nx * d, by + ny * d, bx, by],
    stroke: obj.stroke || '#ffffff', strokeWidth: 2, lineJoin: 'round', tension: 0.4, listening: false };
}

export function braceLabelAnchor(obj, ctx) {
  const p1 = obj.p1 || [-80, 0], p2 = obj.p2 || [80, 0];
  const z = ctx.vs;
  const ax = p1[0] * z, ay = p1[1] * z, bx = p2[0] * z, by = p2[1] * z;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return [(ax + bx) / 2 + nx * 26 * z, (ay + by) / 2 + ny * 26 * z];
}

export function angleRayCfgs(obj, ctx) {
  const z = ctx.vs;
  const v = obj.vertex || [-40, 40], p1 = obj.point1 || [80, 40], p2 = obj.point2 || [-40, -60];
  const col = obj.stroke || '#fbbf24';
  return [
    { points: [v[0] * z, v[1] * z, p1[0] * z, p1[1] * z], stroke: col, strokeWidth: 2, listening: false },
    { points: [v[0] * z, v[1] * z, p2[0] * z, p2[1] * z], stroke: col, strokeWidth: 2, listening: false },
  ];
}

export function angleArcCfg(obj, ctx) {
  const z = ctx.vs;
  const v = obj.vertex || [-40, 40], p1 = obj.point1 || [80, 40], p2 = obj.point2 || [-40, -60];
  const a1 = Math.atan2(p1[1] - v[1], p1[0] - v[0]);
  const a2 = Math.atan2(p2[1] - v[1], p2[0] - v[0]);
  const r = (obj.radius || 0.6) / 14.222 * (ctx.stg.width) * z * 0.5;
  const pts = [];
  let start = a1, end = a2;
  if (end < start) end += Math.PI * 2;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = start + (end - start) * (i / steps);
    pts.push(v[0] * z + Math.cos(a) * r, v[1] * z + Math.sin(a) * r);
  }
  return { points: pts, stroke: obj.stroke || '#fbbf24', strokeWidth: 2, listening: false };
}

export function angleSquareCfg(obj, ctx) {
  const z = ctx.vs;
  const v = obj.vertex || [-40, 40], p1 = obj.point1 || [80, 40], p2 = obj.point2 || [-40, -60];
  const u1a = Math.atan2(p1[1] - v[1], p1[0] - v[0]);
  const u2a = Math.atan2(p2[1] - v[1], p2[0] - v[0]);
  const r = 16 * z;
  const c1 = [v[0] * z + Math.cos(u1a) * r, v[1] * z + Math.sin(u1a) * r];
  const c2 = [v[0] * z + Math.cos(u2a) * r, v[1] * z + Math.sin(u2a) * r];
  const corner = [c1[0] + (c2[0] - v[0] * z), c1[1] + (c2[1] - v[1] * z)];
  return { points: [c1[0], c1[1], corner[0], corner[1], c2[0], c2[1]], stroke: obj.stroke || '#fbbf24', strokeWidth: 2, listening: false };
}

export function angleLabelAnchor(obj, ctx) {
  const z = ctx.vs;
  const v = obj.vertex || [-40, 40], p1 = obj.point1 || [80, 40], p2 = obj.point2 || [-40, -60];
  const a1 = Math.atan2(p1[1] - v[1], p1[0] - v[0]);
  const a2 = Math.atan2(p2[1] - v[1], p2[0] - v[0]);
  const mid = (a1 + a2) / 2;
  const r = 34 * z;
  return [v[0] * z + Math.cos(mid) * r, v[1] * z + Math.sin(mid) * r];
}

// vector_components: main vector + x/y component arrows + two dashed projection guides.
// Drawn relative to the object's centre (origin), like brace/angle.
export function vectorComponentsCfgs(obj, ctx) {
  const z = ctx.vs;
  const vx = (Number.isFinite(obj.vx) ? obj.vx : 120) * z;
  const vy = (Number.isFinite(obj.vy) ? obj.vy : -80) * z;
  const col = obj.fill || '#3b82f6';
  const arrow = (pts, color) => ({ points: pts, stroke: color, fill: color, strokeWidth: 2, pointerLength: 9, pointerWidth: 9, listening: false });
  const dash = (pts) => ({ points: pts, stroke: '#94a3b8', strokeWidth: 1, dash: [4, 4], listening: false });
  return {
    arrows: [
      arrow([0, 0, vx, vy], col),       // main vector
      arrow([0, 0, vx, 0], '#ef4444'),  // x component
      arrow([0, 0, 0, vy], '#22c55e'),  // y component
    ],
    dashes: [dash([vx, vy, vx, 0]), dash([vx, vy, 0, vy])],
  };
}

// ray: a source dot + an arrow in the given direction (object-relative).
export function rayCfgs(obj, ctx) {
  const z = ctx.vs;
  const a = (Number.isFinite(obj.angle) ? obj.angle : 30) * Math.PI / 180;
  const L = (Number.isFinite(obj.length) ? obj.length : 200) * z;
  const tx = L * Math.cos(a), ty = -L * Math.sin(a); // y down on canvas
  const col = obj.fill || '#22d3ee';
  return {
    dot: { x: 0, y: 0, radius: 5, fill: col, listening: false },
    arrow: { points: [0, 0, tx, ty], stroke: col, fill: col, strokeWidth: 2, pointerLength: 9, pointerWidth: 9, listening: false },
  };
}
