// Overlay config builders for StageCanvas (emphasis + path3d + morph shapes).
// Pure functions — no Vue refs. All live values come through ctx.
// ctx fields used: eff, s2c, vs, iso, is3D, frameState, projCx, projCy, proj3DScale.

/**
 * Emphasis overlay configs (circumscribe overlays for all objects).
 * @param {Array} objects - resolved objects array (objects.value from SFC)
 * @param {object} ctx    - resolved ctx
 * @returns {Array}
 */
export function emphasisOverlays(objects, ctx) {
  const out = [];
  const ovMap = ctx.frameState.objectOverrides || {};
  for (const obj of objects) {
    const ov = ovMap[obj.id];
    const e = ov && ov._emphasis;
    if (!e || e.kind !== 'circumscribe') continue;
    const m = ctx.eff(obj);
    const c = ctx.s2c(m.x, m.y);
    const w = (m.width || 100) * 1.25 * ctx.vs;
    const h = (m.height || 100) * 1.25 * ctx.vs;
    const p = e.progress;
    const op = e.fadeOut ? Math.sin(Math.PI * p) : Math.min(1, p * 2);
    const base = {
      stroke: e.color,
      strokeWidth: 3,
      opacity: Math.max(0, op),
      listening: false,
      id: obj.id + '-emph',
    };
    if (e.shape === 'Circle') {
      out.push({ ...base, kind: 'ellipse', x: c.x, y: c.y, radiusX: w / 2, radiusY: h / 2 });
    } else {
      out.push({ ...base, kind: 'rect', x: c.x - w / 2, y: c.y - h / 2, width: w, height: h });
    }
  }
  return out;
}

/**
 * 3D path_move polyline configs — draws committed path_move paths as a purple
 * dashed polyline in the single 3D view (visual only).
 * @param {Array} tracks - store.project.tracks (or [])
 * @param {object} ctx   - resolved ctx
 * @returns {Array}
 */
export function path3dPolylines(tracks, ctx) {
  if (!ctx.is3D) return [];
  const out = [];
  for (const track of tracks) {
    for (const clip of track.clips || []) {
      if (clip.type !== 'path_move' || !Array.isArray(clip.path)) continue;
      if (!(clip.path[0] && 'x3d' in clip.path[0])) continue;
      const pts = [];
      for (const pt of clip.path) {
        const i = ctx.iso(pt.x3d, pt.y3d ?? 0, pt.z3d, ctx.projCx, ctx.projCy, ctx.proj3DScale);
        pts.push(i.px, i.py);
      }
      out.push({
        stroke: '#a855f7',
        strokeWidth: 1.5,
        dash: [4, 4],
        listening: false,
        opacity: 0.7,
        points: pts,
        id: clip.id + '-path3d',
      });
    }
  }
  return out;
}

/**
 * Morph shape Konva line config — used for each entry in morphShapes.
 * @param {object} m   - morph shape descriptor from frameState.morphShapes
 * @param {object} ctx - resolved ctx
 * @returns {object}
 */
export function morphCfg(m, ctx) {
  if (!m || !m.flatPoints || m.flatPoints.length < 4) return { points: [], closed: true };
  const p = ctx.s2c(m.x, m.y);
  const sp = [];
  for (let i = 0; i < m.flatPoints.length; i += 2) {
    sp.push(m.flatPoints[i] * ctx.vs);
    sp.push(m.flatPoints[i + 1] * ctx.vs);
  }
  return {
    x: p.x,
    y: p.y,
    points: sp,
    closed: true,
    fill: m.fill || '#fff',
    stroke: m.stroke || '#fff',
    strokeWidth: ((m.strokeWidth || 2) * ctx.vs) / 2,
    opacity: m.opacity ?? 1,
    listening: false,
  };
}
