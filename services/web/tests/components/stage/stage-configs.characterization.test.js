import { describe, it, expect } from 'vitest';
import { makeCtx, OBJECTS } from './fixtures.js';
import * as shapes2d from '../../../src/components/stage/configs/shapes2d.js';

// Each extraction task appends a block here that snapshots its module's builders.
// Vitest writes/commits the snapshot on first run; later drift fails the test.
describe('stage config characterization', () => {
  it('fixtures load', () => {
    expect(makeCtx()).toBeTruthy();
    expect(Object.keys(OBJECTS).length).toBeGreaterThan(0);
  });
});

describe('shapes2d', () => {
  const ctx = makeCtx();
  const map = {
    rectangle: shapes2d.rectCfg, square: shapes2d.rectCfg, circle: shapes2d.circleCfg,
    ellipse: shapes2d.ellipseCfg, dot: shapes2d.dotCfg, heart: shapes2d.heartCfg,
    triangle: shapes2d.triangleCfg, polygon: shapes2d.polygonCfg, polygon_free: shapes2d.polygonFreeCfg,
    star: shapes2d.starCfg, line: shapes2d.lineCfg, arrow: shapes2d.arrowCfg,
    annulus: shapes2d.annulusCfg, sector: shapes2d.sectorCfg, arc: shapes2d.arcCfg,
    double_arrow: shapes2d.doubleArrowCfg, parametric: shapes2d.parametricCfg,
  };
  for (const [type, fn] of Object.entries(map)) {
    it(`${type} config is stable`, () => { expect(fn(OBJECTS[type], ctx)).toMatchSnapshot(); });
  }
});
