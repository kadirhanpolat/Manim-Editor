// Pure marquee-selection geometry — no Konva, no Vue (testable like projection3d).
// All rects are axis-aligned. Object bounds are CENTER-based in project
// coordinates (0–1920 × 0–1080), matching StageCanvas ctx.objectBounds.
import type { StageObject } from './types.js';

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalize two drag corners (any direction) into an x/y/w/h rect. */
export function normalizeRect(x1: number, y1: number, x2: number, y2: number): MarqueeRect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Center-based axis-aligned bounding box of an object in project coords. */
export function objectStageBounds(obj: StageObject): MarqueeRect {
  const w = obj.width ?? 0;
  const h = obj.height ?? 0;
  return { x: (obj.x ?? 0) - w / 2, y: (obj.y ?? 0) - h / 2, width: w, height: h };
}

/** True when the marquee rect INTERSECTS the object bounds (Figma semantics —
 *  touching counts, full containment is not required). */
export function marqueeHit(rect: MarqueeRect, objBounds: MarqueeRect | null): boolean {
  if (!objBounds) return false;
  return (
    rect.x <= objBounds.x + objBounds.width &&
    rect.x + rect.width >= objBounds.x &&
    rect.y <= objBounds.y + objBounds.height &&
    rect.y + rect.height >= objBounds.y
  );
}

/** Ids of objects the marquee selects. Locked and hidden objects are skipped. */
export function marqueeSelectIds(rect: MarqueeRect, objects: StageObject[]): string[] {
  return objects
    .filter((o) => !o.locked && o.hidden !== true && marqueeHit(rect, objectStageBounds(o)))
    .map((o) => o.id);
}
