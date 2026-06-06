<template>
      <div class="panel-header flex items-center justify-between">
        Properties
        <span class="px-1.5 py-0.5 text-[9px] rounded-md font-bold uppercase" :class="typeBadge">{{ typeLabel }}</span>
      </div>

      <!-- Name -->
      <Section label="Name">
        <input class="input input-sm" :value="obj.name" @change="u('name', $event.target.value)" />
      </Section>

      <!-- 3D position / rotation / type params (3D objects only) -->
      <Position3DPanel v-if="is3DObject" :element="obj" @update="onObj3DUpdate" />

      <!-- Position & Size (type-aware: match what preview actually renders) -->
      <Section label="Position & Size">
        <div class="grid grid-cols-2 gap-1.5">
          <Num label="X" :value="obj.x" @input="u('x', $event)" />
          <Num label="Y" :value="obj.y" @input="u('y', $event)" />
          <!-- Symmetric shapes: single Size (preview uses min(w,h)) -->
          <template v-if="['circle','star','polygon','dot'].includes(obj.type)">
            <Num label="Size" :value="effectiveSize" :min="1" class="col-span-2" @input="uSize($event)" />
          </template>
          <!-- Line/Arrow: Length only (height unused in preview) -->
          <template v-else-if="['line','arrow'].includes(obj.type)">
            <Num label="Length" :value="obj.width" :min="1" class="col-span-2" @input="u('width', $event)" />
          </template>
          <!-- Text: no width/height (size = fontSize) -->
          <template v-else-if="obj.type === 'text'">
            <!-- X,Y only; fontSize in Text Style -->
          </template>
          <!-- Rect-like: Width + Height -->
          <template v-else>
            <Num label="Width" :value="obj.width" :min="1" @input="u('width', $event)" />
            <Num label="Height" :value="obj.height" :min="1" @input="u('height', $event)" />
          </template>
        </div>
      </Section>

      <!-- 3x3 Alignment Grid -->
      <Section label="Align to Canvas">
        <div class="anchor-grid">
          <div v-for="(row, ri) in anchorGrid" :key="ri" class="flex gap-1">
            <button
              v-for="anchor in row"
              :key="anchor"
              class="anchor-btn"
              :title="anchor.replace('_', ' ')"
              @click="align(anchor)"
            >{{ anchorLabels[anchor] }}</button>
          </div>
        </div>
      </Section>

      <!-- Rotation -->
      <Section label="Rotation">
        <div class="flex items-center gap-2">
          <input class="input input-sm flex-1" type="number" :value="obj.rotation || 0" @change="u('rotation', Number($event.target.value))" />
          <span class="text-[10px] text-studio-text-muted">deg</span>
        </div>
      </Section>

      <!-- Colors -->
      <Section v-if="obj.type !== 'text'" label="Colors">
        <div class="space-y-1.5">
          <ColorRow label="Fill" :value="obj.fill" @input="u('fill', $event)" />
          <ColorRow label="Stroke" :value="obj.stroke" @input="u('stroke', $event)" />
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-12">Stroke W</span>
            <input class="input input-sm w-16" type="number" min="0" step="0.5" :value="obj.strokeWidth" @change="u('strokeWidth', Number($event.target.value))" />
          </div>
        </div>
      </Section>

      <!-- Text Properties -->
      <TextSettings v-if="obj.type === 'text'" :obj="obj" />

      <!-- Opacity -->
      <Section label="Opacity">
        <div class="flex items-center gap-2">
          <input type="range" min="0" max="1" step="0.01" class="flex-1 accent-studio-accent" :value="obj.opacity" @input="u('opacity', Number($event.target.value))" />
          <span class="text-[10px] text-studio-text-muted w-8 text-right tabular-nums">{{ Math.round((obj.opacity ?? 1) * 100) }}%</span>
        </div>
      </Section>

      <EffectsSection :obj="obj" />

      <!-- Timeline presence -->
      <Section label="Timeline">
        <div class="grid grid-cols-2 gap-1.5">
          <Num label="Enter (s)" :value="obj.enterTime || 0" :min="0" :step="0.1" @input="u('enterTime', $event)" />
          <Num label="Duration (s)" :value="obj.duration || 3" :min="0.1" :step="0.1" @input="u('duration', $event)" />
        </div>
      </Section>

      <component :is="settingsComp" v-if="settingsComp" :obj="obj" />

      <!-- Vector Field settings -->
      <Section v-if="obj.type === 'vector_field'" label="Vector Field">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-8">fx</span>
            <input class="input input-sm flex-1" :value="obj.fx" @change="store.setFieldExpr(obj.id, 'fx', $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-8">fy</span>
            <input class="input input-sm flex-1" :value="obj.fy" @change="store.setFieldExpr(obj.id, 'fy', $event.target.value)" />
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <Num label="x min" :value="(obj.xRange || [-3,3,1])[0]" @input="store.setFieldRange(obj.id, 'xRange', [$event, (obj.xRange||[-3,3,1])[1], (obj.xRange||[-3,3,1])[2]])" />
            <Num label="x max" :value="(obj.xRange || [-3,3,1])[1]" @input="store.setFieldRange(obj.id, 'xRange', [(obj.xRange||[-3,3,1])[0], $event, (obj.xRange||[-3,3,1])[2]])" />
            <Num label="x step" :value="(obj.xRange || [-3,3,1])[2]" @input="store.setFieldRange(obj.id, 'xRange', [(obj.xRange||[-3,3,1])[0], (obj.xRange||[-3,3,1])[1], $event])" />
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <Num label="y min" :value="(obj.yRange || [-2,2,1])[0]" @input="store.setFieldRange(obj.id, 'yRange', [$event, (obj.yRange||[-2,2,1])[1], (obj.yRange||[-2,2,1])[2]])" />
            <Num label="y max" :value="(obj.yRange || [-2,2,1])[1]" @input="store.setFieldRange(obj.id, 'yRange', [(obj.yRange||[-2,2,1])[0], $event, (obj.yRange||[-2,2,1])[2]])" />
            <Num label="y step" :value="(obj.yRange || [-2,2,1])[2]" @input="store.setFieldRange(obj.id, 'yRange', [(obj.yRange||[-2,2,1])[0], (obj.yRange||[-2,2,1])[1], $event])" />
          </div>
        </div>
      </Section>

      <!-- Table grid editor -->
      <Section v-if="obj.type === 'table'" label="Table">
        <div class="space-y-2">
          <div v-for="(row, r) in obj.cellData" :key="'tr' + r" class="flex gap-1">
            <input v-for="(cell, c) in row" :key="'tc' + r + '-' + c"
                   data-test="table-cell"
                   class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="cell"
                   @input="store.setTableCell(obj.id, r, c, $event.target.value)" />
          </div>
          <div class="flex gap-1 pt-1">
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.addTableRow(obj.id)">+ Row</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.removeTableRow(obj.id)">− Row</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.addTableColumn(obj.id)">+ Col</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.removeTableColumn(obj.id)">− Col</button>
          </div>
          <div class="flex items-center gap-2 pt-1">
            <input type="checkbox" id="table-math-mode" :checked="obj.mathMode" @change="store.setTableMathMode(obj.id, $event.target.checked)" />
            <label for="table-math-mode" class="text-[11px] text-studio-text-muted">Math mode (MathTable)</label>
          </div>
          <div class="space-y-1 pt-1">
            <label class="block text-[10px] text-studio-text-muted">Row labels (comma-separated)</label>
            <input class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="(obj.rowLabels || []).join(', ')"
                   @change="store.setTableRowLabels(obj.id, $event.target.value.split(',').map(s => s.trim()).filter(s => s.length))" />
          </div>
          <div class="space-y-1">
            <label class="block text-[10px] text-studio-text-muted">Col labels (comma-separated)</label>
            <input class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="(obj.colLabels || []).join(', ')"
                   @change="store.setTableColLabels(obj.id, $event.target.value.split(',').map(s => s.trim()).filter(s => s.length))" />
          </div>
        </div>
      </Section>

      <!-- Matrix grid editor -->
      <Section v-if="obj.type === 'matrix'" label="Matrix">
        <div class="space-y-2">
          <div v-for="(row, r) in obj.matrixData" :key="'mr' + r" class="flex gap-1">
            <input v-for="(cell, c) in row" :key="'mc' + r + '-' + c"
                   data-test="matrix-cell"
                   class="w-full min-w-0 px-1 py-1 text-[11px] text-center rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="cell"
                   @input="store.setMatrixCell(obj.id, r, c, $event.target.value)" />
          </div>
          <div class="flex gap-1 pt-1">
            <button data-test="matrix-add-row" class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.addMatrixRow(obj.id)">+ Row</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.removeMatrixRow(obj.id)">− Row</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.addMatrixColumn(obj.id)">+ Col</button>
            <button class="flex-1 py-1 text-[10px] rounded border border-studio-border hover:bg-studio-accent/10 text-studio-text-muted" @click="store.removeMatrixColumn(obj.id)">− Col</button>
          </div>
          <div class="flex gap-1 items-center pt-1">
            <span class="text-[10px] text-studio-text-muted">Brackets</span>
            <button class="flex-1 py-1 text-[11px] rounded border" :class="obj.bracket === '[' ? 'border-studio-accent text-studio-accent' : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'" @click="store.setMatrixBracket(obj.id, '[')">[ ]</button>
            <button class="flex-1 py-1 text-[11px] rounded border" :class="obj.bracket === '(' ? 'border-studio-accent text-studio-accent' : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'" @click="store.setMatrixBracket(obj.id, '(')">( )</button>
            <button class="flex-1 py-1 text-[11px] rounded border" :class="obj.bracket === '|' ? 'border-studio-accent text-studio-accent' : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'" @click="store.setMatrixBracket(obj.id, '|')">| |</button>
          </div>
        </div>
      </Section>

      <!-- Brace -->
      <Section v-if="obj.type === 'brace'" label="Brace">
        <div class="space-y-2">
          <label class="block text-[10px] text-studio-text-muted">Label (LaTeX, optional)</label>
          <input data-test="rel-label" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                 :value="obj.label" @input="store.setRelationalLabel(obj.id, $event.target.value)" placeholder="e.g. x or \\frac{a}{b}" />
          <p class="text-[10px] text-studio-text-muted">Drag the two endpoint handles on the canvas to reshape.</p>
        </div>
      </Section>

      <!-- Angle -->
      <Section v-if="obj.type === 'angle'" label="Angle">
        <div class="space-y-2">
          <button data-test="angle-right" class="w-full py-1 text-[11px] rounded border"
                  :class="obj.rightAngle ? 'border-studio-accent text-studio-accent' : 'border-studio-border text-studio-text-muted hover:bg-studio-accent/10'"
                  @click="store.setAngleRightMode(obj.id, !obj.rightAngle)">Right angle mark</button>
          <div v-if="!obj.rightAngle" class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-14">Arc radius</span>
            <input type="number" step="0.1" min="0.1" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.radius" @input="store.setAngleRadius(obj.id, $event.target.value)" />
          </div>
          <label class="block text-[10px] text-studio-text-muted">Label (LaTeX, optional)</label>
          <input data-test="rel-label" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                 :value="obj.label" @input="store.setRelationalLabel(obj.id, $event.target.value)" placeholder="e.g. \\theta" />
          <p class="text-[10px] text-studio-text-muted">Drag the vertex + two endpoint handles on the canvas.</p>
        </div>
      </Section>

      <!-- Counter settings -->
      <Section v-if="obj.type === 'counter'" label="Counter">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-20">Start value</span>
            <input type="number" step="1" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.value ?? 0" @change="store.setCounterValue(obj.id, $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-20">Decimals</span>
            <input type="number" step="1" min="0" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.numDecimals ?? 0" @change="store.setCounterDecimals(obj.id, $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-20">Suffix</span>
            <input type="text" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.suffix ?? ''" @input="store.setCounterSuffix(obj.id, $event.target.value)" placeholder="e.g. %" />
          </div>
        </div>
      </Section>

      <!-- Graph / DiGraph editor -->
      <Section v-if="obj.type === 'graph'" label="Graph">
        <div class="space-y-2">
          <!-- Toggles -->
          <div class="flex gap-3">
            <label class="flex items-center gap-1.5 text-[11px] text-studio-text-muted cursor-pointer">
              <input type="checkbox" :checked="obj.directed" @change="store.setGraphDirected(obj.id, $event.target.checked)" />
              Directed
            </label>
            <label class="flex items-center gap-1.5 text-[11px] text-studio-text-muted cursor-pointer">
              <input type="checkbox" :checked="obj.showLabels" @change="store.setGraphShowLabels(obj.id, $event.target.checked)" />
              Labels
            </label>
          </div>
          <!-- Vertex list -->
          <div class="pt-1">
            <p class="text-[10px] text-studio-text-muted mb-1">Vertices</p>
            <div v-for="v in (obj.vertices || [])" :key="'gv-' + v" class="flex items-center gap-1 mb-1">
              <input class="flex-1 min-w-0 px-1 py-0.5 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                     :value="v" @change="renameGraphVertex(v, $event.target.value)" />
              <button class="px-1.5 py-0.5 text-[10px] rounded border border-studio-border hover:bg-red-500/20 text-studio-text-muted"
                      @click="removeGraphVertex(v)">−</button>
            </div>
            <button class="w-full py-1 text-[10px] rounded border border-dashed border-studio-accent/50 text-studio-accent hover:bg-studio-accent/10"
                    @click="addGraphVertexAuto">+ Add Vertex</button>
          </div>
          <!-- Edge list -->
          <div class="pt-1">
            <p class="text-[10px] text-studio-text-muted mb-1">Edges</p>
            <div v-for="(edge, ei) in (obj.edges || [])" :key="'ge-' + ei" class="flex items-center gap-1 mb-1">
              <span class="flex-1 px-1 py-0.5 text-[11px] text-studio-text-muted font-mono">{{ edge[0] }} → {{ edge[1] }}</span>
              <button class="px-1.5 py-0.5 text-[10px] rounded border border-studio-border hover:bg-red-500/20 text-studio-text-muted"
                      @click="removeGraphEdge(edge[0], edge[1])">−</button>
            </div>
            <div class="flex items-center gap-1 mt-1">
              <select class="flex-1 min-w-0 px-1 py-0.5 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                      :value="newEdgeFrom" @change="newEdgeFrom = $event.target.value">
                <option value="">From…</option>
                <option v-for="v in (obj.vertices || [])" :key="'ef-' + v" :value="v">{{ v }}</option>
              </select>
              <select class="flex-1 min-w-0 px-1 py-0.5 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                      :value="newEdgeTo" @change="newEdgeTo = $event.target.value">
                <option value="">To…</option>
                <option v-for="v in (obj.vertices || [])" :key="'et-' + v" :value="v">{{ v }}</option>
              </select>
              <button class="px-2 py-0.5 text-[10px] rounded border border-studio-accent/50 text-studio-accent hover:bg-studio-accent/10"
                      @click="addGraphEdgeFromUI">Add</button>
            </div>
          </div>
          <p class="text-[10px] text-studio-text-muted/50">Drag vertex handles on the canvas to reposition.</p>
        </div>
      </Section>

      <!-- LaTeX settings -->
      <Section v-if="obj.type === 'latex'" label="LaTeX Expression">
        <textarea class="input input-sm resize-none font-mono" rows="2" :value="obj.latex || ''" @input="u('latex', $event.target.value)" placeholder="E = mc^2"></textarea>
        <p class="text-[8px] text-studio-text-muted/40 mt-1 leading-snug">Raw LaTeX — canvas shows an approximate preview; Manim renders it as MathTex</p>
      </Section>

      <!-- PolarPlane settings -->
      <Section v-if="obj.type === 'polar_plane'" label="PolarPlane">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-24">Radius Max</span>
            <input type="number" step="0.5" min="1" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.radiusMax ?? 4" @change="store.setPolarRadiusMax(obj.id, $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-24">Radius Step</span>
            <input type="number" step="0.5" min="0.1" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.radiusStep ?? 1" @change="store.setPolarRadiusStep(obj.id, $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-24">Azimuth Units</span>
            <input type="number" step="1" min="1" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.azimuthUnits ?? 12" @change="store.setPolarAzimuth(obj.id, $event.target.value)" />
          </div>
        </div>
      </Section>

      <!-- NumberPlane / ComplexPlane settings -->
      <Section v-if="obj.type === 'numberplane' || obj.type === 'complex_plane'" :label="obj.type === 'complex_plane' ? 'ComplexPlane Range' : 'NumberPlane Range'">
        <div class="space-y-1.5">
          <div class="grid grid-cols-3 gap-1">
            <Num label="X Min" :value="(obj.xRange||[-3,3,1])[0]" :step="1" @input="uRange('xRange', 0, $event)" />
            <Num label="X Max" :value="(obj.xRange||[-3,3,1])[1]" :step="1" @input="uRange('xRange', 1, $event)" />
            <Num label="X Step" :value="(obj.xRange||[-3,3,1])[2]" :min="0.1" :step="0.5" @input="uRange('xRange', 2, $event)" />
          </div>
          <div class="grid grid-cols-3 gap-1">
            <Num label="Y Min" :value="(obj.yRange||[-2,2,1])[0]" :step="1" @input="uRange('yRange', 0, $event)" />
            <Num label="Y Max" :value="(obj.yRange||[-2,2,1])[1]" :step="1" @input="uRange('yRange', 1, $event)" />
            <Num label="Y Step" :value="(obj.yRange||[-2,2,1])[2]" :min="0.1" :step="0.5" @input="uRange('yRange', 2, $event)" />
          </div>
        </div>
      </Section>

      <!-- Axes settings -->
      <Section v-if="obj.type === 'axes'" label="Axes Range">
        <div class="space-y-1.5">
          <div class="grid grid-cols-3 gap-1">
            <Num label="X Min" :value="(obj.xRange||[-5,5,1])[0]" :step="1" @input="uRange('xRange', 0, $event)" />
            <Num label="X Max" :value="(obj.xRange||[-5,5,1])[1]" :step="1" @input="uRange('xRange', 1, $event)" />
            <Num label="X Step" :value="(obj.xRange||[-5,5,1])[2]" :min="0.1" :step="0.5" @input="uRange('xRange', 2, $event)" />
          </div>
          <div class="grid grid-cols-3 gap-1">
            <Num label="Y Min" :value="(obj.yRange||[-3,3,1])[0]" :step="1" @input="uRange('yRange', 0, $event)" />
            <Num label="Y Max" :value="(obj.yRange||[-3,3,1])[1]" :step="1" @input="uRange('yRange', 1, $event)" />
            <Num label="Y Step" :value="(obj.yRange||[-3,3,1])[2]" :min="0.1" :step="0.5" @input="uRange('yRange', 2, $event)" />
          </div>
        </div>
      </Section>

      <!-- Axes: Graph Functions -->
      <Section v-if="obj && obj.type === 'axes'" label="Graphs">
        <div v-for="graph in (obj.graphs || [])" :key="graph.id" class="mb-2 p-2 rounded bg-studio-surface2 border border-studio-border">
          <div class="flex items-center gap-1 mb-1">
            <input
              class="input input-sm flex-1 font-mono text-xs"
              :value="graph.expression"
              placeholder="x**2"
              @change="updateGraph(graph.id, 'expression', $event.target.value)"
            />
            <input
              type="color"
              class="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              :value="graph.color"
              @input="updateGraph(graph.id, 'color', $event.target.value)"
            />
            <button class="text-studio-error hover:opacity-80 text-xs px-1" @click="removeGraph(graph.id)">✕</button>
          </div>
          <div class="grid grid-cols-2 gap-1">
            <Num label="x min" :value="graph.xMin" @input="updateGraph(graph.id, 'xMin', $event)" />
            <Num label="x max" :value="graph.xMax" @input="updateGraph(graph.id, 'xMax', $event)" />
          </div>
          <div class="flex items-center gap-2 mt-1">
            <button data-test="graph-area-toggle" class="text-[10px] px-1.5 py-0.5 rounded border border-studio-border" :class="graph.area && graph.area.enabled ? 'text-studio-accent' : 'text-studio-text-muted'" @click="toggleGraphArea(graph)">Area</button>
            <button class="text-[10px] px-1.5 py-0.5 rounded border border-studio-border" :class="graph.riemann && graph.riemann.enabled ? 'text-studio-accent' : 'text-studio-text-muted'" @click="toggleGraphRiemann(graph)">Riemann</button>
          </div>
          <div v-if="graph.riemann && graph.riemann.enabled" class="grid grid-cols-2 gap-1.5 mt-1">
            <Num label="dx" :value="graph.riemann.dx" :min="0.05" :step="0.05" @input="setRiemannField(graph, 'dx', $event)" />
            <div>
              <span class="text-[9px] text-studio-text-muted/50">Sample</span>
              <select class="select text-xs" :value="graph.riemann.type" @change="setRiemannField(graph, 'type', $event.target.value)">
                <option value="left">left</option>
                <option value="right">right</option>
                <option value="center">center</option>
              </select>
            </div>
          </div>
        </div>
        <button
          class="w-full mt-1 py-1 text-xs rounded border border-dashed border-studio-accent/50 text-studio-accent hover:bg-studio-accent/10"
          @click="addGraph"
        >+ Add Graph</button>
      </Section>

      <!-- Z-Order -->
      <Section label="Layer Order">
        <input class="input input-sm w-16" type="number" min="0" :value="obj.zOrder || 0" @change="u('zOrder', Number($event.target.value))" />
      </Section>

      <!-- Group info -->
      <Section v-if="objGroup" label="Group">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-studio-text-muted">{{ objGroup.name }}</span>
          <button class="text-[10px] text-studio-accent hover:underline" @click="ungroup(objGroup.id)">Ungroup</button>
        </div>
      </Section>

      <!-- ═══ Entrance Animation ═══ -->
      <Section label="Entrance">
        <div class="space-y-1.5">
          <select class="select text-xs" :value="obj.enterAnim || 'fade_in'" @change="u('enterAnim', $event.target.value)">
            <option v-for="a in enterAnims" :key="a.value" :value="a.value">{{ a.icon }} {{ a.label }}</option>
          </select>
          <div v-if="obj.enterAnim && obj.enterAnim !== 'none'" class="flex items-center gap-2">
            <span class="text-[9px] text-studio-text-muted w-14">Duration</span>
            <input class="input input-sm w-16" type="number" min="0.1" max="5" step="0.1" :value="obj.enterAnimDur || 0.5" @change="u('enterAnimDur', Number($event.target.value))" />
            <span class="text-[9px] text-studio-text-muted">s</span>
          </div>
          <p class="text-[8px] text-studio-text-muted/40 leading-snug">{{ enterAnimDesc }}</p>
        </div>
      </Section>

      <!-- ═══ Exit Animation ═══ -->
      <Section label="Exit">
        <div class="space-y-1.5">
          <select class="select text-xs" :value="obj.exitAnim || 'fade_out'" @change="u('exitAnim', $event.target.value)">
            <option v-for="a in exitAnims" :key="a.value" :value="a.value">{{ a.icon }} {{ a.label }}</option>
          </select>
          <div v-if="obj.exitAnim && obj.exitAnim !== 'none'" class="flex items-center gap-2">
            <span class="text-[9px] text-studio-text-muted w-14">Duration</span>
            <input class="input input-sm w-16" type="number" min="0.1" max="5" step="0.1" :value="obj.exitAnimDur || 0.5" @change="u('exitAnimDur', Number($event.target.value))" />
            <span class="text-[9px] text-studio-text-muted">s</span>
          </div>
          <p class="text-[8px] text-studio-text-muted/40 leading-snug">{{ exitAnimDesc }}</p>
        </div>
      </Section>

      <MotionPicker :obj="obj" />

      <div class="px-3 py-3 mt-auto">
        <button class="btn btn-danger btn-xs w-full" @click="del">Delete Object</button>
      </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { settingsComponentFor } from '../object-settings/index.js';
import { useProjectStore } from '../../../store/project.js';
import { ENTER_ANIMS, EXIT_ANIMS } from '../../../store/project.js';
import { ANCHOR_GRID, ANCHOR_LABELS } from '../../../constants/anchors.js';
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
import ColorRow from '../ui/ColorRow.vue';
import Position3DPanel from '../Position3DPanel.vue';
import EffectsSection from '../object-settings/EffectsSection.vue';
import TextSettings from '../object-settings/TextSettings.vue';
import MotionPicker from '../object-settings/MotionPicker.vue';

const store = useProjectStore();
const anchorGrid = ANCHOR_GRID;
const anchorLabels = ANCHOR_LABELS;
const enterAnims = ENTER_ANIMS;
const exitAnims = EXIT_ANIMS;

const obj = computed(() => store.selectedObject);
const { u, uSize, uRange } = useObjectUpdate(() => obj.value);
const settingsComp = computed(() => settingsComponentFor(obj.value?.type));

const OBJ_3D_TYPES = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
const is3DObject = computed(() => !!obj.value && OBJ_3D_TYPES.includes(obj.value.type));
function onObj3DUpdate(payload) { if (obj.value) store.updateObject(obj.value.id, payload); }

const enterAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = ENTER_ANIMS.find(a => a.value === (obj.value.enterAnim || 'fade_in'));
  return a ? a.desc : '';
});
const exitAnimDesc = computed(() => {
  if (!obj.value) return '';
  const a = EXIT_ANIMS.find(a => a.value === (obj.value.exitAnim || 'fade_out'));
  return a ? a.desc : '';
});
const objGroup = computed(() => (obj.value ? store.objectGroup(obj.value.id) : null));
const typeLabel = computed(() => {
  if (!obj.value) return '';
  const m = { dot_grid: 'Dot Grid', svg_asset: 'SVG', rectangle: 'Rectangle', latex: 'LaTeX', axes: 'Axes', polygon: 'Polygon' };
  return m[obj.value.type] || obj.value.type;
});
const typeBadge = computed(() => {
  const m = {
    heart: 'bg-pink-600 text-white', square: 'bg-blue-600 text-white', rectangle: 'bg-blue-600 text-white',
    circle: 'bg-green-600 text-white', ellipse: 'bg-cyan-600 text-white',
    triangle: 'bg-amber-600 text-white', star: 'bg-yellow-600 text-white', polygon: 'bg-purple-600 text-white',
    line: 'bg-gray-600 text-white', arrow: 'bg-red-600 text-white',
    dot: 'bg-gray-600 text-white', dot_grid: 'bg-purple-600 text-white',
    text: 'bg-pink-500 text-white', image: 'bg-amber-600 text-white', svg_asset: 'bg-amber-600 text-white',
    latex: 'bg-purple-600 text-white', axes: 'bg-emerald-600 text-white',
  };
  return m[obj.value?.type] || 'bg-gray-600 text-white';
});
const effectiveSize = computed(() => {
  if (!obj.value) return 0;
  return Math.min(obj.value.width || 0, obj.value.height || 0) || 1;
});

function addGraph() { if (obj.value && obj.value.type === 'axes') store.addGraph(obj.value.id); }
function removeGraph(graphId) { if (obj.value) store.removeGraph(obj.value.id, graphId); }
function updateGraph(graphId, key, value) { if (obj.value) store.updateGraph(obj.value.id, graphId, { [key]: value }); }
function toggleGraphArea(graph) {
  if (!obj.value) return;
  const existing = graph.area || {}; const on = !existing.enabled;
  store.updateGraph(obj.value.id, graph.id, { area: on ? { xMin: graph.xMin, xMax: graph.xMax, opacity: 0.5, color: graph.color, ...existing, enabled: true } : { ...existing, enabled: false } });
}
function toggleGraphRiemann(graph) {
  if (!obj.value) return;
  const existing = graph.riemann || {}; const on = !existing.enabled;
  store.updateGraph(obj.value.id, graph.id, { riemann: on ? { xMin: graph.xMin, xMax: graph.xMax, dx: Math.max(0.1, (graph.xMax - graph.xMin) / 10), type: 'left', color: graph.color, ...existing, enabled: true } : { ...existing, enabled: false } });
}
function setRiemannField(graph, key, val) { if (obj.value && graph.riemann) store.updateGraph(obj.value.id, graph.id, { riemann: { ...graph.riemann, [key]: val } }); }

const newEdgeFrom = ref('');
const newEdgeTo = ref('');
watch(() => store.selectedObjectIds, () => { newEdgeFrom.value = ''; newEdgeTo.value = ''; });
function graphVertexName(v) { return String(v || '').trim(); }
function addGraphVertexAuto() { if (obj.value) store.addGraphVertex(obj.value.id); }
function removeGraphVertex(v) { if (obj.value) store.removeGraphVertex(obj.value.id, v); }
function renameGraphVertex(oldV, newV) { if (!obj.value) return; const nv = graphVertexName(newV); if (nv && nv !== oldV) store.renameGraphVertex(obj.value.id, oldV, nv); }
function addGraphEdgeFromUI() { if (!obj.value) return; const a = newEdgeFrom.value, b = newEdgeTo.value; if (a && b && a !== b) { store.addGraphEdge(obj.value.id, a, b); newEdgeFrom.value = ''; newEdgeTo.value = ''; } }
function removeGraphEdge(a, b) { if (obj.value) store.removeGraphEdge(obj.value.id, a, b); }

function align(anchor) { if (obj.value) store.alignObject(obj.value.id, anchor); }
function ungroup(groupId) { store.ungroupObjects(groupId); }
function del() { if (obj.value) store.deleteObject(obj.value.id); }
</script>

<style scoped>
.anchor-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background: var(--studio-bg);
  border-radius: 6px;
  width: fit-content;
}
.anchor-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--studio-surface);
  border: 1px solid var(--studio-border);
  border-radius: 4px;
  color: var(--studio-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.anchor-btn:hover {
  background: var(--studio-border);
  color: var(--studio-text);
}
.anchor-btn:active {
  background: var(--studio-accent);
  border-color: var(--studio-accent);
  color: var(--studio-text);
}


</style>
