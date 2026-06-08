import { describe, it, expect } from 'vitest';
import {
  parseHex,
  toHex,
  interpolateColor,
  lerp,
  resamplePoints,
  interpolatePoints,
  computeMorphState,
  createMotionGhosts,
} from '../../src/engine/transform.js';

describe('color helpers', () => {
  it('parseHex handles 6-digit and 3-digit forms', () => {
    expect(parseHex('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
    expect(parseHex('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });
  it('toHex clamps out-of-range channels', () => {
    expect(toHex({ r: 300, g: -10, b: 128 })).toBe('#ff0080');
  });
  it('interpolateColor blends, and falls back when a color is missing', () => {
    expect(interpolateColor('#000000', '#ffffff', 0.5).toLowerCase()).toMatch(/#(7f7f7f|808080)/);
    expect(interpolateColor(undefined, '#abcdef', 0.5)).toBe('#abcdef');
    expect(interpolateColor('#abcdef', undefined, 0.5)).toBe('#abcdef');
    expect(interpolateColor(undefined, undefined, 0.5)).toBe('#ffffff');
  });
});

describe('lerp', () => {
  it('interpolates endpoints', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
});

describe('resamplePoints', () => {
  it('produces exactly the requested count', () => {
    const src = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 }));
    expect(resamplePoints(src, 25)).toHaveLength(25);
    expect(resamplePoints(src, 4)).toHaveLength(4);
  });
  it('empty input → empty output', () => {
    expect(resamplePoints([], 8)).toEqual([]);
  });
  it('single point → repeated', () => {
    const out = resamplePoints([{ x: 3, y: 7 }], 5);
    expect(out).toHaveLength(5);
    expect(out.every((p) => p.x === 3 && p.y === 7)).toBe(true);
  });
});

describe('interpolatePoints', () => {
  it('midpoint blends coordinates', () => {
    const a = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const b = [
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ];
    const mid = interpolatePoints(a, b, 0.5);
    expect(mid[0]).toEqual({ x: 0, y: 5 });
    expect(mid[1]).toEqual({ x: 10, y: 5 });
  });
});

describe('computeMorphState', () => {
  const src = {
    id: 's',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    fill: '#000000',
    stroke: '#000000',
    strokeWidth: 2,
    opacity: 1,
  };
  const tgt = {
    id: 't',
    type: 'circle',
    x: 100,
    y: 50,
    width: 200,
    height: 60,
    rotation: 90,
    fill: '#ffffff',
    stroke: '#ffffff',
    strokeWidth: 6,
    opacity: 0,
  };
  const pts = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];

  it('interpolates every animatable property at t=0.5', () => {
    const m = computeMorphState(src, tgt, pts, pts, 0.5);
    expect(m.x).toBe(50);
    expect(m.y).toBe(25);
    expect(m.width).toBe(150);
    expect(m.height).toBe(80);
    expect(m.rotation).toBe(45);
    expect(m.strokeWidth).toBe(4);
    expect(m.opacity).toBe(0.5);
    expect(m.points).toHaveLength(2);
  });

  it('returns source/target values at the endpoints', () => {
    expect(computeMorphState(src, tgt, pts, pts, 0).x).toBe(0);
    expect(computeMorphState(src, tgt, pts, pts, 1).x).toBe(100);
  });
});

describe('createMotionGhosts', () => {
  it('produces N ghosts with decreasing opacity', () => {
    const prev = {
      points: [{ x: 0, y: 0 }],
      x: 0,
      y: 0,
      opacity: 1,
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 2,
    };
    const curr = {
      points: [{ x: 10, y: 0 }],
      x: 10,
      y: 0,
      opacity: 1,
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 2,
    };
    const ghosts = createMotionGhosts(prev, curr, 3);
    expect(ghosts).toHaveLength(3);
    for (let i = 1; i < ghosts.length; i++) {
      expect(ghosts[i].opacity as number).toBeLessThan(ghosts[i - 1].opacity as number);
    }
  });
});
