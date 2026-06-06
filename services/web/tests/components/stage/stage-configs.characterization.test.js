import { describe, it, expect } from 'vitest';
import { makeCtx, OBJECTS } from './fixtures.js';
import * as shapes2d from '../../../src/components/stage/configs/shapes2d.js';
import * as textCfgs from '../../../src/components/stage/configs/text.js';
import * as dataObjects from '../../../src/components/stage/configs/dataObjects.js';

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

describe('text configs', () => {
  const ctx = makeCtx();
  it('text config is stable', () => { expect(textCfgs.textCfg(OBJECTS.text, ctx)).toMatchSnapshot(); });
  it('counter config is stable', () => { expect(textCfgs.counterCfg(OBJECTS.counter, ctx)).toMatchSnapshot(); });
  it('latex bg config is stable', () => { expect(textCfgs.latexBgCfg(OBJECTS.latex, ctx)).toMatchSnapshot(); });
  it('latex text config is stable', () => { expect(textCfgs.latexTextCfg(OBJECTS.latex, ctx)).toMatchSnapshot(); });
});

describe('data-object configs', () => {
  const ctx = makeCtx();
  it('group cfg stable', () => { expect(dataObjects.groupCfg(OBJECTS.group, ctx)).toMatchSnapshot(); });
  it('dot_grid dots stable', () => { expect(dataObjects.dotGridDots(OBJECTS.dot_grid, ctx)).toMatchSnapshot(); });
  it('dot_grid hit cfg stable', () => { expect(dataObjects.dotGridHitCfg(OBJECTS.dot_grid, ctx)).toMatchSnapshot(); });
  it('matrix hit cfg stable', () => { expect(dataObjects.matrixHitCfg(OBJECTS.matrix, ctx)).toMatchSnapshot(); });
  it('matrix cells stable', () => { expect(dataObjects.matrixCellConfigs(OBJECTS.matrix, ctx)).toMatchSnapshot(); });
  it('matrix brackets stable', () => { expect(dataObjects.matrixBracketConfigs(OBJECTS.matrix, ctx)).toMatchSnapshot(); });
  it('table hit cfg stable', () => { expect(dataObjects.tableHitCfg(OBJECTS.table, ctx)).toMatchSnapshot(); });
  it('table cells stable', () => { expect(dataObjects.tableCellConfigs(OBJECTS.table, ctx)).toMatchSnapshot(); });
  it('table grid lines stable', () => { expect(dataObjects.tableGridLines(OBJECTS.table, ctx)).toMatchSnapshot(); });
  it('polar circles stable', () => { expect(dataObjects.polarCircleConfigs(OBJECTS.polar_plane, ctx)).toMatchSnapshot(); });
  it('polar spokes stable', () => { expect(dataObjects.polarSpokeConfigs(OBJECTS.polar_plane, ctx)).toMatchSnapshot(); });
  it('graph hit cfg stable', () => { expect(dataObjects.graphHitCfg(OBJECTS.graph, ctx)).toMatchSnapshot(); });
  it('graph edges stable', () => { expect(dataObjects.graphEdgeConfigs(OBJECTS.graph, ctx)).toMatchSnapshot(); });
  it('graph vertices stable', () => { expect(dataObjects.graphVertexConfigs(OBJECTS.graph, ctx)).toMatchSnapshot(); });
  it('graph labels stable', () => { expect(dataObjects.graphLabelConfigs(OBJECTS.graph, ctx)).toMatchSnapshot(); });
  it('vector field hit cfg stable', () => { expect(dataObjects.vectorFieldHitCfg(OBJECTS.vector_field, ctx)).toMatchSnapshot(); });
  it('vector field arrows stable', () => { expect(dataObjects.vectorFieldArrows(OBJECTS.vector_field, ctx)).toMatchSnapshot(); });
});
