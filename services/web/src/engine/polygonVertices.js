/**
 * Pure vertex math for the polygon_free object.
 * Vertices are integer px relative to the object center: [[vx, vy], ...].
 */

/** Preset vertex arrays scaled to a w×h bounding box, centered at (0,0). */
export function presetVertices(type, w, h) {
  const hw = Math.round(w / 2), hh = Math.round(h / 2);
  if (type === 'parallelogram') {
    const s = Math.round(hw * 0.4);
    return [[-hw + s, -hh], [hw + s, -hh], [hw - s, hh], [-hw - s, hh]];
  }
  if (type === 'free') {
    return [[0, -hh], [hw, 0], [0, hh], [-hw, 0]];   // diamond starting shape
  }
  // trapezoid (default): narrower top
  const tw = Math.round(hw * 0.5);
  return [[-tw, -hh], [tw, -hh], [hw, hh], [-hw, hh]];
}

/** Bounding-box {width, height} of a vertex list. */
export function verticesBBox(vertices) {
  const xs = vertices.map(v => v[0]), ys = vertices.map(v => v[1]);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** Vertex (center-relative px) → canvas point, given center canvas coords and zoom. */
export function vertexToCanvas([vx, vy], centerX, centerY, zoom) {
  return { x: centerX + vx * zoom, y: centerY + vy * zoom };
}

/** Canvas point → vertex (center-relative px), rounded to integers. */
export function canvasToVertex(cx, cy, centerX, centerY, zoom) {
  return [Math.round((cx - centerX) / zoom), Math.round((cy - centerY) / zoom)];
}
