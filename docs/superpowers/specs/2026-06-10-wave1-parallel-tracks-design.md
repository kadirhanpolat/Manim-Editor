# Wave 1 — Four Parallel Tracks Design

**Date:** 2026-06-10
**Status:** Approved (brainstorming session)
**Execution model:** one orchestrator session dispatches 4 worktree-isolated subagents in parallel; sequential integration into `main`.

## Goal

Close the highest-value gaps still open since the February 2026 audit (`report.md`) in a single wave of four independent work tracks, sized so they can run as parallel agents with minimal file overlap.

## Background

The Feb 2026 audit listed major gaps; most have since shipped (LaTeX, undo/redo, keyframes, camera, 3D, audio, templates, emphasis anims, copy/paste, Vue 3 + strict TS, shared codegen). A fresh code scan (2026-06-10) verified these items are **still open**:

- No right-click context menu (only the keyframe lane has one), no marquee selection, no object lock/hide, no autosave (`localStorage` is theme-only).
- No GIF/WebM export, no resolution/fps choice.
- No `Code` or `BarChart` object types.
- `website/` already ships a polished, committed Vue 3 + Vite + Tailwind landing page (Netlify-deployed via root `netlify.toml`) — but it lacks a demo gallery/quickstart, its GitHub links point at the wrong repo, and some copy is stale; 5 demo videos sit uncommitted in `demo-videos/` (10–30 KB each).

## Scope

Four tracks, **core-first-wave** scope. Everything else goes to the Wave 2 backlog (last section). Each track is one branch, one subagent, one implementation plan.

---

## Track A — Showcase (`feat/wave1-showcase`)

Smallest track; zero code overlap with the others.

**Reality check (2026-06-10 planning):** `website/` is NOT a skeleton — it is a polished, committed Vue 3 + Vite 5 + Tailwind 3.4 landing page (Netlify-deployed), already in English. Scope adjusted: keep the existing design, add only what's missing.

- Add a demo **gallery section** embedding the 5 demo videos (PNG posters + `<video controls>`, English captions) and a **quickstart** terminal block (`git clone … && docker compose up --build` → localhost:8080).
- Fix the 9 GitHub links pointing at the wrong repo (`BlommeJan/Manim-Motion` → the fork's own `kadirhanpolat/Manim-Editor`) and refresh stale copy ("16+ shapes" → 40+ object types, keyframes/3D/TTS).
- Copy videos+posters into `website/public/demo/`; commit `demo-videos/` to the repo (total ~172 KB, no LFS needed).
- Add a showcase section to `README.md` (posters + link to the website).
- Verify `npm run build` succeeds inside `website/`. No new CI job (YAGNI).

**Files:** `website/*`, `demo-videos/*`, `README.md`.

## Track B — Export formats (`feat/wave1-export-formats`)

- Render options UI: format (**MP4 / GIF / WebM**), resolution (**854×480 / 1280×720 / 1920×1080**), fps (**15 / 30 / 60**) selectors. Defaults preserve today's behavior (MP4, 1920×1080, 60 fps — what `manim -qh` produces now). The render trigger currently lives in `App.vue` (`startRender`) — there is no `RenderPanel.vue` (stale CLAUDE.md reference). To keep the `App.vue` diff minimal, the selectors go into a new self-contained `RenderOptionsDialog.vue`; `App.vue` only gains the dialog mount + passing the chosen options to `startRender`.
- API render endpoint accepts `{ format, resolution, fps }`, validated by the zod schema as **enums (allowlist)**. Values are never interpolated into argv; a fixed map translates them to `--format <f>` / `-r W,H` / `--fps <n>` flags (consistent with the existing argument-injection posture).
- `services/renderer/worker.py` applies the flags; the download link/extension follows the chosen format. WS progress events unchanged.
- Existing render rate-limit stays as-is.

**Files:** `services/api/src/routes/render*`, `compiler/validator.ts`, `services/renderer/worker.py`, new `RenderOptionsDialog.vue`, `App.vue` (minimal diff: dialog mount + options pass-through).

## Track C — Content objects (`feat/wave1-content-objects`)

Two new object types via the proven "add an object type" pipeline (codegen package → `manim.ts` parser → canvas config builder → store defaults → inspector settings + registry → AssetSidebar palette card → snapshot/round-trip/python-validity tests; `ui-tools-audit` must pass).

### `code` (Manim `Code`)
- Fields: `codeText` (multiline), `language` (short Pygments list: python, javascript, typescript, c, cpp, java, html, css, bash), `fontSize` (preview sizing).
- Codegen: single-line constructor with `\n`-escaped `code_string` so the regex parser round-trips it. Exact CE 0.19 `Code` signature (and how sizing maps — param vs. `.scale()`) is verified via context7 during planning. Requirement: the block must be resizable on canvas and that size must be reflected in the render.
- Preview: monospace multiline Konva Text on a background rect. **Known divergence:** no syntax highlighting in preview (render has real Pygments highlighting).

### `bar_chart` (Manim `BarChart`)
- Fields: `values: number[]`, `barNames: string[]`, `yMax`, `barColors: string[]`.
- Codegen: single-line `BarChart(values=[…], bar_names=[…], y_range=[0, <yMax>, <yMax/5>], …)` with computed numeric literals; `barNames` sanitized with the `safeMatrixEntry` pattern (they become Tex).
- Preview: simple Konva rect bars. Values editor adapts the matrix grid editor pattern.

Both types stay **out of** `GRADIENT_TYPES`, `DASH_TYPES`, `SHADOW_TYPES`.

**Files:** `packages/manim-codegen/src/objects.ts` (+`constants.ts`/`types.ts`), `services/web/src/export/manim.ts`, `configs/text.ts`/`dataObjects.ts`, `StageCanvas.vue` (template branch), `store/project.ts` (defaults), `object-settings/*` + registry, `AssetSidebar.vue`, tests.

## Track D — Editor UX pack (`feat/wave1-ux-pack`)

Widest touch; merges last.

1. **Right-click context menu** (canvas: on object + on empty area): cut/copy/paste/duplicate/delete, bring-to-front/send-to-back, lock/hide. New `ContextMenu.vue` calling existing store actions. Timeline clip menu is Wave 2.
2. **Marquee selection**: drag on empty canvas draws a selection box; contained objects become the multi-selection, and the selection drags together. Lives in `useStageInteractions.ts` + an overlay rect. **2D mode only** (disabled in the 3D split viewport).
3. **Lock / hide**: optional `obj.locked` / `obj.hidden` fields (absent = legacy behavior). Locked → not clickable/draggable on canvas, still selectable from the timeline (Figma behavior). Hidden → not drawn in preview **and skipped by codegen** (a hidden object does not appear in the video). **Known loss:** hidden objects cannot survive a `.py` round-trip (they're absent from the script). Eye/lock icons on timeline object bars.
4. **Autosave**: project JSON to `localStorage` on a 2 s debounce; on startup, offer "unsaved work found — restore?"; cleared/refreshed on New/Open. Assets stay as URL references, so payloads are small.

**Files:** `useStageInteractions.ts`, `StageCanvas.vue`, new `ContextMenu.vue`, `App.vue`, `store/project.ts` (lock/hide/autosave actions), `Timeline.vue`, `packages/manim-codegen/src/index.ts` (hidden filter), tests.

---

## Execution architecture

```
Orchestrator (main session)
 ├─ this spec + 4 implementation plans (one per track)   → USER CHECKPOINT
 ├─ dispatch 4 general-purpose subagents
 │    isolation: worktree · run_in_background · own branch · TDD · small commits
 ├─ integration order (ascending conflict risk): A → B → C → D
 │    per merge: rebase branch on current main → FULL GATE → merge → short user report
 └─ final report + Wave 2 backlog
```

- **Merge gate (mandatory per track):** `npm run test:unit` (618+), engine `npm test` (114), api tests (43), codegen tests (6), `npm run lint`, `npm run typecheck`, `npm run format:check`.
- **Conflict surface:** `store/project.ts` is touched by two tracks (C: object defaults, D: new actions) and `App.vue` by two tracks (B: render dialog mount, D: context-menu/autosave wiring) — different regions in both files; the orchestrator resolves any rebase conflict manually. C touches `objects.ts` while D touches `index.ts` in the codegen package — disjoint files.
- **Failure handling:** if a subagent stalls or fails, its worktree is preserved and the orchestrator takes over or redispatches; other tracks are unaffected.
- **Checkpoints requiring user approval:** (1) after the 4 plans are written, before dispatch; (2) a short report at each merge; (3) final report.

## Testing strategy

TDD inside every track (failing test first; see each plan). Integration relies on the merge gate above rather than cross-track coordination. Track B adds api validation tests for the new enums; Track C adds codegen byte-stability + round-trip + python-validity coverage; Track D adds store action tests, marquee geometry tests, a ContextMenu component test, an autosave save/restore test, and a codegen hidden-skip test.

## Risks

| Risk | Mitigation |
|---|---|
| `store/project.ts` rebase conflict (C↔D) | Different regions; D merges last; orchestrator resolves |
| `App.vue` rebase conflict (B↔D) | B's diff kept minimal via new `RenderOptionsDialog.vue`; different regions (render fn vs. mount/shortcut wiring) |
| Both C and D touch `@manim/codegen` | Disjoint files (`objects.ts` vs `index.ts`) |
| GIF/WebM render time | Existing render rate-limit retained |
| 4 worktrees × npm install on Windows | Each agent's first step; worktrees deleted after integration |
| CE 0.19 `Code`/`BarChart` signature details | Verified via context7 during planning, before code |

## Wave 2 backlog (explicitly out of scope)

Rulers + guides + smart snapping · inline text editing (double-click) · timeline clip context menu · scene sections (`next_section`) · PNG sequence + transparent WebM export · easing map expansion (lossy mappings) · multi-line-robust parser · `vector_field` comma round-trip · e2e expansion beyond 9 smoke tests · mini-map / object search / recent colors / numeric scrubbing.
