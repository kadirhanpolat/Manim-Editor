import { ref, computed, nextTick } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { canvasToVertex } from '../../../engine/polygonVertices.js';
import { normalizeRect, marqueeSelectIds } from '../../../engine/marquee.js';
import type { PathPoint } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';
import { snapPoint, stageSnapCandidates } from '../../../engine/snap.js';
import type { SnapCandidate } from '../../../engine/snap.js';

type ProjectStore = ReturnType<typeof useProjectStore>;

// Loose Konva component ref (vue-konva wraps each Konva node in a component
// that exposes `getNode()`). We only need the node accessor for each ref.
interface KonvaCompRef {
  getNode: () => KonvaNodeLike;
}

// Minimal Konva node shape used by this composable.
interface KonvaNodeLike {
  className?: string;
  name?: () => string;
  id?: () => string;
  x?: () => number;
  y?: () => number;
  width?: () => number;
  height?: () => number;
  radius?: () => number;
  radiusX?: () => number;
  radiusY?: () => number;
  scaleX?: (v?: number) => number;
  scaleY?: (v?: number) => number;
  rotation?: () => number;
  position?: (v: { x: number; y: number }) => void;
  nodes?: (nodes: KonvaNodeLike[]) => void;
  getLayer?: () => { batchDraw: () => void };
  getParent?: () => KonvaNodeLike | null;
  getStage?: () => KonvaStagelike;
  findOne?: (selector: string) => KonvaNodeLike | null;
  getIntersection?: (pos: { x: number; y: number }) => KonvaNodeLike | null;
}

interface KonvaStagelike extends KonvaNodeLike {
  getPointerPosition?: () => { x: number; y: number } | null;
}

// Shape of Konva event objects as received from vue-konva's event handlers.
interface KonvaEvt<E = Event> {
  target: KonvaNodeLike;
  evt: E;
  cancelBubble?: boolean;
}

interface Deps {
  konvaStage: Ref<KonvaCompRef | null>;
  objectsLayer: Ref<KonvaCompRef | null>;
  transformer: Ref<KonvaCompRef | null>;
  vs: ComputedRef<number>;
  ox: ComputedRef<number>;
  oy: ComputedRef<number>;
  s2c: (px: number, py: number) => { x: number; y: number };
  c2s: (cx: number, cy: number) => { x: number; y: number };
  unprojectView: (px: number, py: number, obj?: Record<string, unknown>) => Record<string, number>;
  themeAccent: ComputedRef<string>;
  startPan: (e: { evt: MouseEvent }) => void;
  is3D: ComputedRef<boolean>;
  pathDrawing: Ref<boolean>;
  pathPoints: Ref<PathPoint[]>;
  pathSourceId: Ref<string | null>;
  guides: ComputedRef<Array<{ id: string; axis: 'h' | 'v'; pos: number }>>;
  stageObjects: ComputedRef<
    Array<{ id: string; x?: number; y?: number; width?: number; height?: number; hidden?: boolean }>
  >;
}

export function useStageInteractions(store: ProjectStore, deps: Deps) {
  const {
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
    guides,
    stageObjects,
  } = deps;

  // ── non-reactive instance var for dblclick guard (path draw) ──
  let _pathLastClick = 0;

  // ── State ──
  const shiftKey = ref(false);

  function buildSnapCandidates(excludeIds: string[]): SnapCandidate[] {
    const stage = store.project.stage;
    const candidates: SnapCandidate[] = stageSnapCandidates(stage, vs.value, ox.value, oy.value);
    for (const g of guides.value) {
      if (g.axis === 'h') candidates.push({ y: g.pos * vs.value + oy.value });
      else candidates.push({ x: g.pos * vs.value + ox.value });
    }
    for (const obj of stageObjects.value) {
      if (excludeIds.includes(obj.id) || obj.hidden) continue;
      const c = s2c(obj.x ?? 0, obj.y ?? 0);
      const hw = ((obj.width ?? 0) / 2) * vs.value;
      const hh = ((obj.height ?? 0) / 2) * vs.value;
      candidates.push(
        { x: c.x - hw },
        { x: c.x },
        { x: c.x + hw },
        { y: c.y - hh },
        { y: c.y },
        { y: c.y + hh }
      );
    }
    return candidates;
  }
  const liveTransform = ref<{
    id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
  } | null>(null);

  const editingTextId = ref<string | null>(null);
  const TEXT_EDITABLE_TYPES = ['text', 'latex', 'code'] as const;

  function startTextEdit(objId: string) {
    if (is3D.value) return;
    const obj = store.objectById(objId);
    if (!obj || obj.locked) return;
    if (!TEXT_EDITABLE_TYPES.includes(obj.type as (typeof TEXT_EDITABLE_TYPES)[number])) return;
    editingTextId.value = objId;
  }

  function commitTextEdit(newText: string) {
    if (!editingTextId.value) return;
    const obj = store.objectById(editingTextId.value);
    const field = obj?.type === 'code' ? 'codeText' : 'text';
    store.updateObject(editingTextId.value, { [field]: newText });
    editingTextId.value = null;
  }

  function cancelTextEdit() {
    editingTextId.value = null;
  }

  // Marquee selection (2D select tool only). Canvas-pixel coords.
  const marquee = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // ── Computeds ──
  const trConfig = computed(() => {
    const accent = themeAccent.value;
    return {
      anchorSize: 8,
      anchorFill: accent,
      anchorStroke: '#fff',
      anchorStrokeWidth: 1.5,
      borderStroke: accent,
      borderStrokeWidth: 1.5,
      borderDash: [6, 4],
      rotateEnabled: true,
      keepRatio: shiftKey.value,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      boundBoxFunc: (o: unknown, n: { width: number; height: number }) =>
        n.width < 10 || n.height < 10 ? o : n,
    };
  });

  const polygonHandles = computed(() => {
    if (store.activeTool !== 'select' || store.selectedObjectIds.length !== 1) return null;
    const obj = store.objectById(store.selectedObjectIds[0]);
    if (!obj) return null;
    if (obj.locked) return null; // locked: no draggable vertex/relational handles
    const c = s2c(obj.x ?? 0, obj.y ?? 0);
    if ((obj.type === 'polygon_free' || obj.type === 'bezier') && Array.isArray(obj['vertices'])) {
      return {
        id: obj.id,
        kind: 'vertices',
        points: (obj['vertices'] as [number, number][]).map(([vx, vy], i) => ({
          key: i,
          cx: c.x + vx * vs.value,
          cy: c.y + vy * vs.value,
        })),
      };
    }
    if (obj.type === 'brace') {
      return {
        id: obj.id,
        kind: 'relational',
        points: (['p1', 'p2'] as const).map((k) => ({
          key: k,
          cx: c.x + (obj[k] as [number, number])[0] * vs.value,
          cy: c.y + (obj[k] as [number, number])[1] * vs.value,
        })),
      };
    }
    if (obj.type === 'angle') {
      return {
        id: obj.id,
        kind: 'relational',
        points: (['vertex', 'point1', 'point2'] as const).map((k) => ({
          key: k,
          cx: c.x + (obj[k] as [number, number])[0] * vs.value,
          cy: c.y + (obj[k] as [number, number])[1] * vs.value,
        })),
      };
    }
    if (obj.type === 'graph' && obj['positions'] && typeof obj['positions'] === 'object') {
      const positions = obj['positions'] as Record<string, [number, number]>;
      return {
        id: obj.id,
        kind: 'graph',
        points: Object.keys(positions).map((k) => ({
          key: k,
          cx: c.x + positions[k]![0] * vs.value,
          cy: c.y + positions[k]![1] * vs.value,
        })),
      };
    }
    return null;
  });

  const groupBounds = computed(() => {
    const groups = store.project.groups || [];
    const bounds = [];
    for (const group of groups) {
      if (!group.childIds || group.childIds.length === 0) continue;
      const anySelected = group.childIds.some((cid) => store.selectedObjectIds.includes(cid));
      if (!anySelected) continue;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const cid of group.childIds) {
        const obj = store.project.objects.find((o) => o.id === cid);
        if (!obj) continue;
        minX = Math.min(minX, (obj.x ?? 0) - (obj.width ?? 0) / 2);
        minY = Math.min(minY, (obj.y ?? 0) - (obj.height ?? 0) / 2);
        maxX = Math.max(maxX, (obj.x ?? 0) + (obj.width ?? 0) / 2);
        maxY = Math.max(maxY, (obj.y ?? 0) + (obj.height ?? 0) / 2);
      }
      if (minX === Infinity) continue;

      const margin = group.margin ?? 10;
      const p1 = s2c(minX - margin, minY - margin);
      const w = (maxX - minX + margin * 2) * vs.value;
      const h = (maxY - minY + margin * 2) * vs.value;

      bounds.push({
        id: group.id,
        x: p1.x,
        y: p1.y,
        width: w,
        height: h,
        fill: 'transparent',
        stroke: themeAccent.value,
        strokeWidth: 1.5,
        dash: [6, 4],
        opacity: 0.5,
        cornerRadius: 6,
        listening: false,
      });
    }
    return bounds;
  });

  // ── Functions ──
  function onVertexDrag(key: number | string, evt: KonvaEvt): void {
    const h = polygonHandles.value;
    if (!h) return;
    const obj = store.objectById(h.id) as Record<string, unknown> | null;
    if (!obj) return;
    const objX = obj['x'] as number;
    const objY = obj['y'] as number;
    const c = s2c(objX, objY);
    const node = evt.target;
    const nv = canvasToVertex(node.x!(), node.y!(), c.x, c.y, vs.value);
    if (h.kind === 'vertices') {
      const arr = (obj['vertices'] as [number, number][]).slice();
      arr[key as number] = nv;
      obj['vertices'] = arr;
    } else if (h.kind === 'graph') {
      const positions = obj['positions'] as Record<string, [number, number]>;
      positions[key as string] = [Math.round(nv[0]), Math.round(nv[1])];
    } else {
      obj[key as string] = nv;
    }
  }

  function onVertexDragEnd(): void {
    store.commitState();
  }

  function _isGroupType(type: string): boolean {
    return (
      type === 'axes' ||
      type === 'latex' ||
      type === 'dot_grid' ||
      type === 'numberplane' ||
      type === 'complex_plane' ||
      type === 'polar_plane' ||
      type === 'numberline'
    );
  }

  function handleStageMouseDown(e: KonvaEvt<MouseEvent>): void {
    if (pathDrawing.value) {
      const now = Date.now();
      if (now - _pathLastClick < 350) return; // absorb second mousedown of dblclick
      _pathLastClick = now;
      const stage = e.target.getStage?.();
      const pos = stage?.getPointerPosition?.();
      if (!pos) return;
      if (is3D.value) {
        // 3D: drop a point in the current view's plane; the depth axis is held at
        // the source object's current value.
        const srcObj =
          (store.objectById(pathSourceId.value ?? '') as Record<string, unknown> | null) ?? {};
        const patch = unprojectView(pos.x, pos.y, srcObj);
        pathPoints.value.push({
          x3d: (srcObj['x3d'] as number | undefined) ?? 0,
          y3d: (srcObj['y3d'] as number | undefined) ?? 0,
          z3d: (srcObj['z3d'] as number | undefined) ?? 0,
          ...patch,
        });
        return;
      }
      const sp = c2s(pos.x, pos.y);
      pathPoints.value.push({ x: Math.round(sp.x), y: Math.round(sp.y) });
      return;
    }
    const t = e.target;
    const s = konvaStage.value?.getNode() as KonvaStagelike | undefined;
    if (!s) return;
    const ev = e.evt;
    const addToSel = ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey);
    // Click on transformer (resize/rotate handles or border) — handle shift-click
    // to add object underneath.
    let node: KonvaNodeLike | null = t;
    while (node) {
      if (node.className === 'Transformer') {
        if (addToSel) {
          const layer = objectsLayer.value?.getNode?.() as KonvaNodeLike | undefined;
          const pos = s.getPointerPosition?.();
          if (layer && pos) {
            const hit = layer.getIntersection?.(pos);
            if (hit && hit.name?.() === 'stageObject' && hit.id?.()) {
              store.selectObject(hit.id!(), true);
              void nextTick(() => nextTick(() => updateTransformer()));
            }
          }
        }
        return;
      }
      node = node.getParent ? node.getParent() : null;
    }
    if (t === (s as KonvaNodeLike) || t.name?.() !== 'stageObject') {
      if (store.activeTool === 'hand') {
        startPan(e as unknown as { evt: MouseEvent });
      } else {
        store.deselectAll();
        // Marquee selection: 2D select tool only (the 3D split viewport keeps
        // its drag semantics; path-draw mode returns earlier in this handler).
        if (!is3D.value && store.activeTool === 'select') {
          const pos = s.getPointerPosition?.();
          if (pos) marquee.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
        }
      }
    }
  }

  function handleStageMouseMove(): void {
    if (!marquee.value) return;
    const s = konvaStage.value?.getNode() as KonvaStagelike | undefined;
    const pos = s?.getPointerPosition?.();
    if (!pos) return;
    marquee.value = { ...marquee.value, x2: pos.x, y2: pos.y };
  }

  function handleStageMouseUp(): void {
    const m = marquee.value;
    if (!m) return;
    marquee.value = null;
    const r = normalizeRect(m.x1, m.y1, m.x2, m.y2);
    if (r.width < 3 && r.height < 3) return; // plain click — deselect already ran
    // Canvas rect → project-coordinate rect, then pure hit-test.
    const p1 = c2s(r.x, r.y);
    const p2 = c2s(r.x + r.width, r.y + r.height);
    const stageRect = normalizeRect(p1.x, p1.y, p2.x, p2.y);
    const ids = marqueeSelectIds(stageRect, store.project.objects);
    store.selectedObjectIds = ids;
    store.selectedClipId = null;
    void nextTick(() => nextTick(() => updateTransformer()));
  }

  function onObjDown(id: string, e: KonvaEvt<MouseEvent>): void {
    // Locked objects are click-through: no selection, no cancelBubble — the
    // event falls through to handleStageMouseDown (deselect / marquee start).
    const lockedObj = store.objectById(id);
    if (lockedObj && lockedObj.locked) return;
    (e as unknown as { cancelBubble: boolean }).cancelBubble = true;
    const ev = e.evt;
    store.selectObject(id, ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey));
    void nextTick(() => nextTick(() => updateTransformer()));
  }

  function onDragEnd(id: string, e: KonvaEvt): void {
    const node = e.target;
    const obj = store.project.objects.find((o) => o.id === id);
    if (!obj) return;
    if (obj.locked) return; // belt-and-braces: never commit a locked move
    let newX: number, newY: number;
    // Types that use top-left positioning (text now uses center with offsetX/offsetY)
    const tlTypes = ['square', 'rectangle', 'image', 'svg_asset'];
    if (tlTypes.includes(obj.type)) {
      const sp = c2s(node.x!(), node.y!());
      newX = sp.x + (obj.width ?? 0) / 2;
      newY = sp.y + (obj.height ?? 0) / 2;
    } else {
      const sp = c2s(node.x!(), node.y!());
      newX = sp.x;
      newY = sp.y;
    }
    // Grid, guide, and object edge snapping (2D only)
    if (!is3D.value && store.project.stage.snapEnabled) {
      const canvasPos = s2c(newX, newY);
      const snapped = snapPoint(canvasPos.x, canvasPos.y, buildSnapCandidates([id]));
      if (snapped.snappedX || snapped.snappedY) {
        const sp2 = c2s(snapped.x, snapped.y);
        newX = sp2.x;
        newY = sp2.y;
      }
    }
    // Multi-selection group drag: fan the dragged delta out to the whole
    // selection in one commit. Companions move on mouseup (not live during the
    // drag) — accepted limitation; live ghosting would need per-node dragmove
    // wiring on ~35 template branches.
    const sel = store.selectedObjectIds;
    if (sel.length > 1 && sel.includes(id)) {
      const dx = Math.round(newX) - (obj.x ?? 0);
      const dy = Math.round(newY) - (obj.y ?? 0);
      store.translateObjects([...sel], dx, dy);
      return;
    }
    store.updateObject(id, { x: Math.round(newX), y: Math.round(newY) });
  }

  function onDrag3DEnd(objId: string, e: KonvaEvt): void {
    const node = e.target;
    const obj = store.project.objects.find((o) => o.id === objId);
    const patch = unprojectView(node.x!(), node.y!(), obj);
    if (patch) store.updateObject(objId, patch);
    store.commitState();
    node.position?.({ x: 0, y: 0 });
  }

  function onTransform(id: string, e: KonvaEvt): void {
    const node = e.target;
    const obj = store.project.objects.find((o) => o.id === id);
    if (!obj) return;
    const sx = node.scaleX ? node.scaleX() : 1;
    const sy = node.scaleY ? node.scaleY() : 1;
    let w: number, h: number;
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
    liveTransform.value = { id, type: obj.type, x: node.x!(), y: node.y!(), w, h, rotation };
  }

  function onTransformEnd(id: string, e: KonvaEvt): void {
    const node = e.target;
    const obj = store.project.objects.find((o) => o.id === id);
    if (!obj) return;

    const sx = node.scaleX ? node.scaleX() : 1;
    const sy = node.scaleY ? node.scaleY() : 1;
    const tlTypes = ['square', 'rectangle', 'image', 'svg_asset'];
    let cw: number, ch: number, cx: number, cy: number;

    if (obj.type === 'circle') {
      const r = node.radius ? node.radius() : node.width ? node.width() / 2 : 20;
      cw = r * 2;
      ch = r * 2;
      cx = node.x!();
      cy = node.y!();
    } else if (obj.type === 'ellipse') {
      cw = node.radiusX ? node.radiusX() * 2 : node.width ? node.width() : 40;
      ch = node.radiusY ? node.radiusY() * 2 : node.height ? node.height() : 40;
      cx = node.x!();
      cy = node.y!();
    } else if (_isGroupType(obj.type)) {
      cw = (obj.width || 200) * vs.value * sx;
      ch = (obj.height || 200) * vs.value * sy;
      cx = node.x!();
      cy = node.y!();
    } else {
      cw = Math.max(10, Math.abs((node.width ? node.width() : 1) * sx));
      ch = Math.max(10, Math.abs((node.height ? node.height() : 1) * sy));
      if (tlTypes.includes(obj.type)) {
        cx = node.x!() + cw / 2;
        cy = node.y!() + ch / 2;
      } else {
        cx = node.x!();
        cy = node.y!();
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

    node.scaleX!(1);
    node.scaleY!(1);

    store.updateObject(id, { x: newX, y: newY, width: newW, height: newH, rotation });
    liveTransform.value = null;
  }

  function onTextDblClick(_id: string): void {
    // Could implement inline editing; for now, focus the properties panel
  }

  function updateTransformer(): void {
    const tr = transformer.value;
    const ol = objectsLayer.value;
    const ks = konvaStage.value;
    if (!tr || !ks) return;
    const t = tr.getNode();
    const stage = ks.getNode() as KonvaStagelike;
    if (!t || !stage) return;
    const layer = ol && ol.getNode ? ol.getNode() : null;
    const findNode = (id: string): KonvaNodeLike | null =>
      (layer ? layer.findOne?.('#' + id) : null) ?? stage.findOne?.('#' + id) ?? null;
    // polygon_free is edited via draggable vertex handles, not the resize/rotate
    // transformer — exclude it so its anchors don't overlap the vertex handles.
    const ids = store.selectedObjectIds.filter((id) => {
      const o = store.objectById(id);
      return !o || (o.type !== 'polygon_free' && !o.locked);
    });
    const nodes = ids.map(findNode).filter((n): n is KonvaNodeLike => n !== null);
    t.nodes!(nodes);
    t.getLayer!().batchDraw();
  }

  return {
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
  };
}
