# Preview / Render Divergence Matrix

**Date:** 2026-06-29
**Status:** Living reference
**Purpose:** Record the preview-only differences that are expected in this editor so users and tests know what to trust and what to treat as an approximation.

This matrix is intentionally conservative. It documents differences that are visible in the current codebase and test harnesses, not hypothetical ones.

| Area | Preview behavior | Final render behavior | Status |
| --- | --- | --- | --- |
| Text layout and font metrics | Uses browser font loading and canvas layout. | Uses Manim's real text rendering in the render container. | Accepted difference |
| LaTeX layout | Uses browser-side approximation and preview geometry. | Uses Manim `MathTex`/render-time layout. | Accepted difference |
| 3D camera framing | Uses the editor's interactive 3D preview camera. | Uses Manim's final projection and camera pipeline. | Accepted difference |
| Gradients and antialiasing | Browser rasterization and Konva painting. | Manim rasterization in the worker container. | Accepted difference |
| Rounded corners and shadows | Canvas preview approximates visual styling. | Final render uses Manim's actual effect implementation. | Accepted difference |
| Emphasis clips | Preview shows the semantic effect in the editor surface. | Final render uses Manim's animation semantics. | Should match semantically |
| Paths and motion timing | Preview interpolates in the editor playback engine. | Final render uses the generated Manim animation. | Should match semantically |

## Current coverage

- Real render success coverage exists for geometric scenes, text/LaTeX, emphasis clips, sections, and 3D scenes in `services/web/tests/components/render-integration.test.ts`.
- Golden-frame regression coverage currently focuses on stable geometric scenes in `services/web/tests/components/render-golden.test.ts`.
- Text and LaTeX are intentionally excluded from the pixel baseline because font and LaTeX version drift make that corpus brittle.

## Policy

- If a row is marked "Accepted difference", do not treat it as a regression unless the change becomes surprising or breaks usability.
- If a row is marked "Should match semantically", a mismatch is a product bug and should be fixed or explicitly justified in the matrix.
- New visual features should either add a matrix entry or extend an existing one.
