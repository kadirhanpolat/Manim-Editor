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
          <!-- 3D reference grid + axes (faint, behind objects); segments are
               geometrically clipped to the viewport so zoom can't overflow -->
          <template v-if="is3D">
            <v-line v-for="(gl, gli) in floorGridIso" :key="'flgi' + gli" :config="gl" />
            <v-line v-for="(ax, axi) in refAxesIso" :key="'rai' + axi" :config="ax" />
            <v-text v-for="(lb, lbi) in refLabelsIso" :key="'rli' + lbi" :config="lb" />
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

            <!-- Free Polygon -->
            <v-line v-if="obj.type === 'polygon_free' && isVis(obj.id)" :config="polygonFreeCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />

            <!-- Parametric Curve -->
            <v-line v-if="obj.type === 'parametric' && isVis(obj.id)" :config="parametricCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />

            <!-- Star -->
            <v-star v-if="obj.type === 'star' && isVis(obj.id)" :config="starCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Polygon (hexagon) -->
            <v-regular-polygon v-if="obj.type === 'polygon' && isVis(obj.id)" :config="polygonCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Line -->
            <v-line v-if="obj.type === 'line' && isVis(obj.id)" :config="lineCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />

            <!-- Arrow -->
            <v-arrow v-if="obj.type === 'arrow' && isVis(obj.id)" :config="arrowCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

            <!-- Annulus / Sector / Arc / DoubleArrow -->
            <v-ring v-if="obj.type === 'annulus' && isVis(obj.id)" :config="annulusCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />
            <v-wedge v-if="obj.type === 'sector' && isVis(obj.id)" :config="sectorCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />
            <v-shape v-if="obj.type === 'arc' && isVis(obj.id)" :config="arcCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />
            <v-arrow v-if="obj.type === 'double_arrow' && isVis(obj.id)" :config="doubleArrowCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" />

            <!-- Dot Grid -->
            <v-group v-if="obj.type === 'dot_grid' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)">
              <v-rect :config="dotGridHitCfg(obj)" />
              <v-circle v-for="(d, di) in dotGridDots(obj)" :key="di" :config="d" />
            </v-group>

            <!-- Text -->
            <v-text v-if="obj.type === 'text' && isVis(obj.id)" :config="textCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" @dblclick="onTextDblClick(obj.id)" />

            <!-- Counter (DecimalNumber) -->
            <v-text v-if="obj.type === 'counter' && isVis(obj.id)" :config="counterCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)" />

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
              <v-line v-for="(ar, ai) in axesAreaRiemann(obj).areas" :key="'ar'+ai" :config="ar" />
              <v-rect v-for="(rr, ri) in axesAreaRiemann(obj).rects" :key="'rr'+ri" :config="rr" />
              <v-line v-for="(gc, gi) in axesGraphCurves(obj)" :key="'gc'+gi" :config="gc" />
            </v-group>

            <!-- NumberPlane / ComplexPlane -->
            <v-group v-if="(obj.type === 'numberplane' || obj.type === 'complex_plane') && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="{ x: -obj.width/2 * vs, y: -obj.height/2 * vs, width: obj.width * vs, height: obj.height * vs, fill: obj.fill || '#334155', opacity: 0.3, listening: true }" />
              <v-line :config="{ points: [-obj.width/2 * vs, 0, obj.width/2 * vs, 0], stroke: obj.stroke || '#64748b', strokeWidth: 1.5, listening: false }" />
              <v-line :config="{ points: [0, -obj.height/2 * vs, 0, obj.height/2 * vs], stroke: obj.stroke || '#64748b', strokeWidth: 1.5, listening: false }" />
              <v-text :config="{ text: obj.type === 'complex_plane' ? 'ComplexPlane' : 'NumberPlane', x: -40, y: -obj.height/2 * vs + 4, fontSize: 10, fill: '#94a3b8', listening: false }" />
            </v-group>

            <!-- PolarPlane -->
            <v-group v-if="obj.type === 'polar_plane' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="{ x: -obj.width/2 * vs, y: -obj.height/2 * vs, width: obj.width * vs, height: obj.height * vs, fill: obj.fill || '#334155', opacity: 0.3, listening: true }" />
              <template v-for="(cc, ci) in polarCircleConfigs(obj)" :key="'pc'+ci">
                <v-circle :config="cc" />
              </template>
              <template v-for="(sl, si) in polarSpokeConfigs(obj)" :key="'ps'+si">
                <v-line :config="sl" />
              </template>
              <v-text :config="{ text: 'PolarPlane', x: -30, y: -obj.height/2 * vs + 4, fontSize: 10, fill: '#94a3b8', listening: false }" />
            </v-group>

            <!-- NumberLine -->
            <v-group v-if="obj.type === 'numberline' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="{ x: -obj.width/2 * vs, y: -16, width: obj.width * vs, height: 32, fill: 'rgba(0,0,0,0.01)', listening: true }" />
              <v-line :config="{ points: [-obj.width/2 * vs, 0, obj.width/2 * vs, 0], stroke: obj.stroke || '#ffffff', strokeWidth: 2, listening: false }" />
              <v-line :config="{ points: [obj.width/2 * vs - 8 * vs, -5 * vs, obj.width/2 * vs, 0, obj.width/2 * vs - 8 * vs, 5 * vs], stroke: obj.stroke || '#ffffff', strokeWidth: 2, listening: false }" />
              <v-text :config="{ text: 'NumberLine', x: -30, y: -16, fontSize: 10, fill: '#94a3b8', listening: false }" />
            </v-group>

            <!-- Matrix -->
            <v-group v-if="obj.type === 'matrix' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="matrixHitCfg(obj)" />
              <v-line v-for="(b, bi) in matrixBracketConfigs(obj)" :key="'mb'+bi" :config="b" />
              <v-text v-for="(t, ti) in matrixCellConfigs(obj)" :key="'mc'+ti" :config="t" />
            </v-group>

            <!-- Table -->
            <v-group v-if="obj.type === 'table' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="tableHitCfg(obj)" />
              <v-line v-for="(l, li) in tableGridLines(obj)" :key="'tgl'+li" :config="l" />
              <v-text v-for="(tc, ti) in tableCellConfigs(obj)" :key="'tc'+ti" :config="tc" />
            </v-group>

            <!-- Brace -->
            <v-group v-if="obj.type === 'brace' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="relationalHitCfg(obj)" />
              <v-line :config="braceLineCfg(obj)" />
              <v-text v-if="obj.label" :config="relationalLabelCfg(obj, braceLabelAnchor(obj))" />
            </v-group>

            <!-- Angle -->
            <v-group v-if="obj.type === 'angle' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="relationalHitCfg(obj)" />
              <v-line v-for="(rc, ri) in angleRayCfgs(obj)" :key="'ar'+ri" :config="rc" />
              <v-line v-if="!obj.rightAngle" :config="angleArcCfg(obj)" />
              <v-line v-if="obj.rightAngle" :config="angleSquareCfg(obj)" />
              <v-text v-if="obj.label" :config="relationalLabelCfg(obj, angleLabelAnchor(obj))" />
            </v-group>

            <!-- Graph / DiGraph -->
            <v-group v-if="obj.type === 'graph' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)" @transform="onTransform(obj.id, $event)" @transformend="onTransformEnd(obj.id, $event)">
              <v-rect :config="graphHitCfg(obj)" />
              <template v-for="(ecfg, ei) in graphEdgeConfigs(obj)" :key="'ge' + ei">
                <v-arrow v-if="obj.directed" :config="ecfg" />
                <v-line v-else :config="ecfg" />
              </template>
              <v-circle v-for="(vcfg, vi) in graphVertexConfigs(obj)" :key="'gv' + vi" :config="vcfg" />
              <template v-if="obj.showLabels">
                <v-text v-for="(lcfg, li) in graphLabelConfigs(obj)" :key="'gl' + li" :config="lcfg" />
              </template>
            </v-group>

            <!-- Vector Field -->
            <v-group v-if="obj.type === 'vector_field' && isVis(obj.id)" :config="groupCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDragEnd(obj.id, $event)">
              <v-rect :config="vectorFieldHitCfg(obj)" />
              <template v-for="(acfg, ai) in vectorFieldArrows(obj)" :key="'vfa' + ai">
                <v-arrow :config="acfg" />
              </template>
            </v-group>

            <!-- 3D: Sphere -->
            <template v-if="obj.type === 'sphere' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-circle :config="sphere3dCfg(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event)" />
            </template>

            <!-- 3D: Cube (real box — depth-sorted shaded faces) -->
            <template v-if="obj.type === 'cube' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group :config="obj3dCenter(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event)">
                <v-line v-for="(f, fi) in cube3dFaces(obj)" :key="'cf' + fi" :config="f" />
              </v-group>
            </template>

            <!-- 3D: Cone/Cylinder (real silhouettes) -->
            <template v-if="['cone', 'cylinder'].includes(obj.type) && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group :config="obj3dCenter(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event)">
                <v-line v-for="(pt, pi) in round3dParts(obj)" :key="'rp' + pi" :config="pt" />
              </v-group>
            </template>

            <!-- 3D: Torus (donut tube) -->
            <template v-if="obj.type === 'torus' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group :config="obj3dCenter(obj)" @mousedown="onObjDown(obj.id, $event)" @dragend="onDrag3DEnd(obj.id, $event)">
                <v-circle v-for="(seg, si) in torus3dTube(obj)" :key="'tt' + si" :config="seg" />
                <v-line v-for="(ln, li) in torusOutline(obj)" :key="'tol' + li" :config="ln" />
              </v-group>
            </template>

            <!-- 3D: Axes3D -->
            <template v-if="obj.type === 'axes3d' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group :config="{ x: 0, y: 0 }" @mousedown="onObjDown(obj.id, $event)">
                <v-line v-for="(axLine, axIdx) in axes3dLines(obj)" :key="'ax3d' + axIdx" :config="axLine" />
              </v-group>
            </template>
          </template>

          <!-- 3D committed path polylines -->
          <template v-for="pl in path3dPolylines" :key="pl.id">
            <v-line :config="pl" />
          </template>

          <!-- Circumscribe emphasis overlays -->
          <template v-for="o in emphasisOverlays" :key="o.id">
            <v-rect v-if="o.kind === 'rect'" :config="o" />
            <v-ellipse v-else :config="o" />
          </template>
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

        <v-layer v-if="polygonHandles">
          <v-circle v-for="pt in polygonHandles.points" :key="'pv' + pt.key"
            :config="{ x: pt.cx, y: pt.cy, radius: 6, fill: '#4CEEF9', stroke: '#0b1020', strokeWidth: 1.5, draggable: true }"
            @dragmove="onVertexDrag(pt.key, $event)" @dragend="onVertexDragEnd" />
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

      <!-- 3D view selector (overlay, top-left) -->
      <div v-if="is3D" class="absolute top-2 left-2" style="z-index: var(--z-overlay);">
        <select
          :value="store.project.camera3d?.view ?? 'perspective'"
          @change="store.setCamera3d({ view: $event.target.value })"
          class="text-xs bg-studio-surface border border-studio-border rounded px-2 py-1 text-studio-text shadow cursor-pointer"
          title="3D view"
        >
          <option value="perspective">Perspective</option>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
          <option value="front">Front</option>
          <option value="back">Back</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>

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
import * as shapes2d from './configs/shapes2d.js';
import * as text from './configs/text.js';
import { useProjectStore } from '../../store/project.js';
import { generateDotGridPositions } from '../../engine/geometry.js';
import { applyOverrides } from '../../engine/blending.js';
import { project3D, unprojectIso, perspectiveScale } from '../../engine/projection3d.js';
import { loadFont, isFontLoaded } from '../../utils/fontLoader.js';
import { canvasToVertex } from '../../engine/polygonVertices.js';
import { compileExpr, isSafeExpr } from '../../engine/mathExpr.js';

const store = useProjectStore();

// ── 3D Projection ─────────────────────────────────────────────────────────
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

// Faint reference XYZ axes + XY floor grid. Each segment is geometrically
// clipped (Liang–Barsky) to its panel rectangle so camera zoom (cam3d.zoom)
// can never push the gizmo past the panel/canvas edges. (Konva group clip
// proved unreliable through vue-konva, so we clip the geometry ourselves.)
const REF_AXIS_LEN = 4;
const FLOOR_GRID_EXT = 5;
const AXIS_COLORS = { x: '#f87171', y: '#4ade80', z: '#60a5fa' };

// Clip segment (x0,y0)-(x1,y1) to rect [rx0,ry0,rx1,ry1]; returns trimmed
// [x0,y0,x1,y1] or null if fully outside.
function _clipSeg(x0, y0, x1, y1, rx0, ry0, rx1, ry1) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy], q = [x0 - rx0, rx1 - x0, y0 - ry0, ry1 - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; }
    else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}
// Clip rect = the VISIBLE black viewport (bgConfig rect), not the full Konva
// stage — the backdrop is scaled by vs and offset by ox/oy, so clipping to the
// full stage would let the gizmo spill into the inset margin around it.
const isoRect = computed(() => {
  const w = stg.value.width * vs.value, h = stg.value.height * vs.value;
  return [ox.value, oy.value, ox.value + w, oy.value + h];
});
function _axCfg(a, b, stroke, r) {
  const c = _clipSeg(a.px, a.py, b.px, b.py, r[0], r[1], r[2], r[3]);
  return c ? { points: c, stroke, strokeWidth: 1.5, opacity: 0.3, dash: [5, 5], listening: false } : null;
}
function _gridCfg(a, b, r) {
  const c = _clipSeg(a.px, a.py, b.px, b.py, r[0], r[1], r[2], r[3]);
  return c ? { points: c, stroke: '#64748b', strokeWidth: 1, opacity: 0.1, listening: false } : null;
}
function _lblCfg(p, text, fill, r) {
  if (p.px < r[0] || p.px > r[2] || p.py < r[1] || p.py > r[3]) return null;
  return { x: p.px + 4, y: p.py - 7, text, fontSize: 12, fontStyle: 'bold', fill, opacity: 0.5, listening: false };
}

const refAxesIso = computed(() => {
  if (!is3D.value) return [];
  const L = REF_AXIS_LEN, s = proj3DScale.value, cx = projCx.value, cy = projCy.value, r = isoRect.value;
  return [
    _axCfg(isoRef(-L, 0, 0, cx, cy, s), isoRef(L, 0, 0, cx, cy, s), AXIS_COLORS.x, r),
    _axCfg(isoRef(0, -L, 0, cx, cy, s), isoRef(0, L, 0, cx, cy, s), AXIS_COLORS.y, r),
    _axCfg(isoRef(0, 0, -L, cx, cy, s), isoRef(0, 0, L, cx, cy, s), AXIS_COLORS.z, r),
  ].filter(Boolean);
});
const refLabelsIso = computed(() => {
  if (!is3D.value) return [];
  const L = REF_AXIS_LEN, s = proj3DScale.value, cx = projCx.value, cy = projCy.value, r = isoRect.value;
  return [
    _lblCfg(isoRef(L, 0, 0, cx, cy, s), 'X', AXIS_COLORS.x, r),
    _lblCfg(isoRef(0, L, 0, cx, cy, s), 'Y', AXIS_COLORS.y, r),
    _lblCfg(isoRef(0, 0, L, cx, cy, s), 'Z', AXIS_COLORS.z, r),
  ].filter(Boolean);
});
const floorGridIso = computed(() => {
  if (!is3D.value) return [];
  const G = FLOOR_GRID_EXT, s = proj3DScale.value, cx = projCx.value, cy = projCy.value, r = isoRect.value;
  const out = [];
  for (let i = -G; i <= G; i++) {
    if (i === 0) continue;
    const a = _gridCfg(isoRef(-G, i, 0, cx, cy, s), isoRef(G, i, 0, cx, cy, s), r); if (a) out.push(a);
    const b = _gridCfg(isoRef(i, -G, 0, cx, cy, s), isoRef(i, G, 0, cx, cy, s), r); if (b) out.push(b);
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
      const t = iso(p.x3d, p.y3d ?? 0, p.z3d, projCx.value, projCy.value, proj3DScale.value);
      return { cx: t.px, cy: t.py };   // iso() returns canvas px — no s2c
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

const polygonHandles = computed(() => {
  if (store.activeTool !== 'select' || store.selectedObjectIds.length !== 1) return null;
  const obj = store.objectById(store.selectedObjectIds[0]);
  if (!obj) return null;
  const c = s2c(obj.x, obj.y);
  if (obj.type === 'polygon_free' && Array.isArray(obj.vertices)) {
    return { id: obj.id, kind: 'vertices',
      points: obj.vertices.map(([vx, vy], i) => ({ key: i, cx: c.x + vx * vs.value, cy: c.y + vy * vs.value })) };
  }
  if (obj.type === 'brace') {
    return { id: obj.id, kind: 'relational',
      points: ['p1', 'p2'].map(k => ({ key: k, cx: c.x + obj[k][0] * vs.value, cy: c.y + obj[k][1] * vs.value })) };
  }
  if (obj.type === 'angle') {
    return { id: obj.id, kind: 'relational',
      points: ['vertex', 'point1', 'point2'].map(k => ({ key: k, cx: c.x + obj[k][0] * vs.value, cy: c.y + obj[k][1] * vs.value })) };
  }
  if (obj.type === 'graph' && obj.positions && typeof obj.positions === 'object') {
    return { id: obj.id, kind: 'graph',
      points: Object.keys(obj.positions).map(k => ({ key: k, cx: c.x + obj.positions[k][0] * vs.value, cy: c.y + obj.positions[k][1] * vs.value })) };
  }
  return null;
});

function onVertexDrag(key, evt) {
  const h = polygonHandles.value; if (!h) return;
  const obj = store.objectById(h.id); if (!obj) return;
  const c = s2c(obj.x, obj.y);
  const node = evt.target;
  const nv = canvasToVertex(node.x(), node.y(), c.x, c.y, vs.value);
  if (h.kind === 'vertices') {
    const arr = obj.vertices.slice(); arr[key] = nv; obj.vertices = arr;
  } else if (h.kind === 'graph') {
    obj.positions[key] = [Math.round(nv[0]), Math.round(nv[1])];
  } else {
    obj[key] = nv;
  }
}
function onVertexDragEnd() {
  store.commitState();
}

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

// ── Emphasis overlay (circumscribe) ──────────────────────────────────────
const emphasisOverlays = computed(() => {
  const out = [];
  const ovMap = frameState.value.objectOverrides || {};
  for (const obj of objects.value) {
    const ov = ovMap[obj.id];
    const e = ov && ov._emphasis;
    if (!e || e.kind !== 'circumscribe') continue;
    const m = eff(obj);
    const c = s2c(m.x, m.y);
    const w = (m.width || 100) * 1.25 * vs.value;
    const h = (m.height || 100) * 1.25 * vs.value;
    const p = e.progress;
    const op = e.fadeOut ? Math.sin(Math.PI * p) : Math.min(1, p * 2);
    const base = { stroke: e.color, strokeWidth: 3, opacity: Math.max(0, op), listening: false, id: obj.id + '-emph' };
    if (e.shape === 'Circle') {
      out.push({ ...base, kind: 'ellipse', x: c.x, y: c.y, radiusX: w / 2, radiusY: h / 2 });
    } else {
      out.push({ ...base, kind: 'rect', x: c.x - w / 2, y: c.y - h / 2, width: w, height: h });
    }
  }
  return out;
});

// Draw committed 3D path_move paths as a polyline in the single 3D view (visual only).
const path3dPolylines = computed(() => {
  if (!is3D.value) return [];
  const out = [];
  for (const track of store.project.tracks || []) {
    for (const clip of track.clips || []) {
      if (clip.type !== 'path_move' || !Array.isArray(clip.path)) continue;
      if (!(clip.path[0] && 'x3d' in clip.path[0])) continue;
      const pts = [];
      for (const pt of clip.path) {
        const i = iso(pt.x3d, pt.y3d ?? 0, pt.z3d, projCx.value, projCy.value, proj3DScale.value);
        pts.push(i.px, i.py);
      }
      out.push({ stroke: '#a855f7', strokeWidth: 1.5, dash: [4, 4], listening: false, opacity: 0.7, points: pts, id: clip.id + '-path3d' });
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
// ── Effect preview helpers ──
function hexToRgba(h, a) {
  if (typeof h !== 'string' || !h.startsWith('#')) return h;
  let s = h.slice(1);
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (s.length !== 6) return h;
  const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return h;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
/** Mutates a Konva config with gradient / cornerRadius / dashed / per-channel alpha.
 *  centered = shape origin is its center (circle/star/polygon/triangle) vs top-left (rect). */
function applyEffects(cfg, obj, w, h, centered) {
  // per-channel opacity → baked into rgba colors (node opacity stays the master)
  if (obj.fillOpacity != null && obj.fillOpacity !== 1 && cfg.fill) cfg.fill = hexToRgba(cfg.fill, obj.fillOpacity);
  if (obj.strokeOpacity != null && obj.strokeOpacity !== 1 && cfg.stroke) cfg.stroke = hexToRgba(cfg.stroke, obj.strokeOpacity);
  // gradient
  const g = obj.gradient;
  if (g && Array.isArray(g.colors) && g.colors.length >= 2) {
    const rad = (g.angle ?? 135) * Math.PI / 180;
    const dx = Math.cos(rad) * w / 2, dy = Math.sin(rad) * h / 2;
    const cx = centered ? 0 : w / 2, cy = centered ? 0 : h / 2;
    cfg.fillLinearGradientStartPoint = { x: cx - dx, y: cy - dy };
    cfg.fillLinearGradientEndPoint = { x: cx + dx, y: cy + dy };
    const stops = [];
    const ga = (obj.fillOpacity != null && obj.fillOpacity !== 1) ? obj.fillOpacity : null;
    g.colors.forEach((c, i) => { stops.push(i / (g.colors.length - 1), ga != null ? hexToRgba(c, ga) : c); });
    cfg.fillLinearGradientColorStops = stops;
  }
  // dashed stroke (Konva keeps fill underneath, matching the render's VGroup)
  if (obj.dash) {
    const peri = centered ? Math.PI * Math.max(w, h) : (h === 0 ? w : 2 * (w + h));
    const on = Math.max(2, peri / Math.max(2, obj.dash.numDashes) * (obj.dash.ratio ?? 0.5));
    const off = Math.max(2, peri / Math.max(2, obj.dash.numDashes) * (1 - (obj.dash.ratio ?? 0.5)));
    cfg.dash = [on, off];
  }
  // drop shadow (Konva native; blur is preview-only — Manim has no blur)
  if (obj.shadow) {
    cfg.shadowColor = obj.shadow.color || '#000000';
    cfg.shadowOpacity = obj.shadow.opacity ?? 0.4;
    cfg.shadowBlur = (obj.shadow.blur ?? 12) * vs.value;
    cfg.shadowOffset = { x: (obj.shadow.dx ?? 8) * vs.value, y: (obj.shadow.dy ?? 8) * vs.value };
  }
  // corner rounding for polygon/triangle/star — rect/square round via rectCfg before applyEffects
  if (obj.cornerRadius > 0) {
    if (obj.type === 'star' || obj.type === 'polygon') {
      // Konva Star and RegularPolygon support native cornerRadius
      cfg.cornerRadius = obj.cornerRadius * vs.value;
    } else if (obj.type === 'triangle') {
      // Konva Line (closed) has no cornerRadius; use tension as an approximation
      cfg.tension = 0.35;
    }
  }
  return cfg;
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
// Transparent rect spanning the dot grid — the group's hit area, so the whole
// grid (not just the tiny dots) can be selected/dragged on the canvas.
function dotGridHitCfg(obj) {
  const sp = (obj.dotSpacing || 40) * vs.value, r = Math.max(2, (obj.dotRadius || 5) * vs.value);
  const pts = generateDotGridPositions(obj.gridCols || 5, obj.gridRows || 5, sp);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  if (!isFinite(minX)) { minX = minY = maxX = maxY = 0; }
  return { x: minX - r, y: minY - r, width: (maxX - minX) + 2 * r, height: (maxY - minY) + 2 * r, fill: 'rgba(0,0,0,0.01)', listening: true };
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


// ── Matrix config ──
function matrixHitCfg(obj) {
  const w = (obj.width || 160) * vs.value;
  const h = (obj.height || 120) * vs.value;
  // listening:true → group hit area so the matrix can be selected/dragged
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(76,238,249,0.04)', stroke: themeAccent.value, strokeWidth: 1, dash: [6, 4], cornerRadius: 4, listening: true };
}

function matrixCellConfigs(obj) {
  const data = (Array.isArray(obj.matrixData) && obj.matrixData.length) ? obj.matrixData : [['1', '0'], ['0', '1']];
  const rows = data.length, cols = data[0]?.length || 1;
  const w = (obj.width || 160) * vs.value, h = (obj.height || 120) * vs.value;
  const padX = 0.18 * w, padY = 0.12 * h;
  const cellW = cols > 1 ? (w - 2 * padX) / (cols - 1) : 0;
  const cellH = rows > 1 ? (h - 2 * padY) / (rows - 1) : 0;
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = cols > 1 ? (-w / 2 + padX + c * cellW) : 0;
      const cy = rows > 1 ? (-h / 2 + padY + r * cellH) : 0;
      out.push({ x: cx - 16, y: cy - 8, width: 32, text: String(data[r][c]), align: 'center',
        fontSize: Math.max(10, 16 * vs.value), fill: obj.fill || '#ffffff', listening: false });
    }
  }
  return out;
}

function matrixBracketConfigs(obj) {
  const w = (obj.width || 160) * vs.value, h = (obj.height || 120) * vs.value;
  const bx = 0.40 * w, top = -h / 2 + 0.04 * h, bot = h / 2 - 0.04 * h, tick = 0.06 * w;
  const col = obj.fill || '#ffffff';
  if (obj.bracket === '|') {
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
function tableHitCfg(obj) {
  const w = (obj.width || 200) * vs.value;
  const h = (obj.height || 140) * vs.value;
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(76,238,249,0.04)', stroke: themeAccent.value, strokeWidth: 1, dash: [6, 4], cornerRadius: 4, listening: true };
}

function tableCellConfigs(obj) {
  const data = (Array.isArray(obj.cellData) && obj.cellData.length) ? obj.cellData : [['1', '2'], ['3', '4']];
  const rows = data.length, cols = data[0]?.length || 1;
  const hasRowLabels = Array.isArray(obj.rowLabels) && obj.rowLabels.length > 0;
  const hasColLabels = Array.isArray(obj.colLabels) && obj.colLabels.length > 0;
  const w = (obj.width || 200) * vs.value, h = (obj.height || 140) * vs.value;
  const labelColW = hasRowLabels ? w * 0.18 : 0;
  const labelRowH = hasColLabels ? h * 0.16 : 0;
  const gridW = w - labelColW, gridH = h - labelRowH;
  const cellW = cols > 0 ? gridW / cols : gridW;
  const cellH = rows > 0 ? gridH / rows : gridH;
  const gridX = -w / 2 + labelColW, gridY = -h / 2 + labelRowH;
  const fs = Math.max(9, 13 * vs.value);
  const col = obj.fill || '#ffffff';
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: gridX + c * cellW, y: gridY + r * cellH, width: cellW, height: cellH,
        text: String(data[r][c]), align: 'center', verticalAlign: 'middle',
        fontSize: fs, fill: col, listening: false });
    }
  }
  if (hasRowLabels) {
    for (let r = 0; r < rows; r++) {
      const lbl = obj.rowLabels[r] != null ? String(obj.rowLabels[r]) : '';
      out.push({ x: -w / 2, y: gridY + r * cellH, width: labelColW, height: cellH,
        text: lbl, align: 'center', verticalAlign: 'middle',
        fontSize: fs, fill: themeAccent.value, fontStyle: 'italic', listening: false });
    }
  }
  if (hasColLabels) {
    for (let c = 0; c < cols; c++) {
      const lbl = obj.colLabels[c] != null ? String(obj.colLabels[c]) : '';
      out.push({ x: gridX + c * cellW, y: -h / 2, width: cellW, height: labelRowH,
        text: lbl, align: 'center', verticalAlign: 'middle',
        fontSize: fs, fill: themeAccent.value, fontStyle: 'italic', listening: false });
    }
  }
  return out;
}

function tableGridLines(obj) {
  const data = (Array.isArray(obj.cellData) && obj.cellData.length) ? obj.cellData : [['1', '2'], ['3', '4']];
  const rows = data.length, cols = data[0]?.length || 1;
  const hasRowLabels = Array.isArray(obj.rowLabels) && obj.rowLabels.length > 0;
  const hasColLabels = Array.isArray(obj.colLabels) && obj.colLabels.length > 0;
  const w = (obj.width || 200) * vs.value, h = (obj.height || 140) * vs.value;
  const labelColW = hasRowLabels ? w * 0.18 : 0;
  const labelRowH = hasColLabels ? h * 0.16 : 0;
  const gridW = w - labelColW, gridH = h - labelRowH;
  const cellW = cols > 0 ? gridW / cols : gridW;
  const cellH = rows > 0 ? gridH / rows : gridH;
  const gridX = -w / 2 + labelColW, gridY = -h / 2 + labelRowH;
  const col = obj.stroke || '#4ceef9';
  const sw = Math.max(0.5, vs.value);
  const lines = [];
  for (let r = 0; r <= rows; r++) {
    const y = gridY + r * cellH;
    lines.push({ points: [gridX, y, gridX + gridW, y], stroke: col, strokeWidth: sw, opacity: 0.4, listening: false });
  }
  for (let c = 0; c <= cols; c++) {
    const x = gridX + c * cellW;
    lines.push({ points: [x, gridY, x, gridY + gridH], stroke: col, strokeWidth: sw, opacity: 0.4, listening: false });
  }
  return lines;
}

// ── PolarPlane config ──
function polarCircleConfigs(obj) {
  const rMax = (Number.isFinite(obj.radiusMax) && obj.radiusMax > 0) ? obj.radiusMax : 4;
  const rStep = Number.isFinite(obj.radiusStep) && obj.radiusStep > 0 ? obj.radiusStep : 1;
  const halfSize = Math.min(obj.width || 400, obj.height || 400) / 2 * vs.value;
  const rings = Math.floor(rMax / rStep);
  const col = obj.stroke || '#64748b';
  const sw = Math.max(0.5, vs.value);
  const configs = [];
  for (let i = 1; i <= rings; i++) {
    const r = (i * rStep / rMax) * halfSize;
    configs.push({ x: 0, y: 0, radius: r, stroke: col, strokeWidth: sw, fill: 'transparent', opacity: 0.6, listening: false });
  }
  return configs;
}
function polarSpokeConfigs(obj) {
  const az = Number.isFinite(obj.azimuthUnits) && obj.azimuthUnits >= 1 ? Math.trunc(obj.azimuthUnits) : 12;
  const halfSize = Math.min(obj.width || 400, obj.height || 400) / 2 * vs.value;
  const col = obj.stroke || '#64748b';
  const sw = Math.max(0.5, vs.value);
  const configs = [];
  for (let i = 0; i < az; i++) {
    const angle = (i / az) * 2 * Math.PI;
    const ex = Math.cos(angle) * halfSize;
    const ey = Math.sin(angle) * halfSize;
    configs.push({ points: [0, 0, ex, ey], stroke: col, strokeWidth: sw, opacity: 0.6, listening: false });
  }
  return configs;
}

// ── Relational config (Brace, Angle) ──
function relationalHitCfg(obj) {
  const w = (obj.width || 140) * vs.value, h = (obj.height || 140) * vs.value;
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(76,238,249,0.04)', stroke: themeAccent.value, strokeWidth: 1, dash: [6, 4], cornerRadius: 4, listening: true };
}

function relationalLabelCfg(obj, anchor) {
  return { x: anchor[0] - 12, y: anchor[1] - 8, width: 24, text: obj.label || '', align: 'center',
    fontSize: Math.max(11, 16 * vs.value), fill: obj.fill || '#ffffff', fontStyle: 'italic', listening: false };
}

function braceLineCfg(obj) {
  const p1 = obj.p1 || [-80, 0], p2 = obj.p2 || [80, 0];
  const z = vs.value;
  const ax = p1[0] * z, ay = p1[1] * z, bx = p2[0] * z, by = p2[1] * z;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const d = 14 * z;
  const mx = (ax + bx) / 2 + nx * d, my = (ay + by) / 2 + ny * d;
  return { points: [ax, ay, ax + nx * d, ay + ny * d, mx, my, bx + nx * d, by + ny * d, bx, by],
    stroke: obj.stroke || '#ffffff', strokeWidth: 2, lineJoin: 'round', tension: 0.4, listening: false };
}
function braceLabelAnchor(obj) {
  const p1 = obj.p1 || [-80, 0], p2 = obj.p2 || [80, 0];
  const z = vs.value;
  const ax = p1[0] * z, ay = p1[1] * z, bx = p2[0] * z, by = p2[1] * z;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return [(ax + bx) / 2 + nx * 26 * z, (ay + by) / 2 + ny * 26 * z];
}

function angleRayCfgs(obj) {
  const z = vs.value;
  const v = obj.vertex || [-40, 40], p1 = obj.point1 || [80, 40], p2 = obj.point2 || [-40, -60];
  const col = obj.stroke || '#fbbf24';
  return [
    { points: [v[0] * z, v[1] * z, p1[0] * z, p1[1] * z], stroke: col, strokeWidth: 2, listening: false },
    { points: [v[0] * z, v[1] * z, p2[0] * z, p2[1] * z], stroke: col, strokeWidth: 2, listening: false },
  ];
}
function angleArcCfg(obj) {
  const z = vs.value;
  const v = obj.vertex || [-40, 40], p1 = obj.point1 || [80, 40], p2 = obj.point2 || [-40, -60];
  const a1 = Math.atan2(p1[1] - v[1], p1[0] - v[0]);
  const a2 = Math.atan2(p2[1] - v[1], p2[0] - v[0]);
  const r = (obj.radius || 0.6) / 14.222 * (stg.value.width) * z * 0.5;
  const pts = [];
  let start = a1, end = a2;
  if (end < start) end += Math.PI * 2;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = start + (end - start) * (i / steps);
    pts.push(v[0] * z + Math.cos(a) * r, v[1] * z + Math.sin(a) * r);
  }
  return { points: pts, stroke: obj.stroke || '#fbbf24', strokeWidth: 2, listening: false };
}
function angleSquareCfg(obj) {
  const z = vs.value;
  const v = obj.vertex || [-40, 40], p1 = obj.point1 || [80, 40], p2 = obj.point2 || [-40, -60];
  const u1a = Math.atan2(p1[1] - v[1], p1[0] - v[0]);
  const u2a = Math.atan2(p2[1] - v[1], p2[0] - v[0]);
  const r = 16 * z;
  const c1 = [v[0] * z + Math.cos(u1a) * r, v[1] * z + Math.sin(u1a) * r];
  const c2 = [v[0] * z + Math.cos(u2a) * r, v[1] * z + Math.sin(u2a) * r];
  const corner = [c1[0] + (c2[0] - v[0] * z), c1[1] + (c2[1] - v[1] * z)];
  return { points: [c1[0], c1[1], corner[0], corner[1], c2[0], c2[1]], stroke: obj.stroke || '#fbbf24', strokeWidth: 2, listening: false };
}
function angleLabelAnchor(obj) {
  const z = vs.value;
  const v = obj.vertex || [-40, 40], p1 = obj.point1 || [80, 40], p2 = obj.point2 || [-40, -60];
  const a1 = Math.atan2(p1[1] - v[1], p1[0] - v[0]);
  const a2 = Math.atan2(p2[1] - v[1], p2[0] - v[0]);
  const mid = (a1 + a2) / 2;
  const r = 34 * z;
  return [v[0] * z + Math.cos(mid) * r, v[1] * z + Math.sin(mid) * r];
}

// ── Graph / DiGraph config ──
function graphHitCfg(obj) {
  const w = (obj.width || 200) * vs.value, h = (obj.height || 200) * vs.value;
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(76,238,249,0.04)', stroke: themeAccent.value, strokeWidth: 1, dash: [6, 4], cornerRadius: 4, listening: true };
}
function graphEdgeConfigs(obj) {
  const z = vs.value;
  const pos = obj.positions || {};
  const col = obj.stroke || '#94a3b8';
  const sw = Math.max(1.5, 2 * z);
  const ptSize = 8 * z;
  const configs = [];
  for (const [a, b] of (obj.edges || [])) {
    const pa = pos[a], pb = pos[b];
    if (!pa || !pb) continue;
    const ax = pa[0] * z, ay = pa[1] * z, bx = pb[0] * z, by = pb[1] * z;
    if (obj.directed) {
      // shorten end point so arrowhead doesn't overlap the vertex circle
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const ex = bx - dx / len * ptSize, ey = by - dy / len * ptSize;
      configs.push({ points: [ax, ay, ex, ey], stroke: col, strokeWidth: sw, fill: col,
        pointerLength: 8 * z, pointerWidth: 6 * z, lineCap: 'round', listening: false });
    } else {
      configs.push({ points: [ax, ay, bx, by], stroke: col, strokeWidth: sw, lineCap: 'round', listening: false });
    }
  }
  return configs;
}
function graphVertexConfigs(obj) {
  const z = vs.value;
  const pos = obj.positions || {};
  const col = obj.fill || '#4ceef9';
  const strokeCol = obj.stroke || '#94a3b8';
  const r = 8 * z;
  return Object.keys(pos).map(k => ({
    x: pos[k][0] * z, y: pos[k][1] * z, radius: r,
    fill: col, stroke: strokeCol, strokeWidth: Math.max(1, 1.5 * z), listening: false,
  }));
}
function graphLabelConfigs(obj) {
  const z = vs.value;
  const pos = obj.positions || {};
  const fs = Math.max(10, 13 * z);
  return Object.keys(pos).map(k => ({
    x: pos[k][0] * z - 12, y: pos[k][1] * z - 10 - 8 * z,
    width: 24, text: k, align: 'center',
    fontSize: fs, fill: obj.fill || '#ffffff', listening: false,
  }));
}

// ── Vector Field config ──
function vectorFieldHitCfg(obj) {
  const w = (obj.width || 600) * vs.value, h = (obj.height || 400) * vs.value;
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(56,189,248,0.04)', stroke: themeAccent.value, strokeWidth: 1, dash: [6, 4], cornerRadius: 4, listening: true };
}
function _compileField2(expr) {
  // compile expr(x,y) using the same SCOPE as compileExpr but with two variables
  const SCOPE2 =
    'const np={sin:Math.sin,cos:Math.cos,tan:Math.tan,arcsin:Math.asin,arccos:Math.acos,' +
    'arctan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,log:Math.log,sign:Math.sign,' +
    'power:Math.pow,floor:Math.floor,ceil:Math.ceil,pi:Math.PI,e:Math.E};' +
    'const PI=Math.PI,TAU=2*Math.PI,E=Math.E;';
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('x', 'y', '"use strict";' + SCOPE2 + 'return (' + expr + ');');
    const probe = fn(1, 1);
    if (typeof probe !== 'number') return null;
    return fn;
  } catch { return null; }
}
function vectorFieldArrows(obj) {
  const z = vs.value;
  const xr = Array.isArray(obj.xRange) ? obj.xRange : [-3, 3, 1];
  const yr = Array.isArray(obj.yRange) ? obj.yRange : [-2, 2, 1];
  const xMin = xr[0], xMax = xr[1], yMin = yr[0], yMax = yr[1];
  const fxExpr = isSafeExpr(obj.fx) ? String(obj.fx).trim() : 'y';
  const fyExpr = isSafeExpr(obj.fy) ? String(obj.fy).trim() : '-x';
  const fxFn = _compileField2(fxExpr);
  const fyFn = _compileField2(fyExpr);
  if (!fxFn || !fyFn) return [];
  const GRID = 8;
  // unit: canvas px per Manim unit
  const unitX = (obj.width || 600) * z / (xMax - xMin || 1);
  const unitY = (obj.height || 400) * z / (yMax - yMin || 1);
  const arrowLen = Math.min(unitX, unitY) * 0.55;
  const configs = [];
  const col = obj.stroke || '#38bdf8';
  const sw2 = Math.max(1, (obj.strokeWidth || 2) * z / 2);
  for (let ix = 0; ix < GRID; ix++) {
    for (let iy = 0; iy < GRID; iy++) {
      const gx = xMin + (ix + 0.5) / GRID * (xMax - xMin);
      const gy = yMin + (iy + 0.5) / GRID * (yMax - yMin);
      const vx = fxFn(gx, gy), vy = fyFn(gx, gy);
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) continue;
      const mag = Math.sqrt(vx * vx + vy * vy);
      if (mag < 1e-12) continue;
      const nx = (vx / mag) * arrowLen, ny = (vy / mag) * arrowLen;
      // canvas coords: x maps right (+), y maps down (flip y)
      const cx = -(obj.width || 600) * z / 2 + (ix + 0.5) / GRID * (obj.width || 600) * z;
      const cy = -(obj.height || 400) * z / 2 + (iy + 0.5) / GRID * (obj.height || 400) * z;
      configs.push({
        points: [cx - nx / 2, cy + ny / 2, cx + nx / 2, cy - ny / 2],
        stroke: col, strokeWidth: sw2,
        fill: col, pointerLength: Math.max(4, arrowLen * 0.3), pointerWidth: Math.max(3, arrowLen * 0.25),
        opacity: obj.opacity ?? 1, listening: false,
      });
    }
  }
  return configs;
}

// ── Axes config ──
function axesBgCfg(obj) {
  const L = live(obj); const w = L ? L.w : obj.width * vs.value, h = L ? L.h : obj.height * vs.value;
  // listening:true → this rect is the group's hit area so the axes can be
  // selected/dragged on the canvas (the lines/ticks/labels stay non-listening).
  return { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(16,185,129,0.04)', stroke: 'rgba(16,185,129,0.15)', strokeWidth: 1, cornerRadius: 4, listening: true };
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
      // 3D: drop a point in the current view's plane; the depth axis is held at
      // the source object's current value.
      const srcObj = store.objectById(pathSourceId.value) || {};
      const patch = unprojectView(pos.x, pos.y, srcObj);
      pathPoints.value.push({
        x3d: srcObj.x3d ?? 0, y3d: srcObj.y3d ?? 0, z3d: srcObj.z3d ?? 0, ...patch,
      });
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
// Map a canvas point back to 3D for the current view. Axis views update the two
// in-plane axes (depth axis held); perspective holds y3d and solves x3d/z3d.
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
function onDrag3DEnd(objId, e) {
  const node = e.target;
  const obj = store.project.objects.find(o => o.id === objId);
  const patch = unprojectView(node.x(), node.y(), obj);
  if (patch) store.updateObject(objId, patch);
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
  return type === 'axes' || type === 'latex' || type === 'dot_grid' || type === 'numberplane' || type === 'complex_plane' || type === 'polar_plane' || type === 'numberline';
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
    const fn = compileExpr(graph.expression, 'x');
    if (!fn) continue;

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
function axesAreaRiemann(obj) {
  if (!obj.graphs || obj.graphs.length === 0) return { areas: [], rects: [] };
  const xr = obj.xRange || [-5, 5, 1], yr = obj.yRange || [-3, 3, 1];
  const xMin = xr[0], xMax = xr[1], yMin = yr[0], yMax = yr[1];
  const pw = obj.width * vs.value, ph = obj.height * vs.value;
  const toCx = (x) => ((x - xMin) / (xMax - xMin)) * pw - pw / 2;
  const toCy = (y) => -((y - yMin) / (yMax - yMin)) * ph + ph / 2;
  const cy0 = toCy(0);
  const areas = [], rects = [];
  for (const graph of obj.graphs) {
    const fn = compileExpr(graph.expression, 'x');
    if (!fn) continue;
    if (graph.area && graph.area.enabled) {
      const a0 = Number.isFinite(graph.area.xMin) ? graph.area.xMin : xMin;
      const a1 = Number.isFinite(graph.area.xMax) ? graph.area.xMax : xMax;
      const pts = [];
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const x = a0 + (a1 - a0) * (i / steps); const y = fn(x);
        if (!Number.isFinite(y)) continue;
        pts.push(toCx(x), toCy(y));
      }
      if (pts.length >= 4) {
        pts.push(toCx(a1), cy0, toCx(a0), cy0);   // close down to the x-axis
        areas.push({ points: pts, closed: true, fill: graph.area.color || graph.color || '#f59e0b',
          opacity: graph.area.opacity ?? 0.5, listening: false });
      }
    }
    if (graph.riemann && graph.riemann.enabled) {
      const r0 = Number.isFinite(graph.riemann.xMin) ? graph.riemann.xMin : xMin;
      const r1 = Number.isFinite(graph.riemann.xMax) ? graph.riemann.xMax : xMax;
      const dx = (Number.isFinite(graph.riemann.dx) && graph.riemann.dx > 0) ? graph.riemann.dx : (r1 - r0) / 10;
      const type = graph.riemann.type || 'left';
      for (let x = r0; x < r1 - 1e-9; x += dx) {
        const sx = type === 'right' ? x + dx : type === 'center' ? x + dx / 2 : x;
        const y = fn(sx);
        if (!Number.isFinite(y)) continue;
        const left = toCx(x), right = toCx(Math.min(x + dx, r1));
        rects.push({ x: left, y: toCy(y), width: right - left, height: cy0 - toCy(y),
          fill: graph.riemann.color || graph.color || '#f59e0b', opacity: 0.45,
          stroke: '#fff', strokeWidth: 0.5, listening: false });
      }
    }
  }
  return { areas, rects };
}
// ── 3D shape rendering helpers ────────────────────────────────────────────
const _DEG = Math.PI / 180;
function _basis3d(phi, theta) {
  const ph = phi * _DEG, th = theta * _DEG;
  return { sp: Math.sin(ph), cp: Math.cos(ph), st: Math.sin(th), ct: Math.cos(th) };
}
function shade(hex, f) {
  let h = (hex || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); if (Number.isNaN(n)) return hex || '#888888';
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) * f), g = cl(((n >> 8) & 255) * f), b = cl((n & 255) * f);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
// Project world point (object-relative offset dx,dy,dz) to screen, minus the
// object's projected centre `c` — i.e. coordinates inside a Konva group placed at c.
function _rel(e3, dx, dy, dz, c) {
  const q = iso(e3.x3d + dx, e3.y3d + dy, e3.z3d + dz, projCx.value, projCy.value, proj3DScale.value);
  return [q.px - c.px, q.py - c.py];
}
// Project a circle of radius R (in the plane perpendicular to `axis`, offset
// `off` along it) → array of [x,y] points relative to centre c.
function _circlePts(e3, R, axis, off, c, N = 28) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * 2 * Math.PI, u = R * Math.cos(a), v = R * Math.sin(a);
    out.push(axis === 'z' ? _rel(e3, u, v, off, c) : axis === 'y' ? _rel(e3, u, off, v, c) : _rel(e3, off, u, v, c));
  }
  return out;
}
const _flat = (pairs) => pairs.flatMap(p => p);
// Convex hull (monotone chain) of [x,y] points — used for body silhouettes.
function _hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}

// ── 3D shape configs ──────────────────────────────────────────────────────
// Sphere: a shaded ball via radial gradient (highlight offset top-left).
function sphere3dCfg(obj) {
  const e3 = eff3d(obj);
  const p = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const r = Math.max(4, (obj.radius ?? 0.5) * proj3DScale.value * cam3d.value.zoom * perspectiveScale(e3, cam3d.value));
  const isSelected = store.selectedObjectIds.includes(obj.id);
  const fill = obj.fill ?? '#e67700';
  return {
    x: p.px, y: p.py, radius: r,
    fillRadialGradientStartPoint: { x: -r * 0.35, y: -r * 0.35 },
    fillRadialGradientStartRadius: r * 0.05,
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientEndRadius: r * 1.15,
    fillRadialGradientColorStops: [0, shade(fill, 1.55), 0.55, fill, 1, shade(fill, 0.45)],
    opacity: obj.opacity ?? 1,
    stroke: isSelected ? '#60a5fa' : shade(fill, 0.4), strokeWidth: isSelected ? 2 : 1,
    draggable: true,
  };
}

// Cube: a real box — 6 faces, painter-sorted (far→near), shaded by how much
// each face normal points toward the camera. Returned relative to the centre.
function cube3dFaces(obj) {
  const e3 = eff3d(obj);
  const c = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const h = (obj.sideLength ?? 1.0) / 2;
  const fill = obj.fill ?? '#3b5bdb', op = obj.opacity ?? 1;
  const sel = store.selectedObjectIds.includes(obj.id);
  const b = _basis3d(cam3d.value.phi, cam3d.value.theta);
  const n = { x: b.sp * b.ct, y: b.sp * b.st, z: b.cp }; // direction origin→camera
  const S = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const corners = S.map(s => _rel(e3, s[0] * h, s[1] * h, s[2] * h, c));
  const faces = [
    { idx: [0, 1, 2, 3], nrm: [0, 0, -1] }, { idx: [4, 5, 6, 7], nrm: [0, 0, 1] },
    { idx: [0, 1, 5, 4], nrm: [0, -1, 0] }, { idx: [3, 2, 6, 7], nrm: [0, 1, 0] },
    { idx: [1, 2, 6, 5], nrm: [1, 0, 0] }, { idx: [0, 3, 7, 4], nrm: [-1, 0, 0] },
  ];
  const arr = faces.map(f => {
    const pts = []; let sx = 0, sy = 0, sz = 0;
    for (const i of f.idx) { pts.push(corners[i][0], corners[i][1]); sx += S[i][0]; sy += S[i][1]; sz += S[i][2]; }
    const depth = (e3.x3d + sx / 4 * h) * n.x + (e3.y3d + sy / 4 * h) * n.y + (e3.z3d + sz / 4 * h) * n.z;
    const nd = f.nrm[0] * n.x + f.nrm[1] * n.y + f.nrm[2] * n.z;
    return { points: pts, closed: true, opacity: op, depth,
      fill: shade(fill, 0.5 + 0.55 * Math.max(0, nd)),
      stroke: sel ? '#60a5fa' : shade(fill, 0.35), strokeWidth: sel ? 1.5 : 1 };
  });
  arr.sort((a, b) => a.depth - b.depth);
  return arr;
}

// Projected centre of a 3D object — used to position a Konva group whose
// children (e.g. cube faces) are drawn relative to it (so drag works).
function obj3dCenter(obj) {
  const e3 = eff3d(obj);
  const p = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  return { x: p.px, y: p.py, draggable: true };
}

// Cone / Cylinder: real silhouettes (relative to the object centre).
// Cylinder: body convex-hull + lighter top cap. Cone: base + apex hull.
function round3dParts(obj) {
  const e3 = eff3d(obj);
  const c = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const fill = obj.fill ?? '#888888', op = obj.opacity ?? 1;
  const sel = store.selectedObjectIds.includes(obj.id);
  const edge = sel ? '#60a5fa' : shade(fill, 0.4);
  if (obj.type === 'cylinder') {
    const R = obj.radius ?? 0.5, hh = (obj.height ?? 1.5) / 2;
    const bottom = _circlePts(e3, R, 'z', -hh, c), top = _circlePts(e3, R, 'z', hh, c);
    return [
      { points: _flat(_hull(bottom.concat(top))), closed: true, fill: shade(fill, 0.72), stroke: edge, strokeWidth: 1, opacity: op },
      { points: _flat(top), closed: true, fill: shade(fill, 1.18), stroke: edge, strokeWidth: 1, opacity: op },
    ];
  }
  // cone
  const R = obj.radius ?? 0.5, hh = (obj.height ?? 1.0) / 2;
  const base = _circlePts(e3, R, 'z', -hh, c), apex = _rel(e3, 0, 0, hh, c);
  return [
    { points: _flat(base), closed: true, fill: shade(fill, 0.6), stroke: edge, strokeWidth: 1, opacity: op },
    { points: _flat(_hull(base.concat([apex]))), closed: true, fill: shade(fill, 1.0), stroke: edge, strokeWidth: 1, opacity: op },
  ];
}

// Torus: a donut — overlapping shaded "tube" discs sampled around the major
// ring, painter-sorted (near discs cover far ones → the hole appears naturally).
function torus3dTube(obj) {
  const e3 = eff3d(obj);
  const c = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const Rmaj = obj.majorRadius ?? 1.0, Rmin = obj.minorRadius ?? 0.3;
  const fill = obj.fill ?? '#9c36b5', op = obj.opacity ?? 1;
  const sel = store.selectedObjectIds.includes(obj.id);
  const b = _basis3d(cam3d.value.phi, cam3d.value.theta);
  const n = { x: b.sp * b.ct, y: b.sp * b.st, z: b.cp };
  const tubeR = Math.max(2, Rmin * proj3DScale.value * cam3d.value.zoom);
  const N = 56;
  const segs = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * 2 * Math.PI, wx = Rmaj * Math.cos(a), wy = Rmaj * Math.sin(a);
    const r = _rel(e3, wx, wy, 0, c);
    segs.push({ x: r[0], y: r[1], depth: (e3.x3d + wx) * n.x + (e3.y3d + wy) * n.y + e3.z3d * n.z });
  }
  segs.sort((p, q) => p.depth - q.depth); // far → near
  return segs.map(s => {
    const t = Math.max(0, Math.min(1, (s.depth / (Rmaj || 1) + 1) / 2)); // 0 far, 1 near
    return { x: s.x, y: s.y, radius: tubeR, opacity: op, fill: shade(fill, 0.5 + 0.75 * t) };
  });
}

// Torus silhouette outline (outer + inner ring) — gives a clean edge and the
// blue selection indicator, consistent with the other shapes.
function torusOutline(obj) {
  const e3 = eff3d(obj);
  const c = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const Rmaj = obj.majorRadius ?? 1.0, Rmin = obj.minorRadius ?? 0.3;
  const fill = obj.fill ?? '#9c36b5';
  const sel = store.selectedObjectIds.includes(obj.id);
  const stroke = sel ? '#60a5fa' : shade(fill, 0.45);
  const sw = sel ? 2 : 1;
  return [
    { points: _flat(_circlePts(e3, Rmaj + Rmin, 'z', 0, c)), closed: true, stroke, strokeWidth: sw, listening: false },
    { points: _flat(_circlePts(e3, Rmaj - Rmin, 'z', 0, c)), closed: true, stroke, strokeWidth: sw, listening: false },
  ];
}

function axes3dLines(obj) {
  const e3 = eff3d(obj);
  const s = proj3DScale.value, cx = projCx.value, cy = projCy.value, r = isoRect.value;
  const o = iso(e3.x3d, e3.y3d, e3.z3d, cx, cy, s);
  const ends = [
    [iso(e3.x3d + 3, e3.y3d, e3.z3d, cx, cy, s), '#ff6b6b'],
    [iso(e3.x3d, e3.y3d + 3, e3.z3d, cx, cy, s), '#69db7c'],
    [iso(e3.x3d, e3.y3d, e3.z3d + 3, cx, cy, s), '#74c0fc'],
  ];
  return ends.map(([end, stroke]) => {
    const c = _clipSeg(o.px, o.py, end.px, end.py, r[0], r[1], r[2], r[3]);
    return c ? { points: c, stroke, strokeWidth: 2, listening: false } : null;
  }).filter(Boolean);
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
  // polygon_free is edited via draggable vertex handles, not the resize/rotate
  // transformer — exclude it so its anchors don't overlap the vertex handles.
  const ids = store.selectedObjectIds.filter((id) => {
    const o = store.objectById(id);
    return !o || o.type !== 'polygon_free';
  });
  const nodes = ids.map(findNode).filter(Boolean);
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

// ── shapes2d ctx bridge ──
const ctx = computed(() => ({
  stg: stg.value, vs: vs.value, ox: ox.value, oy: oy.value, s2c, c2s,
  eff, eff3d, live, applyEffects, hexToRgba,
  themeAccent: themeAccent.value, themeSurface: themeSurface.value,
  imageElements, frameState: frameState.value, is3D: is3D.value, cam3d: cam3d.value,
  proj3DScale: proj3DScale.value, projCx: projCx.value, projCy: projCy.value,
  iso, measureTextWidth: text.measureTextWidth,
  activeTool: store.activeTool,
}));
const rectCfg = (o) => shapes2d.rectCfg(o, ctx.value);
const circleCfg = (o) => shapes2d.circleCfg(o, ctx.value);
const ellipseCfg = (o) => shapes2d.ellipseCfg(o, ctx.value);
const dotCfg = (o) => shapes2d.dotCfg(o, ctx.value);
const heartCfg = (o) => shapes2d.heartCfg(o, ctx.value);
const triangleCfg = (o) => shapes2d.triangleCfg(o, ctx.value);
const polygonFreeCfg = (o) => shapes2d.polygonFreeCfg(o, ctx.value);
const parametricCfg = (o) => shapes2d.parametricCfg(o, ctx.value);
const starCfg = (o) => shapes2d.starCfg(o, ctx.value);
const polygonCfg = (o) => shapes2d.polygonCfg(o, ctx.value);
const lineCfg = (o) => shapes2d.lineCfg(o, ctx.value);
const arrowCfg = (o) => shapes2d.arrowCfg(o, ctx.value);
const annulusCfg = (o) => shapes2d.annulusCfg(o, ctx.value);
const sectorCfg = (o) => shapes2d.sectorCfg(o, ctx.value);
const arcCfg = (o) => shapes2d.arcCfg(o, ctx.value);
const doubleArrowCfg = (o) => shapes2d.doubleArrowCfg(o, ctx.value);
const textCfg = (o) => text.textCfg(o, ctx.value);
const counterCfg = (o) => text.counterCfg(o, ctx.value);
const latexBgCfg = (o) => text.latexBgCfg(o, ctx.value);
const latexTextCfg = (o) => text.latexTextCfg(o, ctx.value);
const latexBadgeCfg = (o) => text.latexBadgeCfg(o, ctx.value);

// ── Expose for parent ref calls ──
defineExpose({ startPathDraw });
</script>
