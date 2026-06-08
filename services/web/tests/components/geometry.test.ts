import { describe, it, expect } from 'vitest';
import {
  generateShapePoints,
  generateTrianglePoints,
  generateStarPoints,
  generatePolygonPoints,
  generateLinePoints,
  generateArrowPoints,
  generateDotGridPositions,
  pointsToFlat,
  flatToPoints,
  pathLength,
  boundingBox,
} from '../../src/engine/geometry.js';

const numeric = (pts: { x: number; y: number }[]) =>
  pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

describe('generateShapePoints — count + validity for every type', () => {
  const types = [
    'rectangle',
    'square',
    'circle',
    'ellipse',
    'triangle',
    'star',
    'polygon',
    'line',
    'arrow',
    'heart',
    'dot',
    'text',
  ];
  for (const type of types) {
    it(`${type}: medium quality → 64 numeric points`, () => {
      const pts = generateShapePoints(type, 100, 80, 'medium');
      expect(pts).toHaveLength(64);
      expect(numeric(pts)).toBe(true);
    });
  }

  it('honours the quality point counts', () => {
    expect(generateShapePoints('circle', 100, 100, 'low')).toHaveLength(32);
    expect(generateShapePoints('circle', 100, 100, 'high')).toHaveLength(128);
  });

  it('unknown type falls back to a circle (still 64 points)', () => {
    expect(generateShapePoints('does-not-exist', 100, 100, 'medium')).toHaveLength(64);
  });
});

describe('individual generators stay within their bounding box', () => {
  const within = (pts: { x: number; y: number }[], hw: number, hh: number, tol = 1.5) =>
    pts.every((p) => Math.abs(p.x) <= hw + tol && Math.abs(p.y) <= hh + tol);

  it('triangle', () => {
    const pts = generateTrianglePoints(100, 80, 48);
    expect(pts).toHaveLength(48);
    expect(within(pts, 50, 40)).toBe(true);
  });
  it('star', () => {
    const pts = generateStarPoints(100, 100, 50, 5, 0.4);
    expect(pts).toHaveLength(50);
    expect(within(pts, 50, 50)).toBe(true);
  });
  it('polygon', () => {
    const pts = generatePolygonPoints(120, 120, 60, 6);
    expect(pts).toHaveLength(60);
    expect(within(pts, 60, 60)).toBe(true);
  });
  it('line', () => {
    const pts = generateLinePoints(100, 100, 40);
    expect(pts).toHaveLength(40);
    expect(numeric(pts)).toBe(true);
  });
  it('arrow', () => {
    const pts = generateArrowPoints(100, 60, 56);
    expect(pts).toHaveLength(56);
    expect(within(pts, 50, 30)).toBe(true);
  });
});

describe('generateDotGridPositions', () => {
  it('produces rows*cols centred positions', () => {
    const pts = generateDotGridPositions(3, 2, 20);
    expect(pts).toHaveLength(6);
    // centred: mean x and y ≈ 0
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    expect(Math.abs(mx)).toBeLessThan(1e-9);
    expect(Math.abs(my)).toBeLessThan(1e-9);
  });
});

describe('flat <-> points round-trip', () => {
  it('pointsToFlat then flatToPoints is identity', () => {
    const pts = [
      { x: 1, y: 2 },
      { x: -3, y: 4.5 },
    ];
    const flat = pointsToFlat(pts);
    expect(flat).toEqual([1, 2, -3, 4.5]);
    expect(flatToPoints(flat)).toEqual(pts);
  });
});

describe('pathLength + boundingBox', () => {
  it('open path length sums segment distances', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 3, y: 4 },
    ];
    expect(pathLength(pts, false)).toBeCloseTo(5, 6);
  });
  it('closed path adds the closing segment', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pathLength(square, true)).toBeCloseTo(40, 6);
  });
  it('boundingBox reports min/max + size', () => {
    const bb = boundingBox([
      { x: -5, y: 2 },
      { x: 7, y: -3 },
      { x: 1, y: 9 },
    ]);
    expect(bb).toMatchObject({ minX: -5, maxX: 7, minY: -3, maxY: 9, width: 12, height: 12 });
  });
});
