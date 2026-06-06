import { ref, computed, nextTick } from 'vue';
import { canvasToVertex } from '../../../engine/polygonVertices.js';

export function useStageInteractions(store, deps) {
  const {
    konvaStage, objectsLayer, transformer,
    vs, ox, oy, s2c, c2s, unprojectView, themeAccent,
    startPan, is3D,
    pathDrawing, pathPoints, pathSourceId,
  } = deps;

  // ── non-reactive instance var for dblclick guard (path draw) ──
  let _pathLastClick = 0;

  // ── State ──
  const shiftKey = ref(false);
  const liveTransform = ref(null);

  // ── Computeds ──
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

  // ── Computed: selectedObjectIds (used internally via store) ──
  const selectedObjectIds = computed(() => store.selectedObjectIds);

  // ── Functions ──
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

  function _isGroupType(type) {
    return type === 'axes' || type === 'latex' || type === 'dot_grid' || type === 'numberplane' || type === 'complex_plane' || type === 'polar_plane' || type === 'numberline';
  }

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

  return {
    shiftKey,
    liveTransform,
    polygonHandles,
    groupBounds,
    trConfig,
    onVertexDrag,
    onVertexDragEnd,
    handleStageMouseDown,
    onObjDown,
    onDragEnd,
    onDrag3DEnd,
    onTransform,
    onTransformEnd,
    onTextDblClick,
    updateTransformer,
  };
}
