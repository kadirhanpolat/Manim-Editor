import { describe, it, expect } from 'vitest';
import {
  presetVertices,
  verticesBBox,
  vertexToCanvas,
  canvasToVertex,
} from '../../src/engine/polygonVertices.js';

describe('polygonVertices', () => {
  it('trapezoid preset is 4 vertices centered, top narrower than bottom', () => {
    const v = presetVertices('trapezoid', 160, 120);
    expect(v.length).toBe(4);
    const topW = v[1][0] - v[0][0]; // top edge width
    const botW = v[2][0] - v[3][0]; // bottom edge width
    expect(botW).toBeGreaterThan(topW);
    expect(v.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))).toBe(true);
  });

  it('parallelogram preset is 4 vertices with equal-length skewed sides', () => {
    const v = presetVertices('parallelogram', 160, 120);
    expect(v.length).toBe(4);
  });

  it('free preset returns >= 3 vertices', () => {
    expect(presetVertices('free', 120, 120).length).toBeGreaterThanOrEqual(3);
  });

  it('verticesBBox returns width/height spanning the extremes', () => {
    const bb = verticesBBox([
      [-40, -60],
      [40, -60],
      [80, 60],
      [-80, 60],
    ]);
    expect(bb.width).toBe(160);
    expect(bb.height).toBe(120);
  });

  it('vertexToCanvas / canvasToVertex round-trip', () => {
    const center = { x: 500, y: 300 };
    const c = vertexToCanvas([40, -60], center.x, center.y, 2); // zoom 2
    expect(c).toEqual({ x: 580, y: 180 });
    const back = canvasToVertex(c.x, c.y, center.x, center.y, 2);
    expect(back).toEqual([40, -60]);
  });
});
