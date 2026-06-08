// Pure data/coordinate object Konva config builders.
// Each exported function takes (obj, ctx) where ctx is a StageCtx resolved-value object.
// No Vue refs, no reactive imports — all live values come through ctx.
import { isSafeExpr } from '../../../engine/mathExpr.js';
import { generateDotGridPositions } from '../../../engine/geometry.js';
import type { SceneObject } from '@manim/codegen';
import type { StageCtx } from './context.js';

export function groupCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const p = L ? { x: L.x, y: L.y } : ctx.s2c(e.x ?? 0, e.y ?? 0);
  const rot = L ? L.rotation : e.rotation || 0;
  return {
    x: p.x,
    y: p.y,
    rotation: rot,
    opacity: e.opacity ?? 1,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
  };
}

export function dotGridDots(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const sp = ((obj.dotSpacing as number | undefined) || 40) * ctx.vs,
    r = Math.max(2, ((obj.dotRadius as number | undefined) || 5) * ctx.vs);
  return generateDotGridPositions(
    (obj.gridCols as number | undefined) || 5,
    (obj.gridRows as number | undefined) || 5,
    sp
  ).map((p) => ({
    x: p.x,
    y: p.y,
    radius: r,
    fill: (obj.fill as string | undefined) || '#fff',
    listening: false,
  }));
}

// Transparent rect spanning the dot grid — the group's hit area, so the whole
// grid (not just the tiny dots) can be selected/dragged on the canvas.
export function dotGridHitCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const sp = ((obj.dotSpacing as number | undefined) || 40) * ctx.vs,
    r = Math.max(2, ((obj.dotRadius as number | undefined) || 5) * ctx.vs);
  const pts = generateDotGridPositions(
    (obj.gridCols as number | undefined) || 5,
    (obj.gridRows as number | undefined) || 5,
    sp
  );
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) {
    minX = minY = maxX = maxY = 0;
  }
  return {
    x: minX - r,
    y: minY - r,
    width: maxX - minX + 2 * r,
    height: maxY - minY + 2 * r,
    fill: 'rgba(0,0,0,0.01)',
    listening: true,
  };
}

export function imageCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const L = ctx.live(obj);
  const e = ctx.eff(obj);
  const ew = e.width as number,
    eh = e.height as number;
  const p = L ? { x: L.x, y: L.y } : ctx.s2c((e.x ?? 0) - ew / 2, (e.y ?? 0) - eh / 2);
  const w = L ? L.w : ew * ctx.vs,
    h = L ? L.h : eh * ctx.vs,
    rot = L ? L.rotation : e.rotation || 0;
  const imgMap = ctx.imageElements as
    | Record<string, HTMLImageElement>
    | Map<string, HTMLImageElement>;
  const assetId = obj.assetId as string | undefined;
  const image = imgMap instanceof Map ? imgMap.get(assetId ?? '') : imgMap[assetId ?? ''];
  return {
    x: p.x,
    y: p.y,
    width: w,
    height: h,
    image,
    opacity: e.opacity ?? 1,
    rotation: rot,
    scaleX: 1,
    scaleY: 1,
    draggable: ctx.activeTool === 'select',
    id: obj.id,
    name: 'stageObject',
  };
}

// ── Matrix config ──
export function matrixHitCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 160) * ctx.vs;
  const h = ((obj.height as number | undefined) || 120) * ctx.vs;
  // listening:true → group hit area so the matrix can be selected/dragged
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: 'rgba(76,238,249,0.04)',
    stroke: ctx.themeAccent,
    strokeWidth: 1,
    dash: [6, 4],
    cornerRadius: 4,
    listening: true,
  };
}

export function matrixCellConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const rawData = obj.matrixData as string[][] | undefined;
  const data: string[][] =
    Array.isArray(rawData) && rawData.length
      ? rawData
      : [
          ['1', '0'],
          ['0', '1'],
        ];
  const rows = data.length,
    cols = data[0]?.length || 1;
  const w = ((obj.width as number | undefined) || 160) * ctx.vs,
    h = ((obj.height as number | undefined) || 120) * ctx.vs;
  const padX = 0.18 * w,
    padY = 0.12 * h;
  const cellW = cols > 1 ? (w - 2 * padX) / (cols - 1) : 0;
  const cellH = rows > 1 ? (h - 2 * padY) / (rows - 1) : 0;
  const out: Record<string, unknown>[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = cols > 1 ? -w / 2 + padX + c * cellW : 0;
      const cy = rows > 1 ? -h / 2 + padY + r * cellH : 0;
      out.push({
        x: cx - 16,
        y: cy - 8,
        width: 32,
        text: String(data[r][c]),
        align: 'center',
        fontSize: Math.max(10, 16 * ctx.vs),
        fill: (obj.fill as string | undefined) || '#ffffff',
        listening: false,
      });
    }
  }
  return out;
}

export function matrixBracketConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const w = ((obj.width as number | undefined) || 160) * ctx.vs,
    h = ((obj.height as number | undefined) || 120) * ctx.vs;
  const bx = 0.4 * w,
    top = -h / 2 + 0.04 * h,
    bot = h / 2 - 0.04 * h,
    tick = 0.06 * w;
  const col = (obj.fill as string | undefined) || '#ffffff';
  if ((obj.bracket as string | undefined) === '|') {
    return [
      { points: [-bx, top, -bx, bot], stroke: col, strokeWidth: 2, listening: false },
      { points: [bx, top, bx, bot], stroke: col, strokeWidth: 2, listening: false },
    ];
  }
  const left = [-bx + tick, top, -bx, top, -bx, bot, -bx + tick, bot];
  const right = [bx - tick, top, bx, top, bx, bot, bx - tick, bot];
  return [
    { points: left, stroke: col, strokeWidth: 2, listening: false },
    { points: right, stroke: col, strokeWidth: 2, listening: false },
  ];
}

// ── Table config ──
export function tableHitCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 200) * ctx.vs;
  const h = ((obj.height as number | undefined) || 140) * ctx.vs;
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: 'rgba(76,238,249,0.04)',
    stroke: ctx.themeAccent,
    strokeWidth: 1,
    dash: [6, 4],
    cornerRadius: 4,
    listening: true,
  };
}

export function tableCellConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const rawData = obj.cellData as string[][] | undefined;
  const data: string[][] =
    Array.isArray(rawData) && rawData.length
      ? rawData
      : [
          ['1', '2'],
          ['3', '4'],
        ];
  const rows = data.length,
    cols = data[0]?.length || 1;
  const rowLabels = obj.rowLabels as unknown[] | undefined;
  const colLabels = obj.colLabels as unknown[] | undefined;
  const hasRowLabels = Array.isArray(rowLabels) && rowLabels.length > 0;
  const hasColLabels = Array.isArray(colLabels) && colLabels.length > 0;
  const w = ((obj.width as number | undefined) || 200) * ctx.vs,
    h = ((obj.height as number | undefined) || 140) * ctx.vs;
  const labelColW = hasRowLabels ? w * 0.18 : 0;
  const labelRowH = hasColLabels ? h * 0.16 : 0;
  const gridW = w - labelColW,
    gridH = h - labelRowH;
  const cellW = cols > 0 ? gridW / cols : gridW;
  const cellH = rows > 0 ? gridH / rows : gridH;
  const gridX = -w / 2 + labelColW,
    gridY = -h / 2 + labelRowH;
  const fs = Math.max(9, 13 * ctx.vs);
  const col = (obj.fill as string | undefined) || '#ffffff';
  const out: Record<string, unknown>[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: gridX + c * cellW,
        y: gridY + r * cellH,
        width: cellW,
        height: cellH,
        text: String(data[r][c]),
        align: 'center',
        verticalAlign: 'middle',
        fontSize: fs,
        fill: col,
        listening: false,
      });
    }
  }
  if (hasRowLabels && rowLabels) {
    for (let r = 0; r < rows; r++) {
      const lbl = rowLabels[r] != null ? String(rowLabels[r]) : '';
      out.push({
        x: -w / 2,
        y: gridY + r * cellH,
        width: labelColW,
        height: cellH,
        text: lbl,
        align: 'center',
        verticalAlign: 'middle',
        fontSize: fs,
        fill: ctx.themeAccent,
        fontStyle: 'italic',
        listening: false,
      });
    }
  }
  if (hasColLabels && colLabels) {
    for (let c = 0; c < cols; c++) {
      const lbl = colLabels[c] != null ? String(colLabels[c]) : '';
      out.push({
        x: gridX + c * cellW,
        y: -h / 2,
        width: cellW,
        height: labelRowH,
        text: lbl,
        align: 'center',
        verticalAlign: 'middle',
        fontSize: fs,
        fill: ctx.themeAccent,
        fontStyle: 'italic',
        listening: false,
      });
    }
  }
  return out;
}

export function tableGridLines(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const rawData = obj.cellData as string[][] | undefined;
  const data: string[][] =
    Array.isArray(rawData) && rawData.length
      ? rawData
      : [
          ['1', '2'],
          ['3', '4'],
        ];
  const rows = data.length,
    cols = data[0]?.length || 1;
  const rowLabels = obj.rowLabels as unknown[] | undefined;
  const colLabels = obj.colLabels as unknown[] | undefined;
  const hasRowLabels = Array.isArray(rowLabels) && rowLabels.length > 0;
  const hasColLabels = Array.isArray(colLabels) && colLabels.length > 0;
  const w = ((obj.width as number | undefined) || 200) * ctx.vs,
    h = ((obj.height as number | undefined) || 140) * ctx.vs;
  const labelColW = hasRowLabels ? w * 0.18 : 0;
  const labelRowH = hasColLabels ? h * 0.16 : 0;
  const gridW = w - labelColW,
    gridH = h - labelRowH;
  const cellW = cols > 0 ? gridW / cols : gridW;
  const cellH = rows > 0 ? gridH / rows : gridH;
  const gridX = -w / 2 + labelColW,
    gridY = -h / 2 + labelRowH;
  const col = (obj.stroke as string | undefined) || '#4ceef9';
  const sw = Math.max(0.5, ctx.vs);
  const lines: Record<string, unknown>[] = [];
  for (let r = 0; r <= rows; r++) {
    const y = gridY + r * cellH;
    lines.push({
      points: [gridX, y, gridX + gridW, y],
      stroke: col,
      strokeWidth: sw,
      opacity: 0.4,
      listening: false,
    });
  }
  for (let c = 0; c <= cols; c++) {
    const x = gridX + c * cellW;
    lines.push({
      points: [x, gridY, x, gridY + gridH],
      stroke: col,
      strokeWidth: sw,
      opacity: 0.4,
      listening: false,
    });
  }
  return lines;
}

// ── PolarPlane config ──
export function polarCircleConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const rMaxRaw = obj.radiusMax as number | undefined;
  const rStepRaw = obj.radiusStep as number | undefined;
  const rMax = Number.isFinite(rMaxRaw) && (rMaxRaw as number) > 0 ? (rMaxRaw as number) : 4;
  const rStep = Number.isFinite(rStepRaw) && (rStepRaw as number) > 0 ? (rStepRaw as number) : 1;
  const halfSize =
    (Math.min((obj.width as number | undefined) || 400, (obj.height as number | undefined) || 400) /
      2) *
    ctx.vs;
  const rings = Math.floor(rMax / rStep);
  const col = (obj.stroke as string | undefined) || '#64748b';
  const sw = Math.max(0.5, ctx.vs);
  const configs: Record<string, unknown>[] = [];
  for (let i = 1; i <= rings; i++) {
    const r = ((i * rStep) / rMax) * halfSize;
    configs.push({
      x: 0,
      y: 0,
      radius: r,
      stroke: col,
      strokeWidth: sw,
      fill: 'transparent',
      opacity: 0.6,
      listening: false,
    });
  }
  return configs;
}

export function polarSpokeConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const azRaw = obj.azimuthUnits as number | undefined;
  const az = Number.isFinite(azRaw) && (azRaw as number) >= 1 ? Math.trunc(azRaw as number) : 12;
  const halfSize =
    (Math.min((obj.width as number | undefined) || 400, (obj.height as number | undefined) || 400) /
      2) *
    ctx.vs;
  const col = (obj.stroke as string | undefined) || '#64748b';
  const sw = Math.max(0.5, ctx.vs);
  const configs: Record<string, unknown>[] = [];
  for (let i = 0; i < az; i++) {
    const angle = (i / az) * 2 * Math.PI;
    const ex = Math.cos(angle) * halfSize;
    const ey = Math.sin(angle) * halfSize;
    configs.push({
      points: [0, 0, ex, ey],
      stroke: col,
      strokeWidth: sw,
      opacity: 0.6,
      listening: false,
    });
  }
  return configs;
}

// ── Graph / DiGraph config ──
export function graphHitCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 200) * ctx.vs,
    h = ((obj.height as number | undefined) || 200) * ctx.vs;
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: 'rgba(76,238,249,0.04)',
    stroke: ctx.themeAccent,
    strokeWidth: 1,
    dash: [6, 4],
    cornerRadius: 4,
    listening: true,
  };
}

export function graphEdgeConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const z = ctx.vs;
  const pos = (obj.positions as Record<string, [number, number]>) || {};
  const col = (obj.stroke as string | undefined) || '#94a3b8';
  const sw = Math.max(1.5, 2 * z);
  const ptSize = 8 * z;
  const configs: Record<string, unknown>[] = [];
  const edges = (obj.edges as [string, string][] | undefined) || [];
  for (const [a, b] of edges) {
    const pa = pos[a],
      pb = pos[b];
    if (!pa || !pb) continue;
    const ax = pa[0] * z,
      ay = pa[1] * z,
      bx = pb[0] * z,
      by = pb[1] * z;
    if (obj.directed as boolean | undefined) {
      // shorten end point so arrowhead doesn't overlap the vertex circle
      const dx = bx - ax,
        dy = by - ay,
        len = Math.hypot(dx, dy) || 1;
      const ex = bx - (dx / len) * ptSize,
        ey = by - (dy / len) * ptSize;
      configs.push({
        points: [ax, ay, ex, ey],
        stroke: col,
        strokeWidth: sw,
        fill: col,
        pointerLength: 8 * z,
        pointerWidth: 6 * z,
        lineCap: 'round',
        listening: false,
      });
    } else {
      configs.push({
        points: [ax, ay, bx, by],
        stroke: col,
        strokeWidth: sw,
        lineCap: 'round',
        listening: false,
      });
    }
  }
  return configs;
}

export function graphVertexConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const z = ctx.vs;
  const pos = (obj.positions as Record<string, [number, number]>) || {};
  const col = (obj.fill as string | undefined) || '#4ceef9';
  const strokeCol = (obj.stroke as string | undefined) || '#94a3b8';
  const r = 8 * z;
  return Object.keys(pos).map((k) => ({
    x: pos[k][0] * z,
    y: pos[k][1] * z,
    radius: r,
    fill: col,
    stroke: strokeCol,
    strokeWidth: Math.max(1, 1.5 * z),
    listening: false,
  }));
}

export function graphLabelConfigs(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const z = ctx.vs;
  const pos = (obj.positions as Record<string, [number, number]>) || {};
  const fs = Math.max(10, 13 * z);
  return Object.keys(pos).map((k) => ({
    x: pos[k][0] * z - 12,
    y: pos[k][1] * z - 10 - 8 * z,
    width: 24,
    text: k,
    align: 'center',
    fontSize: fs,
    fill: (obj.fill as string | undefined) || '#ffffff',
    listening: false,
  }));
}

// ── Vector Field config ──
export function vectorFieldHitCfg(obj: SceneObject, ctx: StageCtx): Record<string, unknown> {
  const w = ((obj.width as number | undefined) || 600) * ctx.vs,
    h = ((obj.height as number | undefined) || 400) * ctx.vs;
  return {
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    fill: 'rgba(56,189,248,0.04)',
    stroke: ctx.themeAccent,
    strokeWidth: 1,
    dash: [6, 4],
    cornerRadius: 4,
    listening: true,
  };
}

function _compileField2(expr: string): ((x: number, y: number) => number) | null {
  // compile expr(x,y) using the same SCOPE as compileExpr but with two variables
  const SCOPE2 =
    'const np={sin:Math.sin,cos:Math.cos,tan:Math.tan,arcsin:Math.asin,arccos:Math.acos,' +
    'arctan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,log:Math.log,sign:Math.sign,' +
    'power:Math.pow,floor:Math.floor,ceil:Math.ceil,pi:Math.PI,e:Math.E};' +
    'const PI=Math.PI,TAU=2*Math.PI,E=Math.E;';
  try {
    const fn = new Function('x', 'y', '"use strict";' + SCOPE2 + 'return (' + expr + ');') as (
      x: number,
      y: number
    ) => unknown;
    const probe = fn(1, 1);
    if (typeof probe !== 'number') return null;
    return fn as (x: number, y: number) => number;
  } catch {
    return null;
  }
}

export function vectorFieldArrows(obj: SceneObject, ctx: StageCtx): Record<string, unknown>[] {
  const z = ctx.vs;
  const xr = Array.isArray(obj.xRange) ? (obj.xRange as number[]) : [-3, 3, 1];
  const yr = Array.isArray(obj.yRange) ? (obj.yRange as number[]) : [-2, 2, 1];
  const xMin = xr[0],
    xMax = xr[1],
    yMin = yr[0],
    yMax = yr[1];
  const fxExpr = isSafeExpr(obj.fx) ? String(obj.fx).trim() : 'y';
  const fyExpr = isSafeExpr(obj.fy) ? String(obj.fy).trim() : '-x';
  const fxFn = _compileField2(fxExpr);
  const fyFn = _compileField2(fyExpr);
  if (!fxFn || !fyFn) return [];
  const GRID = 8;
  // unit: canvas px per Manim unit
  const ow = (obj.width as number | undefined) || 600;
  const oh = (obj.height as number | undefined) || 400;
  const unitX = (ow * z) / (xMax - xMin || 1);
  const unitY = (oh * z) / (yMax - yMin || 1);
  const arrowLen = Math.min(unitX, unitY) * 0.55;
  const configs: Record<string, unknown>[] = [];
  const col = (obj.stroke as string | undefined) || '#38bdf8';
  const sw2 = Math.max(1, (((obj.strokeWidth as number | undefined) || 2) * z) / 2);
  for (let ix = 0; ix < GRID; ix++) {
    for (let iy = 0; iy < GRID; iy++) {
      const gx = xMin + ((ix + 0.5) / GRID) * (xMax - xMin);
      const gy = yMin + ((iy + 0.5) / GRID) * (yMax - yMin);
      const vx = fxFn(gx, gy),
        vy = fyFn(gx, gy);
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) continue;
      const mag = Math.sqrt(vx * vx + vy * vy);
      if (mag < 1e-12) continue;
      const nx = (vx / mag) * arrowLen,
        ny = (vy / mag) * arrowLen;
      // canvas coords: x maps right (+), y maps down (flip y)
      const cx = (-ow * z) / 2 + ((ix + 0.5) / GRID) * ow * z;
      const cy = (-oh * z) / 2 + ((iy + 0.5) / GRID) * oh * z;
      configs.push({
        points: [cx - nx / 2, cy + ny / 2, cx + nx / 2, cy - ny / 2],
        stroke: col,
        strokeWidth: sw2,
        fill: col,
        pointerLength: Math.max(4, arrowLen * 0.3),
        pointerWidth: Math.max(3, arrowLen * 0.25),
        opacity: (obj.opacity as number | undefined) ?? 1,
        listening: false,
      });
    }
  }
  return configs;
}
