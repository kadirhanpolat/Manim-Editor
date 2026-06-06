/**
 * Manim Python Code Generator — server wrapper over @manim/codegen.
 * Supplies server file paths for image/svg assets via resolveAsset.
 */
import { generateScene, objectCode, EASING_MAP } from '@manim/codegen';

export function generatePythonCode(project, assetsPath) {
  const assetMap = project._assetMap || {};
  const resolveAsset = (obj, ext) => {
    const asset = obj.assetId ? assetMap[obj.assetId] : null;
    const filename = asset?.filename
      || `${(obj.name || (ext === 'svg' ? 'asset' : 'image')).replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
    return `${assetsPath}/${filename}`;
  };
  return generateScene(project, { resolveAsset });
}

export { objectCode, EASING_MAP };
