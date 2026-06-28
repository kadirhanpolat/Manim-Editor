import fs from 'fs/promises';
import path from 'path';
import type { RenderExt } from './renderFiles.js';

export interface RenderHistoryEntry {
  index: number;
  ext: RenderExt;
  name: string;
  size: number;
  modifiedAt: Date;
  url: string;
}

const ROTATED_RENDER_RE = /^render_(\d+)\.(mp4|gif|webm)$/;

export function parseRotatedRenderFilename(name: string): { index: number; ext: RenderExt } | null {
  const match = name.match(ROTATED_RENDER_RE);
  if (!match) return null;
  const index = Number(match[1]);
  if (!Number.isInteger(index) || index < 1) return null;
  return { index, ext: match[2] as RenderExt };
}

export async function listRotatedRenderHistory(
  rendersDir: string,
  projectId: string,
  basePath = '/api/renders'
): Promise<RenderHistoryEntry[]> {
  const entries = await fs.readdir(rendersDir).catch(() => []);
  const files = entries
    .map((name) => ({ name, parsed: parseRotatedRenderFilename(name) }))
    .filter((row): row is { name: string; parsed: { index: number; ext: RenderExt } } =>
      row.parsed !== null
    )
    .sort((a, b) => a.parsed.index - b.parsed.index);

  const history = await Promise.all(
    files.map(async ({ name, parsed }) => {
      const fPath = path.join(rendersDir, name);
      const stat = await fs.stat(fPath).catch(() => null);
      return stat
        ? {
            index: parsed.index,
            ext: parsed.ext,
            name,
            size: stat.size,
            modifiedAt: stat.mtime,
            url: `${basePath}/${projectId}/${name}`,
          }
        : null;
    })
  );

  return history.filter((item): item is RenderHistoryEntry => item !== null);
}
