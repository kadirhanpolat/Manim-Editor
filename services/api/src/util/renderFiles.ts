/**
 * Render output file helpers — the extension allowlist shared by the
 * render routes and the serve/download endpoints.
 *
 * Keep FORMAT_EXT in render_args.py in sync with RENDER_EXTS here.
 */

export const RENDER_EXTS = ['mp4', 'gif', 'webm', 'zip'] as const;
export type RenderExt = (typeof RENDER_EXTS)[number];

const CONTENT_TYPES: Record<RenderExt, string> = {
  mp4: 'video/mp4',
  gif: 'image/gif',
  webm: 'video/webm',
  zip: 'application/zip',
};

export function isRenderExt(s: unknown): s is RenderExt {
  return RENDER_EXTS.includes(s as RenderExt);
}

export function contentTypeFor(ext: RenderExt): string {
  return CONTENT_TYPES[ext];
}

// Allowlisted extensions. \w.- cannot express a path separator or "..%2f".
const RENDER_FILE_RE = /^[\w.-]+\.(mp4|gif|webm|zip)$/;

export function isRenderFilename(name: string): boolean {
  return RENDER_FILE_RE.test(name);
}
