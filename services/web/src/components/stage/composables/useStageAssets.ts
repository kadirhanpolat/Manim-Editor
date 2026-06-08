import { ref, reactive, nextTick } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { loadFont, isFontLoaded } from '../../../utils/fontLoader.js';
import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../../store/project.js';

type ProjectStore = ReturnType<typeof useProjectStore>;

interface KonvaLayerCompRef {
  getNode: () => { batchDraw: () => void } | null;
}

interface Deps {
  objects: ComputedRef<SceneObject[]>;
  c2s: (cx: number, cy: number) => { x: number; y: number };
  container: Ref<HTMLElement | null>;
  objectsLayer: Ref<KonvaLayerCompRef | null>;
}

export function useStageAssets(store: ProjectStore, deps: Deps) {
  const { objects, c2s, container, objectsLayer } = deps;

  // ── State ──
  const imageElements = reactive<Record<string, HTMLImageElement>>({});
  const isDraggingOver = ref(false);
  const fontLoadKey = ref(0);

  // ── Image loading ──
  function loadNewImages(): void {
    for (const obj of objects.value) {
      const assetId = obj['assetId'] as string | undefined;
      if (
        (obj.type === 'image' || obj.type === 'svg_asset') &&
        assetId &&
        !imageElements[assetId]
      ) {
        const asset = store.assetById(assetId);
        if (asset && asset.dataUrl) {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.src = asset.dataUrl;
          img.onload = () => {
            imageElements[assetId] = img;
          };
        }
      }
    }
  }

  // ── Font loading ──
  async function loadNewFonts(): Promise<void> {
    for (const obj of objects.value) {
      const fontFamily = obj['fontFamily'] as string | undefined;
      if (obj.type === 'text' && fontFamily && !isFontLoaded(fontFamily)) {
        try {
          await loadFont(fontFamily);
          fontLoadKey.value++;
          void nextTick(() => {
            const layer = objectsLayer.value?.getNode();
            if (layer) {
              layer.batchDraw();
            }
          });
        } catch (e) {
          console.warn('Failed to load font:', fontFamily, e);
        }
      }
    }
  }

  // ── Drag and Drop from sidebar ──
  function onDragOver(e: DragEvent): void {
    isDraggingOver.value = true;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave(): void {
    isDraggingOver.value = false;
  }

  function onDrop(e: DragEvent): void {
    isDraggingOver.value = false;
    const containerEl = container.value;
    if (!containerEl || !e.dataTransfer) return;
    const containerRect = containerEl.getBoundingClientRect();
    const dropX = e.clientX - containerRect.left;
    const dropY = e.clientY - containerRect.top;

    const stagePos = c2s(dropX, dropY);

    let sx = stagePos.x,
      sy = stagePos.y;
    if (store.project.stage.snapEnabled && store.project.stage.snapToGrid) {
      const gsX = store.project.stage.width / (store.project.stage.gridSize ?? 1);
      const gsY = store.project.stage.height / (store.project.stage.gridSize ?? 1);
      sx = Math.round(sx / gsX) * gsX;
      sy = Math.round(sy / gsY) * gsY;
    }
    if (store.project.stage.snapEnabled && store.project.stage.snapToCenter) {
      const cx = store.project.stage.width / 2;
      const cy = store.project.stage.height / 2;
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
    imageElements,
    isDraggingOver,
    fontLoadKey,
    loadNewImages,
    loadNewFonts,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}
