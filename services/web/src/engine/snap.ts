export interface SnapCandidate {
  x?: number;
  y?: number;
}

export interface StageSnapConfig {
  width: number;
  height: number;
  gridSize?: number;
  snapToGrid?: boolean;
  snapToCenter?: boolean;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
}

export function stageSnapCandidates(
  stage: StageSnapConfig,
  scale: number,
  offsetX: number,
  offsetY: number
): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];
  const gridSize = Math.max(1, Math.round(stage.gridSize ?? 1));
  const width = stage.width * scale;
  const height = stage.height * scale;

  if (stage.snapToGrid) {
    for (let i = 0; i <= gridSize; i++) {
      candidates.push({ x: offsetX + (width / gridSize) * i });
      candidates.push({ y: offsetY + (height / gridSize) * i });
    }
  }

  if (stage.snapToCenter) {
    candidates.push({ x: offsetX + width / 2 });
    candidates.push({ y: offsetY + height / 2 });
  }

  return candidates;
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
