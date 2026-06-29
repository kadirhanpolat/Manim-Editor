export type InspectorFamily =
  | 'basic'
  | 'geometry'
  | 'data'
  | 'text'
  | 'plane'
  | 'annotation'
  | '3d'
  | 'asset';

export interface InspectorCapabilityRow {
  type: string;
  family: InspectorFamily;
  settingsComponent: string | null;
  notes?: string;
}

export const SHARED_OBJECT_CONTROLS = [
  'Name',
  'Position',
  'Size',
  'Rotation',
  'Fill',
  'Stroke',
  'Opacity',
  'Layer order',
  'Duration',
  'Entrance animation',
  'Exit animation',
  'Lock / Hide',
] as const;

export const SHARED_EDITOR_SURFACES = ['ObjectInspector', 'ContextMenu', 'MotionPicker'] as const;

export const BASIC_TYPES = [
  'rectangle',
  'square',
  'circle',
  'ellipse',
  'dot',
  'heart',
  'triangle',
  'line',
  'arrow',
  'double_arrow',
] as const;

export const GEOMETRY_TYPES = [
  'dot_grid',
  'star',
  'polygon',
  'polygon_free',
  'annulus',
  'arc',
  'sector',
  'parametric',
  'bezier',
] as const;

export const DATA_TYPES = [
  'table',
  'matrix',
  'graph',
  'vector_field',
  'vector_components',
  'coord_point',
  'counter',
  'code',
  'bar_chart',
] as const;

export const TEXT_TYPES = ['text', 'latex'] as const;

export const PLANE_TYPES = ['axes', 'numberplane', 'complex_plane', 'polar_plane', 'numberline', 'ray'] as const;

export const ANNOTATION_TYPES = ['brace', 'angle', 'surrounding_rect', 'underline', 'cross'] as const;

export const THREE_D_TYPES = ['sphere', 'cube', 'prism', 'cone', 'cylinder', 'torus', 'axes3d', 'surface'] as const;

export const IMPORT_ONLY_TYPES = ['image', 'svg_asset'] as const;

function row(
  type: string,
  family: InspectorFamily,
  settingsComponent: string | null,
  notes?: string
): InspectorCapabilityRow {
  return { type, family, settingsComponent, notes };
}

export const INSPECTOR_CAPABILITY_MATRIX: readonly InspectorCapabilityRow[] = [
  ...BASIC_TYPES.map((type) => row(type, 'basic', null)),
  row('dot_grid', 'geometry', 'DotGridSettings'),
  row('star', 'geometry', 'StarSettings'),
  row('polygon', 'geometry', 'PolygonSettings'),
  row('polygon_free', 'geometry', 'PolygonFreeSettings'),
  row('annulus', 'geometry', 'AnnulusSettings'),
  row('arc', 'geometry', 'ArcSectorSettings'),
  row('sector', 'geometry', 'ArcSectorSettings'),
  row('parametric', 'geometry', 'ParametricSettings'),
  row('bezier', 'geometry', 'BezierSettings'),
  row('table', 'data', 'TableSettings'),
  row('matrix', 'data', 'MatrixSettings'),
  row('graph', 'data', 'GraphSettings'),
  row('vector_field', 'data', 'VectorFieldSettings'),
  row('vector_components', 'data', 'VectorComponentsSettings'),
  row('coord_point', 'data', 'CoordPointSettings'),
  row('counter', 'data', 'CounterSettings'),
  row('code', 'text', 'CodeSettings', 'Code blocks use the dedicated text/code panel.'),
  row('bar_chart', 'data', 'BarChartSettings'),
  row('text', 'text', 'TextSettings', 'Text uses TextSettings instead of the generic color row.'),
  row('latex', 'text', 'LatexSettings', 'LaTeX uses the dedicated math text editor.'),
  row('axes', 'plane', 'AxesSettings'),
  row('numberplane', 'plane', 'PlaneRangeSettings'),
  row('complex_plane', 'plane', 'PlaneRangeSettings'),
  row('polar_plane', 'plane', 'PolarPlaneSettings'),
  row('numberline', 'plane', 'NumberLineSettings'),
  row('ray', 'plane', 'RaySettings'),
  row('brace', 'annotation', 'BraceSettings'),
  row('angle', 'annotation', 'AngleSettings'),
  row('surrounding_rect', 'annotation', 'AnnotationSettings'),
  row('underline', 'annotation', 'AnnotationSettings'),
  row('cross', 'annotation', 'AnnotationSettings'),
  row(
    'sphere',
    '3d',
    null,
    '3D objects use the shared Position3DPanel for x3d/y3d/z3d and rotation fields.'
  ),
  row(
    'cube',
    '3d',
    null,
    '3D objects use the shared Position3DPanel for x3d/y3d/z3d and rotation fields.'
  ),
  row(
    'prism',
    '3d',
    null,
    'Position3DPanel also exposes the prism dimension inputs.'
  ),
  row(
    'cone',
    '3d',
    null,
    '3D objects use the shared Position3DPanel for x3d/y3d/z3d and rotation fields.'
  ),
  row(
    'cylinder',
    '3d',
    null,
    '3D objects use the shared Position3DPanel for x3d/y3d/z3d and rotation fields.'
  ),
  row(
    'torus',
    '3d',
    null,
    '3D objects use the shared Position3DPanel for x3d/y3d/z3d and rotation fields.'
  ),
  row(
    'axes3d',
    '3d',
    null,
    'Position3DPanel also exposes xRange/yRange/zRange for the 3D axes object.'
  ),
  row(
    'surface',
    '3d',
    null,
    'Position3DPanel also exposes zExpr plus the surface x/y ranges.'
  ),
  row('image', 'asset', null, 'Import-only asset type added from the asset sidebar.'),
  row('svg_asset', 'asset', null, 'Import-only asset type added from the asset sidebar.'),
] as const;

export const INSPECTOR_CAPABILITY_BY_TYPE = Object.fromEntries(
  INSPECTOR_CAPABILITY_MATRIX.map((row) => [row.type, row] as const)
) as Record<string, InspectorCapabilityRow>;

export const INSPECTOR_TYPES = INSPECTOR_CAPABILITY_MATRIX.map((row) => row.type);
