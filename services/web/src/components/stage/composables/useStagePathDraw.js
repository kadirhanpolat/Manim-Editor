import { ref, computed } from 'vue';

export function useStagePathDraw(store, deps) {
  const { s2c, iso, projCx, projCy, proj3DScale } = deps;

  // ── State ──
  const pathDrawing = ref(false);
  const pathPoints = ref([]);
  const pathSourceId = ref(null);

  // ── Computeds ──
  const pathCanvasPoints = computed(() => {
    if (!pathPoints.value.length) return [];
    return pathPoints.value.map((p) => {
      if ('x3d' in p) {
        const t = iso(p.x3d, p.y3d ?? 0, p.z3d, projCx.value, projCy.value, proj3DScale.value);
        return { cx: t.px, cy: t.py }; // iso() returns canvas px — no s2c
      }
      const cp = s2c(p.x, p.y);
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
  function startPathDraw(sourceId) {
    pathDrawing.value = true;
    pathPoints.value = [];
    pathSourceId.value = sourceId;
  }

  function onStageDblClick(e) {
    if (!pathDrawing.value) return;
    if (pathPoints.value.length >= 2) {
      store.addPathMoveClip(pathSourceId.value, [...pathPoints.value]);
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
