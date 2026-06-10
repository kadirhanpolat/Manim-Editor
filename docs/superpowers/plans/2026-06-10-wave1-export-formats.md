# Wave 1 Track B — Export Formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user choose render format (MP4/GIF/WebM), resolution (854×480/1280×720/1920×1080/2560×1440/3840×2160), and fps (15/30/60), end-to-end from a new `RenderOptionsDialog.vue` through the API/Redis job into the manim argv and back out through an extension-aware download URL — with the default combo producing byte-identical behavior to today.
**Branch:** feat/wave1-export-formats (worktree+branch created by the orchestrator)
**Architecture:** A flat `{ format, resolution, fps }` options object travels: Vue dialog (v-model) → `App.vue startRender` → Pinia `store.renderOnServer(options)` → `POST /api/projects/:id/render[-code]` (zod **enum allowlist** in `compiler/validator.ts`; invalid → 400 `{ error }`) → Redis job JSON `options` field → `services/renderer/render_args.py` maps the validated enums to manim CLI flags via **fixed dict lookups** (never string-formatted into argv) → worker writes `latest.<ext>` → `renders.ts` serves `latest.:ext` with the right Content-Type → store builds the download URL with the chosen extension. WS progress events and the render rate-limit are untouched.
**Tech Stack:** Vue 3 `<script setup lang="ts">` + Pinia (web), Express 4 + zod 3 + redis (api, run via tsx, tested with vitest), Python 3 stdlib (renderer worker), Docker.

---

## Primer for a zero-context engineer

### Current render pipeline (verified 2026-06-10)

1. **Web** — `services/web/src/App.vue` line 421 `@click="startRender"` → fn at line 1055 calls `store.renderOnServer(selectedQuality.value)`. A quality selector (`qualities` array, lines 785–791: low/medium/high/production/4k) sits inside the render dialog at lines 388–405. Render state is exposed to the template via `computed(() => store.X)` wrappers around lines 815–820.
2. **Store** — `services/web/src/store/project.ts` line 1892 `renderOnServer(quality = 'high')` → saves project, then `api.projects.render(projectId, quality)` (visual) or `api.projects.renderCode(...)` (code mode), then `_startPollRender` (line 1928) subscribes over WebSocket and on `completed` sets `this.renderVideoUrl = api.renders.getLatestUrl(projectId)` (line 1937).
3. **API client** — `services/web/src/api.ts`: `projects.render` (line 56) POSTs `{ quality }`; `renders.getLatestUrl` (line 126) returns `` `${API_BASE}/renders/${projectId}/latest.mp4?t=${Date.now()}` `` — **this is where the download-extension assumption lives on the client**.
4. **API routes** — `services/api/src/routes/projects.ts`: `POST /:id/render` (line 224, reads `body.quality ?? 'medium'`, compiles project, writes `scene.py`, `enqueueRenderJob` at line 255) and `POST /:id/render-code` (line 281, validates `sceneName` with `isSafeSceneName`, enqueue at line 311). `services/api/src/queue.ts` defines `RenderJob` (line 25) and `enqueueRenderJob` (line 44: `hSet render:job:<id>` + `rPush render:queue` with the JSON job).
5. **Worker** — `services/renderer/worker.py`: `QUALITY_FLAGS` dict (line 32, `high → -qh`), `render_job` builds `cmd = ["manim", quality_flag, scene_file, scene_name, "--media_dir", media_dir, "--flush_cache"]` (line 100 — list-form subprocess, no shell), `find_output_video` (line 41) globs `**/{scene_name}.mp4`, copies to `latest.mp4` (line 71/131) and history `render_<ts>.mp4` (line 138), prunes by `.endswith(".mp4")` (line 146) — **this is where the extension assumption lives server-side**.
6. **Serving** — `services/api/src/routes/renders.ts`: rate-limit (5/min, lines 24–33 — keep), `GET /:projectId/latest.mp4` (line 39, hardcoded path + `video/mp4` + Range support), `GET /:projectId` (line 88, history filter `endsWith('.mp4')`), `GET /:projectId/:filename` (line 154, regex `/^[\w.-]+\.mp4$/`).
7. **WS** — `services/api/src/ws.ts` polls the `render:job:<id>` Redis hash and relays it verbatim. It is field-agnostic → **no change needed**; do not touch this file.

### manim CLI flag semantics (verified via context7 `/manimcommunity/manim`, 2026-06-10)

- `--format=gif` and `--format=webm` are documented CLI options (`output_and_config.rst`: "To generate .gif files instead, use the --format gif flag. The output .gif files will be saved in the same directory and have the same base name as their .mp4 counterparts"; FAQ shows `manim --format=webm -t scene.py SceneName`). MP4 is the default — no flag.
- Quality presets: `-ql` = 854×480@15, `-qm` = 1280×720@30, `-qh` = 1920×1080@60, `-qp` = 2560×1440@60, `-qk` = 3840×2160@60. Output dir name derives from height+fps (`480p15`, `1080p60`, …), so a custom `-r/--fps` combo lands in e.g. `720p60` — irrelevant for us because `find_output_video` globs recursively.
- **NOT directly confirmed by context7** (fall-back to model knowledge, marked for runtime check): the exact `-r "W,H"` comma syntax and the precedence rule that explicit `-r`/`--fps` override a `-q` preset (in `ManimConfig.digest_args` quality is digested before the explicit resolution/fps args, so explicit flags win). **Verify at execution time with `docker compose run --rm renderer manim render --help`** before trusting non-preset combos. The design minimizes exposure: the three preset-matching combos emit a single `-q*` flag and never use `-r`/`--fps` at all.
- GIF filename: docs say same base name (`MainScene.gif`); some CE versions append `_ManimCE_v<version>`. The worker glob gets a `{scene_name}*.{ext}` fallback to tolerate both.

### Argv mapping (fixed lookup — the contract every task must agree on)

Flags are inserted between `manim` and the scene file. `options` values are already enum-validated by the API; the worker maps them through fixed dicts only.

| options (format · resolution · fps) | argv flag segment |
|---|---|
| mp4 · 1920x1080 · 60 *(default)* | `-qh` — **byte-identical to today's argv** |
| any · 854x480 · 15 | `-ql` (+ format flag) |
| any · 1280x720 · 30 | `-qm` (+ format flag) |
| any · 2560x1440 · 60 | `-qp` (+ format flag) |
| any · 3840x2160 · 60 | `-qk` (+ format flag) |
| any non-preset combo, e.g. 1280x720 · 60 | `-qh -r 1280,720 --fps 60` (+ format flag) |
| format gif | append `--format gif` |
| format webm | append `--format webm` |
| format mp4 | append nothing |
| legacy payload without `options` (old clients) | single `QUALITY_FLAGS[quality]` flag — unchanged behavior |

### Shared option vocabulary (must match everywhere)

- `format`: `'mp4' | 'gif' | 'webm'`
- `resolution`: `'854x480' | '1280x720' | '1920x1080' | '2560x1440' | '3840x2160'` (string keys, lowercase `x`)
- `fps`: `15 | 30 | 60` (JSON numbers, NOT strings)
- Defaults: `{ format: 'mp4', resolution: '1920x1080', fps: 60 }`
- Wire shape: **flat** in the POST body (`{ quality, format, resolution, fps, ... }`), **nested** as `options: {format,resolution,fps}` in the Redis job JSON.

### Deliberate behavior notes (decided here, do not re-litigate during execution)

- The old quality selector (low/medium/high/production/4k) in `App.vue` is **replaced** by the new selectors. The resolution allowlist has **5 entries** (orchestrator deviation from the spec's 3 — the existing UI already offered 2K/4K, so dropping them would be a feature regression): 854x480, 1280x720, 1920x1080, 2560x1440, 3840x2160. 2560x1440@60 → `-qp`, 3840x2160@60 → `-qk`; other 2K/4K fps combos go through the `-qh -r W,H --fps N` fallback. The API/worker still accept legacy `{ quality }` payloads (incl. `production`/`4k`), so nothing breaks for old payloads. PNG sequence, transparent WebM, and scene sections are out of scope (Wave 2).
- `App.vue` additionally needs two attribute-level edits in the render-dialog "completed" section (lines ~511–524): GIF can't play in `<video>` (needs an `<img>` branch) and the `download="render.mp4"` attribute must follow the format. These live in the same render-dialog region (not touched by Track D), keep the diff minimal, and are required by the spec line "the download link/extension follows the chosen format".
- Both render endpoints (`/render` and `/render-code`) accept the options — the same dialog drives code-mode renders.
- Test commands below run from the **worktree root** unless a `cd` is given. `python` must be on PATH for Task 4's verification (the repo's codegen-python-validity test already assumes this).

---

### Task 1: API — zod render-options allowlist (`parseRenderOptions`)

**Files:**
- Modify: `services/api/src/compiler/validator.ts` (append after the `export { ProjectSchema };` line 167)
- Test: `services/api/tests/render-options.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/api/tests/render-options.test.ts`:

```ts
/**
 * Render export options — zod enum allowlist.
 * Values are NEVER interpolated into manim argv; this allowlist is the
 * argument-injection gate (same posture as isSafeSceneName).
 */

import { describe, it, expect } from 'vitest';
import { parseRenderOptions } from '../src/compiler/validator.js';

describe('parseRenderOptions', () => {
  it('defaults to mp4 / 1920x1080 / 60 when fields are absent', () => {
    const r = parseRenderOptions({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options).toEqual({ format: 'mp4', resolution: '1920x1080', fps: 60 });
  });

  it('accepts every allowlisted combination (3 formats x 5 resolutions x 3 fps)', () => {
    for (const format of ['mp4', 'gif', 'webm'] as const) {
      for (const resolution of ['854x480', '1280x720', '1920x1080', '2560x1440', '3840x2160'] as const) {
        for (const fps of [15, 30, 60] as const) {
          const r = parseRenderOptions({ format, resolution, fps });
          expect(r.ok).toBe(true);
          if (r.ok) expect(r.options).toEqual({ format, resolution, fps });
        }
      }
    }
  });

  it('rejects an unknown format with a message naming the field', () => {
    const r = parseRenderOptions({ format: 'mov' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/format/);
  });

  it('rejects argv-injection shaped values', () => {
    expect(parseRenderOptions({ resolution: '--config_file=/etc/evil' }).ok).toBe(false);
    expect(parseRenderOptions({ format: '--format gif; rm -rf /' }).ok).toBe(false);
  });

  it('rejects fps sent as a string or a non-allowlisted number', () => {
    expect(parseRenderOptions({ fps: '60' }).ok).toBe(false);
    expect(parseRenderOptions({ fps: 24 }).ok).toBe(false);
  });

  it('ignores unrelated body fields (quality/codeSource passthrough)', () => {
    const r = parseRenderOptions({ quality: 'high', codeSource: 'from manim import *' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options.format).toBe('mp4');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `npm test --workspace services/api -- tests/render-options.test.ts`
  Expected failure: `SyntaxError: The requested module '../src/compiler/validator.js' does not provide an export named 'parseRenderOptions'` (the module exists; the export does not).

- [ ] **Step 3: Minimal implementation** — append to `services/api/src/compiler/validator.ts` (after `export { ProjectSchema };`):

```ts
// ─── Render export options (Wave 1 Track B) ──────────────────────────────────
// Strict enum allowlist: these values are forwarded (via a fixed lookup table
// in services/renderer/render_args.py) to the manim CLI. NEVER widen these to
// free-form strings — that would reopen the argument-injection surface that
// isSafeSceneName closes for sceneName.

export const RenderOptionsSchema = z.object({
  format: z.enum(['mp4', 'gif', 'webm']).default('mp4'),
  resolution: z.enum(['854x480', '1280x720', '1920x1080', '2560x1440', '3840x2160']).default('1920x1080'),
  fps: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(60),
});

export type RenderOptions = z.infer<typeof RenderOptionsSchema>;

export type ParseRenderOptionsResult =
  | { ok: true; options: RenderOptions }
  | { ok: false; error: string };

/**
 * Pick + validate { format, resolution, fps } from a request body.
 * Absent fields fall back to today's behavior (mp4 / 1920x1080 / 60 = -qh).
 * Unrelated body fields (quality, codeSource, sceneName) are ignored.
 */
export function parseRenderOptions(body: unknown): ParseRenderOptionsResult {
  const src = (body ?? {}) as Record<string, unknown>;
  const result = RenderOptionsSchema.safeParse({
    format: src['format'],
    resolution: src['resolution'],
    fps: src['fps'],
  });
  if (!result.success) {
    const msg = result.error.errors
      .map((e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    return { ok: false, error: `Invalid render options — ${msg}` };
  }
  return { ok: true, options: result.data };
}
```

- [ ] **Step 4: Run test, expect PASS** — `npm test --workspace services/api -- tests/render-options.test.ts` (6 tests pass). Also run the full api suite to confirm no regression: `npm test --workspace services/api` (43 existing + 6 new).

- [ ] **Step 5: Commit**
  ```
  npx prettier --write services/api/src/compiler/validator.ts services/api/tests/render-options.test.ts
  git add services/api/src/compiler/validator.ts services/api/tests/render-options.test.ts
  git commit -m "feat(api): zod enum allowlist for render export options" -m "format mp4|gif|webm, resolution 854x480|1280x720|1920x1080|2560x1440|3840x2160, fps 15|30|60; defaults preserve today's -qh behavior. Values are never interpolated into argv." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 2: API — render endpoints accept options; Redis job carries them

**Files:**
- Modify: `services/api/src/queue.ts` (RenderJob interface line 25; `enqueueRenderJob` hSet line 48)
- Modify: `services/api/src/routes/projects.ts` (`POST /:id/render` lines 224–267; `POST /:id/render-code` lines 281–323)
- Test: `services/api/tests/render-options.test.ts` (extend)

- [ ] **Step 1: Write the failing test** — append to `services/api/tests/render-options.test.ts` (top of file gains one import):

```ts
import type { RenderJob } from '../src/queue.js';
```

and at the bottom a new describe block:

```ts
describe('RenderJob payload shape', () => {
  it('carries validated options nested under "options" in the redis job JSON', () => {
    const parsed = parseRenderOptions({ format: 'gif', resolution: '854x480', fps: 15 });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const job: RenderJob = {
      jobId: 'job_test1234',
      projectId: 'p1',
      sceneFile: 'projects/p1/scene.py',
      sceneName: 'MainScene',
      quality: 'high',
      options: parsed.options,
    };
    expect(JSON.parse(JSON.stringify(job)).options).toEqual({
      format: 'gif',
      resolution: '854x480',
      fps: 15,
    });
  });
});
```

- [ ] **Step 2: Run gate, expect FAIL** — vitest transpiles without typechecking, so the failing gate here is `npm run typecheck` (repo root).
  Expected failure: `error TS2353: Object literal may only specify known properties, and 'options' does not exist in type 'RenderJob'` in `services/api/tests/render-options.test.ts`.
  (Note: `import type` is erased at runtime, so importing `queue.js` in a test never opens a Redis connection.)

- [ ] **Step 3: Minimal implementation**

In `services/api/src/queue.ts`, add the type import at the top and extend the interface + job record:

```ts
import type { RenderOptions } from './compiler/validator.js';
```

```ts
export interface RenderJob {
  jobId: string;
  projectId: string;
  sceneFile: string;
  sceneName: string;
  quality?: string;
  /** Validated export options (Wave 1 Track B). Absent on legacy payloads. */
  options?: RenderOptions;
}
```

In `enqueueRenderJob`, extend the `hSet` record (the full JSON job already flows through `rPush` unchanged — `options` rides along automatically; the hash fields are for status consumers/debugging and are relayed verbatim by ws.ts, which the client ignores):

```ts
  await redis.hSet(`render:job:${job.jobId}`, {
    status: 'queued',
    projectId: job.projectId,
    quality: job.quality ?? 'medium',
    format: job.options?.format ?? 'mp4',
    resolution: job.options?.resolution ?? '1920x1080',
    fps: String(job.options?.fps ?? 60),
    createdAt: new Date().toISOString(),
  });
```

In `services/api/src/routes/projects.ts`, add to the imports:

```ts
import { parseRenderOptions } from '../compiler/validator.js';
```

In `POST /:id/render` (line 224), replace the body parsing head:

```ts
    const body = (req.body ?? {}) as { quality?: string };
    const quality = body.quality ?? 'medium';
    const projectId = req.params['id'];

    const parsedOptions = parseRenderOptions(req.body);
    if (!parsedOptions.ok) {
      return void res.status(400).json({ error: parsedOptions.error });
    }
```

and extend its `enqueueRenderJob` call (line 255):

```ts
    await enqueueRenderJob({
      jobId,
      projectId,
      sceneFile: `projects/${projectId}/scene.py`,
      sceneName: 'MainScene',
      quality,
      options: parsedOptions.options,
    });
```

In `POST /:id/render-code` (line 281), after the `isSafeSceneName` check (line 295–299) add:

```ts
    const parsedOptions = parseRenderOptions(req.body);
    if (!parsedOptions.ok) {
      return void res.status(400).json({ error: parsedOptions.error });
    }
```

and extend its `enqueueRenderJob` call (line 311):

```ts
    await enqueueRenderJob({
      jobId,
      projectId,
      sceneFile: `projects/${projectId}/scene.py`,
      sceneName,
      quality,
      options: parsedOptions.options,
    });
```

- [ ] **Step 4: Run gate, expect PASS** — `npm run typecheck` (repo root) passes, then `npm test --workspace services/api` (all api tests incl. the new describe pass).
  Note on coverage: there is deliberately no HTTP-level route test — the api test suite is pure-function only (no supertest dependency; adding one would require the `root_node_modules` Docker volume dance). Validation behavior is covered by Task 1's tests (the route returns `parsedOptions.error` verbatim as `{ error }` with status 400); wiring is covered by typecheck + Task 9's optional docker smoke.

- [ ] **Step 5: Commit**
  ```
  npx prettier --write services/api/src/queue.ts services/api/src/routes/projects.ts services/api/tests/render-options.test.ts
  git add services/api/src/queue.ts services/api/src/routes/projects.ts services/api/tests/render-options.test.ts
  git commit -m "feat(api): render endpoints accept export options; redis job carries them" -m "Both /render and /render-code validate { format, resolution, fps } via parseRenderOptions (400 { error } on invalid) and nest the validated options in the RenderJob JSON. Legacy quality field untouched; render rate-limit and ws.ts untouched." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3: API — extension-aware render file serving

**Files:**
- Create: `services/api/src/util/renderFiles.ts`
- Modify: `services/api/src/routes/renders.ts` (latest route line 39; list route lines 98–113; filename route line 158)
- Test: `services/api/tests/render-files.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/api/tests/render-files.test.ts`:

```ts
/**
 * Extension allowlist for serving render output (mp4/gif/webm).
 * Must stay in sync with FORMAT_EXT in services/renderer/render_args.py.
 */

import { describe, it, expect } from 'vitest';
import {
  RENDER_EXTS,
  isRenderExt,
  contentTypeFor,
  isRenderFilename,
} from '../src/util/renderFiles.js';

describe('renderFiles helpers', () => {
  it('allowlists exactly mp4, gif, webm', () => {
    expect([...RENDER_EXTS]).toEqual(['mp4', 'gif', 'webm']);
    expect(isRenderExt('mp4')).toBe(true);
    expect(isRenderExt('webm')).toBe(true);
    expect(isRenderExt('mov')).toBe(false);
    expect(isRenderExt('mp4/..')).toBe(false);
  });

  it('maps extensions to content types', () => {
    expect(contentTypeFor('mp4')).toBe('video/mp4');
    expect(contentTypeFor('gif')).toBe('image/gif');
    expect(contentTypeFor('webm')).toBe('video/webm');
  });

  it('accepts history filenames for all three formats, rejects traversal/other', () => {
    expect(isRenderFilename('render_20260610_120000.mp4')).toBe(true);
    expect(isRenderFilename('render_20260610_120000.gif')).toBe(true);
    expect(isRenderFilename('latest.webm')).toBe(true);
    expect(isRenderFilename('render_x.mov')).toBe(false);
    expect(isRenderFilename('../escape.mp4')).toBe(false);
    expect(isRenderFilename('a/b.mp4')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `npm test --workspace services/api -- tests/render-files.test.ts`
  Expected failure: `Error: Failed to load url ../src/util/renderFiles.js` / `Cannot find module` (the file does not exist yet).

- [ ] **Step 3: Minimal implementation**

Create `services/api/src/util/renderFiles.ts`:

```ts
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
```

Then edit `services/api/src/routes/renders.ts`:

1. Add the import below the existing `isSafeSegment` import (line 8):

```ts
import { RENDER_EXTS, isRenderExt, contentTypeFor, isRenderFilename } from '../util/renderFiles.js';
```

2. Replace the `GET /:projectId/latest.mp4` route (lines 35–82) — same body, parameterized extension (Express 4 path-to-regexp supports `latest.:ext`; the dot is literal). Keep Range support as-is (harmless for gif):

```ts
/**
 * Get the latest render for a project (extension follows the render format).
 * GET /api/renders/:projectId/latest.:ext   (ext ∈ mp4|gif|webm)
 */
router.get('/:projectId/latest.:ext', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ext = req.params['ext'];
    if (!isRenderExt(ext)) return void res.status(400).json({ error: 'Invalid render format' });

    const renderPath = path.join(req.dataDir, 'renders', req.params['projectId'], `latest.${ext}`);

    // Check if file exists
    await fs.access(renderPath);

    // Get file stats for content-length
    const stats = await fs.stat(renderPath);

    // Set headers
    res.setHeader('Content-Type', contentTypeFor(ext));
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle range requests for video seeking
    const range = req.headers['range'];

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      res.setHeader('Content-Length', chunkSize);

      const { createReadStream } = await import('fs');
      const stream = createReadStream(renderPath, { start, end });
      stream.pipe(res);
    } else {
      res.sendFile(renderPath);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return void res.status(404).json({
        error: 'Render not found',
        message: 'No render available for this project. Trigger a render first.',
      });
    }
    next(err);
  }
});
```

3. In the `GET /:projectId` list route, replace the `latest.mp4` block (lines 98–106) with a most-recent-of-three probe, and widen the history filter (line 110):

```ts
    let latestName: string | null = null;
    let latestStats: import('fs').Stats | null = null;
    for (const ext of RENDER_EXTS) {
      const candidate = path.join(rendersDir, `latest.${ext}`);
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat && (!latestStats || stat.mtimeMs > latestStats.mtimeMs)) {
        latestStats = stat;
        latestName = `latest.${ext}`;
      }
    }
    const hasLatest = latestName !== null;
```

```ts
    const historyFiles = entries
      .filter((f) => f.startsWith('render_') && isRenderFilename(f))
      .sort()
      .reverse()
      .slice(0, 5);
```

and in the response object replace the hardcoded `name: 'latest.mp4'` / URL with:

```ts
      renders:
        hasLatest && latestStats && latestName
          ? [
              {
                name: latestName,
                size: latestStats.size,
                modifiedAt: latestStats.mtime,
                url: `/api/renders/${req.params['projectId']}/${latestName}`,
              },
            ]
          : [],
```

4. In `GET /:projectId/:filename`, replace the regex check (lines 158–159):

```ts
    if (!isRenderFilename(filename))
      return void res.status(400).json({ error: 'Invalid filename' });
```

(`res.sendFile` derives Content-Type from the extension automatically for this route. Route order keeps `latest.:ext` registered before `:filename`, mirroring today's file.)

- [ ] **Step 4: Run test, expect PASS** — `npm test --workspace services/api` (43 + Task 1/2 + 3 new = all green) and `npm run typecheck` (repo root).

- [ ] **Step 5: Commit**
  ```
  npx prettier --write services/api/src/util/renderFiles.ts services/api/src/routes/renders.ts services/api/tests/render-files.test.ts
  git add services/api/src/util/renderFiles.ts services/api/src/routes/renders.ts services/api/tests/render-files.test.ts
  git commit -m "feat(api): extension-aware render serving (latest.mp4|gif|webm + history)" -m "GET /renders/:id/latest.:ext with an mp4/gif/webm allowlist + content-type map; history listing and :filename download accept the three extensions. Rate-limit untouched." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4: Renderer — `render_args.py` fixed-dict argv mapping + worker wiring

**Files:**
- Create: `services/renderer/render_args.py`
- Modify: `services/renderer/worker.py` (QUALITY_FLAGS block lines 31–38 → moved; `find_output_video` lines 41–55; `render_job` lines 58–172)
- Modify: `services/renderer/Dockerfile` (add a COPY line before line 19)

No pytest infra exists for the worker — the mapping lives in an import-free pure module verified with inline `python -c` (requires `python` on PATH, same assumption as the existing codegen-python-validity test). API-side zod tests (Task 1) guarantee the worker only ever sees allowlisted values; the dict `.get` fallbacks are defense-in-depth.

- [ ] **Step 1: Write the failing check** — run from the worktree root:

```
python -c "import sys; sys.path.insert(0, 'services/renderer'); from render_args import build_render_args, output_ext; print(build_render_args({'quality': 'high'})); print(build_render_args({'quality': 'medium'})); print(build_render_args({'options': {'format': 'mp4', 'resolution': '1920x1080', 'fps': 60}})); print(build_render_args({'options': {'format': 'gif', 'resolution': '854x480', 'fps': 15}})); print(build_render_args({'options': {'format': 'webm', 'resolution': '1280x720', 'fps': 60}})); print(build_render_args({'options': {'format': 'mp4', 'resolution': '3840x2160', 'fps': 60}})); print(output_ext({'options': {'format': 'gif'}})); print(output_ext({}))"
```

  Expected failure: `ModuleNotFoundError: No module named 'render_args'`.

- [ ] **Step 2: Minimal implementation**

Create `services/renderer/render_args.py`:

```python
"""Pure mapping from validated render options to manim CLI argv entries.

The API validates ``format``/``resolution``/``fps`` against zod enum
allowlists (services/api/src/compiler/validator.ts) before a job is
enqueued; this module only maps those values through FIXED dict lookups.
User input is never string-formatted into a CLI flag (argument-injection
posture — see CLAUDE.md "Security posture").

Import-free (stdlib only) so it can be smoke-checked on any host:
    python -c "import sys; sys.path.insert(0, 'services/renderer'); \
               from render_args import build_render_args; \
               print(build_render_args({'quality': 'high'}))"

Keep FORMAT_EXT in sync with RENDER_EXTS in
services/api/src/util/renderFiles.ts.
"""

# Legacy quality presets (payloads without an "options" object).
QUALITY_FLAGS = {
    "low": "-ql",  # 854x480 15fps
    "medium": "-qm",  # 1280x720 30fps
    "high": "-qh",  # 1920x1080 60fps
    "production": "-qp",  # 2560x1440 60fps
    "4k": "-qk",  # 3840x2160 60fps
}

# (resolution, fps) combos that exactly match a manim quality preset.
# Emitting the single preset flag keeps the default argv byte-identical to
# the legacy command and avoids relying on -r/--fps overriding -q.
PRESET_QUALITY = {
    ("854x480", 15): "-ql",
    ("1280x720", 30): "-qm",
    ("1920x1080", 60): "-qh",
    ("2560x1440", 60): "-qp",
    ("3840x2160", 60): "-qk",
}

RESOLUTION_FLAGS = {
    "854x480": ["-r", "854,480"],
    "1280x720": ["-r", "1280,720"],
    "1920x1080": ["-r", "1920,1080"],
    "2560x1440": ["-r", "2560,1440"],
    "3840x2160": ["-r", "3840,2160"],
}

FPS_FLAGS = {
    15: ["--fps", "15"],
    30: ["--fps", "30"],
    60: ["--fps", "60"],
}

FORMAT_FLAGS = {
    "mp4": [],  # manim default container — no flag keeps legacy argv
    "gif": ["--format", "gif"],
    "webm": ["--format", "webm"],
}

FORMAT_EXT = {"mp4": "mp4", "gif": "gif", "webm": "webm"}


def output_ext(payload: dict) -> str:
    """Output file extension for a job payload (defaults to mp4)."""
    options = payload.get("options")
    if not isinstance(options, dict):
        return "mp4"
    return FORMAT_EXT.get(options.get("format"), "mp4")


def build_render_args(payload: dict) -> list:
    """Build the manim CLI flag segment for a render job payload.

    Returns the flags inserted between ``manim`` and the scene file.
    - No ``options`` in the payload -> historical single quality flag.
    - Options matching a quality preset -> that single ``-q*`` flag
      (mp4/1920x1080/60 therefore yields exactly ``["-qh"]``).
    - Any other combo -> ``-qh`` + explicit ``-r``/``--fps`` overrides.
    """
    options = payload.get("options")
    if not isinstance(options, dict):
        return [QUALITY_FLAGS.get(payload.get("quality", "medium"), "-qm")]

    resolution = options.get("resolution", "1920x1080")
    fps = options.get("fps", 60)
    fmt = options.get("format", "mp4")

    preset = PRESET_QUALITY.get((resolution, fps))
    if preset is not None:
        args = [preset]
    else:
        args = (
            ["-qh"]
            + RESOLUTION_FLAGS.get(resolution, RESOLUTION_FLAGS["1920x1080"])
            + FPS_FLAGS.get(fps, FPS_FLAGS[60])
        )
    return args + FORMAT_FLAGS.get(fmt, [])
```

- [ ] **Step 3: Run the check, expect PASS** — rerun the Step 1 command. Expected stdout (exactly — line 1 and line 3 being `['-qh']` IS the byte-identical-argv regression guard):

```
['-qh']
['-qm']
['-qh']
['-ql', '--format', 'gif']
['-qh', '-r', '1280,720', '--fps', '60', '--format', 'webm']
['-qk']
gif
mp4
```

- [ ] **Step 4: Wire `worker.py`** (keep the diff small):

1. Below `import redis` (line 14) add:

```python
from render_args import FORMAT_EXT, build_render_args, output_ext
```

2. Delete the `QUALITY_FLAGS` block (lines 31–38 — it now lives in `render_args.py`).

3. Replace `find_output_video` (lines 41–55) with an extension-aware version (the `{scene_name}*.{ext}` pattern tolerates CE versions that suffix gif filenames with `_ManimCE_v<version>`):

```python
def find_output_video(media_dir: str, scene_name: str, ext: str = "mp4") -> str | None:
    """Find the rendered output file in Manim's output structure."""
    # Manim outputs to: media_dir/videos/<scene_file>/<quality>/<SceneName>.<ext>
    patterns = [
        f"{media_dir}/videos/**/{scene_name}.{ext}",
        f"{media_dir}/videos/**/{scene_name}*.{ext}",
        f"{media_dir}/**/{scene_name}*.{ext}",
    ]

    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        if matches:
            # Return the most recently modified
            return max(matches, key=os.path.getmtime)

    return None
```

4. In `render_job`:
   - Replace `quality = payload.get("quality", "medium")` (line 62) with `ext = output_ext(payload)`.
   - Replace `latest_link = os.path.join(media_dir, "latest.mp4")` (line 71) with `latest_link = os.path.join(media_dir, f"latest.{ext}")`.
   - Replace the command build (lines 98–109) with:

```python
    # Build manim command — flags come exclusively from fixed dict lookups
    cmd = [
        "manim",
        *build_render_args(payload),
        scene_file,
        scene_name,
        "--media_dir",
        media_dir,
        "--flush_cache",  # Clear stale cache but still use caching for speed
    ]
```

   - Replace `output_video = find_output_video(media_dir, scene_name)` (line 123) with `output_video = find_output_video(media_dir, scene_name, ext)`.
   - Replace the latest-link cleanup (lines 127–128) so a format switch never leaves a stale "latest" of another format ambiguous:

```python
            # Remove every latest.* variant so "latest" is unambiguous
            for old_ext in FORMAT_EXT:
                old_link = os.path.join(media_dir, f"latest.{old_ext}")
                if os.path.exists(old_link) or os.path.islink(old_link):
                    os.remove(old_link)
```

   - Replace the history filename (line 138) with `history_path = os.path.join(media_dir, f"render_{timestamp}.{ext}")` and the prune filter (line 146) with `if f.startswith("render_") and f.endswith((".mp4", ".gif", ".webm"))`.

5. In `services/renderer/Dockerfile`, before the `COPY worker.py /app/worker.py` line (19) add:

```dockerfile
COPY render_args.py /app/render_args.py
```

- [ ] **Step 5: Verify the wiring compiles + legacy regression** — `python -m py_compile services/renderer/worker.py services/renderer/render_args.py` (exit 0, no output), then rerun the Step 1 command (same expected stdout). Mark for execution-time verification (next docker run): `docker compose run --rm renderer manim render --help` must show `--format [png|gif|mp4|webm|mov]`, `-r, --resolution`, `--fps` — confirming the flag spellings and that explicit `-r/--fps` are accepted alongside `-q`.

- [ ] **Step 6: Commit**
  ```
  git add services/renderer/render_args.py services/renderer/worker.py services/renderer/Dockerfile
  git commit -m "feat(renderer): map render options to manim argv via fixed dicts" -m "New import-free render_args.py (build_render_args/output_ext); worker writes latest.<ext> + render_<ts>.<ext> and globs the matching extension. Default mp4/1920x1080/60 emits exactly ['-qh'] - byte-identical argv to the legacy command. No string formatting of job values into flags." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  (Prettier does not cover .py; there is no Python formatter gate in this repo.)

---

### Task 5: Web — API client: `RenderOptions` type, options in render bodies, extension-aware latest URL

**Files:**
- Modify: `services/web/src/api.ts` (projects.render line 56, projects.renderCode line 62, renders.getLatestUrl line 126; new exports near the top)
- Test: `services/web/tests/components/render-options.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/render-options.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import api, { DEFAULT_RENDER_OPTIONS } from '../../src/api.js';

let store: ReturnType<typeof useProjectStore>;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('render export options — api client', () => {
  it('DEFAULT_RENDER_OPTIONS preserves today’s behavior (mp4 / 1920x1080 / 60)', () => {
    expect(DEFAULT_RENDER_OPTIONS).toEqual({ format: 'mp4', resolution: '1920x1080', fps: 60 });
  });

  it('getLatestUrl defaults to .mp4 and follows an explicit extension', () => {
    expect(api.renders.getLatestUrl('p1')).toMatch(/\/api\/renders\/p1\/latest\.mp4\?t=\d+/);
    expect(api.renders.getLatestUrl('p1', 'gif')).toMatch(/\/api\/renders\/p1\/latest\.gif\?t=\d+/);
    expect(api.renders.getLatestUrl('p1', 'webm')).toMatch(/\/api\/renders\/p1\/latest\.webm\?t=\d+/);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npm run test:unit -- tests/components/render-options.test.ts`
  Expected failure: `SyntaxError: The requested module '/src/api.ts' does not provide an export named 'DEFAULT_RENDER_OPTIONS'` (and the `getLatestUrl('p1', 'gif')` call would still emit `latest.mp4`).

- [ ] **Step 3: Minimal implementation** — edit `services/web/src/api.ts`:

1. Below the `request` helper (after line 33) add the shared type + default (string-literal mirror of the api-side zod schema):

```ts
// ─── Render export options (Wave 1 Track B) ──────────────────────────────────
// Mirrors RenderOptionsSchema in services/api/src/compiler/validator.ts.

export interface RenderOptions {
  format: 'mp4' | 'gif' | 'webm';
  resolution: '854x480' | '1280x720' | '1920x1080' | '2560x1440' | '3840x2160';
  fps: 15 | 30 | 60;
}

/** Today's behavior: what `manim -qh` produces. */
export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  format: 'mp4',
  resolution: '1920x1080',
  fps: 60,
};
```

2. Replace `projects.render` (lines 56–60):

```ts
  render: (id: string, options?: RenderOptions) =>
    request(`/projects/${id}/render`, {
      method: 'POST',
      body: JSON.stringify({ quality: 'high', ...(options ?? DEFAULT_RENDER_OPTIONS) }),
    }),
```

3. In `projects.renderCode`, add `options` to the destructured param type and spread it into the body (the existing `quality`/`codeSource`/`sceneName` fields stay exactly as they are):

```ts
  renderCode: (
    id: string,
    {
      quality = 'high',
      codeSource,
      sceneName = 'MainScene',
      options,
    }: { quality?: string; codeSource?: string; sceneName?: string; options?: RenderOptions }
  ) =>
    request(`/projects/${id}/render-code`, {
      method: 'POST',
      body: JSON.stringify({
        quality,
        codeSource,
        sceneName,
        ...(options ?? DEFAULT_RENDER_OPTIONS),
      }),
    }),
```

(The API reads the three fields flat off the body — `parseRenderOptions` ignores `quality`/`codeSource`/`sceneName`.)

4. Replace `renders.getLatestUrl` (lines 126–127):

```ts
  getLatestUrl: (projectId: string, ext: string = 'mp4') =>
    `${API_BASE}/renders/${projectId}/latest.${ext}?t=${Date.now()}`,
```

- [ ] **Step 4: Run test, expect PASS** — `cd services/web && npm run test:unit -- tests/components/render-options.test.ts` (2 tests pass).

- [ ] **Step 5: Commit**
  ```
  npx prettier --write services/web/src/api.ts services/web/tests/components/render-options.test.ts
  git add services/web/src/api.ts services/web/tests/components/render-options.test.ts
  git commit -m "feat(web): render options in api client + extension-aware latest URL" -m "RenderOptions type + DEFAULT_RENDER_OPTIONS; render/renderCode POST the flat format/resolution/fps fields; getLatestUrl(projectId, ext) follows the chosen format." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6: Web — store: `renderFormat` state + `renderOnServer(options)`

**Files:**
- Modify: `services/web/src/store/project.ts` (state interface ~line 130, state defaults ~line 490, import line 15, `renderOnServer` lines 1892–1925, `_startPollRender` line 1937)
- Test: `services/web/tests/components/render-options.test.ts` (extend)

- [ ] **Step 1: Write the failing test** — append to `services/web/tests/components/render-options.test.ts`:

```ts
describe('render export options — store', () => {
  it('defaults renderFormat to mp4', () => {
    expect(store.renderFormat).toBe('mp4');
  });

  it('renderOnServer records the chosen format before any network call', async () => {
    // The fetch inside saveToServer fails in jsdom (no server) and is caught by
    // renderOnServer's try/catch — renderFormat is set synchronously before it.
    await store.renderOnServer({ format: 'webm', resolution: '1280x720', fps: 30 });
    expect(store.renderFormat).toBe('webm');
    expect(store.showRenderDialog).toBe(true);
  });

  it('renderOnServer without arguments keeps today’s defaults', async () => {
    await store.renderOnServer();
    expect(store.renderFormat).toBe('mp4');
    expect(store.renderQuality).toBe('high');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npm run test:unit -- tests/components/render-options.test.ts`
  Expected failure: `expected undefined to be 'mp4'` (no `renderFormat` state) and a TypeError/failed assertion on the options call (current signature takes a `quality` string).

- [ ] **Step 3: Minimal implementation** — edit `services/web/src/store/project.ts`:

1. Extend the import on line 15:

```ts
import api, { connectJobWebSocket, DEFAULT_RENDER_OPTIONS } from '../api.js';
import type { RenderOptions } from '../api.js';
```

2. In the state interface (after `renderQuality: string;` ~line 130) add:

```ts
  renderFormat: string;
```

3. In the state defaults (after `renderQuality: 'high',` ~line 490) add:

```ts
    renderFormat: 'mp4',
```

4. Replace `renderOnServer` (lines 1892–1925) — same flow, options-driven:

```ts
    async renderOnServer(options?: RenderOptions) {
      const opts: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...(options ?? {}) };
      this.showRenderDialog = true;
      this.renderStatus = 'uploading';
      this.renderError = null;
      this.renderVideoUrl = null;
      this.renderLog = '';
      this.renderQuality = 'high';
      this.renderFormat = opts.format;

      try {
        // 1. Save to server
        this.renderStatus = 'saving';
        const projectId = await this.saveToServer();

        // 2. Trigger render (code mode sends raw source; visual mode uses compiled pipeline)
        this.renderStatus = 'queued';
        let result: { jobId: string };
        if (this.project.editorMode === 'code') {
          result = (await api.projects.renderCode(projectId, {
            quality: 'high',
            codeSource: this.project.codeSource,
            sceneName: 'MainScene',
            options: opts,
          })) as { jobId: string };
        } else {
          result = (await api.projects.render(projectId, opts)) as { jobId: string };
        }
        this.renderJobId = result.jobId;

        // 3. Start polling
        this._startPollRender(result.jobId, projectId);
      } catch (err) {
        this.renderStatus = 'failed';
        this.renderError = (err as Error).message;
      }
    },
```

5. In `_startPollRender` replace line 1937:

```ts
          this.renderVideoUrl = api.renders.getLatestUrl(projectId, this.renderFormat);
```

- [ ] **Step 4: Run test, expect PASS** — `cd services/web && npm run test:unit -- tests/components/render-options.test.ts` (5 tests pass), then the full unit suite `cd services/web && npm run test:unit` to catch any other caller of the old signature (App.vue line 1057 still compiles because a `ref('high')` string argument is now a type error only at typecheck — fixed in Task 8; run `npm run typecheck` AFTER Task 8, not here).

- [ ] **Step 5: Commit**
  ```
  npx prettier --write services/web/src/store/project.ts services/web/tests/components/render-options.test.ts
  git add services/web/src/store/project.ts services/web/tests/components/render-options.test.ts
  git commit -m "feat(web): store renderFormat + options-driven renderOnServer" -m "renderOnServer(options?: RenderOptions) sends options through both render endpoints and remembers the format so the completed-render URL follows the extension." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7: Web — `RenderOptionsDialog.vue` component

**Files:**
- Create: `services/web/src/components/RenderOptionsDialog.vue`
- Test: `services/web/tests/components/render-options-dialog.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `services/web/tests/components/render-options-dialog.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import RenderOptionsDialog from '../../src/components/RenderOptionsDialog.vue';
import { DEFAULT_RENDER_OPTIONS, type RenderOptions } from '../../src/api.js';

let store: ReturnType<typeof useProjectStore>;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

function mountDialog(overrides: Partial<RenderOptions> = {}) {
  return mount(RenderOptionsDialog, {
    props: { modelValue: { ...DEFAULT_RENDER_OPTIONS, ...overrides } },
  });
}

describe('RenderOptionsDialog', () => {
  it('renders all nine choices and marks the defaults active (MP4 / 1080p / 60)', () => {
    const w = mountDialog();
    for (const id of [
      'fmt-mp4',
      'fmt-gif',
      'fmt-webm',
      'res-854x480',
      'res-1280x720',
      'res-1920x1080',
      'fps-15',
      'fps-30',
      'fps-60',
    ]) {
      expect(w.find(`[data-testid="${id}"]`).exists()).toBe(true);
    }
    expect(w.get('[data-testid="fmt-mp4"]').classes()).toContain('active');
    expect(w.get('[data-testid="res-1920x1080"]').classes()).toContain('active');
    expect(w.get('[data-testid="fps-60"]').classes()).toContain('active');
  });

  it('clicking GIF emits update:modelValue with format gif, other fields preserved', async () => {
    const w = mountDialog();
    await w.get('[data-testid="fmt-gif"]').trigger('click');
    const emitted = w.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual({ format: 'gif', resolution: '1920x1080', fps: 60 });
  });

  it('clicking 854x480 and 15 fps emits the corresponding patches', async () => {
    const w = mountDialog({ format: 'webm' });
    await w.get('[data-testid="res-854x480"]').trigger('click');
    expect(w.emitted('update:modelValue')![0][0]).toEqual({
      format: 'webm',
      resolution: '854x480',
      fps: 60,
    });
    await w.get('[data-testid="fps-15"]').trigger('click');
    // second emit still patches the ORIGINAL prop (parent owns the state)
    expect(w.emitted('update:modelValue')![1][0]).toEqual({
      format: 'webm',
      resolution: '1920x1080',
      fps: 15,
    });
  });

  it('marks the active resolution from the prop', () => {
    const w = mountDialog({ resolution: '1280x720', fps: 30 });
    expect(w.get('[data-testid="res-1280x720"]').classes()).toContain('active');
    expect(w.get('[data-testid="fps-30"]').classes()).toContain('active');
    expect(w.get('[data-testid="res-1920x1080"]').classes()).not.toContain('active');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd services/web && npm run test:unit -- tests/components/render-options-dialog.test.ts`
  Expected failure: `Failed to resolve import "../../src/components/RenderOptionsDialog.vue"` (component does not exist).

- [ ] **Step 3: Minimal implementation**

Create `services/web/src/components/RenderOptionsDialog.vue` (self-contained options panel — it renders inside the existing render dialog, owns no state, pure v-model):

```vue
<template>
  <div class="ro-panel">
    <div>
      <label class="ro-label">Format</label>
      <div class="ro-row">
        <button
          v-for="f in FORMATS"
          :key="f.value"
          type="button"
          class="ro-btn"
          :class="{ active: modelValue.format === f.value }"
          :data-testid="'fmt-' + f.value"
          @click="set({ format: f.value })"
        >
          <span class="ro-btn-label">{{ f.label }}</span>
          <span class="ro-btn-desc">{{ f.desc }}</span>
        </button>
      </div>
    </div>

    <div class="mt-3">
      <label class="ro-label">Resolution</label>
      <div class="ro-row">
        <button
          v-for="r in RESOLUTIONS"
          :key="r.value"
          type="button"
          class="ro-btn"
          :class="{ active: modelValue.resolution === r.value }"
          :data-testid="'res-' + r.value"
          @click="set({ resolution: r.value })"
        >
          <span class="ro-btn-label">{{ r.label }}</span>
          <span class="ro-btn-desc">{{ r.desc }}</span>
        </button>
      </div>
    </div>

    <div class="mt-3">
      <label class="ro-label">Frame Rate</label>
      <div class="ro-row">
        <button
          v-for="f in FPS_CHOICES"
          :key="f.value"
          type="button"
          class="ro-btn"
          :class="{ active: modelValue.fps === f.value }"
          :data-testid="'fps-' + f.value"
          @click="set({ fps: f.value })"
        >
          <span class="ro-btn-label">{{ f.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RenderOptions } from '../api.js';

const props = defineProps({
  modelValue: { type: Object as () => RenderOptions, required: true },
});
const emit = defineEmits(['update:modelValue']);

const FORMATS = [
  { value: 'mp4', label: 'MP4', desc: 'H.264 video' },
  { value: 'gif', label: 'GIF', desc: 'Animated image' },
  { value: 'webm', label: 'WebM', desc: 'VP9 video' },
] as const;

const RESOLUTIONS = [
  { value: '854x480', label: '480p', desc: '854×480' },
  { value: '1280x720', label: '720p', desc: '1280×720' },
  { value: '1920x1080', label: '1080p', desc: '1920×1080' },
  { value: '2560x1440', label: '2K', desc: '2560×1440' },
  { value: '3840x2160', label: '4K', desc: '3840×2160' },
] as const;

const FPS_CHOICES = [
  { value: 15, label: '15 fps' },
  { value: 30, label: '30 fps' },
  { value: 60, label: '60 fps' },
] as const;

function set(patch: Partial<RenderOptions>) {
  emit('update:modelValue', { ...props.modelValue, ...patch });
}
</script>

<style scoped>
.ro-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  color: var(--studio-text-muted);
}
.ro-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.ro-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
  border: 1px solid var(--studio-border, #333);
  border-radius: 8px;
  background: var(--studio-bg, #111);
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ro-btn:hover {
  border-color: var(--studio-accent, #6366f1);
}
.ro-btn.active {
  border-color: var(--studio-accent, #6366f1);
  background: color-mix(in srgb, var(--studio-accent, #6366f1) 15%, transparent);
}
.ro-btn-label {
  font-size: 12px;
  font-weight: 600;
}
.ro-btn-desc {
  font-size: 9px;
  color: var(--studio-text-muted, #888);
}
.mt-3 {
  margin-top: 12px;
}
</style>
```

- [ ] **Step 4: Run test, expect PASS** — `cd services/web && npm run test:unit -- tests/components/render-options-dialog.test.ts` (4 tests pass).

- [ ] **Step 5: Commit**
  ```
  npx prettier --write services/web/src/components/RenderOptionsDialog.vue services/web/tests/components/render-options-dialog.test.ts
  git add services/web/src/components/RenderOptionsDialog.vue services/web/tests/components/render-options-dialog.test.ts
  git commit -m "feat(web): RenderOptionsDialog with format/resolution/fps selectors" -m "Self-contained v-model panel; defaults MP4 / 1920x1080 / 60fps match today's -qh behavior." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 8: Web — `App.vue` wiring (minimal diff)

**Files:**
- Modify: `services/web/src/App.vue` — exactly four regions: quality-selector template block (lines 388–405), completed-render block (lines 511–524), script refs (lines 775, 785–791), `startRender` (lines 1055–1058) + imports (~line 763) + computed wrappers (~line 820)
- Test: covered by Tasks 5–7 tests + `npm run typecheck` + full unit suite (the repo has no App.vue mount tests — mounting the full app requires the Konva stage environment; do not introduce one here)

- [ ] **Step 1: Establish the failing gate** — `npm run typecheck` (repo root) currently FAILS after Task 6 with `error TS2345: Argument of type 'string' is not assignable to parameter of type 'RenderOptions'` at `App.vue` line 1057 (`store.renderOnServer(selectedQuality.value)`). This task makes it pass.

- [ ] **Step 2: Template — replace the quality selector with the dialog mount.** Replace lines 388–405 (the whole `<div v-if="!renderStatus">…Quality grid…</div>` opening section up to and including the closing `</div>` of the quality grid) keeping the same `v-if` wrapper:

```html
            <!-- Render options (before render starts) -->
            <div v-if="!renderStatus">
              <RenderOptionsDialog v-model="renderOptions" />
```

(The text-size disclaimer at lines 406–415 and the Start Render button at lines 416–434 stay exactly where they are, still inside this `v-if` block.)

- [ ] **Step 3: Template — completed-render block follows the format.** In the success section, replace the `<video>` element (lines 511–518) with a gif-aware branch:

```html
              <img
                v-if="renderVideoUrl && renderFormat === 'gif'"
                :key="renderVideoUrl"
                :src="renderVideoUrl"
                alt="Rendered GIF"
                class="w-full rounded-lg bg-black"
              />
              <video
                v-else-if="renderVideoUrl"
                :key="renderVideoUrl"
                :src="renderVideoUrl"
                controls
                class="w-full rounded-lg bg-black"
                autoplay
              ></video>
```

and change the download anchor attribute (line 523) from `download="render.mp4"` to:

```html
                  :download="'render.' + renderFormat"
```

- [ ] **Step 4: Script wiring.**

1. Add the component + type imports next to the other component imports (~line 763–769):

```ts
import RenderOptionsDialog from './components/RenderOptionsDialog.vue';
import { DEFAULT_RENDER_OPTIONS } from './api.js';
import type { RenderOptions } from './api.js';
```

2. Replace `const selectedQuality = ref('high');` (line 775) with:

```ts
const renderOptions = ref<RenderOptions>({ ...DEFAULT_RENDER_OPTIONS });
```

3. Delete the `qualities` array (lines 784–791, including the `// Static data` comment if it has no other reader on those lines).

4. Next to the other render computed wrappers (after `const renderLog = computed(() => store.renderLog);` line 820) add:

```ts
const renderFormat = computed(() => store.renderFormat);
```

5. Replace `startRender` (lines 1055–1058):

```ts
function startRender() {
  if (store.hasPendingAudio) return;
  store.renderOnServer({ ...renderOptions.value });
}
```

- [ ] **Step 5: Run gates, expect PASS** — `npm run typecheck` (repo root, the Task-6 TS2345 is gone), `cd services/web && npm run test:unit` (full suite, 618 pre-existing + 9 new from Tasks 5–7), `cd services/web && npm run build` (catches `<template v-for>` key issues per CLAUDE.md — RenderOptionsDialog uses `v-for` on elements with `:key`, not `<template v-for>`, so this is a safety check only).

- [ ] **Step 6: Commit**
  ```
  npx prettier --write services/web/src/App.vue
  git add services/web/src/App.vue
  git commit -m "feat(web): mount RenderOptionsDialog in the render dialog" -m "Replaces the quality preset buttons with format/resolution/fps selectors; startRender passes the chosen options; completed view shows <img> for GIF and the download name follows the format. 2K/4K presets removed from the UI per the Wave 1 spec allowlist (API still accepts legacy quality payloads)." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9: Final verification (full gate)

**Files:** none (verification only)

- [ ] **Step 1: Full test matrix** — run each, all must pass:
  ```
  cd services/web && npm run test:unit        # 618 pre-existing + 9 new = 627+ pass
  cd services/web && npm test                 # 114 engine tests (tsx)
  npm test --workspace services/api           # 43 pre-existing + 10 new (6+1 render-options, 3 render-files)
  npm test --workspace packages/manim-codegen # 6 codegen tests
  ```
  (`cd` paths are relative to the worktree root; return to the root between commands.)

- [ ] **Step 2: Repo-root tooling gates**
  ```
  npm run lint            # ESLint - errors fail
  npm run typecheck       # build:codegen + vue-tsc (web) + tsc (api)
  npm run format:check    # Prettier
  ```

- [ ] **Step 3: Python regression guard one more time** (worktree root, `python` on PATH):
  ```
  python -m py_compile services/renderer/worker.py services/renderer/render_args.py
  python -c "import sys; sys.path.insert(0, 'services/renderer'); from render_args import build_render_args; print(build_render_args({'quality': 'high'}) == ['-qh'] and build_render_args({'options': {'format': 'mp4', 'resolution': '1920x1080', 'fps': 60}}) == ['-qh'])"
  ```
  Expected stdout: `True` (the byte-identical-argv guard: legacy and default-options payloads both produce exactly `['-qh']`, so the assembled cmd list matches today's byte-for-byte).

- [ ] **Step 4 (optional, requires Docker): live smoke** — `docker compose up -d --build`, then in the app render a small project once per format and confirm: GIF/WebM downloads carry the right extension, `\\data\renders\<id>\` contains `latest.gif`/`latest.webm`, and `docker compose run --rm renderer manim render --help` lists `--format`, `-r/--resolution`, `--fps` (the execution-time verification flagged in the primer). If the help output shows different flag spellings, fix only `render_args.py`'s dict values — nothing else interpolates flags.

- [ ] **Step 5: Fix anything red, re-run the failing gate, commit fixes with `fix:` prefixed conventional messages** (same co-author footer). Do NOT merge — the orchestrator integrates this branch.

---

## Self-review checklist (for the implementer, before handing back)

- Spec line → task mapping: dialog with 3 selectors + defaults (T7), App.vue minimal mount + options into startRender (T8), zod enum allowlist + 400 `{error}` (T1, T2), redis job carries options (T2), worker fixed-dict argv + byte-identical default (T4), extension follows format in worker + API serving + web URL/download (T4, T3, T5, T6, T8), WS untouched (no task edits `ws.ts`), rate-limit retained (T3 leaves lines 24–33 of renders.ts alone).
- Vocabulary consistency: `RenderOptions` field names/literals are identical in `validator.ts` (zod), `api.ts` (TS interface), the flat POST body, the nested `options` job field, and the `render_args.py` dict keys.
- No new npm dependencies anywhere (no supertest, no extra zod). No changes to `ws.ts`, `audio*`, `@manim/codegen`, or any Track C/D file.
