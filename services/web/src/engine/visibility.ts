// Pure preview-visibility predicate — no Vue, no Konva (testable like projection3d).
// The static `hidden` field gate for the canvas. Playback's transform-clip
// hiddenIds set (frameState.hiddenIds) is a separate mechanism and stays in
// StageCanvas.isVis.
import type { StageObject } from './types.js';

// Local mirror of the annotation set — precedent: store/project.ts deleteObject
// keeps its own local copy as well (the codegen constant is not re-exported
// from the @manim/codegen barrel).
const ANNOTATION_TYPES = new Set(['surrounding_rect', 'underline', 'cross']);

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
