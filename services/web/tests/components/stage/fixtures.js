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
    applyEffects: () => {},
    hexToRgba: (h, a) => `rgba(${h},${a})`,
    themeAccent: '#4CEEF9', themeSurface: '#E6EDF3',
    imageElements: {},
    frameState: { objectOverrides: {}, hiddenIds: new Set() },
    is3D: false,
    cam3d: { phi: 75, theta: -45, zoom: 1, mode: 'perspective', focalDistance: 8 },
    proj3DScale: 60, projCx: 484, projCy: 266,
    iso: (x, y, z, cx, cy, s) => ({ px: cx + (x - z) * s * 0.5, py: cy - y * s }),
    measureTextWidth: (t) => (t ? String(t).length * 10 : 0),
    ...overrides,
  };
}

// One representative object per supported type. Each extraction task ADDS the
// entries it needs (one per type in that module).
export const OBJECTS = {
  rectangle: { id: 'rect1', type: 'rectangle', x: 960, y: 540, width: 200, height: 120, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0 },
  circle:    { id: 'circ1', type: 'circle', x: 960, y: 540, width: 160, height: 160, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2, opacity: 1, rotation: 0 },
};
