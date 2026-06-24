/**
 * Manim Python Code Exporter + Parser v4
 *
 * CODEGEN:  project JSON → clean Manim CE scene.py
 * PARSER:   Manim code   → project JSON (objects + clips)
 *
 * Supports: rectangle, square, circle, ellipse, triangle, star, polygon,
 *           line, arrow, heart, dot, dot_grid, text, image, svg_asset, groups
 */

// The generator is a thin wrapper over @manim/codegen (see generateManimScript
// below). The PARSER (rest of this file) only needs these few shared symbols.
import {
  EASING_MAP,
  FRAME_WIDTH,
  FRAME_HEIGHT,
  FRAME_X_RADIUS,
  generateScene,
} from '@manim/codegen';
import type { Project, SceneObject, Clip } from '@manim/codegen';

// ── Helpers ─────────────────────────────────────────────────────────────────

const EASING_REV: Record<string, string> = {};
for (const [k, val] of Object.entries(EASING_MAP)) EASING_REV[val as string] = k;

function manimToStage(mx: number, my: number, w: number, h: number): { x: number; y: number } {
  return { x: (mx / FRAME_WIDTH + 0.5) * w, y: (-my / FRAME_HEIGHT + 0.5) * h };
}

/** Inverse of @manim/codegen `latexUnit`: restore a DecimalNumber `unit` back to the
    raw suffix (un-double backslashes, then drop the LaTeX escape before specials). */
export function unescapeUnit(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/\\\\/g, '\\')
    .replace(/\\([%&#_${}])/g, '$1');
}

/** Inverse of @manim/codegen `pyMultiline`. Single regex pass so an escaped
 *  backslash followed by `n` (`\\n` in the .py source) restores to
 *  backslash+n, NOT to a newline. */
export function unescapePyMultiline(s: unknown): string {
  return String(s == null ? '' : s).replace(/\\(\\|n|t|")/g, (_, c: string) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CODEGEN: project → Manim Python (thin wrapper — logic lives in @manim/codegen)
// ═════════════════════════════════════════════════════════════════════════════

export function generateManimScript(project: Project): string {
  const resolveAsset = (obj: SceneObject, ext: string): string =>
    `${obj.name || (ext === 'svg' ? 'asset' : 'image')}.${ext}`;
  return generateScene(project, { resolveAsset });
}

// ═════════════════════════════════════════════════════════════════════════════
// PARSER: Manim Python → project JSON
// ═════════════════════════════════════════════════════════════════════════════

/** Partial result type returned by the parser (subset of Project). */
interface ParsedProject {
  objects: SceneObject[];
  tracks: { id: string; name: string; clips: Clip[] }[];
  stage: { backgroundColor: string; width: number; height: number };
  sceneType: '2d' | '3d';
  cameraType: 'static' | 'moving';
  cameraTrack: Clip[];
  sections: { id: string; time: number; title: string }[];
}

/** Partial clip used internally by parseAnimExpr. */
interface ParsedAnimClip {
  type: string;
  sourceId: string;
  targetId?: string;
  matchTerms?: boolean;
  params?: Record<string, unknown>;
}

/** Pending path point in Manim coordinates. */
interface ManimPoint {
  mx: number;
  my: number;
  mz: number;
}

/**
 * Bracket-depth change of a line, ignoring brackets inside Python string
 * literals and trailing `#` comments — used to detect statements that continue
 * onto the next physical line.
 */
function bracketDelta(line: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '#') break;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
  }
  return depth;
}

/**
 * Collapse a multi-physical-line statement to the single-line, tight spacing the
 * per-line regexes expect: drop whitespace just inside `([{` and just before
 * `)]}`, collapse runs to one space — all while preserving string contents.
 */
function normalizeJoined(parts: string[]): string {
  const joined = parts.map((p) => p.trim()).join(' ');
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < joined.length; i++) {
    const c = joined[i];
    if (quote) {
      out += c;
      if (c === '\\' && i + 1 < joined.length) out += joined[++i];
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      continue;
    }
    if (c === ' ') {
      const prev = out[out.length - 1];
      const next = joined[i + 1];
      if (prev === '(' || prev === '[' || prev === '{') continue;
      if (next === ')' || next === ']' || next === '}') continue;
      if (prev === ' ' || prev === undefined) continue;
      out += ' ';
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Split source into LOGICAL lines: a statement whose brackets are unbalanced
 * absorbs following physical lines until balanced. A single balanced physical
 * line passes through with only `.trim()` — byte-identical to the previous
 * behavior, so single-line codegen output (and every existing round-trip test)
 * is unaffected; only genuinely multi-line input is reflowed.
 */
function joinLogicalLines(rawLines: string[]): string[] {
  const out: string[] = [];
  let parts: string[] = [];
  let depth = 0;
  for (const raw of rawLines) {
    parts.push(raw);
    depth += bracketDelta(raw);
    if (depth <= 0) {
      out.push(parts.length === 1 ? parts[0].trim() : normalizeJoined(parts));
      parts = [];
      depth = 0;
    }
  }
  if (parts.length) out.push(normalizeJoined(parts));
  return out;
}

/**
 * Parse Manim Python code back into project objects, tracks, and stage.
 */
export function parseManimScript(code: string, sw = 1920, sh = 1080): ParsedProject {
  const lines = joinLogicalLines(code.split('\n'));
  const objects: SceneObject[] = [];
  const clips: Clip[] = [];
  const varMap: Record<string, string> = {};
  const objById: Record<string, SceneObject> = {};
  const graphVarMap: Record<string, Record<string, unknown>> = {};
  const relLineMap: Record<string, { start: [number, number]; end: [number, number] }> = {}; // <var> → { start: [mx, my], end: [mx, my] } for angle helper Lines
  const vcPending: Record<string, { vx: number; vy: number }> = {}; // <prefix> → { vx, vy } for vector_components, resolved on its VGroup line
  const rayPending: Record<string, { angle: number; length: number }> = {}; // <prefix> → { angle, length } for ray, resolved on its VGroup line
  const coordPending: Record<string, { decimals: number }> = {}; // <prefix> → { decimals } for coord_point, resolved on its VGroup line
  const pendingShadow: Record<string, { color: string; opacity: number; dx: number; dy: number }> =
    {}; // base var → { color, opacity, dx, dy } awaiting its VGroup line
  const pendingCount: Record<string, { from: number; objVar?: string }> = {}; // _count_<cn> var → { from, objVar } awaiting self.play(animate.set_value)

  let bgColor = '#000000';
  let cameraType: 'static' | 'moving' = 'static';
  let sceneType: '2d' | '3d' = '2d';
  const cameraTrack: Clip[] = [];
  const sections: { id: string; time: number; title: string }[] = [];
  let ct = 0;
  let clipIdx = 0;
  let objIdx = 0;

  const uid = (prefix: string): string =>
    `${prefix}_${Date.now().toString(36)}_${(objIdx++).toString(36)}`;

  const pendingPaths: Record<string, ManimPoint[]> = {}; // varName → [{ mx, my, mz }]

  function parseAnimExpr(expr: string): ParsedAnimClip | null {
    expr = expr.trim();
    let m2: RegExpMatchArray | null;
    // obj.animate.move_to([x, y, 0])
    m2 = expr.match(/^(\w+)\.animate\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*0\]\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      const sp = manimToStage(parseFloat(m2[2]), parseFloat(m2[3]), sw, sh);
      return {
        type: 'move',
        sourceId: id,
        params: { targetX: Math.round(sp.x), targetY: Math.round(sp.y) },
      };
    }
    // obj.animate.scale(s)
    m2 = expr.match(/^(\w+)\.animate\.scale\(([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return {
        type: 'scale',
        sourceId: id,
        params: { targetScaleX: parseFloat(m2[2]), targetScaleY: parseFloat(m2[2]) },
      };
    }
    // obj.animate.set_opacity(o)
    m2 = expr.match(/^(\w+)\.animate\.set_opacity\(([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return { type: 'fade', sourceId: id, params: { targetOpacity: parseFloat(m2[2]) } };
    }
    // FadeOut(obj)
    m2 = expr.match(/^FadeOut\((\w+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return { type: 'fade', sourceId: id, params: { targetOpacity: 0 } };
    }
    // Rotate(obj, angle=a)
    m2 = expr.match(/^Rotate\((\w+),\s*angle=([-\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return {
        type: 'rotate',
        sourceId: id,
        params: { targetRotation: Math.round((parseFloat(m2[2]) * 180) / Math.PI) },
      };
    }
    // Indicate(obj, color="#hex", scale_factor=f)
    m2 = expr.match(/^Indicate\((\w+),\s*color="([^"]+)",\s*scale_factor=([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return {
        type: 'indicate',
        sourceId: id,
        params: { color: m2[2], scale_factor: parseFloat(m2[3]) },
      };
    }
    // Flash(obj, color=, flash_radius=, line_length=, num_lines=)
    m2 = expr.match(
      /^Flash\((\w+),\s*color="([^"]+)",\s*flash_radius=([\d.]+),\s*line_length=([\d.]+),\s*num_lines=(\d+)\)/
    );
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return {
        type: 'flash',
        sourceId: id,
        params: {
          color: m2[2],
          flash_radius: parseFloat(m2[3]),
          line_length: parseFloat(m2[4]),
          num_lines: parseInt(m2[5], 10),
        },
      };
    }
    // Wiggle(obj, scale_value=, rotation_angle=d * DEGREES, n_wiggles=)
    m2 = expr.match(
      /^Wiggle\((\w+),\s*scale_value=([\d.]+),\s*rotation_angle=([\d.]+) \* DEGREES,\s*n_wiggles=(\d+)\)/
    );
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return {
        type: 'wiggle',
        sourceId: id,
        params: {
          scale_value: parseFloat(m2[2]),
          rotation_angle: parseFloat(m2[3]),
          n_wiggles: parseInt(m2[4], 10),
        },
      };
    }
    // Circumscribe(obj, color=, shape=Class, fade_out=Bool, time_width=)
    m2 = expr.match(
      /^Circumscribe\((\w+),\s*color="([^"]+)",\s*shape=(Rectangle|Circle),\s*fade_out=(True|False),\s*time_width=([\d.]+)\)/
    );
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return {
        type: 'circumscribe',
        sourceId: id,
        params: {
          color: m2[2],
          shape: m2[3],
          fade_out: m2[4] === 'True',
          time_width: parseFloat(m2[5]),
        },
      };
    }
    // FocusOn(obj, color=, opacity=)
    m2 = expr.match(/^FocusOn\((\w+),\s*color="([^"]+)",\s*opacity=([\d.]+)\)/);
    if (m2) {
      const id = varMap[m2[1]];
      if (!id) return null;
      return {
        type: 'focus_on',
        sourceId: id,
        params: { color: m2[2], opacity: parseFloat(m2[3]) },
      };
    }
    // ReplacementTransform / FadeTransform / TransformMatchingTex / TransformMatchingShapes
    m2 = expr.match(
      /^(ReplacementTransform|FadeTransform|Transform|TransformMatchingTex|TransformMatchingShapes)\((\w+),\s*(\w+)\)/
    );
    if (m2) {
      const animName = m2[1];
      const srcId = varMap[m2[2]],
        tgtId = varMap[m2[3]];
      if (!srcId || !tgtId) return null;
      const clip: ParsedAnimClip = { type: 'transform', sourceId: srcId, targetId: tgtId };
      if (animName === 'TransformMatchingTex' || animName === 'TransformMatchingShapes')
        clip.matchTerms = true;
      return clip;
    }
    return null;
  }

  for (const line of lines) {
    let m: RegExpMatchArray | null;

    // MovingCameraScene
    m = line.match(/^class\s+\w+\(MovingCameraScene\)/);
    if (m) {
      cameraType = 'moving';
      continue;
    }

    // ThreeDScene → 3D sahne
    m = line.match(/^class\s+\w+\(ThreeDScene/);
    if (m) {
      sceneType = '3d';
      continue;
    }

    // Background
    m = line.match(/self\.camera\.background_color\s*=\s*["']([^"']+)["']/);
    if (m) {
      bgColor = m[1];
      continue;
    }

    // Scene section marker — self.next_section("Title"). codegen emits this
    // immediately before the first step at/after section.time, so the current
    // accumulated time (ct, pre-wait) reconstructs a placement that re-emits
    // identically. Round-trips a Wave 2 feature that was previously one-way.
    m = line.match(/^self\.next_section\("(.*)"\)$/);
    if (m) {
      sections.push({ id: uid('section'), time: ct, title: m[1] });
      continue;
    }

    // Square
    m = line.match(/^(\w+)\s*=\s*Square\(side_length=([\d.]+)\)/);
    if (m) {
      const [, name, sl] = m;
      const size = Math.round((parseFloat(sl) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'square',
        name,
        x: sw / 2,
        y: sh / 2,
        width: size,
        height: size,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // RoundedRectangle (rectangle/square with cornerRadius)
    m = line.match(
      /^(\w+)\s*=\s*RoundedRectangle\(corner_radius=([\d.]+),\s*width=([\d.]+),\s*height=([\d.]+)\)/
    );
    if (m) {
      const [, name, cr, w, h] = m;
      const width = Math.round((parseFloat(w) / FRAME_WIDTH) * sw);
      const height = Math.round((parseFloat(h) / FRAME_HEIGHT) * sh);
      const type = Math.abs(parseFloat(w) - parseFloat(h)) < 0.01 ? 'square' : 'rectangle';
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type,
        name,
        x: sw / 2,
        y: sh / 2,
        width,
        height,
        cornerRadius: Math.round((parseFloat(cr) / FRAME_WIDTH) * sw),
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Rectangle
    m = line.match(/^(\w+)\s*=\s*Rectangle\(width=([\d.]+),\s*height=([\d.]+)\)/);
    if (m) {
      const [, name, w, h] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'rectangle',
        name,
        x: sw / 2,
        y: sh / 2,
        width: Math.round((parseFloat(w) / FRAME_WIDTH) * sw),
        height: Math.round((parseFloat(h) / FRAME_HEIGHT) * sh),
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Circle
    m = line.match(/^(\w+)\s*=\s*Circle\(radius=([\d.]+)\)/);
    if (m) {
      const [, name, r] = m;
      const size = Math.round(((parseFloat(r) * 2) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'circle',
        name,
        x: sw / 2,
        y: sh / 2,
        width: size,
        height: size,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Annulus
    m = line.match(/^(\w+)\s*=\s*Annulus\(inner_radius=([\d.]+),\s*outer_radius=([\d.]+)\)/);
    if (m) {
      const [, name, ri, ro] = m;
      const innerRadius = Math.round((parseFloat(ri) / FRAME_WIDTH) * sw);
      const outerRadius = Math.round((parseFloat(ro) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'annulus',
        name,
        x: sw / 2,
        y: sh / 2,
        width: outerRadius * 2,
        height: outerRadius * 2,
        innerRadius,
        outerRadius,
        fill: '#14b8a6',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Arc
    m = line.match(
      /^(\w+)\s*=\s*Arc\(radius=([\d.]+),\s*start_angle=([-\d.]+) \* DEGREES,\s*angle=([-\d.]+) \* DEGREES\)/
    );
    if (m) {
      const [, name, r, a0, sw_] = m;
      const radius = Math.round((parseFloat(r) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'arc',
        name,
        x: sw / 2,
        y: sh / 2,
        width: radius * 2,
        height: radius * 2,
        radius,
        startAngle: parseFloat(a0),
        sweepAngle: parseFloat(sw_),
        fill: 'transparent',
        stroke: '#f97316',
        strokeWidth: 4,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Sector
    m = line.match(
      /^(\w+)\s*=\s*Sector\(radius=([\d.]+),\s*start_angle=([-\d.]+) \* DEGREES,\s*angle=([-\d.]+) \* DEGREES\)/
    );
    if (m) {
      const [, name, r, a0, sw_] = m;
      const radius = Math.round((parseFloat(r) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'sector',
        name,
        x: sw / 2,
        y: sh / 2,
        width: radius * 2,
        height: radius * 2,
        radius,
        startAngle: parseFloat(a0),
        sweepAngle: parseFloat(sw_),
        fill: '#f59e0b',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // DoubleArrow
    m = line.match(
      /^(\w+)\s*=\s*DoubleArrow\(start=LEFT \* ([\d.]+), end=RIGHT \* ([\d.]+), color=["']([^"']+)["']/
    );
    if (m) {
      const [, name, half, , color] = m;
      const width = Math.round(((parseFloat(half) * 2) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'double_arrow',
        name,
        x: sw / 2,
        y: sh / 2,
        width,
        height: 40,
        fill: color,
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Arrow
    m = line.match(
      /^(\w+)\s*=\s*Arrow\(start=LEFT \* ([\d.]+), end=RIGHT \* ([\d.]+), color=["']([^"']+)["']/
    );
    if (m) {
      const [, name, half, , color] = m;
      const width = Math.round(((parseFloat(half) * 2) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'arrow',
        name,
        x: sw / 2,
        y: sh / 2,
        width,
        height: 40,
        fill: color,
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Ellipse
    m = line.match(/^(\w+)\s*=\s*Ellipse\(width=([\d.]+),\s*height=([\d.]+)\)/);
    if (m) {
      const [, name, w, h] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'ellipse',
        name,
        x: sw / 2,
        y: sh / 2,
        width: Math.round((parseFloat(w) / FRAME_WIDTH) * sw),
        height: Math.round((parseFloat(h) / FRAME_HEIGHT) * sh),
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Triangle
    m = line.match(/^(\w+)\s*=\s*Triangle\(\)\.scale\(([\d.]+)\)/);
    if (m) {
      const [, name, sc] = m;
      const size = Math.round((parseFloat(sc) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'triangle',
        name,
        x: sw / 2,
        y: sh / 2,
        width: size,
        height: size,
        fill: '#f59e0b',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Star
    m = line.match(
      /^(\w+)\s*=\s*Star\(n=(\d+),\s*outer_radius=([\d.]+),\s*inner_radius=([\d.]+)\)/
    );
    if (m) {
      const [, name, arms, outerR, innerR] = m;
      const size = Math.round(((parseFloat(outerR) * 2) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'star',
        name,
        x: sw / 2,
        y: sh / 2,
        width: size,
        height: size,
        starArms: parseInt(arms),
        innerRatio: parseFloat(innerR) / parseFloat(outerR),
        fill: '#eab308',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // RegularPolygon
    m = line.match(/^(\w+)\s*=\s*RegularPolygon\(n=(\d+)\)\.scale\(([\d.]+)\)/);
    if (m) {
      const [, name, sides, sc] = m;
      const size = Math.round(((parseFloat(sc) * 2) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'polygon',
        name,
        x: sw / 2,
        y: sh / 2,
        width: size,
        height: size,
        sides: parseInt(sides),
        fill: '#8b5cf6',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Polygon (free-vertex)
    m = line.match(
      /^(\w+)\s*=\s*Polygon\((\[[-\d.]+,\s*[-\d.]+,\s*0\](?:,\s*\[[-\d.]+,\s*[-\d.]+,\s*0\])+)\)/
    );
    if (m) {
      const [, name, body] = m;
      const verts: [number, number][] = [];
      const re = /\[([-\d.]+),\s*([-\d.]+),\s*0\]/g;
      let v: RegExpExecArray | null;
      while ((v = re.exec(body)) !== null) {
        verts.push([
          Math.round((parseFloat(v[1]) / FRAME_WIDTH) * sw),
          Math.round((-parseFloat(v[2]) / FRAME_HEIGHT) * sh),
        ]);
      }
      const xs = verts.map((p) => p[0]),
        ys = verts.map((p) => p[1]);
      const width = Math.max(...xs) - Math.min(...xs),
        height = Math.max(...ys) - Math.min(...ys);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'polygon_free',
        name,
        x: sw / 2,
        y: sh / 2,
        width,
        height,
        vertices: verts,
        fill: '#8b5cf6',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Bezier — created from <n>.set_points_smoothly([...]). The preceding `<n> = VMobject()`
    // line is intentionally NOT matched here (it's shared with path_move's path VMobject);
    // only set_points_smoothly is bezier-specific, so we build the object from that line.
    m = line.match(/^(\w+)\.set_points_smoothly\(\[(.+)\]\)/);
    if (m) {
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'bezier',
        name: m[1],
        x: sw / 2,
        y: sh / 2,
        width: 220,
        height: 120,
        vertices: [...m[2].matchAll(/\[([-\d.]+),\s*([-\d.]+),\s*0\]/g)].map((mm) => [
          Math.round((parseFloat(mm[1]) / FRAME_WIDTH) * sw),
          Math.round((-parseFloat(mm[2]) / FRAME_HEIGHT) * sh),
        ]),
        fill: 'transparent',
        stroke: '#f472b6',
        strokeWidth: 3,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[m[1]] = id;
      objById[id] = obj;
      continue;
    }

    // Graph / DiGraph (single-line, manual layout)
    m = line.match(
      /^(\w+) = (Graph|DiGraph)\(\[(.*?)\], \[(.*?)\], layout=\{(.*?)\}(, labels=True)?\)/
    );
    if (m) {
      const directed = m[2] === 'DiGraph';
      const vertices = (m[3].match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
      const edges = (m[4].match(/\("([^"]*)", "([^"]*)"\)/g) || []).map((t) => {
        const mm = t.match(/\("([^"]*)", "([^"]*)"\)/);
        return [mm![1], mm![2]];
      });
      const positions: Record<string, [number, number]> = {};
      const layoutEntries = m[5].match(/"([^"]*)": \[([-\d.]+), ([-\d.]+), [-\d.]+\]/g) || [];
      for (const le of layoutEntries) {
        const e = le.match(/"([^"]*)": \[([-\d.]+), ([-\d.]+),/);
        positions[e![1]] = [
          Math.round((parseFloat(e![2]) / FRAME_WIDTH) * sw),
          Math.round((-parseFloat(e![3]) / FRAME_HEIGHT) * sh),
        ];
      }
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'graph',
        name: 'Graph',
        x: sw / 2,
        y: sh / 2,
        width: 200,
        height: 200,
        fill: '#22c55e',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
        vertices,
        edges,
        positions,
        directed,
        showLabels: !!m[6],
      };
      varMap[m[1]] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }

    // Table / MathTable (single-line)
    m = line.match(
      /^(\w+) = (MathTable|Table)\(\[(\[.*\])\](?:, row_labels=\[(.*?)\])?(?:, col_labels=\[(.*?)\])?\)/
    );
    if (m) {
      const mathMode = m[2] === 'MathTable';
      const rowStrs = m[3].match(/\[[^\]]*\]/g) || [];
      const cellData = rowStrs.map((r) => (r.match(/"([^"]*)"/g) || []).map((q) => q.slice(1, -1)));
      const labelList = (s: string | undefined): string[] =>
        s
          ? (s.match(/(?:MathTex|Text)\("([^"]*)"\)/g) || []).map(
              (x) => x.match(/"([^"]*)"/)?.[1] ?? ''
            )
          : [];
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'table',
        name: 'Table',
        x: sw / 2,
        y: sh / 2,
        width: 200,
        height: 140,
        fill: '#ffffff',
        stroke: '#ffffff',
        strokeWidth: 0,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
        cellData,
        mathMode,
        rowLabels: labelList(m[4]),
        colLabels: labelList(m[5]),
      };
      varMap[m[1]] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }

    // Matrix (single-line) — Matrix([["a","b"],...], left_bracket=..., right_bracket=...)
    m = line.match(
      /^(\w+)\s*=\s*Matrix\(\[(\[.+\])\](?:, left_bracket="([^"]*)", right_bracket="[^"]*")?\)/
    );
    if (m) {
      const [, name, body, leftBracket] = m;
      const rows: string[][] = [];
      const rowRe = /\[([^\]]*)\]/g;
      let rm: RegExpExecArray | null;
      while ((rm = rowRe.exec(body))) {
        const cells = rm[1].match(/"([^"]*)"/g);
        rows.push(cells ? cells.map((c) => c.slice(1, -1)) : []);
      }
      const bracket = leftBracket === '(' ? '(' : leftBracket === '|' ? '|' : '[';
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'matrix',
        name,
        x: sw / 2,
        y: sh / 2,
        width: 160,
        height: 120,
        matrixData: rows.length
          ? rows
          : [
              ['1', '0'],
              ['0', '1'],
            ],
        bracket,
        fill: '#ffffff',
        stroke: '#ffffff',
        strokeWidth: 0,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // vector_components: <n>_main Arrow carries vx/vy; absorb the x/y/dash helpers + VGroup.
    m = line.match(/^(\w+)_main\s*=\s*Arrow\(\[0, 0, 0\], \[([-\d.]+), ([-\d.]+), 0\]/);
    if (m) {
      vcPending[m[1]] = {
        vx: (parseFloat(m[2]) / FRAME_WIDTH) * sw,
        vy: (-parseFloat(m[3]) / FRAME_HEIGHT) * sh,
      };
      continue;
    }
    m = line.match(/^(\w+)_(?:x|y|dx|dy)\s*=\s*(?:Arrow|DashedLine)\(/);
    if (m && vcPending[m[1]]) continue;
    m = line.match(/^(\w+)\s*=\s*VGroup\((\w+)_main,/);
    if (m && m[1] === m[2] && vcPending[m[1]]) {
      const { vx, vy } = vcPending[m[1]];
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'vector_components',
        name: m[1],
        x: sw / 2,
        y: sh / 2,
        vx: Math.round(vx),
        vy: Math.round(vy),
        fill: '#3b82f6',
        opacity: 1,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[m[1]] = id;
      objById[id] = obj;
      delete vcPending[m[1]];
      continue;
    }

    // ray: <n>_ray Arrow carries angle/length; absorb <n>_dot + VGroup.
    m = line.match(/^(\w+)_ray\s*=\s*Arrow\(\[0, 0, 0\], \[([-\d.]+), ([-\d.]+), 0\]/);
    if (m) {
      const tipX = (parseFloat(m[2]) / FRAME_WIDTH) * sw;
      const tipY = (parseFloat(m[3]) / FRAME_HEIGHT) * sh;
      rayPending[m[1]] = {
        length: Math.round(Math.hypot(tipX, tipY)),
        angle: Math.round((Math.atan2(tipY, tipX) * 180) / Math.PI),
      };
      continue;
    }
    m = line.match(/^(\w+)_dot\s*=\s*Dot\(/);
    if (m && rayPending[m[1]]) continue;
    m = line.match(/^(\w+)\s*=\s*VGroup\((\w+)_dot,/);
    if (m && m[1] === m[2] && rayPending[m[1]]) {
      const { length, angle } = rayPending[m[1]];
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'ray',
        name: m[1],
        x: sw / 2,
        y: sh / 2,
        angle,
        length,
        fill: '#22d3ee',
        opacity: 1,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[m[1]] = id;
      objById[id] = obj;
      delete rayPending[m[1]];
      continue;
    }

    // coord_point: <n>_label always_redraw carries decimals; absorb its VGroup.
    m = line.match(/^(\w+)_label\s*=\s*always_redraw\(lambda: MathTex\(f"\([^"]*?:\.(\d+)f/);
    if (m) {
      coordPending[m[1]] = { decimals: parseInt(m[2], 10) };
      continue;
    }
    m = line.match(/^(\w+)\s*=\s*VGroup\((\w+)_dot, \2_label\)/);
    if (m && m[1] === m[2] && coordPending[m[1]]) {
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'coord_point',
        name: m[1],
        x: sw / 2,
        y: sh / 2,
        decimals: coordPending[m[1]].decimals,
        fill: '#fbbf24',
        opacity: 1,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[m[1]] = id;
      objById[id] = obj;
      delete coordPending[m[1]];
      continue;
    }

    // Angle helper Lines (our naming) — captured into relLineMap, not turned into objects
    m = line.match(
      /^(\w+_l[12])\s*=\s*Line\(\[([-\d.]+), ([-\d.]+), 0\], \[([-\d.]+), ([-\d.]+), 0\]\)/
    );
    if (m) {
      relLineMap[m[1]] = {
        start: [parseFloat(m[2]), parseFloat(m[3])],
        end: [parseFloat(m[4]), parseFloat(m[5])],
      };
      continue;
    }

    // Brace — BraceBetweenPoints([..],[..]); the geometry name may be <n> or <n>_brace
    m = line.match(
      /^(\w+)\s*=\s*BraceBetweenPoints\(\[([-\d.]+), ([-\d.]+), 0\], \[([-\d.]+), ([-\d.]+), 0\]\)/
    );
    if (m) {
      const [, name, x1, y1, x2, y2] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'brace',
        name,
        x: sw / 2,
        y: sh / 2,
        width: 160,
        height: 60,
        p1: [
          Math.round((parseFloat(x1) / FRAME_WIDTH) * sw),
          Math.round((-parseFloat(y1) / FRAME_HEIGHT) * sh),
        ],
        p2: [
          Math.round((parseFloat(x2) / FRAME_WIDTH) * sw),
          Math.round((-parseFloat(y2) / FRAME_HEIGHT) * sh),
        ],
        label: '',
        fill: '#ffffff',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Angle / RightAngle — references two helper Lines in relLineMap
    m = line.match(/^(\w+)\s*=\s*(Angle|RightAngle)\((\w+_l1), (\w+_l2)(?:, radius=([-\d.]+))?\)/);
    if (m) {
      const [, name, ctor, l1, l2, rad] = m;
      const L1 = relLineMap[l1],
        L2 = relLineMap[l2];
      if (L1 && L2) {
        const toPx = (mp: [number, number]): [number, number] => [
          Math.round((mp[0] / FRAME_WIDTH) * sw),
          Math.round((-mp[1] / FRAME_HEIGHT) * sh),
        ];
        const id = uid('obj');
        const obj: SceneObject = {
          id,
          type: 'angle',
          name,
          x: sw / 2,
          y: sh / 2,
          width: 140,
          height: 140,
          vertex: toPx(L1.start),
          point1: toPx(L1.end),
          point2: toPx(L2.end),
          rightAngle: ctor === 'RightAngle',
          radius: rad ? parseFloat(rad) : 0.6,
          label: '',
          fill: '#fbbf24',
          stroke: '#fbbf24',
          strokeWidth: 2,
          opacity: 1,
          rotation: 0,
          enterTime: 0,
          duration: 10,
          enterAnim: 'fade_in',
          exitAnim: 'fade_out',
          zOrder: objects.length,
        };
        objects.push(obj);
        varMap[name] = id;
        objById[id] = obj;
        continue;
      }
    }

    // surrounding_rect — SurroundingRectangle
    m = line.match(
      /^(\w+)\s*=\s*SurroundingRectangle\((\w+),\s*color="(#[0-9a-fA-F]+)",\s*stroke_width=([\d.]+),\s*buff=([\d.]+),\s*corner_radius=([\d.]+)\)/
    );
    if (m) {
      const [, varName, targetVar, color, sw2Str, buffStr, crStr] = m;
      const targetId = varMap[targetVar] ? targetVar : '';
      const buffPx = Math.round((parseFloat(buffStr) / FRAME_WIDTH) * sw);
      const crPx = Math.round((parseFloat(crStr) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'surrounding_rect',
        name: varName,
        x: sw / 2,
        y: sh / 2,
        width: 160,
        height: 80,
        fill: color,
        stroke: color,
        strokeWidth: parseFloat(sw2Str),
        color,
        buff: buffPx,
        cornerRadius: crPx,
        targetId,
        opacity: 1,
        rotation: 0,
        zOrder: objIdx,
        enterTime: 0,
        duration: ct || 5,
        enterAnim: 'none',
        exitAnim: 'none',
        enterAnimDur: 0.5,
        exitAnimDur: 0.5,
        visible: true,
      };
      varMap[varName] = id;
      objById[id] = obj;
      objects.push(obj);
      continue;
    }

    // underline — Underline
    m = line.match(
      /^(\w+)\s*=\s*Underline\((\w+),\s*color="(#[0-9a-fA-F]+)",\s*stroke_width=([\d.]+),\s*buff=([\d.]+)\)/
    );
    if (m) {
      const [, varName, targetVar, color, sw2Str, buffStr] = m;
      const targetId = varMap[targetVar] ? targetVar : '';
      const buffPx = Math.round((parseFloat(buffStr) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'underline',
        name: varName,
        x: sw / 2,
        y: sh / 2,
        width: 160,
        height: 20,
        fill: color,
        stroke: color,
        strokeWidth: parseFloat(sw2Str),
        color,
        buff: buffPx,
        targetId,
        opacity: 1,
        rotation: 0,
        zOrder: objIdx,
        enterTime: 0,
        duration: ct || 5,
        enterAnim: 'none',
        exitAnim: 'none',
        enterAnimDur: 0.5,
        exitAnimDur: 0.5,
        visible: true,
      };
      varMap[varName] = id;
      objById[id] = obj;
      objects.push(obj);
      continue;
    }

    // cross — Cross
    m = line.match(
      /^(\w+)\s*=\s*Cross\((\w+),\s*stroke_color="(#[0-9a-fA-F]+)",\s*stroke_width=([\d.]+)\)/
    );
    if (m) {
      const [, varName, targetVar, color, sw2Str] = m;
      const targetId = varMap[targetVar] ? targetVar : '';
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'cross',
        name: varName,
        x: sw / 2,
        y: sh / 2,
        width: 160,
        height: 80,
        fill: color,
        stroke: color,
        strokeWidth: parseFloat(sw2Str),
        color,
        targetId,
        opacity: 1,
        rotation: 0,
        zOrder: objIdx,
        enterTime: 0,
        duration: ct || 5,
        enterAnim: 'none',
        exitAnim: 'none',
        enterAnimDur: 0.5,
        exitAnimDur: 0.5,
        visible: true,
      };
      varMap[varName] = id;
      objById[id] = obj;
      objects.push(obj);
      continue;
    }

    // VGroup label wrapper for brace/angle — renames base obj to the VGroup var + sets label
    m = line.match(/^(\w+)\s*=\s*VGroup\((\w+(?:_brace|_arc)), \2\.get_tex\("(.*)"\)\)/);
    if (m) {
      const [, vg, base, tex] = m;
      const baseId = varMap[base];
      const target = baseId ? objById[baseId] : null;
      if (target && (target.type === 'brace' || target.type === 'angle')) {
        target.name = vg;
        target.label = tex.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
        delete varMap[base];
        varMap[vg] = target.id;
      }
      continue;
    }

    // round_corners(radius=...) → restore cornerRadius (px) on polygon/triangle/star
    m = line.match(/^(\w+)\.round_corners\(radius=([-\d.]+)\)/);
    if (m) {
      const t = objById[varMap[m[1]]];
      if (t && ['polygon', 'triangle', 'star'].includes(t.type as string)) {
        t.cornerRadius = Math.round((parseFloat(m[2]) / FRAME_WIDTH) * sw);
      }
      continue;
    }

    // Drop-shadow copy line → stash by base var
    m = line.match(
      /^_shadow_(\w+)\s*=\s*\w+\.copy\(\)\.set_color\("([^"]+)"\)\.set_opacity\(([-\d.]+)\)\.shift\(\[([-\d.]+), ([-\d.]+), 0\]\)/
    );
    if (m) {
      pendingShadow[m[1]] = {
        color: m[2],
        opacity: parseFloat(m[3]),
        dx: Math.round((parseFloat(m[4]) / FRAME_WIDTH) * sw),
        dy: Math.round((-parseFloat(m[5]) / FRAME_HEIGHT) * sh),
      };
      continue;
    }

    // Shadow VGroup wrapper → attach the stashed shadow to the base object
    m = line.match(/^(\w+)\s*=\s*VGroup\(_shadow_(\w+), \2\)/);
    if (m) {
      const ps = pendingShadow[m[2]];
      const t = objById[varMap[m[2]]];
      if (ps && t) {
        t.shadow = { ...ps, blur: 12 };
        delete pendingShadow[m[2]];
      }
      continue;
    }

    // Counter (Integer)
    m = line.match(/^(\w+) = Integer\((-?\d+)(?:, unit="([^"]*)")?\)/);
    if (m) {
      const obj: SceneObject = {
        id: m[1],
        type: 'counter',
        name: 'Counter',
        x: sw / 2,
        y: sh / 2,
        width: 120,
        height: 60,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 5,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
        value: parseInt(m[2], 10),
        numDecimals: 0,
        suffix: unescapeUnit(m[3]),
        useInteger: true,
      };
      varMap[m[1]] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }

    // Counter (DecimalNumber)
    m = line.match(
      /^(\w+) = DecimalNumber\((-?[\d.]+), num_decimal_places=(\d+)(?:, unit="([^"]*)")?\)/
    );
    if (m) {
      // Use the variable name as the object id so count clip objectId round-trips correctly
      // (v(id) === id for obj_ ids since they only contain [a-z0-9_])
      const obj: SceneObject = {
        id: m[1],
        type: 'counter',
        name: 'Counter',
        x: sw / 2,
        y: sh / 2,
        width: 120,
        height: 60,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 5,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
        value: parseFloat(m[2]),
        numDecimals: parseInt(m[3], 10),
        suffix: unescapeUnit(m[4]),
      };
      varMap[m[1]] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }

    // Code block (single-line, pyMultiline-escaped code_string)
    m = line.match(
      /^(\w+) = Code\(code_string="((?:[^"\\]|\\.)*)", language="(\w+)", add_line_numbers=False\)\.scale_to_fit_width\(([\d.]+)\)/
    );
    if (m) {
      const [, name, src, language, wStr] = m;
      const width = Math.round((parseFloat(wStr) / FRAME_WIDTH) * sw);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'code',
        name,
        x: sw / 2,
        y: sh / 2,
        width,
        height: Math.round(width * 0.6), // height is not persisted (Code height follows content) — documented lossy default
        codeText: unescapePyMultiline(src),
        language,
        fontSize: 18,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 5,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
      };
      varMap[name] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }

    // BarChart (single-line)
    m = line.match(
      /^(\w+) = BarChart\(values=\[([^\]]*)\], bar_names=\[([^\]]*)\], y_range=\[0, ([\d.]+), [\d.]+\], bar_colors=\[([^\]]*)\], x_length=([\d.]+), y_length=([\d.]+)\)/
    );
    if (m) {
      const [, name, valuesStr, namesStr, yMaxStr, colorsStr, xLenStr, yLenStr] = m;
      const values = valuesStr
        .split(',')
        .map((s) => parseFloat(s))
        .filter((v) => Number.isFinite(v));
      const barNames = (namesStr.match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
      const barColors = (colorsStr.match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'bar_chart',
        name,
        x: sw / 2,
        y: sh / 2,
        width: Math.round((parseFloat(xLenStr) / FRAME_WIDTH) * sw),
        height: Math.round((parseFloat(yLenStr) / FRAME_HEIGHT) * sh),
        values: values.length ? values : [3, 5, 2, 6],
        barNames,
        yMax: parseFloat(yMaxStr),
        barColors,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 5,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
      };
      varMap[name] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }

    // Text
    m = line.match(
      /^(\w+)\s*=\s*Text\("([^"]*)",\s*font_size=(\d+)(?:,\s*color=["']([^"']+)["'])?(?:,\s*font="([^"]*)")?\)/
    );
    if (m) {
      const [, name, content, fontSize, color, fontFamily] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'text',
        name,
        content,
        fontSize: parseInt(fontSize),
        fontFamily: fontFamily || 'Roboto',
        x: sw / 2,
        y: sh / 2,
        width: 200,
        height: 50,
        fill: color || '#ffffff',
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Dot (radius in export uses FRAME_X_RADIUS: radius = obj.width/2/sw * FRAME_X_RADIUS)
    m = line.match(/^(\w+)\s*=\s*Dot\((?:radius=([\d.]+))?[^)]*(?:color=["']([^"']+)["'])?\)/);
    if (m) {
      const [, name, r, color] = m;
      const size = r ? Math.round(((parseFloat(r) * 2) / FRAME_X_RADIUS) * sw) : 20;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'dot',
        name,
        x: sw / 2,
        y: sh / 2,
        width: size,
        height: size,
        fill: color || '#ffffff',
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // ArrowVectorField
    m = line.match(
      /^(\w+) = ArrowVectorField\(lambda p: \(lambda x, y: np\.array\(\[(.*?), (.*?), 0\]\)\)\(p\[0\], p\[1\]\), x_range=\[([-\d.]+), ([-\d.]+), ([-\d.]+)\], y_range=\[([-\d.]+), ([-\d.]+), ([-\d.]+)\]\)/
    );
    if (m) {
      const obj: SceneObject = {
        id: uid('obj'),
        type: 'vector_field',
        name: 'VectorField',
        x: sw / 2,
        y: sh / 2,
        width: 600,
        height: 400,
        fill: '#38bdf8',
        stroke: '#38bdf8',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
        fx: m[2],
        fy: m[3],
        xRange: [parseFloat(m[4]), parseFloat(m[5]), parseFloat(m[6])],
        yRange: [parseFloat(m[7]), parseFloat(m[8]), parseFloat(m[9])],
      };
      varMap[m[1]] = obj.id;
      objById[obj.id] = obj;
      objects.push(obj);
      continue;
    }

    // ParametricFunction (single-line parametric object) — must precede the heart matcher
    m = line.match(
      /^(\w+)\s*=\s*ParametricFunction\(lambda t: np\.array\(\[(.+), 0\]\), t_range=\[([-\d.]+), ([-\d.]+)\], color=["']([^"']+)["'], stroke_width=([\d.]+)\)/
    );
    if (m) {
      const [, name, body, t0, t1, color, sw_] = m;
      // split "xExpr, yExpr" on the top-level (paren-depth 0) comma
      let depth = 0,
        splitAt = -1;
      for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) {
          splitAt = i;
          break;
        }
      }
      const xe = (splitAt >= 0 ? body.slice(0, splitAt) : body).trim();
      const ye = (splitAt >= 0 ? body.slice(splitAt + 1) : '0').trim();
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'parametric',
        name,
        x: sw / 2,
        y: sh / 2,
        width: 160,
        height: 160,
        xExpr: xe,
        yExpr: ye,
        tMin: parseFloat(t0),
        tMax: parseFloat(t1),
        fill: 'transparent',
        stroke: color,
        strokeWidth: parseFloat(sw_),
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // ParametricFunction (heart)
    m = line.match(/^(\w+)\s*=\s*ParametricFunction\(/);
    if (m) {
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'heart',
        name: m[1],
        x: sw / 2,
        y: sh / 2,
        width: 120,
        height: 120,
        fill: '#ef4444',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[m[1]] = id;
      objById[id] = obj;
      continue;
    }

    // ImageMobject
    m = line.match(
      /^(\w+)\s*=\s*ImageMobject\(["']([^"']+)["']\)(?:\.scale_to_fit_width\(([\d.]+)\))?/
    );
    if (m) {
      const [, name, , w] = m;
      const width = w ? Math.round((parseFloat(w) / FRAME_WIDTH) * sw) : 200;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'image',
        name,
        x: sw / 2,
        y: sh / 2,
        width,
        height: Math.round(width * 0.75),
        fill: '#ffffff',
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // SVGMobject
    m = line.match(
      /^(\w+)\s*=\s*SVGMobject\(["']([^"']+)["']\)(?:\.scale_to_fit_width\(([\d.]+)\))?/
    );
    if (m) {
      const [, name, , w] = m;
      const width = w ? Math.round((parseFloat(w) / FRAME_WIDTH) * sw) : 200;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'svg_asset',
        name,
        x: sw / 2,
        y: sh / 2,
        width,
        height: Math.round(width * 0.75),
        fill: '#ffffff',
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // MathTex (LaTeX) — un-escape the Python string literal (\\ → \, \" → ").
    // Handles both the normal "..." form and the legacy raw r"..." form.
    m = line.match(/^(\w+)\s*=\s*MathTex\(r?"((?:[^"\\]|\\.)*)"(?:,\s*color=["']([^"']+)["'])?\)/);
    if (m) {
      const [, name, rawLatex, color] = m;
      const latex = rawLatex.replace(/\\([\\"])/g, '$1');
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'latex',
        name,
        latex,
        x: sw / 2,
        y: sh / 2,
        width: 200,
        height: 80,
        fill: color || '#ffffff',
        opacity: 1,
        rotation: 0,
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Axes
    m = line.match(
      /^(\w+)\s*=\s*Axes\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\],\s*y_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/
    );
    if (m) {
      const [, name, x0, x1, xs, y0, y1, ys] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'axes',
        name,
        x: sw / 2,
        y: sh / 2,
        width: 400,
        height: 300,
        fill: '#ffffff',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)],
        yRange: [parseFloat(y0), parseFloat(y1), parseFloat(ys)],
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'fade_out',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // NumberPlane
    m = line.match(
      /^(\w+)\s*=\s*NumberPlane\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\],\s*y_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/
    );
    if (m) {
      const [, name, x0, x1, xs, y0, y1, ys] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'numberplane',
        name,
        x: sw / 2,
        y: sh / 2,
        width: 400,
        height: 300,
        fill: '#ffffff',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)],
        yRange: [parseFloat(y0), parseFloat(y1), parseFloat(ys)],
        xStep: parseFloat(xs),
        yStep: parseFloat(ys),
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // ComplexPlane
    m = line.match(
      /^(\w+)\s*=\s*ComplexPlane\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\],\s*y_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/
    );
    if (m) {
      const [, name, x0, x1, xs, y0, y1, ys] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'complex_plane',
        name,
        x: sw / 2,
        y: sh / 2,
        width: 600,
        height: 400,
        fill: '#334155',
        stroke: '#64748b',
        strokeWidth: 1,
        opacity: 1,
        rotation: 0,
        xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)],
        yRange: [parseFloat(y0), parseFloat(y1), parseFloat(ys)],
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // PolarPlane
    m = line.match(
      /^(\w+)\s*=\s*PolarPlane\(radius_max=([-\d.]+),\s*radius_step=([-\d.]+),\s*azimuth_units=(\d+)/
    );
    if (m) {
      const [, name, rMax, rStep, az] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'polar_plane',
        name,
        x: sw / 2,
        y: sh / 2,
        width: 400,
        height: 400,
        fill: '#334155',
        stroke: '#64748b',
        strokeWidth: 1,
        opacity: 1,
        rotation: 0,
        radiusMax: parseFloat(rMax),
        radiusStep: parseFloat(rStep),
        azimuthUnits: parseInt(az, 10),
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // NumberLine
    m = line.match(/^(\w+)\s*=\s*NumberLine\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
    if (m) {
      const [, name, x0, x1, xs] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'numberline',
        name,
        x: sw / 2,
        y: sh / 2,
        width: 400,
        height: 60,
        fill: '#ffffff',
        stroke: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        rotation: 0,
        xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)],
        enterTime: 0,
        duration: 10,
        enterAnim: 'fade_in',
        exitAnim: 'none',
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // axes.plot() — adds a graph to the axes object referenced by axesVar
    m = line.match(
      /^(\w+)\s*=\s*(\w+)\.plot\(lambda x:\s*([^,]+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\](?:,\s*color=["']([^"']+)["'])?(?:,\s*stroke_width=([\d.]+))?\)/
    );
    if (m) {
      const [, graphVar, axesVar, expr, xMin, xMax, color, sw2] = m;
      const axesId = varMap[axesVar];
      if (axesId && objById[axesId] && objById[axesId].type === 'axes') {
        if (!objById[axesId].graphs) objById[axesId].graphs = [];
        const _g: Record<string, unknown> = {
          id: uid('graph').split('_').slice(-2).join('_'),
          expression: expr.trim(),
          color: color || '#F59E0B',
          xMin: parseFloat(xMin),
          xMax: parseFloat(xMax),
          strokeWidth: sw2 ? parseFloat(sw2) : 3,
        };
        (objById[axesId].graphs as Record<string, unknown>[]).push(_g);
        graphVarMap[graphVar] = _g;
      }
      continue;
    }

    // axes.get_area(graphVar, ...)
    m = line.match(
      /^\w+\s*=\s*\w+\.get_area\((\w+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\](?:,\s*color=["']([^"']+)["'])?(?:,\s*opacity=([\d.]+))?\)/
    );
    if (m) {
      const g = graphVarMap[m[1]];
      if (g)
        g['area'] = {
          enabled: true,
          xMin: parseFloat(m[2]),
          xMax: parseFloat(m[3]),
          color: m[4] || g['color'],
          opacity: m[5] !== undefined ? parseFloat(m[5]) : 0.5,
        };
      continue;
    }
    // axes.get_riemann_rectangles(graphVar, ...)
    m = line.match(
      /^\w+\s*=\s*\w+\.get_riemann_rectangles\((\w+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\],\s*dx=([\d.]+),\s*input_sample_type=["'](\w+)["'](?:,\s*color=["']([^"']+)["'])?\)/
    );
    if (m) {
      const g = graphVarMap[m[1]];
      if (g)
        g['riemann'] = {
          enabled: true,
          xMin: parseFloat(m[2]),
          xMax: parseFloat(m[3]),
          dx: parseFloat(m[4]),
          type: m[5],
          color: m[6] || g['color'],
        };
      continue;
    }
    // TangentLine(graphVar, alpha=..., length=..., color=...)
    m = line.match(
      /^\w+\s*=\s*TangentLine\((\w+),\s*alpha=([\d.]+),\s*length=([\d.]+)(?:,\s*color=["']([^"']+)["'])?\)/
    );
    if (m) {
      const g = graphVarMap[m[1]];
      if (g) {
        const alpha = parseFloat(m[2]);
        const gxMin = Number.isFinite(g['xMin'] as number) ? (g['xMin'] as number) : -5;
        const gxMax = Number.isFinite(g['xMax'] as number) ? (g['xMax'] as number) : 5;
        g['tangent'] = {
          enabled: true,
          x: gxMin + alpha * (gxMax - gxMin),
          length: parseFloat(m[3]),
          color: m[4] || g['color'],
        };
      }
      continue;
    }

    // ── 3D object parsers ──

    // Sphere
    m = line.match(/^(\w+)\s*=\s*Sphere\(radius=([\d.]+),\s*resolution=\((\d+),\s*(\d+)\)\)/);
    if (m) {
      const [, name, r, res] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'sphere',
        name,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        radius: parseFloat(r),
        resolution: parseInt(res),
        fill: '#ffffff',
        opacity: 1,
        enterTime: 0,
        exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Cube
    m = line.match(/^(\w+)\s*=\s*Cube\(side_length=([\d.]+)\)/);
    if (m) {
      const [, name, sl] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'cube',
        name,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        sideLength: parseFloat(sl),
        fill: '#ffffff',
        opacity: 1,
        enterTime: 0,
        exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Prism
    m = line.match(/^(\w+)\s*=\s*Prism\(dimensions=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]\)/);
    if (m) {
      const [, name, dx, dy, dz] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'prism',
        name,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        dimX: parseFloat(dx),
        dimY: parseFloat(dy),
        dimZ: parseFloat(dz),
        fill: '#ffffff',
        opacity: 1,
        enterTime: 0,
        exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Cone
    m = line.match(
      /^(\w+)\s*=\s*Cone\(base_radius=([\d.]+),\s*height=([\d.]+),\s*resolution=(\d+)\)/
    );
    if (m) {
      const [, name, r, h, res] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'cone',
        name,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        radius: parseFloat(r),
        height: parseFloat(h),
        resolution: parseInt(res),
        fill: '#ffffff',
        opacity: 1,
        enterTime: 0,
        exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Cylinder
    m = line.match(
      /^(\w+)\s*=\s*Cylinder\(radius=([\d.]+),\s*height=([\d.]+),\s*resolution=(\d+)\)/
    );
    if (m) {
      const [, name, r, h, res] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'cylinder',
        name,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        radius: parseFloat(r),
        height: parseFloat(h),
        resolution: parseInt(res),
        fill: '#ffffff',
        opacity: 1,
        enterTime: 0,
        exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Torus
    m = line.match(
      /^(\w+)\s*=\s*Torus\(major_radius=([\d.]+),\s*minor_radius=([\d.]+),\s*resolution=(\d+)\)/
    );
    if (m) {
      const [, name, mr, mnr, res] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'torus',
        name,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        majorRadius: parseFloat(mr),
        minorRadius: parseFloat(mnr),
        resolution: parseInt(res),
        fill: '#ffffff',
        opacity: 1,
        enterTime: 0,
        exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // ThreeDAxes
    m = line.match(/^(\w+)\s*=\s*ThreeDAxes\(/);
    if (m) {
      const name = m[1];
      const xrm = line.match(/x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
      const yrm = line.match(/y_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
      const zrm = line.match(/z_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'axes3d',
        name,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        xRange: xrm ? [parseFloat(xrm[1]), parseFloat(xrm[2]), parseFloat(xrm[3])] : [-3, 3, 1],
        yRange: yrm ? [parseFloat(yrm[1]), parseFloat(yrm[2]), parseFloat(yrm[3])] : [-3, 3, 1],
        zRange: zrm ? [parseFloat(zrm[1]), parseFloat(zrm[2]), parseFloat(zrm[3])] : [-3, 3, 1],
        fill: '#ffffff',
        opacity: 1,
        enterTime: 0,
        exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // Surface (z = f(x, y))
    m = line.match(
      /^(\w+)\s*=\s*Surface\(lambda x, y: np\.array\(\[x, y, (.+?)\]\),\s*u_range=\[([-\d.]+),\s*([-\d.]+)\],\s*v_range=\[([-\d.]+),\s*([-\d.]+)\],\s*resolution=\((\d+),\s*(\d+)\)\)/
    );
    if (m) {
      const [, name, zExpr, ux0, ux1, vy0, vy1, res] = m;
      const id = uid('obj');
      const obj: SceneObject = {
        id,
        type: 'surface',
        name,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        zExpr,
        xRange: [parseFloat(ux0), parseFloat(ux1)],
        yRange: [parseFloat(vy0), parseFloat(vy1)],
        resolution: parseInt(res),
        fill: '#ffffff',
        opacity: 1,
        enterTime: 0,
        exitTime: 10,
        anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
        zOrder: objects.length,
      };
      objects.push(obj);
      varMap[name] = id;
      objById[id] = obj;
      continue;
    }

    // obj.move_to([x, y, z]) — handles both 2D (z=0) and 3D objects
    m = line.match(/^(\w+)\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        const mz = parseFloat(m[4]);
        if (
          mz !== 0 ||
          objById[id].type === 'sphere' ||
          objById[id].type === 'cube' ||
          objById[id].type === 'cone' ||
          objById[id].type === 'cylinder' ||
          objById[id].type === 'torus' ||
          objById[id].type === 'axes3d' ||
          objById[id].type === 'surface' ||
          objById[id].type === 'prism'
        ) {
          objById[id].x3d = parseFloat(m[2]);
          objById[id].y3d = parseFloat(m[3]);
          objById[id].z3d = mz;
        } else {
          const sp = manimToStage(parseFloat(m[2]), parseFloat(m[3]), sw, sh);
          objById[id].x = Math.round(sp.x);
          objById[id].y = Math.round(sp.y);
        }
      }
      continue;
    }

    // ── Property setters ──

    m = line.match(/^(\w+)\.set_color_by_gradient\(([^)]+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        const colors = m[2]
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
        if (colors.length >= 2) objById[id].gradient = { colors, angle: 135 };
      }
      continue;
    }

    m = line.match(/^(\w+)\.set_fill\(color=["']([^"']+)["'](?:,\s*opacity=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].fill = m[2];
        if (m[3] !== undefined) {
          const op = parseFloat(m[3]);
          const master = (objById[id].opacity as number | undefined) ?? 1;
          if (master > 0 && Math.abs(op - master) > 0.001)
            objById[id].fillOpacity = +(op / master).toFixed(3);
        }
      }
      continue;
    }

    m = line.match(
      /^(\w+)\.set_stroke\(color=["']([^"']+)["'](?:,\s*width=([\d.]+))?(?:,\s*opacity=([\d.]+))?\)/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].stroke = m[2];
        if (m[3]) objById[id].strokeWidth = parseFloat(m[3]);
        if (m[4] !== undefined) {
          const op = parseFloat(m[4]);
          const master = (objById[id].opacity as number | undefined) ?? 1;
          if (master > 0) objById[id].strokeOpacity = +(op / master).toFixed(3);
        }
      }
      continue;
    }

    m = line.match(
      /^\w+\s*=\s*VGroup\((\w+),\s*DashedVMobject\([^,]+,\s*num_dashes=(\d+),\s*dashed_ratio=([\d.]+)\)\)/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id])
        objById[id].dash = { numDashes: parseInt(m[2]), ratio: parseFloat(m[3]) };
      continue;
    }

    m = line.match(/^(\w+)\.set_color\(["']([^"']+)["']\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) objById[id].fill = m[2];
      continue;
    }

    m = line.match(/^(\w+)\.rotate\(([-\d.]+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id])
        objById[id].rotation = Math.round(((parseFloat(m[2]) * 180) / Math.PI) * 10) / 10;
      continue;
    }

    // ── Animations ──

    // AnimationGroup / LaggedStart
    m = line.match(/^self\.play\((AnimationGroup|LaggedStart)\(/);
    if (m) {
      const fn = m[1];
      const lagMatch = line.match(/lag_ratio=([\d.]+)/);
      const rtMatch = line.match(/run_time=([\d.]+)/);
      const lagRatio = lagMatch ? parseFloat(lagMatch[1]) : 0;
      const dur = rtMatch ? parseFloat(rtMatch[1]) : 1;

      // Extract inner content by bracket matching starting after "AnimationGroup(" or "LaggedStart("
      const fnStart = line.indexOf(fn + '(') + fn.length + 1;
      let depth = 1,
        end = fnStart;
      while (end < line.length && depth > 0) {
        if (line[end] === '(' || line[end] === '[') depth++;
        else if (line[end] === ')' || line[end] === ']') depth--;
        end++;
      }
      const inner = line.substring(fnStart, end - 1);

      // Split inner content by ',' respecting bracket depth
      const exprs: string[] = [];
      let cur = '',
        d = 0;
      for (const ch of inner) {
        if (ch === '(' || ch === '[') d++;
        else if (ch === ')' || ch === ']') d--;
        if (ch === ',' && d === 0) {
          const t = cur.trim();
          if (t && !/^(lag_ratio|run_time|rate_func)/.test(t)) exprs.push(t);
          cur = '';
        } else {
          cur += ch;
        }
      }
      if (cur.trim() && !/^(lag_ratio|run_time|rate_func)/.test(cur.trim())) exprs.push(cur.trim());

      const parsedClips = exprs.map((e) => parseAnimExpr(e)).filter(Boolean) as ParsedAnimClip[];
      for (const pc of parsedClips) {
        clips.push({
          id: `clip_${clipIdx++}`,
          type: pc.type,
          sourceId: pc.sourceId,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          parallel: true,
          lag_ratio: lagRatio,
          params: pc.params as Clip['params'],
        });
      }
      if (parsedClips.length > 0) ct += dur;
      continue;
    }

    m = line.match(/^self\.wait\(([\d.]+)\)/);
    if (m) {
      ct += parseFloat(m[1]);
      continue;
    }

    // FadeIn with scale → fade_in_large
    m = line.match(/^self\.play\(FadeIn\((\w+),\s*scale=([\d.]+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'fade_in_large';
        objById[id].enterAnimScale = parseFloat(m[2]);
      }
      ct += parseFloat(m[3] || '0.5');
      continue;
    }
    // Plain FadeIn → fade_in
    m = line.match(/^self\.play\(FadeIn\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'fade_in';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(Create\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'none';
      }
      ct += parseFloat(m[2] || '1');
      continue;
    }

    m = line.match(/^self\.play\(AddTextLetterByLetter\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'typewriter';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(RemoveTextLetterByLetter\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].exitAnim = 'typewriter_out';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(DrawBorderThenFill\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'draw_border_fill';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(GrowArrow\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'grow_arrow';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(GrowFromEdge\((\w+),\s*edge=(\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].enterTime = ct;
        objById[id].enterAnim = 'grow_from_edge';
        objById[id].enterAnimDir = m[2] as 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
      }
      ct += parseFloat(m[3] || '0.5');
      continue;
    }

    m = line.match(/^self\.play\(Unwrite\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].exitAnim = 'unwrite';
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(
      /^self\.play\((ReplacementTransform|FadeTransform|Transform|TransformMatchingTex|TransformMatchingShapes)\((\w+),\s*(\w+)\)(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=([^\s)]+))?\)/
    );
    if (m) {
      const animName = m[1];
      const srcId = varMap[m[2]],
        tgtId = varMap[m[3]];
      if (srcId && tgtId) {
        const dur = parseFloat(m[4] || '1');
        const easing = m[5] ? EASING_REV[m[5]] || 'ease_in_out' : 'ease_in_out';
        const clip: Clip = {
          id: `clip_${clipIdx++}`,
          type: 'transform',
          sourceId: srcId,
          targetId: tgtId,
          startTime: ct,
          duration: dur,
          easing,
        };
        if (animName === 'TransformMatchingTex' || animName === 'TransformMatchingShapes')
          clip.matchTerms = true;
        clips.push(clip);
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\(Rotate\((\w+),\s*angle=([-\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[3] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'rotate',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: { targetRotation: Math.round((parseFloat(m[2]) * 180) / Math.PI) },
        });
        ct += dur;
      }
      continue;
    }

    m = line.match(
      /^self\.play\(Indicate\((\w+),\s*color="([^"]+)",\s*scale_factor=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[4] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'indicate',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: { color: m[2], scale_factor: parseFloat(m[3]) },
        });
        ct += dur;
      }
      continue;
    }

    m = line.match(
      /^self\.play\(Flash\((\w+),\s*color="([^"]+)",\s*flash_radius=([\d.]+),\s*line_length=([\d.]+),\s*num_lines=(\d+)\)(?:,\s*run_time=([\d.]+))?/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[6] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'flash',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: {
            color: m[2],
            flash_radius: parseFloat(m[3]),
            line_length: parseFloat(m[4]),
            num_lines: parseInt(m[5], 10),
          },
        });
        ct += dur;
      }
      continue;
    }

    m = line.match(
      /^self\.play\(Wiggle\((\w+),\s*scale_value=([\d.]+),\s*rotation_angle=([\d.]+) \* DEGREES,\s*n_wiggles=(\d+)\)(?:,\s*run_time=([\d.]+))?/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[5] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'wiggle',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: {
            scale_value: parseFloat(m[2]),
            rotation_angle: parseFloat(m[3]),
            n_wiggles: parseInt(m[4], 10),
          },
        });
        ct += dur;
      }
      continue;
    }

    m = line.match(
      /^self\.play\(Circumscribe\((\w+),\s*color="([^"]+)",\s*shape=(Rectangle|Circle),\s*fade_out=(True|False),\s*time_width=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[6] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'circumscribe',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: {
            color: m[2],
            shape: m[3],
            fade_out: m[4] === 'True',
            time_width: parseFloat(m[5]),
          },
        });
        ct += dur;
      }
      continue;
    }

    m = line.match(
      /^self\.play\(FocusOn\((\w+),\s*color="([^"]+)",\s*opacity=([\d.]+)\)(?:,\s*run_time=([\d.]+))?/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[4] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'focus_on',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: { color: m[2], opacity: parseFloat(m[3]) },
        });
        ct += dur;
      }
      continue;
    }

    // FadeOut with scale → fade_out_large
    m = line.match(/^self\.play\(FadeOut\((\w+),\s*scale=([\d.]+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].exitAnim = 'fade_out_large';
        objById[id].exitAnimScale = parseFloat(m[2]);
      }
      ct += parseFloat(m[3] || '0.5');
      continue;
    }
    m = line.match(/^self\.play\(FadeOut\((\w+)\)(?:,\s*run_time=([\d.]+))?\)/);
    if (m) {
      const id = varMap[m[1]];
      if (id && objById[id]) {
        objById[id].exitAnim = 'fade_out';
        objById[id].duration =
          ct - ((objById[id].enterTime as number | undefined) || 0) + parseFloat(m[2] || '0.5');
      }
      ct += parseFloat(m[2] || '0.5');
      continue;
    }

    m = line.match(
      /^self\.play\((\w+)\.animate\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*0\]\)(?:,\s*run_time=([\d.]+))?/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const sp = manimToStage(parseFloat(m[2]), parseFloat(m[3]), sw, sh);
        const dur = parseFloat(m[4] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'move',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: { targetX: Math.round(sp.x), targetY: Math.round(sp.y) },
        });
        ct += dur;
      }
      continue;
    }

    m = line.match(/^self\.play\((\w+)\.animate\.scale\(([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[3] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'scale',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: { targetScaleX: parseFloat(m[2]), targetScaleY: parseFloat(m[2]) },
        });
        ct += dur;
      }
      continue;
    }

    m = line.match(
      /^self\.play\((\w+)\.animate\.set_opacity\(([\d.]+)\)(?:,\s*run_time=([\d.]+))?/
    );
    if (m) {
      const id = varMap[m[1]];
      if (id) {
        const dur = parseFloat(m[3] || '1');
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'fade',
          sourceId: id,
          startTime: ct,
          duration: dur,
          easing: 'ease_in_out',
          params: { targetOpacity: parseFloat(m[2]) },
        });
        ct += dur;
      }
      continue;
    }

    // self.camera.frame.animate.move_to([x,y,0]).set_width(w)
    m = line.match(
      /^self\.play\(self\.camera\.frame\.animate\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*0\]\)\.set_width\(([\d.]+)\)(?:,\s*run_time=([\d.]+))?/
    );
    if (m) {
      const [, mx, my, fw, rtStr] = m;
      const dur = parseFloat(rtStr || '1');
      const sp = manimToStage(parseFloat(mx), parseFloat(my), sw, sh);
      const zoom = parseFloat((FRAME_WIDTH / parseFloat(fw)).toFixed(4));
      cameraTrack.push({
        id: `cam_${clipIdx++}`,
        type: 'camera_move',
        startTime: ct,
        duration: dur,
        easing: 'ease_in_out',
        params: { targetX: Math.round(sp.x), targetY: Math.round(sp.y), zoom },
      });
      ct += dur;
      continue;
    }

    // _count_<cn> = ValueTracker(<from>) — start of a count block
    m = line.match(/^(_count_\w+)\s*=\s*ValueTracker\((-?[\d.]+)\)/);
    if (m) {
      pendingCount[m[1]] = { from: parseFloat(m[2]) };
      continue;
    }

    // <sn>.add_updater(lambda m: m.set_value(_count_<cn>.get_value())) — middle of count block
    m = line.match(/^(\w+)\.add_updater\(lambda m: m\.set_value\((_count_\w+)\.get_value\(\)\)\)/);
    if (m) {
      const vtVar = m[2];
      if (pendingCount[vtVar]) pendingCount[vtVar].objVar = m[1];
      continue;
    }

    // self.play(_count_<cn>.animate.set_value(<to>)...) — completes the count clip
    m = line.match(
      /^self\.play\((_count_\w+)\.animate\.set_value\((-?[\d.]+)\)(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=([^\s)]+))?\)/
    );
    if (m) {
      const vtVar = m[1];
      const pc = pendingCount[vtVar];
      if (pc && pc.objVar) {
        const objectId = varMap[pc.objVar];
        const to = parseFloat(m[2]);
        const dur = parseFloat(m[3] || '1');
        const easing = m[4] ? EASING_REV[m[4]] || 'linear' : 'linear';
        if (objectId) {
          clips.push({
            id: `clip_${clipIdx++}`,
            type: 'count',
            objectId,
            from: pc.from,
            to,
            startTime: ct,
            duration: dur,
            easing,
          });
          ct += dur;
        }
        delete pendingCount[vtVar];
      }
      continue;
    }

    // <sn>.clear_updaters() — tail of count block (consumed, ct already advanced)
    m = line.match(/^(\w+)\.clear_updaters\(\)/);
    if (m) {
      continue;
    }

    // VMobject() — start of a path definition
    m = line.match(/^(\w+)\s*=\s*VMobject\(\)/);
    if (m) {
      pendingPaths[m[1]] = [];
      continue;
    }

    // set_points_as_corners — parse Manim coordinate list into pending path
    m = line.match(/^(\w+)\.set_points_as_corners\(\[np\.array\(p\) for p in \[(.+)\]\]\)/);
    if (m) {
      const [, pathVar, pointsStr] = m;
      if (pendingPaths[pathVar] !== undefined) {
        const pointMatches = [...pointsStr.matchAll(/\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/g)];
        pendingPaths[pathVar] = pointMatches.map((pm) => ({
          mx: parseFloat(pm[1]),
          my: parseFloat(pm[2]),
          mz: parseFloat(pm[3]),
        }));
      }
      continue;
    }

    // MoveAlongPath — create path_move clip from pending path
    m = line.match(
      /^self\.play\(MoveAlongPath\((\w+),\s*(\w+)\)(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=([^\s)]+))?\)/
    );
    if (m) {
      const [, objVar, pathVar, rtStr, rfStr] = m;
      const objId = varMap[objVar];
      const pathPoints = pendingPaths[pathVar];
      if (objId && pathPoints && pathPoints.length >= 2) {
        const dur = parseFloat(rtStr || '1');
        const easing = rfStr ? EASING_REV[rfStr] || 'linear' : 'linear';
        const path = pathPoints.map((p) => {
          if (sceneType === '3d') {
            return { x3d: p.mx, y3d: p.my, z3d: p.mz };
          }
          const sp = manimToStage(p.mx, p.my, sw, sh);
          return { x: Math.round(sp.x), y: Math.round(sp.y) };
        });
        clips.push({
          id: `clip_${clipIdx++}`,
          type: 'path_move',
          sourceId: objId,
          startTime: ct,
          duration: dur,
          easing,
          parallel: false,
          lag_ratio: 0,
          path,
        });
        ct += dur;
      }
      delete pendingPaths[pathVar];
      continue;
    }
  }

  // Finalize object durations
  for (const obj of objects) {
    if ((obj.duration as number) >= 10)
      obj.duration = Math.max(3, ct + 1 - ((obj.enterTime as number | undefined) || 0));
  }

  return {
    objects,
    tracks: clips.length > 0 ? [{ id: 'track_parsed', name: 'Track 1', clips }] : [],
    stage: { backgroundColor: bgColor, width: sw, height: sh },
    sceneType,
    cameraType,
    cameraTrack,
    sections,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// DOWNLOAD helper
// ═════════════════════════════════════════════════════════════════════════════

export function downloadManimScript(project: Project): string {
  const script = generateManimScript(project);
  const blob = new Blob([script], { type: 'text/x-python' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scene.py';
  a.click();
  URL.revokeObjectURL(url);
  return script;
}

// Alias for test compatibility and API convenience
export const generateCode = generateManimScript;

export { EASING_MAP } from '@manim/codegen';
export default { generateManimScript, parseManimScript, downloadManimScript, generateCode };
