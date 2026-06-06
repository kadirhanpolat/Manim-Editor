/**
 * Project State Store — v3 + Groups + Text + Server sync
 *
 * Video-editor style data model with full API integration.
 * Objects live on the timeline with enter/exit times.
 * Clips are animations between or on objects.
 * Assets hold uploaded images/SVGs.
 * Groups are logical containers with margin/padding.
 *
 * Server actions: saveToServer, loadFromServer, renderOnServer, pollRenderJob
 */

import { createPinia, defineStore, setActivePinia } from 'pinia';
import api, { connectJobWebSocket } from '../api.js';
import { presetVertices } from '../engine/polygonVertices.js';

const MAX_HISTORY = 50;

// ─── Defaults ────────────────────────────────────────────────────────────────

const CODE_MODE_TEMPLATE = `from manim import *

class MainScene(Scene):
    def construct(self):
        text = Text("Hello, Manim!")
        self.play(Write(text))
        self.wait()
`;

function createDefaultProject(editorMode = 'visual') {
  return {
    id: null,
    name: 'My Animation',
    editorMode,          // 'visual' | 'code'
    codeSource: editorMode === 'code' ? CODE_MODE_TEMPLATE : '',
    stage: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      backgroundOpacity: 1,
      backgroundImage: null,
      gridVisible: true,
      gridSize: 8,
      gridColor: '#ffffff',
      gridOpacity: 0.12,
      snapEnabled: true,
      snapToGrid: true,
      snapToCenter: true,
      snapToObjects: false
    },
    assets: [],      // { id, name, type:'image'|'svg', dataUrl, width, height, filename, serverFilename }
    objects: [],
    groups: [],       // { id, name, childIds:[], margin:10, collapsed:false }
    tracks: [
      { id: 'track_1', name: 'Track 1', clips: [] }
    ],
    sceneDuration: 10,
    cameraType: 'static',   // 'static' | 'moving'
    cameraTrack: [],         // camera_move clips
    keyframeDefaults: {
      mode: 'opt-in',
      codegenMode: 'UpdateFromAlphaFunc'
    },
    sceneType: '2d',           // '2d' | '3d'
    camera3d: {
      phi: 75,
      theta: -45,
      zoom: 1.0,
      view: 'perspective',  // 'perspective' | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' — preview-only
      focalDistance: 8,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _counter = 0;
export function uid(prefix = 'id') {
  _counter++;
  return `${prefix}_${Date.now().toString(36)}_${_counter}`;
}

let _objectAddCount = 0;
function nextPosition(stageW, stageH) {
  const positions = [
    { x: stageW * 0.35, y: stageH * 0.5 },
    { x: stageW * 0.65, y: stageH * 0.5 },
    { x: stageW * 0.5,  y: stageH * 0.35 },
    { x: stageW * 0.5,  y: stageH * 0.65 },
    { x: stageW * 0.5,  y: stageH * 0.5 },
  ];
  const pos = positions[_objectAddCount % positions.length];
  _objectAddCount++;
  return pos;
}

let _pollDisconnect = null;

// ─── Entrance / Exit animation types ─────────────────────────────────────────

export const ENTER_ANIMS = [
  { value: 'none',           label: 'None',             icon: '—',  desc: 'Appears instantly' },
  { value: 'fade_in',        label: 'Fade In',          icon: '◐',  desc: 'Fade from transparent' },
  { value: 'grow_in',        label: 'Grow In',          icon: '⊕',  desc: 'Scale up from zero' },
  { value: 'fly_in_left',    label: 'Fly In Left',      icon: '→',  desc: 'Slide in from left' },
  { value: 'fly_in_right',   label: 'Fly In Right',     icon: '←',  desc: 'Slide in from right' },
  { value: 'fly_in_top',     label: 'Fly In Top',       icon: '↓',  desc: 'Slide in from top' },
  { value: 'fly_in_bottom',  label: 'Fly In Bottom',    icon: '↑',  desc: 'Slide in from bottom' },
  { value: 'draw',           label: 'Draw / Create',    icon: '✎',  desc: 'Outline draws, then fills' },
  { value: 'write',          label: 'Write',            icon: '✍',  desc: 'Write effect (text/shapes)' },
  { value: 'spin_in',        label: 'Spin In',          icon: '↻',  desc: 'Rotate in while fading' },
  { value: 'bounce_in',      label: 'Bounce In',        icon: '⤴',  desc: 'Bounce into place' },
  { value: 'typewriter',     label: 'Typewriter',       icon: '⌨',  desc: 'Reveal char by char' },
];

export const EXIT_ANIMS = [
  { value: 'none',            label: 'None',             icon: '—',  desc: 'Disappears instantly' },
  { value: 'fade_out',        label: 'Fade Out',         icon: '◑',  desc: 'Fade to transparent' },
  { value: 'shrink_out',      label: 'Shrink Out',       icon: '⊖',  desc: 'Scale down to zero' },
  { value: 'fly_out_left',    label: 'Fly Out Left',     icon: '←',  desc: 'Slide out to left' },
  { value: 'fly_out_right',   label: 'Fly Out Right',    icon: '→',  desc: 'Slide out to right' },
  { value: 'fly_out_top',     label: 'Fly Out Top',      icon: '↑',  desc: 'Slide out to top' },
  { value: 'fly_out_bottom',  label: 'Fly Out Bottom',   icon: '↓',  desc: 'Slide out to bottom' },
  { value: 'uncreate',        label: 'Uncreate',         icon: '✎',  desc: 'Reverse draw' },
  { value: 'spin_out',        label: 'Spin Out',         icon: '↻',  desc: 'Rotate out while fading' },
  { value: 'typewriter_out',  label: 'Typewriter Out',   icon: '⌨',  desc: 'Hide char by char' },
];

// ─── Shape palette ───────────────────────────────────────────────────────────

export const SHAPE_DEFAULTS = {
  rectangle:{ width: 160, height: 100, fill: '#3b82f6', stroke: '#fff',  strokeWidth: 2 },
  square:   { width: 120, height: 120, fill: '#3b82f6', stroke: '#fff',  strokeWidth: 2 },
  circle:   { width: 120, height: 120, fill: '#22c55e', stroke: '#fff',  strokeWidth: 2 },
  ellipse:  { width: 160, height: 100, fill: '#06b6d4', stroke: '#fff',  strokeWidth: 2 },
  triangle: { width: 120, height: 120, fill: '#f59e0b', stroke: '#fff',  strokeWidth: 2 },
  star:     { width: 120, height: 120, fill: '#eab308', stroke: '#fff',  strokeWidth: 2 },
  polygon:  { width: 120, height: 120, fill: '#8b5cf6', stroke: '#fff',  strokeWidth: 2 },
  polygon_free: { width: 160, height: 120, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 },
  line:     { width: 200, height: 4,   fill: '#94a3b8', stroke: '#94a3b8', strokeWidth: 3 },
  arrow:    { width: 200, height: 40,  fill: '#ef4444', stroke: '#fff',  strokeWidth: 2 },
  heart:    { width: 120, height: 120, fill: '#ec4899', stroke: '#fff',  strokeWidth: 2 },
  dot:      { width: 20,  height: 20,  fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  dot_grid: { width: 200, height: 200, fill: '#a855f7', stroke: 'transparent', strokeWidth: 0 },
  text:     { width: 200, height: 50,  fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  image:    { width: 200, height: 200, fill: 'transparent', stroke: 'transparent', strokeWidth: 0 },
  svg_asset:{ width: 200, height: 200, fill: 'transparent', stroke: 'transparent', strokeWidth: 0 },
  latex:    { width: 200, height: 80,  fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  axes:     { width: 400, height: 300, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2 },
  numberplane:{ width: 600, height: 400, fill: '#334155', stroke: '#64748b', strokeWidth: 1 },
  complex_plane:{ width: 600, height: 400, fill: '#334155', stroke: '#64748b', strokeWidth: 1 },
  polar_plane:  { width: 400, height: 400, fill: '#334155', stroke: '#64748b', strokeWidth: 1 },
  numberline: { width: 500, height: 60,  fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2 },
  sphere:     { width: 120, height: 120, fill: '#e67700', stroke: '#fff', strokeWidth: 2 },
  cube:       { width: 120, height: 120, fill: '#3b5bdb', stroke: '#fff', strokeWidth: 2 },
  cone:       { width: 100, height: 120, fill: '#2f9e44', stroke: '#fff', strokeWidth: 2 },
  cylinder:   { width: 100, height: 120, fill: '#1098ad', stroke: '#fff', strokeWidth: 2 },
  torus:      { width: 130, height: 130, fill: '#ae3ec9', stroke: '#fff', strokeWidth: 2 },
  axes3d:     { width: 400, height: 400, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2 },
  annulus:  { width: 140, height: 140, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 },
  arc:      { width: 140, height: 140, fill: 'transparent', stroke: '#f97316', strokeWidth: 4 },
  sector:   { width: 140, height: 140, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 },
  double_arrow: { width: 200, height: 40, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 },
  parametric: { width: 160, height: 160, fill: 'transparent', stroke: '#10b981', strokeWidth: 4 },
  matrix: { width: 160, height: 120, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 0 },
  table: { width: 200, height: 140, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 0 },
  brace: { width: 160, height: 60, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2 },
  angle: { width: 140, height: 140, fill: '#fbbf24', stroke: '#fbbf24', strokeWidth: 2 },
  counter: { width: 120, height: 60, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  graph:   { width: 200, height: 200, fill: '#22c55e', stroke: '#ffffff', strokeWidth: 2 },
  vector_field: { width: 600, height: 400, fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 2 },
};

export const SHAPE_COLORS = {
  rectangle: '#3b82f6', square: '#3b82f6', circle: '#22c55e', ellipse: '#06b6d4',
  triangle: '#f59e0b', star: '#eab308', polygon: '#8b5cf6',
  line: '#94a3b8', arrow: '#ef4444',
  heart: '#ec4899', dot: '#94a3b8', dot_grid: '#a855f7',
  text: '#f472b6', image: '#f59e0b', svg_asset: '#f59e0b',
  latex: '#a855f7', axes: '#10b981',
  numberplane: '#334155', complex_plane: '#334155', polar_plane: '#334155', numberline: '#10b981',
  sphere: '#e67700', cube: '#3b5bdb', cone: '#2f9e44',
  cylinder: '#1098ad', torus: '#ae3ec9', axes3d: '#10b981',
  annulus: '#14b8a6', arc: '#f97316', sector: '#f59e0b', double_arrow: '#ef4444',
  polygon_free: '#8b5cf6',
  parametric: '#10b981',
  matrix: '#ffffff',
  table: '#ffffff',
  brace: '#ffffff',
  angle: '#fbbf24',
  counter: '#38bdf8',
  graph:   '#22c55e',
  vector_field: '#38bdf8',
};

// ─── Pinia Store ─────────────────────────────────────────────────────────────

export const pinia = createPinia();
setActivePinia(pinia);

const useProjectStore = defineStore('project', {
  state: () => ({
    project: createDefaultProject(),
    selectedObjectIds: [],
    selectedClipId: null,
    selectedKeyframeId: null,
    activeTool: 'select',
    playbackTime: 0,
    playbackPlaying: false,
    playbackLoop: true,
    frameState: {
      objectOverrides: {},
      morphShapes: [],
      hiddenIds: new Set()
    },
    showExportDialog: false,
    exportCode: '',
    showRenderDialog: false,
    renderJobId: null,
    renderStatus: null,
    renderError: null,
    renderQuality: 'high',
    renderVideoUrl: null,
    renderLog: '',
    showProjectBrowser: false,
    serverProjects: [],
    apiAvailable: null,
    history: { past: [], future: [] },
    clipboard: [],
    isDirty: false,
    error: null,
    loading: false,
    savingToServer: false,
    theme: (typeof localStorage !== 'undefined' && localStorage.getItem('manim-motion-theme')) || 'light'
  }),
  getters: {
    selectedObjects: (state) => state.selectedObjectIds.map(id => state.project.objects.find(o => o.id === id)).filter(Boolean),
    selectedObject: (state) => {
      if (state.selectedObjectIds.length !== 1) return null;
      return state.project.objects.find(o => o.id === state.selectedObjectIds[0]) || null;
    },
    selectedClip: (state) => {
      if (!state.selectedClipId) return null;
      for (const track of state.project.tracks) {
        const clip = track.clips.find(c => c.id === state.selectedClipId);
        if (clip) return clip;
      }
      return null;
    },
    objectById: (state) => (id) => state.project.objects.find(o => o.id === id) || null,
    assetById: (state) => (id) => state.project.assets.find(a => a.id === id) || null,
    clipById: (state) => (id) => {
      for (const track of state.project.tracks) {
        const clip = track.clips.find(c => c.id === id);
        if (clip) return clip;
      }
      return null;
    },
    groupById: (state) => (id) => (state.project.groups || []).find(g => g.id === id) || null,
    objectGroup: (state) => (objId) => (state.project.groups || []).find(g => g.childIds && g.childIds.includes(objId)) || null,
    computedDuration: (state) => {
      let maxEnd = 5;
      for (const obj of state.project.objects) {
        const end = (obj.enterTime || 0) + (obj.duration || 5);
        if (end > maxEnd) maxEnd = end;
      }
      for (const track of state.project.tracks) {
        for (const clip of track.clips) {
          const end = clip.startTime + clip.duration;
          if (end > maxEnd) maxEnd = end;
        }
      }
      return Math.max(state.project.sceneDuration, maxEnd + 1);
    },
    visibleTracks: (state) => {
      const all = state.project.tracks;
      const activeCount = all.filter(t => t.clips.length > 0).length;
      const showCount = Math.min(5, Math.max(1, activeCount + 1));
      return all.slice(0, showCount);
    },
    hasPendingAudio: (state) => state.project.tracks.some(t =>
      t.clips.some(c => c.audio && c.audio.status === 'pending')
    ),
  },
  actions: {
    // ══════════════════════════════════════════════════════════════════════════
    // Objects
    // ══════════════════════════════════════════════════════════════════════════

    addObject(type, x, y, extraProps = {}) {
      const stage = this.project.stage;
      const d = SHAPE_DEFAULTS[type] || SHAPE_DEFAULTS.circle;
      const pos = (x !== undefined && y !== undefined)
        ? { x, y }
        : nextPosition(stage.width, stage.height);

      const lastEnd = this.project.objects.reduce((max, o) => {
        const end = (o.enterTime || 0) + (o.duration || 5);
        return end > max ? end : max;
      }, 0);

      const nameMap = {
        dot_grid: 'Dot Grid', svg_asset: 'SVG', rectangle: 'Rectangle',
        ellipse: 'Ellipse', triangle: 'Triangle', star: 'Star',
        polygon: 'Polygon', line: 'Line', arrow: 'Arrow', text: 'Text',
        latex: 'LaTeX', axes: 'Axes',
        numberplane: 'NumberPlane', complex_plane: 'ComplexPlane', polar_plane: 'PolarPlane', numberline: 'NumberLine',
        annulus: 'Annulus', arc: 'Arc', sector: 'Sector', double_arrow: 'Double Arrow',
        polygon_free: 'Polygon', parametric: 'Parametric',
        matrix: 'Matrix', table: 'Table', brace: 'Brace', angle: 'Angle', counter: 'Counter',
        graph: 'Graph', vector_field: 'VectorField',
      };
      const displayName = nameMap[type] || (type.charAt(0).toUpperCase() + type.slice(1));

      const obj = {
        id: uid('obj'),
        type,
        name: `${displayName} ${this.project.objects.length + 1}`,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        width: d.width,
        height: d.height,
        rotation: 0,
        fill: d.fill,
        stroke: d.stroke,
        strokeWidth: d.strokeWidth,
        opacity: 1,
        zOrder: this.project.objects.length,
        visible: true,
        enterTime: this.project.objects.length === 0 ? 0 : Math.round(lastEnd * 10) / 10,
        duration: 3,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        enterAnimDur: 0.5,
        exitAnimDur: 0.5,
        ...(type === 'dot_grid' ? { gridCols: 5, gridRows: 5, dotRadius: 5, dotSpacing: 40 } : {}),
        ...(type === 'text' ? { content: 'Hello World', fontSize: 48, fontFamily: 'Roboto', textAlign: 'center', fontWeight: 'normal', fontStyle: 'normal' } : {}),
        ...(type === 'polygon' ? { sides: 6 } : {}),
        ...(type === 'star' ? { starArms: 5, innerRatio: 0.4 } : {}),
        ...(type === 'parametric' ? { xExpr: 'np.cos(t)', yExpr: 'np.sin(t)', tMin: 0, tMax: 6.283 } : {}),
        ...(type === 'polygon_free' ? { vertices: presetVertices('trapezoid', SHAPE_DEFAULTS.polygon_free.width, SHAPE_DEFAULTS.polygon_free.height) } : {}),
        ...(type === 'matrix' ? { matrixData: [['1', '0'], ['0', '1']], bracket: '[' } : {}),
        ...(type === 'table' ? { cellData: [['1', '2'], ['3', '4']], mathMode: false, rowLabels: [], colLabels: [] } : {}),
        ...(type === 'brace' ? { p1: [-80, 0], p2: [80, 0], label: '' } : {}),
        ...(type === 'angle' ? { vertex: [-40, 40], point1: [80, 40], point2: [-40, -60], rightAngle: false, radius: 0.6, label: '' } : {}),
        ...(type === 'counter' ? { value: 0, numDecimals: 0, suffix: '' } : {}),
        ...(type === 'graph' ? { vertices: ['A','B','C'], edges: [['A','B'],['B','C']], positions: { A:[-60,0], B:[0,-40], C:[60,0] }, directed: false, showLabels: true } : {}),
        ...(type === 'vector_field' ? { fx: 'y', fy: '-x', xRange: [-3,3,1], yRange: [-2,2,1] } : {}),
        ...(type === 'annulus' ? { outerRadius: 70, innerRadius: 35 } : {}),
        ...(type === 'arc'    ? { radius: 70, startAngle: 0, sweepAngle: 180 } : {}),
        ...(type === 'sector' ? { radius: 70, startAngle: 0, sweepAngle: 90 } : {}),
        ...(type === 'latex' ? { latex: 'E = mc^2' } : {}),
        ...(type === 'axes'        ? { xRange: [-5, 5, 1], yRange: [-3, 3, 1], graphs: [] } : {}),
        ...(type === 'numberplane' ? { xRange: [-5, 5, 1], yRange: [-3, 3, 1], xStep: 1, yStep: 1 } : {}),
        ...(type === 'complex_plane' ? { xRange: [-3, 3, 1], yRange: [-2, 2, 1] } : {}),
        ...(type === 'polar_plane' ? { radiusMax: 4, radiusStep: 1, azimuthUnits: 12 } : {}),
        ...(type === 'numberline'  ? { xRange: [-5, 5, 1] } : {}),
        ...extraProps
      };

      const is3D = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'].includes(type);
      if (is3D) {
        obj.x3d = 0;
        obj.y3d = 0;
        obj.z3d = 0;
        obj.rx = 0;
        obj.ry = 0;
        obj.rz = 0;
        obj.resolution = 20;
        obj.sideLength = 1.0;    // cube
        obj.radius = 0.5;        // sphere/cone/cylinder/torus
        obj.height = 1.5;        // cone/cylinder
        obj.majorRadius = 1.0;   // torus
        obj.minorRadius = 0.3;   // torus
      }
      if (type === 'axes3d') {
        obj.xRange = [-3, 3, 1];
        obj.yRange = [-3, 3, 1];
        obj.zRange = [-3, 3, 1];
      }

      this.project.objects.push(obj);
      this.isDirty = true;
      this.commitState();
      return obj;
    },

    addImageObject(assetId, x, y) {
      const asset = this.project.assets.find(a => a.id === assetId);
      if (!asset) return null;

      const type = asset.type === 'svg' ? 'svg_asset' : 'image';
      const aspectRatio = (asset.width && asset.height) ? asset.width / asset.height : 1;
      const height = 200;
      const width = Math.round(height * aspectRatio);

      return this.addObject(type, x, y, {
        name: asset.name,
        assetId: asset.id,
        width,
        height,
        naturalWidth: asset.width || width,
        naturalHeight: asset.height || height
      });
    },

    updateObject(id, updates) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      for (const key of Object.keys(updates)) {
        obj[key] = updates[key];
      }
      this.isDirty = true;
      this._debouncedCommit();
    },

    setPolygonVertices(id, vertices) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(vertices) || vertices.length < 3) return;
      obj.vertices = vertices.map(([x, y]) => [Math.round(x), Math.round(y)]);
      this.isDirty = true;
      this._debouncedCommit();
    },

    setMatrixCell(id, r, c, value) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData)) return;
      if (!obj.matrixData[r] || obj.matrixData[r][c] === undefined) return;
      obj.matrixData[r][c] = String(value);
      this.isDirty = true;
      this._debouncedCommit();
    },

    addMatrixRow(id) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData) || !obj.matrixData[0]) return;
      obj.matrixData.push(new Array(obj.matrixData[0].length).fill('0'));
      this.isDirty = true;
      this.commitState();
    },

    removeMatrixRow(id) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData) || obj.matrixData.length <= 1) return;
      obj.matrixData.pop();
      this.isDirty = true;
      this.commitState();
    },

    addMatrixColumn(id) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData)) return;
      obj.matrixData.forEach(row => row.push('0'));
      this.isDirty = true;
      this.commitState();
    },

    removeMatrixColumn(id) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !Array.isArray(obj.matrixData) || !obj.matrixData[0] || obj.matrixData[0].length <= 1) return;
      obj.matrixData.forEach(row => row.pop());
      this.isDirty = true;
      this.commitState();
    },

    setMatrixBracket(id, bracket) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !['[', '(', '|'].includes(bracket)) return;
      obj.bracket = bracket;
      this.isDirty = true;
      this._debouncedCommit();
    },

    setTableCell(id, r, c, value) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData) || !obj.cellData[r] || obj.cellData[r][c] === undefined) return;
      obj.cellData[r][c] = String(value); this.isDirty = true; this._debouncedCommit();
    },
    addTableRow(id) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData) || !obj.cellData[0]) return;
      obj.cellData.push(new Array(obj.cellData[0].length).fill('0')); this.isDirty = true; this.commitState();
    },
    removeTableRow(id) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData) || obj.cellData.length <= 1) return;
      obj.cellData.pop(); if (Array.isArray(obj.rowLabels) && obj.rowLabels.length > obj.cellData.length) obj.rowLabels.splice(obj.cellData.length);
      this.isDirty = true; this.commitState();
    },
    addTableColumn(id) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData)) return;
      obj.cellData.forEach(row => row.push('0')); this.isDirty = true; this.commitState();
    },
    removeTableColumn(id) {
      const obj = this.objectById(id);
      if (!obj || !Array.isArray(obj.cellData) || !obj.cellData[0] || obj.cellData[0].length <= 1) return;
      obj.cellData.forEach(row => row.pop()); if (Array.isArray(obj.colLabels) && obj.colLabels.length > obj.cellData[0].length) obj.colLabels.splice(obj.cellData[0].length);
      this.isDirty = true; this.commitState();
    },
    setTableMathMode(id, on) { const o = this.objectById(id); if (!o) return; o.mathMode = !!on; this.isDirty = true; this.commitState(); },
    setTableRowLabels(id, arr) { const o = this.objectById(id); if (!o || !Array.isArray(arr)) return; o.rowLabels = arr.map(s => String(s)); this.isDirty = true; this._debouncedCommit(); },
    setTableColLabels(id, arr) { const o = this.objectById(id); if (!o || !Array.isArray(arr)) return; o.colLabels = arr.map(s => String(s)); this.isDirty = true; this._debouncedCommit(); },

    setRelationalPoint(id, key, pt) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || !['p1', 'p2', 'vertex', 'point1', 'point2'].includes(key)) return;
      if (obj[key] === undefined || !Array.isArray(pt) || pt.length !== 2) return;
      obj[key] = [Math.round(pt[0]), Math.round(pt[1])];
      this.isDirty = true;
      this._debouncedCommit();
    },

    setAngleRightMode(id, on) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || obj.type !== 'angle') return;
      obj.rightAngle = !!on;
      this.isDirty = true;
      this.commitState();
    },

    setAngleRadius(id, r) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj || obj.type !== 'angle') return;
      const v = Number(r);
      if (!Number.isFinite(v) || v <= 0) return;
      obj.radius = v;
      this.isDirty = true;
      this._debouncedCommit();
    },

    setRelationalLabel(id, label) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      obj.label = String(label == null ? '' : label);
      this.isDirty = true;
      this._debouncedCommit();
    },

    setGradient(id, gradient) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      if (gradient && Array.isArray(gradient.colors) && gradient.colors.length >= 2) {
        obj.gradient = { colors: [...gradient.colors], angle: gradient.angle ?? 135 };
      } else {
        delete obj.gradient;
      }
      this.isDirty = true;
      this._debouncedCommit();
    },

    setCornerRadius(id, px) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      const r = Number(px);
      if (Number.isFinite(r) && r > 0) obj.cornerRadius = r;
      else delete obj.cornerRadius;
      this.isDirty = true;
      this._debouncedCommit();
    },

    setDash(id, dash) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      if (dash) {
        const numDashes = Math.max(2, Math.round(Number(dash.numDashes) || 12));
        const ratio = Math.max(0, Math.min(1, Number(dash.ratio ?? 0.5)));
        obj.dash = { numDashes, ratio };
      } else {
        delete obj.dash;
      }
      this.isDirty = true;
      this._debouncedCommit();
    },

    setShadow(id, shadow) {
      const obj = this.project.objects.find(o => o.id === id);
      if (!obj) return;
      if (shadow) {
        obj.shadow = {
          color: typeof shadow.color === 'string' ? shadow.color : '#000000',
          opacity: Number.isFinite(shadow.opacity) ? shadow.opacity : 0.4,
          dx: Number.isFinite(shadow.dx) ? shadow.dx : 8,
          dy: Number.isFinite(shadow.dy) ? shadow.dy : 8,
          blur: Number.isFinite(shadow.blur) ? shadow.blur : 12,
        };
      } else {
        delete obj.shadow;
      }
      this.isDirty = true;
      this._debouncedCommit();
    },

    setCounterValue(objId, v) { const o = this.objectById(objId); if (!o) return; o.value = Number(v) || 0; this.commitState(); },
    setCounterDecimals(objId, n) { const o = this.objectById(objId); if (!o) return; o.numDecimals = Math.max(0, Math.floor(Number(n) || 0)); this.commitState(); },
    setCounterSuffix(objId, s) { const o = this.objectById(objId); if (!o) return; o.suffix = String(s ?? ''); this.commitState(); },

    setPolarRadiusMax(id, v) { const o = this.objectById(id); if (!o) return; o.radiusMax = Math.max(1, Number(v) || 4); this.isDirty = true; this._debouncedCommit(); },
    setPolarRadiusStep(id, v) { const o = this.objectById(id); if (!o) return; const n = Number(v); o.radiusStep = Math.max(0.1, Number.isFinite(n) ? n : 1); this.isDirty = true; this._debouncedCommit(); },
    setPolarAzimuth(id, v) { const o = this.objectById(id); if (!o) return; o.azimuthUnits = Math.max(1, Math.trunc(Number(v) || 12)); this.isDirty = true; this._debouncedCommit(); },

    addGraphVertex(id, name) {
      const o = this.objectById(id); if (!o) return;
      const v = String(name || `V${o.vertices.length + 1}`);
      if (o.vertices.includes(v)) return;
      o.vertices.push(v); o.positions[v] = [0, 0]; this.isDirty = true; this.commitState();
    },
    removeGraphVertex(id, v) {
      const o = this.objectById(id); if (!o) return;
      o.vertices = o.vertices.filter(x => x !== v);
      o.edges = o.edges.filter(e => e[0] !== v && e[1] !== v);
      delete o.positions[v]; this.isDirty = true; this.commitState();
    },
    renameGraphVertex(id, oldV, newV) {
      const o = this.objectById(id); if (!o) return;
      const nv = String(newV); if (!nv || o.vertices.includes(nv)) return;
      o.vertices = o.vertices.map(x => x === oldV ? nv : x);
      o.edges = o.edges.map(e => [e[0] === oldV ? nv : e[0], e[1] === oldV ? nv : e[1]]);
      if (o.positions[oldV]) { o.positions[nv] = o.positions[oldV]; delete o.positions[oldV]; }
      this.isDirty = true; this.commitState();
    },
    addGraphEdge(id, a, b) {
      const o = this.objectById(id); if (!o || !o.vertices.includes(a) || !o.vertices.includes(b)) return;
      if (a === b) return;
      if (o.edges.some(e => e[0] === a && e[1] === b)) return;
      o.edges.push([a, b]); this.isDirty = true; this.commitState();
    },
    removeGraphEdge(id, a, b) {
      const o = this.objectById(id); if (!o) return;
      o.edges = o.edges.filter(e => !(e[0] === a && e[1] === b)); this.isDirty = true; this.commitState();
    },
    setGraphVertexPosition(id, v, pt) {
      const o = this.objectById(id); if (!o || !Array.isArray(pt) || pt.length !== 2) return;
      o.positions[v] = [Math.round(pt[0]), Math.round(pt[1])]; this.isDirty = true; this._debouncedCommit();
    },
    setGraphDirected(id, on) { const o = this.objectById(id); if (!o) return; o.directed = !!on; this.isDirty = true; this.commitState(); },
    setGraphShowLabels(id, on) { const o = this.objectById(id); if (!o) return; o.showLabels = !!on; this.isDirty = true; this.commitState(); },

    setFieldExpr(id, axis, expr) { const o = this.objectById(id); if (!o || (axis !== 'fx' && axis !== 'fy')) return; o[axis] = String(expr); this.isDirty = true; this._debouncedCommit(); },
    setFieldRange(id, axis, range) { const o = this.objectById(id); if (!o || (axis !== 'xRange' && axis !== 'yRange') || !Array.isArray(range)) return; o[axis] = range.map(Number); this.isDirty = true; this._debouncedCommit(); },

    deleteObject(id) {
      const idx = this.project.objects.findIndex(o => o.id === id);
      if (idx === -1) return;
      this.project.objects.splice(idx, 1);
      const selIdx = this.selectedObjectIds.indexOf(id);
      if (selIdx !== -1) this.selectedObjectIds.splice(selIdx, 1);
      for (const track of this.project.tracks) {
        track.clips = track.clips.filter(c => c.sourceId !== id && c.targetId !== id);
      }
      // Remove from any group
      for (const group of (this.project.groups || [])) {
        const gIdx = (group.childIds || []).indexOf(id);
        if (gIdx !== -1) group.childIds.splice(gIdx, 1);
      }
      // Remove empty groups
      if (this.project.groups) {
        this.project.groups = this.project.groups.filter(g => g.childIds && g.childIds.length > 0);
      }
      this.isDirty = true;
      this.commitState();
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Groups
    // ══════════════════════════════════════════════════════════════════════════

    groupObjects(ids) {
      if (!ids || ids.length < 2) {
        this.setError('Select at least 2 objects to group');
        return null;
      }
      // Remove these objects from existing groups
      for (const group of (this.project.groups || [])) {
        group.childIds = (group.childIds || []).filter(cid => !ids.includes(cid));
      }
      // Clean empty groups
      if (!this.project.groups) this.project.groups = [];
      this.project.groups = this.project.groups.filter(g => g.childIds && g.childIds.length > 0);

      const group = {
        id: uid('group'),
        name: `Group ${(this.project.groups || []).length + 1}`,
        childIds: [...ids],
        margin: 10,
        collapsed: false
      };
      this.project.groups.push(group);
      this.isDirty = true;
      this.commitState();
      return group;
    },

    ungroupObjects(groupId) {
      if (!this.project.groups) return;
      const idx = this.project.groups.findIndex(g => g.id === groupId);
      if (idx !== -1) {
        this.project.groups.splice(idx, 1);
        this.isDirty = true;
        this.commitState();
      }
    },

    updateGroup(groupId, updates) {
      const group = (this.project.groups || []).find(g => g.id === groupId);
      if (!group) return;
      for (const key of Object.keys(updates)) {
        group[key] = updates[key];
      }
      this.isDirty = true;
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Assets
    // ══════════════════════════════════════════════════════════════════════════

    async uploadAsset(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          const img = new Image();
          img.onload = () => {
            const asset = {
              id: uid('asset'),
              name: file.name.replace(/\.[^.]+$/, ''),
              filename: file.name,
              type: file.type.includes('svg') ? 'svg' : 'image',
              dataUrl,
              width: img.naturalWidth,
              height: img.naturalHeight,
              serverFilename: null
            };
            this.project.assets.push(asset);
            this.isDirty = true;
            resolve(asset);
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = dataUrl;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    },

    removeAsset(id) {
      const idx = this.project.assets.findIndex(a => a.id === id);
      if (idx !== -1) {
        this.project.assets.splice(idx, 1);
        this.isDirty = true;
      }
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Selection
    // ══════════════════════════════════════════════════════════════════════════

    selectObject(id, addToSelection = false) {
      if (!id) { this.selectedObjectIds = []; this.selectedClipId = null; return; }
      if (addToSelection) {
        const idx = this.selectedObjectIds.indexOf(id);
        if (idx !== -1) this.selectedObjectIds.splice(idx, 1);
        else this.selectedObjectIds.push(id);
      } else {
        this.selectedObjectIds = [id];
      }
      this.selectedClipId = null;
    },

    selectClip(clipId) {
      this.selectedClipId = clipId;
      this.selectedObjectIds = [];
    },

    deselectAll() {
      this.selectedObjectIds = [];
      this.selectedClipId = null;
    },

    setActiveTool(tool) { this.activeTool = tool; },

    // ══════════════════════════════════════════════════════════════════════════
    // Clips
    // ══════════════════════════════════════════════════════════════════════════

    addGraph(objId, graphData = {}) {
      const obj = this.objectById(objId);
      if (!obj || obj.type !== 'axes') return null;
      if (!obj.graphs) obj.graphs = [];
      const graph = {
        id: uid('graph'),
        expression: graphData.expression || 'x**2',
        color: graphData.color || '#f59e0b',
        xMin: graphData.xMin ?? (obj.xRange?.[0] ?? -5),
        xMax: graphData.xMax ?? (obj.xRange?.[1] ?? 5),
        strokeWidth: graphData.strokeWidth || 3,
      };
      obj.graphs.push(graph);
      this.isDirty = true;
      this.commitState();
      return graph;
    },

    removeGraph(objId, graphId) {
      const obj = this.objectById(objId);
      if (!obj || !obj.graphs) return;
      const idx = obj.graphs.findIndex(g => g.id === graphId);
      if (idx !== -1) {
        obj.graphs.splice(idx, 1);
        this.isDirty = true;
        this.commitState();
      }
    },

    updateGraph(objId, graphId, updates) {
      const obj = this.objectById(objId);
      if (!obj || !obj.graphs) return;
      const graph = obj.graphs.find(g => g.id === graphId);
      if (!graph) return;
      for (const key of Object.keys(updates)) graph[key] = updates[key];
      this.isDirty = true;
      this.commitState();
    },

    addClip(trackIndex, clipData) {
      while (this.project.tracks.length <= trackIndex) {
        this.project.tracks.push({
          id: `track_${this.project.tracks.length + 1}`,
          name: `Track ${this.project.tracks.length + 1}`,
          clips: []
        });
      }
      while (this.project.tracks.length < 5) {
        this.project.tracks.push({
          id: `track_${this.project.tracks.length + 1}`,
          name: `Track ${this.project.tracks.length + 1}`,
          clips: []
        });
      }
      const clip = {
        id: uid('clip'), type: 'transform', startTime: 0, duration: 1.5,
        easing: 'ease_in_out', sourceId: null, targetId: null, params: {},
        overshoot: 0, settle: 1.0, morphQuality: 'medium',
        parallel: false, lag_ratio: 0,
        ...clipData
      };
      this.project.tracks[trackIndex].clips.push(clip);
      this.isDirty = true;
      this.commitState();
      return clip;
    },

    updateClip(clipId, updates) {
      for (const track of this.project.tracks) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          for (const key of Object.keys(updates)) clip[key] = updates[key];
          this.isDirty = true;
          return;
        }
      }
    },

    deleteClip(clipId) {
      for (const track of this.project.tracks) {
        const idx = track.clips.findIndex(c => c.id === clipId);
        if (idx !== -1) {
          track.clips.splice(idx, 1);
          if (this.selectedClipId === clipId) this.selectedClipId = null;
          this.isDirty = true;
          this.commitState();
          return;
        }
      }
    },

    setClipAudio(clipId, audioData) {
      for (const track of this.project.tracks) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          clip.audio = { ...audioData };
          if (audioData.syncMode === 'auto' && audioData.status === 'ready' && audioData.duration != null) {
            clip.duration = audioData.duration;
          }
          this.isDirty = true;
          this.commitState();
          return;
        }
      }
    },

    removeClipAudio(clipId) {
      for (const track of this.project.tracks) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip && clip.audio) {
          delete clip.audio;
          this.isDirty = true;
          this.commitState();
          return;
        }
      }
    },

    createTransform() {
      if (this.selectedObjectIds.length !== 2) {
        this.setError('Select exactly 2 objects to create a transform');
        return null;
      }
      const [sourceId, targetId] = this.selectedObjectIds;
      const src = this.objectById(sourceId);
      const tgt = this.objectById(targetId);
      if (!src || !tgt) return null;

      const startTime = (src.enterTime || 0) + (src.duration || 3) - 0.5;

      let trackIndex = 0;
      for (let i = 0; i < this.project.tracks.length; i++) {
        if (this.project.tracks[i].clips.length === 0) { trackIndex = i; break; }
        trackIndex = i + 1;
      }
      trackIndex = Math.min(trackIndex, 4);

      const clip = this.addClip(trackIndex, {
        type: 'transform', startTime: Math.max(0, startTime), duration: 1.5,
        easing: 'ease_in_out_cubic', sourceId, targetId, morphQuality: 'medium'
      });
      this.selectedClipId = clip.id;
      this.selectedObjectIds = [];
      return clip;
    },

    setClipMatchTerms(clipId, on) {
      const clip = this.clipById(clipId);
      if (!clip) return;
      if (on) clip.matchTerms = true;
      else delete clip.matchTerms;
      this.commitState();
    },

    createAnimation(type, params = {}) {
      if (this.selectedObjectIds.length !== 1) {
        this.setError('Select 1 object to animate');
        return null;
      }
      const sourceId = this.selectedObjectIds[0];
      const src = this.objectById(sourceId);
      const startTime = src ? (src.enterTime || 0) : 0;

      let trackIndex = 0;
      for (let i = 0; i < this.project.tracks.length; i++) {
        if (this.project.tracks[i].clips.length === 0) { trackIndex = i; break; }
        trackIndex = i + 1;
      }
      trackIndex = Math.min(trackIndex, 4);

      const clip = this.addClip(trackIndex, {
        type, startTime, duration: 1.0, easing: 'ease_in_out', sourceId, params
      });
      this.selectedClipId = clip.id;
      return clip;
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Alignment (3x3 grid)
    // ══════════════════════════════════════════════════════════════════════════

    alignObject(objId, anchor) {
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj) return;
      const stage = this.project.stage;
      const pad = 50;

      const positions = {
        'TOP_LEFT':     { x: pad + obj.width / 2, y: pad + obj.height / 2 },
        'TOP':          { x: stage.width / 2, y: pad + obj.height / 2 },
        'TOP_RIGHT':    { x: stage.width - pad - obj.width / 2, y: pad + obj.height / 2 },
        'LEFT':         { x: pad + obj.width / 2, y: stage.height / 2 },
        'CENTER':       { x: stage.width / 2, y: stage.height / 2 },
        'RIGHT':        { x: stage.width - pad - obj.width / 2, y: stage.height / 2 },
        'BOTTOM_LEFT':  { x: pad + obj.width / 2, y: stage.height - pad - obj.height / 2 },
        'BOTTOM':       { x: stage.width / 2, y: stage.height - pad - obj.height / 2 },
        'BOTTOM_RIGHT': { x: stage.width - pad - obj.width / 2, y: stage.height - pad - obj.height / 2 }
      };

      const pos = positions[anchor];
      if (pos) {
        this.updateObject(objId, { x: Math.round(pos.x), y: Math.round(pos.y) });
      }
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Playback
    // ══════════════════════════════════════════════════════════════════════════

    setPlaybackTime(t) { this.playbackTime = t; },
    setPlaybackPlaying(p) { this.playbackPlaying = p; },
    setFrameState(s) { this.frameState = s; },

    // ══════════════════════════════════════════════════════════════════════════
    // Stage
    // ══════════════════════════════════════════════════════════════════════════

    updateStage(u) { for (const k of Object.keys(u)) this.project.stage[k] = u[k]; this.isDirty = true; },
    toggleGrid() { this.project.stage.gridVisible = !this.project.stage.gridVisible; },
    toggleSnap() { this.project.stage.snapEnabled = !this.project.stage.snapEnabled; },

    // ══════════════════════════════════════════════════════════════════════════
    // Local Project I/O  (file-based, existing behaviour)
    // ══════════════════════════════════════════════════════════════════════════

    exportJSON() { return JSON.stringify(JSON.parse(JSON.stringify(this.project)), null, 2); },

    importJSON(jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        if (!data.stage || !Array.isArray(data.objects)) throw new Error('Invalid project');
        if (!data.tracks) data.tracks = [{ id: 'track_1', name: 'Track 1', clips: [] }];
        if (!data.assets) data.assets = [];
        if (!data.groups) data.groups = [];
        if (!data.editorMode) data.editorMode = 'visual';
        if (data.codeSource === undefined) data.codeSource = '';
        if (!('cameraType' in data)) data.cameraType = 'static';
        if (!Array.isArray(data.cameraTrack)) data.cameraTrack = [];
        this.project = data;
        this.selectedObjectIds = [];
        this.selectedClipId = null;
        this.isDirty = false;
        this.error = null;
        this.history.past = [];
        this.history.future = [];
        this.commitState();
        return true;
      } catch (err) {
        this.error = `Could not open project: ${err.message}`;
        return false;
      }
    },

    saveToFile() {
      const json = this.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.project.name || 'project'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.isDirty = false;
    },

    loadFromFile() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) { resolve(false); return; }
          const reader = new FileReader();
          reader.onload = (ev) => resolve(this.importJSON(ev.target.result));
          reader.onerror = () => { this.error = 'Failed to read file'; resolve(false); };
          reader.readAsText(file);
        };
        input.click();
      });
    },

    newProject(name = 'My Animation', editorMode = 'visual') {
      this.project = createDefaultProject(editorMode);
      this.project.name = name;
      this.selectedObjectIds = [];
      this.selectedClipId = null;
      this.isDirty = false;
      this.error = null;
      this.playbackTime = 0;
      this.playbackPlaying = false;
      this.frameState = { objectOverrides: {}, morphShapes: [], hiddenIds: new Set() };
      this.renderJobId = null;
      this.renderStatus = null;
      this.renderError = null;
      this.renderVideoUrl = null;
      this.renderLog = '';
      this.history.past = [];
      this.history.future = [];
      this.clipboard = [];
      _objectAddCount = 0;
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Server Project I/O  (Docker / API)
    // ══════════════════════════════════════════════════════════════════════════

    /** Check if the API server is reachable */
    async checkApi() {
      try {
        const ok = await api.checkHealth();
        this.apiAvailable = ok;
        return ok;
      } catch {
        this.apiAvailable = false;
        return false;
      }
    },

    /**
     * Save the current project to the server (explicit action).
     * Creates the project on the server if it has no ID.
     * Uploads any assets that haven't been synced yet.
     */
    async saveToServer() {
      this.savingToServer = true;
      this.loading = true;
      try {
        // 1. Create on server if no project ID
        if (!this.project.id) {
          const created = await api.projects.create(this.project.name, this.project.editorMode);
          this.project.id = created.id;
        }

        const projectId = this.project.id;

        // 2. Upload any assets that need syncing
        for (const asset of this.project.assets) {
          if (asset.dataUrl && !asset.serverFilename) {
            try {
              const result = await api.assets.uploadBase64(projectId, {
                name: asset.filename || asset.name || 'asset',
                type: asset.type,
                data: asset.dataUrl
              });
              asset.serverFilename = result.filename;
            } catch (err) {
              console.warn('[saveToServer] Asset upload failed:', asset.name, err);
            }
          }
        }

        // 3. Prepare server-safe project JSON
        const serverProject = JSON.parse(JSON.stringify(this.project));

        // Map serverFilename → filename, remove dataUrl
        for (const a of serverProject.assets) {
          if (a.serverFilename) a.filename = a.serverFilename;
          delete a.dataUrl;
          delete a.serverFilename;
        }

        // 4. Save to server
        await api.projects.update(projectId, serverProject);
        this.isDirty = false;

        return projectId;
      } catch (err) {
        this.error = `Save to server failed: ${err.message}`;
        throw err;
      } finally {
        this.loading = false;
        this.savingToServer = false;
      }
    },

    /**
     * Load a project from the server by ID.
     */
    async loadFromServer(id) {
      this.loading = true;
      try {
        const project = await api.projects.get(id);

        // For each asset, create a displayable URL
        for (const asset of project.assets || []) {
          if (asset.filename && !asset.dataUrl) {
            asset.dataUrl = api.assets.getUrl(id, asset.filename);
            asset.serverFilename = asset.filename;
          }
        }

        // Ensure groups array exists
        if (!project.groups) project.groups = [];
        if (!project.editorMode) project.editorMode = 'visual';
        if (project.codeSource === undefined) project.codeSource = '';
        if (!('cameraType' in project)) project.cameraType = 'static';
        if (!Array.isArray(project.cameraTrack)) project.cameraTrack = [];

        this.project = project;
        this.selectedObjectIds = [];
        this.selectedClipId = null;
        this.isDirty = false;
        this.error = null;
        this.renderJobId = null;
        this.renderStatus = null;
        this.renderError = null;
        this.renderVideoUrl = null;
        return true;
      } catch (err) {
        this.error = `Load from server failed: ${err.message}`;
        return false;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Fetch list of projects on the server.
     */
    async listServerProjects() {
      try {
        const list = await api.projects.list();
        this.serverProjects = list || [];
        return list;
      } catch (err) {
        this.error = `Could not list projects: ${err.message}`;
        this.serverProjects = [];
        return [];
      }
    },

    /**
     * Delete a project from the server (project + assets + renders).
     */
    async deleteServerProject(id) {
      await api.projects.delete(id);
      this.serverProjects = this.serverProjects.filter(p => p.id !== id);
      if (this.project.id === id) {
        this.project.id = null;
      }
    },

    /**
     * Full server render pipeline:
     *  1. Save project + assets to server
     *  2. Trigger render
     *  3. Start polling for status
     */
    async renderOnServer(quality = 'high') {
      this.showRenderDialog = true;
      this.renderStatus = 'uploading';
      this.renderError = null;
      this.renderVideoUrl = null;
      this.renderLog = '';
      this.renderQuality = quality;

      try {
        // 1. Save to server
        this.renderStatus = 'saving';
        const projectId = await this.saveToServer();

        // 2. Trigger render (code mode sends raw source; visual mode uses compiled pipeline)
        this.renderStatus = 'queued';
        let result;
        if (this.project.editorMode === 'code') {
          result = await api.projects.renderCode(projectId, {
            quality,
            codeSource: this.project.codeSource,
            sceneName: 'MainScene'
          });
        } else {
          result = await api.projects.render(projectId, quality);
        }
        this.renderJobId = result.jobId;

        // 3. Start polling
        this._startPollRender(result.jobId, projectId);

      } catch (err) {
        this.renderStatus = 'failed';
        this.renderError = err.message;
      }
    },

    /** @private Start WebSocket subscription for a render job */
    _startPollRender(jobId, projectId) {
      this._stopPollRender();

      _pollDisconnect = connectJobWebSocket(jobId, (msg) => {
        if (msg.status === 'running') {
          this.renderStatus = 'running';
          if (msg.stdout) this.renderLog = msg.stdout;
        } else if (msg.status === 'completed') {
          this.renderStatus = 'completed';
          this.renderVideoUrl = api.renders.getLatestUrl(projectId);
          this.renderLog = msg.stdout || '';
          this._stopPollRender();
        } else if (msg.status === 'failed') {
          this.renderStatus = 'failed';
          this.renderError = msg.error || msg.stderr || 'Render failed';
          this.renderLog = (msg.stdout || '') + '\n' + (msg.stderr || '');
          this._stopPollRender();
        }
      });
    },

    /** @private Stop WebSocket subscription */
    _stopPollRender() {
      if (_pollDisconnect) {
        _pollDisconnect();
        _pollDisconnect = null;
      }
    },

    // ══════════════════════════════════════════════════════════════════════════
    // History (Undo / Redo)
    // ══════════════════════════════════════════════════════════════════════════

    _snapshotState() {
      return JSON.stringify({
        objects: this.project.objects,
        groups: this.project.groups,
        tracks: this.project.tracks,
        cameraTrack: this.project.cameraTrack
      });
    },

    commitState() {
      const snapshot = this._snapshotState();
      this.history.past.push(snapshot);
      if (this.history.past.length > MAX_HISTORY) this.history.past.shift();
      this.history.future = [];
    },

    _debouncedCommit: (() => {
      let timer = null;
      return function() {
        clearTimeout(timer);
        timer = setTimeout(() => this.commitState(), 400);
      };
    })(),

    undo() {
      if (this.history.past.length <= 1) return;
      const current = this.history.past.pop();
      this.history.future.push(current);
      const prev = this.history.past[this.history.past.length - 1];
      const data = JSON.parse(prev);
      this.project.objects = data.objects;
      this.project.groups = data.groups || [];
      this.project.tracks = data.tracks;
      this.project.cameraTrack = data.cameraTrack || [];
      this.selectedObjectIds = [];
      this.selectedClipId = null;
      this.isDirty = true;
    },

    redo() {
      if (this.history.future.length === 0) return;
      const next = this.history.future.pop();
      this.history.past.push(next);
      const data = JSON.parse(next);
      this.project.objects = data.objects;
      this.project.groups = data.groups || [];
      this.project.tracks = data.tracks;
      this.project.cameraTrack = data.cameraTrack || [];
      this.selectedObjectIds = [];
      this.selectedClipId = null;
      this.isDirty = true;
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Clipboard (Copy / Paste)
    // ══════════════════════════════════════════════════════════════════════════

    copySelection() {
      const selected = this.selectedObjectIds
        .map(id => this.project.objects.find(o => o.id === id))
        .filter(Boolean);
      if (selected.length === 0) return;
      this.clipboard = JSON.parse(JSON.stringify(selected));
    },

    pasteSelection() {
      if (this.clipboard.length === 0) return;
      const newIds = [];
      for (const original of this.clipboard) {
        const clone = JSON.parse(JSON.stringify(original));
        clone.id = uid('obj');
        clone.x = (clone.x || 0) + 20;
        clone.y = (clone.y || 0) + 20;
        clone.name = clone.name + ' copy';
        clone.zOrder = this.project.objects.length;
        this.project.objects.push(clone);
        newIds.push(clone.id);
      }
      this.selectedObjectIds = newIds;
      this.selectedClipId = null;
      this.isDirty = true;
      this.commitState();
    },

    // ══════════════════════════════════════════════════════════════════════════
    // UI helpers
    // ══════════════════════════════════════════════════════════════════════════

    clearError() { this.error = null; },
    setError(msg) {
      this.error = msg;
      setTimeout(() => { if (this.error === msg) this.error = null; }, 4000);
    },

    setTheme(id) {
      this.theme = id;
      document.documentElement.setAttribute('data-theme', id);
      try { localStorage.setItem('manim-motion-theme', id); } catch {}
    },

    addPathMoveClip(sourceId, pathPoints) {
      if (!sourceId || !pathPoints || pathPoints.length < 2) return null;
      // Find first empty track
      let trackIndex = 0;
      for (let i = 0; i < this.project.tracks.length; i++) {
        if (this.project.tracks[i].clips.length === 0) { trackIndex = i; break; }
        trackIndex = i + 1;
      }
      trackIndex = Math.min(trackIndex, 4);
      const clip = this.addClip(trackIndex, {
        type: 'path_move',
        sourceId,
        startTime: this.playbackTime || 0,
        duration: 2.0,
        easing: 'ease_in_out',
        path: pathPoints,   // [{x,y},...] (2D) or [{x3d,y3d,z3d},...] (3D)
        params: {},
      });
      return clip;
    },

    createCount(from = 0, to = 100) {
      if (this.selectedObjectIds.length !== 1) { this.setError('Select 1 counter to animate'); return null; }
      const objectId = this.selectedObjectIds[0];
      const src = this.objectById(objectId);
      const startTime = src ? (src.enterTime || 0) : 0;
      let trackIndex = 0;
      for (let i = 0; i < this.project.tracks.length; i++) {
        if (this.project.tracks[i].clips.length === 0) { trackIndex = i; break; }
        trackIndex = i + 1;
      }
      trackIndex = Math.min(trackIndex, 4);
      const clip = this.addClip(trackIndex, { type: 'count', objectId, from, to, startTime, duration: 2, easing: 'ease_in_out_cubic' });
      this.selectedClipId = clip.id;
      return clip;
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Camera
    // ══════════════════════════════════════════════════════════════════════════

    setCameraType(type) {
      this.project.cameraType = type;
      if (!this.project.cameraTrack) this.project.cameraTrack = [];
      this.isDirty = true;
      this.commitState();
    },

    setSceneType(type) {
      this.project.sceneType = type;
      this.isDirty = true;
      this.commitState();
    },

    setCamera3d(params) {
      Object.assign(this.project.camera3d, params);
      this.isDirty = true;
      this.commitState();
    },

    addCameraMoveClip(params = {}) {
      if (!this.project.cameraTrack) this.project.cameraTrack = [];
      const clip = {
        id: uid('cam'),
        type: 'camera_move',
        startTime: params.startTime ?? (this.playbackTime || 0),
        duration: params.duration || 2.0,
        easing: params.easing || 'ease_in_out',
        params: {
          targetX: params.targetX || 0,
          targetY: params.targetY || 0,
          zoom: params.zoom || 1.0,
        },
      };
      this.project.cameraTrack.push(clip);
      this.isDirty = true;
      this.commitState();
      return clip;
    },

    updateCameraClip(clipId, updates) {
      const clip = this.project.cameraTrack?.find(c => c.id === clipId);
      if (!clip) return;
      if (updates.params) {
        for (const k of Object.keys(updates.params)) clip.params[k] = updates.params[k];
      }
      const topLevel = Object.keys(updates).filter(k => k !== 'params');
      for (const k of topLevel) clip[k] = updates[k];
      this.isDirty = true;
      this.commitState();
    },

    deleteCameraClip(clipId) {
      if (!this.project.cameraTrack) return;
      const idx = this.project.cameraTrack.findIndex(c => c.id === clipId);
      if (idx !== -1) {
        this.project.cameraTrack.splice(idx, 1);
        this.isDirty = true;
        this.commitState();
      }
    },

    // ══════════════════════════════════════════════════════════════════════════
    // Keyframes
    // ══════════════════════════════════════════════════════════════════════════

    addKeyframe(objId, prop, time, value) {
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj) return;
      if (!obj.keyframes) obj.keyframes = {};
      if (!obj.keyframes[prop]) obj.keyframes[prop] = [];
      const existing = obj.keyframes[prop].findIndex(k => Math.abs(k.time - time) < 0.01);
      if (existing >= 0) {
        obj.keyframes[prop][existing].value = value;
      } else {
        obj.keyframes[prop].push({ time, value, easing: { type: 'linear' } });
        obj.keyframes[prop].sort((a, b) => a.time - b.time);
      }
      this.isDirty = true;
      this.commitState();
    },

    // Add a keyframe at `time` for `prop`. When this is the property's FIRST
    // keyframe, also seed keyframes at the object's start and end (same current
    // value) so a lone keyframe isn't a no-op in opt-in mode and the user gets a
    // baseline to animate from. `time` is clamped to the visible interval and
    // every insert is upserted within 0.01s tolerance. One commit for the lot.
    addKeyframeScaffold(objId, prop, time) {
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj) return;
      const val = obj[prop] ?? 0;
      const start = obj.enterTime || 0;
      const end = start + (obj.duration ?? 3);
      const t = Math.round(Math.max(start, Math.min(end, time)) * 100) / 100;
      const isFirst = !obj.keyframes?.[prop]?.length;
      if (!obj.keyframes) obj.keyframes = {};
      if (!obj.keyframes[prop]) obj.keyframes[prop] = [];
      const arr = obj.keyframes[prop];
      // `pinned: 'start'|'end'` marks the boundary keyframes — they are locked to
      // the object's edges (not draggable) and follow them on move/resize.
      const upsert = (tt, pinned) => {
        const i = arr.findIndex(k => Math.abs(k.time - tt) < 0.01);
        if (i >= 0) { arr[i].value = val; if (pinned) arr[i].pinned = pinned; }
        else arr.push({ time: tt, value: val, easing: { type: 'linear' }, ...(pinned ? { pinned } : {}) });
      };
      if (isFirst) { upsert(start, 'start'); upsert(end, 'end'); }
      upsert(t);
      arr.sort((a, b) => a.time - b.time);
      this.isDirty = true;
      this.commitState();
    },

    removeKeyframe(objId, prop, time) {
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj?.keyframes?.[prop]) return;
      obj.keyframes[prop] = obj.keyframes[prop].filter(k => Math.abs(k.time - time) >= 0.01);
      if (obj.keyframes[prop].length === 0) delete obj.keyframes[prop];
      if (obj.keyframes && Object.keys(obj.keyframes).length === 0) delete obj.keyframes;
      this.isDirty = true;
      this.commitState();
    },

    // Delete that respects pinned boundary keyframes:
    // - a non-pinned keyframe is removed normally;
    // - deleting a pinned boundary is blocked while other (non-pinned) keyframes
    //   remain — the boundaries only make sense as a pair around real keys;
    // - if ONLY the two pinned boundaries are left, deleting either clears the
    //   whole property (both boundaries go together).
    deleteKeyframe(objId, prop, time) {
      const obj = this.project.objects.find(o => o.id === objId);
      const arr = obj?.keyframes?.[prop];
      if (!arr) return;
      const kf = arr.find(k => Math.abs(k.time - time) < 0.01);
      if (!kf) return;
      if (!kf.pinned) { this.removeKeyframe(objId, prop, time); return; }
      if (arr.some(k => !k.pinned)) return; // middle keyframes still present → block
      // only the boundaries remain → drop the property entirely
      delete obj.keyframes[prop];
      if (obj.keyframes && Object.keys(obj.keyframes).length === 0) delete obj.keyframes;
      const sel = this.selectedKeyframeId;
      if (sel && sel.objId === objId && sel.prop === prop) this.selectedKeyframeId = null;
      this.isDirty = true;
      this.commitState();
    },

    // Shift every keyframe of an object in time by `delta` (clamped at 0) so the
    // keyframes travel with the object bar when it is dragged left/right.
    shiftKeyframes(objId, delta) {
      if (!delta) return;
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj?.keyframes) return;
      for (const prop of Object.keys(obj.keyframes)) {
        for (const kf of obj.keyframes[prop]) {
          kf.time = Math.max(0, Math.round((kf.time + delta) * 100) / 100);
        }
        obj.keyframes[prop].sort((a, b) => a.time - b.time);
      }
      this.isDirty = true;
      this._debouncedCommit();
    },

    // Reconcile keyframes with the object's visible interval [enterTime,
    // enterTime+duration] (called after the object bar is resized/moved).
    // Pinned boundary keyframes snap exactly to the edges — outward as well as
    // inward, so expanding the bar drags them back out to the new edge. Regular
    // keyframes are clamped inside the interval.
    clampKeyframesToRange(objId) {
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj?.keyframes) return;
      const start = obj.enterTime || 0;
      const end = start + (obj.duration ?? 3);
      let changed = false;
      for (const prop of Object.keys(obj.keyframes)) {
        const seen = [];
        const next = [...obj.keyframes[prop]]
          .map(kf => {
            const target = kf.pinned === 'start' ? start
              : kf.pinned === 'end' ? end
              : Math.max(start, Math.min(end, kf.time));
            const t = Math.round(target * 100) / 100;
            if (t !== kf.time) changed = true;
            return { ...kf, time: t };
          })
          // At equal time, keep the pinned keyframe and drop the colliding regular one.
          .sort((a, b) => (a.time - b.time) || ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)))
          .filter(kf => {
            if (seen.some(t => Math.abs(t - kf.time) < 0.01)) { changed = true; return false; }
            seen.push(kf.time); return true;
          });
        obj.keyframes[prop] = next;
      }
      if (changed) { this.isDirty = true; this.commitState(); }
    },

    // Proportionally remap a property's keyframes when the object's interval
    // changes from [oldStart,oldEnd] to [newStart,newEnd] (object bar resized).
    // Non-pinned keyframes keep their RELATIVE position within the interval, so
    // they slide/scale with the edge being dragged; pinned boundaries snap to
    // the new edges. `origKeyframes` is a snapshot taken before the resize began
    // so repeated calls during a drag remap from the original (no compounding).
    rescaleKeyframes(objId, origKeyframes, oldStart, oldEnd, newStart, newEnd) {
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj || !origKeyframes) return;
      const oldSpan = (oldEnd - oldStart) || 1;
      const map = (t) => newStart + ((t - oldStart) / oldSpan) * (newEnd - newStart);
      if (!obj.keyframes) obj.keyframes = {};
      for (const prop of Object.keys(origKeyframes)) {
        obj.keyframes[prop] = origKeyframes[prop]
          .map(kf => {
            const target = kf.pinned === 'start' ? newStart
              : kf.pinned === 'end' ? newEnd
              : map(kf.time);
            return { ...kf, time: Math.round(Math.max(newStart, Math.min(newEnd, target)) * 100) / 100 };
          })
          .sort((a, b) => a.time - b.time);
      }
      this.isDirty = true;
      this._debouncedCommit();
    },

    updateKeyframeValue(objId, prop, time, value) {
      const obj = this.project.objects.find(o => o.id === objId);
      const kf = obj?.keyframes?.[prop]?.find(k => Math.abs(k.time - time) < 0.01);
      if (!kf) return;
      kf.value = value;
      this.isDirty = true;
      this.commitState();
    },

    updateKeyframeEasing(objId, prop, time, easing) {
      const obj = this.project.objects.find(o => o.id === objId);
      const kf = obj?.keyframes?.[prop]?.find(k => Math.abs(k.time - time) < 0.01);
      if (!kf) return;
      kf.easing = easing;
      this.isDirty = true;
      this.commitState();
    },

    setKeyframeMode(objId, prop, mode) {
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj) return;
      if (!obj.keyframeMode) obj.keyframeMode = {};
      obj.keyframeMode[prop] = mode;
      this.isDirty = true;
      this.commitState();
    },

    setKeyframeCodegen(objId, prop, codegenMode) {
      const obj = this.project.objects.find(o => o.id === objId);
      if (!obj) return;
      if (!obj.keyframeCodegen) obj.keyframeCodegen = {};
      obj.keyframeCodegen[prop] = codegenMode;
      this.isDirty = true;
      this.commitState();
    },

    selectKeyframe(objId, prop, time) {
      this.selectedKeyframeId = (objId && prop != null && time != null)
        ? { objId, prop, time }
        : null;
    },
  }
});

export { useProjectStore };

