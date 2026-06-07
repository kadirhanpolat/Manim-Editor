// Manim Z-up spherical-camera projection (preview-only).
// phi  = polar angle from +Z (deg), theta = azimuth in XY (deg).
// n=(sφcθ, sφsθ, cφ) view dir; r=(-sθ, cθ, 0) screen-right; u=n×r=(-cφcθ, -cφsθ, sφ) screen-up.

const DEG = Math.PI / 180;

function basis(phi, theta) {
  const ph = phi * DEG,
    th = theta * DEG;
  return {
    sp: Math.sin(ph),
    cp: Math.cos(ph),
    st: Math.sin(th),
    ct: Math.cos(th),
  };
}

/**
 * Project a 3D point to canvas pixels.
 * @param {{x3d?:number,y3d?:number,z3d?:number}} p
 * @param {{phi?:number,theta?:number,zoom?:number,mode?:string,focalDistance?:number}} cam
 * @returns {{px:number, py:number}}
 */
export function project3D(p, cam, cx, cy, scale) {
  const { phi = 75, theta = -45, zoom = 1, mode = 'orthographic', focalDistance = 8 } = cam || {};
  const { sp, cp, st, ct } = basis(phi, theta);
  const x = p.x3d ?? 0,
    y = p.y3d ?? 0,
    z = p.z3d ?? 0;
  let sx = -x * st + y * ct;
  let sy = -cp * (x * ct + y * st) + z * sp;
  if (mode === 'perspective') {
    const d = x * sp * ct + y * sp * st + z * cp; // P·n
    const denom = focalDistance - d;
    const f = denom > 1e-6 ? focalDistance / denom : 1e6;
    sx *= f;
    sy *= f;
  }
  const s = scale * zoom;
  return { px: cx + sx * s, py: cy - sy * s };
}

/**
 * Perspective size factor for an object at point p (same f project3D applies to
 * position). 1 in orthographic mode. >1 nearer the camera, <1 farther — use it
 * to scale rendered object sizes so they grow/shrink with depth.
 * @returns {number}
 */
export function perspectiveScale(p, cam) {
  const { phi = 75, theta = -45, mode = 'orthographic', focalDistance = 8 } = cam || {};
  if (mode !== 'perspective') return 1;
  const { sp, cp, st, ct } = basis(phi, theta);
  const x = p.x3d ?? 0,
    y = p.y3d ?? 0,
    z = p.z3d ?? 0;
  const d = x * sp * ct + y * sp * st + z * cp; // P·n
  const denom = focalDistance - d;
  return denom > 1e-6 ? focalDistance / denom : 1e6;
}

/**
 * Inverse of project3D for iso drag, holding y3d fixed. Orthographic only.
 * Returns { x3d, z3d }; either may be null when ill-conditioned (st≈0 or sp≈0).
 */
export function unprojectIso(px, py, cam, cx, cy, scale, yKnown) {
  const { phi = 75, theta = -45, zoom = 1 } = cam || {};
  const { sp, cp, st, ct } = basis(phi, theta);
  const s = scale * zoom;
  const sx = (px - cx) / s;
  const sy = (cy - py) / s;
  // sx = -st*x + ct*y  -> x = (ct*y - sx)/st
  const x3d = Math.abs(st) > 1e-6 ? (ct * yKnown - sx) / st : null;
  // sy = -cp*(x*ct + y*st) + z*sp -> z = (sy + cp*(x*ct + y*st))/sp
  let z3d = null;
  if (Math.abs(sp) > 1e-6 && x3d !== null) {
    z3d = (sy + cp * (x3d * ct + yKnown * st)) / sp;
  }
  return { x3d, z3d };
}
