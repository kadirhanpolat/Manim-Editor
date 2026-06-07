// Pure effect helpers — no Vue reactivity.
// hexToRgba and applyEffects extracted verbatim from StageCanvas.vue.
// applyEffects receives `vs` (zoom scale, already resolved) as the last param
// so the function has no closure dependency on the SFC.

export function hexToRgba(h, a) {
  if (typeof h !== 'string' || !h.startsWith('#')) return h;
  let s = h.slice(1);
  if (s.length === 3)
    s = s
      .split('')
      .map((c) => c + c)
      .join('');
  if (s.length !== 6) return h;
  const r = parseInt(s.slice(0, 2), 16),
    g = parseInt(s.slice(2, 4), 16),
    b = parseInt(s.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return h;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mutates a Konva config with gradient / cornerRadius / dashed / per-channel alpha.
 *  centered = shape origin is its center (circle/star/polygon/triangle) vs top-left (rect).
 *  vs = resolved zoom scale (ctx.vs). */
export function applyEffects(cfg, obj, w, h, centered, vs) {
  // per-channel opacity → baked into rgba colors (node opacity stays the master)
  if (obj.fillOpacity != null && obj.fillOpacity !== 1 && cfg.fill)
    cfg.fill = hexToRgba(cfg.fill, obj.fillOpacity);
  if (obj.strokeOpacity != null && obj.strokeOpacity !== 1 && cfg.stroke)
    cfg.stroke = hexToRgba(cfg.stroke, obj.strokeOpacity);
  // gradient
  const g = obj.gradient;
  if (g && Array.isArray(g.colors) && g.colors.length >= 2) {
    const rad = ((g.angle ?? 135) * Math.PI) / 180;
    const dx = (Math.cos(rad) * w) / 2,
      dy = (Math.sin(rad) * h) / 2;
    const cx = centered ? 0 : w / 2,
      cy = centered ? 0 : h / 2;
    cfg.fillLinearGradientStartPoint = { x: cx - dx, y: cy - dy };
    cfg.fillLinearGradientEndPoint = { x: cx + dx, y: cy + dy };
    const stops = [];
    const ga = obj.fillOpacity != null && obj.fillOpacity !== 1 ? obj.fillOpacity : null;
    g.colors.forEach((c, i) => {
      stops.push(i / (g.colors.length - 1), ga != null ? hexToRgba(c, ga) : c);
    });
    cfg.fillLinearGradientColorStops = stops;
  }
  // dashed stroke (Konva keeps fill underneath, matching the render's VGroup)
  if (obj.dash) {
    const peri = centered ? Math.PI * Math.max(w, h) : h === 0 ? w : 2 * (w + h);
    const on = Math.max(2, (peri / Math.max(2, obj.dash.numDashes)) * (obj.dash.ratio ?? 0.5));
    const off = Math.max(
      2,
      (peri / Math.max(2, obj.dash.numDashes)) * (1 - (obj.dash.ratio ?? 0.5))
    );
    cfg.dash = [on, off];
  }
  // drop shadow (Konva native; blur is preview-only — Manim has no blur)
  if (obj.shadow) {
    cfg.shadowColor = obj.shadow.color || '#000000';
    cfg.shadowOpacity = obj.shadow.opacity ?? 0.4;
    cfg.shadowBlur = (obj.shadow.blur ?? 12) * vs;
    cfg.shadowOffset = { x: (obj.shadow.dx ?? 8) * vs, y: (obj.shadow.dy ?? 8) * vs };
  }
  // corner rounding for polygon/triangle/star — rect/square round via rectCfg before applyEffects
  if (obj.cornerRadius > 0) {
    if (obj.type === 'star' || obj.type === 'polygon') {
      // Konva Star and RegularPolygon support native cornerRadius
      cfg.cornerRadius = obj.cornerRadius * vs;
    } else if (obj.type === 'triangle') {
      // Konva Line (closed) has no cornerRadius; use tension as an approximation
      cfg.tension = 0.35;
    }
  }
  return cfg;
}
