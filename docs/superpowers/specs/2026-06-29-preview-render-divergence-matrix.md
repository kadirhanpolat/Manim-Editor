# Preview / Render Divergence Matrix

**Date:** 2026-06-29 (updated 2026-10-04)
**Status:** Living reference
**Purpose:** Record the preview-only differences that are expected in this editor so users and tests know what to trust and what to treat as an approximation.

This matrix is intentionally conservative. It documents differences that are visible in the current codebase and test harnesses, not hypothetical ones.

| Area | Preview behavior | Final render behavior | Status |
| --- | --- | --- | --- |
| Text layout and font metrics | Uses browser font loading and canvas layout. | Uses Manim's real text rendering in the render container. | Accepted difference |
| Text font family | Browser draws the chosen family (Arial, Times, …). | Microsoft core fonts render through metric-compatible clones (Arial/Helvetica → Arimo, Times → Tinos, Courier → Cousine, Georgia → Gelasio; `renderFontFor`); other system fonts fall back to a container font with no warning dump. | Should match in metrics |
| LaTeX glyphs | Unicode approximation (`latexToUnicode`). | Real `MathTex` typesetting. | Accepted difference |
| LaTeX size | Contain-fit into the object box, or an explicit `fontSize`. | Same rule: `.scale(min(W / m.width, H / m.height))` or `font_size=N`. | Should match |
| Math expressions (graphs, parametric, vector field, surface) | `compileExpr` after `normalizeMathExpr` (bare `exp`/`sin`/`pi` → `np.*`, `^` → `**`, Python-style unary minus). | The same normalized expression in the generated Python. | Should match exactly |
| Arrow tips | `arrowTipPx` (6× stroke, 28 px floor, ≤ ¼ length). | Same helper → `tip_length`. | Should match |
| 3D camera framing | Uses the editor's interactive 3D preview camera. | Uses Manim's final projection and camera pipeline. | Accepted difference |
| Gradients and antialiasing | Browser rasterization and Konva painting. | Manim rasterization in the worker container. | Accepted difference |
| Rounded corners and shadows | Canvas preview approximates visual styling. | Final render uses Manim's actual effect implementation. | Accepted difference |
| Emphasis clips | Preview shows the semantic effect in the editor surface. | Final render uses Manim's animation semantics. | Should match semantically |
| Paths and motion timing | Preview interpolates in the editor playback engine. | Final render uses the generated Manim animation. | Should match semantically |
| Simultaneous enter/exit + scene length | Objects starting together animate together; the timeline lasts `max(sceneDuration, end + 1)`. | Merged into one `self.play(A, B, …)`; waits measured from real elapsed time; tail `max(1, sceneDuration − elapsed)`. | Should match (sequential non-parallel clips at the same time still play one after another) |

## Current coverage

- Real render success coverage exists for geometric scenes, text/LaTeX, a styled triangle (gradient/rounded corners/shadow), emphasis clips, sections, 3D scenes, and **every palette template** in `services/web/tests/components/render-integration.test.ts`.
- Preview-parity unit tests: `services/web/tests/components/stage/editor-findings-preview.test.ts` (arrow tips, LaTeX sizing) and `math-expr.test.ts` (expression normalization).
- Golden-frame regression coverage currently focuses on stable geometric scenes in `services/web/tests/components/render-golden.test.ts`.
- Text and LaTeX are intentionally excluded from the pixel baseline because font and LaTeX version drift make that corpus brittle.

## Policy

- If a row is marked "Accepted difference", do not treat it as a regression unless the change becomes surprising or breaks usability.
- If a row is marked "Should match semantically", a mismatch is a product bug and should be fixed or explicitly justified in the matrix.
- New visual features should either add a matrix entry or extend an existing one.
