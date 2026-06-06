// type -> settings component. Each per-type task adds one import + one entry.
import DotGridSettings from './DotGridSettings.vue';
import StarSettings from './StarSettings.vue';
import PolygonSettings from './PolygonSettings.vue';
import PolygonFreeSettings from './PolygonFreeSettings.vue';
import AnnulusSettings from './AnnulusSettings.vue';
import ArcSectorSettings from './ArcSectorSettings.vue';
import ParametricSettings from './ParametricSettings.vue';
import VectorFieldSettings from './VectorFieldSettings.vue';
import TableSettings from './TableSettings.vue';
import MatrixSettings from './MatrixSettings.vue';
import BraceSettings from './BraceSettings.vue';
import AngleSettings from './AngleSettings.vue';
import CounterSettings from './CounterSettings.vue';
import GraphSettings from './GraphSettings.vue';
import LatexSettings from './LatexSettings.vue';
import PolarPlaneSettings from './PolarPlaneSettings.vue';
import PlaneRangeSettings from './PlaneRangeSettings.vue';
import AxesSettings from './AxesSettings.vue';
const REGISTRY = {
  dot_grid: DotGridSettings,
  star: StarSettings,
  polygon: PolygonSettings,
  polygon_free: PolygonFreeSettings,
  annulus: AnnulusSettings,
  arc: ArcSectorSettings,
  sector: ArcSectorSettings,
  parametric: ParametricSettings,
  vector_field: VectorFieldSettings,
  table: TableSettings,
  matrix: MatrixSettings,
  brace: BraceSettings,
  angle: AngleSettings,
  counter: CounterSettings,
  graph: GraphSettings,
  latex: LatexSettings,
  polar_plane: PolarPlaneSettings,
  numberplane: PlaneRangeSettings,
  complex_plane: PlaneRangeSettings,
  axes: AxesSettings,
};
export function settingsComponentFor(type) { return REGISTRY[type] || null; }
