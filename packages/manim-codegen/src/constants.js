// NOTE: keep in sync with services/api/src/compiler/codegen.js EASING_MAP
export const EASING_MAP = {
  linear:            'linear',
  ease_in:           'rate_functions.ease_in_sine',
  ease_out:          'rate_functions.ease_out_sine',
  ease_in_out:       'rate_functions.smooth',
  ease_in_cubic:     'rate_functions.ease_in_cubic',
  ease_out_cubic:    'rate_functions.ease_out_cubic',
  ease_in_out_cubic: 'rate_functions.ease_in_out_cubic',
  ease_in_quart:     'rate_functions.ease_in_quart',
  ease_out_quart:    'rate_functions.ease_out_quart',
  ease_in_out_quart: 'rate_functions.ease_in_out_quart',
  ease_in_back:      'rate_functions.ease_in_back',
  ease_out_back:     'rate_functions.ease_out_back',
  ease_in_out_back:  'rate_functions.ease_in_out_back',
  ease_out_elastic:  'rate_functions.ease_out_elastic',
  ease_in_elastic:   'rate_functions.ease_in_elastic',
  ease_out_bounce:   'rate_functions.ease_out_bounce',
  spring:            'rate_functions.ease_out_elastic',
};

// Manim frame dimensions (matches Manim CE default)
export const FRAME_WIDTH = 14 + 2 / 9;   // 14.22
export const FRAME_HEIGHT = 8;
export const FRAME_X_RADIUS = FRAME_WIDTH / 2;  // 7.11
export const FRAME_Y_RADIUS = FRAME_HEIGHT / 2; // 4

// ── Style effect helpers (KEEP BYTE-IDENTICAL with services/api/src/compiler/codegen.js) ──
export const GRADIENT_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free']);
export const DASH_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'line', 'arrow', 'annulus', 'arc', 'sector', 'double_arrow', 'polygon_free', 'parametric']);
export const SHADOW_TYPES = new Set(['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star', 'polygon', 'heart', 'annulus', 'sector', 'polygon_free', 'text', 'latex']);
