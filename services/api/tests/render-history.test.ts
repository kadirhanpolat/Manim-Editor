import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { listRotatedRenderHistory, parseRotatedRenderFilename } from '../src/util/renderHistory.js';

describe('render history helpers', () => {
  it('parses numbered render slots and rejects legacy names', () => {
    expect(parseRotatedRenderFilename('render_1.mp4')).toEqual({ index: 1, ext: 'mp4' });
    expect(parseRotatedRenderFilename('render_5.webm')).toEqual({ index: 5, ext: 'webm' });
    expect(parseRotatedRenderFilename('render_2.zip')).toEqual({ index: 2, ext: 'zip' });
    expect(parseRotatedRenderFilename('render_20260610_120000.mp4')).toBe(null);
    expect(parseRotatedRenderFilename('latest.mp4')).toBe(null);
  });

  it('lists rotated zip history entries', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'render-history-'));
    try {
      const file = path.join(dir, 'render_1.zip');
      await fs.writeFile(file, 'zip');

      const history = await listRotatedRenderHistory(dir, 'project-a');

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        index: 1,
        ext: 'zip',
        name: 'render_1.zip',
        url: '/api/renders/project-a/render_1.zip',
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
