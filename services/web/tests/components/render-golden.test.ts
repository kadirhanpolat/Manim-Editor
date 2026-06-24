/**
 * Golden-frame REGRESSION harness — guards our own Manim render output against
 * unintended drift over time. It renders a stable, geometric scene corpus to a
 * last-frame PNG, perceptually hashes it (dHash), and compares against a
 * committed baseline with a Hamming-distance tolerance.
 *
 * This is NOT cross-engine parity with the Konva preview (infeasible). It is
 * "did the Python we emit start producing a meaningfully different frame?" —
 * which catches codegen regressions an AST check and even a render-success
 * check (`render-integration.test.ts`) cannot see.
 *
 * Opt-in, same gate as the render-truth harness:
 *   RUN_MANIM_RENDER=1 npm run test:render
 * Re-baseline after an intentional render change (run on the maintainer's env):
 *   RUN_MANIM_RENDER=1 UPDATE_RENDER_BASELINE=1 npm run test:render
 *
 * The text/LaTeX scenes are deliberately excluded: their frames shift across
 * font/LaTeX versions, which would make the baseline brittle. Geometric scenes
 * are stable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DHASH = path.join(HERE, '..', 'helpers', 'dhash.py');
const BASELINE = path.join(HERE, '__render_baselines__', 'dhash.json');

const OPT_IN = process.env.RUN_MANIM_RENDER === '1';
const UPDATE = OPT_IN && process.env.UPDATE_RENDER_BASELINE === '1';

// Hash is 256-bit (16x16 dHash). Measured on the reference env: the SAME scene
// re-rendered → 0 bits different; two structurally-different scenes → ~23 bits.
// 8 leaves a wide margin for antialiasing noise while still catching real drift.
const HAMMING_THRESHOLD = 8;

function hasManim(): boolean {
  const r = spawnSync('manim --version', { shell: true, stdio: 'ignore' });
  return r.status === 0;
}

/** First interpreter that can `import PIL` (Pillow ships with Manim). */
function pythonWithPillow(): string | null {
  const candidates = [process.env.RENDER_PYTHON, 'python', 'python3'].filter(Boolean) as string[];
  for (const py of candidates) {
    const r = spawnSync(`${py} -c "import PIL"`, { shell: true, stdio: 'ignore' });
    if (r.status === 0) return py;
  }
  return null;
}

const PY = OPT_IN ? pythonWithPillow() : null;
const RUN = OPT_IN && hasManim() && PY !== null;

let tmpDir = '';

beforeAll(() => {
  if (!RUN) return;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manim-golden-'));
});

afterAll(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function findPng(dir: string): string | null {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const f = findPng(p);
      if (f) return f;
    } else if (e.name.toLowerCase().endsWith('.png')) {
      return p;
    }
  }
  return null;
}

/** Render the scene's last frame to PNG and return its dHash. */
function renderHash(name: string, py: string): string {
  const scene = (py.match(/class\s+(\w+)\s*\(/) || [])[1];
  if (!scene) throw new Error(`no scene class in generated code for "${name}"`);

  const file = path.join(tmpDir, `${name}.py`);
  const media = path.join(tmpDir, `${name}_media`);
  fs.writeFileSync(file, py, 'utf8');

  // -s already writes ONLY the last frame as a single PNG. Do NOT add
  // `--format png` — that switches Manim to a full per-frame PNG sequence, and
  // the first frame (pre-FadeIn) is blank, which findPng would grab.
  const cmd = `manim -ql -s --disable_caching --media_dir "${media}" "${file}" ${scene}`;
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', timeout: 180_000 });
  if (r.status !== 0) {
    throw new Error(`manim exited ${r.status} for "${name}":\n${(r.stderr || '').slice(-2000)}`);
  }

  const png = findPng(media);
  if (!png) throw new Error(`no PNG produced for "${name}" under ${media}`);

  const h = spawnSync(`${PY} "${DHASH}" "${png}"`, { shell: true, encoding: 'utf8' });
  if (h.status !== 0) throw new Error(`dhash failed for "${name}":\n${h.stderr || ''}`);
  return (h.stdout || '').trim();
}

/** Bit difference between two equal-length hex hashes. */
function hamming(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let c = 0;
  while (x > 0n) {
    c += Number(x & 1n);
    x >>= 1n;
  }
  return c;
}

function gen(setup: (s: ReturnType<typeof useProjectStore>) => void): string {
  setActivePinia(createPinia());
  const store = useProjectStore();
  store.newProject('P', 'visual');
  setup(store);
  // `-s` captures the LAST frame, but addObject's default object carries a
  // FadeOut exit animation that would blank it. Drop the exit so the reference
  // frame actually shows the geometry.
  for (const o of store.project.objects) o.exitAnim = 'none';
  return generateManimScript(store.project);
}

type Setup = (s: ReturnType<typeof useProjectStore>) => void;

// Stable geometric corpus (no text/LaTeX — those are font/version-fragile).
const CORPUS: { name: string; setup: Setup }[] = [
  {
    name: 'shapes',
    setup: (s) => {
      s.addObject('circle', 600, 540);
      s.addObject('square', 1000, 540);
      s.addObject('triangle', 1400, 540);
    },
  },
  {
    name: 'axes',
    setup: (s) => {
      s.addObject('axes', 960, 540);
    },
  },
  {
    name: 'three_d',
    setup: (s) => {
      s.setSceneType('3d');
      s.addObject('sphere', 0, 0);
      s.addObject('cube', 2, 0);
    },
  },
];

function readBaseline(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  } catch {
    return {};
  }
}

describe.skipIf(!RUN)('golden-frame: render output stays within tolerance of baseline', () => {
  it('self-check: dHash is deterministic per scene yet discriminates different scenes', () => {
    const circle = renderHash(
      'teeth_circle',
      gen((s) => s.addObject('circle', 960, 540))
    );
    const circle2 = renderHash(
      'teeth_circle2',
      gen((s) => s.addObject('circle', 960, 540))
    );
    const squares = renderHash(
      'teeth_squares',
      gen((s) => {
        s.addObject('square', 600, 300);
        s.addObject('square', 1300, 800);
      })
    );
    // Same scene re-rendered → within tolerance (baseline compares won't false-positive).
    expect(hamming(circle, circle2)).toBeLessThanOrEqual(HAMMING_THRESHOLD);
    // Structurally different scene → clearly beyond tolerance (the guard has teeth).
    expect(hamming(circle, squares)).toBeGreaterThan(HAMMING_THRESHOLD);
  });

  if (UPDATE) {
    it('re-baselines the golden corpus', () => {
      const next: Record<string, string> = {};
      for (const c of CORPUS) next[c.name] = renderHash(c.name, gen(c.setup));
      fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
      fs.writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      expect(Object.keys(next).length).toBe(CORPUS.length);
    });
  } else {
    const baseline = readBaseline();
    for (const c of CORPUS) {
      it(`matches baseline: ${c.name}`, () => {
        const ref = baseline[c.name];
        if (!ref) {
          throw new Error(
            `no baseline for "${c.name}". Seed it: RUN_MANIM_RENDER=1 UPDATE_RENDER_BASELINE=1 npm run test:render`
          );
        }
        const got = renderHash(c.name, gen(c.setup));
        const dist = hamming(ref, got);
        if (dist > HAMMING_THRESHOLD) {
          throw new Error(
            `render drift for "${c.name}": Hamming ${dist} > ${HAMMING_THRESHOLD} (baseline ${ref}, got ${got}). ` +
              `If intentional, re-baseline with UPDATE_RENDER_BASELINE=1.`
          );
        }
        expect(dist).toBeLessThanOrEqual(HAMMING_THRESHOLD);
      });
    }
  }
});
