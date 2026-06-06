// StageCtx — the single bridge between the reactive SFC and the pure config builders.
// Every field is a *resolved value* (not a ref). The orchestrator rebuilds this object
// reactively (inside a computed) so builders always see current values.
export const CTX_KEYS = [
  'stg','vs','ox','oy','s2c','c2s','eff','eff3d','live','applyEffects','hexToRgba',
  'themeAccent','themeSurface','imageElements','frameState','is3D','cam3d',
  'proj3DScale','projCx','projCy','iso','measureTextWidth',
  'activeTool',
];
