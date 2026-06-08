import { describe, it, expect } from 'vitest';
import { isSafeSegment, isSafeSceneName } from '../src/util/paths.js';

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

describe('isSafeSceneName', () => {
  it('accepts valid Python class identifiers', () => {
    expect(isSafeSceneName('MainScene')).toBe(true);
    expect(isSafeSceneName('Scene1')).toBe(true);
    expect(isSafeSceneName('_private')).toBe(true);
    expect(isSafeSceneName('my_scene_2')).toBe(true);
  });

  it('rejects manim-flag / argument-injection attempts', () => {
    expect(isSafeSceneName('--config_file=/etc/x')).toBe(false);
    expect(isSafeSceneName('-qk')).toBe(false);
    expect(isSafeSceneName('Scene --flag')).toBe(false);
    expect(isSafeSceneName('1Scene')).toBe(false); // can't start with a digit
    expect(isSafeSceneName('Scene-2')).toBe(false); // hyphen not allowed
    expect(isSafeSceneName('Scene.Sub')).toBe(false);
  });

  it('rejects empty, over-long, and non-string input', () => {
    expect(isSafeSceneName('')).toBe(false);
    expect(isSafeSceneName('A'.repeat(300))).toBe(false);
    expect(isSafeSceneName(undefined)).toBe(false);
    expect(isSafeSceneName(null)).toBe(false);
    expect(isSafeSceneName(42)).toBe(false);
  });
});
