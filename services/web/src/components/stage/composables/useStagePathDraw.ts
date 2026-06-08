import { ref, computed } from 'vue';
import type { ComputedRef } from 'vue';
import type { PathPoint } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';

type ProjectStore = ReturnType<typeof useProjectStore>;

interface Deps {
  s2c: (px: number, py: number) => { x: number; y: number };
  iso: (
    x3d: number,
    y3d: number,
    z3d: number,
    cx?: number,
    cy?: number,
    scale?: number
  ) => { px: number; py: number };
  projCx: ComputedRef<number>;
  projCy: ComputedRef<number>;
  proj3DScale: ComputedRef<number>;
}

export function useStagePathDraw(store: ProjectStore, deps: Deps) {
  const { s2c, iso, projCx, projCy, proj3DScale } = deps;

  // ── State ──
  const pathDrawing = ref(false);
  const pathPoints = ref<PathPoint[]>([]);
  const pathSourceId = ref<string | null>(null);

  // ── Computeds ──
  const pathCanvasPoints = computed(() => {
    if (!pathPoints.value.length) return [];
    return pathPoints.value.map((p) => {
      if ('x3d' in p) {
        const t = iso(
          p.x3d ?? 0,
          p.y3d ?? 0,
          p.z3d ?? 0,
          projCx.value,
          projCy.value,
          proj3DScale.value
        );
        return { cx: t.px, cy: t.py }; // iso() returns canvas px — no s2c
      }
      const cp = s2c(p.x ?? 0, p.y ?? 0);
      return { cx: cp.x, cy: cp.y };
    });
  });

  const pathPreviewLineCfg = computed(() => {
    const pts = pathCanvasPoints.value.flatMap((p) => [p.cx, p.cy]);
    return {
      points: pts,
      stroke: '#a855f7',
      strokeWidth: 2,
      dash: [6, 3],
      listening: false,
    };
  });

  // ── Path draw ──
  function startPathDraw(sourceId: string): void {
    pathDrawing.value = true;
    pathPoints.value = [];
    pathSourceId.value = sourceId;
  }

  function onStageDblClick(_e: unknown): void {
    if (!pathDrawing.value) return;
    if (pathPoints.value.length >= 2) {
      store.addPathMoveClip(pathSourceId.value!, [...pathPoints.value]);
    }
    pathDrawing.value = false;
    pathPoints.value = [];
    pathSourceId.value = null;
  }

  return {
    pathDrawing,
    pathPoints,
    pathSourceId,
    pathCanvasPoints,
    pathPreviewLineCfg,
    startPathDraw,
    onStageDblClick,
  };
}
