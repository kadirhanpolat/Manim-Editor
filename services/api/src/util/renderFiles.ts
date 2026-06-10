/**
 * Render output file helpers — the extension allowlist shared by the
 * renders routes. Must stay in sync with FORMAT_EXT in
 * services/renderer/render_args.py (worker side).
 */

export const RENDER_EXTS = ['mp4', 'gif', 'webm'] as const;
export type RenderExt = (typeof RENDER_EXTS)[number];

const CONTENT_TYPES: Record<RenderExt, string> = {
  mp4: 'video/mp4',
  gif: 'image/gif',
  webm: 'video/webm',
};

export function isRenderExt(value: string): value is RenderExt {
  return (RENDER_EXTS as readonly string[]).includes(value);
}

export function contentTypeFor(ext: RenderExt): string {
  return CONTENT_TYPES[ext];
}

// Same shape as the previous inline /^[\w.-]+\.mp4$/ guard, widened to the
// allowlisted extensions. \w.- cannot express a path separator or "..%2f".
const RENDER_FILE_RE = /^[\w.-]+\.(mp4|gif|webm)$/;

export function isRenderFilename(name: string): boolean {
  return RENDER_FILE_RE.test(name);
}
