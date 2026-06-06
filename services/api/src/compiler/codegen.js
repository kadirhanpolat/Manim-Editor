/**
 * Manim Python Code Generator — v4 (server-side)
 *
 * Generates a clean Manim CE scene from the normalised project JSON.
 * Mirrors the client-side generator but uses server file paths for assets.
 *
 * Supports: rectangle, square, circle, ellipse, triangle, star, polygon,
 *           line, arrow, heart, dot, dot_grid, text, image, svg_asset, groups
 */

import {
  EASING_MAP, FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS,
  GRADIENT_TYPES, DASH_TYPES, SHADOW_TYPES,
} from '@manim/codegen/src/constants.js';
import {
  rf, rfOpt, rtOpt, vn, hex, safeNum, safeOpacity, safeMathExpr, safeText,
  safeLatex, safeMatrixEntry, matrixBrackets, fillOpacityExpr, strokeOpacityArg,
  gradientLine, dashedLines, roundCornersLine, shadowLines, stageToManim,
  pathPointsPy, isSystemFont, fmt3d,
} from '@manim/codegen/src/helpers.js';
import { objectCode3d } from '@manim/codegen/src/objects3d.js';
import { generateKeyframeSteps } from '@manim/codegen/src/keyframes.js';
import { objectCode } from '@manim/codegen/src/objects.js';

/** Inner Manim expression for an emphasis clip (Indicate/Flash/Wiggle/Circumscribe/FocusOn), or null. */
function emphasisExpr(c, sn) {
  const p = c.params || {};
  const col = hex(p.color || '#FFFF00');
  switch (c.type) {
    case 'indicate':
      return `Indicate(${sn}, color=${col}, scale_factor=${(p.scale_factor ?? 1.2).toFixed(2)})`;
    case 'flash':
      return `Flash(${sn}, color=${col}, flash_radius=${(p.flash_radius ?? 0.3).toFixed(2)}, line_length=${(p.line_length ?? 0.2).toFixed(2)}, num_lines=${p.num_lines ?? 12})`;
    case 'wiggle':
      return `Wiggle(${sn}, scale_value=${(p.scale_value ?? 1.1).toFixed(2)}, rotation_angle=${(p.rotation_angle ?? 3.6).toFixed(2)} * DEGREES, n_wiggles=${p.n_wiggles ?? 6})`;
    case 'circumscribe': {
      const shape = p.shape === 'Circle' ? 'Circle' : 'Rectangle';
      const fade = p.fade_out ? 'True' : 'False';
      return `Circumscribe(${sn}, color=${col}, shape=${shape}, fade_out=${fade}, time_width=${(p.time_width ?? 0.3).toFixed(2)})`;
    }
    case 'focus_on':
      return `FocusOn(${sn}, color=${col}, opacity=${(p.opacity ?? 0.2).toFixed(2)})`;
    default:
      return null;
  }
}

// ── Transform clip expression ──────────────────────────────────────────────

// Shared transform-clip expression. matchTerms (when set and no raster involved)
// upgrades to TransformMatchingTex (both latex) or TransformMatchingShapes (other
// VMobjects). Used by all three transform-clip codegen sites + the parallel group.
function transformExpr(clip, sn, tn, srcObj, tgtObj) {
  const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
  if (hasRaster) return `FadeTransform(${sn}, ${tn})`;
  if (clip.matchTerms) {
    const bothLatex = srcObj?.type === 'latex' && tgtObj?.type === 'latex';
    return bothLatex
      ? `TransformMatchingTex(${sn}, ${tn})`
      : `TransformMatchingShapes(${sn}, ${tn})`;
  }
  return `ReplacementTransform(${sn}, ${tn})`;
}

// ── Main generator ──────────────────────────────────────────────────────────

export function generatePythonCode(project, assetsPath) {
  const L = [];
  const sw = project.stage.width;
  const sh = project.stage.height;
  const assetMap = project._assetMap || {};

  const resolveAssetServer = (obj, ext) => {
    const asset = obj.assetId ? assetMap[obj.assetId] : null;
    const filename = asset?.filename
      || `${(obj.name || (ext === 'svg' ? 'asset' : 'image')).replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
    return `${assetsPath}/${filename}`;
  };

  // Collect unique Google Fonts used by text objects
  const usedFonts = new Set();
  for (const obj of (project.objects || [])) {
    if (obj.type === 'text' && obj.fontFamily) {
      // Only register Google Fonts (not system fonts)
      const font = obj.fontFamily;
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

  const allClips = (project.tracks || []).flatMap(t => t.clips || []);
  const hasReadyAudio = allClips.some(c => c.audio && c.audio.status === 'ready' && c.audio.src);

  if (hasReadyAudio) {
    L.push('from manim_voiceover import VoiceoverScene');
    L.push('from manim_voiceover.services.gtts import GTTSService');
  }

  const is3D = project.sceneType === '3d';
  if (is3D) {
    L.push('from manim.mobject.three_d.three_dimensions import Sphere, Cube, Cone, Cylinder, Torus');
    L.push('from manim import ThreeDAxes, ThreeDScene');
  }

  L.push('');
  L.push('');

  let sceneBase;
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

  if (!project.objects || project.objects.length === 0) {
    L.push('        self.wait(1)');
    return L.join('\n');
  }

  // Generate font registration and scene content
  // If we have Google Fonts, wrap everything in nested RegisterFont context managers
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

  // Object definitions
  const obj3DTypes = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
  const oMap = {};
  L.push(`${indent}# Objects`);
  for (const obj of project.objects) {
    oMap[obj.id] = obj;
    if (obj3DTypes.includes(obj.type)) {
      objectCode3d(obj).forEach(l => L.push(indent + l));
    } else {
      objectCode(obj, sw, sh, { resolveAsset: resolveAssetServer }).forEach(l => L.push(indent + l));
    }
    L.push('');
  }

  // Groups
  const groups = project.groups || [];
  if (groups.length > 0) {
    L.push(`${indent}# Groups`);
    for (const g of groups) {
      if (!g.childIds || g.childIds.length === 0) continue;
      const childVars = g.childIds.map(id => vn(id)).filter(Boolean).join(', ');
      const gn = vn(g.id);
      L.push(`${indent}${gn} = VGroup(${childVars})`);
    }
    L.push('');
  }

  // Collect clips
  const clips = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) clips.push(clip);
  }
  clips.sort((a, b) => a.startTime - b.startTime);

  // Determine transform relationships
  const transformSources = new Set();
  const transformTargets = new Set();
  for (const c of clips) {
    if (c.type === 'transform') {
      transformSources.add(c.sourceId);
      if (c.targetId) transformTargets.add(c.targetId);
    }
  }

  // Build animation steps
  const steps = [];

  // Enter (skip transform targets)
  for (const obj of project.objects) {
    if (transformTargets.has(obj.id)) continue;
    const t = obj.enterTime || 0;
    const n = vn(obj.id);
    const dur = obj.enterAnimDur || 0.5;
    const rt = rtOpt(dur);
    const enterAnim = obj.enterAnim || 'fade_in';

    let enterCode;
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
      default:
        enterCode = `self.play(FadeIn(${n})${rt})`;
    }
    steps.push({ time: t, order: 0, code: enterCode, dur: enterAnim === 'none' ? 0 : dur });
  }

  // Clip animations — parallel clips grouped into AnimationGroup/LaggedStart
  const clipGroups = [];
  let i = 0;
  while (i < clips.length) {
    const c = clips[i];
    if (c.parallel) {
      const group = [c];
      let j = i + 1;
      while (j < clips.length && clips[j].parallel && Math.abs(clips[j].startTime - c.startTime) < 0.01) {
        group.push(clips[j]);
        j++;
      }
      clipGroups.push({ type: 'group', clips: group, startTime: c.startTime });
      i = j;
    } else {
      clipGroups.push({ type: 'single', clip: c, startTime: c.startTime });
      i++;
    }
  }

  for (const cg of clipGroups) {
    if (cg.type === 'single') {
      const c = cg.clip;
      const objId = c.sourceId ?? c.objectId;
      const sn = vn(objId);
      const dur = c.duration;
      const rtStr = rtOpt(dur);
      const rfStr = rfOpt(c.easing);
      let code;
      switch (c.type) {
        case 'transform': {
          const tn = vn(c.targetId);
          code = `self.play(${transformExpr(c, sn, tn, oMap[c.sourceId], oMap[c.targetId])}${rtStr}${rfStr})`;
          break;
        }
        case 'move': {
          const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
          code = `self.play(${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])${rtStr}${rfStr})`;
          break;
        }
        case 'scale':
          code = `self.play(${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})${rtStr}${rfStr})`;
          break;
        case 'fade': {
          const op = c.params?.targetOpacity ?? 0;
          code = op < 0.01
            ? `self.play(FadeOut(${sn})${rtStr}${rfStr})`
            : `self.play(${sn}.animate.set_opacity(${op.toFixed(2)})${rtStr}${rfStr})`;
          break;
        }
        case 'rotate': {
          const obj = oMap[objId];
          if (is3D && obj && obj3DTypes.includes(obj.type)) {
            const axisMap = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
            const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
            const angleRad = ((c.angle ?? 90) * Math.PI / 180).toFixed(4);
            code = `self.play(Rotate(${sn}, angle=${angleRad}, axis=${axis})${rtStr}${rfStr})`;
          } else {
            const ang = ((c.params?.targetRotation || 360) - (oMap[objId]?.rotation || 0)) * Math.PI / 180;
            code = `self.play(Rotate(${sn}, angle=${ang.toFixed(2)})${rtStr}${rfStr})`;
          }
          break;
        }
        case 'path_move': {
          if (!c.path || c.path.length < 2) break;
          const cn = c.id ? c.id.replace(/[^a-zA-Z0-9_]/g, '_') : sn;
          const pn = `path_${cn}`;
          const ptsStr = pathPointsPy(c.path, sw, sh);
          code = [
            `${pn} = VMobject()`,
            `${pn}.set_points_as_corners([np.array(p) for p in [${ptsStr}]])`,
            `self.play(MoveAlongPath(${sn}, ${pn})${rtStr}${rfStr})`,
          ].join(`\n${indent}`);
          break;
        }
        case 'count': {
          const cn = c.id ? c.id.replace(/[^a-zA-Z0-9_]/g, '_') : sn;
          const vt = `_count_${cn}`;   // distinct from keyframe _vt_<obj>_<prop> to avoid parser collision
          const from = Number.isFinite(c.from) ? c.from : 0;
          const to = Number.isFinite(c.to) ? c.to : 0;
          code = [
            `${vt} = ValueTracker(${from})`,
            `${sn}.add_updater(lambda m: m.set_value(${vt}.get_value()))`,
            `self.play(${vt}.animate.set_value(${to})${rtStr}${rfStr})`,
            `${sn}.clear_updaters()`,
          ].join(`\n${indent}`);
          break;
        }
        case 'indicate':
        case 'flash':
        case 'wiggle':
        case 'circumscribe':
        case 'focus_on': {
          const e = emphasisExpr(c, sn);
          if (e) code = `self.play(${e}${rtStr}${rfStr})`;
          break;
        }
      }
      if (code) steps.push({ time: c.startTime, order: 1, code, dur, audio: c.audio, _clipId: c.id });
    } else {
      // Degenerate case: only one clip marked parallel, treat as sequential
      if (cg.clips.length === 1) {
        const c = cg.clips[0];
        const objId = c.sourceId ?? c.objectId;
        const sn = vn(objId);
        const dur = c.duration;
        const rtStr = rtOpt(dur);
        const rfStr = rfOpt(c.easing);
        let code;
        switch (c.type) {
          case 'transform': {
            const tn = vn(c.targetId);
            code = `self.play(${transformExpr(c, sn, tn, oMap[c.sourceId], oMap[c.targetId])}${rtStr}${rfStr})`;
            break;
          }
          case 'move': {
            const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
            code = `self.play(${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])${rtStr}${rfStr})`;
            break;
          }
          case 'scale':
            code = `self.play(${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})${rtStr}${rfStr})`;
            break;
          case 'fade': {
            const op = c.params?.targetOpacity ?? 0;
            code = op < 0.01
              ? `self.play(FadeOut(${sn})${rtStr}${rfStr})`
              : `self.play(${sn}.animate.set_opacity(${op.toFixed(2)})${rtStr}${rfStr})`;
            break;
          }
          case 'rotate': {
            const obj = oMap[objId];
            if (is3D && obj && obj3DTypes.includes(obj.type)) {
              const axisMap = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
              const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
              const angleRad = ((c.angle ?? 90) * Math.PI / 180).toFixed(4);
              code = `self.play(Rotate(${sn}, angle=${angleRad}, axis=${axis})${rtStr}${rfStr})`;
            } else {
              const ang = ((c.params?.targetRotation || 360) - (oMap[objId]?.rotation || 0)) * Math.PI / 180;
              code = `self.play(Rotate(${sn}, angle=${ang.toFixed(2)})${rtStr}${rfStr})`;
            }
            break;
          }
          case 'path_move': {
            if (!c.path || c.path.length < 2) break;
            const cn = c.id ? c.id.replace(/[^a-zA-Z0-9_]/g, '_') : sn;
            const pn = `path_${cn}`;
            const ptsStr = pathPointsPy(c.path, sw, sh);
            code = [
              `${pn} = VMobject()`,
              `${pn}.set_points_as_corners([np.array(p) for p in [${ptsStr}]])`,
              `self.play(MoveAlongPath(${sn}, ${pn})${rtStr}${rfStr})`,
            ].join(`\n${indent}`);
            break;
          }
          case 'count': {
            const cn = c.id ? c.id.replace(/[^a-zA-Z0-9_]/g, '_') : sn;
            const vt = `_count_${cn}`;   // distinct from keyframe _vt_<obj>_<prop> to avoid parser collision
            const from = Number.isFinite(c.from) ? c.from : 0;
            const to = Number.isFinite(c.to) ? c.to : 0;
            code = [
              `${vt} = ValueTracker(${from})`,
              `${sn}.add_updater(lambda m: m.set_value(${vt}.get_value()))`,
              `self.play(${vt}.animate.set_value(${to})${rtStr}${rfStr})`,
              `${sn}.clear_updaters()`,
            ].join(`\n${indent}`);
            break;
          }
          case 'indicate':
          case 'flash':
          case 'wiggle':
          case 'circumscribe':
          case 'focus_on': {
            const e = emphasisExpr(c, sn);
            if (e) code = `self.play(${e}${rtStr}${rfStr})`;
            break;
          }
        }
        if (code) steps.push({ time: c.startTime, order: 1, code, dur, audio: c.audio, _clipId: c.id });
      } else {
      // Multi-clip parallel group: AnimationGroup or LaggedStart
      const groupClips = cg.clips;
      const dur = Math.max(...groupClips.map(c => c.duration));
      const rtStr = rtOpt(dur);
      const maxLag = Math.max(...groupClips.map(c => c.lag_ratio || 0));

      const animExprs = groupClips.map(c => {
        const objId = c.sourceId ?? c.objectId;
        const sn = vn(objId);
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
            const obj = oMap[objId];
            if (is3D && obj && obj3DTypes.includes(obj.type)) {
              const axisMap = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
              const axis = axisMap[c.axis ?? 'Z'] ?? 'OUT';
              const angleRad = ((c.angle ?? 90) * Math.PI / 180).toFixed(4);
              return `Rotate(${sn}, angle=${angleRad}, axis=${axis})`;
            }
            const ang = ((c.params?.targetRotation || 360) - (oMap[objId]?.rotation || 0)) * Math.PI / 180;
            return `Rotate(${sn}, angle=${ang.toFixed(2)})`;
          }
          case 'transform': {
            const tn = vn(c.targetId);
            return transformExpr(c, sn, tn, oMap[c.sourceId], oMap[c.targetId]);
          }
          case 'indicate':
          case 'flash':
          case 'wiggle':
          case 'circumscribe':
          case 'focus_on':
            return emphasisExpr(c, sn);
          case 'count': return null;
          default: return null;
        }
      }).filter(Boolean);

      if (animExprs.length > 0) {
        const animList = animExprs.join(', ');
        const groupFn = maxLag > 0 ? 'LaggedStart' : 'AnimationGroup';
        const lagStr = maxLag > 0 ? `, lag_ratio=${maxLag.toFixed(2)}` : '';
        // Apply the first clip's easing to the whole group (best approximation)
        const firstEasing = groupClips[0]?.easing || 'ease_in_out';
        const groupRfStr = rfOpt(firstEasing);
        const code = `self.play(${groupFn}(${animList}${lagStr})${rtStr}${groupRfStr})`;
        steps.push({ time: cg.startTime, order: 1, code, dur });
      }
      } // end multi-clip parallel group
    }
  }

  // Keyframe steps
  generateKeyframeSteps(project, steps, sw, sh);

  // Camera clips
  if (Array.isArray(project.cameraTrack) && project.cameraTrack.length > 0) {
    for (const camClip of project.cameraTrack) {
      if (camClip.type !== 'camera_move') continue;
      const dur = camClip.duration ?? 1;
      const rtStr = rtOpt(dur);
      const rfStr = rfOpt(camClip.easing);

      let code;
      if (is3D) {
        const p = camClip.params || {};
        const phi = p.phi ?? project.camera3d?.phi ?? 75;
        const theta = p.theta ?? project.camera3d?.theta ?? -45;
        const zoom = p.zoom ?? 1.0;
        code = `self.move_camera(phi=${phi} * DEGREES, theta=${theta} * DEGREES, zoom=${zoom.toFixed(2)}, run_time=${dur})`;
      } else if (project.cameraType === 'moving') {
        const mp = stageToManim(
          camClip.params?.targetX || 0,
          camClip.params?.targetY || 0,
          sw, sh
        );
        // camera frame animate: set_width gives absolute zoom (14/zoom units wide)
        // .scale() is relative/cumulative; set_width is absolute and idempotent
        const sceneWidth = FRAME_WIDTH;
        const zoom = parseFloat((camClip.params?.zoom || 1).toFixed(4));
        const frameWidth = (sceneWidth / zoom).toFixed(3);
        code = `self.play(self.camera.frame.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0]).set_width(${frameWidth})${rtStr}${rfStr})`;
      } else {
        continue;
      }

      steps.push({ time: camClip.startTime, order: 1, code, dur });
    }
  }

  // Exit (skip transform sources)
  for (const obj of project.objects) {
    if (transformSources.has(obj.id)) continue;
    let exitTime = (obj.enterTime || 0) + (obj.duration || 3);
    for (const c of clips) {
      const end = c.startTime + c.duration;
      if ((c.sourceId === obj.id || c.targetId === obj.id) && end > exitTime) exitTime = end + 0.1;
    }
    const n = vn(obj.id);
    const exitAnim = obj.exitAnim || 'none';
    const dur = obj.exitAnimDur || 0.5;
    const rt = rtOpt(dur);

    let exitCode;
    switch (exitAnim) {
      case 'none':
        continue;
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
      default:
        exitCode = `self.play(FadeOut(${n})${rt})`;
    }
    steps.push({ time: exitTime, order: 2, code: exitCode, dur });
  }

  // Sort
  steps.sort((a, b) => a.time - b.time || a.order - b.order);

  // Emit
  L.push(`${indent}# Animation`);
  let t = 0;
  for (const step of steps) {
    const wait = step.time - t;
    if (wait > 0.05) L.push(`${indent}self.wait(${wait.toFixed(1)})`);
    const a = step.audio;
    if (a && a.status === 'ready' && a.src) {
      const trackerId = step._clipId
        ? `tracker_${step._clipId.replace(/[^a-zA-Z0-9]/g, '_')}`
        : `tracker_${steps.indexOf(step)}`;
      L.push(`${indent}with self.voiceover(audio="${a.src}") as ${trackerId}:`);
      if (a.syncMode === 'manual' && a.offset > 0) {
        L.push(`${indent}    self.wait(${parseFloat(a.offset).toFixed(1)})`);
      }
      const innerLines = step.code.split('\n');
      for (const line of innerLines) {
        L.push(`${indent}    ${line.trim()}`);
      }
      if (a.syncMode === 'auto') {
        const dur = parseFloat(step.dur || 1).toFixed(1);
        L.push(`${indent}    self.wait(max(0, ${trackerId}.duration - ${dur}))`);
      }
    } else {
      // step.code may be a multi-line block (e.g. UpdateFromAlphaFunc def +
      // self.play). Indent EVERY line to the construct body, preserving the
      // block's own relative indentation — prefixing only the first line would
      // leave the def body and trailing self.play at the wrong column.
      for (const line of step.code.split('\n')) {
        L.push(line ? `${indent}${line}` : '');
      }
    }
    t = step.time + (step.dur || 0.5);
  }

  L.push('');
  L.push(`${indent}self.wait(1)`);
  return L.join('\n');
}

export { objectCode };
export { EASING_MAP } from '@manim/codegen/src/constants.js';
