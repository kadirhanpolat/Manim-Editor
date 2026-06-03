# 3D Sahne Desteği Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manim Motion Editor'e 4 katmanlı 3D sahne desteği eklemek: veri modeli + codegen, split viewport, timeline uzantısı, tam parite.

**Architecture:** `sceneType: '3d'` flag'i yeni proje alanı açar; 6 yeni 3D nesne tipi (sphere/cube/cone/cylinder/torus/axes3d) `x3d/y3d/z3d` Manim birimiyle konumlanır; `StageCanvas.vue` split viewport (izometrik sol + tepeden sağ) sunar; codegen `ThreeDScene` base class çıktısı üretir.

**Tech Stack:** Vue 3 + Pinia, Konva.js, Node.js codegen (codegen.js + manim.js), Vitest + Node.js test runner

---

## Dosya Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `services/web/src/store/project.js` | `sceneType`, `camera3d`, 3D nesne defaults, `SHAPE_DEFAULTS`, `SHAPE_COLORS` |
| `services/api/src/compiler/codegen.js` | `objectCode3d()`, `ThreeDScene` base seçimi, `generatePythonCode` güncelleme |
| `services/web/src/export/manim.js` | codegen.js ile aynı 3D değişiklikleri |
| `services/web/src/components/stage/StageCanvas.vue` | Split viewport, `iso()`, `top()`, 3D nesne Konva şekilleri, 3D drag |
| `services/web/src/components/inspector/Inspector.vue` | `sceneType` badge + `Position3DPanel` dahil et |
| `services/web/src/components/inspector/Position3DPanel.vue` | Yeni — x3d/y3d/z3d/rx/ry/rz + resolution alanları |
| `services/web/src/components/timeline/Timeline.vue` | Camera 3D klipleri için phi/theta gösterimi |
| `services/api/src/compiler/codegen.js` | `camera_move` phi/theta codegen |
| `services/web/src/export/manim.js` | Aynı camera phi/theta codegen |
| `services/web/src/engine/keyframe.js` | `_kfPropSet` x3d/y3d/z3d/rx/ry/rz desteği |
| `services/web/tests/components/3d-store.test.js` | Yeni — Layer 1 store testleri |
| `services/web/tests/components/3d-codegen.test.js` | Yeni — Layer 1 codegen testleri |
| `services/web/tests/components/3d-viewport.test.js` | Yeni — Layer 2 projeksiyon testleri |
| `services/web/tests/components/3d-layer3.test.js` | Yeni — Layer 3 camera phi/theta testleri |
| `services/web/tests/components/3d-layer4.test.js` | Yeni — Layer 4 keyframe + voiceover testleri |

---

## Task 1: Store — sceneType, camera3d, 3D nesne defaults

**Files:**
- Modify: `services/web/src/store/project.js`
- Test: `services/web/tests/components/3d-store.test.js`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/3d-store.test.js` oluştur:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('sceneType', () => {
  it('defaults to 2d', () => {
    expect(store.project.sceneType).toBe('2d');
  });

  it('setSceneType switches to 3d', () => {
    store.setSceneType('3d');
    expect(store.project.sceneType).toBe('3d');
  });

  it('setSceneType switches back to 2d', () => {
    store.setSceneType('3d');
    store.setSceneType('2d');
    expect(store.project.sceneType).toBe('2d');
  });
});

describe('camera3d', () => {
  it('defaults exist on project', () => {
    expect(store.project.camera3d).toBeDefined();
    expect(store.project.camera3d.phi).toBe(75);
    expect(store.project.camera3d.theta).toBe(-45);
    expect(store.project.camera3d.zoom).toBe(1.0);
  });

  it('setCamera3d updates phi/theta/zoom', () => {
    store.setCamera3d({ phi: 60, theta: -60, zoom: 1.5 });
    expect(store.project.camera3d.phi).toBe(60);
    expect(store.project.camera3d.theta).toBe(-60);
    expect(store.project.camera3d.zoom).toBe(1.5);
  });
});

describe('3D object defaults', () => {
  it('sphere gets x3d/y3d/z3d fields', () => {
    const obj = store.addObject('sphere', 960, 540);
    expect(obj.type).toBe('sphere');
    expect(obj.x3d).toBe(0);
    expect(obj.y3d).toBe(0);
    expect(obj.z3d).toBe(0);
    expect(obj.rx).toBe(0);
    expect(obj.ry).toBe(0);
    expect(obj.rz).toBe(0);
    expect(obj.resolution).toBe(20);
  });

  it('cube gets x3d/y3d/z3d fields', () => {
    const obj = store.addObject('cube', 960, 540);
    expect(obj.type).toBe('cube');
    expect(obj.x3d).toBeDefined();
    expect(obj.y3d).toBeDefined();
    expect(obj.z3d).toBeDefined();
  });

  it('axes3d gets x3d/y3d/z3d and range fields', () => {
    const obj = store.addObject('axes3d', 960, 540);
    expect(obj.type).toBe('axes3d');
    expect(obj.xRange).toEqual([-3, 3, 1]);
    expect(obj.yRange).toEqual([-3, 3, 1]);
    expect(obj.zRange).toEqual([-3, 3, 1]);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-store.test.js
```

Beklenen: FAIL — `store.setSceneType is not a function`

- [ ] **Step 3: `createDefaultProject` ve store actions'ı güncelle**

`services/web/src/store/project.js` içinde `createDefaultProject` fonksiyonunu bul (satır ~29), `keyframeDefaults` bloğunun hemen altına ekle:

```js
sceneType: '2d',           // '2d' | '3d'
camera3d: {
  phi: 75,
  theta: -45,
  zoom: 1.0,
},
```

- [ ] **Step 4: SHAPE_DEFAULTS'a 3D nesne tiplerini ekle**

`SHAPE_DEFAULTS` objesini bul (satır ~120). Mevcut son girdiden sonra ekle:

```js
sphere:     { width: 120, height: 120, fill: '#e67700', stroke: '#fff', strokeWidth: 2 },
cube:       { width: 120, height: 120, fill: '#3b5bdb', stroke: '#fff', strokeWidth: 2 },
cone:       { width: 100, height: 120, fill: '#2f9e44', stroke: '#fff', strokeWidth: 2 },
cylinder:   { width: 100, height: 120, fill: '#1098ad', stroke: '#fff', strokeWidth: 2 },
torus:      { width: 130, height: 130, fill: '#ae3ec9', stroke: '#fff', strokeWidth: 2 },
axes3d:     { width: 400, height: 400, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2 },
```

- [ ] **Step 5: SHAPE_COLORS'a 3D nesne tiplerini ekle**

`SHAPE_COLORS` objesini bul (satır ~142). Mevcut son girdiden sonra ekle:

```js
sphere: '#e67700', cube: '#3b5bdb', cone: '#2f9e44',
cylinder: '#1098ad', torus: '#ae3ec9', axes3d: '#10b981',
```

- [ ] **Step 6: `addObject` action'ında 3D nesne alanları ekle**

`addObject` action'ını bul. Mevcut `if (type === 'axes')` bloğunu (graphs[] ekleme) bul; hemen altına ekle:

```js
const is3D = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'].includes(type);
if (is3D) {
  obj.x3d = 0;
  obj.y3d = 0;
  obj.z3d = 0;
  obj.rx = 0;
  obj.ry = 0;
  obj.rz = 0;
  obj.resolution = 20;
  obj.sideLength = 1.0;    // cube
  obj.radius = 0.5;        // sphere/cone/cylinder/torus
  obj.height = 1.5;        // cone/cylinder
  obj.majorRadius = 1.0;   // torus
  obj.minorRadius = 0.3;   // torus
}
if (type === 'axes3d') {
  obj.xRange = [-3, 3, 1];
  obj.yRange = [-3, 3, 1];
  obj.zRange = [-3, 3, 1];
}
```

- [ ] **Step 7: `setSceneType` ve `setCamera3d` actions ekle**

Store actions listesini bul. Mevcut `setCameraType` action'ından sonra ekle:

```js
setSceneType(type) {
  this.project.sceneType = type;
  this.isDirty = true;
  this.commitState();
},
setCamera3d(params) {
  Object.assign(this.project.camera3d, params);
  this.isDirty = true;
  this.commitState();
},
```

- [ ] **Step 8: Testi çalıştır, geçtiğini doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-store.test.js
```

Beklenen: PASS — tüm testler geçmeli

- [ ] **Step 9: Tüm testleri çalıştır, regresyon yok**

```bash
cd services/web && npm run test:unit && npm test
```

Beklenen: mevcut test sayısı korunur + 3D store testleri geçer

- [ ] **Step 10: Commit**

```bash
git add services/web/src/store/project.js services/web/tests/components/3d-store.test.js
git commit -m "feat(store): add sceneType, camera3d, 3D object defaults (Layer 1)"
```

---

## Task 2: Codegen — 3D nesne codegen + ThreeDScene base

**Files:**
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`
- Test: `services/web/tests/components/3d-codegen.test.js`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/3d-codegen.test.js` oluştur:

```js
import { describe, it, expect } from 'vitest';
import { generateCode } from '../../src/export/manim.js';

function makeProject(objects = [], sceneType = '3d', cameraOverrides = {}) {
  return {
    name: 'Test3D',
    sceneType,
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    tracks: [{ id: 't1', clips: [] }],
    cameraType: 'static',
    cameraTrack: [],
    camera3d: { phi: 75, theta: -45, zoom: 1.0, ...cameraOverrides },
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
  };
}

describe('ThreeDScene base class', () => {
  it('uses ThreeDScene when sceneType is 3d', () => {
    const project = makeProject([]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('class MainScene(ThreeDScene)');
  });

  it('uses Scene when sceneType is 2d', () => {
    const project = makeProject([], '2d');
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('class MainScene(Scene)');
  });

  it('sets camera orientation from camera3d', () => {
    const project = makeProject([]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('self.set_camera_orientation');
    expect(code).toContain('phi=75');
    expect(code).toContain('theta=-45');
  });
});

describe('sphere codegen', () => {
  it('generates Sphere with correct radius and position', () => {
    const sphere = {
      id: 'sp1', type: 'sphere',
      x3d: 1, y3d: 0, z3d: 0,
      radius: 0.5, resolution: 20,
      fill: '#e67700', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([sphere]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Sphere(radius=0.5');
    expect(code).toContain('resolution=(20, 20)');
    expect(code).toContain('move_to([1, 0, 0])');
    expect(code).toContain('set_color');
  });
});

describe('cube codegen', () => {
  it('generates Cube with side_length and position', () => {
    const cube = {
      id: 'cu1', type: 'cube',
      x3d: 0, y3d: 0, z3d: 0,
      sideLength: 1.0,
      fill: '#3b5bdb', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([cube]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Cube(side_length=1.0)');
    expect(code).toContain('move_to([0, 0, 0])');
  });
});

describe('axes3d codegen', () => {
  it('generates ThreeDAxes with ranges', () => {
    const ax = {
      id: 'ax1', type: 'axes3d',
      x3d: 0, y3d: 0, z3d: 0,
      xRange: [-3, 3, 1], yRange: [-3, 3, 1], zRange: [-3, 3, 1],
      fill: '#ffffff', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([ax]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('ThreeDAxes(');
    expect(code).toContain('x_range=[-3, 3, 1]');
  });
});

describe('cone / cylinder / torus codegen', () => {
  it('generates Cone with base_radius and height', () => {
    const cone = {
      id: 'c1', type: 'cone',
      x3d: 0, y3d: 0, z3d: 0,
      radius: 0.5, height: 1.0, resolution: 20,
      fill: '#2f9e44', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([cone]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Cone(base_radius=0.5');
    expect(code).toContain('height=1.0');
  });

  it('generates Cylinder', () => {
    const cyl = {
      id: 'cy1', type: 'cylinder',
      x3d: 0, y3d: 0, z3d: 0,
      radius: 0.5, height: 1.5, resolution: 20,
      fill: '#1098ad', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([cyl]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Cylinder(radius=0.5');
    expect(code).toContain('height=1.5');
  });

  it('generates Torus', () => {
    const tor = {
      id: 't1', type: 'torus',
      x3d: 0, y3d: 0, z3d: 0,
      majorRadius: 1.0, minorRadius: 0.3, resolution: 20,
      fill: '#ae3ec9', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject([tor]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Torus(major_radius=1.0');
    expect(code).toContain('minor_radius=0.3');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-codegen.test.js
```

Beklenen: FAIL

- [ ] **Step 3: manim.js — `objectCode3d()` fonksiyonu ekle**

`services/web/src/export/manim.js` içinde `FRAME_HEIGHT` sabitinden sonra şu fonksiyonu ekle:

```js
function objectCode3d(obj) {
  const n = v(obj.id), lines = [];
  const fill = hex(obj.fill) || '"#FFFFFF"';
  const opacity = safeOpacity(obj.opacity ?? 1);
  const res = Math.max(4, Math.round(obj.resolution ?? 20));

  switch (obj.type) {
    case 'sphere':
      lines.push(`${n} = Sphere(radius=${(obj.radius ?? 0.5).toFixed(3)}, resolution=(${res}, ${res}))`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to([${(obj.x3d ?? 0).toFixed(3)}, ${(obj.y3d ?? 0).toFixed(3)}, ${(obj.z3d ?? 0).toFixed(3)}])`);
      break;
    case 'cube':
      lines.push(`${n} = Cube(side_length=${(obj.sideLength ?? 1.0).toFixed(3)})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to([${(obj.x3d ?? 0).toFixed(3)}, ${(obj.y3d ?? 0).toFixed(3)}, ${(obj.z3d ?? 0).toFixed(3)}])`);
      break;
    case 'cone':
      lines.push(`${n} = Cone(base_radius=${(obj.radius ?? 0.5).toFixed(3)}, height=${(obj.height ?? 1.0).toFixed(3)}, resolution=${res})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to([${(obj.x3d ?? 0).toFixed(3)}, ${(obj.y3d ?? 0).toFixed(3)}, ${(obj.z3d ?? 0).toFixed(3)}])`);
      break;
    case 'cylinder':
      lines.push(`${n} = Cylinder(radius=${(obj.radius ?? 0.5).toFixed(3)}, height=${(obj.height ?? 1.5).toFixed(3)}, resolution=${res})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to([${(obj.x3d ?? 0).toFixed(3)}, ${(obj.y3d ?? 0).toFixed(3)}, ${(obj.z3d ?? 0).toFixed(3)}])`);
      break;
    case 'torus':
      lines.push(`${n} = Torus(major_radius=${(obj.majorRadius ?? 1.0).toFixed(3)}, minor_radius=${(obj.minorRadius ?? 0.3).toFixed(3)}, resolution=${res})`);
      lines.push(`${n}.set_color(${fill})`);
      if (opacity < 1) lines.push(`${n}.set_opacity(${opacity.toFixed(3)})`);
      lines.push(`${n}.move_to([${(obj.x3d ?? 0).toFixed(3)}, ${(obj.y3d ?? 0).toFixed(3)}, ${(obj.z3d ?? 0).toFixed(3)}])`);
      break;
    case 'axes3d': {
      const xr = obj.xRange ?? [-3, 3, 1];
      const yr = obj.yRange ?? [-3, 3, 1];
      const zr = obj.zRange ?? [-3, 3, 1];
      lines.push(`${n} = ThreeDAxes(`);
      lines.push(`    x_range=[${xr[0]}, ${xr[1]}, ${xr[2]}],`);
      lines.push(`    y_range=[${yr[0]}, ${yr[1]}, ${yr[2]}],`);
      lines.push(`    z_range=[${zr[0]}, ${zr[1]}, ${zr[2]}]`);
      lines.push(`)`);
      if ((obj.x3d ?? 0) !== 0 || (obj.y3d ?? 0) !== 0 || (obj.z3d ?? 0) !== 0) {
        lines.push(`${n}.move_to([${(obj.x3d ?? 0).toFixed(3)}, ${(obj.y3d ?? 0).toFixed(3)}, ${(obj.z3d ?? 0).toFixed(3)}])`);
      }
      break;
    }
    default:
      lines.push(`# Unknown 3D type: ${obj.type}`);
  }
  return lines;
}
```

- [ ] **Step 4: manim.js — `generateCode` fonksiyonunda ThreeDScene base seçimini güncelle**

`generateCode` fonksiyonunda `sceneBase` seçim bloğunu bul (şu an `MovingCameraScene` / `VoiceoverScene` / `Scene` seçiyor). Şu hale getir:

```js
const is3D = project.sceneType === '3d';
let sceneBase;
if (is3D) {
  sceneBase = hasReadyAudio ? 'ThreeDScene, VoiceoverScene' : 'ThreeDScene';
} else if (project.cameraType === 'moving') {
  sceneBase = 'MovingCameraScene';
} else if (hasReadyAudio) {
  sceneBase = 'VoiceoverScene';
} else {
  sceneBase = 'Scene';
}
```

- [ ] **Step 5: manim.js — 3D import satırını ekle**

`generateCode` içinde `from manim import *` satırı ve import blokları. `hasReadyAudio` bloğunun hemen üstünde:

```js
if (is3D) {
  L.push('from manim.mobject.three_d.three_dimensions import Sphere, Cube, Cone, Cylinder, Torus');
  L.push('from manim import ThreeDAxes, ThreeDScene');
}
```

- [ ] **Step 6: manim.js — `set_camera_orientation` ve 3D objectCode çağrısı ekle**

`generateCode` içinde `class MainScene(...)` satırının hemen altındaki `construct` bloğuna:

```js
if (is3D) {
  const cam = project.camera3d ?? { phi: 75, theta: -45, zoom: 1.0 };
  L.push(`        self.set_camera_orientation(`);
  L.push(`            phi=${cam.phi} * DEGREES,`);
  L.push(`            theta=${cam.theta} * DEGREES,`);
  L.push(`            zoom=${(cam.zoom ?? 1.0).toFixed(2)}`);
  L.push(`        )`);
}
```

Objects döngüsünde `objectCode()` çağrısının üstüne ekle:

```js
const obj3DTypes = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
// ...mevcut forEach döngüsünde:
if (obj3DTypes.includes(obj.type)) {
  objectCode3d(obj).forEach(l => L.push(indent + l));
} else {
  objectCode(obj, sw, sh, assetsPath, assetMap).forEach(l => L.push(indent + l));
}
```

- [ ] **Step 7: codegen.js — aynı değişiklikleri yap**

`services/api/src/compiler/codegen.js` dosyasında aynı 4 adımı tekrarla:
- `objectCode3d()` fonksiyonu ekle (manim.js ile birebir aynı, ama `v()` yerine `vn()` kullan)
- `generatePythonCode` içinde `sceneBase` seçimini güncelle
- 3D import satırlarını ekle
- `set_camera_orientation` bloğunu ekle
- Objects döngüsünde 3D yönlendirmeyi ekle

- [ ] **Step 8: Testi çalıştır, geçtiğini doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-codegen.test.js
```

Beklenen: PASS — tüm testler geçmeli

- [ ] **Step 9: Tüm testleri çalıştır**

```bash
cd services/web && npm run test:unit && npm test
```

Beklenen: mevcut test sayısı korunur + 3D codegen testleri geçer

- [ ] **Step 10: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/3d-codegen.test.js
git commit -m "feat(codegen): add 3D object types + ThreeDScene base class (Layer 1)"
```

---

## Task 3: Split Viewport — projeksiyon fonksiyonları + canvas layout

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue`
- Test: `services/web/tests/components/3d-viewport.test.js`

- [ ] **Step 1: Projeksiyon fonksiyonlarını test et**

`services/web/tests/components/3d-viewport.test.js` oluştur:

```js
import { describe, it, expect } from 'vitest';

const cos30 = Math.cos(Math.PI / 6);
const sin30 = Math.sin(Math.PI / 6);

function iso(x3d, y3d, z3d, cx, cy, scale) {
  const px = (x3d - z3d) * cos30;
  const py = -y3d + (x3d + z3d) * sin30;
  return { px: cx + px * scale, py: cy + py * scale };
}

function top(x3d, z3d, cx2, cy2, scale) {
  return { px: cx2 + x3d * scale, py: cy2 + z3d * scale };
}

describe('iso projection', () => {
  it('origin maps to center', () => {
    const r = iso(0, 0, 0, 100, 100, 50);
    expect(r.px).toBeCloseTo(100);
    expect(r.py).toBeCloseTo(100);
  });

  it('positive x shifts right and down in iso', () => {
    const r = iso(1, 0, 0, 100, 100, 50);
    expect(r.px).toBeGreaterThan(100);
  });

  it('positive y shifts upward', () => {
    const r = iso(0, 1, 0, 100, 100, 50);
    expect(r.py).toBeLessThan(100);
  });
});

describe('top projection', () => {
  it('origin maps to center', () => {
    const r = top(0, 0, 200, 100, 50);
    expect(r.px).toBeCloseTo(200);
    expect(r.py).toBeCloseTo(100);
  });

  it('positive x shifts right', () => {
    const r = top(1, 0, 200, 100, 50);
    expect(r.px).toBeGreaterThan(200);
  });

  it('positive z shifts down in top view', () => {
    const r = top(0, 1, 200, 100, 50);
    expect(r.py).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Testi çalıştır, geçtiğini doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-viewport.test.js
```

Beklenen: PASS (fonksiyonlar test dosyasında tanımlı, şimdilik)

- [ ] **Step 3: StageCanvas.vue — `<script setup>` bölümüne projeksiyon fonksiyonları ekle**

`StageCanvas.vue` içindeki `<script setup>` bölümünde, mevcut `import` satırlarından sonra ekle:

```js
// ── 3D Projection ─────────────────────────────────────────────────────────
const cos30 = Math.cos(Math.PI / 6);
const sin30 = Math.sin(Math.PI / 6);

function iso(x3d, y3d, z3d, cx, cy, scale) {
  const px = (x3d - z3d) * cos30;
  const py = -y3d + (x3d + z3d) * sin30;
  return { px: cx + px * scale, py: cy + py * scale };
}

function top(x3d, z3d, cx2, cy2, scale) {
  return { px: cx2 + x3d * scale, py: cy2 + z3d * scale };
}
```

- [ ] **Step 4: StageCanvas.vue — split viewport computed değerleri ekle**

`<script setup>` içinde, `store` import'undan sonra:

```js
const is3D = computed(() => store.project.sceneType === '3d');

// Split viewport: left panel (perspective/iso), right panel (top/XZ)
// splitRatio: fraction of total canvas width for left panel [0..1]
const splitRatio = ref(0.5);

const leftPanelWidth = computed(() => Math.floor(stageConfig.value.width * splitRatio.value));
const rightPanelWidth = computed(() => stageConfig.value.width - leftPanelWidth.value);
const splitX = computed(() => leftPanelWidth.value);  // divider X in canvas coords

// 3D projection scale: map 1 Manim unit to canvas pixels
const proj3DScale = computed(() => leftPanelWidth.value / 16);  // 16 Manim units across
const projCx = computed(() => leftPanelWidth.value / 2);
const projCy = computed(() => stageConfig.value.height / 2);
const projCx2 = computed(() => splitX.value + rightPanelWidth.value / 2);
const projCy2 = computed(() => stageConfig.value.height / 2);
```

- [ ] **Step 5: StageCanvas.vue — 3D nesneler için Konva şekilleri ekle**

`<template>` içinde Objects layer'ına, mevcut son şekil bloğundan sonra (numberline bloğundan sonra) ekle:

```html
<!-- 3D: Sphere (rendered as circle in iso projection) -->
<v-circle
  v-if="obj.type === 'sphere' && is3D && isVis(obj.id)"
  :key="obj.id + '-3d'"
  :config="sphere3dCfg(obj)"
  @mousedown="onObjDown(obj.id, $event)"
  @dragend="onDrag3DEnd(obj.id, $event, 'iso')"
/>

<!-- 3D: Cube (rendered as polygon in iso projection) -->
<v-line
  v-if="obj.type === 'cube' && is3D && isVis(obj.id)"
  :key="obj.id + '-3d'"
  :config="cube3dCfg(obj)"
  @mousedown="onObjDown(obj.id, $event)"
  @dragend="onDrag3DEnd(obj.id, $event, 'iso')"
/>

<!-- 3D: axes3d (rendered as three lines in iso projection) -->
<v-group
  v-if="obj.type === 'axes3d' && is3D && isVis(obj.id)"
  :key="obj.id + '-3d'"
  :config="{ x: 0, y: 0 }"
  @mousedown="onObjDown(obj.id, $event)"
>
  <v-line v-for="(l, li) in axes3dLines(obj)" :key="'ax3d' + li" :config="l" />
</v-group>

<!-- 3D: Cone/Cylinder/Torus (rendered as ellipse approximation) -->
<v-ellipse
  v-if="['cone', 'cylinder', 'torus'].includes(obj.type) && is3D && isVis(obj.id)"
  :key="obj.id + '-3d'"
  :config="generic3dCfg(obj)"
  @mousedown="onObjDown(obj.id, $event)"
  @dragend="onDrag3DEnd(obj.id, $event, 'iso')"
/>
```

Top-view (sağ panel) için ek shapes ekle — aynı nesnelerin tepeden görünümü:

```html
<!-- 3D Top View: Sphere -->
<v-circle
  v-if="obj.type === 'sphere' && is3D && isVis(obj.id)"
  :key="obj.id + '-3d-top'"
  :config="sphere3dTopCfg(obj)"
  @mousedown="onObjDown(obj.id, $event)"
  @dragend="onDrag3DEnd(obj.id, $event, 'top')"
/>

<!-- 3D Top View: Cube -->
<v-rect
  v-if="obj.type === 'cube' && is3D && isVis(obj.id)"
  :key="obj.id + '-3d-top'"
  :config="cube3dTopCfg(obj)"
  @mousedown="onObjDown(obj.id, $event)"
  @dragend="onDrag3DEnd(obj.id, $event, 'top')"
/>

<!-- 3D Top View: Cone/Cylinder/Torus -->
<v-circle
  v-if="['cone', 'cylinder', 'torus'].includes(obj.type) && is3D && isVis(obj.id)"
  :key="obj.id + '-3d-top'"
  :config="generic3dTopCfg(obj)"
  @mousedown="onObjDown(obj.id, $event)"
  @dragend="onDrag3DEnd(obj.id, $event, 'top')"
/>
```

Divider çizgisi (split viewport ayracı):

```html
<!-- 3D Split Divider -->
<v-line
  v-if="is3D"
  key="split-divider"
  :config="{ points: [splitX, 0, splitX, stageConfig.height], stroke: '#475569', strokeWidth: 2, dash: [6, 3] }"
/>
```

- [ ] **Step 6: StageCanvas.vue — `<script setup>` içine 3D cfg fonksiyonları ekle**

```js
function sphere3dCfg(obj) {
  const p = iso(obj.x3d ?? 0, obj.y3d ?? 0, obj.z3d ?? 0, projCx.value, projCy.value, proj3DScale.value);
  const r = (obj.radius ?? 0.5) * proj3DScale.value;
  const isSelected = store.selectedObjectId === obj.id;
  return {
    x: p.px, y: p.py, radius: r,
    fill: obj.fill ?? '#e67700', opacity: obj.opacity ?? 1,
    stroke: isSelected ? '#60a5fa' : 'transparent', strokeWidth: isSelected ? 2 : 0,
    draggable: true,
  };
}

function cube3dCfg(obj) {
  const s = (obj.sideLength ?? 1.0) * proj3DScale.value;
  const cx = obj.x3d ?? 0, cy = obj.y3d ?? 0, cz = obj.z3d ?? 0;
  // Draw cube as 3 visible faces in iso: top, left, right
  const tl = iso(cx - s/2/proj3DScale.value, cy + s/2/proj3DScale.value, cz - s/2/proj3DScale.value, projCx.value, projCy.value, proj3DScale.value);
  const tr = iso(cx + s/2/proj3DScale.value, cy + s/2/proj3DScale.value, cz - s/2/proj3DScale.value, projCx.value, projCy.value, proj3DScale.value);
  const bl = iso(cx - s/2/proj3DScale.value, cy - s/2/proj3DScale.value, cz - s/2/proj3DScale.value, projCx.value, projCy.value, proj3DScale.value);
  const br = iso(cx + s/2/proj3DScale.value, cy - s/2/proj3DScale.value, cz - s/2/proj3DScale.value, projCx.value, projCy.value, proj3DScale.value);
  const top_f = iso(cx, cy + s/2/proj3DScale.value, cz + s/2/proj3DScale.value, projCx.value, projCy.value, proj3DScale.value);
  const isSelected = store.selectedObjectId === obj.id;
  return {
    points: [tl.px, tl.py, tr.px, tr.py, br.px, br.py, bl.px, bl.py],
    fill: obj.fill ?? '#3b5bdb', closed: true, opacity: obj.opacity ?? 1,
    stroke: isSelected ? '#60a5fa' : (obj.stroke ?? '#ffffff'), strokeWidth: isSelected ? 2 : 1,
    draggable: true,
  };
}

function generic3dCfg(obj) {
  const p = iso(obj.x3d ?? 0, obj.y3d ?? 0, obj.z3d ?? 0, projCx.value, projCy.value, proj3DScale.value);
  const r = (obj.radius ?? obj.majorRadius ?? 0.5) * proj3DScale.value;
  const isSelected = store.selectedObjectId === obj.id;
  return {
    x: p.px, y: p.py,
    radiusX: r, radiusY: r * 0.5,  // ellipse approximation for iso
    fill: obj.fill ?? '#888888', opacity: obj.opacity ?? 1,
    stroke: isSelected ? '#60a5fa' : 'transparent', strokeWidth: isSelected ? 2 : 0,
    draggable: true,
  };
}

function axes3dLines(obj) {
  const origin = iso(obj.x3d ?? 0, obj.y3d ?? 0, obj.z3d ?? 0, projCx.value, projCy.value, proj3DScale.value);
  const axLen = 3 * proj3DScale.value;
  const xEnd = iso((obj.x3d ?? 0) + 3, obj.y3d ?? 0, obj.z3d ?? 0, projCx.value, projCy.value, proj3DScale.value);
  const yEnd = iso(obj.x3d ?? 0, (obj.y3d ?? 0) + 3, obj.z3d ?? 0, projCx.value, projCy.value, proj3DScale.value);
  const zEnd = iso(obj.x3d ?? 0, obj.y3d ?? 0, (obj.z3d ?? 0) + 3, projCx.value, projCy.value, proj3DScale.value);
  return [
    { points: [origin.px, origin.py, xEnd.px, xEnd.py], stroke: '#ff6b6b', strokeWidth: 2 },
    { points: [origin.px, origin.py, yEnd.px, yEnd.py], stroke: '#69db7c', strokeWidth: 2 },
    { points: [origin.px, origin.py, zEnd.px, zEnd.py], stroke: '#74c0fc', strokeWidth: 2 },
  ];
}

// Top view cfg functions
function sphere3dTopCfg(obj) {
  const p = top(obj.x3d ?? 0, obj.z3d ?? 0, projCx2.value, projCy2.value, proj3DScale.value);
  const r = (obj.radius ?? 0.5) * proj3DScale.value;
  const isSelected = store.selectedObjectId === obj.id;
  return {
    x: p.px, y: p.py, radius: r,
    fill: (obj.fill ?? '#e67700') + '80',  // 50% opacity in top view
    stroke: isSelected ? '#60a5fa' : obj.fill ?? '#e67700', strokeWidth: 1.5,
    draggable: true,
  };
}

function cube3dTopCfg(obj) {
  const p = top(obj.x3d ?? 0, obj.z3d ?? 0, projCx2.value, projCy2.value, proj3DScale.value);
  const s = (obj.sideLength ?? 1.0) * proj3DScale.value;
  const isSelected = store.selectedObjectId === obj.id;
  return {
    x: p.px - s / 2, y: p.py - s / 2, width: s, height: s,
    fill: (obj.fill ?? '#3b5bdb') + '80',
    stroke: isSelected ? '#60a5fa' : obj.fill ?? '#3b5bdb', strokeWidth: 1.5,
    draggable: true,
  };
}

function generic3dTopCfg(obj) {
  const p = top(obj.x3d ?? 0, obj.z3d ?? 0, projCx2.value, projCy2.value, proj3DScale.value);
  const r = (obj.radius ?? obj.majorRadius ?? 0.5) * proj3DScale.value;
  const isSelected = store.selectedObjectId === obj.id;
  return {
    x: p.px, y: p.py, radius: r,
    fill: (obj.fill ?? '#888888') + '80',
    stroke: isSelected ? '#60a5fa' : obj.fill ?? '#888888', strokeWidth: 1.5,
    draggable: true,
  };
}
```

- [ ] **Step 7: StageCanvas.vue — `onDrag3DEnd` ekle**

Mevcut `onDragEnd` fonksiyonundan sonra ekle:

```js
function onDrag3DEnd(objId, e, panel) {
  const node = e.target;
  const canvasX = node.x();
  const canvasY = node.y();
  const scale = proj3DScale.value;

  if (panel === 'iso') {
    // İzometrik projeksiyondan x3d/z3d'yi geri hesapla (Y sabit)
    const dx = (canvasX - projCx.value) / scale;
    const dz = (canvasY - projCy.value) / scale;
    // Inverse iso: x3d = (dx/cos30 + dz/sin30) / 2, z3d = ...
    // Basitleştirilmiş: x3d ve z3d simetrik değişir
    const obj = store.objectById(objId);
    const x3d = (dx / cos30 + dz / sin30) / 2;
    const z3d = (dz / sin30 - dx / cos30) / 2;
    store.updateObject(objId, { x3d: parseFloat(x3d.toFixed(3)), z3d: parseFloat(z3d.toFixed(3)) });
  } else {
    // Tepeden: x3d ve z3d doğrudan
    const x3d = (canvasX - projCx2.value) / scale;
    const z3d = (canvasY - projCy2.value) / scale;
    store.updateObject(objId, { x3d: parseFloat(x3d.toFixed(3)), z3d: parseFloat(z3d.toFixed(3)) });
  }
  store.commitState();
  node.position({ x: 0, y: 0 });  // Konva drag'i sıfırla, reactive'e bırak
}
```

- [ ] **Step 8: Tüm testleri çalıştır**

```bash
cd services/web && npm run test:unit && npm test
```

Beklenen: mevcut testler + viewport testleri geçer

- [ ] **Step 9: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue services/web/tests/components/3d-viewport.test.js
git commit -m "feat(canvas): split viewport with iso + top projections for 3D objects (Layer 2)"
```

---

## Task 4: Inspector — Position3DPanel + Scene type toggle

**Files:**
- Create: `services/web/src/components/inspector/Position3DPanel.vue`
- Modify: `services/web/src/components/inspector/Inspector.vue`
- Modify: `services/web/src/components/App.vue` (scene type toggle)

- [ ] **Step 1: Position3DPanel.vue oluştur**

`services/web/src/components/inspector/Position3DPanel.vue`:

```vue
<template>
  <div class="px-4 py-3 border-b border-studio-border">
    <span class="text-xs text-studio-text-muted uppercase tracking-wider">3D Position</span>
    <div class="grid grid-cols-3 gap-2 mt-2">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">X</label>
        <input type="number" :value="element.x3d ?? 0" @input="update('x3d', $event)" step="0.1" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Y</label>
        <input type="number" :value="element.y3d ?? 0" @input="update('y3d', $event)" step="0.1" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Z</label>
        <input type="number" :value="element.z3d ?? 0" @input="update('z3d', $event)" step="0.1" class="input text-sm" />
      </div>
    </div>
    <div class="grid grid-cols-3 gap-2 mt-2">
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot X°</label>
        <input type="number" :value="element.rx ?? 0" @input="update('rx', $event)" step="5" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot Y°</label>
        <input type="number" :value="element.ry ?? 0" @input="update('ry', $event)" step="5" class="input text-sm" />
      </div>
      <div>
        <label class="block text-xs text-studio-text-muted mb-1">Rot Z°</label>
        <input type="number" :value="element.rz ?? 0" @input="update('rz', $event)" step="5" class="input text-sm" />
      </div>
    </div>
    <div class="mt-2" v-if="element.resolution !== undefined">
      <label class="block text-xs text-studio-text-muted mb-1">Resolution</label>
      <input type="number" :value="element.resolution ?? 20" @input="update('resolution', $event)" min="4" max="64" step="4" class="input text-sm w-24" />
    </div>
    <div class="mt-2" v-if="element.type === 'axes3d'">
      <label class="block text-xs text-studio-text-muted mb-1">Axis Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <span>X:</span>
        <input type="number" :value="element.xRange?.[0] ?? -3" @input="updateRange('xRange', 0, $event)" step="1" class="input text-sm w-14" />
        <span>–</span>
        <input type="number" :value="element.xRange?.[1] ?? 3" @input="updateRange('xRange', 1, $event)" step="1" class="input text-sm w-14" />
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({ element: { type: Object, required: true } })
const emit = defineEmits(['update'])

function update(key, e) {
  emit('update', { [key]: parseFloat(e.target.value) || 0 })
}

function updateRange(field, idx, e) {
  const range = [...(props.element[field] ?? [-3, 3, 1])]
  range[idx] = parseFloat(e.target.value) || 0
  emit('update', { [field]: range })
}
</script>
```

- [ ] **Step 2: Inspector.vue içine Position3DPanel ekle**

`Inspector.vue` içindeki `<script setup>` bölümünde import ekle:

```js
import Position3DPanel from './Position3DPanel.vue';
```

`<template>` içinde `LayoutPanel`'den önce koşullu olarak ekle:

```html
<!-- 3D Position Panel — only for 3D objects -->
<Position3DPanel
  v-if="is3DObject"
  :element="selectedElement"
  @update="updateElement"
/>
```

`<script setup>` içine:

```js
import { useProjectStore } from '../../store/project.js';
const store = useProjectStore();
const OBJ_3D_TYPES = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
const is3DObject = computed(() => OBJ_3D_TYPES.includes(selectedElement.value?.type));
```

- [ ] **Step 3: Toolbox / shape palette'e 3D nesne tiplerini ekle**

`services/web/src/components/toolbox/Toolbox.vue` veya shape palette bileşenini bul. `sceneType === '3d'` olduğunda 3D tipleri göster, 3D modda 2D tiplerini gizle:

```js
// Toolbox.vue içinde
const store = useProjectStore();
const shapes3D = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
const shapes2D = ['rectangle', 'circle', ...]; // mevcut liste
const visibleShapes = computed(() =>
  store.project.sceneType === '3d' ? shapes3D : shapes2D
);
```

- [ ] **Step 4: App.vue — scene type toggle (2D/3D switch)**

`App.vue` içinde `Topbar` bileşenine veya stage header'a toggle ekle. `Topbar.vue` içinde (veya doğrudan App.vue'da sahne başlığı yanına):

```html
<button
  v-if="store.project.editorMode === 'visual'"
  @click="store.setSceneType(store.project.sceneType === '2d' ? '3d' : '2d')"
  class="btn btn-sm"
  :class="store.project.sceneType === '3d' ? 'btn-primary' : 'btn-ghost'"
  title="Toggle 2D/3D mode"
>
  {{ store.project.sceneType === '3d' ? '3D' : '2D' }}
</button>
```

- [ ] **Step 5: Tüm testleri çalıştır**

```bash
cd services/web && npm run test:unit && npm test
```

Beklenen: tüm testler geçmeli

- [ ] **Step 6: Commit**

```bash
git add services/web/src/components/inspector/Position3DPanel.vue services/web/src/components/inspector/Inspector.vue
git commit -m "feat(inspector): Position3DPanel for 3D objects + scene type toggle (Layer 2)"
```

---

## Task 5: Layer 3 — Camera phi/theta animate + rotate axis selector

**Files:**
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`
- Modify: `services/web/src/components/inspector/Inspector.vue` (rotate clip axis field)
- Test: `services/web/tests/components/3d-layer3.test.js`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/3d-layer3.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateCode } from '../../src/export/manim.js';

function makeProject3D(cameraTrack = [], objects = []) {
  return {
    name: 'Test3D',
    sceneType: '3d',
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    tracks: [{ id: 't1', clips: [] }],
    cameraType: 'moving',
    cameraTrack,
    camera3d: { phi: 75, theta: -45, zoom: 1.0 },
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
  };
}

describe('camera3d phi/theta in camera_move clip', () => {
  it('generates move_camera with phi and theta', () => {
    const clip = {
      id: 'cm1', type: 'camera_move',
      startTime: 1, duration: 2,
      params: { phi: 60, theta: -60, zoom: 1.0 },
    };
    const project = makeProject3D([clip]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('self.move_camera');
    expect(code).toContain('phi=60');
    expect(code).toContain('theta=-60');
  });
});

describe('rotate clip axis in 3D', () => {
  it('generates Rotate with axis=RIGHT for axis:X', () => {
    const sphere = {
      id: 'sp1', type: 'sphere',
      x3d: 0, y3d: 0, z3d: 0, radius: 0.5, resolution: 20,
      fill: '#e67700', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const clip = {
      id: 'r1', type: 'rotate',
      startTime: 0.5, duration: 1,
      objectId: 'sp1',
      angle: 90, axis: 'X',
      easing: 'linear', parallel: false,
    };
    const project = {
      ...makeProject3D([], [sphere]),
      tracks: [{ id: 't1', clips: [clip] }],
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('Rotate(');
    expect(code).toContain('axis=RIGHT');
    expect(code).toContain('angle=PI/2');
  });

  it('generates Rotate with axis=UP for axis:Y', () => {
    const sphere = {
      id: 'sp1', type: 'sphere',
      x3d: 0, y3d: 0, z3d: 0, radius: 0.5, resolution: 20,
      fill: '#e67700', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const clip = {
      id: 'r2', type: 'rotate',
      startTime: 0.5, duration: 1,
      objectId: 'sp1',
      angle: 90, axis: 'Y',
      easing: 'linear', parallel: false,
    };
    const project = {
      ...makeProject3D([], [sphere]),
      tracks: [{ id: 't1', clips: [clip] }],
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('axis=UP');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-layer3.test.js
```

Beklenen: FAIL

- [ ] **Step 3: codegen.js — camera_move clip'te phi/theta desteği ekle**

`codegen.js` içinde `camera_move` clip tipi işlendiği yeri bul. `params.zoom` ile birlikte `phi` ve `theta` ekle:

```js
// camera_move clip codegen kısmında:
case 'camera_move': {
  const p = clip.params || {};
  if (project.sceneType === '3d') {
    const phi = p.phi ?? project.camera3d?.phi ?? 75;
    const theta = p.theta ?? project.camera3d?.theta ?? -45;
    const zoom = p.zoom ?? 1.0;
    steps.push(`        self.move_camera(phi=${phi} * DEGREES, theta=${theta} * DEGREES, zoom=${zoom.toFixed(2)}${rtOpt(clip.duration)})`);
  } else {
    // mevcut 2D camera_move codegen
    const tx = ((p.targetX || 0) / sw - 0.5) * 14;
    const ty = -((p.targetY || 0) / sh - 0.5) * 8;
    const zoom = p.zoom || 1;
    steps.push(`        self.play(self.camera.frame.animate.move_to([${tx.toFixed(3)}, ${ty.toFixed(3)}, 0]).set_width(${(14 / zoom).toFixed(3)})${rtOpt(clip.duration)})`);
  }
  break;
}
```

- [ ] **Step 4: codegen.js — rotate clip için 3D axis desteği ekle**

`codegen.js` içinde `rotate` clip tipini bul. 3D nesneler için `Rotate` API'sini kullan:

```js
case 'rotate': {
  const obj = oMap[clip.objectId];
  if (!obj) break;
  const n = vn(clip.objectId);
  const angle = clip.angle ?? 90;
  const rad = (angle * Math.PI / 180).toFixed(4);
  const obj3DTypes = ['sphere', 'cube', 'cone', 'cylinder', 'torus', 'axes3d'];
  if (project.sceneType === '3d' && obj3DTypes.includes(obj.type)) {
    const axisMap = { X: 'RIGHT', Y: 'UP', Z: 'OUT' };
    const axis = axisMap[clip.axis ?? 'Z'] ?? 'OUT';
    steps.push(`        self.play(Rotate(${n}, angle=${rad}${rfOpt(clip.easing)}, axis=${axis}${rtOpt(clip.duration)}))`);
  } else {
    // mevcut 2D rotate codegen
    steps.push(`        self.play(${n}.animate.rotate(${rad})${rfOpt(clip.easing)}${rtOpt(clip.duration)})`);
  }
  break;
}
```

- [ ] **Step 5: manim.js — aynı değişiklikleri yap**

`manim.js` içinde `camera_move` ve `rotate` clip tiplerini aynı şekilde güncelle (sadece `vn` → `v` fark).

- [ ] **Step 6: Inspector — rotate clip için axis selector ekle**

`Inspector.vue` içinde clip inspector bölümünde (rotate clip seçiliyken) axis dropdown ekle:

```html
<div v-if="selectedClip?.type === 'rotate' && store.project.sceneType === '3d'" class="mt-2">
  <label class="block text-xs text-studio-text-muted mb-1">Rotation Axis</label>
  <select :value="selectedClip.axis ?? 'Z'" @change="updateClip('axis', $event.target.value)" class="select text-sm">
    <option value="X">X axis (RIGHT)</option>
    <option value="Y">Y axis (UP)</option>
    <option value="Z">Z axis (OUT)</option>
  </select>
</div>
```

- [ ] **Step 7: Testi çalıştır, geçtiğini doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-layer3.test.js
```

Beklenen: PASS

- [ ] **Step 8: Tüm testleri çalıştır**

```bash
cd services/web && npm run test:unit && npm test
```

- [ ] **Step 9: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/3d-layer3.test.js
git commit -m "feat(codegen): 3D camera phi/theta animate + rotate axis selector (Layer 3)"
```

---

## Task 6: Layer 4 — Keyframe x3d/y3d/z3d desteği + Voiceover mixin

**Files:**
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`
- Modify: `services/web/src/engine/keyframe.js`
- Test: `services/web/tests/components/3d-layer4.test.js`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/3d-layer4.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateCode } from '../../src/export/manim.js';

function makeProject3DKeyframe(objects = []) {
  return {
    name: 'Test3DKF',
    sceneType: '3d',
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    tracks: [{ id: 't1', clips: [] }],
    cameraType: 'static',
    cameraTrack: [],
    camera3d: { phi: 75, theta: -45, zoom: 1.0 },
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'animate' },
  };
}

describe('keyframe x3d codegen (animate mode)', () => {
  it('generates animate.move_to for x3d keyframes', () => {
    const sphere = {
      id: 'sp1', type: 'sphere',
      x3d: 0, y3d: 0, z3d: 0, radius: 0.5, resolution: 20,
      fill: '#e67700', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
      keyframes: {
        x3d: [
          { time: 0, value: 0, easing: { type: 'linear' } },
          { time: 2, value: 2, easing: { type: 'linear' } },
        ],
      },
      keyframeMode: { x3d: 'override' },
      keyframeCodegen: { x3d: 'animate' },
    };
    const project = makeProject3DKeyframe([sphere]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('animate');
    expect(code).toContain('move_to');
  });
});

describe('voiceover + ThreeDScene mixin', () => {
  it('uses ThreeDScene + VoiceoverScene when 3D and audio', () => {
    const sphere = {
      id: 'sp1', type: 'sphere',
      x3d: 0, y3d: 0, z3d: 0, radius: 0.5, resolution: 20,
      fill: '#e67700', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const clipWithAudio = {
      id: 'cl1', type: 'move',
      objectId: 'sp1', startTime: 0, duration: 1,
      toX: 960, toY: 540,
      easing: 'linear', parallel: false,
      audio: { type: 'gtts', src: '/data/assets/audio/a1.wav', status: 'ready', duration: 1.0, syncMode: 'auto', lang: 'tr', text: 'merhaba' },
    };
    const project = {
      ...makeProject3DKeyframe([sphere]),
      tracks: [{ id: 't1', clips: [clipWithAudio] }],
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('ThreeDScene, VoiceoverScene');
    expect(code).toContain('from manim_voiceover import VoiceoverScene');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-layer4.test.js
```

- [ ] **Step 3: keyframe.js — `_kfPropSet` içine x3d/y3d/z3d/rx/ry/rz ekle**

`services/web/src/engine/keyframe.js` içinde `_kfPropSet` fonksiyonunu bul. `x3d`, `y3d`, `z3d`, `rx`, `ry`, `rz` property'leri için setter ekle:

```js
// _kfPropSet içinde mevcut x/y/opacity gibi case'lerden sonra:
case 'x3d':  return (obj, val) => { obj.x3d = val; };
case 'y3d':  return (obj, val) => { obj.y3d = val; };
case 'z3d':  return (obj, val) => { obj.z3d = val; };
case 'rx':   return (obj, val) => { obj.rx = val; };
case 'ry':   return (obj, val) => { obj.ry = val; };
case 'rz':   return (obj, val) => { obj.rz = val; };
```

- [ ] **Step 4: codegen.js — `generateKeyframeSteps` içinde x3d/y3d/z3d codegen ekle**

`codegen.js` içinde `generateKeyframeSteps` fonksiyonunu bul. `animate` modunda `x3d/y3d/z3d` için `move_to` kullan:

```js
// generateKeyframeSteps — animate modunda:
// x3d, y3d, z3d → move_to([x3d, y3d, z3d]) zinciri gerektirir
// Her segment için obj'nin x3d/y3d/z3d hedef değerini hesapla
if (['x3d', 'y3d', 'z3d'].includes(prop)) {
  // Bu prop'lar move_to ile birleştirilmeli — şimdilik ayrı işlenebilir
  const targetVal = kf2.value;
  const objN = vn(objId);
  steps.push(`        self.play(${objN}.animate.move_to([${prop === 'x3d' ? targetVal.toFixed(3) : (obj.x3d ?? 0).toFixed(3)}, ${prop === 'y3d' ? targetVal.toFixed(3) : (obj.y3d ?? 0).toFixed(3)}, ${prop === 'z3d' ? targetVal.toFixed(3) : (obj.z3d ?? 0).toFixed(3)}])${rtOpt(duration)})`);
  continue;
}
```

- [ ] **Step 5: manim.js — aynı değişiklikleri yap**

`manim.js` içinde `generateKeyframeSteps` ve `_kfUpdater` fonksiyonlarında x3d/y3d/z3d desteği ekle (codegen.js ile birebir).

- [ ] **Step 6: Testi çalıştır, geçtiğini doğrula**

```bash
cd services/web && npx vitest run tests/components/3d-layer4.test.js
```

Beklenen: PASS

- [ ] **Step 7: Tüm testleri çalıştır**

```bash
cd services/web && npm run test:unit && npm test
```

Beklenen: tüm testler (unit + engine) geçmeli

- [ ] **Step 8: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/src/engine/keyframe.js services/web/tests/components/3d-layer4.test.js
git commit -m "feat: keyframe x3d/y3d/z3d + ThreeDScene+VoiceoverScene mixin (Layer 4)"
```

---

## Self-Review Notu

**Spec kapsamı kontrolü:**

| Spec bölümü | Kapsayan task |
|-------------|---------------|
| sceneType, camera3d | Task 1 |
| 3D nesne tipleri + defaults | Task 1 |
| ThreeDScene codegen | Task 2 |
| 3D objectCode (sphere/cube/...) | Task 2 |
| Split viewport layout | Task 3 |
| iso() + top() projeksiyon | Task 3 |
| Sürükle-bırak (iso + top) | Task 3 |
| Inspector Position3DPanel | Task 4 |
| Scene type toggle | Task 4 |
| camera_move phi/theta | Task 5 |
| rotate axis X/Y/Z | Task 5 |
| Keyframe x3d/y3d/z3d | Task 6 |
| Voiceover + ThreeDScene mixin | Task 6 |

**Bilinen atlananlar (kapsam dışı):**
- `path_move` 3D VMobject — spec'te Katman 4 kapsamında; bu plan şimdilik dışarıda. Sonraki PR olarak eklenebilir.
- `axes3d` range inspector (xRange/yRange/zRange tam edit) — Position3DPanel'de sadece xRange gösteriliyor; yRange/zRange için benzer input eklenebilir (Task 4'e eklenti olarak).
