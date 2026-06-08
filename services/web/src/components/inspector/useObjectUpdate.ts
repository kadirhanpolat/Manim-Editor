import type { SceneObject } from '@manim/codegen';
import { useProjectStore } from '../../store/project.js';

// getObj: () => the active object (or null). Returns generic field-update helpers.
export function useObjectUpdate(getObj: () => SceneObject | null | undefined) {
  const store = useProjectStore();
  const u = (k: string, v: unknown): void => {
    const o = getObj();
    if (o) store.updateObject(o.id, { [k]: v });
  };
  const uSize = (v: number): void => {
    const o = getObj();
    if (o) store.updateObject(o.id, { width: v, height: v });
  };
  const uRange = (prop: string, idx: number, val: number): void => {
    const o = getObj();
    if (!o) return;
    const existing = o[prop];
    const base: number[] = Array.isArray(existing)
      ? (existing as number[])
      : prop === 'xRange'
        ? [-5, 5, 1]
        : [-3, 3, 1];
    const arr = [...base];
    arr[idx] = val;
    store.updateObject(o.id, { [prop]: arr });
  };
  return { u, uSize, uRange };
}
