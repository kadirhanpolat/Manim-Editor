# Manim Motion Editor Production Readiness Roadmap

**Date:** 2026-06-29
**Status:** Proposed
**Purpose:** Turn the current feature-rich editor into a more reliable production tool.

## Context

The original roadmap and later Wave 1-4 work closed the main feature backlog. The product now has a broad visual editor, many object types, server rendering, render history, export options, strict TypeScript, and browser/API test coverage.

The next development stage should not primarily add more object types. The highest-value work is reliability, preview/render trust, large-scene performance, and maintainability.

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

### 12. Template and Education Flow Quality

**Why it matters:** The editor targets mathematical animations. Templates should demonstrate high-quality teaching workflows, not only object coverage.

**Scope:**
- Upgrade calculus, linear algebra, trigonometry, statistics, and programming templates.
- Add narrative timing and camera polish.
- Add template render smoke coverage for the most important examples.

**Acceptance criteria:**
- Top templates render successfully and look intentional.
- A new user can start from a template and get a useful educational animation quickly.

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
