// services/web/src/engine/keyframe.ts

import type { Keyframe, KeyframeRange } from './types.js';

const PRESET_HANDLES: Record<string, number[]> = {
  linear: [0, 0, 1, 1],
  ease_in: [0.42, 0, 1, 1],
  ease_out: [0, 0, 0.58, 1],
  ease_in_out: [0.42, 0, 0.58, 1],
};

function cubicBezierY(x1: number, y1: number, x2: number, y2: number, t: number): number {
  function bx(u: number): number {
    return 3 * u * (1 - u) * (1 - u) * x1 + 3 * u * u * (1 - u) * x2 + u * u * u;
  }
  function by(u: number): number {
    return 3 * u * (1 - u) * (1 - u) * y1 + 3 * u * u * (1 - u) * y2 + u * u * u;
  }
  function bxd(u: number): number {
    return 3 * (1 - u) * (1 - u) * x1 + 6 * u * (1 - u) * (x2 - x1) + 3 * u * u * (1 - x2);
  }
  let g = t;
  for (let i = 0; i < 8; i++) {
    const err = bx(g) - t;
    if (Math.abs(err) < 1e-7) break;
    const d = bxd(g);
    if (Math.abs(d) < 1e-6) break;
    g -= err / d;
  }
  return by(Math.max(0, Math.min(1, g)));
}

export function interpolateKeyframes(keyframes: Keyframe[] | null | undefined, time: number): number | null {
  if (!keyframes || keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0].value;

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  let lo = 0,
    hi = sorted.length - 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (sorted[mid].time <= time) lo = mid;
    else hi = mid - 1;
  }

  const k1 = sorted[lo],
    k2 = sorted[lo + 1];
  const rawT = (time - k1.time) / (k2.time - k1.time);
  const easing = k1.easing || { type: 'linear' };
  const h =
    easing.type === 'bezier' && easing.handles
      ? easing.handles
      : PRESET_HANDLES[easing.type] || PRESET_HANDLES.linear;

  const t = cubicBezierY(h[0], h[1], h[2], h[3], rawT);
  return k1.value + (k2.value - k1.value) * t;
}

export function getKeyframeRange(keyframes: Keyframe[] | null | undefined): KeyframeRange | null {
  if (!keyframes || keyframes.length === 0) return null;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  return { start: sorted[0].time, end: sorted[sorted.length - 1].time };
}
