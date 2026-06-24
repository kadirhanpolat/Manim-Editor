# Wave 3 — Quality & Trust Foundation Implementation Plan

**Spec:** `docs/superpowers/specs/2026-06-24-wave3-quality-trust-design.md`
**Branch:** `feat/wave3-quality-trust`
**Approach:** TDD, smallest safe steps, full gate green before commit.

## Pillar 2 — Parser round-trip for `next_section` (pure TS, do first)

- [x] **T1 (RED):** In `services/web/tests/components/manim-export.test.ts`, add `describe('parser round-trip — sections')` with:
  - a test that builds a project with `sections: [{id,time,title}]` + clips, `generateManimScript` → `parseManimScript`, and asserts both titles survive in time order.
  - a re-emit-stability test: `generate → parse → generate` yields identical `next_section(...)` lines.
- [x] **T2 (GREEN):** In `services/web/src/export/manim.ts`:
  - add `sections: { id: string; time: number; title: string }[]` to the `ParsedProject` interface (~line 63).
  - add a `const sections: ...[] = []` accumulator (~line 109).
  - in the body loop, match `/^self\.next_section\("(.*)"\)$/` and push `{ id: uid('section'), time: ct, title }`.
  - add `sections` to the returned object (~line 2858).
- [x] **T3 (wire consumer):** In `services/web/src/App.vue` `applyCodeToCanvas` (~line 1230), apply `if (Array.isArray(result.sections)) store.project.sections = result.sections;`.
- [x] **T4:** `npm run test:unit` green; `npm test` (engine) green.

## Pillar 1 — Render-truth harness (env-gated)

- [x] **T5:** New `services/web/tests/components/render-integration.test.ts`:
  - `hasManim()` via `execFileSync('manim', ['--version'])`; `RUN = process.env.RUN_MANIM_RENDER === '1' && hasManim()`.
  - `gen(setup)` store-driven corpus (mirror python-validity); `renderOne(name, py)` writes temp `.py`, extracts scene name by regex, runs `manim -ql -s --disable_caching`, asserts exit 0 + output PNG exists.
  - `describe.skipIf(!RUN)` with a self-check (broken Python fails) + one `it` per corpus row.
  - `afterAll` removes the temp dir.
- [x] **T6:** Add `"test:render": "vitest run tests/components/render-integration.test.ts"` to `services/web/package.json`.
- [x] **T7 (verify locally):** `RUN_MANIM_RENDER=1 npm run test:render` passes for every corpus row.

## Close-out

- [x] **T8:** Full gate — `npm run test:unit`, engine `npm test`, `npm test --workspace services/api`, `npm test --workspace packages/manim-codegen`, `npm run lint`, `npm run typecheck`, `npm run format:check`.
- [x] **T9:** Update `CLAUDE.md` (note `next_section` now round-trips; new `test:render` gate + render-truth harness; Manim 0.20.1 local) + README test counts.
- [x] **T10:** Commit on branch; report.
