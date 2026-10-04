// Regression tests for the externally reported EDITOR_FINDINGS (Patterson
// documentary, 2026-10): bare math names in expressions, simultaneous
// enter/exit animations, and sceneDuration-honouring scene tails.
import { describe, it, expect } from 'vitest';
import { generateScene, safeMathExpr, normalizeMathExpr } from '../src/index.js';

const resolveAsset = (obj: { name?: string }, ext: string) => `${obj.name || 'asset'}.${ext}`;

function baseProject(extra: Record<string, unknown> = {}) {
  return {
    name: 'T',
    stage: { width: 1920, height: 1080 },
    objects: [],
    tracks: [],
    cameraTrack: [],
    ...extra,
  };
}

function rect(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'rectangle',
    x: 960,
    y: 540,
    width: 100,
    height: 100,
    fill: '#ff0000',
    enterTime: 0,
    duration: 3,
    enterAnim: 'fade_in',
    exitAnim: 'none',
    ...extra,
  };
}

// Mirrors the parser's playback clock: the sum of waits + play run_times.
function playLines(code: string): string[] {
  return code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('self.play(') || l.startsWith('self.wait('));
}

function totalTime(code: string): number {
  let t = 0;
  for (const l of playLines(code)) {
    const w = l.match(/^self\.wait\(([\d.]+)\)/);
    if (w) {
      t += parseFloat(w[1]);
      continue;
    }
    const rts = [...l.matchAll(/run_time=([\d.]+)/g)].map((m) => parseFloat(m[1]));
    t += rts.length ? Math.max(...rts) : 1;
  }
  return t;
}

describe('normalizeMathExpr / safeMathExpr (finding #1)', () => {
  it('prefixes bare numpy functions so the render namespace resolves them', () => {
    expect(normalizeMathExpr('exp(-0.155*x)')).toBe('np.exp(-0.155*x)');
    expect(normalizeMathExpr('sin(x) + cos(2*x)')).toBe('np.sin(x) + np.cos(2*x)');
    expect(normalizeMathExpr('log(x) * sqrt(x)')).toBe('np.log(x) * np.sqrt(x)');
  });

  it('leaves already-prefixed calls and unrelated identifiers untouched', () => {
    expect(normalizeMathExpr('np.sin(x)')).toBe('np.sin(x)');
    expect(normalizeMathExpr('x**2 - y**2')).toBe('x**2 - y**2');
    expect(normalizeMathExpr('PI * t')).toBe('PI * t');
    expect(normalizeMathExpr('1e-3 * x')).toBe('1e-3 * x');
  });

  it('maps bare pi / e / E constants to numpy', () => {
    expect(normalizeMathExpr('pi * x')).toBe('np.pi * x');
    expect(normalizeMathExpr('e**x')).toBe('np.e**x');
    expect(normalizeMathExpr('E**x')).toBe('np.e**x');
  });

  it('maps common aliases (ln, asin, acos, atan) to their numpy names', () => {
    expect(normalizeMathExpr('ln(x) + asin(x)')).toBe('np.log(x) + np.arcsin(x)');
    expect(normalizeMathExpr('acos(x) * atan(x)')).toBe('np.arccos(x) * np.arctan(x)');
  });

  it('turns ^ (XOR in Python) into exponentiation', () => {
    expect(normalizeMathExpr('x^2')).toBe('x**2');
  });

  it('safeMathExpr returns the normalized form and still rejects unsafe input', () => {
    expect(safeMathExpr('exp(-x)')).toBe('np.exp(-x)');
    expect(safeMathExpr('__import__("os")')).toBe('x**2');
  });

  it('emits np-prefixed graph expressions in generated axes code', () => {
    const code = generateScene(
      baseProject({
        objects: [
          {
            id: 'ax',
            type: 'axes',
            x: 960,
            y: 540,
            width: 800,
            height: 500,
            graphs: [{ id: 'g1', expression: 'exp(-0.155*x)', color: '#ffffff', xMin: 0, xMax: 5 }],
          },
        ],
      }) as never,
      { resolveAsset } as never
    );
    expect(code).toContain('lambda x: np.exp(-0.155*x)');
    expect(code).not.toMatch(/lambda x: exp\(/);
  });
});

describe('simultaneous enter/exit animations (finding #3)', () => {
  it('merges enters that share a start time into one self.play', () => {
    const code = generateScene(
      baseProject({ objects: [rect('a'), rect('b'), rect('c')] }) as never,
      { resolveAsset } as never
    );
    expect(code).toContain('self.play(FadeIn(a), FadeIn(b), FadeIn(c), run_time=0.5)');
    expect(code).not.toContain('self.play(FadeIn(a), run_time=0.5)');
  });

  it('merges exits that share an end time into one self.play', () => {
    const objs = ['a', 'b', 'c'].map((id) => rect(id, { exitAnim: 'fade_out' }));
    const code = generateScene(baseProject({ objects: objs }) as never, { resolveAsset } as never);
    expect(code).toContain('self.play(FadeOut(a), FadeOut(b), FadeOut(c), run_time=0.5)');
  });

  it('gives each animation its own run_time when durations differ', () => {
    const code = generateScene(
      baseProject({ objects: [rect('a'), rect('b', { enterAnimDur: 1.5 })] }) as never,
      { resolveAsset } as never
    );
    expect(code).toContain('self.play(FadeIn(a, run_time=0.5), FadeIn(b, run_time=1.5))');
  });

  it('keeps a single enter on the legacy one-animation form', () => {
    const code = generateScene(
      baseProject({ objects: [rect('a')] }) as never,
      { resolveAsset } as never
    );
    expect(code).toContain('self.play(FadeIn(a), run_time=0.5)');
  });

  it('keeps instant self.add enters out of the merged play', () => {
    const code = generateScene(
      baseProject({ objects: [rect('a', { enterAnim: 'none' }), rect('b'), rect('c')] }) as never,
      { resolveAsset } as never
    );
    expect(code).toContain('self.add(a)');
    expect(code).toContain('self.play(FadeIn(b), FadeIn(c), run_time=0.5)');
  });

  it('does not drift: nine exits at t=11 leave a 30 s scene at 30 s', () => {
    const objs = Array.from({ length: 9 }, (_, i) =>
      rect(`o${i}`, { duration: 11, exitAnim: 'fade_out' })
    );
    const code = generateScene(
      baseProject({ objects: objs, sceneDuration: 30 }) as never,
      { resolveAsset } as never
    );
    expect(totalTime(code)).toBeCloseTo(30, 1);
  });
});

describe('scene timing (finding #4)', () => {
  it('pads the tail so the render lasts sceneDuration', () => {
    const code = generateScene(
      baseProject({ objects: [rect('a')], sceneDuration: 28 }) as never,
      { resolveAsset } as never
    );
    expect(totalTime(code)).toBeCloseTo(28, 1);
  });

  it('still ends with a 1 s hold after the last animation when that is longer', () => {
    const code = generateScene(
      baseProject({
        objects: [rect('a', { duration: 12, exitAnim: 'fade_out' })],
        sceneDuration: 5,
      }) as never,
      { resolveAsset } as never
    );
    // FadeIn 0.5 → wait to 12 → FadeOut 0.5 → hold 1
    expect(totalTime(code)).toBeCloseTo(13.5, 1);
  });

  it('counts a voiceover longer than its clip toward the elapsed time', () => {
    const code = generateScene(
      baseProject({
        objects: [rect('a', { duration: 10 })],
        sceneDuration: 10,
        tracks: [
          {
            id: 't1',
            clips: [
              {
                id: 'c1',
                type: 'scale',
                sourceId: 'a',
                startTime: 1,
                duration: 1,
                params: { targetScaleX: 2 },
                audio: {
                  type: 'file',
                  src: '/a.wav',
                  status: 'ready',
                  syncMode: 'auto',
                  duration: 3,
                },
              },
            ],
          },
        ],
      }) as never,
      { resolveAsset } as never
    );
    // FadeIn 0.5 → wait 0.5 → voiceover block really lasts 3 → t=4 → hold 6
    const lines = playLines(code);
    expect(lines[lines.length - 1]).toBe('self.wait(6.0)');
  });

  it('always holds at least 1 s after the last animation, even when clips overlap', () => {
    const code = generateScene(
      baseProject({
        objects: [rect('a', { duration: 10 })],
        sceneDuration: 5,
        tracks: [
          {
            id: 't1',
            clips: [
              {
                id: 'c1',
                type: 'scale',
                sourceId: 'a',
                startTime: 3,
                duration: 1,
                params: { targetScaleX: 2 },
              },
              {
                id: 'c2',
                type: 'scale',
                sourceId: 'a',
                startTime: 3,
                duration: 1,
                params: { targetScaleX: 1 },
              },
            ],
          },
        ],
      }) as never,
      { resolveAsset } as never
    );
    const lines = playLines(code);
    expect(lines[lines.length - 1]).toBe('self.wait(1)');
  });

  it('keeps the legacy trailing self.wait(1) when sceneDuration is absent', () => {
    const code = generateScene(
      baseProject({ objects: [rect('a')] }) as never,
      { resolveAsset } as never
    );
    const lines = playLines(code);
    expect(lines[lines.length - 1]).toBe('self.wait(1)');
  });

  it('measures waits from the real elapsed time, not the nominal step end', () => {
    // enter (0–0.5) overlaps the move clip starting at 0 (0–1, played after
    // it → really ends at 1.5); the next clip at t=3 must start at 3.0.
    const code = generateScene(
      baseProject({
        objects: [rect('a', { duration: 10 })],
        tracks: [
          {
            id: 't1',
            clips: [
              {
                id: 'c1',
                type: 'scale',
                sourceId: 'a',
                startTime: 0,
                duration: 1,
                params: { targetScaleX: 2 },
              },
              {
                id: 'c2',
                type: 'scale',
                sourceId: 'a',
                startTime: 3,
                duration: 1,
                params: { targetScaleX: 1 },
              },
            ],
          },
        ],
      }) as never,
      { resolveAsset } as never
    );
    const lines = playLines(code);
    const idx = lines.findIndex((l) => l.includes('scale(1.00)'));
    let t = 0;
    for (const l of lines.slice(0, idx)) {
      const w = l.match(/^self\.wait\(([\d.]+)\)/);
      if (w) t += parseFloat(w[1]);
      else {
        const rt = l.match(/run_time=([\d.]+)/);
        t += rt ? parseFloat(rt[1]) : 1;
      }
    }
    expect(t).toBeCloseTo(3, 1);
  });
});
