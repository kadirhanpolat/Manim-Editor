/**
 * Pure vertex math for the polygon_free object.
 * Vertices are integer px relative to the object center: [[vx, vy], ...].
 */
import type { Vertex } from './types.js';

/** Preset vertex arrays scaled to a w×h bounding box, centered at (0,0). */
export function presetVertices(type: string, w: number, h: number): Vertex[] {
  const hw = Math.round(w / 2),
    hh = Math.round(h / 2);
  if (type === 'parallelogram') {
    const s = Math.round(hw * 0.4);
    return [
      [-hw + s, -hh] as Vertex,
      [hw + s, -hh] as Vertex,
      [hw - s, hh] as Vertex,
      [-hw - s, hh] as Vertex,
    ];
  }
  if (type === 'free') {
    return [
      [0, -hh] as Vertex,
      [hw, 0] as Vertex,
      [0, hh] as Vertex,
      [-hw, 0] as Vertex,
    ]; // diamond starting shape
  }
  // trapezoid (default): narrower top
  const tw = Math.round(hw * 0.5);
  return [
    [-tw, -hh] as Vertex,
    [tw, -hh] as Vertex,
    [hw, hh] as Vertex,
    [-hw, hh] as Vertex,
  ];
}

/** Bounding-box {width, height} of a vertex list. */
export function verticesBBox(vertices: Vertex[]): { width: number; height: number } {
  const xs = vertices.map((v) => v[0]),
    ys = vertices.map((v) => v[1]);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** Vertex (center-relative px) → canvas point, given center canvas coords and zoom. */
export function vertexToCanvas([vx, vy]: Vertex, centerX: number, centerY: number, zoom: number): { x: number; y: number } {
  return { x: centerX + vx * zoom, y: centerY + vy * zoom };
}

/** Canvas point → vertex (center-relative px), rounded to integers. */
export function canvasToVertex(cx: number, cy: number, centerX: number, centerY: number, zoom: number): Vertex {
  return [Math.round((cx - centerX) / zoom), Math.round((cy - centerY) / zoom)] as Vertex;
}
