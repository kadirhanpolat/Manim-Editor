// Pure text / counter / latex Konva config builders.
// Each function takes (obj, ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.
import { latexToUnicode } from '../../../utils/latexPreview.js';
import type { SceneObject } from '@manim/codegen';
import type { StageCtx } from './context.js';

// Module-level canvas used for text measurement (lazy-initialised).
let _measureCanvas: HTMLCanvasElement | null = null;
let _measureCtx: CanvasRenderingContext2D | null = null;

// ── measureTextWidth ──────────────────────────────────────────────────────────
// Pure function — no ctx needed; uses an offscreen canvas.
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontStyle: string
): number {
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
export function counterText(obj: SceneObject, ctx: StageCtx): string {
  const ov = ctx.frameState.objectOverrides[obj.id] as Record<string, unknown> | undefined;
  const raw = ov && 'value' in ov ? (ov.value as number) : ((obj.value as number | undefined) ?? 0);
  const numDecimalsRaw = obj.numDecimals as number | undefined;
  const dec = Number.isFinite(numDecimalsRaw)
    ? Math.max(0, Math.trunc(numDecimalsRaw as number))
    : 0;
  return raw.toFixed(dec) + ((obj.suffix as string | undefined) || '');
}

// ── textCfg ───────────────────────────────────────────────────────────────────
export function textCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  // Match Manim Text font_size: at 1080p, font_size N ≈ N px; scale by vs for stage→canvas
  const manimFontScale = ((e.fontSize as number | undefined) || 48) * ctx.vs;
  const fontFamily = (e.fontFamily as string | undefined) || 'Arial';
  const fontStyle =
    ((e.fontWeight as string | undefined) === 'bold' ? 'bold ' : '') +
    ((e.fontStyle as string | undefined) === 'italic' ? 'italic ' : '');
  const rawContent = (e.content as string | undefined) || 'Text';
  const ov = ctx.frameState.objectOverrides[obj.id] as Record<string, unknown> | undefined;
  const twFrac = ov && ov._typewriter !== undefined ? (ov._typewriter as number) : null;
  const text =
    twFrac !== null
      ? rawContent.slice(
          0,
          Math.max(0, Math.min(rawContent.length, Math.round(rawContent.length * twFrac)))
        )
      : rawContent;
  const align = (e.textAlign as string | undefined) || 'center';
  const textWidth = measureTextWidth(text, manimFontScale, fontFamily, fontStyle);
  let offsetX = 0;
  if (align === 'center') offsetX = textWidth / 2;
  else if (align === 'right') offsetX = textWidth;
  const rot = L ? L.rotation : e.rotation || 0;
  return {
    x: p.x,
    y: p.y,
    text,
    fontSize: manimFontScale,
    fontFamily,
    fontStyle: fontStyle.trim(),
    fill: e.fill || '#ffffff',
    opacity: e.opacity ?? 1,
    rotation: rot,
    offsetX,
    offsetY: manimFontScale / 2,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
}

// ── counterCfg ────────────────────────────────────────────────────────────────
export function counterCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const fontSize =
    ((e.fontSize as number | undefined) || (e.height as number | undefined) || 48) * ctx.vs;
  const text = counterText(obj, ctx);
  const textWidth = measureTextWidth(text, fontSize, 'Arial', '');
  const rot = L ? L.rotation : e.rotation || 0;
  return {
    x: p.x,
    y: p.y,
    text,
    fontSize,
    fontFamily: 'Arial',
    fontStyle: '',
    fill: e.fill || '#ffffff',
    opacity: e.opacity ?? 1,
    rotation: rot,
    offsetX: textWidth / 2,
    offsetY: fontSize / 2,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
    hitStrokeWidth: 10,
  };
}

// ── code block (monospace preview; NO syntax highlighting — documented divergence:
//    the render uses real Pygments highlighting + add_line_numbers=False) ──────
export function codeBgCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 480) * ctx.vs;
  const h = ((obj.height as number | undefined) || 280) * ctx.vs;
  // listening:true → this rect is the group's hit area (select/drag), like latexBgCfg
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: '#1e1e2e',
    stroke: ctx.themeAccent,
    strokeWidth: 1,
    cornerRadius: 6,
    opacity: (obj.opacity as number | undefined) ?? 1,
    listening: true,
  };
}

export function codeTextCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 480) * ctx.vs;
  const h = ((obj.height as number | undefined) || 280) * ctx.vs;
  const fontSize = Math.max(8, ((obj.fontSize as number | undefined) || 18) * ctx.vs);
  return {
    x: -w / 2 + 12 * ctx.vs,
    y: -h / 2 + 10 * ctx.vs,
    width: w - 24 * ctx.vs,
    text: (obj.codeText as string | undefined) || '',
    fontSize,
    fontFamily: 'monospace',
    lineHeight: 1.4,
    fill: '#e2e8f0',
    opacity: (obj.opacity as number | undefined) ?? 1,
    wrap: 'none',
    listening: false,
  };
}

// ── latexBgCfg ────────────────────────────────────────────────────────────────
export function latexBgCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const ow = obj.width as number,
    oh = obj.height as number;
  const w = L ? L.w : ow * ctx.vs,
    h = L ? L.h : oh * ctx.vs;
  // listening:true → this rect is the group's hit area so the LaTeX box can be
  // selected/dragged on the canvas (the text/badge stay non-listening).
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: 'rgba(76,238,249,0.06)',
    stroke: ctx.themeAccent,
    strokeWidth: 1.5,
    dash: [6, 4],
    cornerRadius: 6,
    listening: true,
  };
}

// ── latexTextCfg ──────────────────────────────────────────────────────────────
export function latexTextCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const ow = obj.width as number,
    oh = obj.height as number;
  const w = L ? L.w : ow * ctx.vs,
    h = L ? L.h : oh * ctx.vs;
  // Approximate Unicode preview of the raw LaTeX (Manim does the real MathTex).
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    text: latexToUnicode((obj.latex as string | undefined) || 'E = mc^2'),
    fontSize: Math.max(12, 18 * ctx.vs),
    fontFamily: 'serif',
    fontStyle: 'italic',
    fill: (obj.fill as string | undefined) || '#ffffff',
    align: 'center',
    verticalAlign: 'middle',
    padding: 8,
    listening: false,
  };
}

// ── latexBadgeCfg ─────────────────────────────────────────────────────────────
export function latexBadgeCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const ow = obj.width as number,
    oh = obj.height as number;
  const w = L ? L.w : ow * ctx.vs,
    h = L ? L.h : oh * ctx.vs;
  return {
    x: -w / 2 + 4,
    y: -h / 2 + 4,
    text: 'TEX',
    fontSize: 9,
    fill: ctx.themeAccent,
    fontFamily: 'monospace',
    fontStyle: 'bold',
    listening: false,
  };
}
