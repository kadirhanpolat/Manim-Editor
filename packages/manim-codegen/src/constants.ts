// NOTE: keep in sync with services/api/src/compiler/codegen.js EASING_MAP
export const EASING_MAP: Record<string, string> = {
  linear: 'linear',
  ease_in: 'rate_functions.ease_in_sine',
  ease_out: 'rate_functions.ease_out_sine',
  ease_in_out: 'rate_functions.smooth',
  ease_in_cubic: 'rate_functions.ease_in_cubic',
  ease_out_cubic: 'rate_functions.ease_out_cubic',
  ease_in_out_cubic: 'rate_functions.ease_in_out_cubic',
  ease_in_quart: 'rate_functions.ease_in_quart',
  ease_out_quart: 'rate_functions.ease_out_quart',
  ease_in_out_quart: 'rate_functions.ease_in_out_quart',
  ease_in_back: 'rate_functions.ease_in_back',
  ease_out_back: 'rate_functions.ease_out_back',
  ease_in_out_back: 'rate_functions.ease_in_out_back',
  ease_out_elastic: 'rate_functions.ease_out_elastic',
  ease_in_elastic: 'rate_functions.ease_in_elastic',
  ease_in_out_elastic: 'rate_functions.ease_in_out_elastic',
  ease_out_bounce: 'rate_functions.ease_out_bounce',
  ease_in_bounce: 'rate_functions.ease_in_bounce',
  ease_in_out_bounce: 'rate_functions.ease_in_out_bounce',
  spring: 'rate_functions.ease_out_elastic',
};

// Manim frame dimensions (matches Manim CE default)
export const FRAME_WIDTH = 14 + 2 / 9; // 14.22
export const FRAME_HEIGHT = 8;
export const FRAME_X_RADIUS = FRAME_WIDTH / 2; // 7.11
export const FRAME_Y_RADIUS = FRAME_HEIGHT / 2; // 4

// ── Style effect helpers (KEEP BYTE-IDENTICAL with services/api/src/compiler/codegen.js) ──
export const GRADIENT_TYPES: Set<string> = new Set([
  'rectangle',
  'square',
  'circle',
  'ellipse',
  'triangle',
  'star',
  'polygon',
  'heart',
  'annulus',
  'sector',
  'polygon_free',
]);
export const DASH_TYPES: Set<string> = new Set([
  'rectangle',
  'square',
  'circle',
  'ellipse',
  'triangle',
  'star',
  'polygon',
  'heart',
  'line',
  'arrow',
  'annulus',
  'arc',
  'sector',
  'double_arrow',
  'polygon_free',
  'parametric',
]);
export const SHADOW_TYPES: Set<string> = new Set([
  'rectangle',
  'square',
  'circle',
  'ellipse',
  'triangle',
  'star',
  'polygon',
  'heart',
  'annulus',
  'sector',
  'polygon_free',
  'text',
  'latex',
]);
// Bound to another object via `targetId`: emitted after it, positioned from it
// (no move_to / effects), skipped when it is hidden or missing.
export const ANNOTATION_TYPES: Set<string> = new Set([
  'surrounding_rect',
  'underline',
  'cross',
  'axis_point',
]);

// Riemann rectangles are translucent so the curve and the area stay visible;
// the canvas preview draws them with the same opacity.
export const RIEMANN_FILL_OPACITY = 0.45;

// Types built from points relative to the object's origin (x/y). The preview
// draws them around that origin, but Manim's move_to/set_x/MoveAlongPath/
// rotate/scale use the bounding-box center, so codegen mirrors the bounding
// box through the origin with two invisible VectorizedPoints (see objects.ts).
// `graph` is left out: Graph.add has graph-specific semantics.
export const ORIGIN_ANCHORED_TYPES: Set<string> = new Set([
  'polygon_free',
  'bezier',
  'brace',
  'angle',
  'vector_components',
  'ray',
  'coord_point',
]);

// Pygments language allowlist for the `code` object (inspector dropdown + codegen guard).
// Invalid/missing language falls back to 'python' in objectCode.
export const CODE_LANGUAGES: readonly string[] = [
  'python',
  'javascript',
  'typescript',
  'c',
  'cpp',
  'java',
  'html',
  'css',
  'bash',
];
