import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import { project3D, unprojectIso } from '../../../engine/projection3d.js';
import type { Cam3D } from '../../../engine/types.js';
import { useProjectStore } from '../../../store/project.js';

// The store exposes `frameState` with an optional `cameraState` at runtime
// (set by the playback engine). The store-local FrameState interface omits
// cameraState intentionally; access it via this helper.
interface LiveCameraState {
  is3d?: boolean;
  x?: number;
  y?: number;
  zoom?: number;
  phi?: number;
  theta?: number;
}

type ProjectStore = ReturnType<typeof useProjectStore>;

function getCs(store: ProjectStore): LiveCameraState | null {
  return store.frameState.cameraState ?? null;
}

export function useStageViewport(store: ProjectStore, container: Ref<HTMLElement | null>) {
  // ── Reactive state ──
  const containerWidth = ref(800);
  const containerHeight = ref(500);
  const panOffset = ref({ x: 0, y: 0 });
  const zoomLevel = ref(1);

  // ── Stage ──
  const stg = computed(() => store.project.stage);

  // ── Computeds ──
  const vs = computed(() => {
    const sx = containerWidth.value / stg.value.width;
    const sy = containerHeight.value / stg.value.height;
    const base = Math.min(sx, sy, 1) * 0.92 * zoomLevel.value;
    const cs = getCs(store);
    return cs && !cs.is3d && cs.zoom ? base * cs.zoom : base;
  });
  const ox = computed(() => {
    const cs = getCs(store);
    const camX = cs && !cs.is3d ? (cs.x ?? stg.value.width / 2) : stg.value.width / 2;
    return containerWidth.value / 2 - camX * vs.value + panOffset.value.x;
  });
  const oy = computed(() => {
    const cs = getCs(store);
    const camY = cs && !cs.is3d ? (cs.y ?? stg.value.height / 2) : stg.value.height / 2;
    return containerHeight.value / 2 - camY * vs.value + panOffset.value.y;
  });

  const stageConfig = computed(() => ({
    width: containerWidth.value,
    height: containerHeight.value,
  }));

  const is3D = computed(() => store.project?.sceneType === '3d');

  // Fixed orthographic angles for the named axis views (Z-up convention).
  const VIEW_ANGLES: Record<string, { phi: number; theta: number }> = {
    top: { phi: 0, theta: -90 }, // look down +Z onto XY (X right, Y up)
    bottom: { phi: 180, theta: -90 }, // look up
    front: { phi: 90, theta: -90 }, // XZ plane (X right, Z up)
    back: { phi: 90, theta: 90 },
    right: { phi: 90, theta: 0 }, // YZ plane (Y right, Z up)
    left: { phi: 90, theta: 180 },
  };

  const cam3d = computed((): Cam3D & Record<string, unknown> => {
    const base = (store.project?.camera3d ?? {}) as Partial<{
      zoom: number;
      focalDistance: number;
      view: string;
      phi: number;
      theta: number;
    }>;
    const zoom = base.zoom ?? 1;
    const fd = base.focalDistance ?? 8;
    const cs = getCs(store);
    // Playback camera_move (3D) drives an animated perspective camera.
    if (cs && cs.is3d) {
      return {
        phi: cs.phi,
        theta: cs.theta,
        zoom: cs.zoom ?? zoom,
        mode: 'perspective',
        focalDistance: fd,
      };
    }
    const view = base.view ?? 'perspective';
    if (view === 'perspective') {
      return {
        phi: base.phi ?? 75,
        theta: base.theta ?? -45,
        zoom,
        mode: 'perspective',
        focalDistance: fd,
      };
    }
    const a = VIEW_ANGLES[view] ?? VIEW_ANGLES['top']!;
    return { phi: a.phi, theta: a.theta, zoom, mode: 'orthographic', focalDistance: fd };
  });

  // Single-canvas 3D viewport — centered on the visible black backdrop (ox/oy/vs).
  const proj3DScale = computed(() => (Math.min(stg.value.width, stg.value.height) * vs.value) / 12);
  const projCx = computed(() => ox.value + (stg.value.width * vs.value) / 2);
  const projCy = computed(() => oy.value + (stg.value.height * vs.value) / 2);

  // ── 3D Projection ──────────────────────────────────────────────────────────
  function iso(
    x3d: number,
    y3d: number,
    z3d: number,
    cx?: number,
    cy?: number,
    scale?: number
  ): { px: number; py: number } {
    return project3D(
      { x3d, y3d, z3d },
      cam3d.value,
      cx ?? projCx.value,
      cy ?? projCy.value,
      scale ?? proj3DScale.value
    );
  }

  // ── Theme helpers ──
  function getCssVar(name: string): string {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    } catch {
      return '';
    }
  }
  const themeAccent = computed(() => getCssVar('--studio-accent') || '#4CEEF9');
  const themeSurface = computed(() => getCssVar('--studio-text') || '#E6EDF3');

  // ── Size / coordinate helpers ──
  function updateSize(): void {
    if (container.value) {
      containerWidth.value = container.value.clientWidth;
      containerHeight.value = container.value.clientHeight;
    }
  }
  function s2c(sx: number, sy: number): { x: number; y: number } {
    return { x: ox.value + sx * vs.value, y: oy.value + sy * vs.value };
  }
  function c2s(cx: number, cy: number): { x: number; y: number } {
    return { x: (cx - ox.value) / vs.value, y: (cy - oy.value) / vs.value };
  }

  // ── 3D unproject helpers ──
  const _r3 = (v: number): number => parseFloat(v.toFixed(3));

  function unprojectView(
    px: number,
    py: number,
    obj?: Partial<{ x3d: number; y3d: number; z3d: number }>
  ): Record<string, number> {
    const c = cam3d.value;
    const view = (store.project.camera3d as Partial<{ view: string }>)?.view ?? 'perspective';
    const cs = getCs(store);
    if (view === 'perspective' || (cs && cs.is3d)) {
      const r = unprojectIso(
        px,
        py,
        c,
        projCx.value,
        projCy.value,
        proj3DScale.value,
        obj?.y3d ?? 0
      );
      const patch: Record<string, number> = {};
      if (r.x3d !== null) patch['x3d'] = _r3(r.x3d);
      if (r.z3d !== null) patch['z3d'] = _r3(r.z3d);
      return patch;
    }
    const s = proj3DScale.value * (c.zoom ?? 1);
    const sx = (px - projCx.value) / s;
    const sy = (projCy.value - py) / s; // +screen up
    switch (view) {
      case 'top':
        return { x3d: _r3(sx), y3d: _r3(sy) };
      case 'bottom':
        return { x3d: _r3(sx), y3d: _r3(-sy) };
      case 'front':
        return { x3d: _r3(sx), z3d: _r3(sy) };
      case 'back':
        return { x3d: _r3(-sx), z3d: _r3(sy) };
      case 'right':
        return { y3d: _r3(sx), z3d: _r3(sy) };
      case 'left':
        return { y3d: _r3(-sx), z3d: _r3(sy) };
      default:
        return { x3d: _r3(sx), y3d: _r3(sy) };
    }
  }

  // ── Pan / zoom event handlers ──
  function startPan(e: { evt: MouseEvent }): void {
    const start = {
      x: e.evt.clientX - panOffset.value.x,
      y: e.evt.clientY - panOffset.value.y,
    };
    const onM = (ev: MouseEvent) => {
      panOffset.value = { x: ev.clientX - start.x, y: ev.clientY - start.y };
    };
    const onU = () => {
      document.removeEventListener('mousemove', onM);
      document.removeEventListener('mouseup', onU);
    };
    document.addEventListener('mousemove', onM);
    document.addEventListener('mouseup', onU);
  }
  function handleWheel(e: { evt: WheelEvent }): void {
    e.evt.preventDefault();
    const factor = e.evt.deltaY > 0 ? 0.93 : 1.07;
    zoomLevel.value = Math.max(0.15, Math.min(5, zoomLevel.value * factor));
  }

  return {
    // State
    containerWidth,
    containerHeight,
    panOffset,
    zoomLevel,
    // Stage
    stg,
    // Computeds
    vs,
    ox,
    oy,
    stageConfig,
    is3D,
    cam3d,
    proj3DScale,
    projCx,
    projCy,
    // 3D projection functions
    iso,
    // Coordinate helpers
    s2c,
    c2s,
    // Theme
    themeAccent,
    themeSurface,
    // Size
    updateSize,
    // 3D unproject
    unprojectView,
    // Pan/zoom handlers
    startPan,
    handleWheel,
  };
}
