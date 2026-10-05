// Pure preview-visibility predicate — no Vue, no Konva (testable like projection3d).
// The static `hidden` field gate for the canvas. Playback's transform-clip
// hiddenIds set (frameState.hiddenIds) is a separate mechanism and stays in
// StageCanvas.isVis.
import type { StageObject } from './types.js';

// The single annotation set from codegen (the store's cascade delete uses it too).
import { ANNOTATION_TYPES } from '@manim/codegen';

/**
 * True if the object must not be drawn in the preview:
 * - its own `hidden` flag is true, or
 * - it is an annotation whose target object is hidden (cascade — mirrors the
 *   codegen NameError cascade in @manim/codegen generateScene).
 */
export function isPreviewHidden(
  obj: StageObject | null | undefined,
  objectById: (id: string) => StageObject | null
): boolean {
  if (!obj) return false;
  if (obj.hidden === true) return true;
  if (ANNOTATION_TYPES.has(obj.type) && typeof obj.targetId === 'string') {
    const target = objectById(obj.targetId);
    if (target && target.hidden === true) return true;
  }
  return false;
}
