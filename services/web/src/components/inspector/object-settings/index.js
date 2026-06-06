// type -> settings component. Each per-type task adds one import + one entry.
import DotGridSettings from './DotGridSettings.vue';
import StarSettings from './StarSettings.vue';
import PolygonSettings from './PolygonSettings.vue';
const REGISTRY = {
  dot_grid: DotGridSettings,
  star: StarSettings,
  polygon: PolygonSettings,
};
export function settingsComponentFor(type) { return REGISTRY[type] || null; }
