// Deterministic inputs for characterizing the pure config builders.
// A fixed ctx (no component mount) makes every builder output reproducible.

export const STAGE = { width: 1920, height: 1080, backgroundColor: '#000000' };

// Resolved-value ctx: vs/ox/oy fixed; helpers are simple pure stand-ins matching
// the SFC's math so builder output is realistic and stable.
export function makeCtx(overrides = {}) {
  const vs = 0.4, ox = 100, oy = 50;
  const s2c = (sx, sy) => ({ x: ox + sx * vs, y: oy + sy * vs });
  const c2s = (cx, cy) => ({ x: (cx - ox) / vs, y: (cy - oy) / vs });
  return {
    stg: { ...STAGE },
    vs, ox, oy, s2c, c2s,
    eff: (obj) => obj,
    eff3d: (obj) => ({ x3d: obj.x3d ?? 0, y3d: obj.y3d ?? 0, z3d: obj.z3d ?? 0 }),
    live: () => null,
    applyEffects: (cfg) => cfg,
    hexToRgba: (h, a) => `rgba(${h},${a})`,
    themeAccent: '#4CEEF9', themeSurface: '#E6EDF3',
    imageElements: {},
    frameState: { objectOverrides: {}, hiddenIds: new Set() },
    is3D: false,
    cam3d: { phi: 75, theta: -45, zoom: 1, mode: 'perspective', focalDistance: 8 },
    proj3DScale: 60, projCx: 484, projCy: 266,
    iso: (x, y, z, cx, cy, s) => ({ px: cx + (x - z) * s * 0.5, py: cy - y * s }),
    measureTextWidth: (t) => (t ? String(t).length * 10 : 0),
    activeTool: 'select',
    ...overrides,
  };
}

// One representative object per supported type. Each extraction task ADDS the
// entries it needs (one per type in that module).
export const OBJECTS = {
  rectangle:   { id: 'rect1',   type: 'rectangle',   x: 960, y: 540, width: 200, height: 120, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, cornerRadius: 16 },
  square:      { id: 'sq1',     type: 'square',       x: 400, y: 300, width: 150, height: 150, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, cornerRadius: 20 },
  circle:      { id: 'circ1',   type: 'circle',       x: 960, y: 540, width: 160, height: 160, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0 },
  ellipse:     { id: 'ell1',    type: 'ellipse',      x: 700, y: 400, width: 200, height: 120, fill: '#8B5CF6', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 15 },
  dot:         { id: 'dot1',    type: 'dot',          x: 500, y: 300, width: 40,  height: 40,  fill: '#F59E0B', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0 },
  heart:       { id: 'hrt1',    type: 'heart',        x: 800, y: 500, width: 150, height: 130, fill: '#EF4444', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0 },
  triangle:    { id: 'tri1',    type: 'triangle',     x: 600, y: 400, width: 160, height: 140, fill: '#F97316', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0 },
  polygon:     { id: 'poly1',   type: 'polygon',      x: 960, y: 540, width: 180, height: 180, fill: '#06B6D4', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, sides: 6 },
  polygon_free:{ id: 'pf1',     type: 'polygon_free', x: 960, y: 540, width: 200, height: 200, fill: '#84CC16', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, vertices: [[-40, 40], [40, 40], [0, -50]] },
  star:        { id: 'star1',   type: 'star',         x: 960, y: 400, width: 160, height: 160, fill: '#FBBF24', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, starArms: 5, innerRatio: 0.4 },
  line:        { id: 'line1',   type: 'line',         x: 960, y: 540, width: 300, height: 10,  fill: '#94A3B8', stroke: '#94A3B8', strokeWidth: 3, opacity: 1, rotation: 0 },
  arrow:       { id: 'arr1',    type: 'arrow',        x: 960, y: 540, width: 280, height: 10,  fill: '#EF4444', stroke: '#EF4444', strokeWidth: 2, opacity: 1, rotation: 0 },
  annulus:     { id: 'ann1',    type: 'annulus',      x: 960, y: 540, width: 180, height: 180, fill: '#6366F1', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, innerRadius: 35, outerRadius: 70 },
  sector:      { id: 'sec1',    type: 'sector',       x: 960, y: 540, width: 180, height: 180, fill: '#EC4899', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, radius: 70, sweepAngle: 120, startAngle: 0 },
  arc:         { id: 'arc1',    type: 'arc',          x: 960, y: 540, width: 180, height: 180, fill: '#F97316', stroke: '#F97316', strokeWidth: 4, opacity: 1, rotation: 0, radius: 70, sweepAngle: 180, startAngle: 0 },
  double_arrow:{ id: 'da1',     type: 'double_arrow', x: 960, y: 540, width: 300, height: 10,  fill: '#EF4444', stroke: '#EF4444', strokeWidth: 2, opacity: 1, rotation: 0 },
  parametric:  { id: 'par1',    type: 'parametric',   x: 960, y: 540, width: 200, height: 200, fill: '#10B981', stroke: '#10B981', strokeWidth: 4, opacity: 1, rotation: 0, xExpr: 'cos(t)', yExpr: 'sin(t)', tMin: 0, tMax: 6.28 },
  text:        { id: 'txt1',    type: 'text',         x: 960, y: 300, width: 400, height: 80,  fill: '#FFFFFF', opacity: 1, rotation: 0, content: 'Hello', fontSize: 48, fontFamily: 'Roboto' },
  counter:     { id: 'cnt1',    type: 'counter',      x: 960, y: 540, width: 200, height: 80,  fill: '#10B981', opacity: 1, rotation: 0, value: 42, numDecimals: 1, suffix: '%' },
  latex:       { id: 'tex1',    type: 'latex',        x: 960, y: 700, width: 300, height: 80,  fill: '#FFFFFF', opacity: 1, rotation: 0, content: 'x^2' },
  group:       { id: 'grp1',   type: 'group',        x: 960, y: 540, width: 200, height: 200, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, childIds: [] },
  dot_grid:    { id: 'dg1',    type: 'dot_grid',     x: 960, y: 540, width: 200, height: 200, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, gridCols: 3, gridRows: 3, dotSpacing: 40 },
  matrix:      { id: 'mat1',   type: 'matrix',       x: 960, y: 540, width: 160, height: 120, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, matrixData: [['1', '2'], ['3', '4']], bracket: '[' },
  table:       { id: 'tbl1',   type: 'table',        x: 960, y: 540, width: 200, height: 140, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0, cellData: [['a', 'b'], ['c', 'd']], mathMode: false, rowLabels: [], colLabels: [] },
  polar_plane: { id: 'pp1',    type: 'polar_plane',  x: 960, y: 540, width: 400, height: 400, fill: '#334155', stroke: '#64748b', strokeWidth: 2, opacity: 1, rotation: 0, radiusMax: 4, radiusStep: 1, azimuthUnits: 12 },
  graph:       { id: 'gr1',    type: 'graph',        x: 960, y: 540, width: 200, height: 200, fill: '#4ceef9', stroke: '#94a3b8', strokeWidth: 2, opacity: 1, rotation: 0, vertices: ['A', 'B'], edges: [['A', 'B']], positions: { A: [-40, 0], B: [40, 0] }, directed: false, showLabels: true },
  vector_field:{ id: 'vf1',   type: 'vector_field', x: 960, y: 540, width: 600, height: 400, fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 2, opacity: 1, rotation: 0, fx: 'y', fy: '-x', xRange: [-3, 3, 1], yRange: [-2, 2, 1] },
};
