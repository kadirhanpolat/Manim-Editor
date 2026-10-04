# Preview / Render Divergence Matrix

**Date:** 2026-06-29 (updated 2026-10-04, template-quality pass)
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
| Rotation direction | `rotation` is Konva's: positive degrees turn clockwise on the y-down canvas. | Emitted negated (`rotate(-a)`, `Rotate(angle=-a)`, rotation keyframes), since Manim is counter-clockwise-positive; the parser negates back. Fixed 2026-10-04 (renders were mirrored before). | Should match |
| Point-built objects (angle, brace, polygon_free, bezier, ray, coord_point, vector_components) | Drawn around the object's origin (x/y + relative points). | Two invisible `VectorizedPoint`s mirror the bounding box through the origin (`ORIGIN_ANCHORED_TYPES`), so `move_to`/`set_x`/`MoveAlongPath`/rotate/scale act on that origin. Fixed 2026-10-04 (origins rendered 40–155 px away). `graph` is not anchored yet. | Should match |
| Angle | Rays + arc (counter-clockwise from ray 1, radius in Manim units) + label at 1.6× the arc midpoint; `RightAngle` arms 0.4 units (2/3 of the shorter ray if under 0.6). | `VGroup(l1, l2, Angle/RightAngle[, MathTex])` with the same rules. | Should match |
| Angle label glyphs | Plain text (`\theta` shows as typed). | Real `MathTex`. | Accepted difference |
| Dot size | Radius `width / 2` px. | `Dot(radius = width/2/sw · FRAME_WIDTH)` (was `FRAME_X_RADIUS`, half size, before 2026-10-04). | Should match |
| Graph tangent | Tangent at the chosen x. | `TangentLine(alpha=G.proportion_from_point(ax.i2gp(x, G)))`: TangentLine's alpha is an arc-length proportion, so the old linear x→alpha map put it at the wrong x. | Should match |
| Riemann rectangles | Fill opacity `RIEMANN_FILL_OPACITY` (0.45). | `fill_opacity=RIEMANN_FILL_OPACITY` (Manim's default 1 hid the curve). | Should match |
| NumberPlane | Background rect + center axes only (no grid lines, no tick labels). | Full `NumberPlane` with grid lines every `xRange[2]`/`yRange[2]` (codegen read the stale `xStep` before 2026-10-04). Grid colors are Manim's defaults; the object's fill/stroke are not applied. | Accepted difference (preview is a placeholder) |
| Simultaneous enter/exit + scene length | Objects starting together animate together; the timeline lasts `max(sceneDuration, end + 1)`. | Merged into one `self.play(A, B, …)`; waits measured from real elapsed time; tail `max(1, sceneDuration − elapsed)`. | Should match (sequential non-parallel clips at the same time still play one after another) |

## Current coverage

- Real render success coverage exists for geometric scenes, text/LaTeX, a styled triangle (gradient/rounded corners/shadow), emphasis clips, sections, 3D scenes, and **every palette template** in `services/web/tests/components/render-integration.test.ts`.
- Preview-parity unit tests: `services/web/tests/components/stage/editor-findings-preview.test.ts` (arrow tips, LaTeX sizing), `stage/angle-preview-parity.test.ts` (angle arc/elbow/label against Manim reference values), `math-expr.test.ts` (expression normalization); codegen side: `packages/manim-codegen/tests/rotation-direction.test.ts` and `origin-anchor.test.ts`.
- Template content is checked for geometric truth in `template-library.test.ts` (unit circle, vector addition, flow layout, graphs inside their axes, text `content`).
- Golden-frame regression coverage currently focuses on stable geometric scenes in `services/web/tests/components/render-golden.test.ts`.
- Text and LaTeX are intentionally excluded from the pixel baseline because font and LaTeX version drift make that corpus brittle.

## Policy

- If a row is marked "Accepted difference", do not treat it as a regression unless the change becomes surprising or breaks usability.
- If a row is marked "Should match semantically", a mismatch is a product bug and should be fixed or explicitly justified in the matrix.
- New visual features should either add a matrix entry or extend an existing one.
