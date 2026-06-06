import { useProjectStore } from '../../store/project.js';

// getObj: () => the active object (or null). Returns generic field-update helpers.
export function useObjectUpdate(getObj) {
  const store = useProjectStore();
  const u = (k, v) => { const o = getObj(); if (o) store.updateObject(o.id, { [k]: v }); };
  const uSize = (v) => { const o = getObj(); if (o) store.updateObject(o.id, { width: v, height: v }); };
  const uRange = (prop, idx, val) => {
    const o = getObj(); if (!o) return;
    const arr = [...(o[prop] || (prop === 'xRange' ? [-5, 5, 1] : [-3, 3, 1]))];
    arr[idx] = val;
    store.updateObject(o.id, { [prop]: arr });
  };
  return { u, uSize, uRange };
}
