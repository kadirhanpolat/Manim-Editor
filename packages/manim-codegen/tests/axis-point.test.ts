// axis_point (backlog "data point on axes", documentary production): a point
// positioned by its VALUE on an axes object — Dot(ax.c2p(x, y)) — with an
// optional MathTex label and dashed guides to the axes. Like the other bound
// annotations it is emitted after its target and gets no move_to.
import { describe, it, expect } from 'vitest';
import { generateScene } from '../src/index.js';

const resolveAsset = (obj: { name?: string }, ext: string) => `${obj.name || 'asset'}.${ext}`;

const axes = {
  id: 'ax',
  type: 'axes',
  x: 960,
  y: 540,
  width: 900,
  height: 560,
  xRange: [0, 4, 1],
  yRange: [0, 10, 2],
  enterTime: 0,
  duration: 5,
  enterAnim: 'none',
  exitAnim: 'none',
};

function point(extra: Record<string, unknown> = {}) {
  return {
    id: 'p',
    type: 'axis_point',
    targetId: 'ax',
    valueX: 2,
    valueY: 2.5,
    width: 22,
    height: 22,
    fill: '#f97316',
    enterTime: 0,
    duration: 5,
    enterAnim: 'none',
    exitAnim: 'none',
    ...extra,
  };
}

function code(objects: unknown[]): string[] {
  return generateScene(
    {
      name: 'T',
      stage: { width: 1920, height: 1080 },
      objects,
      tracks: [],
      cameraTrack: [],
    } as never,
    { resolveAsset } as never
  )
    .split('\n')
    .map((l) => l.trim());
}

describe('axis_point codegen', () => {
  it('places a Dot at the axes coordinates, after the axes, without move_to', () => {
    const lines = code([point(), axes]); // listed before its target on purpose
    const dot = lines.indexOf('p = Dot(ax.c2p(2, 2.5), radius=0.081, color="#f97316")');
    expect(dot).toBeGreaterThan(lines.findIndex((l) => l.startsWith('ax = Axes(')));
    expect(lines.some((l) => l.startsWith('p.move_to('))).toBe(false);
  });

  it('adds a MathTex label up-right of the point', () => {
    const lines = code([axes, point({ label: 'P_1' })]);
    expect(lines).toContain(
      'p = VGroup(p, MathTex("P_1").next_to(p, UR, buff=0.1).set_color("#f97316"))'
    );
  });

  it('adds dashed guides to both axes', () => {
    const lines = code([axes, point({ showGuides: true })]);
    expect(lines).toContain(
      'p = VGroup(ax.get_lines_to_point(ax.c2p(2, 2.5), color="#f97316"), p)'
    );
  });

  it('is skipped when its target is missing or hidden (no NameError)', () => {
    for (const objs of [[point({ targetId: '' })], [{ ...axes, hidden: true }, point()]]) {
      const lines = code(objs);
      expect(lines.some((l) => l.includes('Dot(') || l.includes('self.add(p)'))).toBe(false);
    }
  });
});
