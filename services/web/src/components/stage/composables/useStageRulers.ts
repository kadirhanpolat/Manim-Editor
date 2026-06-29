import { ref, watch } from 'vue';
import type { ComputedRef } from 'vue';

export const RULER_SIZE = 18; // px — width of vertical ruler / height of horizontal ruler

interface RulerDeps {
  vs: ComputedRef<number>;
  ox: ComputedRef<number>;
  oy: ComputedRef<number>;
  stageW: ComputedRef<number>;
  stageH: ComputedRef<number>;
}

function pickTickInterval(vs: number): number {
  const candidates = [10, 25, 50, 100, 200, 500, 1000];
  for (const c of candidates) {
    if (c * vs >= 40) return c;
  }
  return 1000;
}

function drawHRuler(canvas: HTMLCanvasElement, vs: number, ox: number, stageW: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  const interval = pickTickInterval(vs);
  const startPx = Math.floor(-ox / vs / interval) * interval;

  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';

  for (let px = startPx; px < startPx + stageW / vs + interval * 2; px += interval) {
    const cx = ox + px * vs;
    if (cx < RULER_SIZE || cx > W) continue;
    ctx.fillRect(cx, H - 5, 1, 5);
    ctx.fillText(String(Math.round(px)), cx, H - 7);
  }
}

function drawVRuler(canvas: HTMLCanvasElement, vs: number, oy: number, stageH: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  const interval = pickTickInterval(vs);
  const startPy = Math.floor(-oy / vs / interval) * interval;

  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';

  for (let py = startPy; py < startPy + stageH / vs + interval * 2; py += interval) {
    const cy = oy + py * vs;
    if (cy < RULER_SIZE || cy > H) continue;
    ctx.fillRect(W - 5, cy, 5, 1);
    ctx.save();
    ctx.translate(W - 7, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(String(Math.round(py)), 0, 0);
    ctx.restore();
  }
}

export function useStageRulers(deps: RulerDeps) {
  const hRulerRef = ref<HTMLCanvasElement | null>(null);
  const vRulerRef = ref<HTMLCanvasElement | null>(null);

  function redraw() {
    const h = hRulerRef.value;
    const v = vRulerRef.value;
    if (h) drawHRuler(h, deps.vs.value, deps.ox.value, deps.stageW.value);
    if (v) drawVRuler(v, deps.vs.value, deps.oy.value, deps.stageH.value);
  }

  watch([deps.vs, deps.ox, deps.oy], redraw);

  return { hRulerRef, vRulerRef, RULER_SIZE, redraw };
}
