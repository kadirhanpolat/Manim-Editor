import { ref, computed } from 'vue';
import { project3D, unprojectIso } from '../../../engine/projection3d.js';

export function useStageViewport(store, container) {
  // ── Reactive state ──
  const containerWidth = ref(800);
  const containerHeight = ref(500);
  const panOffset = ref({ x: 0, y: 0 });
  const zoomLevel = ref(1);

  // ── Stage ──
  const stg = computed(() => store.project.stage);

  // ── 3D Projection ──────────────────────────────────────────────────────────
  function iso(x3d, y3d, z3d, cx, cy, scale) {
    return project3D({ x3d, y3d, z3d }, cam3d.value, cx, cy, scale);
  }
  // Orthographic-forced projection (same phi/theta/zoom) for the faint reference
  // gizmo — keeps the axes a clean symmetric cross instead of the lopsided arms
  // perspective foreshortening produces. Perspective still applies to objects.
  function isoRef(x3d, y3d, z3d, cx, cy, scale) {
    const c = cam3d.value;
    return project3D({ x3d, y3d, z3d }, { phi: c.phi, theta: c.theta, zoom: c.zoom, mode: 'orthographic' }, cx, cy, scale);
  }

  // ── Computeds ──
  const vs = computed(() => {
    const sx = containerWidth.value / stg.value.width;
    const sy = containerHeight.value / stg.value.height;
    const base = Math.min(sx, sy, 1) * 0.92 * zoomLevel.value;
    const cs = store.frameState.cameraState;
    return (cs && !cs.is3d && cs.zoom) ? base * cs.zoom : base;
  });
  const ox = computed(() => {
    const cs = store.frameState.cameraState;
    const camX = (cs && !cs.is3d) ? cs.x : stg.value.width / 2;
    return containerWidth.value / 2 - camX * vs.value + panOffset.value.x;
  });
  const oy = computed(() => {
    const cs = store.frameState.cameraState;
    const camY = (cs && !cs.is3d) ? cs.y : stg.value.height / 2;
    return containerHeight.value / 2 - camY * vs.value + panOffset.value.y;
  });

  const stageConfig = computed(() => ({ width: containerWidth.value, height: containerHeight.value }));

  const is3D = computed(() => store.project?.sceneType === '3d');
  // Fixed orthographic angles for the named axis views (Z-up convention).
  const VIEW_ANGLES = {
    top:    { phi: 0,   theta: -90 },  // look down +Z onto XY (X right, Y up)
    bottom: { phi: 180, theta: -90 },  // look up
    front:  { phi: 90,  theta: -90 },  // XZ plane (X right, Z up)
    back:   { phi: 90,  theta: 90 },
    right:  { phi: 90,  theta: 0 },    // YZ plane (Y right, Z up)
    left:   { phi: 90,  theta: 180 },
  };
  const cam3d = computed(() => {
    const base = store.project?.camera3d ?? {};
    const zoom = base.zoom ?? 1, fd = base.focalDistance ?? 8;
    const cs = store.frameState.cameraState;
    // Playback camera_move (3D) drives an animated perspective camera.
    if (cs && cs.is3d) {
      return { phi: cs.phi, theta: cs.theta, zoom: cs.zoom ?? zoom, mode: 'perspective', focalDistance: fd };
    }
    const view = base.view ?? 'perspective';
    if (view === 'perspective') {
      return { phi: base.phi ?? 75, theta: base.theta ?? -45, zoom, mode: 'perspective', focalDistance: fd };
    }
    const a = VIEW_ANGLES[view] || VIEW_ANGLES.top;
    return { phi: a.phi, theta: a.theta, zoom, mode: 'orthographic', focalDistance: fd };
  });

  // Single-canvas 3D viewport — centered on the visible black backdrop (ox/oy/vs).
  const proj3DScale = computed(() => Math.min(stg.value.width, stg.value.height) * vs.value / 12);
  const projCx = computed(() => ox.value + stg.value.width * vs.value / 2);
  const projCy = computed(() => oy.value + stg.value.height * vs.value / 2);

  // ── Theme helpers ──
  function getCssVar(name) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch { return ''; }
  }
  const themeAccent = computed(() => getCssVar('--studio-accent') || '#4CEEF9');
  const themeSurface = computed(() => getCssVar('--studio-text') || '#E6EDF3');

  // ── Size / coordinate helpers ──
  function updateSize() {
    if (container.value) {
      containerWidth.value = container.value.clientWidth;
      containerHeight.value = container.value.clientHeight;
    }
  }
  function s2c(sx, sy) { return { x: ox.value + sx * vs.value, y: oy.value + sy * vs.value }; }
  function c2s(cx, cy) { return { x: (cx - ox.value) / vs.value, y: (cy - oy.value) / vs.value }; }

  // ── 3D unproject helpers ──
  const _r3 = (v) => parseFloat(v.toFixed(3));
  function unprojectView(px, py, obj) {
    const c = cam3d.value;
    const view = store.project.camera3d?.view ?? 'perspective';
    if (view === 'perspective' || (store.frameState.cameraState && store.frameState.cameraState.is3d)) {
      const r = unprojectIso(px, py, c, projCx.value, projCy.value, proj3DScale.value, obj?.y3d ?? 0);
      const patch = {};
      if (r.x3d !== null) patch.x3d = _r3(r.x3d);
      if (r.z3d !== null) patch.z3d = _r3(r.z3d);
      return patch;
    }
    const s = proj3DScale.value * (c.zoom || 1);
    const sx = (px - projCx.value) / s;
    const sy = (projCy.value - py) / s; // +screen up
    switch (view) {
      case 'top':    return { x3d: _r3(sx),  y3d: _r3(sy) };
      case 'bottom': return { x3d: _r3(sx),  y3d: _r3(-sy) };
      case 'front':  return { x3d: _r3(sx),  z3d: _r3(sy) };
      case 'back':   return { x3d: _r3(-sx), z3d: _r3(sy) };
      case 'right':  return { y3d: _r3(sx),  z3d: _r3(sy) };
      case 'left':   return { y3d: _r3(-sx), z3d: _r3(sy) };
      default:       return { x3d: _r3(sx),  y3d: _r3(sy) };
    }
  }

  // ── Pan / zoom event handlers ──
  function startPan(e) {
    const start = { x: e.evt.clientX - panOffset.value.x, y: e.evt.clientY - panOffset.value.y };
    const onM = (ev) => { panOffset.value = { x: ev.clientX - start.x, y: ev.clientY - start.y }; };
    const onU = () => { document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); };
    document.addEventListener('mousemove', onM); document.addEventListener('mouseup', onU);
  }
  function handleWheel(e) {
    e.evt.preventDefault();
    const factor = e.evt.deltaY > 0 ? 0.93 : 1.07;
    zoomLevel.value = Math.max(0.15, Math.min(5, zoomLevel.value * factor));
  }

  return {
    // State
    containerWidth, containerHeight, panOffset, zoomLevel,
    // Stage
    stg,
    // Computeds
    vs, ox, oy, stageConfig, is3D, cam3d, proj3DScale, projCx, projCy,
    // 3D projection functions
    iso, isoRef,
    // Coordinate helpers
    s2c, c2s,
    // Theme
    themeAccent, themeSurface,
    // Size
    updateSize,
    // 3D unproject
    unprojectView,
    // Pan/zoom handlers
    startPan, handleWheel,
  };
}
