/**
 * Project Normalizer — v2
 *
 * Applies defaults, clamps values, and prepares the new project schema
 * (stage/objects/tracks/clips/assets) for code generation.
 */

import type { Project } from '@manim/codegen';

/**
 * Normalized project: full Project shape plus _assetMap for codegen.
 */
export type NormalizedProject = Project & {
  _assetMap: Record<string, { id: string; filename?: string; [k: string]: unknown }>;
};

/**
 * Normalize a validated project.
 */
export function normalizeProject(project: unknown): NormalizedProject {
  const norm = JSON.parse(JSON.stringify(project)) as Record<string, unknown>; // deep clone

  const stage = (norm['stage'] as Record<string, unknown> | undefined) ?? {};

  // ── Stage ──
  norm['stage'] = {
    width: (stage['width'] as number | undefined) ?? 1920,
    height: (stage['height'] as number | undefined) ?? 1080,
    backgroundColor: (stage['backgroundColor'] as string | undefined) ?? '#000000',
    ...stage,
  };

  const normStage = norm['stage'] as { width: number; height: number };

  // ── Objects ──
  const objects = (norm['objects'] as Record<string, unknown>[] | undefined) ?? [];
  norm['objects'] = objects.map((obj) => ({
    ...obj,
    x: (obj['x'] as number | undefined) ?? normStage.width / 2,
    y: (obj['y'] as number | undefined) ?? normStage.height / 2,
    width: Math.max(1, (obj['width'] as number | undefined) ?? 120),
    height: Math.max(1, (obj['height'] as number | undefined) ?? 120),
    rotation: (obj['rotation'] as number | undefined) ?? 0,
    opacity: clamp((obj['opacity'] as number | undefined) ?? 1, 0, 1),
    enterTime: Math.max(0, (obj['enterTime'] as number | undefined) ?? 0),
    duration: Math.max(0.1, (obj['duration'] as number | undefined) ?? 3),
    enterAnim: (obj['enterAnim'] as string | undefined) ?? 'fade_in',
    exitAnim: (obj['exitAnim'] as string | undefined) ?? 'fade_out',
    enterAnimDur: Math.max(0.1, (obj['enterAnimDur'] as number | undefined) ?? 0.5),
    exitAnimDur: Math.max(0.1, (obj['exitAnimDur'] as number | undefined) ?? 0.5),
  }));

  // ── Groups ──
  const groups = (norm['groups'] as Record<string, unknown>[] | undefined) ?? [];
  norm['groups'] = groups.map((g) => ({
    ...g,
    childIds: (g['childIds'] as unknown[] | undefined) ?? [],
    margin: (g['margin'] as number | undefined) ?? 10,
  }));

  // ── Asset lookup map ──
  const assetMap: Record<string, { id: string; filename?: string; [k: string]: unknown }> = {};
  for (const asset of (norm['assets'] as Array<{ id: string; filename?: string; [k: string]: unknown }> | undefined) ?? []) {
    assetMap[asset.id] = asset;
  }
  norm['_assetMap'] = assetMap;

  // ── Tracks & clips ──
  const tracks = (norm['tracks'] as Record<string, unknown>[] | undefined) ?? [];
  norm['tracks'] = tracks.map((track) => ({
    ...track,
    clips: ((track['clips'] as Record<string, unknown>[] | undefined) ?? []).map((clip) => ({
      ...clip,
      startTime: Math.max(0, (clip['startTime'] as number | undefined) ?? 0),
      duration: Math.max(0.1, (clip['duration'] as number | undefined) ?? 1.5),
      easing: (clip['easing'] as string | undefined) ?? 'ease_in_out',
      params: (clip['params'] as Record<string, unknown> | undefined) ?? {},
    })),
  }));

  return norm as unknown as NormalizedProject;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export { normalizeProject as default };
