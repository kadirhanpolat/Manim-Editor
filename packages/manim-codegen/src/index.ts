import { FRAME_WIDTH, ANNOTATION_TYPES } from './constants.js';
import { rfOpt, rtOpt, vn, hex, stageToManim, pathPointsPy, isSystemFont } from './helpers.js';
import { objectCode } from './objects.js';
import { objectCode3d } from './objects3d.js';
import { transformExpr, emphasisExpr } from './clips.js';
import { generateKeyframeSteps } from './keyframes.js';
import type { Project, GenerateOptions, GeneratedStep, SceneObject, Clip } from './types.js';

export function generateScene(project: Project, { resolveAsset }: GenerateOptions): string {
  const L: string[] = [],
    sw = project.stage.width,
    sh = project.stage.height;

  // ── Hidden filter (editor UX) ────────────────────────────────────────────
  // Objects with hidden === true are skipped entirely. Cascade: an annotation
  // (surrounding_rect / underline / cross) whose target is hidden would emit a
  // reference to an undefined Python name — skip it too. Clips referencing a
  // hidden object are dropped for the same reason. When no object carries the
  // field, every derived collection equals its legacy counterpart and the
  // output stays byte-identical.
  const allObjects = project.objects || [];
  const hiddenIds = new Set<string>(allObjects.filter((o) => o.hidden === true).map((o) => o.id));
  for (const o of allObjects) {
    if (
      ANNOTATION_TYPES.has(o.type) &&
      typeof o.targetId === 'string' &&
      hiddenIds.has(o.targetId)
    ) {
      hiddenIds.add(o.id);
    }
  }
  const visibleObjects = allObjects.filter((o) => !hiddenIds.has(o.id));
  const clipRefsHidden = (c: Clip): boolean => {
    const refs = [c.sourceId, c.targetId, (c as Clip & { objectId?: string }).objectId];
    return refs.some((id) => typeof id === 'string' && hiddenIds.has(id));
  };

  // Collect unique Google Fonts used by text objects
  const usedFonts = new Set<string>();
  for (const obj of visibleObjects) {
    if (obj.type === 'text' && obj.fontFamily) {
      const font = obj.fontFamily as string;
      if (font && !isSystemFont(font)) {
        usedFonts.add(font);
      }
    }
  }
  const fontsArray = Array.from(usedFonts);

  // Header
  L.push('"""');
  L.push(`Manim Studio – ${project.name}`);
  L.push('Run:  manim -qh scene.py MainScene');
  L.push('"""');
  L.push('');
  L.push('from manim import *');
  L.push('import numpy as np');
  if (fontsArray.length > 0) {
    L.push('from manim_fonts import RegisterFont');
  }

  const allClips = (project.tracks || []).flatMap((t) => t.clips || []);
  const hasReadyAudio = allClips.some((c) => c.audio && c.audio.status === 'ready' && c.audio.src);

  if (hasReadyAudio) {
    L.push('from manim_voiceover import VoiceoverScene');
    L.push('from manim_voiceover.services.gtts import GTTSService');
  }

  const is3D = project.sceneType === '3d';
  if (is3D) {
    L.push(
      'from manim.mobject.three_d.three_dimensions import Sphere, Cube, Cone, Cylinder, Torus'
    );
    L.push('from manim import ThreeDAxes, ThreeDScene');
  }

  L.push('');
  L.push('');

  let sceneBase: string;
  if (is3D) {
    sceneBase = hasReadyAudio ? 'ThreeDScene, VoiceoverScene' : 'ThreeDScene';
  } else if (project.cameraType === 'moving') {
    sceneBase = 'MovingCameraScene';
  } else if (hasReadyAudio) {
    sceneBase = 'VoiceoverScene';
  } else {
    sceneBase = 'Scene';
  }

  L.push(`class MainScene(${sceneBase}):`);
  L.push('    def construct(self):');
  const bgColor = hex(project.stage.backgroundColor) || '"#000000"';
  L.push(`        self.camera.background_color = ${bgColor}`);
  if (hasReadyAudio) {
    L.push('        self.set_speech_service(GTTSService())');
  }
  if (is3D) {
    const cam = project.camera3d ?? { phi: 75, theta: -45, zoom: 1.0 };
    L.push(`        self.set_camera_orientation(`);
    L.push(`            phi=${cam.phi} * DEGREES,`);
    L.push(`            theta=${cam.theta} * DEGREES,`);
    L.push(`            zoom=${(cam.zoom ?? 1.0).toFixed(2)}`);
    L.push(`        )`);
  }
  L.push('');

  if (
    visibleObjects.length === 0 &&
    !(Array.isArray(project.cameraTrack) && project.cameraTrack.length > 0)
  ) {
    L.push('        self.wait(1)');
    return L.join('\n');
  }

  // Generate font registration and scene content
  let indent = '        ';
  if (fontsArray.length > 0) {
    L.push(`${indent}# Register Google Fonts`);
    for (let i = 0; i < fontsArray.length; i++) {
      const font = fontsArray[i];
      const varName = `fonts_${i}`;
      L.push(`${indent}with RegisterFont("${font}") as ${varName}:`);
      indent += '    ';
    }
    L.push('');
  }

  // ── Object definitions ──
  const obj3DTypes = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d', 'surface', 'prism'];
  const oMap: Record<string, SceneObject> = {};
  // Annotations must emit after their targets; sort non-annotations first
  const sortedObjects = [
    ...visibleObjects.filter((o) => !ANNOTATION_TYPES.has(o.type)),
    ...visibleObjects.filter((o) => ANNOTATION_TYPES.has(o.type)),
  ];
  L.push(`${indent}# Objects`);
  for (const o of sortedObjects) {
    oMap[o.id] = o;
    if (obj3DTypes.includes(o.type)) {
      objectCode3d(o).forEach((l) => L.push(indent + l));
    } else {
      objectCode(o, sw, sh, { resolveAsset }).forEach((l) => L.push(indent + l));
    }
    L.push('');
  }

  // ── Groups ──
  const groups = project.groups || [];
  if (groups.length > 0) {
    L.push(`${indent}# Groups`);
    for (const g of groups) {
      if (!g.childIds || g.childIds.length === 0) continue;
      const visibleChildIds = g.childIds.filter((id) => !hiddenIds.has(id));
      if (visibleChildIds.length === 0) continue;
      const childVars = visibleChildIds
        .map((id) => vn(id))
        .filter(Boolean)
        .join(', ');
      const gn = vn(g.id);
      L.push(`${indent}${gn} = VGroup(${childVars})`);
    }
    L.push('');
  }

  // ── Collect clips ──
  const clips: Clip[] = [];
  for (const t of project.tracks) for (const c of t.clips) if (!clipRefsHidden(c)) clips.push(c);
  clips.sort((a, b) => a.startTime - b.startTime);

  // ── Determine transform relationships ──
  const transformSources = new Set<string | undefined>();
  const transformTargets = new Set<string | undefined>();
  for (const c of clips) {
    if (c.type === 'transform') {
      transformSources.add(c.sourceId);
      if (c.targetId) transformTargets.add(c.targetId);
    }
  }

  // ── Build animation steps ──
  const steps: GeneratedStep[] = [];

  // Enter: skip objects that are transform targets
  for (const o of visibleObjects) {
    if (transformTargets.has(o.id)) continue;
    const t = o.enterTime || 0;
    const n = vn(o.id);
    const dur = o.enterAnimDur || 0.5;
    const rt = rtOpt(dur);
    const enterAnim = o.enterAnim || 'fade_in';

    let enterCode: string;
    switch (enterAnim) {
      case 'none':
        enterCode = `self.add(${n})`;
        break;
      case 'fade_in':
        enterCode = `self.play(FadeIn(${n})${rt})`;
        break;
      case 'grow_in':
        enterCode = `self.play(GrowFromCenter(${n})${rt})`;
        break;
      case 'fly_in_left':
        enterCode = `self.play(FadeIn(${n}, shift=RIGHT)${rt})`;
        break;
      case 'fly_in_right':
        enterCode = `self.play(FadeIn(${n}, shift=LEFT)${rt})`;
        break;
      case 'fly_in_top':
        enterCode = `self.play(FadeIn(${n}, shift=DOWN)${rt})`;
        break;
      case 'fly_in_bottom':
        enterCode = `self.play(FadeIn(${n}, shift=UP)${rt})`;
        break;
      case 'draw':
        enterCode = `self.play(Create(${n})${rt})`;
        break;
      case 'write':
        enterCode = `self.play(Write(${n})${rt})`;
        break;
      case 'spin_in':
        enterCode = `self.play(SpinInFromNothing(${n})${rt})`;
        break;
      case 'bounce_in':
        enterCode = `self.play(GrowFromCenter(${n}, rate_func=rate_functions.ease_out_bounce)${rt})`;
        break;
      case 'typewriter':
        enterCode = `self.play(AddTextLetterByLetter(${n})${rt})`;
        break;
      case 'draw_border_fill':
        enterCode = `self.play(DrawBorderThenFill(${n})${rt})`;
        break;
      case 'grow_arrow':
        enterCode = `self.play(GrowArrow(${n})${rt})`;
        break;
      case 'grow_from_edge': {
        const dir = (o.enterAnimDir ?? 'LEFT') as string;
        enterCode = `self.play(GrowFromEdge(${n}, edge=${dir})${rt})`;
        break;
      }
      case 'fade_in_large': {
        const sc = (o.enterAnimScale ?? 1.5).toFixed(1);
        enterCode = `self.play(FadeIn(${n}, scale=${sc})${rt})`;
        break;
      }
      default:
        enterCode = `self.play(FadeIn(${n})${rt})`;
    }
    steps.push({ time: t, order: 0, code: enterCode, dur: enterAnim === 'none' ? 0 : dur });
  }

  // ── Group parallel clips ──
  type ClipGroup =
    | { type: 'group'; clips: typeof clips; startTime: number }
    | { type: 'single'; clip: (typeof clips)[0]; startTime: number };
  const clipGroups: ClipGroup[] = [];
  let gi = 0;
  while (gi < clips.length) {
    const c = clips[gi];
    if (c.parallel) {
      const group = [c];
      let j = gi + 1;
      while (
        j < clips.length &&
        clips[j].parallel &&
        Math.abs(clips[j].startTime - c.startTime) < 0.01
      ) {
        group.push(clips[j]);
        j++;
      }
      clipGroups.push({ type: 'group', clips: group, startTime: c.startTime });
      gi = j;
    } else {
      clipGroups.push({ type: 'single', clip: c, startTime: c.startTime });
      gi++;
    }
  }

  // ── Build clip animation steps ──
  function singleClipCode(c: (typeof clips)[0]): { code: string; dur: number } | null {
    const objId = c.sourceId ?? c.objectId;
    const sn = vn(objId ?? '');
    const dur = c.duration;
    const rtStr = rtOpt(dur);
    const rfStr = rfOpt(c.easing);
    switch (c.type) {
      case 'transform': {
        const tn = vn(c.targetId ?? '');
        return {
          code: `self.play(${transformExpr(c, sn, tn, oMap[c.sourceId ?? ''], oMap[c.targetId ?? ''])}${rtStr}${rfStr})`,
          dur,
        };
      }
      case 'move': {
        const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
        return {
          code: `self.play(${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])${rtStr}${rfStr})`,
          dur,
        };
      }
      case 'scale':
        return {
          code: `self.play(${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})${rtStr}${rfStr})`,
          dur,
        };
      case 'fade': {
        const op = c.params?.targetOpacity ?? 0;
        return {
          code:
            op < 0.01
              ? `self.play(FadeOut(${sn})${rtStr}${rfStr})`
              : `self.play(${sn}.animate.set_opacity(${op.toFixed(2)})${rtStr}${rfStr})`,
          dur,
        };
      }
      case 'rotate': {
        const obj = oMap[objId ?? ''];
        if (is3D && obj && obj3DTypes.includes(obj.type)) {
          const axisMap: Record<string, string> = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
          const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
          const angleRad = (((c.angle ?? 90) * Math.PI) / 180).toFixed(4);
          return {
            code: `self.play(Rotate(${sn}, angle=${angleRad}, axis=${axis})${rtStr}${rfStr})`,
            dur,
          };
        }
        const ang =
          (((c.params?.targetRotation || 360) - (oMap[objId ?? '']?.rotation || 0)) * Math.PI) /
          180;
        return { code: `self.play(Rotate(${sn}, angle=${ang.toFixed(2)})${rtStr}${rfStr})`, dur };
      }
      case 'path_move': {
        if (!c.path || c.path.length < 2) return null;
        const cn = (c.id || sn).replace(/[^a-zA-Z0-9_]/g, '_');
        const pn = `path_${cn}`;
        const ptsStr = pathPointsPy(c.path, sw, sh);
        const multiLine = [
          `${pn} = VMobject()`,
          `${pn}.set_points_as_corners([np.array(p) for p in [${ptsStr}]])`,
          `self.play(MoveAlongPath(${sn}, ${pn})${rtStr}${rfStr})`,
        ].join('\n'); // emit loop re-indents every line; joining with indent would double it
        return { code: multiLine, dur };
      }
      case 'count': {
        const cn = (c.id || sn).replace(/[^a-zA-Z0-9_]/g, '_');
        const vt = `_count_${cn}`; // distinct from keyframe _vt_<obj>_<prop> to avoid parser collision
        const from = Number.isFinite(c.from) ? c.from! : 0;
        const to = Number.isFinite(c.to) ? c.to! : 0;
        const multiLine = [
          `${vt} = ValueTracker(${from})`,
          `${sn}.add_updater(lambda m: m.set_value(${vt}.get_value()))`,
          `self.play(${vt}.animate.set_value(${to})${rtStr}${rfStr})`,
          `${sn}.clear_updaters()`,
        ].join('\n'); // emit loop re-indents every line; joining with indent would double it
        return { code: multiLine, dur };
      }
      case 'indicate':
      case 'flash':
      case 'wiggle':
      case 'circumscribe':
      case 'focus_on': {
        const e = emphasisExpr(c, sn);
        return e ? { code: `self.play(${e}${rtStr}${rfStr})`, dur } : null;
      }
      default:
        return null;
    }
  }

  function animExpr(c: (typeof clips)[0]): string | null {
    const objId = c.sourceId ?? c.objectId;
    const sn = vn(objId ?? '');
    switch (c.type) {
      case 'move': {
        const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
        return `${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])`;
      }
      case 'scale':
        return `${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})`;
      case 'fade': {
        const op = c.params?.targetOpacity ?? 0;
        return op < 0.01 ? `FadeOut(${sn})` : `${sn}.animate.set_opacity(${op.toFixed(2)})`;
      }
      case 'rotate': {
        const obj = oMap[objId ?? ''];
        if (is3D && obj && obj3DTypes.includes(obj.type)) {
          const axisMap: Record<string, string> = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
          const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
          const angleRad = (((c.angle ?? 90) * Math.PI) / 180).toFixed(4);
          return `Rotate(${sn}, angle=${angleRad}, axis=${axis})`;
        }
        const ang =
          (((c.params?.targetRotation || 360) - (oMap[objId ?? '']?.rotation || 0)) * Math.PI) /
          180;
        return `Rotate(${sn}, angle=${ang.toFixed(2)})`;
      }
      case 'transform': {
        const tn = vn(c.targetId ?? '');
        return transformExpr(c, sn, tn, oMap[c.sourceId ?? ''], oMap[c.targetId ?? '']);
      }
      case 'indicate':
      case 'flash':
      case 'wiggle':
      case 'circumscribe':
      case 'focus_on':
        return emphasisExpr(c, sn);
      case 'count':
        return null;
      default:
        return null;
    }
  }

  for (const cg of clipGroups) {
    if (cg.type === 'single') {
      const result = singleClipCode(cg.clip);
      if (result)
        steps.push({
          time: cg.clip.startTime,
          order: 1,
          ...result,
          audio: cg.clip.audio,
          _clipId: cg.clip.id,
        });
    } else if (cg.clips.length === 1) {
      const result = singleClipCode(cg.clips[0]);
      if (result)
        steps.push({
          time: cg.startTime,
          order: 1,
          ...result,
          audio: cg.clips[0].audio,
          _clipId: cg.clips[0].id,
        });
    } else {
      const groupClips = cg.clips;
      const dur = Math.max(...groupClips.map((c) => c.duration));
      const rtStr = rtOpt(dur);
      const maxLag = Math.max(...groupClips.map((c) => c.lag_ratio || 0));
      const exprs = groupClips.map(animExpr).filter((e): e is string => e !== null);
      if (exprs.length > 0) {
        const groupFn = maxLag > 0 ? 'LaggedStart' : 'AnimationGroup';
        const lagStr = maxLag > 0 ? `, lag_ratio=${maxLag.toFixed(2)}` : '';
        const rfStr = rfOpt(groupClips[0]?.easing || 'ease_in_out');
        steps.push({
          time: cg.startTime,
          order: 1,
          code: `self.play(${groupFn}(${exprs.join(', ')}${lagStr})${rtStr}${rfStr})`,
          dur,
        });
      }
    }
  }

  // ── Keyframe steps ──
  generateKeyframeSteps({ ...project, objects: visibleObjects }, steps, sw, sh);

  // ── Camera clips ──
  if (Array.isArray(project.cameraTrack) && project.cameraTrack.length > 0) {
    for (const camClip of project.cameraTrack) {
      if (camClip.type !== 'camera_move') continue;
      const dur = camClip.duration ?? 1;
      const rtStr = rtOpt(dur);
      const rfStr = rfOpt(camClip.easing);

      let code: string;
      if (is3D) {
        const p = camClip.params || {};
        const phi = p.phi ?? project.camera3d?.phi ?? 75;
        const theta = p.theta ?? project.camera3d?.theta ?? -45;
        const zoom = p.zoom ?? 1.0;
        code = `self.move_camera(phi=${phi} * DEGREES, theta=${theta} * DEGREES, zoom=${zoom.toFixed(2)}, run_time=${dur})`;
      } else if (project.cameraType === 'moving') {
        const mp = stageToManim(camClip.params?.targetX || 0, camClip.params?.targetY || 0, sw, sh);
        const zoom = parseFloat(((camClip.params?.zoom as number | undefined) || 1).toFixed(4));
        const frameWidth = (FRAME_WIDTH / zoom).toFixed(3);
        code = `self.play(self.camera.frame.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0]).set_width(${frameWidth})${rtStr}${rfStr})`;
      } else {
        continue;
      }

      steps.push({
        time: camClip.startTime,
        order: 1,
        code,
        dur,
      });
    }
  }

  // Exit: skip objects that are transform sources
  for (const o of visibleObjects) {
    if (transformSources.has(o.id)) continue;
    let exitTime = (o.enterTime || 0) + (o.duration || 3);
    for (const c of clips) {
      const end = c.startTime + c.duration;
      if ((c.sourceId === o.id || c.targetId === o.id) && end > exitTime) exitTime = end + 0.1;
    }
    const n = vn(o.id);
    const exitAnim = o.exitAnim || 'none';
    const dur = o.exitAnimDur || 0.5;
    const rt = rtOpt(dur);

    let exitCode: string;
    switch (exitAnim) {
      case 'none':
        continue; // Skip entirely
      case 'fade_out':
        exitCode = `self.play(FadeOut(${n})${rt})`;
        break;
      case 'shrink_out':
        exitCode = `self.play(ShrinkToCenter(${n})${rt})`;
        break;
      case 'fly_out_left':
        exitCode = `self.play(FadeOut(${n}, shift=LEFT)${rt})`;
        break;
      case 'fly_out_right':
        exitCode = `self.play(FadeOut(${n}, shift=RIGHT)${rt})`;
        break;
      case 'fly_out_top':
        exitCode = `self.play(FadeOut(${n}, shift=UP)${rt})`;
        break;
      case 'fly_out_bottom':
        exitCode = `self.play(FadeOut(${n}, shift=DOWN)${rt})`;
        break;
      case 'uncreate':
        exitCode = `self.play(Uncreate(${n})${rt})`;
        break;
      case 'spin_out':
        exitCode = `self.play(FadeOut(${n}, shift=OUT, scale=0.5)${rt})`;
        break;
      case 'typewriter_out':
        exitCode = `self.play(RemoveTextLetterByLetter(${n})${rt})`;
        break;
      case 'unwrite':
        exitCode = `self.play(Unwrite(${n})${rt})`;
        break;
      case 'fade_out_large': {
        const sc = (o.exitAnimScale ?? 1.5).toFixed(1);
        exitCode = `self.play(FadeOut(${n}, scale=${sc})${rt})`;
        break;
      }
      default:
        exitCode = `self.play(FadeOut(${n})${rt})`;
    }
    steps.push({ time: exitTime, order: 2, code: exitCode, dur });
  }

  // Sort: by time, then enter → clip → exit
  steps.sort((a, b) => a.time - b.time || a.order - b.order);

  // ── Emit animation code ──
  L.push(`${indent}# Animation`);

  // Build sorted section queue filtered to scene duration
  const sectionQueue = [...(project.sections ?? [])]
    .filter((s) => s.time <= (project.sceneDuration ?? 99))
    .sort((a, b) => a.time - b.time);
  let nextSectionIdx = 0;

  let t = 0;
  for (const step of steps) {
    // Emit any pending sections whose time <= this step's start time
    while (
      nextSectionIdx < sectionQueue.length &&
      sectionQueue[nextSectionIdx]!.time <= step.time
    ) {
      L.push(`${indent}self.next_section("${sectionQueue[nextSectionIdx]!.title}")`);
      nextSectionIdx++;
    }
    const wait = step.time - t;
    if (wait > 0.05) L.push(`${indent}self.wait(${wait.toFixed(1)})`);
    const a = step.audio;
    if (a && a.status === 'ready' && a.src) {
      const trackerId = step._clipId
        ? `tracker_${step._clipId.replace(/[^a-zA-Z0-9]/g, '_')}`
        : `tracker_${steps.indexOf(step)}`;
      L.push(`${indent}with self.voiceover(audio="${a.src}") as ${trackerId}:`);
      if (a.syncMode === 'manual' && (a.offset ?? 0) > 0) {
        L.push(`${indent}    self.wait(${parseFloat(String(a.offset)).toFixed(1)})`);
      }
      const innerLines = step.code.split('\n');
      for (const line of innerLines) {
        L.push(`${indent}    ${line.trim()}`);
      }
      if (a.syncMode === 'auto') {
        const dur = parseFloat(String(step.dur || 1)).toFixed(1);
        L.push(`${indent}    self.wait(max(0, ${trackerId}.duration - ${dur}))`);
      }
    } else {
      // step.code may be a multi-line block (e.g. UpdateFromAlphaFunc def +
      // self.play). Indent every line to the construct body, preserving the
      // block's own relative indentation.
      for (const line of step.code.split('\n')) {
        L.push(line ? `${indent}${line}` : '');
      }
    }
    t = step.time + (step.dur || 0.5);
  }

  // Emit any sections that come after all animation steps
  while (nextSectionIdx < sectionQueue.length) {
    L.push(`${indent}self.next_section("${sectionQueue[nextSectionIdx]!.title}")`);
    nextSectionIdx++;
  }

  L.push('');
  L.push(`${indent}self.wait(1)`);
  return L.join('\n');
}

export { objectCode } from './objects.js';
export { objectCode3d } from './objects3d.js';
export { generateKeyframeSteps } from './keyframes.js';
export { transformExpr, emphasisExpr } from './clips.js';
export * from './constants.js';
export * from './helpers.js';
export type {
  Project,
  SceneObject,
  Clip,
  Track,
  Group,
  Stage,
  Camera3d,
  AudioConfig,
  Keyframe,
  PathPoint,
  ResolveAsset,
  GradientEffect,
  DashEffect,
  ShadowEffect,
  KeyframeMap,
  KeyframeCodegenMode,
  KeyframeDefaults,
  GeneratedStep,
  GenerateOptions,
  // per-type narrow interfaces
  ParametricObject,
  VectorFieldObject,
  DotGridObject,
  TableObject,
  ArcSectorObject,
  AnnulusObject,
  StarObject,
  RayObject,
  PlaneObject,
  GraphEntry,
  AxesObject,
  PolygonObject,
  NumberLineObject,
  MatrixObject,
  LatexObject,
  GraphObject,
  VectorComponentsObject,
  TextObject,
  CodeObject,
  BarChartObject,
} from './types.js';
