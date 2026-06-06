// Pure text / counter / latex Konva config builders.
// Each function takes (obj, ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.
import { latexToUnicode } from '../../../utils/latexPreview.js';

// Module-level canvas used for text measurement (lazy-initialised).
let _measureCanvas = null;
let _measureCtx = null;

// ── measureTextWidth ──────────────────────────────────────────────────────────
// Pure function — no ctx needed; uses an offscreen canvas.
export function measureTextWidth(text, fontSize, fontFamily, fontStyle) {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
    _measureCtx = _measureCanvas.getContext('2d');
  }
  if (!_measureCtx) return 0;
  _measureCtx.font = `${fontStyle}${fontSize}px ${fontFamily}`;
  return _measureCtx.measureText(text).width;
}

// ── counterText ───────────────────────────────────────────────────────────────
// Pure formatter — reads obj fields and frameState from ctx.
export function counterText(obj, ctx) {
  const ov = ctx.frameState.objectOverrides[obj.id];
  const raw = (ov && 'value' in ov) ? ov.value : (obj.value ?? 0);
  const dec = Number.isFinite(obj.numDecimals) ? Math.max(0, Math.trunc(obj.numDecimals)) : 0;
  return raw.toFixed(dec) + (obj.suffix || '');
}

// ── textCfg ───────────────────────────────────────────────────────────────────
export function textCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj); const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y);
  // Match Manim Text font_size: at 1080p, font_size N ≈ N px; scale by vs for stage→canvas
  const manimFontScale = (e.fontSize || 48) * ctx.vs;
  const fontFamily = e.fontFamily || 'Arial';
  const fontStyle = (e.fontWeight === 'bold' ? 'bold ' : '') + (e.fontStyle === 'italic' ? 'italic ' : '');
  const rawContent = e.content || 'Text';
  const ov = ctx.frameState.objectOverrides[obj.id];
  const twFrac = ov && ov._typewriter !== undefined ? ov._typewriter : null;
  const text = twFrac !== null ? rawContent.slice(0, Math.max(0, Math.min(rawContent.length, Math.round(rawContent.length * twFrac)))) : rawContent;
  const align = e.textAlign || 'center';
  const textWidth = measureTextWidth(text, manimFontScale, fontFamily, fontStyle);
  let offsetX = 0;
  if (align === 'center') offsetX = textWidth / 2;
  else if (align === 'right') offsetX = textWidth;
  const rot = L ? L.rotation : (e.rotation || 0);
  return {
    x: p.x, y: p.y, text, fontSize: manimFontScale, fontFamily,
    fontStyle: fontStyle.trim(), fill: e.fill || '#ffffff', opacity: e.opacity ?? 1,
    rotation: rot, offsetX, offsetY: manimFontScale / 2,
    draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10
  };
}

// ── counterCfg ────────────────────────────────────────────────────────────────
export function counterCfg(obj, ctx) {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x, e.y);
  const fontSize = (e.fontSize || e.height || 48) * ctx.vs;
  const text = counterText(obj, ctx);
  const textWidth = measureTextWidth(text, fontSize, 'Arial', '');
  const rot = L ? L.rotation : (e.rotation || 0);
  return {
    x: p.x, y: p.y, text, fontSize, fontFamily: 'Arial',
    fontStyle: '', fill: e.fill || '#ffffff', opacity: e.opacity ?? 1,
    rotation: rot, offsetX: textWidth / 2, offsetY: fontSize / 2,
    draggable: ctx.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10
  };
}

// ── latexBgCfg ────────────────────────────────────────────────────────────────
export function latexBgCfg(obj, ctx) {
  const L = ctx.live(obj); const w = L ? L.w : obj.width * ctx.vs, h = L ? L.h : obj.height * ctx.vs;
  // listening:true → this rect is the group's hit area so the LaTeX box can be
  // selected/dragged on the canvas (the text/badge stay non-listening).
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(76,238,249,0.06)', stroke: ctx.themeAccent, strokeWidth: 1.5, dash: [6, 4], cornerRadius: 6, listening: true };
}

// ── latexTextCfg ──────────────────────────────────────────────────────────────
export function latexTextCfg(obj, ctx) {
  const L = ctx.live(obj); const w = L ? L.w : obj.width * ctx.vs, h = L ? L.h : obj.height * ctx.vs;
  // Approximate Unicode preview of the raw LaTeX (Manim does the real MathTex).
  return { x: -w / 2, y: -h / 2, width: w, height: h, text: latexToUnicode(obj.latex || 'E = mc^2'), fontSize: Math.max(12, 18 * ctx.vs), fontFamily: 'serif', fontStyle: 'italic', fill: obj.fill || '#ffffff', align: 'center', verticalAlign: 'middle', padding: 8, listening: false };
}

// ── latexBadgeCfg ─────────────────────────────────────────────────────────────
export function latexBadgeCfg(obj, ctx) {
  const L = ctx.live(obj); const w = L ? L.w : obj.width * ctx.vs, h = L ? L.h : obj.height * ctx.vs;
  return { x: -w / 2 + 4, y: -h / 2 + 4, text: 'TEX', fontSize: 9, fill: ctx.themeAccent, fontFamily: 'monospace', fontStyle: 'bold', listening: false };
}
