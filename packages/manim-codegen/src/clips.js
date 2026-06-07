import { hex } from './helpers.js';

// Shared transform-clip expression. matchTerms (when set and no raster involved)
// upgrades to TransformMatchingTex (both latex) or TransformMatchingShapes (other
// VMobjects). Used by all three transform-clip codegen sites + the parallel group.
export function transformExpr(clip, sn, tn, srcObj, tgtObj) {
  const hasRaster =
    ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
  if (hasRaster) return `FadeTransform(${sn}, ${tn})`;
  if (clip.matchTerms) {
    const bothLatex = srcObj?.type === 'latex' && tgtObj?.type === 'latex';
    return bothLatex
      ? `TransformMatchingTex(${sn}, ${tn})`
      : `TransformMatchingShapes(${sn}, ${tn})`;
  }
  return `ReplacementTransform(${sn}, ${tn})`;
}

/** Inner Manim expression for an emphasis clip (Indicate/Flash/Wiggle/Circumscribe/FocusOn), or null. */
export function emphasisExpr(c, sn) {
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
