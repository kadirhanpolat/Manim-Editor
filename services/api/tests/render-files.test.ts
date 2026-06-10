/**
 * Extension allowlist for serving render output (mp4/gif/webm).
 * Must stay in sync with FORMAT_EXT in services/renderer/render_args.py.
 */

import { describe, it, expect } from 'vitest';
import {
  RENDER_EXTS,
  isRenderExt,
  contentTypeFor,
  isRenderFilename,
} from '../src/util/renderFiles.js';

describe('renderFiles helpers', () => {
  it('allowlists exactly mp4, gif, webm, zip', () => {
    expect([...RENDER_EXTS]).toEqual(['mp4', 'gif', 'webm', 'zip']);
    expect(isRenderExt('mp4')).toBe(true);
    expect(isRenderExt('webm')).toBe(true);
    expect(isRenderExt('zip')).toBe(true);
    expect(isRenderExt('mov')).toBe(false);
    expect(isRenderExt('mp4/..')).toBe(false);
  });

  it('maps extensions to content types', () => {
    expect(contentTypeFor('mp4')).toBe('video/mp4');
    expect(contentTypeFor('gif')).toBe('image/gif');
    expect(contentTypeFor('webm')).toBe('video/webm');
    expect(contentTypeFor('zip')).toBe('application/zip');
  });

  it('accepts history filenames for all three formats, rejects traversal/other', () => {
    expect(isRenderFilename('render_20260610_120000.mp4')).toBe(true);
    expect(isRenderFilename('render_20260610_120000.gif')).toBe(true);
    expect(isRenderFilename('latest.webm')).toBe(true);
    expect(isRenderFilename('latest.zip')).toBe(true);
    expect(isRenderFilename('render_x.mov')).toBe(false);
    expect(isRenderFilename('../escape.mp4')).toBe(false);
    expect(isRenderFilename('a/b.mp4')).toBe(false);
  });
});
