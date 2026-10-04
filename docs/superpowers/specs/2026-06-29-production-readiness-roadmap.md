# Manim Motion Editor Production Readiness Roadmap

**Date:** 2026-06-29 (last updated 2026-10-04, section 9 done)
**Status:** Active
**Purpose:** Turn the current feature-rich editor into a more reliable production tool.

## Context

The original roadmap and later Wave 1-4 work closed the main feature backlog. The product now has a broad visual editor, many object types, server rendering, render history, export options, strict TypeScript, and browser/API test coverage.

Sections 1-9 below already have implementation notes or shipped work. The remaining planned work is concentrated in sections 10-12.

**2026-10-04 update:** a bug report from real production use (a documentary built through the API) was worked through: seven render-correctness bugs were fixed (see the notes tagged *EDITOR_FINDINGS* below and the README v3.28.0 changelog), the renderer image was repaired, and every CI job on `main` is green again for the first time since June.

The next development stage should not primarily add more object types. The highest-value work is reliability, preview/render trust, large-scene performance, maintainability, startup/support, security, and content quality.

## Priority Roadmap

### 1. Render Pipeline Reliability

**Why it matters:** Rendering is the core product promise. If a job stalls, fails silently, or gives weak feedback, the whole editor feels unreliable.

**Scope:**
- Worker health endpoint and UI-visible worker availability.
- Stalled-job detection for queued/running jobs.
- Render job timeout and structured failure reasons.
- Cancel and retry support.
- Downloadable full render log per job.
- Queue position and active worker count in the render dialog.

**Acceptance criteria:**
- A stuck worker cannot leave the UI in an indefinite waiting state.
- A failed render always shows a clear reason and log.
- A user can retry a failed render without reopening the project.

**Implemented so far:**
- Worker heartbeat metadata is exposed through the queue stats API.
- The render dialog now shows queue depth, worker count, and stale-worker count.
- Render jobs can be canceled from the API and the worker honors cancel requests.
- Job status responses now include queue position and stalled-worker detection.
- *EDITOR_FINDINGS #2:* with Redis down, render requests used to hang forever. Now they fail in about 3 s with HTTP 503 (`REDIS_CONNECT_TIMEOUT_MS`, offline queue disabled). `/health` reports Redis (`503 degraded` when down), and the `redis` service has `restart: unless-stopped`.
- The renderer image was missing `safety.py`, so a rebuilt worker crashed at startup. It is now COPY'd, and a test guards every worker import.

### 2. Preview / Render Parity

**Why it matters:** The editor is only trustworthy if the canvas preview is close enough to final Manim output.

**Scope:**
- Create a documented preview-vs-render divergence matrix.
- Expand golden-frame coverage beyond the current small corpus.
- Add cases for text, LaTeX, gradients, rounded corners, shadows, 3D camera, paths, and emphasis clips.
- Label accepted preview-only differences explicitly in the UI/docs.

**Acceptance criteria:**
- Every known preview/render mismatch is either fixed or documented.
- Render regression tests cover the most common visual object families.
- New visual features must add parity coverage or explicitly document a non-goal.

**Implemented so far:**
- `docs/superpowers/specs/2026-06-29-preview-render-divergence-matrix.md` records the accepted preview-only differences.
- The render dialog now surfaces preview notes for text, LaTeX, 3D framing, and styled-object approximations.
- Render-truth coverage now includes a styled triangle case that exercises gradient, rounded-corner, and shadow rendering.
- *EDITOR_FINDINGS #1, #3-#7:*
  - Math expressions are normalized identically for the preview and the render (bare `exp`/`sin` → `np.*`, `^` → `**`).
  - Enters and exits that start together play together, waits follow the real elapsed time, and the render honors `sceneDuration`.
  - Arrow tips and LaTeX sizing share one rule between the preview and the render.
  - Microsoft core fonts render through metric-compatible clones. The divergence matrix lists all of this.
- Every palette template now renders in the real-Manim harness. This caught two broken templates: `sin_cos_wave` (NameError) and `unit_circle` (`Angle.get_tex` does not exist).
- *Template-quality pass (2026-10-04):* rendering every template and comparing it with the preview exposed seven more mismatches, all fixed and listed in the divergence matrix:
  - 2D rotation rendered mirrored, because Manim is counter-clockwise-positive.
  - Point-built objects rendered 40–155 px off their origin (`ORIGIN_ANCHORED_TYPES`).
  - The angle preview drew a half-size reflex arc, and the render left out the rays.
  - Dots rendered at half size.
  - Graph tangents landed at the wrong x, because TangentLine's alpha is an arc-length proportion.
  - Riemann rectangles rendered opaque.
  - NumberPlane step edits never reached the render.

### 3. Code / Visual Round-Trip Robustness

**Why it matters:** The project has two editor modes. The code-to-canvas path should not silently drop important information.

**Scope:**
- Audit `parseManimScript` losses against generated output.
- Move fragile parser areas toward structured metadata or a stronger parsing strategy.
- Add round-trip fixtures for every major object family.
- Make unsupported imports/custom code degrade safely instead of corrupting the visual project.

**Acceptance criteria:**
- Generated code can be parsed back without losing supported project state.
- Unsupported code is reported clearly.
- Round-trip tests cover objects, clips, sections, camera, audio, and render-relevant settings.

**Implemented so far:**
- The parser already reports unsupported imports/custom code as warnings instead of silently dropping them.
- `services/web/tests/components/manim-export.test.ts` now round-trips `image` and `svg_asset` objects through generate → parse coverage.
- Merged `self.play(A, B, ...)` enters and exits, the LaTeX box size and `font_size`, render-font substitutions (`# Font:` comment) and the new labeled-angle form all parse back. Older `.py` forms are still accepted.

### 4. Large-Scene Performance

**Why it matters:** The object catalog is now large. Performance problems will appear when users build real scenes, not just demos.

**Scope:**
- Profile Konva stage render cost with 100, 250, and 500 objects.
- Reduce unnecessary layers and move overlay-only visuals into groups where possible.
- Batch redraw expensive updates.
- Add large-project smoke fixtures.
- Track bundle size and runtime hot paths.

**Acceptance criteria:**
- A 250-object project remains usable for selection, drag, pan, and zoom.
- Konva layer count stays within the recommended range in normal editor states.
- Performance regressions have repeatable local checks.

**Implemented so far:**
- `services/web/src/components/stage/StageCanvas.vue` now renders the object tree and overlays in a single Konva layer.
- `services/web/tests/components/stage/stage-canvas-layers.test.ts` locks the steady-state layer count to one.
- `services/web/src/components/stage/StageCanvas.vue` now caches heavy axes preview geometry so repeated renders do less work.
- `services/web/tests/components/stage/stage-large-scene-profile.test.ts` profiles 100/250/500 object scenes with an opt-in large-scene harness.

### 5. Inspector Consistency Matrix

**Why it matters:** There are many shape types. Users need predictable editing controls across them.

**Scope:**
- Define a schema/table for supported properties per object type.
- Verify common properties: position, size, rotation, fill, stroke, opacity, z-order, lock/hide, duration, entrance/exit animation.
- Verify type-specific panels for geometry, data, text, LaTeX, 3D, and annotations.
- Add browser coverage for representative edit operations, not just panel visibility.

**Acceptance criteria:**
- Every object type has an explicit inspector capability row.
- Missing controls are intentional and documented.
- E2E tests cover editing core properties across each object family.

**Implemented so far:**
- `services/web/src/components/inspector/capability-matrix.ts` defines the shared control surface and one row per addable object type.
- `services/web/tests/components/inspector-capability-matrix.test.ts` verifies palette coverage, shared controls, and representative special panels.
- `services/web/tests/components/ui-tools-audit.test.ts` now consumes the capability matrix as its type source.
- `services/web/tests/components/inspector/properties-panel-editing.test.ts` covers real geometry, opacity, text, and font-size edits through the object inspector.

### 6. Render UX and Observability

**Why it matters:** Queue depth is a good start, but the user still needs richer feedback during long renders.

**Scope:**
- Show queue position, active worker count, and current job phase.
- Add estimated duration where enough history exists.
- Add copy/download log actions for both failed and completed jobs.
- Preserve the last failed render state when reopening the dialog.

**Acceptance criteria:**
- The render dialog explains whether the job is queued, running, stalled, failed, or complete.
- The user can act on each state: wait, cancel, retry, download, or inspect logs.

**Implemented so far:**
- Parser warnings report unsupported code instead of silently dropping it.
- Preview/render divergence matrix: `docs/superpowers/specs/2026-06-29-preview-render-divergence-matrix.md`.
- Queue depth is shown before submission.
- Worker availability is shown before submission.
- Render logs can be copied or downloaded from the dialog.
- Render dialogs now surface an estimated duration when enough successful render history exists.
- Render progress now shows explicit phase, queue position, and worker summary lines.
- Render jobs now expose a Cancel action while queued or running.
- Stalled renders are surfaced in the dialog as an explicit warning.

### 7. Project History and Versioning

**Why it matters:** Autosave and render history exist, but users need safer editing workflows for real projects.

**Scope:**
- Manual project snapshots.
- Restore previous project snapshots.
- Project package export/import including assets and render metadata.
- Better autosave conflict handling.

**Acceptance criteria:**
- A user can recover from accidental destructive edits.
- A project can be moved to another machine without losing assets.

**Implemented so far:**
- Local project snapshots can be created, listed, restored, and deleted from the topbar.
- Project package export/import now preserves render metadata alongside the project payload.
- Autosave restore prompts now name the unsaved project, which makes startup conflict handling less ambiguous.

### 8. CI and Full-Stack Smoke Reliability

**Why it matters:** The project has many moving parts. CI should catch real integration breakage without becoming noisy.

**Scope:**
- Stabilize Playwright port handling.
- Add a Docker full-stack smoke for API + web + Redis + renderer.
- Keep real Manim render harness non-blocking until environment stability is proven.
- Record clear local commands for reproducing CI failures.

**Acceptance criteria:**
- Browser smoke tests do not fail because a local/dev port is already occupied.
- At least one CI job proves the full Docker stack can start and accept a render request.

**Implemented so far:**
- `scripts/full-stack-smoke.mjs` exercises web, API, Redis-backed job creation, and renderer-backed job completion.
- `.github/workflows/ci.yml` includes a dedicated `docker-smoke` job that boots the compose stack and runs the smoke script.
- `e2e/scripts/run-tests.mjs` now selects a free local dev port once, starts the Vite dev server, and exports the chosen port into Playwright so browser smoke tests stay on one consistent URL.
- All five CI jobs (node, python, e2e, docker-smoke, render-harness) are green on `main` (run 37205745017). What was fixed:
  - ESLint parse errors from mojibake, missing Node globals for the `.mjs` scripts, Prettier drift, 36 stale characterization snapshots, and ruff/black issues in `worker.py`.
- The CI python job now runs the renderer pytest suite.

### 9. Security and Render Isolation

**Why it matters:** Code-only rendering executes user-provided Python. Even in a local-first project, guardrails matter.

**Scope:**
- CPU, memory, and wall-time limits for render jobs.
- Clear filesystem boundary for project assets/renders.
- Review code-only mode threat model.
- Keep path traversal and argument injection tests current.

**Acceptance criteria:**
- A bad render cannot run forever or consume unbounded resources.
- File access remains inside the intended data directories.

**Implemented so far:**
- Render worker project ids and scene-file resolution are clamped to the shared data directory.
- Render worker timeouts kill the whole spawned process group, not just the top-level process.
- The renderer image now actually ships `safety.py` (the worker crashed at startup with `ModuleNotFoundError` after a rebuild); `services/renderer/tests/test_dockerfile.py` asserts every module the worker imports is COPY'd, and CI now runs the renderer pytest suite.
- A Redis outage now degrades to HTTP 503 instead of tying up request handlers indefinitely.
- **Resource limits (2026-10-04):** `services/renderer/isolation.py` runs each render under a wall clock plus kernel rlimits: `RLIMIT_DATA` for memory (not `RLIMIT_AS`, which numpy and cairo address-space reservations trip early), `RLIMIT_CPU` (soft limit, then a hard limit 5 s later) and `RLIMIT_FSIZE`. All four come from `RENDER_TIMEOUT_SECONDS` / `RENDER_MEMORY_MB` / `RENDER_CPU_SECONDS` / `RENDER_MAX_FILE_MB`, with defaults of 600 s, 3072 MB, 1800 s and 4096 MB. OpenMP/OpenBLAS/MKL pools are capped at 2 threads, because they size themselves from the host's cores, not the container quota, and their stacks would count against `RLIMIT_DATA`. The renderer containers add `pids: 512`; `RLIMIT_NPROC` would not work because the worker runs as root.
- Output goes to temp files and only an 8 KB tail is kept, so the worker's memory no longer grows with the scene's output.
- A limit hit is classified by `describe_failure` into a `failureReason` code on the job, with a message that names the limit. A plain Manim error keeps `error=""` so the dialog still shows the traceback.
- Verified end to end on the Docker stack: a 10 GB allocation gives `memory_limit` in 4 s; an endless print gives `file_size_limit` with the worker at 20 MB RSS; `sleep(600)` gives `timeout`; 2000 threads are refused by the pids cap.
- **Code-only threat model (reviewed):** code mode executes the user's own Python as root inside the renderer container, with the shared `/data` volume mounted read-write. Under the local, single-user model this is accepted: the user already controls the machine. The limits above protect availability (no hung worker, no full disk, no OOM of the whole renderer). They do not protect confidentiality against hostile code. Running untrusted scenes would need a per-job throwaway container (no network, read-only project mount, non-root user), which is out of scope for a local tool.

### 10. Startup and Support Experience

**Why it matters:** The project should be easy to run and debug on a fresh machine.

**Scope:**
- `start.bat` diagnostics for Docker availability and port conflicts.
- One-command log collection.
- Clear repair commands for stale volumes or broken workers.
- Better first-run troubleshooting docs.

**Acceptance criteria:**
- A failed startup explains the concrete next action.
- Users can collect useful logs without knowing Docker internals.

**Implemented so far:**
- `start.bat` checks the relevant launch port before opening the browser.
- `start.bat` falls back to editor-only mode when Docker is unavailable.

### 11. Encoding and Language Consistency

**Why it matters:** Mojibake in docs and mixed UI language reduce trust and make maintenance harder.

**Scope:**
- Clean README and roadmap mojibake.
- Decide UI language strategy: English-only or explicit localization.
- Move template labels/descriptions behind a localization-ready structure if Turkish content is kept.

**Acceptance criteria:**
- README and active roadmap docs render without corrupted characters.
- User-facing labels follow one clear language policy.

**Implemented so far:**
- The New Project dialog now renders template names/descriptions in English even when the source template data remains localized.
- The asset sidebar normalizes the remaining localized shape labels into English at render time.
- README render guidance now uses the same English-only language policy as the editor UI.
- Repaired double/triple-encoded mojibake in `App.vue` (it broke ESLint parsing: 402 `control-character-in-input-stream` errors) and in the original roadmap spec; a repo-wide scan finds no corrupted characters left.

### 12. Template and Education Flow Quality

**Why it matters:** The editor targets mathematical animations. Templates should demonstrate high-quality teaching workflows, not only object coverage.

**Scope:**
- Upgrade calculus, linear algebra, trigonometry, statistics, and programming templates.
- Add narrative timing and camera polish.
- Add template render smoke coverage for the most important examples.

**Acceptance criteria:**
- Top templates render successfully and look intentional.
- A new user can start from a template and get a useful educational animation quickly.

**Implemented so far:**
- Render smoke coverage for **every** template in the opt-in real-Manim harness (`render-truth: every template renders in real Manim`); two previously crashing templates (`sin_cos_wave`, `unit_circle`) fixed.
- **Visual pass (2026-10-04):** every template was rendered in real Manim, frames sampled at 45 % and 85 % of the scene, and compared against the preview. Fixed:
  - `unit_circle` was rebuilt as a true unit circle: one plane unit is the radius, P sits on the circle at the end of the angle ray, the cos/sin projections are colored and labeled, and the scene ends on cos²θ + sin²θ = 1.
  - `theorem_proof` and `algo_steps` showed "Text" placeholders: the template data used `text:` instead of `content:`.
  - `axes_intro` had no curve for its f(x) = x² label.
  - `derivative_tangent` and `integral_area` plotted outside their axes, and the tangent sat at the wrong x.
  - `vector_addition` drew its resultant horizontally from the wrong point, with u ∥ v.
  - The `algo_steps` arrows started inside the boxes.
  - The `matrix_product` `\cdot` was blown up by fit-to-box.
  - `template-library.test.ts` now locks these properties (geometry, graphs inside axes, text `content`, layout).
- Still open: narrative timing and camera polish, English template copy (section 11), and a "science documentary" template pack suggested by the production bug report.

## Backlog: Feature Requests from Production Use

These requests came from the same documentary production as the 2026-10 bug report. They are not scheduled: each one adds a new object type or workflow, which the non-goals below defer until sections 9-12 land.

- **Data point on axes:** a point plus label positioned by its (x, y) value on an `axes` object (Manim `axes.c2p`). Today the points are placed by hand in pixels, and the axis arrows shift them by about 12 px.
- **Scene parameters / language variables:** a text table for TR/EN versions of the same scene, plus the decimal separator (`4{,}55` / `4.55`).
- **Ken Burns preset** for image objects: slow zoom and pan.
- **Timeline object:** an axis generated automatically from a list of years and labels.
- **SRT export** built from the text of voiceover clips.
- **Batch render:** render a list of projects in sequence and report the results.
- **"Science documentary" template pack:** decay curve, isochron, isotope chain, comparison scale.

## Recommended Execution Order

1. Render Pipeline Reliability
2. Preview / Render Parity
3. Code / Visual Round-Trip Robustness
4. Large-Scene Performance
5. Inspector Consistency Matrix
6. Render UX and Observability
7. Project History and Versioning
8. CI and Full-Stack Smoke Reliability
9. Security and Render Isolation
10. Startup and Support Experience
11. Encoding and Language Consistency
12. Template and Education Flow Quality

## Suggested Milestones

### Milestone A: Reliable Rendering

- Health checks, stalled-job detection, timeout, retry/cancel, richer logs.
- Full-stack smoke proves the render path is alive.

### Milestone B: Trustworthy Output

- Expanded render regression corpus.
- Preview/render divergence matrix.
- Stronger round-trip fixtures.

### Milestone C: Scalable Editing

- Large-scene profiling and performance fixes.
- Inspector capability matrix and edit-operation coverage.

### Milestone D: Operational Polish

- Project snapshots and package export/import.
- Startup diagnostics.
- Encoding/language cleanup.
- Higher-quality education templates.

## Non-Goals

- Adding more shape types before reliability and parity improve.
- Replacing Manim as the render engine.
- Making pixel-perfect Konva-vs-Manim comparison the default gate; perceptual regression and documented divergences are preferred.
