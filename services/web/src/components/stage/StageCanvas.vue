<template>
  <div
    class="stage-canvas h-full flex flex-col"
    style="min-height: 0;"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div ref="container" class="flex-1 rounded-xl overflow-hidden relative" style="min-height: 0; background: var(--studio-surface2);">
      <v-stage ref="konvaStage" :config="stageConfig" @mousedown="handleStageMouseDown" @dblclick="onStageDblClick" @wheel="handleWheel">
        <!-- Background layer -->
        <v-layer>
          <v-rect :config="bgConfig" />
          <!-- Grid lines -->
          <template v-if="gridVisible">
            <v-line v-for="(l, i) in gridLines" :key="'g'+i" :config="l" />
            <v-line :config="centerH" />
            <v-line :config="centerV" />
          </template>
        </v-layer>

        <!-- Objects layer -->
        <v-layer ref="objectsLayer">
          <!-- 3D reference axes (faint, behind objects) — orient the iso + top panels -->
          <template v-if="is3D">
            <v-line v-for="(gl, gli) in floorGrid3d" :key="'flg' + gli" :config="gl" />
            <v-line v-for="(ax, axi) in refAxes3d" :key="'refax' + axi" :config="ax" />
            <v-text v-for="(lb, lbi) in refAxisLabels3d" :key="'reflb' + lbi" :config="lb" />
          </template>

          <template v-for="obj in sortedObjects" :key="obj.id + (obj.type === 'text' ? '-' + fontLoadKey : '')">
            <!-- Rectangle / Square -->
            <v-rect v-if="(obj.type === 'square' || obj.type === 'rectangle') && isVis(obj.id)" :config="rectCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Circle -->
            <v-circle v-if="obj.type === 'circle' && isVis(obj.id)" :config="circleCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Ellipse -->
            <v-ellipse v-if="obj.type === 'ellipse' && isVis(obj.id)" :config="ellipseCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Dot -->
            <v-circle v-if="obj.type === 'dot' && isVis(obj.id)" :config="dotCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />

            <!-- Heart -->
            <v-shape v-if="obj.type === 'heart' && isVis(obj.id)" :config="heartCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Triangle -->
            <v-line v-if="obj.type === 'triangle' && isVis(obj.id)" :config="triangleCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Star -->
            <v-star v-if="obj.type === 'star' && isVis(obj.id)" :config="starCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Polygon (hexagon) -->
            <v-regular-polygon v-if="obj.type === 'polygon' && isVis(obj.id)" :config="polygonCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Line -->
            <v-line v-if="obj.type === 'line' && isVis(obj.id)" :config="lineCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />

            <!-- Arrow -->
            <v-arrow v-if="obj.type === 'arrow' && isVis(obj.id)" :config="arrowCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Dot Grid -->
            <v-group v-if="obj.type === 'dot_grid' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)">
              <v-circle v-for="(d, di) in dotGridDots(obj)" :key="di" :config="d" />
            </v-group>

            <!-- Text -->
            <v-text v-if="obj.type === 'text' && isVis(obj.id)" :config="textCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" @dblclick="onTextDblClick(obj.id)" />

            <!-- Image / SVG -->
            <v-image v-if="(obj.type === 'image' || obj.type === 'svg_asset') && isVis(obj.id) && imageElements[obj.assetId]" :config="imageCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- LaTeX -->
            <v-group v-if="obj.type === 'latex' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="latexBgCfg(obj)" />
              <v-text :config="latexTextCfg(obj)" />
              <v-text :config="latexBadgeCfg(obj)" />
            </v-group>

            <!-- Axes -->
            <v-group v-if="obj.type === 'axes' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="axesBgCfg(obj)" />
              <v-line :config="axesXLineCfg(obj)" />
              <v-line :config="axesYLineCfg(obj)" />
              <v-line :config="axesXArrowCfg(obj)" />
              <v-line :config="axesYArrowCfg(obj)" />
              <v-line v-for="(tick, ti) in axesXTicks(obj)" :key="'xt'+ti" :config="tick" />
              <v-line v-for="(tick, ti) in axesYTicks(obj)" :key="'yt'+ti" :config="tick" />
              <v-text :config="axesLabelCfg(obj, 'x')" />
              <v-text :config="axesLabelCfg(obj, 'y')" />
              <!-- Graph curves preview -->
              <v-line v-for="(gc, gi) in axesGraphCurves(obj)" :key="'gc'+gi" :config="gc" />
            </v-group>

            <!-- NumberPlane -->
            <v-group v-if="obj.type === 'numberplane' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="{ x: -obj.width/2 * vs, y: -obj.height/2 * vs, width: obj.width * vs, height: obj.height * vs, fill: obj.fill || '#334155', opacity: 0.3, listening: false }" />
              <v-line :config="{ points: [-obj.width/2 * vs, 0, obj.width/2 * vs, 0], stroke: obj.stroke || '#64748b', strokeWidth: 1.5, listening: false }" />
              <v-line :config="{ points: [0, -obj.height/2 * vs, 0, obj.height/2 * vs], stroke: obj.stroke || '#64748b', strokeWidth: 1.5, listening: false }" />
              <v-text :config="{ text: 'NumberPlane', x: -40, y: -obj.height/2 * vs + 4, fontSize: 10, fill: '#94a3b8', listening: false }" />
            </v-group>

            <!-- NumberLine -->
            <v-group v-if="obj.type === 'numberline' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-line :config="{ points: [-obj.width/2 * vs, 0, obj.width/2 * vs, 0], stroke: obj.stroke || '#ffffff', strokeWidth: 2, listening: false }" />
              <v-line :config="{ points: [obj.width/2 * vs - 8 * vs, -5 * vs, obj.width/2 * vs, 0, obj.width/2 * vs - 8 * vs, 5 * vs], stroke: obj.stroke || '#ffffff', strokeWidth: 2, listening: false }" />
              <v-text :config="{ text: 'NumberLine', x: -30, y: -16, fontSize: 10, fill: '#94a3b8', listening: false }" />
            </v-group>

            <!-- 3D: Sphere iso -->
            <template v-if="obj.type === 'sphere' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-circle :config="sphere3dCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event, 'iso')" />
            </template>

            <!-- 3D: Cube iso -->
            <template v-if="obj.type === 'cube' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-line :config="cube3dCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event, 'iso')" />
            </template>

            <!-- 3D: Cone/Cylinder/Torus iso -->
            <template v-if="['cone', 'cylinder', 'torus'].includes(obj.type) && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-ellipse :config="generic3dCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event, 'iso')" />
            </template>

            <!-- 3D: Axes3D iso -->
            <template v-if="obj.type === 'axes3d' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group :config="{ x: 0, y: 0 }" @mousedown="onObjDown(obj.id, $event)">
                <v-line v-for="(axLine, axIdx) in axes3dLines(obj)" :key="'ax3d' + axIdx" :config="axLine" />
              </v-group>
            </template>

            <!-- 3D Top View: Sphere -->
            <template v-if="obj.type === 'sphere' && is3D && isVis(obj.id)" :key="obj.id + '-3d-top'">
              <v-circle :config="sphere3dTopCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event, 'top')" />
            </template>

            <!-- 3D Top View: Cube -->
            <template v-if="obj.type === 'cube' && is3D && isVis(obj.id)" :key="obj.id + '-3d-top'">
              <v-rect :config="cube3dTopCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event, 'top')" />
            </template>

            <!-- 3D Top View: Cone/Cylinder/Torus -->
            <template v-if="['cone', 'cylinder', 'torus'].includes(obj.type) && is3D && isVis(obj.id)" :key="obj.id + '-3d-top'">
              <v-circle :config="generic3dTopCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event, 'top')" />
            </template>
          </template>

          <!-- 3D committed path polylines (iso + top) -->
          <template v-for="pl in path3dPolylines" :key="pl.id">
            <v-line :config="pl" />
          </template>

          <!-- 3D Split Divider -->
          <v-line
            v-if="is3D"
            :config="{ points: [splitX, 0, splitX, stageConfig.height], stroke: '#475569', strokeWidth: 2, dash: [6, 3] }"
          />
        </v-layer>

        <!-- Morph preview layer -->
        <v-layer>
          <v-line v-for="(m, mi) in morphShapes" :key="'m'+mi" :config="morphCfg(m)" />
        </v-layer>

        <!-- Path draw preview layer -->
        <v-layer v-if="pathDrawing && pathPoints.length >= 1">
          <v-line v-if="pathPoints.length >= 2" :config="pathPreviewLineCfg" />
          <v-circle v-for="(pt, pi) in pathCanvasPoints" :key="'pp'+pi" :config="{ x: pt.cx, y: pt.cy, radius: 5, fill: '#a855f7', stroke: '#fff', strokeWidth: 1, listening: false }" />
        </v-layer>

        <!-- Group bounds layer -->
        <v-layer>
          <v-rect v-for="gb in groupBounds" :key="'gb-'+gb.id" :config="gb" />
        </v-layer>

        <!-- Selection transformer -->
        <v-layer>
          <v-transformer v-if="selectedObjectIds.length > 0" ref="transformer" :config="trConfig" />
        </v-layer>
      </v-stage>

      <!-- Drop zone indicator -->
      <div v-if="isDraggingOver" class="absolute inset-0 pointer-events-none border-2 border-dashed border-studio-accent/50 rounded-xl bg-studio-accent/5 flex items-center justify-center" style="z-index: var(--z-overlay);">
        <span class="text-studio-accent text-sm font-medium opacity-60">Drop to place</span>
      </div>

      <!-- Empty state -->
      <div v-if="objects.length === 0 && !isDraggingOver" class="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <div class="text-center max-w-xs px-6">
          <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-studio-accent/10 border border-studio-accent/20 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-studio-accent">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <p class="text-sm font-medium text-studio-text/50 mb-1">Empty canvas</p>
          <p class="text-xs text-studio-text-muted/40 leading-relaxed">Drag a shape from the sidebar, or click to add.</p>
        </div>
      </div>

      <!-- Zoom indicator -->
      <div class="absolute bottom-2 right-2 text-[10px] text-studio-text-muted/40 font-mono pointer-events-none select-none">
        {{ Math.round(zoomLevel * 100) }}%
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useProjectStore } from '../../store/project.js';
import { generateDotGridPositions } from '../../engine/geometry.js';
import { applyOverrides } from '../../engine/blending.js';
import { project3D, unprojectIso } from '../../engine/projection3d.js';
import { loadFont, isFontLoaded } from '../../utils/fontLoader.js';

const store = useProjectStore();

// ── 3D Projection ─────────────────────────────────────────────────────────
function iso(x3d, y3d, z3d, cx, cy, scale) {
  return project3D({ x3d, y3d, z3d }, cam3d.value, cx, cy, scale);
}

function top(x3d, z3d, cx2, cy2, scale) {
  return { px: cx2 + x3d * scale, py: cy2 + z3d * scale };
}

// ── Reactive state ──
const containerWidth = ref(800);
const containerHeight = ref(500);
const panOffset = ref({ x: 0, y: 0 });
const zoomLevel = ref(1);
const imageElements = reactive({});
const isDraggingOver = ref(false);
const fontLoadKey = ref(0);
const shiftKey = ref(false);
const liveTransform = ref(null);
const pathDrawing = ref(false);
const pathPoints = ref([]);
const pathSourceId = ref(null);

// ── Non-reactive instance vars ──
let _pathLastClick = 0;
let _measureCanvas = null;
let _measureCtx = null;
let _ro = null;
let _onKeyDown = null;
let _onKeyUp = null;

// ── Template refs ──
const container = ref(null);
const konvaStage = ref(null);
const objectsLayer = ref(null);
const transformer = ref(null);

// ── Computed ──
const objects = computed(() => store.project.objects);
const sortedObjects = computed(() => [...objects.value].sort((a, b) => (a.zOrder || 0) - (b.zOrder || 0)));
const selectedObjectIds = computed(() => store.selectedObjectIds);
const gridVisible = computed(() => store.project.stage.gridVisible);
const stg = computed(() => store.project.stage);
const frameState = computed(() => store.frameState);
const morphShapes = computed(() => frameState.value.morphShapes || []);

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
const cam3d = computed(() => {
  const cs = store.frameState.cameraState;
  const base = store.project?.camera3d ?? {};
  if (cs && cs.is3d) {
    return { phi: cs.phi, theta: cs.theta, zoom: cs.zoom,
             mode: base.projection ?? 'orthographic', focalDistance: base.focalDistance ?? 8 };
  }
  return { phi: base.phi ?? 75, theta: base.theta ?? -45, zoom: base.zoom ?? 1,
           mode: base.projection ?? 'orthographic', focalDistance: base.focalDistance ?? 8 };
});
const splitRatio = ref(0.5);

const leftPanelWidth = computed(() => Math.floor((stageConfig.value?.width ?? 1920) * splitRatio.value));
const rightPanelWidth = computed(() => (stageConfig.value?.width ?? 1920) - leftPanelWidth.value);
const splitX = computed(() => leftPanelWidth.value);

const proj3DScale = computed(() => leftPanelWidth.value / 16);
const projCx = computed(() => leftPanelWidth.value / 2);
const projCy = computed(() => (stageConfig.value?.height ?? 1080) / 2);
const projCx2 = computed(() => splitX.value + rightPanelWidth.value / 2);
const projCy2 = computed(() => (stageConfig.value?.height ?? 1080) / 2);

// Faint reference XYZ axes so the perspective (iso) panel is orientable.
// iso() respects cam3d (phi/theta/projection), so the gizmo rotates with the camera.
const REF_AXIS_LEN = 4;
const AXIS_COLORS = { x: '#f87171', y: '#4ade80', z: '#60a5fa' };
const refAxes3d = computed(() => {
  if (!is3D.value) return [];
  const L = REF_AXIS_LEN, s = proj3DScale.value;
  const cx = projCx.value, cy = projCy.value, cx2 = projCx2.value, cy2 = projCy2.value;
  const ln = (a, b, stroke) => ({ points: [a.px, a.py, b.px, b.py], stroke, strokeWidth: 1.5, opacity: 0.3, dash: [5, 5], listening: false });
  return [
    // iso (perspective) panel — full XYZ
    ln(iso(-L, 0, 0, cx, cy, s), iso(L, 0, 0, cx, cy, s), AXIS_COLORS.x),
    ln(iso(0, -L, 0, cx, cy, s), iso(0, L, 0, cx, cy, s), AXIS_COLORS.y),
    ln(iso(0, 0, -L, cx, cy, s), iso(0, 0, L, cx, cy, s), AXIS_COLORS.z),
    // top (XZ) panel — X horizontal, Z vertical
    ln(top(-L, 0, cx2, cy2, s), top(L, 0, cx2, cy2, s), AXIS_COLORS.x),
    ln(top(0, -L, cx2, cy2, s), top(0, L, cx2, cy2, s), AXIS_COLORS.z),
  ];
});
const refAxisLabels3d = computed(() => {
  if (!is3D.value) return [];
  const L = REF_AXIS_LEN, s = proj3DScale.value;
  const cx = projCx.value, cy = projCy.value, cx2 = projCx2.value, cy2 = projCy2.value;
  const tx = (p, text, fill) => ({ x: p.px + 4, y: p.py - 7, text, fontSize: 12, fontStyle: 'bold', fill, opacity: 0.5, listening: false });
  return [
    tx(iso(L, 0, 0, cx, cy, s), 'X', AXIS_COLORS.x),
    tx(iso(0, L, 0, cx, cy, s), 'Y', AXIS_COLORS.y),
    tx(iso(0, 0, L, cx, cy, s), 'Z', AXIS_COLORS.z),
    tx(top(L, 0, cx2, cy2, s), 'X', AXIS_COLORS.x),
    tx(top(0, L, cx2, cy2, s), 'Z', AXIS_COLORS.z),
  ];
});

// Faint floor grid on the XZ plane (y=0) — gives a "ground" reference in the
// iso (perspective) panel; center lines (i=0) are skipped so the colored
// reference axes act as the grid centerlines.
const FLOOR_GRID_EXT = 5;
const floorGrid3d = computed(() => {
  if (!is3D.value) return [];
  const G = FLOOR_GRID_EXT, s = proj3DScale.value;
  const cx = projCx.value, cy = projCy.value, cx2 = projCx2.value, cy2 = projCy2.value;
  const out = [];
  const ln = (a, b) => ({ points: [a.px, a.py, b.px, b.py], stroke: '#64748b', strokeWidth: 1, opacity: 0.1, listening: false });
  for (let i = -G; i <= G; i++) {
    if (i === 0) continue;
    // iso (perspective): lines parallel to X (at z=i) and parallel to Z (at x=i)
    out.push(ln(iso(-G, 0, i, cx, cy, s), iso(G, 0, i, cx, cy, s)));
    out.push(ln(iso(i, 0, -G, cx, cy, s), iso(i, 0, G, cx, cy, s)));
    // top (XZ orthographic)
    out.push(ln(top(-G, i, cx2, cy2, s), top(G, i, cx2, cy2, s)));
    out.push(ln(top(i, -G, cx2, cy2, s), top(i, G, cx2, cy2, s)));
  }
  return out;
});
const bgConfig = computed(() => ({
  x: ox.value, y: oy.value,
  width: stg.value.width * vs.value, height: stg.value.height * vs.value,
  fill: stg.value.backgroundColor || '#000000',
  opacity: stg.value.backgroundOpacity ?? 1,
  cornerRadius: 4,
  shadowColor: '#000', shadowBlur: 40, shadowOpacity: 0.6
}));

const themeAccent = computed(() => getCssVar('--studio-accent') || '#4CEEF9');
const themeSurface = computed(() => getCssVar('--studio-text') || '#E6EDF3');

const gridLines = computed(() => {
  const lines = [];
  const x0 = ox.value, y0 = oy.value, w = stg.value.width * vs.value, h = stg.value.height * vs.value;
  const gs = stg.value.gridSize || 8;
  const gridColor = stg.value.gridColor || '#ffffff';
  const gridOpacity = stg.value.gridOpacity ?? 0.12;
  for (let i = 1; i < gs; i++) {
    lines.push({ points: [x0 + w / gs * i, y0, x0 + w / gs * i, y0 + h], stroke: gridColor, strokeWidth: 0.5, opacity: gridOpacity, dash: [4, 8], listening: false });
    lines.push({ points: [x0, y0 + h / gs * i, x0 + w, y0 + h / gs * i], stroke: gridColor, strokeWidth: 0.5, opacity: gridOpacity, dash: [4, 8], listening: false });
  }
  return lines;
});

const centerH = computed(() => {
  const gridOpacity = stg.value.gridOpacity ?? 0.12;
  return { points: [ox.value, oy.value + stg.value.height * vs.value / 2, ox.value + stg.value.width * vs.value, oy.value + stg.value.height * vs.value / 2], stroke: themeAccent.value, strokeWidth: 0.5, opacity: gridOpacity + 0.06, dash: [8, 4], listening: false };
});
const centerV = computed(() => {
  const gridOpacity = stg.value.gridOpacity ?? 0.12;
  return { points: [ox.value + stg.value.width * vs.value / 2, oy.value, ox.value + stg.value.width * vs.value / 2, oy.value + stg.value.height * vs.value], stroke: themeAccent.value, strokeWidth: 0.5, opacity: gridOpacity + 0.06, dash: [8, 4], listening: false };
});

const trConfig = computed(() => {
  const accent = themeAccent.value;
  return {
    anchorSize: 8, anchorFill: accent, anchorStroke: '#fff', anchorStrokeWidth: 1.5,
    borderStroke: accent, borderStrokeWidth: 1.5, borderDash: [6, 4],
    rotateEnabled: true, keepRatio: shiftKey.value,
    enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    boundBoxFunc: (o, n) => (n.width < 10 || n.height < 10) ? o : n
  };
});

const pathCanvasPoints = computed(() => {
  if (!pathPoints.value.length) return [];
  return pathPoints.value.map(p => {
    if ('x3d' in p) {
      const t = top(p.x3d, p.z3d, projCx2.value, projCy2.value, proj3DScale.value);
      return { cx: t.px, cy: t.py };   // top() is already canvas px — no s2c
    }
    const cp = s2c(p.x, p.y);
    return { cx: cp.x, cy: cp.y };
  });
});
const pathPreviewLineCfg = computed(() => {
  const pts = pathCanvasPoints.value.flatMap(p => [p.cx, p.cy]);
  return {
    points: pts,
    stroke: '#a855f7',
    strokeWidth: 2,
    dash: [6, 3],
    listening: false,
  };
});

const groupBounds = computed(() => {
  const groups = store.project.groups || [];
  const bounds = [];
  for (const group of groups) {
    if (!group.childIds || group.childIds.length === 0) continue;
    const anySelected = group.childIds.some(cid => store.selectedObjectIds.includes(cid));
    if (!anySelected) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const cid of group.childIds) {
      const obj = store.project.objects.find(o => o.id === cid);
      if (!obj) continue;
      minX = Math.min(minX, obj.x - obj.width / 2);
      minY = Math.min(minY, obj.y - obj.height / 2);
      maxX = Math.max(maxX, obj.x + obj.width / 2);
      maxY = Math.max(maxY, obj.y + obj.height / 2);
    }
    if (minX === Infinity) continue;

    const margin = group.margin || 10;
    const p1 = s2c(minX - margin, minY - margin);
    const w = (maxX - minX + margin * 2) * vs.value;
    const h = (maxY - minY + margin * 2) * vs.value;

    bounds.push({
      id: group.id,
      x: p1.x, y: p1.y, width: w, height: h,
      fill: 'transparent',
      stroke: themeAccent.value, strokeWidth: 1.5, dash: [6, 4],
      opacity: 0.5, cornerRadius: 6, listening: false
    });
  }
  return bounds;
});

// ── Watch ──
watch(() => store.selectedObjectIds, () => {
  nextTick(() => updateTransformer());
}, { deep: true });

watch(() => store.project.objects, () => {
  nextTick(() => updateTransformer());
  loadNewImages();
  loadNewFonts();
}, { deep: true });

// ── Lifecycle ──
onMounted(() => {
  updateSize();
  _ro = new ResizeObserver(() => updateSize());
  _ro.observe(container.value);
  loadNewImages();
  loadNewFonts();
  _onKeyDown = (e) => { if (e.key === 'Shift') shiftKey.value = true; };
  _onKeyUp = (e) => { if (e.key === 'Shift') shiftKey.value = false; };
  window.addEventListener('keydown', _onKeyDown);
  window.addEventListener('keyup', _onKeyUp);
});

onBeforeUnmount(() => {
  if (_ro) _ro.disconnect();
  if (_onKeyDown) window.removeEventListener('keydown', _onKeyDown);
  if (_onKeyUp) window.removeEventListener('keyup', _onKeyUp);
});

// ── Methods ──
function getCssVar(name) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch { return ''; }
}
function updateSize() {
  if (container.value) {
    containerWidth.value = container.value.clientWidth;
    containerHeight.value = container.value.clientHeight;
  }
}
function s2c(sx, sy) { return { x: ox.value + sx * vs.value, y: oy.value + sy * vs.value }; }
function c2s(cx, cy) { return { x: (cx - ox.value) / vs.value, y: (cy - oy.value) / vs.value }; }

function eff(obj) {
  const ov = frameState.value.objectOverrides[obj.id];
  return ov ? applyOverrides(obj, ov) : obj;
}

// 3D nesnenin geçerli (override dahil) konumu — playback path_move/move override'larını yansıtır
// Returns only positional 3D coords (x3d/y3d/z3d) merged with overrides — read other props from obj directly.
function eff3d(obj) {
  const ov = frameState.value.objectOverrides[obj.id] || {};
  return {
    x3d: ov.x3d ?? obj.x3d ?? 0,
    y3d: ov.y3d ?? obj.y3d ?? 0,
    z3d: ov.z3d ?? obj.z3d ?? 0,
  };
}

// Commit edilmiş 3D path_move yollarını iso + top panelde polyline olarak çiz (salt-görsel)
const path3dPolylines = computed(() => {
  if (!is3D.value) return [];
  const out = [];
  for (const track of store.project.tracks || []) {
    for (const clip of track.clips || []) {
      if (clip.type !== 'path_move' || !Array.isArray(clip.path)) continue;
      if (!(clip.path[0] && 'x3d' in clip.path[0])) continue;
      const isoPts = [];
      const topPts = [];
      for (const pt of clip.path) {
        const i = iso(pt.x3d, pt.y3d ?? 0, pt.z3d, projCx.value, projCy.value, proj3DScale.value);
        isoPts.push(i.px, i.py);
        const t = top(pt.x3d, pt.z3d, projCx2.value, projCy2.value, proj3DScale.value);
        topPts.push(t.px, t.py);
      }
      const base = { stroke: '#a855f7', strokeWidth: 1.5, dash: [4, 4], listening: false, opacity: 0.7 };
      out.push({ ...base, points: isoPts, id: clip.id + '-isopath' });
      out.push({ ...base, points: topPts, id: clip.id + '-toppath' });
    }
  }
  return out;
});

function isVis(id) {
  const h = frameState.value.hiddenIds;
  if (h instanceof Set) return !h.has(id);
  return true;
}

function loadNewImages() {
  for (const obj of objects.value) {
    if ((obj.type === 'image' || obj.type === 'svg_asset') && obj.assetId && !imageElements[obj.assetId]) {
      const asset = store.assetById(obj.assetId);
      if (asset && asset.dataUrl) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = asset.dataUrl;
        img.onload = () => { imageElements[obj.assetId] = img; };
      }
    }
  }
}

async function loadNewFonts() {
  for (const obj of objects.value) {
    if (obj.type === 'text' && obj.fontFamily && !isFontLoaded(obj.fontFamily)) {
      try {
        await loadFont(obj.fontFamily);
        fontLoadKey.value++;
        nextTick(() => {
          const layer = objectsLayer.value?.getNode();
          if (layer) {
            layer.batchDraw();
          }
        });
      } catch (e) {
        console.warn('Failed to load font:', obj.fontFamily, e);
      }
    }
  }
}

// ── Drag and Drop from sidebar ──
function onDragOver(e) {
  isDraggingOver.value = true;
  e.dataTransfer.dropEffect = 'copy';
}
function onDragLeave() {
  isDraggingOver.value = false;
}
function onDrop(e) {
  isDraggingOver.value = false;
  const containerRect = container.value.getBoundingClientRect();
  const dropX = e.clientX - containerRect.left;
  const dropY = e.clientY - containerRect.top;

  const stagePos = c2s(dropX, dropY);

  let sx = stagePos.x, sy = stagePos.y;
  if (store.project.stage.snapEnabled && store.project.stage.snapToGrid) {
    const gsX = store.project.stage.width / store.project.stage.gridSize;
    const gsY = store.project.stage.height / store.project.stage.gridSize;
    sx = Math.round(sx / gsX) * gsX;
    sy = Math.round(sy / gsY) * gsY;
  }
  if (store.project.stage.snapEnabled && store.project.stage.snapToCenter) {
    const cx = store.project.stage.width / 2, cy = store.project.stage.height / 2;
    if (Math.abs(sx - cx) < 30) sx = cx;
    if (Math.abs(sy - cy) < 30) sy = cy;
  }

  const shapeType = e.dataTransfer.getData('application/x-shape-type');
  const assetId = e.dataTransfer.getData('application/x-asset-id');

  if (shapeType) {
    const obj = store.addObject(shapeType, Math.round(sx), Math.round(sy));
    store.selectObject(obj.id);
  } else if (assetId) {
    const obj = store.addImageObject(assetId, Math.round(sx), Math.round(sy));
    if (obj) store.selectObject(obj.id);
  }
}

// ── Shape configs ──
function live(obj) {
  return liveTransform.value && liveTransform.value.id === obj.id ? liveTransform.value : null;
}
function rectCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x - e.width / 2, e.y - e.height / 2);
  const w = L ? L.w : e.width * vs.value, h = L ? L.h : e.height * vs.value, rot = L ? L.rotation : (e.rotation || 0);
  return { x: p.x, y: p.y, width: w, height: h, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, cornerRadius: (obj.type === 'square' ? 4 : 2) * vs.value, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
}
function circleCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y); const r = L ? Math.min(L.w, L.h) / 2 : Math.min(e.width, e.height) / 2 * vs.value;
  const rot = L ? L.rotation : (e.rotation || 0);
  return { x: p.x, y: p.y, radius: r, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
}
function ellipseCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y);
  const rx = L ? L.w / 2 : (e.width / 2) * vs.value, ry = L ? L.h / 2 : (e.height / 2) * vs.value, rot = L ? L.rotation : (e.rotation || 0);
  return { x: p.x, y: p.y, radiusX: rx, radiusY: ry, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
}
function dotCfg(obj) {
  const e = eff(obj); const p = s2c(e.x, e.y);
  return { x: p.x, y: p.y, radius: Math.max(4, e.width / 2 * vs.value), fill: e.fill || '#fff', opacity: e.opacity ?? 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 12 };
}
function heartCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y); const w = L ? L.w : e.width * vs.value; const h = L ? L.h : e.height * vs.value; const rot = L ? L.rotation : (e.rotation || 0);
  return {
    x: p.x, y: p.y, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2,
    opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1,
    draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10,
    sceneFunc: (ctx, shape) => {
      const hw = w / 2, hh = h / 2;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 2 * Math.PI;
        const px = (16 * Math.pow(Math.sin(t), 3) / 16) * hw;
        const py = -(((13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 15)) * hh;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fillStrokeShape(shape);
    }
  };
}
function triangleCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y);
  const hw = L ? L.w / 2 : e.width / 2 * vs.value, hh = L ? L.h / 2 : e.height / 2 * vs.value, rot = L ? L.rotation : (e.rotation || 0);
  return { x: p.x, y: p.y, points: [0, -hh, hw, hh, -hw, hh], closed: true, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
}
function starCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y);
  const outerRadius = L ? Math.min(L.w, L.h) / 2 : Math.min(e.width, e.height) / 2 * vs.value;
  const inner = (obj.innerRatio || 0.4) * outerRadius; const rot = L ? L.rotation : (e.rotation || 0);
  return { x: p.x, y: p.y, numPoints: obj.starArms || 5, innerRadius: inner, outerRadius: outerRadius, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
}
function polygonCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y);
  const r = L ? Math.min(L.w, L.h) / 2 : Math.min(e.width, e.height) / 2 * vs.value; const rot = L ? L.rotation : (e.rotation || 0);
  return { x: p.x, y: p.y, sides: obj.sides || 6, radius: r, fill: e.fill, stroke: e.stroke, strokeWidth: (e.strokeWidth || 2) * vs.value / 2, opacity: e.opacity ?? 1, rotation: rot, scaleX: 1, scaleY: 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10 };
}
function lineCfg(obj) {
  const e = eff(obj); const p = s2c(e.x, e.y);
  const hw = e.width / 2 * vs.value;
  return { x: p.x, y: p.y, points: [-hw, 0, hw, 0], stroke: e.stroke || e.fill || '#94a3b8', strokeWidth: Math.max(2, (e.strokeWidth || 3) * vs.value / 2), opacity: e.opacity ?? 1, rotation: e.rotation || 0, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 16, lineCap: 'round' };
}
function arrowCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y);
  const hw = L ? L.w / 2 : e.width / 2 * vs.value; const rot = L ? L.rotation : (e.rotation || 0);
  return { x: p.x, y: p.y, points: [-hw, 0, hw, 0], fill: e.fill, stroke: e.stroke || e.fill || '#ef4444', strokeWidth: Math.max(2, (e.strokeWidth || 2) * vs.value / 2), opacity: e.opacity ?? 1, rotation: rot, pointerLength: 14 * vs.value / 2, pointerWidth: 12 * vs.value / 2, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 16, scaleX: 1, scaleY: 1 };
}
function textCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y);
  // Match Manim Text font_size: at 1080p, font_size N ≈ N px; scale by vs for stage→canvas
  const manimFontScale = (e.fontSize || 48) * vs.value;
  const fontFamily = e.fontFamily || 'Arial';
  const fontStyle = (e.fontWeight === 'bold' ? 'bold ' : '') + (e.fontStyle === 'italic' ? 'italic ' : '');
  const text = e.content || 'Text';
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
    draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject', hitStrokeWidth: 10
  };
}
function measureTextWidth(text, fontSize, fontFamily, fontStyle) {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
    _measureCtx = _measureCanvas.getContext('2d');
  }
  _measureCtx.font = `${fontStyle}${fontSize}px ${fontFamily}`;
  return _measureCtx.measureText(text).width;
}
function groupCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x, e.y);
  const rot = L ? L.rotation : (e.rotation || 0);
  return { x: p.x, y: p.y, rotation: rot, opacity: e.opacity ?? 1, scaleX: 1, scaleY: 1, draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject' };
}
function dotGridDots(obj) {
  const sp = (obj.dotSpacing || 40) * vs.value, r = Math.max(2, (obj.dotRadius || 5) * vs.value);
  return generateDotGridPositions(obj.gridCols || 5, obj.gridRows || 5, sp).map(p => ({ x: p.x, y: p.y, radius: r, fill: obj.fill || '#fff', listening: false }));
}
function imageCfg(obj) {
  const L = live(obj);
  const e = eff(obj); const p = L ? { x: L.x, y: L.y } : s2c(e.x - e.width / 2, e.y - e.height / 2);
  const w = L ? L.w : e.width * vs.value, h = L ? L.h : e.height * vs.value, rot = L ? L.rotation : (e.rotation || 0);
  return {
    x: p.x, y: p.y, width: w, height: h,
    image: imageElements[obj.assetId], opacity: e.opacity ?? 1,
    rotation: rot, scaleX: 1, scaleY: 1,
    draggable: store.activeTool === 'select', id: obj.id, name: 'stageObject'
  };
}

// ── LaTeX config ──
function latexBgCfg(obj) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value, h = L ? L.h : obj.height * vs.value;
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(76,238,249,0.06)', stroke: themeAccent.value, strokeWidth: 1.5, dash: [6, 4], cornerRadius: 6, listening: false };
}
function latexTextCfg(obj) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value, h = L ? L.h : obj.height * vs.value;
  return { x: -w / 2, y: -h / 2, width: w, height: h, text: obj.latex || 'E = mc^2', fontSize: Math.max(12, 18 * vs.value), fontFamily: 'serif', fontStyle: 'italic', fill: obj.fill || '#ffffff', align: 'center', verticalAlign: 'middle', padding: 8, listening: false };
}
function latexBadgeCfg(obj) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value, h = L ? L.h : obj.height * vs.value;
  return { x: -w / 2 + 4, y: -h / 2 + 4, text: 'TEX', fontSize: 9, fill: themeAccent.value, fontFamily: 'monospace', fontStyle: 'bold', listening: false };
}

// ── Axes config ──
function axesBgCfg(obj) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value, h = L ? L.h : obj.height * vs.value;
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(16,185,129,0.04)', stroke: 'rgba(16,185,129,0.15)', strokeWidth: 1, cornerRadius: 4, listening: false };
}
function axesXLineCfg(obj) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value, h = L ? L.h : obj.height * vs.value;
  return { points: [-w / 2 + 10, 0, w / 2 - 10, 0], stroke: obj.stroke || '#ffffff', strokeWidth: 1.5, listening: false };
}
function axesYLineCfg(obj) {
  const L = live(obj); const h = L ? L.h : obj.height * vs.value;
  return { points: [0, h / 2 - 10, 0, -h / 2 + 10], stroke: obj.stroke || '#ffffff', strokeWidth: 1.5, listening: false };
}
function axesXArrowCfg(obj) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value;
  const tip = w / 2 - 10;
  return { points: [tip - 8, -5, tip, 0, tip - 8, 5], stroke: obj.stroke || '#ffffff', strokeWidth: 1.5, listening: false };
}
function axesYArrowCfg(obj) {
  const L = live(obj); const h = L ? L.h : obj.height * vs.value;
  const tip = -h / 2 + 10;
  return { points: [-5, tip + 8, 0, tip, 5, tip + 8], stroke: obj.stroke || '#ffffff', strokeWidth: 1.5, listening: false };
}
function axesXTicks(obj) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value;
  const xr = obj.xRange || [-5, 5, 1];
  const ticks = [];
  const range = xr[1] - xr[0];
  const step = xr[2] || 1;
  for (let v = xr[0]; v <= xr[1]; v += step) {
    if (Math.abs(v) < 0.001) continue;
    const px = ((v - xr[0]) / range - 0.5) * (w - 20);
    ticks.push({ points: [px, -4, px, 4], stroke: obj.stroke || '#ffffff', strokeWidth: 1, listening: false });
  }
  return ticks;
}
function axesYTicks(obj) {
  const L = live(obj); const h = L ? L.h : obj.height * vs.value;
  const yr = obj.yRange || [-3, 3, 1];
  const ticks = [];
  const range = yr[1] - yr[0];
  const step = yr[2] || 1;
  for (let v = yr[0]; v <= yr[1]; v += step) {
    if (Math.abs(v) < 0.001) continue;
    const py = -((v - yr[0]) / range - 0.5) * (h - 20);
    ticks.push({ points: [-4, py, 4, py], stroke: obj.stroke || '#ffffff', strokeWidth: 1, listening: false });
  }
  return ticks;
}
function axesLabelCfg(obj, axis) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value, h = L ? L.h : obj.height * vs.value;
  if (axis === 'x') {
    return { x: w / 2 - 20, y: 6, text: 'x', fontSize: 12, fill: obj.stroke || '#ffffff', fontFamily: 'serif', fontStyle: 'italic', listening: false };
  }
  return { x: 6, y: -h / 2 + 12, text: 'y', fontSize: 12, fill: obj.stroke || '#ffffff', fontFamily: 'serif', fontStyle: 'italic', listening: false };
}

function morphCfg(m) {
  if (!m || !m.flatPoints || m.flatPoints.length < 4) return { points: [], closed: true };
  const p = s2c(m.x, m.y);
  const sp = [];
  for (let i = 0; i < m.flatPoints.length; i += 2) { sp.push(m.flatPoints[i] * vs.value); sp.push(m.flatPoints[i + 1] * vs.value); }
  return { x: p.x, y: p.y, points: sp, closed: true, fill: m.fill || '#fff', stroke: m.stroke || '#fff', strokeWidth: (m.strokeWidth || 2) * vs.value / 2, opacity: m.opacity ?? 1, listening: false };
}

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

// ── Events ──
function handleStageMouseDown(e) {
  if (pathDrawing.value) {
    const now = Date.now();
    if (now - _pathLastClick < 350) return; // absorb second mousedown of dblclick
    _pathLastClick = now;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    if (is3D.value) {
      // 3D: clicks valid only in the top/XZ (right) panel; all coords are canvas px
      if (pos.x < splitX.value) return;
      const x3d = parseFloat(((pos.x - projCx2.value) / proj3DScale.value).toFixed(3));
      const z3d = parseFloat(((pos.y - projCy2.value) / proj3DScale.value).toFixed(3));
      const srcObj = store.objectById(pathSourceId.value);
      const y3d = srcObj?.y3d ?? 0;   // Y held constant at object's current y3d
      pathPoints.value.push({ x3d, y3d, z3d });
      return;
    }
    const sp = c2s(pos.x, pos.y);
    pathPoints.value.push({ x: Math.round(sp.x), y: Math.round(sp.y) });
    return;
  }
  const t = e.target; const s = konvaStage.value?.getNode();
  if (!s) return;
  const ev = e.evt;
  const addToSel = ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey);
  // Click on transformer (resize/rotate handles or border) — handle shift-click to add object underneath
  let node = t;
  while (node) {
    if (node.className === 'Transformer') {
      if (addToSel) {
        const layer = objectsLayer.value?.getNode?.();
        const pos = s.getPointerPosition?.();
        if (layer && pos) {
          const hit = layer.getIntersection?.(pos);
          if (hit && hit.name?.() === 'stageObject' && hit.id?.()) {
            store.selectObject(hit.id(), true);
            nextTick(() => nextTick(() => updateTransformer()));
          }
        }
      }
      return;
    }
    node = node.getParent ? node.getParent() : null;
  }
  if (t === s || t.name() !== 'stageObject') {
    if (store.activeTool === 'hand') startPan(e);
    else store.deselectAll();
  }
}
function onObjDown(id, e) {
  e.cancelBubble = true;
  const ev = e.evt;
  store.selectObject(id, ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey));
  nextTick(() => nextTick(() => updateTransformer()));
}
function onDragEnd(id, e) {
  const node = e.target; const obj = store.project.objects.find(o => o.id === id); if (!obj) return;
  let newX, newY;
  // Types that use top-left positioning (text now uses center with offsetX/offsetY)
  const tlTypes = ['square', 'rectangle', 'image', 'svg_asset'];
  if (tlTypes.includes(obj.type)) {
    const sp = c2s(node.x(), node.y());
    newX = sp.x + obj.width / 2; newY = sp.y + obj.height / 2;
  } else {
    const sp = c2s(node.x(), node.y());
    newX = sp.x; newY = sp.y;
  }
  if (store.project.stage.snapEnabled) {
    const gs = store.project.stage.width / store.project.stage.gridSize;
    const gs2 = store.project.stage.height / store.project.stage.gridSize;
    if (store.project.stage.snapToGrid) { newX = Math.round(newX / gs) * gs; newY = Math.round(newY / gs2) * gs2; }
    if (store.project.stage.snapToCenter) {
      const cx = store.project.stage.width / 2, cy = store.project.stage.height / 2;
      if (Math.abs(newX - cx) < 30) newX = cx;
      if (Math.abs(newY - cy) < 30) newY = cy;
    }
  }
  store.updateObject(id, { x: Math.round(newX), y: Math.round(newY) });
}
function onDrag3DEnd(objId, e, panel) {
  const node = e.target;
  const canvasX = node.x();
  const canvasY = node.y();
  const scale = proj3DScale.value;

  if (panel === 'iso') {
    const objY = store.project.objects.find(o => o.id === objId)?.y3d ?? 0;
    const r = unprojectIso(canvasX, canvasY, cam3d.value, projCx.value, projCy.value, scale, objY);
    const patch = {};
    if (r.x3d !== null) patch.x3d = parseFloat(r.x3d.toFixed(3));
    if (r.z3d !== null) patch.z3d = parseFloat(r.z3d.toFixed(3));
    store.updateObject(objId, patch);
  } else {
    const x3d = (canvasX - projCx2.value) / scale;
    const z3d = (canvasY - projCy2.value) / scale;
    store.updateObject(objId, { x3d: parseFloat(x3d.toFixed(3)), z3d: parseFloat(z3d.toFixed(3)) });
  }
  store.commitState();
  node.position({ x: 0, y: 0 });
}
function onTransform(id, e) {
  const node = e.target;
  const obj = store.project.objects.find(o => o.id === id);
  if (!obj) return;
  const sx = node.scaleX ? node.scaleX() : 1;
  const sy = node.scaleY ? node.scaleY() : 1;
  let w, h;
  if (obj.type === 'circle') {
    const r = (node.radius ? node.radius() : 10) * sx;
    w = h = Math.max(10, r * 2);
  } else if (obj.type === 'ellipse') {
    w = Math.max(10, (node.radiusX ? node.radiusX() : 20) * 2 * sx);
    h = Math.max(10, (node.radiusY ? node.radiusY() : 20) * 2 * sy);
  } else if (_isGroupType(obj.type)) {
    w = Math.max(20, (obj.width || 200) * vs.value * sx);
    h = Math.max(20, (obj.height || 200) * vs.value * sy);
  } else {
    w = Math.max(10, Math.abs((node.width ? node.width() : 1) * sx));
    h = Math.max(10, Math.abs((node.height ? node.height() : 1) * sy));
  }
  const rotation = node.rotation ? node.rotation() : 0;
  liveTransform.value = { id, type: obj.type, x: node.x(), y: node.y(), w, h, rotation };
}
function onTransformEnd(id, e) {
  const node = e.target;
  const obj = store.project.objects.find(o => o.id === id);
  if (!obj) return;

  const sx = node.scaleX ? node.scaleX() : 1;
  const sy = node.scaleY ? node.scaleY() : 1;
  const tlTypes = ['square', 'rectangle', 'image', 'svg_asset'];
  let cw, ch, cx, cy;

  if (obj.type === 'circle') {
    const r = node.radius ? node.radius() : (node.width ? node.width() / 2 : 20);
    cw = r * 2;
    ch = r * 2;
    cx = node.x();
    cy = node.y();
  } else if (obj.type === 'ellipse') {
    cw = node.radiusX ? node.radiusX() * 2 : (node.width ? node.width() : 40);
    ch = node.radiusY ? node.radiusY() * 2 : (node.height ? node.height() : 40);
    cx = node.x();
    cy = node.y();
  } else if (_isGroupType(obj.type)) {
    cw = (obj.width || 200) * vs.value * sx;
    ch = (obj.height || 200) * vs.value * sy;
    cx = node.x();
    cy = node.y();
  } else {
    cw = Math.max(10, Math.abs((node.width ? node.width() : 1) * sx));
    ch = Math.max(10, Math.abs((node.height ? node.height() : 1) * sy));
    if (tlTypes.includes(obj.type)) {
      cx = node.x() + cw / 2;
      cy = node.y() + ch / 2;
    } else {
      cx = node.x();
      cy = node.y();
    }
  }

  const stagePos = c2s(cx, cy);
  const newX = Math.round(stagePos.x);
  const newY = Math.round(stagePos.y);
  const newW = Math.max(20, Math.round(cw / vs.value));
  const newH = Math.max(20, Math.round(ch / vs.value));
  let rotation = node.rotation ? node.rotation() : 0;
  if (shiftKey.value) rotation = Math.round(rotation / 45) * 45;
  else rotation = Math.round(rotation * 10) / 10;

  node.scaleX(1);
  node.scaleY(1);

  store.updateObject(id, { x: newX, y: newY, width: newW, height: newH, rotation });
  liveTransform.value = null;
}
function _isGroupType(type) {
  return type === 'axes' || type === 'latex' || type === 'dot_grid' || type === 'numberplane' || type === 'numberline';
}
function axesGraphCurves(obj) {
  if (!obj.graphs || obj.graphs.length === 0) return [];
  const curves = [];
  const xr = obj.xRange || [-5, 5, 1];
  const yr = obj.yRange || [-3, 3, 1];
  const xMin = xr[0], xMax = xr[1];
  const yMin = yr[0], yMax = yr[1];
  const pw = obj.width * vs.value;
  const ph = obj.height * vs.value;

  for (const graph of obj.graphs) {
    let fn;
    // Validate expression before eval
    const safeExpr = (() => {
      const e = (graph.expression || '').trim();
      if (!e) return null;
      if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(e)) return null;
      if (/import|eval|exec|open|__/.test(e)) return null;
      return e;
    })();
    if (!safeExpr) continue;
    try {
      // eslint-disable-next-line no-new-func
      fn = new Function('x', `"use strict"; return (${safeExpr});`);
    } catch { continue; }

    const steps = 80;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (xMax - xMin) * (i / steps);
      let y;
      try { y = fn(x); } catch { continue; }
      if (!Number.isFinite(y)) continue;
      const cx = ((x - xMin) / (xMax - xMin)) * pw - pw / 2;
      const cy = -((y - yMin) / (yMax - yMin)) * ph + ph / 2;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      points.push(cx, cy);
    }
    if (points.length >= 4) {
      curves.push({
        points,
        stroke: graph.color || '#f59e0b',
        strokeWidth: graph.strokeWidth || 3,
        listening: false,
        tension: 0.3,
      });
    }
  }
  return curves;
}
// ── 3D shape configs ──────────────────────────────────────────────────────
function sphere3dCfg(obj) {
  const e3 = eff3d(obj);
  const p = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const r = Math.max(4, (obj.radius ?? 0.5) * proj3DScale.value);
  const isSelected = store.selectedObjectIds.includes(obj.id);
  return {
    x: p.px, y: p.py, radius: r,
    fill: obj.fill ?? '#e67700', opacity: obj.opacity ?? 1,
    stroke: isSelected ? '#60a5fa' : 'transparent', strokeWidth: isSelected ? 2 : 0,
    draggable: true,
  };
}

function cube3dCfg(obj) {
  const e3 = eff3d(obj);
  const s = (obj.sideLength ?? 1.0) * proj3DScale.value;
  const hs = s / 2 / proj3DScale.value;
  const cx = e3.x3d, cy = e3.y3d, cz = e3.z3d;
  const tl = iso(cx - hs, cy, cz - hs, projCx.value, projCy.value, proj3DScale.value);
  const tr = iso(cx + hs, cy, cz - hs, projCx.value, projCy.value, proj3DScale.value);
  const br = iso(cx + hs, cy, cz + hs, projCx.value, projCy.value, proj3DScale.value);
  const bl = iso(cx - hs, cy, cz + hs, projCx.value, projCy.value, proj3DScale.value);
  const isSelected = store.selectedObjectIds.includes(obj.id);
  return {
    points: [tl.px, tl.py, tr.px, tr.py, br.px, br.py, bl.px, bl.py],
    fill: obj.fill ?? '#3b5bdb', closed: true, opacity: obj.opacity ?? 1,
    stroke: isSelected ? '#60a5fa' : (obj.stroke ?? '#ffffff'), strokeWidth: isSelected ? 2 : 1,
    draggable: true,
  };
}

function generic3dCfg(obj) {
  const e3 = eff3d(obj);
  const p = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const r = Math.max(4, (obj.radius ?? obj.majorRadius ?? 0.5) * proj3DScale.value);
  const isSelected = store.selectedObjectIds.includes(obj.id);
  return {
    x: p.px, y: p.py,
    radiusX: r, radiusY: r * 0.5,
    fill: obj.fill ?? '#888888', opacity: obj.opacity ?? 1,
    stroke: isSelected ? '#60a5fa' : 'transparent', strokeWidth: isSelected ? 2 : 0,
    draggable: true,
  };
}

function axes3dLines(obj) {
  const e3 = eff3d(obj);
  const origin = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const xEnd = iso(e3.x3d + 3, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const yEnd = iso(e3.x3d, e3.y3d + 3, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const zEnd = iso(e3.x3d, e3.y3d, e3.z3d + 3, projCx.value, projCy.value, proj3DScale.value);
  return [
    { points: [origin.px, origin.py, xEnd.px, xEnd.py], stroke: '#ff6b6b', strokeWidth: 2 },
    { points: [origin.px, origin.py, yEnd.px, yEnd.py], stroke: '#69db7c', strokeWidth: 2 },
    { points: [origin.px, origin.py, zEnd.px, zEnd.py], stroke: '#74c0fc', strokeWidth: 2 },
  ];
}

function sphere3dTopCfg(obj) {
  const e3 = eff3d(obj);
  const p = top(e3.x3d, e3.z3d, projCx2.value, projCy2.value, proj3DScale.value);
  const r = Math.max(4, (obj.radius ?? 0.5) * proj3DScale.value);
  const isSelected = store.selectedObjectIds.includes(obj.id);
  return {
    x: p.px, y: p.py, radius: r,
    fill: (obj.fill ?? '#e67700') + '80',
    stroke: isSelected ? '#60a5fa' : (obj.fill ?? '#e67700'), strokeWidth: 1.5,
    draggable: true,
  };
}

function cube3dTopCfg(obj) {
  const e3 = eff3d(obj);
  const p = top(e3.x3d, e3.z3d, projCx2.value, projCy2.value, proj3DScale.value);
  const s = Math.max(8, (obj.sideLength ?? 1.0) * proj3DScale.value);
  const isSelected = store.selectedObjectIds.includes(obj.id);
  return {
    x: p.px - s / 2, y: p.py - s / 2, width: s, height: s,
    fill: (obj.fill ?? '#3b5bdb') + '80',
    stroke: isSelected ? '#60a5fa' : (obj.fill ?? '#3b5bdb'), strokeWidth: 1.5,
    draggable: true,
  };
}

function generic3dTopCfg(obj) {
  const e3 = eff3d(obj);
  const p = top(e3.x3d, e3.z3d, projCx2.value, projCy2.value, proj3DScale.value);
  const r = Math.max(4, (obj.radius ?? obj.majorRadius ?? 0.5) * proj3DScale.value);
  const isSelected = store.selectedObjectIds.includes(obj.id);
  return {
    x: p.px, y: p.py, radius: r,
    fill: (obj.fill ?? '#888888') + '80',
    stroke: isSelected ? '#60a5fa' : (obj.fill ?? '#888888'), strokeWidth: 1.5,
    draggable: true,
  };
}

function onTextDblClick(id) {
  // Could implement inline editing; for now, focus the properties panel
}
function updateTransformer() {
  const tr = transformer.value; const ol = objectsLayer.value; const ks = konvaStage.value;
  if (!tr || !ks) return;
  const t = tr.getNode(); const stage = ks.getNode(); if (!t || !stage) return;
  const layer = ol && ol.getNode ? ol.getNode() : null;
  const findNode = (id) => (layer ? layer.findOne('#' + id) : null) || stage.findOne('#' + id);
  const nodes = store.selectedObjectIds.map(findNode).filter(Boolean);
  t.nodes(nodes);
  t.getLayer().batchDraw();
}
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

// ── Expose for parent ref calls ──
defineExpose({ startPathDraw });
</script>
