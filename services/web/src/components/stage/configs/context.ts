// StageCtx — the single bridge between the reactive SFC and the pure config builders.
// Every field is a *resolved value* (not a ref). The orchestrator rebuilds this object
// reactively (inside a computed) so builders always see current values.

import type { SceneObject } from '@manim/codegen';
import type { FrameState, Cam3D } from '../../../engine/types.js';

/** The stage (project.stage) shape — width/height plus misc design properties. */
export interface StageShape {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  gridSize?: number;
  gridColor?: string;
  gridOpacity?: number;
  [k: string]: unknown;
}

/** The live-transform shape returned by `live(obj)` (from useStageInteractions). */
export interface LiveTransform {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

/** Minimal 3D-position shape returned by `eff3d(obj)`. */
export interface Eff3dResult {
  x3d: number;
  y3d: number;
  z3d: number;
}

/** 2D screen coordinate pair returned by `iso(...)` and `project3D`. */
export interface IsoPoint {
  px: number;
  py: number;
}

/**
 * StageCtx — the resolved-value context object passed from StageCanvas.vue
 * to every pure config builder.  All fields are live (non-ref) values so
 * builders stay pure and testable without mounting the component.
 */
export interface StageCtx {
  /** The project stage descriptor (width, height, colours, grid…). */
  stg: StageShape;
  /** Zoom/viewport scale — canvas px per project px. */
  vs: number;
  /** Viewport x-offset in canvas coords. */
  ox: number;
  /** Viewport y-offset in canvas coords. */
  oy: number;
  /** Convert project coords → canvas coords. */
  s2c: (px: number, py: number) => { x: number; y: number };
  /** Convert canvas coords → project coords. */
  c2s: (cx: number, cy: number) => { x: number; y: number };
  /** Apply per-frame overrides to a 2D object; returns merged object. */
  eff: (obj: SceneObject) => SceneObject;
  /** Return current 3D position (x3d/y3d/z3d) with overrides applied. */
  eff3d: (obj: SceneObject) => Eff3dResult;
  /**
   * Return the live Konva-transform state while the user is dragging/resizing,
   * or null when the object is at rest.
   */
  live: (obj: SceneObject) => LiveTransform | null;
  /** Apply gradient/dash/shadow/cornerRadius effects to a Konva config. */
  applyEffects: (
    cfg: Record<string, unknown>,
    obj: SceneObject,
    w: number,
    h: number,
    centered: boolean
  ) => Record<string, unknown>;
  /** Convert a CSS hex colour to rgba(…) with the given alpha. */
  hexToRgba: (hex: string, a?: number) => string;
  /** Primary accent colour from the app theme (hex string). */
  themeAccent: string;
  /** Surface colour from the app theme (hex string). */
  themeSurface: string;
  /** Loaded <img> elements keyed by assetId (for image objects). */
  imageElements: Record<string, HTMLImageElement> | Map<string, HTMLImageElement>;
  /** Per-frame playback state: overrides, morph shapes, hidden IDs. */
  frameState: FrameState;
  /** Whether the scene is in 3D mode. */
  is3D: boolean;
  /** Active 3D camera parameters (phi/theta/zoom/mode…). */
  cam3d: Cam3D & Record<string, unknown>;
  /** Pixels-per-Manim-unit scale for the 3D isometric projection. */
  proj3DScale: number;
  /** Horizontal centre of the 3D projection area in canvas coords. */
  projCx: number;
  /** Vertical centre of the 3D projection area in canvas coords. */
  projCy: number;
  /**
   * Isometric 3D→2D projection.
   * Returns canvas coords `{px, py}` for a 3D point.
   */
  iso: (
    x3d: number,
    y3d: number,
    z3d: number,
    cx?: number,
    cy?: number,
    scale?: number
  ) => IsoPoint;
  /** Measure the rendered pixel width of a text string. */
  measureTextWidth: (
    text: string,
    fontSize: number,
    fontFamily: string,
    fontStyle: string
  ) => number;
  /** Currently active interaction tool ("select", "pen", …). */
  activeTool: string;
  /** IDs of all currently-selected objects. */
  selectedObjectIds: string[];
  /**
   * Return the canvas-coordinate bounding box for a scene object by ID,
   * or null if the object is not found / not visible.
   */
  objectBounds: (id: string) => { x: number; y: number; width: number; height: number } | null;
}

export const CTX_KEYS = [
  'stg',
  'vs',
  'ox',
  'oy',
  's2c',
  'c2s',
  'eff',
  'eff3d',
  'live',
  'applyEffects',
  'hexToRgba',
  'themeAccent',
  'themeSurface',
  'imageElements',
  'frameState',
  'is3D',
  'cam3d',
  'proj3DScale',
  'projCx',
  'projCy',
  'iso',
  'measureTextWidth',
  'activeTool',
  'selectedObjectIds',
  'objectBounds',
] as const;
