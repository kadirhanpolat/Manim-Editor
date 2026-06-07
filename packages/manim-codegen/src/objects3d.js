import { vn, hex, safeOpacity, fmt3d, safeMathExpr } from './helpers.js';

export function objectCode3d(obj) {
  const n = vn(obj.id);
  const lines = [];
  const fill = hex(obj.fill) || '"#FFFFFF"';
  const opacity = safeOpacity(obj.opacity ?? 1);
  const res = Math.max(4, Math.round(obj.resolution ?? 20));

  const pos = () => `[${fmt3d(obj.x3d ?? 0)}, ${fmt3d(obj.y3d ?? 0)}, ${fmt3d(obj.z3d ?? 0)}]`;

  switch (obj.type) {
    case 'sphere':
      lines.push(`${n} = Sphere(radius=${fmt3d(obj.radius ?? 0.5)}, resolution=(${res}, ${res}))`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'cube':
      lines.push(`${n} = Cube(side_length=${fmt3d(obj.sideLength ?? 1.0)})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'prism':
      lines.push(
        `${n} = Prism(dimensions=[${fmt3d(obj.dimX ?? 2)}, ${fmt3d(obj.dimY ?? 1)}, ${fmt3d(obj.dimZ ?? 1)}])`
      );
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'cone':
      lines.push(
        `${n} = Cone(base_radius=${fmt3d(obj.radius ?? 0.5)}, height=${fmt3d(obj.height ?? 1.0)}, resolution=${res})`
      );
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'cylinder':
      lines.push(
        `${n} = Cylinder(radius=${fmt3d(obj.radius ?? 0.5)}, height=${fmt3d(obj.height ?? 1.5)}, resolution=${res})`
      );
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'torus':
      lines.push(
        `${n} = Torus(major_radius=${fmt3d(obj.majorRadius ?? 1.0)}, minor_radius=${fmt3d(obj.minorRadius ?? 0.3)}, resolution=${res})`
      );
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    case 'axes3d': {
      const xr = obj.xRange ?? [-3, 3, 1];
      const yr = obj.yRange ?? [-3, 3, 1];
      const zr = obj.zRange ?? [-3, 3, 1];
      lines.push(
        `${n} = ThreeDAxes(x_range=[${xr[0]}, ${xr[1]}, ${xr[2]}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2]}], z_range=[${zr[0]}, ${zr[1]}, ${zr[2]}])`
      );
      if ((obj.x3d ?? 0) !== 0 || (obj.y3d ?? 0) !== 0 || (obj.z3d ?? 0) !== 0) {
        lines.push(`${n}.move_to(${pos()})`);
      }
      break;
    }
    case 'surface': {
      const z = safeMathExpr(obj.zExpr, 'x**2 - y**2');
      const xr = obj.xRange ?? [-2, 2];
      const yr = obj.yRange ?? [-2, 2];
      lines.push(
        `${n} = Surface(lambda x, y: np.array([x, y, ${z}]), u_range=[${fmt3d(xr[0])}, ${fmt3d(xr[1])}], v_range=[${fmt3d(yr[0])}, ${fmt3d(yr[1])}], resolution=(${res}, ${res}))`
      );
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to(${pos()})`);
      break;
    }
    default:
      lines.push(`# Unknown 3D type: ${obj.type}`);
  }
  return lines;
}
