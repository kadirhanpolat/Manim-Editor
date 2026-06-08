import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920,
  SH = 1080;
function makeObj(extra = {}) {
  return {
    id: 'o1',
    type: 'matrix',
    x: SW / 2,
    y: SH / 2,
    width: 160,
    height: 120,
    matrixData: [
      ['1', '0'],
      ['0', '1'],
    ],
    bracket: '[',
    fill: '#ffffff',
    stroke: '#ffffff',
    strokeWidth: 0,
    opacity: 1,
    rotation: 0,
    enterTime: 0,
    duration: 5,
    enterAnim: 'none',
    exitAnim: 'none',
    ...extra,
  };
}
function makeProject(objects) {
  return {
    name: 'T',
    sceneType: '2d',
    stage: { width: SW, height: SH },
    sceneDuration: 5,
    fps: 60,
    background: '#000000',
    objects,
    tracks: [],
    cameraTrack: [],
    assets: [],
    groups: [],
  };
}

describe('matrix codegen', () => {
  it('emits single-line Matrix with default square brackets + set_color', () => {
    const s = generateManimScript(makeProject([makeObj()]));
    expect(s).toMatch(/= Matrix\(\[\["1", "0"\], \["0", "1"\]\]\)/);
    expect(s).toMatch(/\.set_color\("#ffffff"\)/);
  });

  it('emits left_bracket/right_bracket for paren bracket', () => {
    const s = generateManimScript(makeProject([makeObj({ bracket: '(' })]));
    expect(s).toMatch(
      /Matrix\(\[\["1", "0"\], \["0", "1"\]\], left_bracket="\(", right_bracket="\)"\)/
    );
  });

  it('emits pipe brackets for determinant style', () => {
    const s = generateManimScript(makeProject([makeObj({ bracket: '|' })]));
    expect(s).toMatch(/left_bracket="\|", right_bracket="\|"/);
  });

  it('sanitizes entries (strips quotes/backslashes)', () => {
    const s = generateManimScript(makeProject([makeObj({ matrixData: [['a"b', 'c\\d']] })]));
    expect(s).toMatch(/Matrix\(\[\["ab", "cd"\]\]\)/);
  });

  it('handles a non-square 1x3 matrix', () => {
    const s = generateManimScript(makeProject([makeObj({ matrixData: [['x', 'y', 'z']] })]));
    expect(s).toMatch(/Matrix\(\[\["x", "y", "z"\]\]\)/);
  });
});

describe('matrix round-trip', () => {
  it('round-trips type + data + default bracket', () => {
    const o = parseManimScript(generateManimScript(makeProject([makeObj()])), SW, SH).objects[0];
    expect(o.type).toBe('matrix');
    expect(o.matrixData).toEqual([
      ['1', '0'],
      ['0', '1'],
    ]);
    expect(o.bracket).toBe('[');
  });

  it('round-trips paren bracket and entry color', () => {
    const o = parseManimScript(
      generateManimScript(makeProject([makeObj({ bracket: '(', fill: '#ff0000' })])),
      SW,
      SH
    ).objects[0];
    expect(o.bracket).toBe('(');
    expect(o.fill.toLowerCase()).toBe('#ff0000');
  });

  it('round-trips a non-square 1x3 matrix', () => {
    const o = parseManimScript(
      generateManimScript(makeProject([makeObj({ matrixData: [['x', 'y', 'z']] })])),
      SW,
      SH
    ).objects[0];
    expect(o.matrixData).toEqual([['x', 'y', 'z']]);
  });
});
