import { vn, rtOpt } from './helpers.js';
import { FRAME_WIDTH, FRAME_HEIGHT } from './constants.js';

export function _kfPropSet(n, prop, value, sw, sh) {
  const MANIM_W = FRAME_WIDTH,
    MANIM_H = FRAME_HEIGHT;
  switch (prop) {
    case 'x': {
      const mx = (value / sw - 0.5) * MANIM_W;
      return `${n}.animate.set_x(${mx.toFixed(4)})`;
    }
    case 'y': {
      const my = (0.5 - value / sh) * MANIM_H;
      return `${n}.animate.set_y(${my.toFixed(4)})`;
    }
    case 'opacity':
      return `${n}.animate.set_opacity(${Math.max(0, Math.min(1, value)).toFixed(4)})`;
    case 'rotation':
      return `${n}.animate.rotate(${((value * Math.PI) / 180).toFixed(4)})`;
    case 'scaleX':
      return `${n}.animate.stretch_to_fit_width(${value.toFixed(4)})`;
    case 'scaleY':
      return `${n}.animate.stretch_to_fit_height(${value.toFixed(4)})`;
    // x3d/y3d/z3d are never routed here — 3D position is always combined into a
    // single move_to by generateKeyframeSteps (a per-axis move_to would zero the
    // other two axes). See the "Combine simultaneous x3d/y3d/z3d" block below.
    case 'rx':
      return `${n}.animate.rotate(${((value * Math.PI) / 180).toFixed(4)}, axis=RIGHT)`;
    case 'ry':
      return `${n}.animate.rotate(${((value * Math.PI) / 180).toFixed(4)}, axis=UP)`;
    case 'rz':
      return `${n}.animate.rotate(${((value * Math.PI) / 180).toFixed(4)}, axis=OUT)`;
    case 'value':
      return `${n}.animate.set_value(${value.toFixed(4)})`;
    default:
      return null;
  }
}

export function _kfUpdater(prop) {
  switch (prop) {
    case 'x':
      return 'set_x';
    case 'y':
      return 'set_y';
    case 'opacity':
      return 'set_opacity';
    case 'value':
      return 'set_value';
    default:
      return null;
  }
}

// Convert a raw keyframe value (stage pixels for x/y) into the Manim-space value
// the setter expects. UpdateFromAlphaFunc/ValueTracker feed the setter directly.
export function _kfValue(prop, value, sw, sh) {
  switch (prop) {
    case 'x':
      return (value / sw - 0.5) * FRAME_WIDTH;
    case 'y':
      return (0.5 - value / sh) * FRAME_HEIGHT;
    case 'opacity':
      return Math.max(0, Math.min(1, value));
    default:
      return value;
  }
}

export function generateKeyframeSteps(project, steps, sw, sh) {
  if (!project.objects) return;
  for (const obj of project.objects) {
    if (!obj.keyframes || Object.keys(obj.keyframes).length === 0) continue;
    const n = vn(obj.id);
    const defaults = project.keyframeDefaults || {};

    // ── Combine simultaneous x3d/y3d/z3d keyframes into single move_to ──
    // 3D position can only be expressed via move_to, so any keyframed x3d/y3d/z3d
    // is folded in here regardless of its per-prop codegenMode. ValueTracker /
    // UpdateFromAlphaFunc have no 3D setter and would otherwise drop them silently.
    const pos3DProps = ['x3d', 'y3d', 'z3d'];
    const hasPos3D = pos3DProps.some((p) => {
      const kfs = obj.keyframes?.[p];
      return kfs && kfs.length >= 2;
    });

    if (hasPos3D) {
      const pos3DKeyframes = {};
      for (const p of pos3DProps) {
        const kfs = obj.keyframes?.[p];
        if (!kfs || kfs.length < 2) continue;
        pos3DKeyframes[p] = [...kfs].sort((a, b) => a.time - b.time);
      }

      // Collect all unique time points across active 3D props
      const allTimes = new Set();
      for (const kfs of Object.values(pos3DKeyframes)) {
        kfs.forEach((kf) => allTimes.add(kf.time));
      }
      const sortedTimes = [...allTimes].sort((a, b) => a - b);

      // "last known value at or before time t" helper
      const getVal = (kfs, t) => {
        if (!kfs || kfs.length === 0) return null;
        const last = kfs.filter((k) => k.time <= t).pop();
        return last ? last.value : kfs[0].value;
      };

      // Emit one move_to per [t1, t2] segment
      for (let i = 0; i < sortedTimes.length - 1; i++) {
        const t1 = sortedTimes[i],
          t2 = sortedTimes[i + 1];
        const dur = parseFloat((t2 - t1).toFixed(2));
        const tx = getVal(pos3DKeyframes['x3d'], t2) ?? obj.x3d ?? 0;
        const ty = getVal(pos3DKeyframes['y3d'], t2) ?? obj.y3d ?? 0;
        const tz = getVal(pos3DKeyframes['z3d'], t2) ?? obj.z3d ?? 0;
        const rt = rtOpt(dur);
        steps.push({
          time: t1,
          order: 0.5,
          code: `self.play(${n}.animate.move_to([${tx.toFixed(3)}, ${ty.toFixed(3)}, ${tz.toFixed(3)}])${rt})`,
          dur,
        });
      }
    }

    for (const [prop, keyframes] of Object.entries(obj.keyframes)) {
      // 3D coordinate props are always merged into a single move_to above
      if (pos3DProps.includes(prop)) continue;
      if (!keyframes || keyframes.length < 2) continue;
      const sorted = [...keyframes].sort((a, b) => a.time - b.time);
      const codegenMode =
        (obj.keyframeCodegen && obj.keyframeCodegen[prop]) ||
        defaults.codegenMode ||
        'UpdateFromAlphaFunc';

      if (codegenMode === 'animate') {
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i],
            k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const val = _kfPropSet(n, prop, k2.value, sw, sh);
          if (!val) continue;
          const rt = rtOpt(dur);
          steps.push({ time: k1.time, order: 0.5, code: `self.play(${val}${rt})`, dur });
        }
      } else if (codegenMode === 'ValueTracker') {
        const safeProp = prop.replace(/[^a-zA-Z0-9_]/g, '_');
        const vtSetter = _kfUpdater(prop);
        if (!vtSetter) continue;
        const trackVar = `_vt_${n}_${safeProp}`;
        const initVal = _kfValue(prop, sorted[0].value, sw, sh);
        let block = `${trackVar} = ValueTracker(${(+initVal).toFixed(4)})\n`;
        block += `${n}.add_updater(lambda m: m.${vtSetter}(${trackVar}.get_value()))\n`;
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i],
            k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const rt = rtOpt(dur);
          block += `self.play(${trackVar}.animate.set_value(${_kfValue(prop, k2.value, sw, sh).toFixed(4)})${rt})\n`;
        }
        block += `${n}.clear_updaters()`;
        steps.push({
          time: sorted[0].time,
          order: 0.5,
          code: block,
          dur: sorted[sorted.length - 1].time - sorted[0].time,
        });
      } else {
        // UpdateFromAlphaFunc (default)
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i],
            k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const safeProp = prop.replace(/[^a-zA-Z0-9_]/g, '_');
          const kfVar = `_kf_${n}_${safeProp}_${i}`;
          const setter = _kfUpdater(prop);
          if (!setter) continue;
          const rt = rtOpt(dur);
          const v0 = _kfValue(prop, k1.value, sw, sh).toFixed(4),
            v1 = _kfValue(prop, k2.value, sw, sh).toFixed(4);
          const t0 = k1.time.toFixed(4);
          const block =
            `def ${kfVar}_fn(mob, alpha):\n` +
            `    t = ${t0} + alpha * ${dur.toFixed(4)}\n` +
            `    v = ${v0} + (${v1} - ${v0}) * max(0, min(1, (t - ${t0}) / ${dur.toFixed(4)}))\n` +
            `    mob.${setter}(v)\n` +
            `self.play(UpdateFromAlphaFunc(${n}, ${kfVar}_fn, run_time=${dur.toFixed(1)}, rate_func=linear))`;
          steps.push({ time: k1.time, order: 0.5, code: block, dur });
        }
      }
    }
  }
}
