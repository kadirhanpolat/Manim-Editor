// type -> settings component. Each per-type task adds one import + one entry.
const REGISTRY = {};
export function settingsComponentFor(type) { return REGISTRY[type] || null; }
