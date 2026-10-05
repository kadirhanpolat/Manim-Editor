// @vitest-environment node
// UI language policy: every user-facing string in the editor is English
// (README "Roadmap" / production-readiness roadmap §11). Turkish text used to
// creep in through palette labels, default object names, tooltips and
// templates, and was patched at render time with string-matching maps. This
// guard scans the source instead: Turkish-specific letters may only appear in
// comments.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|vue)$/.test(name) ? [p] : [];
  });
}

function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--');
}

describe('UI language policy', () => {
  it('has no Turkish text outside comments in services/web/src', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (TURKISH.test(line) && !isComment(line)) {
            offenders.push(`${relative(SRC, file)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
