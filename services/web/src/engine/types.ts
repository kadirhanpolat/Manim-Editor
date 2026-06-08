// Engine type model.
//
// The shared domain shapes (objects, clips, tracks, keyframes, paths) are
// re-exported from @manim/codegen — the single source of truth — so the playback
// engine and the canvas operate on the SAME types as the store and codegen (no
// parallel definitions, no `as unknown as` bridges between "StageObject" and
// "SceneObject"). Engine-only runtime shapes (frame state, overrides, morph state,
// 3D projection) stay local below.

export type {
  SceneObject,
  // The engine historically called the on-stage object `StageObject`; it is the
  // same shape as the codegen `SceneObject`. Kept as an alias for readability.
  SceneObject as StageObject,
  Clip,
  Track,
  PathPoint,
  Keyframe,
  KeyframeMap,
} from '@manim/codegen';

import type { Clip } from '@manim/codegen';

// Camera-move clips (carry phi/theta/zoom or targetX/targetY/zoom) live in
// project.cameraTrack as ordinary Clips.
export type CameraClip = Clip;

// The animation parameter bag, derived from the codegen Clip so it stays in sync.
export type ClipParams = NonNullable<Clip['params']>;

export interface Point {
  x: number;
  y: number;
}

export interface Point3D {
  x3d: number;
  y3d: number;
  z3d: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export type Vertex = [number, number];

export interface EasingSpec {
  type: string;
  handles?: number[];
}

export interface KeyframeRange {
  start: number;
  end: number;
}

// Minimal time-window shape the scheduling helpers (isClipActive/getClipProgress/
// isClipCompleted) need. Both Clip and CameraClip satisfy it.
export interface TimedClip {
  startTime: number;
  duration: number;
}

// Per-object animatable overrides produced each frame.
export interface Overrides {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  scaleX?: number;
  scaleY?: number;
  fill?: string;
  stroke?: string;
  value?: number;
  x3d?: number;
  y3d?: number;
  z3d?: number;
  [k: string]: unknown;
}

export interface MorphState {
  points: Point[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  flatPoints?: number[];
  [k: string]: unknown;
}

export interface ClipResult {
  objectId?: string;
  overrides?: Overrides;
  morphState?: MorphState;
  hideIds?: string[];
  clipId?: string;
  [k: string]: unknown;
}

export interface EvaluatedClip {
  trackIndex: number;
  clipResult: ClipResult | null;
}

export interface CameraState {
  x?: number;
  y?: number;
  zoom?: number;
  phi?: number;
  theta?: number;
  is3d?: boolean;
}

export interface FrameState {
  objectOverrides: Record<string, Overrides>;
  morphShapes: Array<MorphState & { trackIndex?: number; clipId?: string }>;
  hiddenIds: Set<string>;
  cameraState?: CameraState | null;
}

// Camera parameters for the 3D projection helpers (projection3d.ts).
export interface Cam3D {
  phi?: number;
  theta?: number;
  zoom?: number;
  mode?: string;
  focalDistance?: number;
}
