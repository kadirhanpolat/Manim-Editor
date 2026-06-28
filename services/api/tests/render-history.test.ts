import { describe, it, expect } from 'vitest';
import { parseRotatedRenderFilename } from '../src/util/renderHistory.js';

describe('render history helpers', () => {
  it('parses numbered render slots and rejects legacy names', () => {
    expect(parseRotatedRenderFilename('render_1.mp4')).toEqual({ index: 1, ext: 'mp4' });
    expect(parseRotatedRenderFilename('render_5.webm')).toEqual({ index: 5, ext: 'webm' });
    expect(parseRotatedRenderFilename('render_20260610_120000.mp4')).toBe(null);
    expect(parseRotatedRenderFilename('latest.mp4')).toBe(null);
  });
});
