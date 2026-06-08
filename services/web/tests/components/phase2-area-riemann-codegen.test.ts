import { describe, it, expect } from 'vitest';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

const SW = 1920,
  SH = 1080;
function axesObj(graphs) {
  return {
    id: 'a1',
    type: 'axes',
    x: SW / 2,
    y: SH / 2,
    width: 400,
    height: 300,
    xRange: [-5, 5, 1],
    yRange: [-3, 3, 1],
    graphs,
    fill: '#ffffff',
    stroke: '#ffffff',
    strokeWidth: 2,
    opacity: 1,
    rotation: 0,
    enterTime: 0,
    duration: 5,
    enterAnim: 'none',
    exitAnim: 'none',
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
const graph = (extra) => ({
  id: 'g1',
  expression: 'x**2',
  color: '#f59e0b',
  xMin: -2,
  xMax: 2,
  strokeWidth: 3,
  ...extra,
});

describe('area + riemann codegen', () => {
  it('emits get_area when area.enabled', () => {
    const s = generateManimScript(
      makeProject([
        axesObj([
          graph({ area: { enabled: true, xMin: -2, xMax: 2, opacity: 0.5, color: '#f59e0b' } }),
        ]),
      ])
    );
    expect(s).toMatch(/= \w+\.get_area\(\w+, x_range=\[-2, 2\], color="#f59e0b", opacity=0\.5\)/);
  });
  it('emits get_riemann_rectangles when riemann.enabled', () => {
    const s = generateManimScript(
      makeProject([
        axesObj([
          graph({
            riemann: { enabled: true, xMin: -2, xMax: 2, dx: 0.5, type: 'left', color: '#f59e0b' },
          }),
        ]),
      ])
    );
    expect(s).toMatch(
      /= \w+\.get_riemann_rectangles\(\w+, x_range=\[-2, 2\], dx=0\.5, input_sample_type="left", color="#f59e0b"\)/
    );
  });
  it('round-trips area + riemann onto the graph', () => {
    const proj = makeProject([
      axesObj([
        graph({
          area: { enabled: true, xMin: -2, xMax: 2, opacity: 0.5, color: '#f59e0b' },
          riemann: { enabled: true, xMin: -2, xMax: 2, dx: 0.5, type: 'left', color: '#f59e0b' },
        }),
      ]),
    ]);
    const o = parseManimScript(generateManimScript(proj), SW, SH).objects[0];
    const g = o.graphs[0];
    expect(g.area.enabled).toBe(true);
    expect(g.area.xMax).toBeCloseTo(2, 2);
    expect(g.riemann.enabled).toBe(true);
    expect(g.riemann.dx).toBeCloseTo(0.5, 2);
    expect(g.riemann.type).toBe('left');
  });
});
