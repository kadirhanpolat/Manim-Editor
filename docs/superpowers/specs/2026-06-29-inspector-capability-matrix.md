# Inspector Capability Matrix

**Date:** 2026-06-29  
**Purpose:** Make inspector coverage explicit for every addable object type and keep the registry, palette, and tests aligned.

## Shared Controls

The object inspector exposes the same core control surfaces across the product:

- `Name`
- `Position`
- `Size`
- `Rotation`
- `Fill`
- `Stroke`
- `Opacity`
- `Layer order`
- `Duration`
- `Entrance animation`
- `Exit animation`
- `Lock / Hide`

The shared surfaces are split across the main inspector, the context menu, and the motion picker.

## Type Families

- `basic`: rectangle, square, circle, ellipse, dot, heart, triangle, line, arrow, double_arrow
- `geometry`: dot_grid, star, polygon, polygon_free, annulus, arc, sector, parametric, bezier
- `data`: table, matrix, graph, vector_field, vector_components, coord_point, counter, code, bar_chart
- `text`: text, latex
- `plane`: axes, numberplane, complex_plane, polar_plane, numberline, ray
- `annotation`: brace, angle, surrounding_rect, underline, cross
- `3d`: sphere, cube, prism, cone, cylinder, torus, axes3d, surface
- `asset`: image, svg_asset

## Special Panels

- `TextSettings`: text
- `LatexSettings`: latex
- `CodeSettings`: code
- `CounterSettings`: counter
- `BarChartSettings`: bar_chart
- `AxesSettings`: axes
- `PlaneRangeSettings`: numberplane, complex_plane
- `PolarPlaneSettings`: polar_plane
- `NumberLineSettings`: numberline
- `RaySettings`: ray
- `DotGridSettings`: dot_grid
- `StarSettings`: star
- `PolygonSettings`: polygon
- `PolygonFreeSettings`: polygon_free
- `AnnulusSettings`: annulus
- `ArcSectorSettings`: arc, sector
- `ParametricSettings`: parametric
- `BezierSettings`: bezier
- `TableSettings`: table
- `MatrixSettings`: matrix
- `GraphSettings`: graph
- `VectorFieldSettings`: vector_field
- `VectorComponentsSettings`: vector_components
- `CoordPointSettings`: coord_point
- `BraceSettings`: brace
- `AngleSettings`: angle
- `AnnotationSettings`: surrounding_rect, underline, cross

3D rows use `Position3DPanel`; `axes3d` adds range controls, `surface` adds the expression and surface ranges, and `prism` adds dimension fields.

## Source Of Truth

- [capability-matrix.ts](../../../services/web/src/components/inspector/capability-matrix.ts)

## Regression Coverage

- [inspector-capability-matrix.test.ts](../../../services/web/tests/components/inspector-capability-matrix.test.ts)
- [ui-tools-audit.test.ts](../../../services/web/tests/components/ui-tools-audit.test.ts)
