import { describe, expect, it } from 'vitest';
import { buildPreviewNotes } from '../../src/components/render/preview-notes.js';

describe('buildPreviewNotes', () => {
  it('describes the main accepted preview divergences', () => {
    const notes = buildPreviewNotes({
      sceneType: '3d',
      objects: [
        { type: 'text' } as never,
        { type: 'latex' } as never,
        { type: 'rectangle', gradient: { colors: ['#000000', '#ffffff'] } } as never,
        { type: 'circle', shadow: { color: '#000000', opacity: 0.5 } } as never,
      ],
    });

    expect(notes).toContain('Text layout can differ from the final render.');
    expect(notes).toContain("LaTeX uses the render container's math engine.");
    expect(notes).toContain('3D framing is an approximation of the final camera.');
    expect(notes).toContain(
      'Gradient fills, rounded corners, and shadows are approximate in the preview.'
    );
  });

  it('stays quiet for a plain 2D project', () => {
    expect(buildPreviewNotes({ sceneType: '2d', objects: [] })).toEqual([]);
  });
});
