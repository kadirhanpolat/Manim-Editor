import { uid } from '../store/project.js';
import type { SceneObject, Clip } from '@manim/codegen';

export type TemplateCategory =
  | 'general'
  | 'calculus'
  | 'linear_algebra'
  | 'trigonometry'
  | 'statistics'
  | 'programming';

/** A wider clip type that allows extra template-only fields (overshoot, morphQuality, …). */
type TemplateClip = Clip & Record<string, unknown>;

/** A minimal project snapshot used by template factories. */
export interface TemplateProject {
  name: string;
  editorMode: string;
  codeSource: string;
  stage: Record<string, unknown>;
  assets: unknown[];
  groups: unknown[];
  sceneDuration: number;
  objects: SceneObject[];
  tracks: Array<{ id: string; name?: string; clips: TemplateClip[] }>;
}

/** A single entry in the template palette. */
export interface Template {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  project: (() => TemplateProject) | null;
}

const STAGE = {
  width: 1920,
  height: 1080,
  backgroundColor: '#0f0f0f',
  backgroundOpacity: 1,
  backgroundImage: null,
  gridVisible: true,
  gridSize: 8,
  gridColor: '#ffffff',
  gridOpacity: 0.12,
  snapEnabled: true,
  snapToGrid: true,
  snapToCenter: true,
  snapToObjects: false,
};

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    label: 'Boş Proje',
    description: 'Sıfırdan başla',
    icon: '□',
    category: 'general',
    project: null,
  },
  {
    id: 'formula_reveal',
    label: 'Formül Tanıtım',
    description: 'LaTeX formülü yazma efektiyle ortaya çıkar',
    icon: '∑',
    category: 'general',
    project: () => {
      const id1 = uid('obj');
      return {
        name: 'Formül Tanıtım',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 6,
        objects: [
          {
            id: id1,
            type: 'latex',
            name: 'Formül',
            x: 960,
            y: 540,
            width: 300,
            height: 100,
            rotation: 0,
            fill: '#ffffff',
            stroke: 'transparent',
            strokeWidth: 0,
            opacity: 1,
            zOrder: 0,
            latex: 'E = mc^2',
            enterTime: 0,
            duration: 5,
            enterAnim: 'write',
            exitAnim: 'none',
            enterAnimDur: 1.5,
            exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'shape_transform',
    label: 'Şekil Dönüşümü',
    description: 'Bir şekil diğerine morph olur',
    icon: '⇌',
    category: 'general',
    project: () => {
      const src = uid('obj');
      const tgt = uid('obj');
      const clip = uid('clip');
      return {
        name: 'Şekil Dönüşümü',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 6,
        objects: [
          {
            id: src,
            type: 'circle',
            name: 'Kaynak',
            x: 960,
            y: 540,
            width: 200,
            height: 200,
            rotation: 0,
            fill: '#3b82f6',
            stroke: '#ffffff',
            strokeWidth: 2,
            opacity: 1,
            zOrder: 0,
            enterTime: 0,
            duration: 4,
            enterAnim: 'grow_in',
            exitAnim: 'none',
            enterAnimDur: 0.5,
            exitAnimDur: 0.5,
          },
          {
            id: tgt,
            type: 'square',
            name: 'Hedef',
            x: 960,
            y: 540,
            width: 200,
            height: 200,
            rotation: 0,
            fill: '#22c55e',
            stroke: '#ffffff',
            strokeWidth: 2,
            opacity: 1,
            zOrder: 1,
            enterTime: 1.5,
            duration: 4,
            enterAnim: 'none',
            exitAnim: 'none',
            enterAnimDur: 0.5,
            exitAnimDur: 0.5,
          },
        ],
        tracks: [
          {
            id: 'track_1',
            name: 'Track 1',
            clips: [
              {
                id: clip,
                type: 'transform',
                startTime: 1.5,
                duration: 1.5,
                easing: 'ease_in_out_cubic',
                sourceId: src,
                targetId: tgt,
                params: {},
                overshoot: 0,
                settle: 1.0,
                morphQuality: 'medium',
              },
            ],
          },
          { id: 'track_2', name: 'Track 2', clips: [] },
        ],
      };
    },
  },
  {
    id: 'title_slide',
    label: 'Başlık Slaydı',
    description: 'Başlık ve alt başlık kademeli giriş',
    icon: 'T',
    category: 'general',
    project: () => {
      const title = uid('obj');
      const sub = uid('obj');
      return {
        name: 'Başlık Slaydı',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 8,
        objects: [
          {
            id: title,
            type: 'text',
            name: 'Başlık',
            x: 960,
            y: 480,
            width: 800,
            height: 80,
            rotation: 0,
            fill: '#ffffff',
            stroke: 'transparent',
            strokeWidth: 0,
            opacity: 1,
            zOrder: 0,
            content: 'Başlık Metni',
            fontSize: 72,
            fontFamily: 'Roboto',
            textAlign: 'center',
            fontWeight: 'bold',
            fontStyle: 'normal',
            enterTime: 0,
            duration: 7,
            enterAnim: 'fly_in_bottom',
            exitAnim: 'none',
            enterAnimDur: 0.6,
            exitAnimDur: 0.5,
          },
          {
            id: sub,
            type: 'text',
            name: 'Alt Başlık',
            x: 960,
            y: 600,
            width: 600,
            height: 50,
            rotation: 0,
            fill: '#94a3b8',
            stroke: 'transparent',
            strokeWidth: 0,
            opacity: 1,
            zOrder: 1,
            content: 'Alt başlık açıklaması',
            fontSize: 36,
            fontFamily: 'Roboto',
            textAlign: 'center',
            fontWeight: 'normal',
            fontStyle: 'normal',
            enterTime: 0.5,
            duration: 6.5,
            enterAnim: 'fade_in',
            exitAnim: 'none',
            enterAnimDur: 0.8,
            exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'axes_intro',
    label: 'Koordinat Sistemi',
    description: 'Eksenler sahneye çizilir',
    icon: '⊕',
    category: 'general',
    project: () => {
      const ax = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Koordinat Sistemi',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 6,
        objects: [
          {
            id: ax,
            type: 'axes',
            name: 'Eksenler',
            x: 960,
            y: 540,
            width: 800,
            height: 500,
            rotation: 0,
            fill: '#ffffff',
            stroke: '#ffffff',
            strokeWidth: 2,
            opacity: 1,
            zOrder: 0,
            xRange: [-5, 5, 1],
            yRange: [-3, 3, 1],
            enterTime: 0,
            duration: 5,
            enterAnim: 'draw',
            exitAnim: 'none',
            enterAnimDur: 1.2,
            exitAnimDur: 0.5,
          },
          {
            id: lbl,
            // A LaTeX (MathTex) object so the expression typesets in the proper
            // math font (italic x, real superscript) instead of a plain Text font.
            type: 'latex',
            name: 'Etiket',
            x: 960,
            y: 200,
            width: 220,
            height: 80,
            rotation: 0,
            fill: '#94a3b8',
            stroke: 'transparent',
            strokeWidth: 0,
            opacity: 1,
            zOrder: 1,
            latex: 'f(x) = x^2',
            enterTime: 1.5,
            duration: 3.5,
            enterAnim: 'fade_in',
            exitAnim: 'none',
            enterAnimDur: 0.5,
            exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'limit_approach',
    label: 'Limit Yaklaşımı',
    description: 'x → c yaklaşımı ile limit kavramı',
    icon: 'lim',
    category: 'calculus',
    project: () => {
      const np = uid('obj');
      const d1 = uid('obj');
      const d2 = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Limit Yaklaşımı',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 6,
        objects: [
          {
            id: np, type: 'numberplane', name: 'Düzlem',
            x: 960, y: 540, width: 1000, height: 620,
            rotation: 0, fill: '#1e293b', stroke: '#334155', strokeWidth: 1,
            opacity: 1, zOrder: 0,
            xRange: [-5, 5, 1], yRange: [-3, 3, 1],
            enterTime: 0, duration: 5,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.0, exitAnimDur: 0.5,
          },
          {
            id: d1, type: 'dot', name: 'x yaklaşan nokta',
            x: 800, y: 540, width: 20, height: 20,
            rotation: 0, fill: '#ef4444', stroke: '#ef4444', strokeWidth: 0,
            opacity: 1, zOrder: 2,
            enterTime: 1.2, duration: 4.8,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
          {
            id: d2, type: 'dot', name: 'Limit noktası',
            x: 960, y: 540, width: 24, height: 24,
            rotation: 0, fill: '#f97316', stroke: '#f97316', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            enterTime: 2.0, duration: 4,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Limit',
            x: 960, y: 160, width: 480, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 4,
            latex: '\\lim_{x \\to 0} f(x) = L',
            enterTime: 1.5, duration: 4.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'derivative_tangent',
    label: 'Türev Teğet',
    description: 'Bir noktada türev ve teğet çizgisi gösterimi',
    icon: '∂',
    category: 'calculus',
    project: () => {
      const ax = uid('obj');
      const lbl = uid('obj');
      const gid = uid('obj');
      return {
        name: 'Türev Teğet',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 8,
        objects: [
          {
            id: ax, type: 'axes', name: 'Eksenler',
            x: 960, y: 560, width: 900, height: 560,
            rotation: 0, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            xRange: [-3, 3, 1], yRange: [-1, 5, 1],
            graphs: [{
              id: gid,
              expression: 'x**2',
              color: '#3b82f6',
              xMin: -2.5,
              xMax: 2.5,
              strokeWidth: 3,
              tangent: { enabled: true, x: 1 },
            }],
            enterTime: 0, duration: 7,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.5, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Türev',
            x: 960, y: 160, width: 500, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            latex: "f'(x) = 2x,\\quad f'(1) = 2",
            enterTime: 2.0, duration: 6.0,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'integral_area',
    label: 'İntegral Alan',
    description: 'Belirli integral ve Riemann alanı gösterimi',
    icon: '∫',
    category: 'calculus',
    project: () => {
      const ax = uid('obj');
      const lbl = uid('obj');
      const gid = uid('obj');
      return {
        name: 'İntegral Alan',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: ax, type: 'axes', name: 'Eksenler',
            x: 960, y: 570, width: 900, height: 560,
            rotation: 0, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            xRange: [0, 4, 1], yRange: [0, 5, 1],
            graphs: [{
              id: gid,
              expression: 'x**2',
              color: '#3b82f6',
              xMin: 0,
              xMax: 3,
              strokeWidth: 3,
              area: { enabled: true, xMin: 0, xMax: 3, color: '#3b82f6', opacity: 0.3 },
              riemann: { enabled: true, xMin: 0, xMax: 3, dx: 0.5, type: 'right', color: '#22c55e' },
            }],
            enterTime: 0, duration: 6,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.5, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'İntegral',
            x: 960, y: 160, width: 440, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            latex: '\\int_0^3 x^2\\,dx = 9',
            enterTime: 2.0, duration: 5.0,
            enterAnim: 'write', exitAnim: 'none',
            enterAnimDur: 1.0, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
];

export default TEMPLATES;
