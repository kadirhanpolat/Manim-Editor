<template>
  <div
    class="stage-canvas h-full flex flex-col"
    style="min-height: 0"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div
      ref="container"
      class="flex-1 rounded-xl overflow-hidden relative"
      style="min-height: 0; background: var(--studio-surface2)"
    >
      <v-stage
        ref="konvaStage"
        :config="stageConfig"
        @mousedown="handleStageMouseDown"
        @mousemove="handleStageMouseMove"
        @mouseup="handleStageMouseUp"
        @dblclick="onStageDblClick"
        @wheel="handleWheel"
        @contextmenu="onStageContextMenu"
      >
        <!-- Background layer -->
        <v-layer>
          <v-rect :config="bgConfig" />
          <!-- Grid lines -->
          <template v-if="gridVisible">
            <v-line v-for="(l, i) in gridLines" :key="'g' + i" :config="l" />
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

          <template
            v-for="obj in sortedObjects"
            :key="obj.id + (obj.type === 'text' ? '-' + fontLoadKey : '')"
          >
            <!-- Rectangle / Square -->
            <v-rect
              v-if="(obj.type === 'square' || obj.type === 'rectangle') && isVis(obj.id)"
              :config="rectCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Circle -->
            <v-circle
              v-if="obj.type === 'circle' && isVis(obj.id)"
              :config="circleCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Ellipse -->
            <v-ellipse
              v-if="obj.type === 'ellipse' && isVis(obj.id)"
              :config="ellipseCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Dot -->
            <v-circle
              v-if="obj.type === 'dot' && isVis(obj.id)"
              :config="dotCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />

            <!-- Heart -->
            <v-shape
              v-if="obj.type === 'heart' && isVis(obj.id)"
              :config="heartCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Triangle -->
            <v-line
              v-if="obj.type === 'triangle' && isVis(obj.id)"
              :config="triangleCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Free Polygon -->
            <v-line
              v-if="obj.type === 'polygon_free' && isVis(obj.id)"
              :config="polygonFreeCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />
            <v-line
              v-if="obj.type === 'bezier' && isVis(obj.id)"
              :config="bezierCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />

            <!-- Parametric Curve -->
            <v-line
              v-if="obj.type === 'parametric' && isVis(obj.id)"
              :config="parametricCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />

            <!-- Star -->
            <v-star
              v-if="obj.type === 'star' && isVis(obj.id)"
              :config="starCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Polygon (hexagon) -->
            <v-regular-polygon
              v-if="obj.type === 'polygon' && isVis(obj.id)"
              :config="polygonCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Line -->
            <v-line
              v-if="obj.type === 'line' && isVis(obj.id)"
              :config="lineCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />

            <!-- Arrow -->
            <v-arrow
              v-if="obj.type === 'arrow' && isVis(obj.id)"
              :config="arrowCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Annulus / Sector / Arc / DoubleArrow -->
            <v-ring
              v-if="obj.type === 'annulus' && isVis(obj.id)"
              :config="annulusCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />
            <v-wedge
              v-if="obj.type === 'sector' && isVis(obj.id)"
              :config="sectorCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />
            <v-shape
              v-if="obj.type === 'arc' && isVis(obj.id)"
              :config="arcCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />
            <v-arrow
              v-if="obj.type === 'double_arrow' && isVis(obj.id)"
              :config="doubleArrowCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            />

            <!-- Dot Grid -->
            <v-group
              v-if="obj.type === 'dot_grid' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            >
              <v-rect :config="dotGridHitCfg(obj)" />
              <v-circle v-for="(d, di) in dotGridDots(obj)" :key="di" :config="d" />
            </v-group>

            <!-- Text -->
            <v-text
              v-if="obj.type === 'text' && isVis(obj.id)"
              :config="textCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
              @dblclick="onTextDblClick(obj.id)"
            />

            <!-- Counter (DecimalNumber) -->
            <v-text
              v-if="obj.type === 'counter' && isVis(obj.id)"
              :config="counterCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- Image / SVG -->
            <v-image
              v-if="
                (obj.type === 'image' || obj.type === 'svg_asset') &&
                isVis(obj.id) &&
                imageElements[obj.assetId as string]
              "
              :config="imageCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            />

            <!-- LaTeX -->
            <v-group
              v-if="obj.type === 'latex' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="latexBgCfg(obj)" />
              <v-text :config="latexTextCfg(obj)" />
              <v-text :config="latexBadgeCfg(obj)" />
            </v-group>

            <!-- Axes -->
            <v-group
              v-if="obj.type === 'axes' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="axesBgCfg(obj)" />
              <v-line :config="axesXLineCfg(obj)" />
              <v-line :config="axesYLineCfg(obj)" />
              <v-line :config="axesXArrowCfg(obj)" />
              <v-line :config="axesYArrowCfg(obj)" />
              <v-line v-for="(tick, ti) in axesXTicks(obj)" :key="'xt' + ti" :config="tick" />
              <v-line v-for="(tick, ti) in axesYTicks(obj)" :key="'yt' + ti" :config="tick" />
              <v-text :config="axesLabelCfg(obj, 'x')" />
              <v-text :config="axesLabelCfg(obj, 'y')" />
              <!-- Graph curves preview -->
              <v-line
                v-for="(ar, ai) in axesAreaRiemann(obj).areas"
                :key="'ar' + ai"
                :config="ar"
              />
              <v-rect
                v-for="(rr, ri) in axesAreaRiemann(obj).rects"
                :key="'rr' + ri"
                :config="rr"
              />
              <v-line
                v-for="(tg, ti) in axesAreaRiemann(obj).tangents"
                :key="'tg' + ti"
                :config="tg"
              />
              <v-line v-for="(gc, gi) in axesGraphCurves(obj)" :key="'gc' + gi" :config="gc" />
            </v-group>

            <!-- NumberPlane / ComplexPlane -->
            <v-group
              v-if="(obj.type === 'numberplane' || obj.type === 'complex_plane') && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect
                :config="{
                  x: (-(obj.width ?? 0) / 2) * vs,
                  y: (-(obj.height ?? 0) / 2) * vs,
                  width: (obj.width ?? 0) * vs,
                  height: (obj.height ?? 0) * vs,
                  fill: obj.fill || '#334155',
                  opacity: 0.3,
                  listening: true,
                }"
              />
              <v-line
                :config="{
                  points: [(-(obj.width ?? 0) / 2) * vs, 0, ((obj.width ?? 0) / 2) * vs, 0],
                  stroke: obj.stroke || '#64748b',
                  strokeWidth: 1.5,
                  listening: false,
                }"
              />
              <v-line
                :config="{
                  points: [0, (-(obj.height ?? 0) / 2) * vs, 0, ((obj.height ?? 0) / 2) * vs],
                  stroke: obj.stroke || '#64748b',
                  strokeWidth: 1.5,
                  listening: false,
                }"
              />
              <v-text
                :config="{
                  text: obj.type === 'complex_plane' ? 'ComplexPlane' : 'NumberPlane',
                  x: -40,
                  y: (-(obj.height ?? 0) / 2) * vs + 4,
                  fontSize: 10,
                  fill: '#94a3b8',
                  listening: false,
                }"
              />
            </v-group>

            <!-- PolarPlane -->
            <v-group
              v-if="obj.type === 'polar_plane' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect
                :config="{
                  x: (-(obj.width ?? 0) / 2) * vs,
                  y: (-(obj.height ?? 0) / 2) * vs,
                  width: (obj.width ?? 0) * vs,
                  height: (obj.height ?? 0) * vs,
                  fill: obj.fill || '#334155',
                  opacity: 0.3,
                  listening: true,
                }"
              />
              <template v-for="cc in polarCircleConfigs(obj)" :key="'pc' + cc">
                <v-circle :config="cc" />
              </template>
              <template v-for="sl in polarSpokeConfigs(obj)" :key="'ps' + sl">
                <v-line :config="sl" />
              </template>
              <v-text
                :config="{
                  text: 'PolarPlane',
                  x: -30,
                  y: (-(obj.height ?? 0) / 2) * vs + 4,
                  fontSize: 10,
                  fill: '#94a3b8',
                  listening: false,
                }"
              />
            </v-group>

            <!-- NumberLine -->
            <v-group
              v-if="obj.type === 'numberline' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect
                :config="{
                  x: (-(obj.width ?? 0) / 2) * vs,
                  y: -16,
                  width: (obj.width ?? 0) * vs,
                  height: 32,
                  fill: 'rgba(0,0,0,0.01)',
                  listening: true,
                }"
              />
              <v-line
                :config="{
                  points: [(-(obj.width ?? 0) / 2) * vs, 0, ((obj.width ?? 0) / 2) * vs, 0],
                  stroke: obj.stroke || '#ffffff',
                  strokeWidth: 2,
                  listening: false,
                }"
              />
              <v-line
                :config="{
                  points: [
                    ((obj.width ?? 0) / 2) * vs - 8 * vs,
                    -5 * vs,
                    ((obj.width ?? 0) / 2) * vs,
                    0,
                    ((obj.width ?? 0) / 2) * vs - 8 * vs,
                    5 * vs,
                  ],
                  stroke: obj.stroke || '#ffffff',
                  strokeWidth: 2,
                  listening: false,
                }"
              />
              <v-text
                :config="{
                  text: 'NumberLine',
                  x: -30,
                  y: -16,
                  fontSize: 10,
                  fill: '#94a3b8',
                  listening: false,
                }"
              />
            </v-group>

            <!-- Matrix -->
            <v-group
              v-if="obj.type === 'matrix' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="matrixHitCfg(obj)" />
              <v-line v-for="(b, bi) in matrixBracketConfigs(obj)" :key="'mb' + bi" :config="b" />
              <v-text v-for="(t, ti) in matrixCellConfigs(obj)" :key="'mc' + ti" :config="t" />
            </v-group>

            <!-- Table -->
            <v-group
              v-if="obj.type === 'table' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="tableHitCfg(obj)" />
              <v-line v-for="(l, li) in tableGridLines(obj)" :key="'tgl' + li" :config="l" />
              <v-text v-for="(tc, ti) in tableCellConfigs(obj)" :key="'tc' + ti" :config="tc" />
            </v-group>

            <!-- Code block -->
            <v-group
              v-if="obj.type === 'code' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="codeBgCfg(obj)" />
              <v-text :config="codeTextCfg(obj)" />
            </v-group>

            <!-- Bar chart -->
            <v-group
              v-if="obj.type === 'bar_chart' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="barChartHitCfg(obj)" />
              <v-rect v-for="(b, bi) in barChartBarConfigs(obj)" :key="'bcb' + bi" :config="b" />
              <v-line :config="barChartBaselineCfg(obj)" />
            </v-group>

            <!-- Brace -->
            <v-group
              v-if="obj.type === 'brace' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="relationalHitCfg(obj)" />
              <v-line :config="braceLineCfg(obj)" />
              <v-text v-if="obj.label" :config="relationalLabelCfg(obj, braceLabelAnchor(obj))" />
            </v-group>

            <!-- Angle -->
            <v-group
              v-if="obj.type === 'angle' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="relationalHitCfg(obj)" />
              <v-line v-for="(rc, ri) in angleRayCfgs(obj)" :key="'ar' + ri" :config="rc" />
              <v-line v-if="!obj.rightAngle" :config="angleArcCfg(obj)" />
              <v-line v-if="obj.rightAngle" :config="angleSquareCfg(obj)" />
              <v-text v-if="obj.label" :config="relationalLabelCfg(obj, angleLabelAnchor(obj))" />
            </v-group>

            <!-- Surrounding Rect annotation -->
            <template v-if="obj.type === 'surrounding_rect'">
              <v-rect v-if="surroundingRectCfg(obj)" :config="surroundingRectCfg(obj)" />
            </template>

            <!-- Underline annotation -->
            <template v-if="obj.type === 'underline'">
              <v-line v-if="underlineCfg(obj)" :config="underlineCfg(obj)" />
            </template>

            <!-- Cross annotation (two diagonal lines) -->
            <template v-if="obj.type === 'cross'">
              <template v-if="crossCfg(obj)">
                <template v-for="(lineCfg, _li) in crossCfg(obj)" :key="_li">
                  <v-line :config="lineCfg" />
                </template>
              </template>
            </template>

            <!-- Vector components (main + x/y arrows + dashed guides) -->
            <v-group
              v-if="obj.type === 'vector_components' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="relationalHitCfg(obj)" />
              <v-line
                v-for="(d, di) in vectorComponentsCfgs(obj).dashes"
                :key="'vcd' + di"
                :config="d"
              />
              <v-arrow
                v-for="(a, ai) in vectorComponentsCfgs(obj).arrows"
                :key="'vca' + ai"
                :config="a"
              />
            </v-group>

            <!-- Ray (source dot + direction arrow) -->
            <v-group
              v-if="obj.type === 'ray' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="relationalHitCfg(obj)" />
              <v-arrow :config="rayCfgs(obj).arrow" />
              <v-circle :config="rayCfgs(obj).dot" />
            </v-group>

            <!-- Coord point (dot + live (x,y) label) -->
            <v-group
              v-if="obj.type === 'coord_point' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="relationalHitCfg(obj)" />
              <v-circle :config="coordPointCfgs(obj).dot" />
              <v-text :config="coordPointCfgs(obj).label" />
            </v-group>

            <!-- Graph / DiGraph -->
            <v-group
              v-if="obj.type === 'graph' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
              @transform="onTransform(obj.id, $event)"
              @transformend="onTransformEnd(obj.id, $event)"
            >
              <v-rect :config="graphHitCfg(obj)" />
              <template v-for="(ecfg, ei) in graphEdgeConfigs(obj)" :key="'ge' + ei">
                <v-arrow v-if="obj.directed" :config="ecfg" />
                <v-line v-else :config="ecfg" />
              </template>
              <v-circle
                v-for="(vcfg, vi) in graphVertexConfigs(obj)"
                :key="'gv' + vi"
                :config="vcfg"
              />
              <template v-if="obj.showLabels">
                <v-text
                  v-for="(lcfg, li) in graphLabelConfigs(obj)"
                  :key="'gl' + li"
                  :config="lcfg"
                />
              </template>
            </v-group>

            <!-- Vector Field -->
            <v-group
              v-if="obj.type === 'vector_field' && isVis(obj.id)"
              :config="groupCfg(obj)"
              @mousedown="onObjDown(obj.id, $event)"
              @dragend="onDragEnd(obj.id, $event)"
            >
              <v-rect :config="vectorFieldHitCfg(obj)" />
              <template v-for="acfg in vectorFieldArrows(obj)" :key="'vfa' + acfg">
                <v-arrow :config="acfg" />
              </template>
            </v-group>

            <!-- 3D: Sphere -->
            <template v-if="obj.type === 'sphere' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-circle
                :config="sphere3dCfg(obj)"
                @mousedown="onObjDown(obj.id, $event)"
                @dragend="onDrag3DEnd(obj.id, $event)"
              />
            </template>

            <!-- 3D: Cube (real box — depth-sorted shaded faces) -->
            <template v-if="obj.type === 'cube' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group
                :config="obj3dCenter(obj)"
                @mousedown="onObjDown(obj.id, $event)"
                @dragend="onDrag3DEnd(obj.id, $event)"
              >
                <v-line v-for="(f, fi) in cube3dFaces(obj)" :key="'cf' + fi" :config="f" />
              </v-group>
            </template>

            <!-- 3D: Prism (box with per-axis dimensions) -->
            <template v-if="obj.type === 'prism' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group
                :config="obj3dCenter(obj)"
                @mousedown="onObjDown(obj.id, $event)"
                @dragend="onDrag3DEnd(obj.id, $event)"
              >
                <v-line v-for="(f, fi) in prism3dFaces(obj)" :key="'pf' + fi" :config="f" />
              </v-group>
            </template>

            <!-- 3D: Cone/Cylinder (real silhouettes) -->
            <template
              v-if="['cone', 'cylinder'].includes(obj.type) && is3D && isVis(obj.id)"
              :key="obj.id + '-3d'"
            >
              <v-group
                :config="obj3dCenter(obj)"
                @mousedown="onObjDown(obj.id, $event)"
                @dragend="onDrag3DEnd(obj.id, $event)"
              >
                <v-line v-for="(pt, pi) in round3dParts(obj)" :key="'rp' + pi" :config="pt" />
              </v-group>
            </template>

            <!-- 3D: Torus (donut tube) -->
            <template v-if="obj.type === 'torus' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group
                :config="obj3dCenter(obj)"
                @mousedown="onObjDown(obj.id, $event)"
                @dragend="onDrag3DEnd(obj.id, $event)"
              >
                <v-circle v-for="(seg, si) in torus3dTube(obj)" :key="'tt' + si" :config="seg" />
                <v-line v-for="(ln, li) in torusOutline(obj)" :key="'tol' + li" :config="ln" />
              </v-group>
            </template>

            <!-- 3D: Surface (z = f(x,y)) wireframe -->
            <template v-if="obj.type === 'surface' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group
                :config="obj3dCenter(obj)"
                @mousedown="onObjDown(obj.id, $event)"
                @dragend="onDrag3DEnd(obj.id, $event)"
              >
                <v-line v-for="(ln, li) in surface3dMesh(obj)" :key="'sf' + li" :config="ln" />
              </v-group>
            </template>

            <!-- 3D: Axes3D -->
            <template v-if="obj.type === 'axes3d' && is3D && isVis(obj.id)" :key="obj.id + '-3d'">
              <v-group :config="{ x: 0, y: 0 }" @mousedown="onObjDown(obj.id, $event)">
                <v-line
                  v-for="(axLine, axIdx) in axes3dLines(obj)"
                  :key="'ax3d' + axIdx"
                  :config="axLine"
                />
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
          <v-line v-for="(m, mi) in morphShapes" :key="'m' + mi" :config="morphCfg(m)" />
        </v-layer>

        <!-- Path draw preview layer -->
        <v-layer v-if="pathDrawing && pathPoints.length >= 1">
          <v-line v-if="pathPoints.length >= 2" :config="pathPreviewLineCfg" />
          <v-circle
            v-for="(pt, pi) in pathCanvasPoints"
            :key="'pp' + pi"
            :config="{
              x: pt.cx,
              y: pt.cy,
              radius: 5,
              fill: '#a855f7',
              stroke: '#fff',
              strokeWidth: 1,
              listening: false,
            }"
          />
        </v-layer>

        <v-layer v-if="polygonHandles">
          <v-circle
            v-for="pt in polygonHandles.points"
            :key="'pv' + pt.key"
            :config="{
              x: pt.cx,
              y: pt.cy,
              radius: 6,
              fill: '#4CEEF9',
              stroke: '#0b1020',
              strokeWidth: 1.5,
              draggable: true,
            }"
            @dragmove="onVertexDrag(pt.key, $event)"
            @dragend="onVertexDragEnd"
          />
        </v-layer>

        <!-- Group bounds layer -->
        <v-layer>
          <v-rect v-for="gb in groupBounds" :key="'gb-' + gb.id" :config="gb" />
        </v-layer>

        <!-- Marquee selection overlay -->
        <v-layer v-if="marqueeRect">
          <v-rect :config="marqueeRect" />
        </v-layer>

        <!-- Selection transformer -->
        <v-layer>
          <v-transformer v-if="selectedObjectIds.length > 0" ref="transformer" :config="trConfig" />
        </v-layer>
      </v-stage>

      <!-- Inline text editing overlay -->
      <textarea
        v-if="editingTextId"
        :style="textEditStyle"
        :value="editingText"
        @blur="onTextEditBlur"
        @keydown.escape.prevent="cancelTextEdit"
        @keydown.ctrl.enter.prevent="(e) => commitTextEdit((e.target as HTMLTextAreaElement).value)"
      />

      <!-- 3D view selector (overlay, top-left) -->
      <div v-if="is3D" class="absolute top-2 left-2" style="z-index: var(--z-overlay)">
        <select
          :value="store.project.camera3d?.view ?? 'perspective'"
          class="text-xs bg-studio-surface border border-studio-border rounded px-2 py-1 text-studio-text shadow cursor-pointer"
          title="3D view"
          @change="onViewChange"
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

      <!-- Right-click context menu -->
      <ContextMenu
        v-if="ctxMenu"
        :x="ctxMenu.x"
        :y="ctxMenu.y"
        :items="ctxMenuItems"
        @close="ctxMenu = null"
      />

      <!-- Drop zone indicator -->
      <div
        v-if="isDraggingOver"
        class="absolute inset-0 pointer-events-none border-2 border-dashed border-studio-accent/50 rounded-xl bg-studio-accent/5 flex items-center justify-center"
        style="z-index: var(--z-overlay)"
      >
        <span class="text-studio-accent text-sm font-medium opacity-60">Drop to place</span>
      </div>

      <!-- Empty state -->
      <div
        v-if="objects.length === 0 && !isDraggingOver"
        class="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <div class="text-center max-w-xs px-6">
          <div
            class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-studio-accent/10 border border-studio-accent/20 flex items-center justify-center"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-studio-accent"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <p class="text-sm font-medium text-studio-text/50 mb-1">Empty canvas</p>
          <p class="text-xs text-studio-text-muted/40 leading-relaxed">
            Drag a shape from the sidebar, or click to add.
          </p>
        </div>
      </div>

      <!-- Zoom indicator -->
      <div
        class="absolute bottom-2 right-2 text-[10px] text-studio-text-muted/40 font-mono pointer-events-none select-none"
      >
        {{ Math.round(zoomLevel * 100) }}%
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import type { SceneObject } from '@manim/codegen';
import type { Overrides } from '../../engine/types.js';
import * as shapes2d from './configs/shapes2d.js';
import * as text from './configs/text.js';
import * as dataObjects from './configs/dataObjects.js';
import * as relational from './configs/relational.js';
import * as axes from './configs/axes.js';
import * as objects3d from './configs/objects3d.js';
import * as chrome from './configs/chrome.js';
import * as overlays from './configs/overlays.js';
import * as effects from './configs/effects.js';
import { useProjectStore } from '../../store/project.js';
import { applyOverrides } from '../../engine/blending.js';
import { isPreviewHidden } from '../../engine/visibility.js';
import { useStageViewport } from './composables/useStageViewport.js';
import { useStagePathDraw } from './composables/useStagePathDraw.js';
import { useStageInteractions } from './composables/useStageInteractions.js';
import ContextMenu from './ContextMenu.vue';
import type { ContextMenuItem } from './ContextMenu.vue';
import { useStageAssets } from './composables/useStageAssets.js';

const store = useProjectStore();

// ── Non-reactive instance vars ──
let _ro: ResizeObserver | null = null;
let _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
let _onKeyUp: ((e: KeyboardEvent) => void) | null = null;

// ── Template refs (typed loosely; composables cast internally via their own interfaces) ──
const container = ref<HTMLElement | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const konvaStage = ref<any>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const objectsLayer = ref<any>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformer = ref<any>(null);

// ── Viewport composable ──
const {
  // containerWidth, containerHeight, panOffset unused directly (accessed via stageConfig/stg)
  zoomLevel,
  stg,
  vs,
  ox,
  oy,
  stageConfig,
  is3D,
  cam3d,
  proj3DScale,
  projCx,
  projCy,
  iso,
  s2c,
  c2s,
  themeAccent,
  themeSurface,
  updateSize,
  unprojectView,
  startPan,
  handleWheel,
} = useStageViewport(store, container);

// ── Computed ──
const objects = computed(() => store.project.objects);
const sortedObjects = computed(() =>
  [...objects.value].sort((a, b) => (a.zOrder || 0) - (b.zOrder || 0))
);
const selectedObjectIds = computed(() => store.selectedObjectIds);
const gridVisible = computed(() => store.project.stage.gridVisible);
const frameState = computed(() => store.frameState);
const morphShapes = computed(
  () => (frameState.value.morphShapes || []) as import('../../engine/types.js').MorphState[]
);

// bgConfig / gridLines / centerH / centerV — delegated to chrome.js (declared after ctx).

// ── Path draw composable ──
const {
  pathDrawing,
  pathPoints,
  pathSourceId,
  pathCanvasPoints,
  pathPreviewLineCfg,
  startPathDraw,
  onStageDblClick: onPathStageDblClick,
} = useStagePathDraw(store, { s2c, iso, projCx, projCy, proj3DScale });

// ── Interactions composable ──
const {
  shiftKey,
  liveTransform,
  marquee,
  polygonHandles,
  groupBounds,
  trConfig,
  onVertexDrag,
  onVertexDragEnd,
  handleStageMouseDown,
  handleStageMouseMove,
  handleStageMouseUp,
  onObjDown,
  onDragEnd,
  onDrag3DEnd,
  onTransform,
  onTransformEnd,
  onTextDblClick,
  updateTransformer,
  editingTextId,
  startTextEdit,
  commitTextEdit,
  cancelTextEdit,
} = useStageInteractions(store, {
  konvaStage,
  objectsLayer,
  transformer,
  vs,
  ox,
  oy,
  s2c,
  c2s,
  unprojectView,
  themeAccent,
  startPan,
  is3D,
  pathDrawing,
  pathPoints,
  pathSourceId,
});

// ── Assets composable ──
const {
  imageElements,
  isDraggingOver,
  fontLoadKey,
  loadNewImages,
  loadNewFonts,
  onDragOver,
  onDragLeave,
  onDrop,
} = useStageAssets(store, { objects, c2s, container, objectsLayer });

// ── Watch ──
watch(
  () => store.selectedObjectIds,
  () => {
    nextTick(() => updateTransformer());
  },
  { deep: true }
);

watch(
  () => store.project.objects,
  () => {
    nextTick(() => updateTransformer());
    loadNewImages();
    loadNewFonts();
  },
  { deep: true }
);

// ── Lifecycle ──
onMounted(() => {
  updateSize();
  _ro = new ResizeObserver(() => updateSize());
  if (container.value) _ro.observe(container.value);
  loadNewImages();
  loadNewFonts();
  _onKeyDown = (e) => {
    if (e.key === 'Shift') shiftKey.value = true;
  };
  _onKeyUp = (e) => {
    if (e.key === 'Shift') shiftKey.value = false;
  };
  window.addEventListener('keydown', _onKeyDown);
  window.addEventListener('keyup', _onKeyUp);
});

onBeforeUnmount(() => {
  if (_ro) _ro.disconnect();
  if (_onKeyDown) window.removeEventListener('keydown', _onKeyDown);
  if (_onKeyUp) window.removeEventListener('keyup', _onKeyUp);
});

// ── Methods ──
function eff(obj: SceneObject): SceneObject {
  const ov = frameState.value.objectOverrides[obj.id] as Overrides | undefined;
  return ov ? applyOverrides(obj, ov) : obj;
}

// 3D nesnenin geçerli (override dahil) konumu — playback path_move/move override'larını yansıtır
// Returns only positional 3D coords (x3d/y3d/z3d) merged with overrides — read other props from obj directly.
function eff3d(obj: SceneObject): { x3d: number; y3d: number; z3d: number } {
  const ov = (frameState.value.objectOverrides[obj.id] as Overrides | undefined) || {};
  return {
    x3d: (ov.x3d as number | undefined) ?? (obj.x3d as number | undefined) ?? 0,
    y3d: (ov.y3d as number | undefined) ?? (obj.y3d as number | undefined) ?? 0,
    z3d: (ov.z3d as number | undefined) ?? (obj.z3d as number | undefined) ?? 0,
  };
}

// emphasisOverlays / path3dPolylines — delegated to overlays.js (declared after ctx).

function isVis(id: string): boolean {
  // Static hide (hidden flag + annotation-of-hidden-target cascade)
  if (isPreviewHidden(store.objectById(id), (i) => store.objectById(i))) return false;
  // Playback transform-clip hide
  const h = frameState.value.hiddenIds;
  if (h instanceof Set) return !h.has(id);
  return true;
}

// ── Shape configs ──
function live(obj: SceneObject) {
  return liveTransform.value && liveTransform.value.id === obj.id ? liveTransform.value : null;
}
// morphCfg — delegated to overlays.js (declared after ctx).

// Lock decoration for every wrapper whose builder emits a draggable /
// hit-target config (locked ⇒ listening:false ⇒ click-through).
const L = chrome.lockConfig;

// ── 3D shape config wrappers (delegates to configs/objects3d.js) ──────────
const sphere3dCfg = (o: SceneObject) => L(objects3d.sphere3dCfg(o, ctx.value), o);
const cube3dFaces = (o: SceneObject) => objects3d.cube3dFaces(o, ctx.value);
const prism3dFaces = (o: SceneObject) => objects3d.prism3dFaces(o, ctx.value);
const obj3dCenter = (o: SceneObject) => L(objects3d.obj3dCenter(o, ctx.value), o);
const round3dParts = (o: SceneObject) => objects3d.round3dParts(o, ctx.value);
const surface3dMesh = (o: SceneObject) => objects3d.surface3dMesh(o, ctx.value);
const torus3dTube = (o: SceneObject) => objects3d.torus3dTube(o, ctx.value);
const torusOutline = (o: SceneObject) => objects3d.torusOutline(o, ctx.value);
const axes3dLines = (o: SceneObject) => objects3d.axes3dLines(o, ctx.value);

// ── shapes2d ctx bridge ──
const ctx = computed(() => ({
  stg: stg.value,
  vs: vs.value,
  ox: ox.value,
  oy: oy.value,
  s2c,
  c2s,
  eff,
  eff3d,
  live,
  applyEffects: (
    cfg: Record<string, unknown>,
    obj: SceneObject,
    w: number,
    h: number,
    centered: boolean
  ) => effects.applyEffects(cfg, obj, w, h, centered, vs.value),
  hexToRgba: effects.hexToRgba,
  themeAccent: themeAccent.value,
  themeSurface: themeSurface.value,
  imageElements,
  frameState: frameState.value as import('../../engine/types.js').FrameState,
  is3D: is3D.value,
  cam3d: cam3d.value,
  proj3DScale: proj3DScale.value,
  projCx: projCx.value,
  projCy: projCy.value,
  iso,
  measureTextWidth: text.measureTextWidth,
  activeTool: store.activeTool,
  selectedObjectIds: store.selectedObjectIds,
  objectBounds(id: string) {
    const target = store.objectById(id);
    if (!target || target.visible === false) return null;
    const effTarget = eff(target);
    const pos = s2c(
      (effTarget.x as number) - (effTarget.width as number) / 2,
      (effTarget.y as number) - (effTarget.height as number) / 2
    );
    return {
      x: pos.x,
      y: pos.y,
      width: ((effTarget.width as number) || 0) * vs.value,
      height: ((effTarget.height as number) || 0) * vs.value,
    };
  },
}));

// ── chrome.js delegating computeds ──
const bgConfig = computed(() => chrome.bgConfig(ctx.value));
const gridLines = computed(() => chrome.gridLines(ctx.value));
const centerH = computed(() => chrome.centerH(ctx.value));
const centerV = computed(() => chrome.centerV(ctx.value));
const refAxesIso = computed(() => chrome.refAxesIso(ctx.value));
const refLabelsIso = computed(() => chrome.refLabelsIso(ctx.value));
const floorGridIso = computed(() => chrome.floorGridIso(ctx.value));

// ── Marquee overlay ──
const marqueeRect = computed(() => {
  const m = marquee.value;
  if (!m) return null;
  const r = {
    x: Math.min(m.x1, m.x2),
    y: Math.min(m.y1, m.y2),
    width: Math.abs(m.x2 - m.x1),
    height: Math.abs(m.y2 - m.y1),
  };
  return {
    ...r,
    fill: themeAccent.value + '22',
    stroke: themeAccent.value,
    strokeWidth: 1,
    dash: [4, 4],
    listening: false,
  };
});

// ── overlays.js delegating computeds ──
const emphasisOverlays = computed(() => overlays.emphasisOverlays(objects.value, ctx.value));
const path3dPolylines = computed(() =>
  overlays.path3dPolylines(store.project.tracks || [], ctx.value)
);
const morphCfg = (m: import('../../engine/types.js').MorphState) => overlays.morphCfg(m, ctx.value);
const rectCfg = (o: SceneObject) => L(shapes2d.rectCfg(o, ctx.value), o);
const circleCfg = (o: SceneObject) => L(shapes2d.circleCfg(o, ctx.value), o);
const ellipseCfg = (o: SceneObject) => L(shapes2d.ellipseCfg(o, ctx.value), o);
const dotCfg = (o: SceneObject) => L(shapes2d.dotCfg(o, ctx.value), o);
const heartCfg = (o: SceneObject) => L(shapes2d.heartCfg(o, ctx.value), o);
const triangleCfg = (o: SceneObject) => L(shapes2d.triangleCfg(o, ctx.value), o);
const polygonFreeCfg = (o: SceneObject) => L(shapes2d.polygonFreeCfg(o, ctx.value), o);
const bezierCfg = (o: SceneObject) => L(shapes2d.bezierCfg(o, ctx.value), o);
const parametricCfg = (o: SceneObject) => L(shapes2d.parametricCfg(o, ctx.value), o);
const starCfg = (o: SceneObject) => L(shapes2d.starCfg(o, ctx.value), o);
const polygonCfg = (o: SceneObject) => L(shapes2d.polygonCfg(o, ctx.value), o);
const lineCfg = (o: SceneObject) => L(shapes2d.lineCfg(o, ctx.value), o);
const arrowCfg = (o: SceneObject) => L(shapes2d.arrowCfg(o, ctx.value), o);
const annulusCfg = (o: SceneObject) => L(shapes2d.annulusCfg(o, ctx.value), o);
const sectorCfg = (o: SceneObject) => L(shapes2d.sectorCfg(o, ctx.value), o);
const arcCfg = (o: SceneObject) => L(shapes2d.arcCfg(o, ctx.value), o);
const doubleArrowCfg = (o: SceneObject) => L(shapes2d.doubleArrowCfg(o, ctx.value), o);
const textCfg = (o: SceneObject) => L(text.textCfg(o, ctx.value), o);
const counterCfg = (o: SceneObject) => L(text.counterCfg(o, ctx.value), o);
const latexBgCfg = (o: SceneObject) => L(text.latexBgCfg(o, ctx.value), o);
const latexTextCfg = (o: SceneObject) => text.latexTextCfg(o, ctx.value);
const latexBadgeCfg = (o: SceneObject) => text.latexBadgeCfg(o, ctx.value);
const groupCfg = (o: SceneObject) => L(dataObjects.groupCfg(o, ctx.value), o);
const dotGridDots = (o: SceneObject) => dataObjects.dotGridDots(o, ctx.value);
const dotGridHitCfg = (o: SceneObject) => L(dataObjects.dotGridHitCfg(o, ctx.value), o);
const imageCfg = (o: SceneObject) => L(dataObjects.imageCfg(o, ctx.value), o);
const matrixHitCfg = (o: SceneObject) => L(dataObjects.matrixHitCfg(o, ctx.value), o);
const matrixCellConfigs = (o: SceneObject) => dataObjects.matrixCellConfigs(o, ctx.value);
const matrixBracketConfigs = (o: SceneObject) => dataObjects.matrixBracketConfigs(o, ctx.value);
const codeBgCfg = (o: SceneObject) => L(text.codeBgCfg(o, ctx.value), o);
const codeTextCfg = (o: SceneObject) => text.codeTextCfg(o, ctx.value);
const barChartHitCfg = (o: SceneObject) => L(dataObjects.barChartHitCfg(o, ctx.value), o);
const barChartBarConfigs = (o: SceneObject) => dataObjects.barChartBarConfigs(o, ctx.value);
const barChartBaselineCfg = (o: SceneObject) => dataObjects.barChartBaselineCfg(o, ctx.value);
const tableHitCfg = (o: SceneObject) => L(dataObjects.tableHitCfg(o, ctx.value), o);
const tableCellConfigs = (o: SceneObject) => dataObjects.tableCellConfigs(o, ctx.value);
const tableGridLines = (o: SceneObject) => dataObjects.tableGridLines(o, ctx.value);
const polarCircleConfigs = (o: SceneObject) => dataObjects.polarCircleConfigs(o, ctx.value);
const polarSpokeConfigs = (o: SceneObject) => dataObjects.polarSpokeConfigs(o, ctx.value);
const graphHitCfg = (o: SceneObject) => L(dataObjects.graphHitCfg(o, ctx.value), o);
const graphEdgeConfigs = (o: SceneObject) => dataObjects.graphEdgeConfigs(o, ctx.value);
const graphVertexConfigs = (o: SceneObject) => dataObjects.graphVertexConfigs(o, ctx.value);
const graphLabelConfigs = (o: SceneObject) => dataObjects.graphLabelConfigs(o, ctx.value);
const vectorFieldHitCfg = (o: SceneObject) => L(dataObjects.vectorFieldHitCfg(o, ctx.value), o);
const vectorFieldArrows = (o: SceneObject) => dataObjects.vectorFieldArrows(o, ctx.value);
const relationalHitCfg = (o: SceneObject) => L(relational.relationalHitCfg(o, ctx.value), o);
const relationalLabelCfg = (o: SceneObject, anchor: [number, number]) =>
  relational.relationalLabelCfg(o, anchor, ctx.value);
const braceLineCfg = (o: SceneObject) => relational.braceLineCfg(o, ctx.value);
const vectorComponentsCfgs = (o: SceneObject) => relational.vectorComponentsCfgs(o, ctx.value);
const rayCfgs = (o: SceneObject) => relational.rayCfgs(o, ctx.value);
const coordPointCfgs = (o: SceneObject) => relational.coordPointCfgs(o, ctx.value);
const braceLabelAnchor = (o: SceneObject) => relational.braceLabelAnchor(o, ctx.value);
const angleRayCfgs = (o: SceneObject) => relational.angleRayCfgs(o, ctx.value);
const angleArcCfg = (o: SceneObject) => relational.angleArcCfg(o, ctx.value);
const angleSquareCfg = (o: SceneObject) => relational.angleSquareCfg(o, ctx.value);
const angleLabelAnchor = (o: SceneObject) => relational.angleLabelAnchor(o, ctx.value);
const surroundingRectCfg = (o: SceneObject) => L(relational.surroundingRectCfg(o, ctx.value), o);
const underlineCfg = (o: SceneObject) => L(relational.underlineCfg(o, ctx.value), o);
const crossCfg = (o: SceneObject) => relational.crossCfg(o, ctx.value);
const axesBgCfg = (o: SceneObject) => L(axes.axesBgCfg(o, ctx.value), o);
const axesXLineCfg = (o: SceneObject) => axes.axesXLineCfg(o, ctx.value);
const axesYLineCfg = (o: SceneObject) => axes.axesYLineCfg(o, ctx.value);
const axesXArrowCfg = (o: SceneObject) => axes.axesXArrowCfg(o, ctx.value);
const axesYArrowCfg = (o: SceneObject) => axes.axesYArrowCfg(o, ctx.value);
const axesXTicks = (o: SceneObject) => axes.axesXTicks(o, ctx.value);
const axesYTicks = (o: SceneObject) => axes.axesYTicks(o, ctx.value);
const axesLabelCfg = (o: SceneObject, axis: string) => axes.axesLabelCfg(o, axis, ctx.value);
const axesGraphCurves = (o: SceneObject) => axes.axesGraphCurves(o, ctx.value);
const axesAreaRiemann = (o: SceneObject) => axes.axesAreaRiemann(o, ctx.value);

// ── 3D view selector handler ──
function onViewChange(e: Event) {
  store.setCamera3d({ view: (e.target as HTMLSelectElement).value });
}

// ── Stage double-click: path draw finish + inline text edit ──
function onStageDblClick(e: Record<string, unknown>) {
  onPathStageDblClick(e);
  const target = e['target'] as Record<string, unknown> | undefined;
  const idFn = target?.['id'];
  const nodeId = typeof idFn === 'function' ? (idFn as () => string)() : undefined;
  if (!nodeId) return;
  const obj = store.objectById(nodeId);
  if (obj && (obj.type === 'text' || obj.type === 'latex')) {
    startTextEdit(nodeId);
  }
}

// ── Inline text editing overlay ──
const textEditStyle = computed(() => {
  if (!editingTextId.value) return {};
  const obj = store.objectById(editingTextId.value);
  if (!obj) return {};
  const pos = s2c(obj.x ?? 0, obj.y ?? 0);
  const w = Math.max(80, (obj.width ?? 200) * vs.value);
  const h = Math.max(40, (obj.height ?? 60) * vs.value);
  return {
    position: 'absolute' as const,
    left: pos.x - w / 2 + 'px',
    top: pos.y - h / 2 + 'px',
    width: w + 'px',
    minHeight: h + 'px',
    zIndex: 500,
    fontSize: Math.max(11, 14 * vs.value) + 'px',
    padding: '4px 6px',
    background: 'var(--studio-surface3)',
    border: '2px solid var(--studio-accent)',
    borderRadius: '4px',
    color: 'var(--studio-text)',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'monospace',
    lineHeight: '1.4',
  };
});

const editingText = computed(() => {
  if (!editingTextId.value) return '';
  const obj = store.objectById(editingTextId.value);
  return (obj?.['text'] as string) ?? '';
});

function onTextEditBlur(e: FocusEvent) {
  commitTextEdit((e.target as HTMLTextAreaElement).value);
}

// ── Right-click context menu ──
const ctxMenu = ref<{ x: number; y: number; objId: string | null } | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onStageContextMenu(e: any) {
  e.evt.preventDefault();
  if (pathDrawing.value) return;
  // Walk up from the Konva target to find a stage object (same parent-walk as
  // handleStageMouseDown). Locked objects have listening:false, so a
  // right-click over one lands on the stage → empty-canvas menu (unlock via
  // the timeline lock icon).
  let node = e.target;
  let objId: string | null = null;
  while (node) {
    if (node.name?.() === 'stageObject' && node.id?.()) {
      objId = node.id();
      break;
    }
    node = node.getParent ? node.getParent() : null;
  }
  if (objId && !store.selectedObjectIds.includes(objId)) store.selectObject(objId);
  ctxMenu.value = { x: e.evt.clientX, y: e.evt.clientY, objId };
}

const ctxMenuItems = computed<ContextMenuItem[]>(() => {
  const m = ctxMenu.value;
  if (!m) return [];
  if (m.objId) {
    const objId = m.objId;
    const obj = store.objectById(objId);
    // Cut/copy/paste/duplicate/delete act on the SELECTION (the right-clicked
    // object was selected in onStageContextMenu); z-order and lock/hide act on
    // the right-clicked object itself.
    return [
      { id: 'cut', label: 'Cut', action: () => store.cutSelection() },
      { id: 'copy', label: 'Copy', action: () => store.copySelection() },
      {
        id: 'paste',
        label: 'Paste',
        disabled: store.clipboard.length === 0,
        action: () => store.pasteSelection(),
      },
      { id: 'duplicate', label: 'Duplicate', action: () => store.duplicateSelection() },
      {
        id: 'delete',
        label: 'Delete',
        action: () => [...store.selectedObjectIds].forEach((id) => store.deleteObject(id)),
      },
      { id: 'sep1', separator: true },
      { id: 'front', label: 'Bring to Front', action: () => store.bringToFront(objId) },
      { id: 'back', label: 'Send to Back', action: () => store.sendToBack(objId) },
      { id: 'sep2', separator: true },
      {
        id: 'lock',
        label: obj?.locked ? 'Unlock' : 'Lock',
        action: () => store.toggleLocked(objId),
      },
      {
        id: 'hide',
        label: obj?.hidden ? 'Show' : 'Hide',
        action: () => store.toggleHidden(objId),
      },
    ];
  }
  return [
    {
      id: 'paste',
      label: 'Paste',
      disabled: store.clipboard.length === 0,
      action: () => store.pasteSelection(),
    },
    {
      id: 'selectall',
      label: 'Select All',
      disabled: store.project.objects.length === 0,
      action: () => store.selectAllObjects(),
    },
  ];
});

// ── Expose for parent ref calls ──
defineExpose({ startPathDraw });
</script>
