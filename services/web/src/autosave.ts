// Autosave — debounced localStorage snapshot of the project + restore helpers.
//
// Mechanism: Pinia store.$subscribe with { flush: 'sync' } (deterministic in
// app and tests), gated on state.isDirty so clean states (fresh boot, just
// saved, playback-only mutations) never write. Clearing rides store.$onAction:
// New / Open / successful save all reset the key without editing the store
// file itself (coordination: another track owns other store regions).
//
// Known trade-off: the debounce timer resets on EVERY dirty-state mutation, so
// during continuous playback of an unsaved project the write fires ~2s after
// the next idle moment. Assets are URL references inside project JSON, so
// payloads stay small. Does not touch `manim-motion-theme`.
import type { useProjectStore } from './store/project.js';

type ProjectStore = ReturnType<typeof useProjectStore>;

export const AUTOSAVE_KEY = 'manim-motion-autosave';
const DEBOUNCE_MS = 2000;

/** Store actions after which the autosave is stale and must be cleared. */
const CLEAR_ACTIONS = new Set([
  'newProject', // File → New
  'importJSON', // File → Open (loadFromFile delegates here)
  'loadFromServer', // server Open
  'saveToFile', // successful local save
  'saveToServer', // successful server save (after() only runs on resolve)
]);

export interface AutosavePayload {
  project: unknown;
  savedAt: number;
}

export function readAutosave(): AutosavePayload | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutosavePayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.project) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/** Install the autosave subscriber + clear hooks. Returns a dispose fn. */
export function initAutosave(store: ProjectStore, debounceMs = DEBOUNCE_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = store.$subscribe(
    (_mutation, state) => {
      if (!state.isDirty) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try {
          const payload: AutosavePayload = {
            project: JSON.parse(JSON.stringify(state.project)),
            savedAt: Date.now(),
          };
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
        } catch {
          /* quota / serialization failure — autosave is best-effort */
        }
      }, debounceMs);
    },
    { flush: 'sync', detached: true }
  );

  const unsubscribeAction = store.$onAction(({ name, after }) => {
    if (!CLEAR_ACTIONS.has(name)) return;
    after(() => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      clearAutosave();
    });
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
    unsubscribeAction();
  };
}
