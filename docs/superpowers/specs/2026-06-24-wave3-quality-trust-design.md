# Wave 3 — Quality & Trust Foundation Design

**Date:** 2026-06-24
**Status:** Approved (autonomous execution of the post-Wave-2 gap analysis recommendation)
**Execution model:** single branch `feat/wave3-quality-trust`, TDD, sequential integration into `main`.

## Goal

Wave 1 and Wave 2 closed the **feature** backlog: the originally-envisioned product (the 2026-06-02 roadmap's three phases) is ~93% done and the delivered surface is far larger (TS migration, ~58 object types, effects, export formats, full UX). The remaining gaps are no longer "missing features" — they are **trust and verification** gaps. This wave attacks the two highest-value ones:

1. **Render-truth** — we generate Manim Python but never actually run it in tests. `codegen-python-validity.test.ts` only proves the output is *syntactically* valid (`python -m ast`); it cannot catch a wrong Manim API call, a runtime `TypeError`, or a constructor that parses but explodes at `construct()` time. Manim CE **v0.20.1 is available on this machine**, so we can render for real.
2. **Round-trip robustness** — codegen is a single source of truth and solid, but the `.py` → project parser (`parseManimScript`, web-only, 2888 lines, regex/line-based) silently drops data that *is present in the Python*. The flagship case: `self.next_section("…")` calls are emitted by codegen but never parsed back (Wave 3 backlog item), so scene sections are a one-way street.

## Background — what is and isn't fixable

Not every documented "round-trip loss" is a parser bug:

- **Hidden objects** never round-trip *by design* — `generateScene` filters hidden objects out entirely, so they are simply not in the Python. Fixing this would mean emitting hidden objects, which contradicts the codegen contract. **Out of scope.**
- **`locked` flags** have no Manim representation — lock only affects canvas interaction. Nothing to parse back. **Out of scope.**
- **`next_section("Title")`** — the title string *is* in the Python. This is a genuine, fixable drop. **In scope (flagship).**

## Scope

### Pillar 1 — Render-truth harness

A new env-gated test, `services/web/tests/components/render-integration.test.ts`, mirroring the `codegen-python-validity` pattern (store-driven `gen(setup)` corpus, child-process shell-out, self-skip when the tool is absent):

- **Gating:** runs only when `RUN_MANIM_RENDER=1` **and** `manim --version` succeeds. Default `npm run test:unit` stays fast and untouched — real Manim is heavy (3–5 s import per call) and must not bloat the standard suite. A dedicated `npm run test:render` script in `services/web/package.json` opts in.
- **Mechanism:** for each scene in a small representative corpus, generate Python via `generateManimScript(store.project)`, extract the scene class name by regex (`/class\s+(\w+)\s*\(/`), write to a temp `.py` under `os.tmpdir()`, and run `manim -ql -s --disable_caching <file> <SceneName>` (low quality, **save-last-frame only** — no full video, for speed). Assert exit code 0 and that the output PNG exists. Clean up temp dirs in `afterAll`.
- **Corpus (data-driven, easy to extend):** basic 2D shapes + move/fade clip · text + LaTeX · axes with a plotted graph · an emphasis clip (circumscribe) · a project with two `next_section` markers (ties Pillar 1 to Pillar 2) · a 3D scene (sphere + cube). Each is one row; adding coverage is one line.

**Explicit non-goal — cross-engine pixel parity.** Pixel-diffing the Konva preview against the Manim raster is *not* the goal and is deliberately excluded: the two use different rasterizers, antialiasing, and font stacks, so a pixel diff would be all noise. "Render-truth" means **the generated Python renders without error in real Manim** — the foundational guarantee the project has never had. Golden-frame *regression* snapshots (render-vs-our-own-output-over-time, via perceptual hash) are a clean follow-up increment, specced in the backlog below, not built here.

### Pillar 2 — Parser round-trip: `next_section`

- `ParsedProject` (manim.ts:63) gains `sections: { id: string; time: number; title: string }[]`.
- A `sections` accumulator is added beside the other parser state (~manim.ts:109).
- The main body loop matches `self.next_section("Title")` lines and pushes `{ id, time: ct, title }`, where `ct` is the current accumulated playback time at the point the marker appears. Because codegen emits a section immediately before the first step whose `time ≥ section.time`, capturing `ct` (the pre-step time) reconstructs a placement that **re-emits identically** — the round-trip invariant.
- The return object (manim.ts:2858) includes `sections`.
- The consumer `applyCodeToCanvas` (App.vue:1230) applies `result.sections` to `store.project.sections` (guarded `Array.isArray`).
- Title escaping: codegen writes the title as a plain double-quoted Python string; the parser unescapes accordingly (titles with `"` are not currently emitted-escaped by codegen — captured as a known minor limitation, not expanded here).

## Testing strategy (TDD)

- **Pillar 2 first (pure, fast, no Manim):** add `describe('parser round-trip — sections')` to `manim-export.test.ts` — generate a project with two sections + clips, parse it back, assert both titles survive and times are ordered. Watch it RED, implement, GREEN. Add a second test asserting generate→parse→generate produces byte-identical `next_section` lines (the re-emit invariant).
- **Pillar 1:** the harness *is* the test. A self-check row (a deliberately-broken Python string) proves the harness has teeth (mirrors the python-validity self-check). Gated off by default; run locally with `RUN_MANIM_RENDER=1 npm run test:render`.
- **Full gate unchanged:** `test:unit`, engine `npm test`, api tests, codegen tests, `lint`, `typecheck`, `format:check` — all must stay green.

## Risks

| Risk | Mitigation |
|---|---|
| Real Manim render slow/flaky in CI | Opt-in only (`RUN_MANIM_RENDER=1`); never part of `test:unit`; `-ql -s` renders one frame, not a video. |
| Manim version drift (CLAUDE.md cites 0.19; local is 0.20.1) | Harness asserts render success, not exact output; version-agnostic. Note the discrepancy in docs. |
| `next_section` time reconstruction imprecise | Round-trip invariant is *re-emit stability*, not exact original `time`; covered by the generate→parse→generate test. |
| Section title with embedded quote | Out of scope; documented limitation. Codegen does not currently emit such titles escaped. |
| Temp-file leakage from harness | `afterAll` cleanup + unique `os.tmpdir()` subdir per run. |

## Wave 3+ backlog status

Completed after this spec: golden-frame **regression** snapshots, render harness as a non-blocking CI job, multi-line-robust parser, `vector_field` comma round-trip, grid-aware snapping, and object search / command palette.

Remaining low-priority backlog: `next_section` title-quote escaping · mini-map · parallel render worker · rulers/inline-text in 3D viewport.
