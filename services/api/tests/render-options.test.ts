/**
 * Render export options — zod enum allowlist.
 * Values are NEVER interpolated into manim argv; this allowlist is the
 * argument-injection gate (same posture as isSafeSceneName).
 */

import { describe, it, expect } from 'vitest';
import { parseRenderOptions } from '../src/compiler/validator.js';

describe('parseRenderOptions', () => {
  it('defaults to mp4 / 1920x1080 / 60 when fields are absent', () => {
    const r = parseRenderOptions({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options).toEqual({ format: 'mp4', resolution: '1920x1080', fps: 60 });
  });

  it('accepts every allowlisted combination (3 formats x 5 resolutions x 3 fps)', () => {
    for (const format of ['mp4', 'gif', 'webm'] as const) {
      for (const resolution of [
        '854x480',
        '1280x720',
        '1920x1080',
        '2560x1440',
        '3840x2160',
      ] as const) {
        for (const fps of [15, 30, 60] as const) {
          const r = parseRenderOptions({ format, resolution, fps });
          expect(r.ok).toBe(true);
          if (r.ok) expect(r.options).toEqual({ format, resolution, fps });
        }
      }
    }
  });

  it('rejects an unknown format with a message naming the field', () => {
    const r = parseRenderOptions({ format: 'mov' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/format/);
  });

  it('rejects argv-injection shaped values', () => {
    expect(parseRenderOptions({ resolution: '--config_file=/etc/evil' }).ok).toBe(false);
    expect(parseRenderOptions({ format: '--format gif; rm -rf /' }).ok).toBe(false);
  });

  it('rejects fps sent as a string or a non-allowlisted number', () => {
    expect(parseRenderOptions({ fps: '60' }).ok).toBe(false);
    expect(parseRenderOptions({ fps: 24 }).ok).toBe(false);
  });

  it('ignores unrelated body fields (quality/codeSource passthrough)', () => {
    const r = parseRenderOptions({ quality: 'high', codeSource: 'from manim import *' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options.format).toBe('mp4');
  });
});
