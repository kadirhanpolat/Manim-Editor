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
  {
    id: 'vector_addition',
    label: 'Vektör Toplama',
    description: 'İki vektörün bileşke toplamı gösterimi',
    icon: '→',
    category: 'linear_algebra',
    project: () => {
      const vc1 = uid('obj');
      const vc2 = uid('obj');
      const res = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Vektör Toplama',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: vc1, type: 'vector_components', name: 'u vektörü',
            x: 480, y: 750, width: 400, height: 300,
            rotation: 0, fill: '#3b82f6', stroke: '#3b82f6', strokeWidth: 3,
            opacity: 1, zOrder: 0,
            vx: 400, vy: -300,
            enterTime: 0, duration: 6,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.8, exitAnimDur: 0.5,
          },
          {
            id: vc2, type: 'vector_components', name: 'v vektörü',
            x: 880, y: 450, width: 300, height: 250,
            rotation: 0, fill: '#22c55e', stroke: '#22c55e', strokeWidth: 3,
            opacity: 1, zOrder: 1,
            vx: 300, vy: -200,
            enterTime: 1.0, duration: 5,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.8, exitAnimDur: 0.5,
          },
          {
            id: res, type: 'arrow', name: 'Bileşke',
            x: 480, y: 750, width: 700, height: 500,
            rotation: 0, fill: '#f97316', stroke: '#f97316', strokeWidth: 4,
            opacity: 1, zOrder: 2,
            enterTime: 2.0, duration: 4,
            enterAnim: 'grow_arrow', exitAnim: 'none',
            enterAnimDur: 0.8, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Formül',
            x: 960, y: 160, width: 400, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            latex: '\\vec{u} + \\vec{v} = \\vec{w}',
            enterTime: 2.5, duration: 4.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'matrix_product',
    label: 'Matris Çarpımı',
    description: 'İki 2×2 matrisin çarpımı',
    icon: '⊗',
    category: 'linear_algebra',
    project: () => {
      const mA = uid('obj');
      const mB = uid('obj');
      const mC = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Matris Çarpımı',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: mA, type: 'matrix', name: 'A',
            x: 480, y: 540, width: 200, height: 160,
            rotation: 0, fill: '#3b82f6', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 0,
            matrixData: [['1', '2'], ['3', '4']],
            bracket: '[',
            enterTime: 0, duration: 6,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.6, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'Çarpı',
            x: 720, y: 540, width: 80, height: 60,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            latex: '\\cdot',
            enterTime: 0.7, duration: 5.3,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
          {
            id: mB, type: 'matrix', name: 'B',
            x: 960, y: 540, width: 200, height: 160,
            rotation: 0, fill: '#22c55e', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 2,
            matrixData: [['5', '6'], ['7', '8']],
            bracket: '[',
            enterTime: 0.7, duration: 5.3,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.6, exitAnimDur: 0.5,
          },
          {
            id: mC, type: 'matrix', name: 'Sonuç',
            x: 1380, y: 540, width: 240, height: 160,
            rotation: 0, fill: '#f97316', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            matrixData: [['19', '22'], ['43', '50']],
            bracket: '[',
            enterTime: 2.0, duration: 4,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.6, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'unit_circle',
    label: 'Birim Çember',
    description: 'Trigonometrik birim çember ve sin/cos gösterimi',
    icon: '○',
    category: 'trigonometry',
    project: () => {
      const np = uid('obj');
      const circ = uid('obj');
      const ang = uid('obj');
      const pt = uid('obj');
      const lbl = uid('obj');
      return {
        name: 'Birim Çember',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: np, type: 'numberplane', name: 'Düzlem',
            x: 960, y: 540, width: 700, height: 700,
            rotation: 0, fill: '#1e293b', stroke: '#334155', strokeWidth: 1,
            opacity: 1, zOrder: 0,
            xRange: [-1.5, 1.5, 0.5], yRange: [-1.5, 1.5, 0.5],
            enterTime: 0, duration: 6,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.0, exitAnimDur: 0.5,
          },
          {
            id: circ, type: 'circle', name: 'Birim Çember',
            x: 960, y: 540, width: 270, height: 270,
            rotation: 0, fill: 'transparent', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 1,
            enterTime: 1.0, duration: 5,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 1.2, exitAnimDur: 0.5,
          },
          {
            id: ang, type: 'angle', name: 'Açı θ',
            x: 960, y: 540, width: 140, height: 140,
            rotation: 0, fill: '#f97316', stroke: '#f97316', strokeWidth: 2,
            opacity: 1, zOrder: 2,
            vertex: [0, 0],
            point1: [70, 0],
            point2: [49, -49],
            rightAngle: false,
            radius: 40,
            label: '\\theta',
            enterTime: 2.2, duration: 4.8,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: pt, type: 'coord_point', name: 'P noktası',
            x: 1056, y: 445, width: 20, height: 20,
            rotation: 0, fill: '#ef4444', stroke: '#ef4444', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            decimals: 2,
            enterTime: 2.2, duration: 4.8,
            enterAnim: 'grow_in', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: lbl, type: 'latex', name: 'sin/cos',
            x: 960, y: 160, width: 400, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 4,
            latex: 'P = (\\cos\\theta,\\,\\sin\\theta)',
            enterTime: 2.5, duration: 4.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'sin_cos_wave',
    label: 'Sin & Cos Grafiği',
    description: 'Sinüs ve kosinüs dalgaları karşılaştırması',
    icon: '∿',
    category: 'trigonometry',
    project: () => {
      const ax = uid('obj');
      const g1 = uid('obj');
      const g2 = uid('obj');
      return {
        name: 'Sin & Cos Grafiği',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 7,
        objects: [
          {
            id: ax, type: 'axes', name: 'Eksenler',
            x: 960, y: 560, width: 1100, height: 500,
            rotation: 0, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            xRange: [0, 6.28, 1.57], yRange: [-1.5, 1.5, 0.5],
            graphs: [
              {
                id: g1,
                expression: 'sin(x)',
                color: '#3b82f6',
                xMin: 0,
                xMax: 6.28,
                strokeWidth: 3,
              },
              {
                id: g2,
                expression: 'cos(x)',
                color: '#ef4444',
                xMin: 0,
                xMax: 6.28,
                strokeWidth: 3,
              },
            ],
            enterTime: 0, duration: 6,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 2.0, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'normal_distribution',
    label: 'Normal Dağılım',
    description: 'Gauss çanı eğrisi ve ±1σ alanı',
    icon: '⌒',
    category: 'statistics',
    project: () => {
      const ax = uid('obj');
      const g1 = uid('obj');
      const lbl1 = uid('obj');
      const lbl2 = uid('obj');
      return {
        name: 'Normal Dağılım',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 6,
        objects: [
          {
            id: ax, type: 'axes', name: 'Eksenler',
            x: 960, y: 600, width: 1200, height: 500,
            rotation: 0, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            xRange: [-4, 4, 1], yRange: [0, 0.5, 0.1],
            graphs: [
              {
                id: g1,
                expression: '2.718**(-(x**2)/2)/2.507',
                color: '#3b82f6',
                xMin: -4,
                xMax: 4,
                strokeWidth: 3,
                area: { enabled: true, xMin: -1, xMax: 1, color: '#3b82f6', opacity: 0.3 },
              },
            ],
            enterTime: 0, duration: 5,
            enterAnim: 'draw', exitAnim: 'none',
            enterAnimDur: 2.0, exitAnimDur: 0.5,
          },
          {
            id: lbl1, type: 'latex', name: 'Formül',
            x: 960, y: 140, width: 400, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            latex: '\\mathcal{N}(0,1)',
            enterTime: 2.2, duration: 3.8,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: lbl2, type: 'latex', name: '68%',
            x: 960, y: 220, width: 200, height: 60,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 2,
            latex: '68\\%',
            enterTime: 2.8, duration: 3.2,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'theorem_proof',
    label: 'Teorem İspatı',
    description: 'Teorem ifadesi, kanıt adımları ve sonuç',
    icon: '∎',
    category: 'general',
    project: () => {
      const thmTxt = uid('obj');
      const proofHdr = uid('obj');
      const proofBody = uid('obj');
      const qed = uid('obj');
      return {
        name: 'Teorem İspatı',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 10,
        objects: [
          {
            id: thmTxt, type: 'latex', name: 'Teorem',
            x: 960, y: 260, width: 900, height: 120,
            rotation: 0, fill: '#facc15', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 0,
            latex: 'a^2 + b^2 = c^2',
            enterTime: 0, duration: 9,
            enterAnim: 'write', exitAnim: 'none',
            enterAnimDur: 1.0, exitAnimDur: 0.5,
          },
          {
            id: proofHdr, type: 'text', name: 'Kanıt başlığı',
            x: 960, y: 440, width: 300, height: 60,
            rotation: 0, fill: '#94a3b8', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            text: 'Kanıt:',
            fontSize: 32,
            fontFamily: 'Arial',
            enterTime: 1.5, duration: 7.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: proofBody, type: 'text', name: 'Kanıt metni',
            x: 960, y: 580, width: 1100, height: 160,
            rotation: 0, fill: '#e2e8f0', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 2,
            text: 'Dik üçgende hipotenüs karesi, diğer iki kenar karelerinin toplamına eşittir.',
            fontSize: 28,
            fontFamily: 'Arial',
            enterTime: 2.5, duration: 7.5,
            enterAnim: 'fly_in_bottom', exitAnim: 'none',
            enterAnimDur: 0.6, exitAnimDur: 0.5,
          },
          {
            id: qed, type: 'latex', name: 'Q.E.D.',
            x: 960, y: 820, width: 120, height: 80,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 3,
            latex: '\\square',
            enterTime: 7.5, duration: 2.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
  {
    id: 'algo_steps',
    label: 'Algoritma Adımları',
    description: 'Üç adımlı akış şeması: Başlat → İşle → Bitir',
    icon: '⚙',
    category: 'programming',
    project: () => {
      const box1 = uid('obj');
      const box2 = uid('obj');
      const box3 = uid('obj');
      const txt1 = uid('obj');
      const txt2 = uid('obj');
      const txt3 = uid('obj');
      const arr1 = uid('obj');
      const arr2 = uid('obj');
      return {
        name: 'Algoritma Adımları',
        editorMode: 'visual',
        codeSource: '',
        stage: { ...STAGE },
        assets: [],
        groups: [],
        sceneDuration: 8,
        objects: [
          {
            id: box1, type: 'rectangle', name: 'Adım 1 kutusu',
            x: 320, y: 540, width: 320, height: 120,
            rotation: 0, fill: '#1e40af', stroke: '#3b82f6', strokeWidth: 2,
            opacity: 1, zOrder: 0,
            enterTime: 0, duration: 7,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: txt1, type: 'text', name: 'Başlat',
            x: 320, y: 540, width: 320, height: 120,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 1,
            text: 'Başlat',
            fontSize: 32,
            fontFamily: 'Arial',
            enterTime: 0.2, duration: 6.8,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
          {
            id: arr1, type: 'arrow', name: 'Ok 1',
            x: 480, y: 540, width: 200, height: 0,
            rotation: 0, fill: '#94a3b8', stroke: '#94a3b8', strokeWidth: 3,
            opacity: 1, zOrder: 2,
            enterTime: 1.0, duration: 6,
            enterAnim: 'grow_arrow', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: box2, type: 'rectangle', name: 'Adım 2 kutusu',
            x: 960, y: 540, width: 320, height: 120,
            rotation: 0, fill: '#1e40af', stroke: '#3b82f6', strokeWidth: 2,
            opacity: 1, zOrder: 3,
            enterTime: 1.5, duration: 5.5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: txt2, type: 'text', name: 'İşle',
            x: 960, y: 540, width: 320, height: 120,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 4,
            text: 'İşle',
            fontSize: 32,
            fontFamily: 'Arial',
            enterTime: 1.7, duration: 5.3,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
          {
            id: arr2, type: 'arrow', name: 'Ok 2',
            x: 1120, y: 540, width: 200, height: 0,
            rotation: 0, fill: '#94a3b8', stroke: '#94a3b8', strokeWidth: 3,
            opacity: 1, zOrder: 5,
            enterTime: 2.5, duration: 5,
            enterAnim: 'grow_arrow', exitAnim: 'none',
            enterAnimDur: 0.4, exitAnimDur: 0.5,
          },
          {
            id: box3, type: 'rectangle', name: 'Adım 3 kutusu',
            x: 1600, y: 540, width: 320, height: 120,
            rotation: 0, fill: '#166534', stroke: '#22c55e', strokeWidth: 2,
            opacity: 1, zOrder: 6,
            enterTime: 3.0, duration: 5,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.5, exitAnimDur: 0.5,
          },
          {
            id: txt3, type: 'text', name: 'Bitir',
            x: 1600, y: 540, width: 320, height: 120,
            rotation: 0, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
            opacity: 1, zOrder: 7,
            text: 'Bitir',
            fontSize: 32,
            fontFamily: 'Arial',
            enterTime: 3.2, duration: 4.8,
            enterAnim: 'fade_in', exitAnim: 'none',
            enterAnimDur: 0.3, exitAnimDur: 0.5,
          },
        ],
        tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
      };
    },
  },
];

export default TEMPLATES;
