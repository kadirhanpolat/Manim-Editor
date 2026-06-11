export interface SnapCandidate {
  x?: number;
  y?: number;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
}

export function snapPoint(
  x: number,
  y: number,
  candidates: SnapCandidate[],
  threshold = 8
): SnapResult {
  let outX = x;
  let outY = y;
  let snappedX = false;
  let snappedY = false;

  for (const c of candidates) {
    if (!snappedX && c.x !== undefined && Math.abs(x - c.x) <= threshold) {
      outX = c.x;
      snappedX = true;
    }
    if (!snappedY && c.y !== undefined && Math.abs(y - c.y) <= threshold) {
      outY = c.y;
      snappedY = true;
    }
    if (snappedX && snappedY) break;
  }

  return { x: outX, y: outY, snappedX, snappedY };
}
