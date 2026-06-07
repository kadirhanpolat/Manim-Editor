// Shared structural types for the preview engine. These describe the runtime
// "stage" shapes the playback engine reads (a loose superset of store objects).
// Phase 3/4 may reconcile these with the @manim/codegen domain model.

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

export interface Keyframe {
  time: number;
  value: number;
  easing?: EasingSpec;
}

export interface KeyframeRange {
  start: number;
  end: number;
}

// Wide stage object (preview runtime shape). Mirrors store objects loosely.
export interface StageObject {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  x3d?: number;
  y3d?: number;
  z3d?: number;
  enterTime?: number;
  duration?: number;
  enterAnim?: string;
  exitAnim?: string;
  enterAnimDur?: number;
  exitAnimDur?: number;
  keyframes?: Record<string, Keyframe[]>;
  keyframeMode?: Record<string, string>;
  [k: string]: unknown;
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

// Known animation parameter bag. Typed fields keep playback arithmetic strict;
// the index signature preserves the wide, open-ended shape.
export interface ClipParams {
  targetX?: number;
  targetY?: number;
  targetScaleX?: number;
  targetScaleY?: number;
  targetOpacity?: number;
  targetRotation?: number;
  scale_factor?: number;
  color?: string;
  n_wiggles?: number;
  rotation_angle?: number;
  scale_value?: number;
  shape?: string;
  fade_out?: boolean;
  phi?: number;
  theta?: number;
  zoom?: number;
  [k: string]: unknown;
}

export interface Clip {
  id: string;
  type: string;
  startTime: number;
  duration: number;
  easing?: string;
  sourceId?: string;
  targetId?: string;
  objectId?: string;
  params?: ClipParams;
  path?: Array<Point | Point3D>;
  from?: number;
  to?: number;
  overshoot?: number;
  settle?: number;
  morphQuality?: string;
  [k: string]: unknown;
}

export interface Track {
  clips?: Clip[];
  [k: string]: unknown;
}

export interface CameraClip {
  startTime: number;
  duration: number;
  easing?: string;
  params?: ClipParams;
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
