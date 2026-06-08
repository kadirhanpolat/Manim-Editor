/**
 * Transform / Morph Engine
 *
 * Point resampling, interpolation, and color blending for smooth morphing.
 */

import type { Point, RGB, StageObject, MorphState } from './types.js';

/**
 * Resample a closed point path to have exactly `targetCount` evenly-spaced points.
 * Uses linear interpolation along the path arc length.
 *
 * @param {Array<{x: number, y: number}>} points - Source points
 * @param {number} targetCount - Desired number of output points
 * @returns {Array<{x: number, y: number}>}
 */
export function resamplePoints(points: Point[], targetCount: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return Array.from({ length: targetCount }, () => ({ ...points[0] }));
  }
  if (points.length === targetCount) {
    return points.map((p) => ({ ...p }));
  }

  // Compute cumulative arc lengths (closed path)
  const n = points.length;
  const cumLen: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const prev = points[i - 1];
    const curr = points[i % n];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }

  const totalLen = cumLen[n];
  if (totalLen === 0) {
    return Array.from({ length: targetCount }, () => ({ ...points[0] }));
  }

  const result: Point[] = [];
  for (let i = 0; i < targetCount; i++) {
    const targetDist = (i / targetCount) * totalLen;

    // Binary search for the segment containing targetDist
    let lo = 0,
      hi = n;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cumLen[mid] <= targetDist) lo = mid;
      else hi = mid;
    }

    const segStart = lo;
    const segEnd = (lo + 1) % n;
    const segLen = cumLen[lo + 1] - cumLen[lo];

    if (segLen < 1e-10) {
      result.push({ x: points[segStart].x, y: points[segStart].y });
    } else {
      const frac = (targetDist - cumLen[lo]) / segLen;
      result.push({
        x: points[segStart].x + (points[segEnd].x - points[segStart].x) * frac,
        y: points[segStart].y + (points[segEnd].y - points[segStart].y) * frac,
      });
    }
  }

  return result;
}

/**
 * Interpolate between two point arrays of equal length.
 * @param {Array<{x, y}>} a - Source points
 * @param {Array<{x, y}>} b - Target points
 * @param {number} t - Progress [0, 1]
 * @returns {Array<{x, y}>}
 */
export function interpolatePoints(a: Point[], b: Point[], t: number): Point[] {
  const len = Math.min(a.length, b.length);
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = {
      x: a[i].x + (b[i].x - a[i].x) * t,
      y: a[i].y + (b[i].y - a[i].y) * t,
    };
  }
  return result;
}

/**
 * Parse a hex color string to {r, g, b} (0-255).
 */
export function parseHex(hex: string): RGB {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/**
 * Convert {r, g, b} to hex string.
 */
export function toHex(rgb: RGB): string {
  const r = Math.round(Math.max(0, Math.min(255, rgb.r)));
  const g = Math.round(Math.max(0, Math.min(255, rgb.g)));
  const b = Math.round(Math.max(0, Math.min(255, rgb.b)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Interpolate between two hex colors.
 */
export function interpolateColor(
  colorA: string | undefined,
  colorB: string | undefined,
  t: number
): string {
  if (!colorA || !colorB) return colorB || colorA || '#ffffff';
  const a = parseHex(colorA);
  const b = parseHex(colorB);
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

/**
 * Interpolate a numeric value.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute a full morph state between two objects at progress t.
 * Both objects must have outline points pre-computed.
 *
 * @param {Object} sourceObj - Source stage object
 * @param {Object} targetObj - Target stage object
 * @param {Array} sourcePoints - Pre-resampled source points
 * @param {Array} targetPoints - Pre-resampled target points
 * @param {number} t - Progress [0, 1]
 * @returns {Object} Morph state with interpolated properties
 */
export function computeMorphState(
  sourceObj: StageObject,
  targetObj: StageObject,
  sourcePoints: Point[],
  targetPoints: Point[],
  t: number
): MorphState {
  const morphedPoints = interpolatePoints(sourcePoints, targetPoints, t);

  return {
    points: morphedPoints,
    x: lerp(sourceObj.x ?? 0, targetObj.x ?? 0, t),
    y: lerp(sourceObj.y ?? 0, targetObj.y ?? 0, t),
    width: lerp(sourceObj.width ?? 0, targetObj.width ?? 0, t),
    height: lerp(sourceObj.height ?? 0, targetObj.height ?? 0, t),
    rotation: lerp(sourceObj.rotation || 0, targetObj.rotation || 0, t),
    fill: interpolateColor(sourceObj.fill, targetObj.fill, t),
    stroke: interpolateColor(sourceObj.stroke, targetObj.stroke, t),
    strokeWidth: lerp(sourceObj.strokeWidth || 2, targetObj.strokeWidth || 2, t),
    opacity: lerp(
      sourceObj.opacity !== undefined ? sourceObj.opacity : 1,
      targetObj.opacity !== undefined ? targetObj.opacity : 1,
      t
    ),
  };
}

/**
 * Create a trailing ghost effect for simulated motion blur.
 * Returns an array of ghost states with decreasing opacity.
 */
export function createMotionGhosts(
  prevState: MorphState,
  currentState: MorphState,
  numGhosts = 3
): Array<Record<string, unknown>> {
  const ghosts: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= numGhosts; i++) {
    const gt = i / (numGhosts + 1);
    ghosts.push({
      points: interpolatePoints(prevState.points, currentState.points, gt),
      x: lerp(prevState.x, currentState.x, gt),
      y: lerp(prevState.y, currentState.y, gt),
      fill: currentState.fill,
      stroke: currentState.stroke,
      strokeWidth: currentState.strokeWidth,
      opacity: currentState.opacity * (1 - gt) * 0.3,
    });
  }
  return ghosts;
}

export default {
  resamplePoints,
  interpolatePoints,
  interpolateColor,
  lerp,
  computeMorphState,
  createMotionGhosts,
  parseHex,
  toHex,
};
