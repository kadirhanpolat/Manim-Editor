/**
 * Playback Engine
 *
 * Drives 60fps preview playback using requestAnimationFrame.
 * Evaluates all active clips at current time, computes morph states,
 * and produces a frame state that the canvas renders.
 */

import { evaluateEasing } from './easing.js';
import { generateShapePoints, pointsToFlat } from './geometry.js';
import { resamplePoints, computeMorphState, lerp, interpolateColor } from './transform.js';
import { blendClipResults, isClipActive, getClipProgress, isClipCompleted } from './blending.js';
import { interpolateKeyframes, getKeyframeRange } from './keyframe.js';
import type {
  Point,
  Point3D,
  StageObject,
  Track,
  Clip,
  CameraClip,
  ClipResult,
  EvaluatedClip,
  FrameState,
  Overrides,
} from './types.js';

// path_move için yay-uzunluğuna göre interpolasyon. 3D nokta (x3d alanı) ya da
// 2D nokta ({x,y}) kabul eder; aynı şekildeki noktayı döndürür.
export function interpolatePath(
  path: Array<Point | Point3D> | null | undefined,
  t: number
): Point | Point3D {
  if (!path || path.length === 0) return { x: 0, y: 0 };
  const is3d = !!(path[0] && 'x3d' in path[0]);
  const clampedT = Math.max(0, Math.min(1, t));
  const segLens = [];
  let totalLen = 0;
  for (let k = 1; k < path.length; k++) {
    let len;
    if (is3d) {
      // Cast to Point3D[] for .x3d/.y3d/.z3d access — TS cannot narrow array elements from `is3d`
      const p3 = path as Point3D[];
      const dx = p3[k].x3d - p3[k - 1].x3d;
      const dy = p3[k].y3d - p3[k - 1].y3d;
      const dz = p3[k].z3d - p3[k - 1].z3d;
      len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    } else {
      // Cast to Point[] for .x/.y access
      const p2 = path as Point[];
      const dx = p2[k].x - p2[k - 1].x;
      const dy = p2[k].y - p2[k - 1].y;
      len = Math.sqrt(dx * dx + dy * dy);
    }
    segLens.push(len);
    totalLen += len;
  }
  const at = (i: number): Point | Point3D => {
    if (is3d) {
      const p3 = path as Point3D[];
      return { x3d: p3[i].x3d, y3d: p3[i].y3d, z3d: p3[i].z3d };
    } else {
      const p2 = path as Point[];
      return { x: p2[i].x, y: p2[i].y };
    }
  };
  if (totalLen === 0) return at(0);
  const target = clampedT * totalLen;
  let cumLen = 0;
  for (let k = 0; k < segLens.length; k++) {
    if (cumLen + segLens[k] >= target) {
      const t2 = segLens[k] === 0 ? 0 : (target - cumLen) / segLens[k];
      if (is3d) {
        const p3 = path as Point3D[];
        return {
          x3d: lerp(p3[k].x3d, p3[k + 1].x3d, t2),
          y3d: lerp(p3[k].y3d, p3[k + 1].y3d, t2),
          z3d: lerp(p3[k].z3d, p3[k + 1].z3d, t2),
        };
      }
      const p2 = path as Point[];
      return { x: lerp(p2[k].x, p2[k + 1].x, t2), y: lerp(p2[k].y, p2[k + 1].y, t2) };
    }
    cumLen += segLens[k];
  }
  return at(path.length - 1);
}

export class PlaybackEngine {
  playing: boolean;
  currentTime: number;
  loop: boolean;
  duration: number;
  private _frameId: number | null;
  private _lastTimestamp: number | null;
  private _onFrame: ((frame: FrameState) => void) | null;
  private _onTimeUpdate: ((time: number) => void) | null;
  private _pointsCache: Map<string, Point[]>;
  private _keyframeDefaults: { mode: string };
  private _camera3dBase?: { phi: number; theta: number; zoom: number };
  private _tracks?: Track[];
  private _objects?: StageObject[];
  private _cameraTrack?: CameraClip[];
  private _objectMap?: Map<string, StageObject>;

  constructor() {
    this.playing = false;
    this.currentTime = 0;
    this.loop = true;
    this.duration = 10;
    this._frameId = null;
    this._lastTimestamp = null;
    this._onFrame = null;
    this._onTimeUpdate = null;

    // Cache for resampled points (cleared when project changes)
    this._pointsCache = new Map();

    // Keyframe defaults (mode: 'opt-in' or 'additive')
    this._keyframeDefaults = { mode: 'opt-in' };
  }

  /**
   * Set callback for frame updates.
   */
  onFrame(callback: (frame: FrameState) => void): void {
    this._onFrame = callback;
  }

  /**
   * Set callback for time updates (for UI sync).
   */
  onTimeUpdate(callback: (time: number) => void): void {
    this._onTimeUpdate = callback;
  }

  /**
   * Clear the points cache (call when objects change).
   */
  clearCache(): void {
    this._pointsCache.clear();
  }

  /**
   * Set keyframe defaults (mode: 'opt-in' | 'additive').
   */
  setKeyframeDefaults(defaults: { mode: string } | null | undefined): void {
    this._keyframeDefaults = defaults || { mode: 'opt-in' };
  }

  /**
   * Set the baseline 3D camera state used as the "from" for the first camera_move clip.
   */
  setCamera3dBase(base: { phi: number; theta: number; zoom: number } | null | undefined): void {
    this._camera3dBase = base || { phi: 75, theta: -45, zoom: 1 };
  }

  /**
   * Start playback.
   */
  play(tracks: Track[], objects: StageObject[], duration: number, cameraTrack?: CameraClip[]): void {
    if (this.playing) return;
    this.playing = true;
    this.duration = duration || this.duration;
    this._lastTimestamp = null;
    this._tracks = tracks;
    this._objects = objects;
    this._cameraTrack = cameraTrack || [];
    this._objectMap = new Map(objects.map((o): [string, StageObject] => [o.id, o]));
    this._tick = this._tick.bind(this);
    this._frameId = requestAnimationFrame(this._tick);
  }

  /**
   * Pause playback.
   */
  pause(): void {
    this.playing = false;
    if (this._frameId) {
      cancelAnimationFrame(this._frameId);
      this._frameId = null;
    }
    this._lastTimestamp = null;
  }

  /**
   * Stop and reset to start.
   */
  stop(): void {
    this.pause();
    this.currentTime = 0;
    if (this._onTimeUpdate) this._onTimeUpdate(0);
    // Emit a final frame at time 0
    if (this._onFrame) {
      this._onFrame({ objectOverrides: {}, morphShapes: [], hiddenIds: new Set() });
    }
  }

  /**
   * Seek to a specific time.
   */
  seekTo(time: number, tracks?: Track[], objects?: StageObject[], cameraTrack?: CameraClip[]): void {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
    if (tracks) this._tracks = tracks;
    if (objects) {
      this._objects = objects;
      this._objectMap = new Map(objects.map((o): [string, StageObject] => [o.id, o]));
    }
    if (cameraTrack !== undefined) this._cameraTrack = cameraTrack;
    if (this._onTimeUpdate) this._onTimeUpdate(this.currentTime);

    // Compute and emit frame at this time
    if (this._tracks && this._objects) {
      const frame = this.computeFrame(
        this.currentTime,
        this._tracks,
        this._objects,
        this._cameraTrack
      );
      if (this._onFrame) this._onFrame(frame);
    }
  }

  /**
   * Internal tick: advance time and compute frame.
   */
  private _tick(timestamp: number): void {
    if (!this.playing) return;

    if (this._lastTimestamp === null) {
      this._lastTimestamp = timestamp;
    }

    const deltaMs = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;

    // Advance time (cap delta to avoid huge jumps after tab switch)
    const deltaSec = Math.min(deltaMs / 1000, 0.05);
    this.currentTime += deltaSec;

    // Loop or stop
    if (this.currentTime >= this.duration) {
      if (this.loop) {
        this.currentTime = this.currentTime % this.duration;
      } else {
        this.currentTime = this.duration;
        this.pause();
        if (this._onTimeUpdate) this._onTimeUpdate(this.currentTime);
        return;
      }
    }

    if (this._onTimeUpdate) this._onTimeUpdate(this.currentTime);

    // Compute frame
    const frame = this.computeFrame(
      this.currentTime,
      this._tracks!,
      this._objects!,
      this._cameraTrack
    );
    if (this._onFrame) this._onFrame(frame);

    // Schedule next frame
    if (this.playing) {
      this._frameId = requestAnimationFrame(this._tick);
    }
  }

  /**
   * Compute the full frame state at a given time.
   *
   * @param {number} time - Current time in seconds
   * @param {Array} tracks - Track array with clips
   * @param {Array} objects - Object array
   * @param {Array} [cameraTrack] - Optional camera clip array
   * @returns {FrameState}
   */
  computeFrame(time: number, tracks: Track[], objects: StageObject[], cameraTrack?: CameraClip[]): FrameState {
    if (!tracks || !objects) {
      return { objectOverrides: {}, morphShapes: [], hiddenIds: new Set(), cameraState: null };
    }

    const objectMap = this._objectMap || new Map(objects.map((o): [string, StageObject] => [o.id, o]));
    const evaluatedClips: EvaluatedClip[] = [];

    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
      const track = tracks[trackIdx];
      if (!track.clips) continue;

      for (const clip of track.clips) {
        const result = this._evaluateClip(clip, time, objectMap);
        if (result) {
          evaluatedClips.push({ trackIndex: trackIdx, clipResult: result });
        }
      }
    }

    // blendClipResults returns the 3 required FrameState fields; cameraState is set below
    const frame: FrameState = blendClipResults(evaluatedClips, objectMap);

    // Apply keyframe overrides (per-property interpolation)
    this._applyKeyframeOverrides(frame, time, objects);

    // Apply entrance/exit animations on top
    this._applyEnterExitAnims(frame, time, objects);

    // Camera clips — sort by startTime and interpolate FROM previous clip's target state
    frame.cameraState = null;
    if (cameraTrack && cameraTrack.length > 0) {
      const base = this._camera3dBase || { phi: 75, theta: -45, zoom: 1 };
      const sortedCam = [...cameraTrack].sort((a, b) => a.startTime - b.startTime);
      for (let ci = 0; ci < sortedCam.length; ci++) {
        const camClip = sortedCam[ci];
        // CameraClip satisfies TimedClip, which is all the scheduling helpers need.
        if (!isClipActive(camClip, time)) continue;
        const progress = getClipProgress(camClip, time);
        const easedT = evaluateEasing(progress, camClip.easing || 'ease_in_out', 0, 1);
        // Interpolate FROM the previous clip's target (or default origin for first clip)
        const prev = ci > 0 ? sortedCam[ci - 1].params : null;
        const is3d = camClip.params && 'phi' in camClip.params;
        if (is3d) {
          const fromPhi = prev?.phi ?? base.phi;
          const fromTheta = prev?.theta ?? base.theta;
          const fromZoom = prev?.zoom ?? base.zoom;
          frame.cameraState = {
            phi: lerp(fromPhi, camClip.params!.phi ?? base.phi, easedT),
            theta: lerp(fromTheta, camClip.params!.theta ?? base.theta, easedT),
            zoom: lerp(fromZoom, camClip.params!.zoom ?? base.zoom, easedT),
            is3d: true,
          };
        } else {
          const fromX = prev?.targetX || 0;
          const fromY = prev?.targetY || 0;
          const fromZoom = prev?.zoom || 1;
          frame.cameraState = {
            x: lerp(fromX, camClip.params?.targetX || 0, easedT),
            y: lerp(fromY, camClip.params?.targetY || 0, easedT),
            zoom: lerp(fromZoom, camClip.params?.zoom || 1, easedT),
          };
        }
        break; // Use first active camera clip
      }
    }

    return frame;
  }

  /**
   * Apply keyframe overrides to objects.
   * Per-property keyframes that interpolate values over time.
   * Respects mode (opt-in vs additive) and keyframeDefaults.
   */
  private _applyKeyframeOverrides(frame: FrameState, time: number, objects: StageObject[]): void {
    if (!frame.objectOverrides) frame.objectOverrides = {};

    for (const obj of objects) {
      if (!obj.keyframes) continue;

      for (const [prop, keyframes] of Object.entries(obj.keyframes)) {
        if (!keyframes || keyframes.length === 0) continue;

        const mode =
          (obj.keyframeMode && obj.keyframeMode[prop]) || this._keyframeDefaults.mode || 'opt-in';

        if (mode === 'opt-in') {
          const range = getKeyframeRange(keyframes);
          if (!range || time < range.start || time > range.end) continue;
        }

        const kfValue = interpolateKeyframes(keyframes, time);
        if (kfValue === null) continue;

        const overrides = frame.objectOverrides[obj.id] || {};
        if (mode === 'additive') {
          const base = overrides[prop] !== undefined ? overrides[prop] : obj[prop] || 0;
          overrides[prop] = (base as number) + kfValue;
        } else {
          overrides[prop] = kfValue;
        }
        frame.objectOverrides[obj.id] = overrides;
      }
    }
  }

  /**
   * Apply entrance/exit animations to objects.
   * These are per-object properties (enterAnim, exitAnim) that animate
   * how objects appear and disappear, independent of timeline clips.
   */
  private _applyEnterExitAnims(frame: FrameState, time: number, objects: StageObject[]): void {
    for (const obj of objects) {
      const enterTime = obj.enterTime || 0;
      const duration = obj.duration || 999;
      const exitTime = enterTime + duration;
      const enterDur = obj.enterAnimDur || 0.5;
      const exitDur = obj.exitAnimDur || 0.5;
      const enterAnim = obj.enterAnim || 'none';
      const exitAnim = obj.exitAnim || 'none';

      // Object not yet visible or already gone
      if (time < enterTime || time >= exitTime) continue;

      // Skip if hidden by a transform clip
      if (frame.hiddenIds.has(obj.id)) continue;

      let overrides = frame.objectOverrides[obj.id] || {};
      let changed = false;

      // ── Entrance animation ──
      if (enterAnim !== 'none' && time < enterTime + enterDur) {
        const rawT = (time - enterTime) / enterDur;
        const t = Math.max(0, Math.min(1, rawT));
        // Use ease_out_cubic for smooth entrance
        const eased = 1 - Math.pow(1 - t, 3);

        switch (enterAnim) {
          case 'fade_in':
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'grow_in':
            overrides.scaleX = eased;
            overrides.scaleY = eased;
            overrides.opacity = Math.min(1, eased * 2) * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_in_left':
            overrides.x = obj.x - (1 - eased) * 600;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_in_right':
            overrides.x = obj.x + (1 - eased) * 600;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_in_top':
            overrides.y = obj.y - (1 - eased) * 400;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_in_bottom':
            overrides.y = obj.y + (1 - eased) * 400;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'draw':
          case 'write':
            // Simulated with opacity + scale for preview; real effect in Manim
            overrides.opacity = eased * (obj.opacity ?? 1);
            overrides.scaleX = 0.8 + 0.2 * eased;
            overrides.scaleY = 0.8 + 0.2 * eased;
            changed = true;
            break;
          case 'typewriter':
            overrides._typewriter = eased; // 0..1 reveal fraction
            changed = true;
            break;
          case 'spin_in':
            overrides.rotation = (obj.rotation || 0) - (1 - eased) * 360;
            overrides.opacity = eased * (obj.opacity ?? 1);
            overrides.scaleX = eased;
            overrides.scaleY = eased;
            changed = true;
            break;
          case 'bounce_in': {
            // Bounce easing
            let bt;
            if (t < 0.5) {
              bt = 2 * t * t;
            } else {
              const n = 7.5625;
              const d = 2.75;
              let p = t;
              if (p < 1 / d) bt = n * p * p;
              else if (p < 2 / d) bt = n * (p -= 1.5 / d) * p + 0.75;
              else if (p < 2.5 / d) bt = n * (p -= 2.25 / d) * p + 0.9375;
              else bt = n * (p -= 2.625 / d) * p + 0.984375;
            }
            overrides.scaleX = bt;
            overrides.scaleY = bt;
            overrides.opacity = Math.min(1, t * 3) * (obj.opacity ?? 1);
            changed = true;
            break;
          }
        }
      }

      // ── Exit animation ──
      if (exitAnim !== 'none' && time > exitTime - exitDur) {
        const rawT = (exitTime - time) / exitDur;
        const t = Math.max(0, Math.min(1, rawT));
        const eased = 1 - Math.pow(1 - t, 3);

        switch (exitAnim) {
          case 'fade_out':
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'shrink_out':
            overrides.scaleX = eased * (overrides.scaleX ?? 1);
            overrides.scaleY = eased * (overrides.scaleY ?? 1);
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_out_left':
            overrides.x = (overrides.x ?? obj.x) - (1 - eased) * 600;
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_out_right':
            overrides.x = (overrides.x ?? obj.x) + (1 - eased) * 600;
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_out_top':
            overrides.y = (overrides.y ?? obj.y) - (1 - eased) * 400;
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_out_bottom':
            overrides.y = (overrides.y ?? obj.y) + (1 - eased) * 400;
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'uncreate':
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            overrides.scaleX = 0.8 + 0.2 * eased;
            overrides.scaleY = 0.8 + 0.2 * eased;
            changed = true;
            break;
          case 'typewriter_out':
            overrides._typewriter = eased; // 0..1 remaining fraction
            changed = true;
            break;
          case 'spin_out':
            overrides.rotation = (overrides.rotation ?? obj.rotation ?? 0) + (1 - eased) * 360;
            overrides.opacity = eased * (overrides.opacity ?? obj.opacity ?? 1);
            overrides.scaleX = eased * (overrides.scaleX ?? 1);
            overrides.scaleY = eased * (overrides.scaleY ?? 1);
            changed = true;
            break;
        }
      }

      if (changed) {
        frame.objectOverrides[obj.id] = overrides;
      }
    }
  }

  /**
   * Evaluate a single clip at the given time.
   */
  private _evaluateClip(clip: Clip, time: number, objectMap: Map<string, StageObject>): ClipResult | null {
    const active = isClipActive(clip, time);
    const completed = isClipCompleted(clip, time);

    if (clip.type === 'transform') {
      return this._evaluateTransformClip(clip, time, active, completed, objectMap);
    }

    if (clip.type === 'count') {
      if (!active && !completed) return null;
      const objId = clip.objectId || clip.sourceId;
      if (!objId) return null;
      const p = completed ? 1 : Math.max(0, Math.min(1, getClipProgress(clip, time)));
      const easedT = evaluateEasing(p, clip.easing || 'ease_in_out', 0, 1.0);
      // Number.isFinite does not narrow `number | undefined`; use explicit cast
      const from = Number.isFinite(clip.from) ? (clip.from as number) : 0;
      const to = Number.isFinite(clip.to) ? (clip.to as number) : 0;
      return {
        objectId: objId,
        overrides: { value: from + (to - from) * easedT },
        clipId: clip.id,
      };
    }

    if (!active) return null;
    const progress = getClipProgress(clip, time);
    const easedT = evaluateEasing(
      progress,
      clip.easing || 'ease_in_out',
      clip.overshoot || 0,
      clip.settle || 1.0
    );

    const sourceObj = objectMap.get(clip.sourceId!);
    if (!sourceObj) return null;

    const overrides: Overrides = {};

    switch (clip.type) {
      case 'move': {
        const params = clip.params || {};
        overrides.x = lerp(
          sourceObj.x,
          params.targetX !== undefined ? params.targetX : sourceObj.x,
          easedT
        );
        overrides.y = lerp(
          sourceObj.y,
          params.targetY !== undefined ? params.targetY : sourceObj.y,
          easedT
        );
        break;
      }
      case 'scale': {
        const params = clip.params || {};
        const targetSX = params.targetScaleX !== undefined ? params.targetScaleX : 1;
        const targetSY = params.targetScaleY !== undefined ? params.targetScaleY : 1;
        overrides.scaleX = lerp(1, targetSX, easedT);
        overrides.scaleY = lerp(1, targetSY, easedT);
        break;
      }
      case 'fade': {
        const params = clip.params || {};
        const startOpacity = sourceObj.opacity !== undefined ? sourceObj.opacity : 1;
        const targetOpacity = params.targetOpacity !== undefined ? params.targetOpacity : 0;
        overrides.opacity = lerp(startOpacity, targetOpacity, easedT);
        break;
      }
      case 'rotate': {
        const params = clip.params || {};
        const startRot = sourceObj.rotation || 0;
        const targetRot = params.targetRotation !== undefined ? params.targetRotation : 360;
        overrides.rotation = lerp(startRot, targetRot, easedT);
        break;
      }
      case 'path_move': {
        if (!clip.path || clip.path.length < 2) break;
        const pos = interpolatePath(clip.path, easedT);
        Object.assign(overrides, pos); // 2D: {x,y} · 3D: {x3d,y3d,z3d}
        break;
      }
      case 'indicate': {
        const params = clip.params || {};
        const pulse = 1 - Math.abs(2 * progress - 1);
        const sf = params.scale_factor !== undefined ? params.scale_factor : 1.2;
        overrides.scaleX = lerp(1, sf, pulse);
        overrides.scaleY = lerp(1, sf, pulse);
        overrides.fill = interpolateColor(
          sourceObj.fill || '#ffffff',
          params.color || '#FFFF00',
          pulse
        );
        break;
      }
      case 'wiggle': {
        const params = clip.params || {};
        const nW = params.n_wiggles !== undefined ? params.n_wiggles : 6;
        const ang = params.rotation_angle !== undefined ? params.rotation_angle : 3.6;
        const sv = params.scale_value !== undefined ? params.scale_value : 1.1;
        const osc = Math.sin(2 * Math.PI * nW * progress);
        overrides.rotation = (sourceObj.rotation || 0) + osc * ang;
        overrides.scaleX = 1 + osc * (sv - 1);
        overrides.scaleY = 1 + osc * (sv - 1);
        break;
      }
      case 'flash': {
        const params = clip.params || {};
        const pulse = Math.sin(Math.PI * progress);
        overrides.fill = interpolateColor(
          sourceObj.fill || '#ffffff',
          params.color || '#FFFF00',
          pulse
        );
        break;
      }
      case 'focus_on': {
        const params = clip.params || {};
        const pulse = Math.sin(Math.PI * progress);
        overrides.fill = interpolateColor(
          sourceObj.fill || '#ffffff',
          params.color || '#FFFF00',
          pulse * 0.6
        );
        break;
      }
      case 'circumscribe': {
        const params = clip.params || {};
        overrides._emphasis = {
          kind: 'circumscribe',
          shape: params.shape === 'Circle' ? 'Circle' : 'Rectangle',
          color: params.color || '#FFFF00',
          fadeOut: !!params.fade_out,
          progress,
        };
        break;
      }
    }

    return {
      objectId: clip.sourceId,
      overrides,
      clipId: clip.id,
    };
  }

  /**
   * Evaluate a transform (morph) clip.
   */
  private _evaluateTransformClip(clip: Clip, time: number, active: boolean, completed: boolean, objectMap: Map<string, StageObject>): ClipResult | null {
    const sourceObj = objectMap.get(clip.sourceId!);
    const targetObj = objectMap.get(clip.targetId!);
    if (!sourceObj || !targetObj) return null;

    // After completion: source hidden, target visible
    if (completed) {
      return {
        clipId: clip.id,
        hideIds: [clip.sourceId!],
        objectId: clip.sourceId,
        overrides: {},
      };
    }

    // Before start: no effect
    if (!active) return null;

    // During: compute morph
    const progress = getClipProgress(clip, time);
    const easedT = evaluateEasing(
      progress,
      clip.easing || 'ease_in_out',
      clip.overshoot || 0,
      clip.settle || 1.0
    );

    // Get or compute resampled points
    const quality = clip.morphQuality || 'medium';
    const sourcePoints = this._getResampledPoints(sourceObj, quality);
    const targetPoints = this._getResampledPoints(targetObj, quality);

    const morphState = computeMorphState(sourceObj, targetObj, sourcePoints, targetPoints, easedT);

    return {
      clipId: clip.id,
      morphState: {
        ...morphState,
        flatPoints: pointsToFlat(morphState.points),
      },
      hideIds: [clip.sourceId!, clip.targetId!],
      objectId: clip.sourceId,
      overrides: {},
    };
  }

  /**
   * Get resampled points for an object (cached).
   */
  private _getResampledPoints(obj: StageObject, quality: string): Point[] {
    const cacheKey = `${obj.id}_${obj.type}_${obj.width}_${obj.height}_${quality}`;
    if (this._pointsCache.has(cacheKey)) {
      return this._pointsCache.get(cacheKey)!;
    }

    const QUALITY_COUNTS: Record<string, number> = { low: 32, medium: 64, high: 128 };
    const count = QUALITY_COUNTS[quality] || 64;
    const raw = generateShapePoints(obj.type, obj.width, obj.height, quality);
    const resampled = resamplePoints(raw, count);
    this._pointsCache.set(cacheKey, resampled);
    return resampled;
  }

  /**
   * Destroy the engine, clean up.
   */
  destroy(): void {
    this.pause();
    this._onFrame = null;
    this._onTimeUpdate = null;
    this._pointsCache.clear();
  }
}

// Singleton instance
let _instance: PlaybackEngine | null = null;

export function getPlaybackEngine(): PlaybackEngine {
  if (!_instance) {
    _instance = new PlaybackEngine();
  }
  return _instance;
}

export default { PlaybackEngine, getPlaybackEngine };
