import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function countLayerOpenTags(source: string) {
  return (source.match(/<v-layer\b/g) || []).length;
}

describe('StageCanvas layers', () => {
  it('keeps a single Konva layer in the source template', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/stage/StageCanvas.vue'), 'utf8');
    expect(countLayerOpenTags(source)).toBe(1);
  });
});
