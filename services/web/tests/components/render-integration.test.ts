/**
 * Render-truth harness — proves the Python we generate actually renders in a
 * real Manim CE process, not merely that it is AST-valid (that is
 * `codegen-python-validity.test.ts`'s job). Catches wrong API calls, runtime
 * TypeErrors, and constructors that parse but explode at construct() time.
 *
 * Heavy + slow (a real Manim import is ~3-5 s per call), so it is OPT-IN:
 * it runs only when `RUN_MANIM_RENDER=1` AND `manim` is on PATH. The standard
 * `npm run test:unit` suite never touches it; `npm run test:render` opts in.
 *
 *   RUN_MANIM_RENDER=1 npm run test:render            # from services/web
 *
 * Non-goal: pixel parity with the Konva preview (different rasterizers/fonts —
 * a pixel diff would be all noise). This asserts the render *succeeds*.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import { generateManimScript } from '../../src/export/manim.js';

const OPT_IN = process.env.RUN_MANIM_RENDER === '1';

function hasManim(): boolean {
  try {
    const r = spawnSync('manim --version', { shell: true, stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

// `&&` short-circuits: hasManim() (which spawns a process) only runs when opted in,
// so the default test run pays nothing for this file existing.
const RUN = OPT_IN && hasManim();

let tmpDir = '';

beforeAll(() => {
  if (!RUN) return;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manim-render-'));
});

afterAll(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

interface RenderResult {
  status: number | null;
  stderr: string;
}

/** Write `py` to a temp file and render its single scene's last frame. */
function render(name: string, py: string): RenderResult {
  const scene = (py.match(/class\s+(\w+)\s*\(/) || [])[1];
  if (!scene) throw new Error(`no scene class found in generated code for "${name}"`);

  const file = path.join(tmpDir, `${name}.py`);
  const media = path.join(tmpDir, `${name}_media`);
  fs.writeFileSync(file, py, 'utf8');

  // -s renders only the last frame (fast); -ql = 480p15; isolated media dir.
  // shell:true with a single command STRING (not an args array) sidesteps the
  // DEP0190 arg-escaping warning; media/file are quoted and scene is /\w+/.
  const cmd = `manim -ql -s --disable_caching --media_dir "${media}" "${file}" ${scene}`;
  const res = spawnSync(cmd, { shell: true, encoding: 'utf8', timeout: 180_000 });
  return { status: res.status, stderr: res.stderr || '' };
}

/** Build a project via the real store (full defaults) and generate its script. */
function gen(setup: (s: ReturnType<typeof useProjectStore>) => void): string {
  setActivePinia(createPinia());
  const store = useProjectStore();
  store.newProject('P', 'visual');
  setup(store);
  return generateManimScript(store.project);
}

type Setup = (s: ReturnType<typeof useProjectStore>) => void;

// Data-driven corpus — adding render coverage for a feature is one row.
const CORPUS: { name: string; setup: Setup }[] = [
  {
    name: 'shapes_move',
    setup: (s) => {
      s.addObject('circle', 800, 540);
      s.addObject('square', 1100, 540);
      s.selectObject(s.project.objects[0].id);
      s.createAnimation('move', { targetX: 400, targetY: 300 });
    },
  },
  {
    name: 'text_latex',
    setup: (s) => {
      s.addObject('text', 700, 400);
      s.addObject('latex', 1100, 600);
    },
  },
  {
    name: 'axes',
    setup: (s) => {
      s.addObject('axes', 960, 540);
    },
  },
  {
    name: 'emphasis_circumscribe',
    setup: (s) => {
      s.addObject('rectangle', 960, 540);
      s.selectObject(s.project.objects[0].id);
      s.createAnimation('circumscribe', {
        color: '#FFFF00',
        shape: 'Rectangle',
        fade_out: false,
        time_width: 0.3,
      });
    },
  },
  {
    name: 'sections',
    setup: (s) => {
      s.addObject('circle', 960, 540);
      s.selectObject(s.project.objects[0].id);
      s.createAnimation('move', { targetX: 300, targetY: 200 });
      s.addSection(0, 'Intro');
      s.addSection(1, 'Outro');
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

describe.skipIf(!RUN)('render-truth: generated Python renders in real Manim', () => {
  it('self-check: a scene that raises at construct() fails to render (harness has teeth)', () => {
    const broken =
      'from manim import *\n\nclass Broken(Scene):\n    def construct(self):\n        raise ValueError("boom")\n';
    const r = render('selfcheck_broken', broken);
    expect(r.status).not.toBe(0);
  });

  for (const c of CORPUS) {
    it(`renders: ${c.name}`, () => {
      const r = render(c.name, gen(c.setup));
      if (r.status !== 0) {
        throw new Error(
          `manim exited ${r.status} for "${c.name}". Last stderr:\n${r.stderr.slice(-2000)}`
        );
      }
      expect(r.status).toBe(0);
    });
  }
});
