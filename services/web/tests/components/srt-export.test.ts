// SRT export from voiceover clip text (backlog: "SRT export built from the text
// of voiceover clips", documentary production). Cue timing follows the render:
// the narration starts with its clip (+ a manual offset) and lasts as long as
// the audio when that is known.
import { describe, it, expect } from 'vitest';
import { buildSrt, hasNarration, srtTime, subtitleCues } from '../../src/export/srt.js';

function project(clips: unknown[], extraTracks: unknown[] = []) {
  return {
    name: 'Doc',
    stage: { width: 1920, height: 1080 },
    objects: [],
    tracks: [{ id: 't1', name: 'Track 1', clips }, ...extraTracks],
  } as never;
}

function voiced(id: string, startTime: number, text: string, audio: Record<string, unknown> = {}) {
  return {
    id,
    type: 'fade',
    startTime,
    duration: 2,
    audio: { type: 'gtts', text, status: 'ready', syncMode: 'auto', ...audio },
  };
}

describe('srtTime', () => {
  it('formats hours, minutes, seconds and milliseconds', () => {
    expect(srtTime(0)).toBe('00:00:00,000');
    expect(srtTime(3723.456)).toBe('01:02:03,456');
    expect(srtTime(59.9996)).toBe('00:01:00,000');
  });
});

describe('subtitleCues', () => {
  it('times each cue like the render: clip start (+offset) to the audio end', () => {
    const cues = subtitleCues(
      project(
        [voiced('b', 4.5, 'Second line.', { duration: 2.3 }), voiced('a', 1, 'First line.')],
        [
          {
            id: 't2',
            name: 'Track 2',
            clips: [voiced('c', 8, 'Third.', { syncMode: 'manual', offset: 0.5 })],
          },
        ]
      )
    );
    expect(cues).toEqual([
      { start: 1, end: 3, text: 'First line.' },
      { start: 4.5, end: 6.8, text: 'Second line.' },
      { start: 8.5, end: 10.5, text: 'Third.' },
    ]);
  });

  it('skips clips without narration text', () => {
    const cues = subtitleCues(
      project([
        { id: 'x', type: 'fade', startTime: 0, duration: 1 },
        voiced('f', 2, '   ', { type: 'file' }),
        voiced('g', 3, 'Kept'),
      ])
    );
    expect(cues.map((c) => c.text)).toEqual(['Kept']);
    expect(hasNarration(project([{ id: 'x', type: 'fade', startTime: 0, duration: 1 }]))).toBe(
      false
    );
  });
});

describe('buildSrt', () => {
  it('numbers the cues and separates them with blank lines', () => {
    const srt = buildSrt(project([voiced('a', 1, 'Hello.'), voiced('b', 4, 'World.')]));
    expect(srt).toBe(
      '1\n00:00:01,000 --> 00:00:03,000\nHello.\n\n2\n00:00:04,000 --> 00:00:06,000\nWorld.\n'
    );
  });

  it('wraps long narration into lines of at most 42 characters', () => {
    const text = 'Uranium-238 decays by alpha emission into thorium-234 over billions of years.';
    const lines = buildSrt(project([voiced('a', 0, text)]))
      .split('\n')
      .slice(2)
      .filter(Boolean);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= 42)).toBe(true);
    expect(lines.join(' ')).toBe(text);
  });

  it('is empty when there is nothing to narrate', () => {
    expect(buildSrt(project([]))).toBe('');
  });
});
