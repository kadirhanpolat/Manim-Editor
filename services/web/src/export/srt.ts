// SubRip (.srt) subtitles from the narration text of voiceover clips.
// Timing follows the render: a voiceover starts with its clip (plus the manual
// offset in manual sync mode) and lasts as long as its audio when that is known.
import type { Project, Clip } from '@manim/codegen';

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

/** Common subtitle guideline: at most 42 characters per line. */
const MAX_LINE = 42;

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function subtitleCues(project: Project): SubtitleCue[] {
  const clips: Clip[] = (project.tracks ?? []).flatMap((t) => t.clips ?? []);
  const cues: SubtitleCue[] = [];
  for (const c of clips) {
    const a = c.audio;
    const text = (a?.text ?? '').trim();
    if (!a || !text) continue;
    const offset = a.syncMode === 'manual' ? Math.max(0, Number(a.offset) || 0) : 0;
    const start = (c.startTime ?? 0) + offset;
    const length =
      typeof a.duration === 'number' && a.duration > 0 ? a.duration : (c.duration ?? 0);
    cues.push({ start: round3(start), end: round3(start + length), text });
  }
  return cues.sort((x, y) => x.start - y.start);
}

export function hasNarration(project: Project): boolean {
  return subtitleCues(project).length > 0;
}

/** Seconds → `HH:MM:SS,mmm`. */
export function srtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(
    Math.floor(ms / 1000) % 60
  )},${pad(ms % 1000, 3)}`;
}

function wrap(text: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > MAX_LINE) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function buildSrt(project: Project): string {
  return subtitleCues(project)
    .map(
      (c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${wrap(c.text).join('\n')}\n`
    )
    .join('\n');
}

/** Download the project's subtitles as `<name>.srt`; returns false when there are none. */
export function downloadSrt(project: Project): boolean {
  const srt = buildSrt(project);
  if (!srt) return false;
  const blob = new Blob([srt], { type: 'application/x-subrip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(project.name || 'scene').replace(/[^\w.-]+/g, '_')}.srt`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
