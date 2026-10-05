// Staggered entrances that overlap (B starts while A still animates) used to be
// emitted as consecutive self.play calls, each waiting for the previous one to
// finish — a decay-chain template planned for 10 s rendered for 12.5 s.
// They are now folded into ONE self.play in which every later animation is
// delayed by Succession(Wait(offset), …) (verified in Manim 0.20.1: the
// delayed mobject is not on screen before its turn).
import { describe, it, expect } from 'vitest';
import { generateScene } from '../src/index.js';

const resolveAsset = (obj: { name?: string }, ext: string) => `${obj.name || 'asset'}.${ext}`;

function sq(id: string, enterTime: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'square',
    x: 960,
    y: 540,
    width: 100,
    height: 100,
    fill: '#ff0000',
    enterTime,
    duration: 5,
    enterAnim: 'fade_in',
    enterAnimDur: 1,
    exitAnim: 'none',
    ...extra,
  };
}

function plays(objects: unknown[], sceneDuration?: number): string[] {
  return generateScene(
    {
      name: 'T',
      stage: { width: 1920, height: 1080 },
      objects,
      tracks: [],
      cameraTrack: [],
      sceneDuration,
    } as never,
    { resolveAsset } as never
  )
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('self.play(') || l.startsWith('self.wait('));
}

/** The script's real clock, Succession offsets included. */
function totalTime(lines: string[]): number {
  let t = 0;
  for (const l of lines) {
    const w = l.match(/^self\.wait\(([\d.]+)\)/);
    if (w) {
      t += parseFloat(w[1]!);
      continue;
    }
    const inner = l.slice('self.play('.length, -1);
    // each top-level part: optional Succession(Wait(run_time=o), X(..., run_time=d))
    const parts: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of inner) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    parts.push(cur.trim());
    let longest = 0;
    for (const p of parts) {
      const off = p.match(/^Succession\(Wait\(run_time=([\d.]+)\)/);
      const rts = [...p.matchAll(/run_time=([\d.]+)/g)].map((m) => parseFloat(m[1]!));
      const own = rts.length ? rts[rts.length - 1]! : 1;
      longest = Math.max(longest, (off ? parseFloat(off[1]!) : 0) + own);
    }
    t += longest;
  }
  return t;
}

describe('overlapping staggered entrances', () => {
  it('fold into one play, the later one delayed by a Succession(Wait)', () => {
    const lines = plays([sq('a', 0), sq('b', 0.4)]);
    expect(lines[0]).toBe(
      'self.play(FadeIn(a, run_time=1.00), Succession(Wait(run_time=0.40), FadeIn(b, run_time=1.00)))'
    );
    expect(totalTime(lines.slice(0, 1))).toBeCloseTo(1.4, 5);
  });

  it('chain while each starts before the cluster ends', () => {
    const lines = plays([sq('a', 0), sq('b', 0.5), sq('c', 1.2), sq('d', 3)]);
    expect(lines[0]).toMatch(
      /^self\.play\(FadeIn\(a.*Wait\(run_time=0\.50\).*Wait\(run_time=1\.20\), FadeIn\(c/
    );
    // d starts after the cluster (ends at 2.2): a wait, then its own play
    expect(lines[1]).toBe('self.wait(0.8)');
    expect(lines[2]).toBe('self.play(FadeIn(d))');
  });

  it('finish the last entrance when planned (decay-chain-like staggering)', () => {
    const objs = [0.8, 1.1, 1.3, 1.8, 2.6, 2.9, 3.1, 3.6].map((t, i) => sq(`o${i}`, t));
    const lines = plays(objs, 10);
    // everything but the final hold: the last entrance (3.6 + 1 s) ends at 4.6 s
    expect(totalTime(lines.slice(0, -1))).toBeCloseTo(4.6, 1);
    expect(totalTime(lines)).toBeCloseTo(10, 1);
  });

  it('leave simultaneous entrances in the existing merged form', () => {
    expect(plays([sq('a', 0), sq('b', 0)])[0]).toBe('self.play(FadeIn(a), FadeIn(b))');
  });

  it('leave non-overlapping entrances as separate plays', () => {
    const lines = plays([sq('a', 0), sq('b', 1.5)]);
    expect(lines.slice(0, 3)).toEqual([
      'self.play(FadeIn(a))',
      'self.wait(0.5)',
      'self.play(FadeIn(b))',
    ]);
  });
});
