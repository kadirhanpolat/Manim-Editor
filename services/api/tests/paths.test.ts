import { describe, it, expect } from 'vitest';
import { isSafeSegment } from '../src/util/paths.js';

describe('isSafeSegment', () => {
  it('accepts server-generated ids and filenames', () => {
    expect(isSafeSegment('proj_abc123')).toBe(true);
    expect(isSafeSegment('asset_9f8e7d')).toBe(true);
    expect(isSafeSegment('1a2b3c_logo.png')).toBe(true);
    expect(isSafeSegment('latest.mp4')).toBe(true);
    expect(isSafeSegment('render_20260608_1200.mp4')).toBe(true);
    expect(isSafeSegment('a1b2c3.wav')).toBe(true);
  });

  it('rejects path-traversal sequences', () => {
    expect(isSafeSegment('..')).toBe(false);
    expect(isSafeSegment('../etc')).toBe(false);
    expect(isSafeSegment('foo/../bar')).toBe(false);
    expect(isSafeSegment('..\\windows')).toBe(false);
    expect(isSafeSegment('a..b')).toBe(false);
  });

  it('rejects path separators', () => {
    expect(isSafeSegment('a/b')).toBe(false);
    expect(isSafeSegment('a\\b')).toBe(false);
    expect(isSafeSegment('/etc/passwd')).toBe(false);
    expect(isSafeSegment('C:\\Windows')).toBe(false);
  });

  it('rejects empty, whitespace, NUL and over-long values', () => {
    expect(isSafeSegment('')).toBe(false);
    expect(isSafeSegment(' ')).toBe(false);
    expect(isSafeSegment('a b')).toBe(false);
    expect(isSafeSegment('a\0b')).toBe(false);
    expect(isSafeSegment('a'.repeat(300))).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isSafeSegment(undefined)).toBe(false);
    expect(isSafeSegment(null)).toBe(false);
    expect(isSafeSegment(123)).toBe(false);
    expect(isSafeSegment({})).toBe(false);
    expect(isSafeSegment(['a'])).toBe(false);
  });
});
