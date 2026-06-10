import { describe, it, expect } from 'vitest';
import { pyMultiline } from '../src/helpers.js';
import { CODE_LANGUAGES } from '../src/constants.js';

describe('pyMultiline — single-line Python string escaping', () => {
  it('escapes newlines to \\n', () => {
    expect(pyMultiline('a\nb')).toBe('a\\nb');
  });
  it('escapes double quotes', () => {
    expect(pyMultiline('say "hi"')).toBe('say \\"hi\\"');
  });
  it('escapes backslashes BEFORE everything else (no double-processing)', () => {
    expect(pyMultiline('back\\slash')).toBe('back\\\\slash');
    // literal backslash followed by the letter n must NOT collapse into a newline escape
    expect(pyMultiline('a\\nb')).toBe('a\\\\nb');
  });
  it('escapes tabs and normalizes CRLF to \\n', () => {
    expect(pyMultiline('tab\there')).toBe('tab\\there');
    expect(pyMultiline('a\r\nb')).toBe('a\\nb');
    expect(pyMultiline('a\rb')).toBe('a\\nb');
  });
  it('null/undefined → empty string', () => {
    expect(pyMultiline(null)).toBe('');
    expect(pyMultiline(undefined)).toBe('');
  });
});

describe('CODE_LANGUAGES allowlist', () => {
  it('contains exactly the 9 spec languages', () => {
    expect([...CODE_LANGUAGES]).toEqual([
      'python',
      'javascript',
      'typescript',
      'c',
      'cpp',
      'java',
      'html',
      'css',
      'bash',
    ]);
  });
});
