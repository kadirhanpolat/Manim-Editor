// Shared domain model for the Manim Motion Editor.
// Wide-interface style: type-specific fields are optional on a single SceneObject.
// (Discriminated-union refinement is deferred to Phase 4.)

export type ResolveAsset = (obj: SceneObject, ext: string) => string;

export interface Stage {
  width: number;
  height: number;
  backgroundColor?: string;
  [k: string]: unknown;
}

export interface Camera3d {
  phi?: number;
  theta?: number;
  zoom?: number;
  projection?: 'orthographic' | 'perspective';
  focalDistance?: number;
}

export interface GradientEffect {
  colors?: string[];
  angle?: number;
}
export interface DashEffect {
  numDashes?: number;
  ratio?: number;
}
export interface ShadowEffect {
  color?: string;
  opacity?: number;
  dx?: number;
  dy?: number;
  blur?: number;
}

export interface Keyframe {
  time: number;
  value: number;
  easing?: { type: string; handles?: number[] };
}

export type KeyframeMap = Record<string, Keyframe[]>;
export type KeyframeCodegenMode = 'UpdateFromAlphaFunc' | 'animate' | 'ValueTracker';

export interface PathPoint {
  x?: number;
  y?: number;
  x3d?: number;
  y3d?: number;
  z3d?: number;
}

export interface AudioConfig {
  type?: 'file' | 'gtts' | 'coqui';
  src?: string;
  text?: string;
  lang?: string;
  syncMode?: 'auto' | 'manual';
  offset?: number;
  status?: 'pending' | 'ready' | 'error';
  duration?: number;
}

/**
 * Wide scene-object interface. Common fields are explicit; object-type-specific
 * fields are added here during the objects.ts / objects3d.ts conversion (Task 3).
 * The index signature keeps the conversion incremental without losing the typed
 * backbone above.
 */
export interface SceneObject {
  id: string;
  type: string;

  // transform / layout
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  zOrder?: number;
  name?: string;
  x3d?: number;
  y3d?: number;
  z3d?: number;

  // common style
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
  text?: string;
  fontSize?: number;

  // style + effects
  fillOpacity?: number;
  strokeOpacity?: number;
  gradient?: GradientEffect;
  dash?: DashEffect;
  shadow?: ShadowEffect;
  cornerRadius?: number;
  fontFamily?: string;

  // enter/exit animation
  enterTime?: number;
  duration?: number;
  enterAnim?: string;
  exitAnim?: string;
  enterAnimDur?: number;
  exitAnimDur?: number;

  // keyframes
  keyframes?: KeyframeMap;
  keyframeCodegen?: Record<string, KeyframeCodegenMode>;
  keyframeMode?: Record<string, string>;

  // object-type-specific fields are added during Task 3
  [k: string]: unknown;
}

export interface Clip {
  id?: string;
  type: string;
  startTime: number;
  duration: number;
  easing?: string;
  parallel?: boolean;
  lag_ratio?: number;

  // targets
  sourceId?: string;
  targetId?: string;
  objectId?: string;

  // transform
  matchTerms?: boolean;

  // generic params bag
  params?: {
    targetX?: number;
    targetY?: number;
    targetScaleX?: number;
    targetScaleY?: number;
    targetOpacity?: number;
    targetRotation?: number;
    zoom?: number;
    phi?: number;
    theta?: number;
    // emphasis (indicate/flash/wiggle/circumscribe/focus_on)
    scale_factor?: number;
    n_wiggles?: number;
    rotation_angle?: number;
    scale_value?: number;
    shape?: string;
    fade_out?: boolean;
    color?: string;
    [k: string]: unknown;
  };

  // morph/overshoot
  overshoot?: number;
  settle?: number;
  morphQuality?: string;

  // rotate (3D)
  axis?: 'X' | 'Y' | 'Z';
  angle?: number;

  // path_move
  path?: PathPoint[];

  // count
  from?: number;
  to?: number;

  // audio
  audio?: AudioConfig;
}

export interface Group {
  id: string;
  childIds?: string[];
  name?: string;
  margin?: number;
  collapsed?: boolean;
}

export interface KeyframeDefaults {
  mode?: string;
  codegenMode?: KeyframeCodegenMode;
}

export interface Track {
  id: string;
  name?: string;
  clips: Clip[];
}

export interface Project {
  name: string;
  stage: Stage;
  objects: SceneObject[];
  tracks: Track[];
  cameraTrack?: Clip[];
  groups?: Group[];
  sceneType?: '2d' | '3d';
  cameraType?: 'static' | 'moving';
  camera3d?: Camera3d;
  keyframeDefaults?: KeyframeDefaults;
}

/** A scheduled animation line produced internally by generateScene. */
export interface GeneratedStep {
  time: number;
  order: number;
  code: string;
  dur: number;
  audio?: AudioConfig;
  _clipId?: string;
}

export interface GenerateOptions {
  resolveAsset: ResolveAsset;
}
