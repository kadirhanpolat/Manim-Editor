import type { SceneObject } from '@manim/codegen';

export interface PreviewNoteProject {
  objects: SceneObject[];
  sceneType?: '2d' | '3d' | string;
}

export function buildPreviewNotes(project: PreviewNoteProject): string[] {
  const notes: string[] = [];
  const objects = Array.isArray(project.objects) ? project.objects : [];

  if (objects.some((o) => o.type === 'text')) {
    notes.push('Text layout can differ from the final render.');
  }
  if (objects.some((o) => o.type === 'latex')) {
    notes.push("LaTeX uses the render container's math engine.");
  }
  if (project.sceneType === '3d') {
    notes.push('3D framing is an approximation of the final camera.');
  }
  if (
    objects.some(
      (o) =>
        !!o.gradient ||
        !!o.shadow ||
        (typeof o.cornerRadius === 'number' && Number.isFinite(o.cornerRadius) && o.cornerRadius > 0)
    )
  ) {
    notes.push('Gradient fills, rounded corners, and shadows are approximate in the preview.');
  }

  return notes;
}
