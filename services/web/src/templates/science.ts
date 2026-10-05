// "Science documentary" template pack (roadmap §12, from the production bug
// report): radioactive decay, isochron dating, a decay chain and a log time
// scale. Values are placed with `onAxes`, which mirrors codegen: the axes'
// plot area is centred on the object, so a point lands exactly on ax.c2p(x, y).
import { uid } from '../store/project.js';
import type { SceneObject } from '@manim/codegen';
import type { Template, TemplateProject } from './index.js';
import { STAGE } from './stage.js';

interface AxesBox {
  x: number;
  y: number;
  width: number;
  height: number;
  xRange: number[];
  yRange: number[];
}

/** Canvas position of the value (x, y) on an axes / number-line box. */
export function onAxes(ax: AxesBox, x: number, y: number): { x: number; y: number } {
  const [x0, x1] = ax.xRange as [number, number];
  const [y0, y1] = ax.yRange as [number, number];
  return {
    x: round1(ax.x - ax.width / 2 + ((x - x0) / (x1 - x0)) * ax.width),
    y: round1(ax.y + ax.height / 2 - ((y - y0) / (y1 - y0)) * ax.height),
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** A straight segment as the editor stores it: centred, `width` long, rotated (clockwise °). */
function segment(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    x: round1((a.x + b.x) / 2),
    y: round1((a.y + b.y) / 2),
    width: round1(Math.hypot(dx, dy)),
    rotation: Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) * 100) / 100,
  };
}

/** Visible from `enterTime` to the end of the scene, no exit animation. */
function shown(enterTime: number, end: number, enterAnim: string, enterAnimDur: number) {
  return {
    rotation: 0,
    opacity: 1,
    enterTime,
    duration: Math.round((end - enterTime) * 100) / 100,
    enterAnim,
    enterAnimDur,
    exitAnim: 'none',
    exitAnimDur: 0.5,
  };
}

function latex(
  name: string,
  tex: string,
  at: { x: number; y: number },
  size: { width: number; height: number },
  fill: string,
  timing: ReturnType<typeof shown>,
  extra: Record<string, unknown> = {}
): SceneObject {
  return {
    ...timing,
    id: uid('obj'),
    type: 'latex',
    name,
    x: at.x,
    y: at.y,
    ...size,
    fill,
    stroke: 'transparent',
    strokeWidth: 0,
    zOrder: 6,
    latex: tex,
    ...extra,
  };
}

function text(
  name: string,
  content: string,
  at: { x: number; y: number },
  fontSize: number,
  fill: string,
  timing: ReturnType<typeof shown>,
  extra: Record<string, unknown> = {}
): SceneObject {
  return {
    ...timing,
    id: uid('obj'),
    type: 'text',
    name,
    x: at.x,
    y: at.y,
    width: Math.round(content.length * fontSize * 0.55),
    height: Math.round(fontSize * 1.3),
    fill,
    stroke: 'transparent',
    strokeWidth: 0,
    zOrder: 6,
    content,
    fontSize,
    fontFamily: 'Roboto',
    ...extra,
  };
}

function dot(
  name: string,
  at: { x: number; y: number },
  fill: string,
  timing: ReturnType<typeof shown>
) {
  return {
    ...timing,
    id: uid('obj'),
    type: 'dot',
    name,
    x: at.x,
    y: at.y,
    width: 22,
    height: 22,
    fill,
    stroke: fill,
    strokeWidth: 0,
    zOrder: 5,
  };
}

/** A point placed by its value on an axes object (rendered as Dot(ax.c2p(x, y))). */
function axisPoint(
  name: string,
  axesId: string,
  x: number,
  y: number,
  fill: string,
  timing: ReturnType<typeof shown>,
  extra: Record<string, unknown> = {}
): SceneObject {
  return {
    ...timing,
    id: uid('obj'),
    type: 'axis_point',
    name,
    targetId: axesId,
    valueX: x,
    valueY: y,
    label: '',
    showGuides: false,
    x: 0,
    y: 0,
    width: 22,
    height: 22,
    fill,
    stroke: fill,
    strokeWidth: 0,
    zOrder: 5,
    ...extra,
  };
}

function baseProject(name: string, sceneDuration: number, objects: SceneObject[]): TemplateProject {
  return {
    name,
    editorMode: 'visual',
    codeSource: '',
    stage: { ...STAGE },
    assets: [],
    groups: [],
    sceneDuration,
    objects,
    tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
  };
}

// ── Radioactive decay: N/N0 = 2^(-t / T½), with t measured in half-lives ─────
function radioactiveDecay(): TemplateProject {
  const END = 9;
  const ax: AxesBox = {
    x: 990,
    y: 600,
    width: 1300,
    height: 680,
    xRange: [0, 5, 1],
    yRange: [0, 1.2, 0.2],
  };
  const axesId = uid('obj');
  const objects: SceneObject[] = [
    {
      ...shown(0, END, 'draw', 1.5),
      id: axesId,
      type: 'axes',
      name: 'Axes',
      ...ax,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeWidth: 2,
      zOrder: 0,
      graphs: [
        {
          id: uid('obj'),
          expression: '2**(-x)',
          color: '#22d3ee',
          xMin: 0,
          xMax: 5,
          strokeWidth: 4,
        },
      ],
    },
    latex(
      'Decay law',
      'N(t) = N_0 \\, 2^{-t/T_{1/2}}',
      { x: 960, y: 115 },
      { width: 620, height: 90 },
      '#f8fafc',
      shown(1.6, END, 'write', 1.2)
    ),
    text(
      'x label',
      'Time (half-lives)',
      { x: ax.x, y: ax.y + ax.height / 2 + 55 },
      30,
      '#cbd5e1',
      shown(0.8, END, 'fade_in', 0.6)
    ),
    text('y label', 'Fraction remaining', { x: ax.x - ax.width / 2 - 70, y: ax.y }, 30, '#cbd5e1', {
      ...shown(0.8, END, 'fade_in', 0.6),
      rotation: -90,
    }),
  ];
  // The point, its dashed guides to both axes and its 1/2, 1/4, 1/8 label all
  // come from one axis_point placed by value: Dot(ax.c2p(k, 2^-k)).
  [1, 2, 3].forEach((k, i) => {
    objects.push(
      axisPoint(
        `After ${k} half-life${k > 1 ? 's' : ''}`,
        axesId,
        k,
        2 ** -k,
        '#f97316',
        shown(3.2 + i * 1.3, END, 'grow_in', 0.5),
        { label: `\\tfrac{1}{${2 ** k}}`, showGuides: true }
      )
    );
  });
  return baseProject('Radioactive Decay', END, objects);
}

// ── Isochron dating (Rb–Sr): samples fall on a line whose slope is e^{λt} − 1 ─
function isochron(): TemplateProject {
  const END = 9;
  const ax: AxesBox = {
    x: 1000,
    y: 600,
    width: 1200,
    height: 640,
    xRange: [0, 10, 2],
    yRange: [0.7, 0.9, 0.05],
  };
  const line = (x: number) => 0.7 + 0.015 * x;
  // Rb/Sr ratios of five minerals; small measurement scatter around the line.
  const samples: Array<[number, number]> = [
    [1.2, 0.003],
    [3.1, -0.002],
    [4.6, 0.002],
    [6.4, -0.003],
    [8.3, 0.001],
  ];
  const axesId = uid('obj');
  const objects: SceneObject[] = [
    {
      ...shown(0, END, 'draw', 1.5),
      id: axesId,
      type: 'axes',
      name: 'Axes',
      ...ax,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeWidth: 2,
      zOrder: 0,
    },
    text(
      'Title',
      'Isochron Dating',
      { x: 960, y: 105 },
      56,
      '#f8fafc',
      shown(0.3, END, 'fade_in', 0.8)
    ),
    latex(
      'x label',
      '{}^{87}\\mathrm{Rb} \\,/\\, {}^{86}\\mathrm{Sr}',
      { x: ax.x, y: ax.y + ax.height / 2 + 60 },
      { width: 260, height: 56 },
      '#cbd5e1',
      shown(0.8, END, 'fade_in', 0.6)
    ),
    latex(
      'y label',
      '{}^{87}\\mathrm{Sr} \\,/\\, {}^{86}\\mathrm{Sr}',
      { x: ax.x - ax.width / 2 - 85, y: ax.y },
      { width: 260, height: 56 },
      '#cbd5e1',
      { ...shown(0.8, END, 'fade_in', 0.6), rotation: -90 }
    ),
  ];
  samples.forEach(([x, scatter], i) => {
    objects.push(
      axisPoint(
        `Sample ${i + 1}`,
        axesId,
        x,
        Number((line(x) + scatter).toFixed(4)),
        '#facc15',
        shown(1.8 + i * 0.35, END, 'grow_in', 0.3)
      )
    );
  });
  objects.push(
    {
      ...shown(4.2, END, 'draw', 1.2),
      id: uid('obj'),
      type: 'line',
      name: 'Isochron',
      ...segment(onAxes(ax, 0, line(0)), onAxes(ax, ax.xRange[1]!, line(ax.xRange[1]!))),
      height: 0,
      fill: '#a3e635',
      stroke: '#a3e635',
      strokeWidth: 4,
      zOrder: 3,
    },
    latex(
      'Slope',
      '\\text{slope} = e^{\\lambda t} - 1',
      onAxes(ax, 3.4, 0.85),
      { width: 380, height: 64 },
      '#d9f99d',
      shown(5.8, END, 'write', 1.0)
    )
  );
  return baseProject('Isochron Dating', END, objects);
}

// ── Decay chain: ²³⁸U →α ²³⁴Th →β⁻ ²³⁴Pa →β⁻ ²³⁴U ──────────────────────────
function decayChain(): TemplateProject {
  const END = 10;
  const Y = 520;
  const R = 95;
  const nuclei = [
    {
      tex: '^{238}_{92}\\mathrm{U}',
      name: 'Uranium-238',
      halfLife: '4.47 billion years',
      color: '#22d3ee',
    },
    {
      tex: '^{234}_{90}\\mathrm{Th}',
      name: 'Thorium-234',
      halfLife: '24.1 days',
      color: '#a78bfa',
    },
    {
      tex: '^{234}_{91}\\mathrm{Pa}',
      name: 'Protactinium-234',
      halfLife: '1.17 minutes',
      color: '#f472b6',
    },
    {
      tex: '^{234}_{92}\\mathrm{U}',
      name: 'Uranium-234',
      halfLife: '245,500 years',
      color: '#22d3ee',
    },
  ];
  const steps = ['\\alpha', '\\beta^-', '\\beta^-'];
  const xs = [270, 730, 1190, 1650];
  const objects: SceneObject[] = [
    text(
      'Title',
      'Uranium-238 decay chain',
      { x: 960, y: 150 },
      56,
      '#f8fafc',
      shown(0.2, END, 'fade_in', 0.8)
    ),
  ];
  nuclei.forEach((n, i) => {
    const t = 0.8 + i * 1.8;
    objects.push(
      {
        ...shown(t, END, 'draw', 0.8),
        id: uid('obj'),
        type: 'circle',
        name: n.name,
        x: xs[i]!,
        y: Y,
        width: 2 * R,
        height: 2 * R,
        fill: 'transparent',
        stroke: n.color,
        strokeWidth: 4,
        zOrder: 1,
      },
      latex(
        `${n.name} symbol`,
        n.tex,
        { x: xs[i]!, y: Y },
        { width: 120, height: 90 },
        '#f8fafc',
        shown(t + 0.3, END, 'fade_in', 0.5)
      ),
      text(
        `${n.name} half-life`,
        n.halfLife,
        { x: xs[i]!, y: Y + R + 50 },
        26,
        '#94a3b8',
        shown(t + 0.5, END, 'fade_in', 0.5)
      )
    );
    if (i < steps.length) {
      const a = { x: xs[i]! + R + 20, y: Y };
      const b = { x: xs[i + 1]! - R - 20, y: Y };
      objects.push(
        {
          ...shown(t + 1.0, END, 'grow_arrow', 0.6),
          id: uid('obj'),
          type: 'arrow',
          name: `Arrow ${i + 1}`,
          ...segment(a, b),
          height: 20,
          fill: '#e2e8f0',
          stroke: '#e2e8f0',
          strokeWidth: 4,
          zOrder: 2,
        },
        latex(
          `Step ${i + 1}`,
          steps[i]!,
          { x: (a.x + b.x) / 2, y: Y - 50 },
          { width: 60, height: 50 },
          '#fde68a',
          shown(t + 1.3, END, 'fade_in', 0.4)
        )
      );
    }
  });
  return baseProject('Decay Chain', END, objects);
}

// ── Log time scale: years since/for each event, on a log10 number line ───────
function timeScale(): TemplateProject {
  const END = 10;
  const line: AxesBox = {
    x: 960,
    y: 600,
    width: 1560,
    height: 40,
    xRange: [0, 10, 1],
    yRange: [0, 1, 1],
  };
  const events: Array<[string, number, string]> = [
    ['Human lifetime', 80, '#22d3ee'],
    ['Recorded history', 5_000, '#a78bfa'],
    ['Homo sapiens', 300_000, '#f472b6'],
    ['End of the dinosaurs', 66e6, '#fb923c'],
    ['Age of the Earth', 4.54e9, '#a3e635'],
  ];
  const objects: SceneObject[] = [
    text(
      'Title',
      'Scale of Time',
      { x: 960, y: 140 },
      60,
      '#f8fafc',
      shown(0.2, END, 'fade_in', 0.8)
    ),
    text(
      'Subtitle',
      'years, on a logarithmic scale',
      { x: 960, y: 215 },
      32,
      '#94a3b8',
      shown(0.6, END, 'fade_in', 0.6)
    ),
    {
      ...shown(0.8, END, 'draw', 1.2),
      id: uid('obj'),
      type: 'numberline',
      name: 'Log time axis',
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      xRange: line.xRange,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeWidth: 2,
      zOrder: 0,
    },
  ];
  for (const p of [0, 2, 4, 6, 8, 10]) {
    objects.push(
      latex(
        `10^${p}`,
        `10^{${p}}`,
        { x: onAxes(line, p, 0).x, y: line.y + 55 },
        { width: 70, height: 44 },
        '#cbd5e1',
        shown(1.6, END, 'fade_in', 0.5)
      )
    );
  }
  events.forEach(([name, years, color], i) => {
    const t = 2.4 + i * 1.2;
    const at = { x: onAxes(line, Math.log10(years), 0).x, y: line.y };
    const up = i % 2 === 0 ? 95 : 175; // alternate heights so labels never overlap
    objects.push(
      dot(`${name} marker`, at, color, shown(t, END, 'grow_in', 0.3)),
      text(name, name, { x: at.x, y: line.y - up }, 28, color, shown(t + 0.2, END, 'fade_in', 0.5))
    );
  });
  return baseProject('Scale of Time', END, objects);
}

export const SCIENCE_TEMPLATES: Template[] = [
  {
    id: 'radioactive_decay',
    label: 'Radioactive Decay',
    description: 'Exponential decay with half-life markers',
    icon: '☢',
    category: 'science',
    project: radioactiveDecay,
  },
  {
    id: 'isochron',
    label: 'Isochron Dating',
    description: 'Rb–Sr samples on a line whose slope gives the age',
    icon: '⟋',
    category: 'science',
    project: isochron,
  },
  {
    id: 'decay_chain',
    label: 'Decay Chain',
    description: 'Uranium-238 → Uranium-234 by alpha and beta decay',
    icon: '⛓',
    category: 'science',
    project: decayChain,
  },
  {
    id: 'time_scale',
    label: 'Scale of Time',
    description: 'From a human lifetime to the age of the Earth, on a log scale',
    icon: '⏳',
    category: 'science',
    project: timeScale,
  },
];
