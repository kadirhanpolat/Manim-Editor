// type -> settings component. Each per-type task adds one import + one entry.
import DotGridSettings from './DotGridSettings.vue';
const REGISTRY = {
  dot_grid: DotGridSettings,
};
export function settingsComponentFor(type) { return REGISTRY[type] || null; }
