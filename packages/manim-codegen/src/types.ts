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
  enterAnimDir?: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
  enterAnimScale?: number;
  exitAnimScale?: number;

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

// ─── Per-type narrow interfaces ────────────────────────────────────────────
// Each extends SceneObject with a literal `type` discriminant so components
// can narrow once and access type-specific fields without inline casts.

export interface ParametricObject extends SceneObject {
  type: 'parametric';
  xExpr?: string;
  yExpr?: string;
  tMin?: number;
  tMax?: number;
}

export interface VectorFieldObject extends SceneObject {
  type: 'vector_field';
  fx?: string;
  fy?: string;
  xRange?: number[];
  yRange?: number[];
}

export interface DotGridObject extends SceneObject {
  type: 'dot_grid';
  gridCols?: number;
  gridRows?: number;
  dotSpacing?: number;
  dotRadius?: number;
}

export interface TableObject extends SceneObject {
  type: 'table';
  cellData?: string[][];
  mathMode?: boolean;
  rowLabels?: string[];
  colLabels?: string[];
}

export interface ArcSectorObject extends SceneObject {
  type: 'arc' | 'sector';
  radius?: number;
  startAngle?: number;
  sweepAngle?: number;
}

export interface AnnulusObject extends SceneObject {
  type: 'annulus';
  innerRadius?: number;
  outerRadius?: number;
}

export interface StarObject extends SceneObject {
  type: 'star';
  starArms?: number;
  innerRatio?: number;
}

export interface RayObject extends SceneObject {
  type: 'ray';
  angle?: number;
  length?: number;
}

export interface PlaneObject extends SceneObject {
  type: 'numberplane' | 'complex_plane' | 'polar_plane';
  xRange?: number[];
  yRange?: number[];
  // polar_plane extras
  radiusMax?: number;
  radiusStep?: number;
  azimuthUnits?: number;
}

export interface GraphEntry {
  id: string;
  expression?: string;
  color?: string;
  xMin?: number;
  xMax?: number;
  strokeWidth?: number;
  area?: {
    enabled?: boolean;
    xMin?: number;
    xMax?: number;
    opacity?: number;
    color?: string;
    [k: string]: unknown;
  };
  riemann?: {
    enabled?: boolean;
    xMin?: number;
    xMax?: number;
    dx?: number;
    type?: string;
    color?: string;
    [k: string]: unknown;
  };
  tangent?: {
    enabled?: boolean;
    x?: number;
    length?: number;
    color?: string;
    [k: string]: unknown;
  };
}

export interface AxesObject extends SceneObject {
  type: 'axes';
  xRange?: number[];
  yRange?: number[];
  graphs?: GraphEntry[];
}

export interface PolygonObject extends SceneObject {
  type: 'polygon';
  sides?: number;
}

export interface NumberLineObject extends SceneObject {
  type: 'numberline';
  xRange?: number[];
}

export interface MatrixObject extends SceneObject {
  type: 'matrix';
  matrixData?: string[][];
  bracket?: '[' | '(' | '|';
}

export interface LatexObject extends SceneObject {
  type: 'latex';
  latex?: string;
}

export interface DiGraphEdge extends Array<string> {
  0: string;
  1: string;
}

export interface GraphObject extends SceneObject {
  type: 'graph';
  vertices?: string[];
  edges?: [string, string][];
  positions?: Record<string, [number, number]>;
  directed?: boolean;
  showLabels?: boolean;
}

export interface VectorComponentsObject extends SceneObject {
  type: 'vector_components';
  vx?: number;
  vy?: number;
}

export interface TextObject extends SceneObject {
  type: 'text';
  content?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: string;
  // fontSize and fontFamily are already on SceneObject
}

// ─── End per-type interfaces ────────────────────────────────────────────────

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
