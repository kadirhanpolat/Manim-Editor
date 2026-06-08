/**
 * Manim Python Code Generator — server wrapper over @manim/codegen.
 * Supplies server file paths for image/svg assets via resolveAsset.
 */
import { generateScene, objectCode, EASING_MAP } from '@manim/codegen';
import type { Project, SceneObject } from '@manim/codegen';

export function generatePythonCode(project: Project & { _assetMap?: Record<string, { filename?: string }> }, assetsPath: string): string {
  const assetMap = project._assetMap ?? {};
  const resolveAsset = (obj: SceneObject, ext: string): string => {
    const assetId = obj['assetId'] as string | undefined;
    const asset = assetId ? assetMap[assetId] : null;
    const filename =
      asset?.filename ??
      `${(obj.name ?? (ext === 'svg' ? 'asset' : 'image')).replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
    return `${assetsPath}/${filename}`;
  };
  return generateScene(project, { resolveAsset });
}

export { objectCode, EASING_MAP };
