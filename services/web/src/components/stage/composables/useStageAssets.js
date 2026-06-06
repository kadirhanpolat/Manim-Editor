import { ref, reactive, nextTick } from 'vue';
import { loadFont, isFontLoaded } from '../../../utils/fontLoader.js';

export function useStageAssets(store, deps) {
  const { objects, c2s, container, objectsLayer } = deps;

  // ── State ──
  const imageElements = reactive({});
  const isDraggingOver = ref(false);
  const fontLoadKey = ref(0);

  // ── Image loading ──
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

  // ── Font loading ──
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

  return {
    imageElements, isDraggingOver, fontLoadKey,
    loadNewImages, loadNewFonts,
    onDragOver, onDragLeave, onDrop,
  };
}
