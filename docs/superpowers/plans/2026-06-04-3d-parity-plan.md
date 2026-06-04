# 3D Tam Parite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3D `path_move` yol animasyonunu (çizim + codegen + playback önizleme) ve `axes3d` için tam aralık (yRange/zRange) editörünü ekleyerek 3D sahne desteğini tamamlamak.

**Architecture:** 3D modda `path_move` klipleri yolu `{x3d,y3d,z3d}` noktalarıyla saklar (nokta şekli `'x3d' in p` ile tespit edilir). Yol tepeden (XZ) panelde Y sabit çizilir. Codegen 3D noktaları doğrudan `MoveAlongPath`'e emit eder; playback saf bir `interpolatePath` yardımcısıyla `overrides.x3d/y3d/z3d` üretir; canvas cfg fonksiyonları yeni `eff3d()` helper'ı ile override'ları okur. `axes3d` codegen zaten yRange/zRange okuyor — yalnızca UI editörü eksik.

**Tech Stack:** Vue 3 + Pinia, Konva.js, Node.js codegen (codegen.js + manim.js), Vitest + Node.js test runner (engine.test.mjs)

---

## Dosya Haritası

| Dosya | Sorumluluk |
|-------|-----------|
| `services/web/src/components/inspector/Position3DPanel.vue` | axes3d yRange/zRange editörü (Task 1) |
| `services/web/src/components/stage/StageCanvas.vue` | Top-panel 3D yol çizimi, `eff3d()` helper, çizilmiş yol görselleştirme (Task 2, 4, 5) |
| `services/api/src/compiler/codegen.js` | 3D `path_move` codegen (server) (Task 3) |
| `services/web/src/export/manim.js` | 3D `path_move` codegen + parser (client) (Task 3) |
| `services/web/src/engine/playback.js` | `interpolatePath()` saf helper + `path_move` 3D dalı (Task 4) |
| `services/web/tests/components/3d-path.test.js` | Codegen + round-trip + axes3d range testleri (Task 1, 3) |
| `services/web/tests/components/Position3DPanel.test.js` | Panel yRange/zRange emit testi (Task 1) |
| `services/web/tests/engine.test.mjs` | `interpolatePath` 3D testi (Task 4) |

**Not:** `store.addPathMoveClip(sourceId, pathPoints)` verilen noktaları `path:` alanına olduğu gibi yazar (şekle agnostik) — değişiklik gerekmez. StageCanvas 3D noktaları üretip aynı action'a geçirir.

---

## Task 1: axes3d Aralık Editörü (yRange / zRange)

**Files:**
- Modify: `services/web/src/components/inspector/Position3DPanel.vue:36-43`
- Test: `services/web/tests/components/Position3DPanel.test.js`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/Position3DPanel.test.js` oluştur:

```js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Position3DPanel from '../../src/components/inspector/Position3DPanel.vue';

const axes3d = {
  type: 'axes3d',
  x3d: 0, y3d: 0, z3d: 0, rx: 0, ry: 0, rz: 0,
  xRange: [-3, 3, 1], yRange: [-3, 3, 1], zRange: [-3, 3, 1],
};

describe('Position3DPanel axes3d ranges', () => {
  it('renders y and z range inputs for axes3d', () => {
    const wrapper = mount(Position3DPanel, { props: { element: axes3d } });
    expect(wrapper.find('[data-testid="yRange-min"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="yRange-max"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zRange-min"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zRange-max"]').exists()).toBe(true);
  });

  it('emits update with new yRange on input', async () => {
    const wrapper = mount(Position3DPanel, { props: { element: axes3d } });
    const input = wrapper.find('[data-testid="yRange-max"]');
    await input.setValue('5');
    const events = wrapper.emitted('update');
    expect(events).toBeTruthy();
    const last = events[events.length - 1][0];
    expect(last.yRange).toEqual([-3, 5, 1]);
  });

  it('emits update with new zRange on input', async () => {
    const wrapper = mount(Position3DPanel, { props: { element: axes3d } });
    const input = wrapper.find('[data-testid="zRange-min"]');
    await input.setValue('-5');
    const events = wrapper.emitted('update');
    const last = events[events.length - 1][0];
    expect(last.zRange).toEqual([-5, 3, 1]);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd services/web && npx vitest run tests/components/Position3DPanel.test.js`
Expected: FAIL — `[data-testid="yRange-min"]` bulunamaz

- [ ] **Step 3: Position3DPanel.vue'ya yRange/zRange blokları ekle**

`services/web/src/components/inspector/Position3DPanel.vue` içinde mevcut X Range bloğunu (satır 36-43) şununla değiştir — `data-testid` öznitelikleri eklenir ve Y/Z aralıkları da gösterilir:

```html
    <div class="mt-2" v-if="element.type === 'axes3d'">
      <label class="block text-xs text-studio-text-muted mb-1">X Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input type="number" data-testid="xRange-min" :value="element.xRange?.[0] ?? -3" @input="updateRange('xRange', 0, $event)" step="1" class="input text-sm w-16" />
        <span>–</span>
        <input type="number" data-testid="xRange-max" :value="element.xRange?.[1] ?? 3" @input="updateRange('xRange', 1, $event)" step="1" class="input text-sm w-16" />
      </div>
      <label class="block text-xs text-studio-text-muted mb-1 mt-2">Y Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input type="number" data-testid="yRange-min" :value="element.yRange?.[0] ?? -3" @input="updateRange('yRange', 0, $event)" step="1" class="input text-sm w-16" />
        <span>–</span>
        <input type="number" data-testid="yRange-max" :value="element.yRange?.[1] ?? 3" @input="updateRange('yRange', 1, $event)" step="1" class="input text-sm w-16" />
      </div>
      <label class="block text-xs text-studio-text-muted mb-1 mt-2">Z Range</label>
      <div class="flex gap-1 items-center text-xs text-studio-text-muted">
        <input type="number" data-testid="zRange-min" :value="element.zRange?.[0] ?? -3" @input="updateRange('zRange', 0, $event)" step="1" class="input text-sm w-16" />
        <span>–</span>
        <input type="number" data-testid="zRange-max" :value="element.zRange?.[1] ?? 3" @input="updateRange('zRange', 1, $event)" step="1" class="input text-sm w-16" />
      </div>
    </div>
```

`updateRange(field, idx, e)` fonksiyonu (satır 55-59) zaten `field` parametreli ve `[-3, 3, 1]` varsayılanını kullanıyor — değişiklik gerekmez.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `cd services/web && npx vitest run tests/components/Position3DPanel.test.js`
Expected: PASS — 3 test geçer

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/inspector/Position3DPanel.vue services/web/tests/components/Position3DPanel.test.js
git commit -m "feat(inspector): axes3d yRange/zRange editors in Position3DPanel"
```

---

## Task 2: 3D Yol Çizimi (StageCanvas — top panel, Y sabit)

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue:333-339` (pathCanvasPoints)
- Modify: `services/web/src/components/stage/StageCanvas.vue:737-748` (handleStageMouseDown path branch)

Bu task'ın testi manuel doğrulamayla yapılır (Konva drag/click otomasyonu kırılgan); kod-doğruluk Task 3 (codegen) ve Task 4 (playback) testleriyle dolaylı kapsanır.

- [ ] **Step 1: handleStageMouseDown path-draw dalını 3D-farkında yap**

`StageCanvas.vue` satır 737-748'deki blok şu an:

```js
function handleStageMouseDown(e) {
  if (pathDrawing.value) {
    const now = Date.now();
    if (now - _pathLastClick < 350) return; // absorb second mousedown of dblclick
    _pathLastClick = now;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const sp = c2s(pos.x, pos.y);
    pathPoints.value.push({ x: Math.round(sp.x), y: Math.round(sp.y) });
    return;
  }
```

Bu bloğun içindeki `const sp = c2s(...)` satırından `return;`'e kadarki kısmı şununla değiştir:

```js
    const sp = c2s(pos.x, pos.y);
    if (is3D.value) {
      // 3D modda yalnızca top/XZ (sağ) panelde çizim kabul edilir
      if (sp.x < splitX.value) return;
      const x3d = parseFloat(((sp.x - projCx2.value) / proj3DScale.value).toFixed(3));
      const z3d = parseFloat(((sp.y - projCy2.value) / proj3DScale.value).toFixed(3));
      const srcObj = store.objectById(pathSourceId.value);
      const y3d = srcObj?.y3d ?? 0;   // Y sabit: nesnenin mevcut y3d değeri
      pathPoints.value.push({ x3d, y3d, z3d });
    } else {
      pathPoints.value.push({ x: Math.round(sp.x), y: Math.round(sp.y) });
    }
    return;
```

`is3D`, `splitX`, `projCx2`, `projCy2`, `proj3DScale` computed'ları ve `c2s`, `store.objectById` bu bileşende zaten tanımlı.

- [ ] **Step 2: pathCanvasPoints computed'ını 3D noktaları çizecek şekilde güncelle**

`StageCanvas.vue` satır 333-339'daki `pathCanvasPoints` computed'ını şununla değiştir:

```js
const pathCanvasPoints = computed(() => {
  if (!pathPoints.value.length) return [];
  return pathPoints.value.map(p => {
    if ('x3d' in p) {
      const t = top(p.x3d, p.z3d, projCx2.value, projCy2.value, proj3DScale.value);
      const cp = s2c(t.px, t.py);
      return { cx: cp.x, cy: cp.y };
    }
    const cp = s2c(p.x, p.y);
    return { cx: cp.x, cy: cp.y };
  });
});
```

`top()` projeksiyon fonksiyonu ve `s2c` zaten tanımlı. (`pathPreviewLineCfg` bu computed'a dayanır — değişiklik gerekmez.)

- [ ] **Step 3: Build'in kırılmadığını doğrula**

Run: `cd services/web && npm run build`
Expected: Hatasız tamamlanır (Vue 3 prod build template/key kuralları dahil)

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): draw 3D path_move points in top panel (Y fixed)"
```

---

## Task 3: 3D path_move Codegen + Parser

**Files:**
- Modify: `services/api/src/compiler/codegen.js` (path_move blokları + yeni helper)
- Modify: `services/web/src/export/manim.js` (path_move bloğu + helper + parser)
- Test: `services/web/tests/components/3d-path.test.js`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/3d-path.test.js` oluştur:

```js
import { describe, it, expect } from 'vitest';
import { generateCode, parseManimScript } from '../../src/export/manim.js';

function makeProject3D(objects, tracks) {
  return {
    name: 'Test3DPath',
    sceneType: '3d',
    stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
    objects,
    tracks,
    cameraType: 'static',
    cameraTrack: [],
    camera3d: { phi: 75, theta: -45, zoom: 1.0 },
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
  };
}

const sphere = {
  id: 'sp1', type: 'sphere',
  x3d: 0, y3d: 1, z3d: 0, radius: 0.5, resolution: 20,
  fill: '#e67700', opacity: 1,
  enterTime: 0, exitTime: 5,
  anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
};

const pathClip = {
  id: 'clip_p1', type: 'path_move', sourceId: 'sp1',
  startTime: 0, duration: 2, easing: 'linear', parallel: false, lag_ratio: 0,
  path: [
    { x3d: 0, y3d: 1, z3d: 0 },
    { x3d: 2, y3d: 1, z3d: 3 },
    { x3d: -1, y3d: 1, z3d: -2 },
  ],
};

describe('3D path_move codegen', () => {
  it('emits 3D coordinates directly (z != 0, no stageToManim)', () => {
    const project = makeProject3D([sphere], [{ id: 't1', clips: [pathClip] }]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('set_points_as_corners');
    expect(code).toContain('MoveAlongPath');
    expect(code).toContain('[2.000, 1.000, 3.000]');
    expect(code).toContain('[-1.000, 1.000, -2.000]');
  });
});

describe('3D path_move round-trip', () => {
  it('parser reconstructs 3D path points from generated code', () => {
    const project = makeProject3D([sphere], [{ id: 't1', clips: [pathClip] }]);
    const code = generateCode(project, '/data/assets');
    const parsed = parseManimScript(code);
    expect(parsed.sceneType).toBe('3d');
    const clip = parsed.tracks[0].clips.find(c => c.type === 'path_move');
    expect(clip).toBeTruthy();
    expect(clip.path[1]).toMatchObject({ x3d: 2, y3d: 1, z3d: 3 });
    expect(clip.path[2]).toMatchObject({ x3d: -1, y3d: 1, z3d: -2 });
  });
});

describe('2D path_move regression', () => {
  it('2D path still emits z=0 and parses to {x,y}', () => {
    const obj2d = {
      id: 'r1', type: 'rectangle', x: 960, y: 540, width: 100, height: 100,
      fill: '#ffffff', opacity: 1, rotation: 0,
      enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'fade_out',
    };
    const clip2d = {
      id: 'clip_q1', type: 'path_move', sourceId: 'r1',
      startTime: 0, duration: 2, easing: 'linear', parallel: false, lag_ratio: 0,
      path: [{ x: 480, y: 540 }, { x: 1440, y: 540 }],
    };
    const project = {
      name: 'T2D', sceneType: '2d',
      stage: { width: 1920, height: 1080, backgroundColor: '#000000' },
      objects: [obj2d], tracks: [{ id: 't1', clips: [clip2d] }],
      cameraType: 'static', cameraTrack: [],
      keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
    };
    const code = generateCode(project, '/data/assets');
    expect(code).toContain(', 0]');
    const parsed = parseManimScript(code);
    const clip = parsed.tracks[0].clips.find(c => c.type === 'path_move');
    expect(clip.path[0]).toHaveProperty('x');
    expect(clip.path[0]).not.toHaveProperty('x3d');
  });
});

describe('axes3d range codegen (regression guard for editor)', () => {
  it('emits custom y_range and z_range', () => {
    const ax = {
      id: 'ax1', type: 'axes3d', x3d: 0, y3d: 0, z3d: 0,
      xRange: [-3, 3, 1], yRange: [-5, 5, 1], zRange: [-2, 2, 1],
      fill: '#ffffff', opacity: 1,
      enterTime: 0, exitTime: 5,
      anim: { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } },
    };
    const project = makeProject3D([ax], [{ id: 't1', clips: [] }]);
    const code = generateCode(project, '/data/assets');
    expect(code).toContain('y_range=[-5, 5, 1]');
    expect(code).toContain('z_range=[-2, 2, 1]');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd services/web && npx vitest run tests/components/3d-path.test.js`
Expected: FAIL — 3D path z=0 emit ediliyor; parser `sceneType`/3D path döndürmüyor

- [ ] **Step 3: manim.js — `pathPointsPy()` helper ekle**

`services/web/src/export/manim.js` içinde `stageToManim` fonksiyonu tanımının (satır ~152 civarı, `manimToStage` ile birlikte) hemen ardına module-seviyesi helper ekle:

```js
// path_move noktalarını Python koordinat string'ine çevirir.
// 3D nokta (x3d alanı varsa) doğrudan Manim biriminde emit edilir; aksi halde 2D piksel → Manim.
function pathPointsPy(path, sw, sh) {
  const is3dPath = path[0] && 'x3d' in path[0];
  return path.map(p => {
    if (is3dPath) {
      return `[${(p.x3d ?? 0).toFixed(3)}, ${(p.y3d ?? 0).toFixed(3)}, ${(p.z3d ?? 0).toFixed(3)}]`;
    }
    const m = stageToManim(p.x, p.y, sw, sh);
    return `[${m.x.toFixed(3)}, ${m.y.toFixed(3)}, 0]`;
  }).join(', ');
}
```

- [ ] **Step 4: manim.js — path_move codegen bloğunu helper'a bağla**

`manim.js` satır 719-733'teki `case 'path_move':` bloğunda, `const pts = c.path.map(...)` ile `.join(', ')` mantığını helper çağrısıyla değiştir. Blok şu hale gelir:

```js
      case 'path_move': {
        if (!c.path || c.path.length < 2) return null;
        const cn = (c.id || sn).replace(/[^a-zA-Z0-9_]/g, '_');
        const pn = `path_${cn}`;
        const ptsStr = pathPointsPy(c.path, sw, sh);
        const multiLine = [
          `${pn} = VMobject()`,
          `${pn}.set_points_as_corners([np.array(p) for p in [${ptsStr}]])`,
          `self.play(MoveAlongPath(${sn}, ${pn})${rtStr}${rfStr})`,
        ].join(`\n${indent}`);
        return { code: multiLine, dur };
      }
```

- [ ] **Step 5: manim.js — parser: ThreeDScene tespiti ekle**

`manim.js` satır 934'teki `let cameraType = 'static';`'in hemen altına ekle:

```js
  let sceneType = '2d';
```

Satır 989-991'deki MovingCameraScene tespitinin hemen altına ekle:

```js
    // ThreeDScene → 3D sahne
    m = line.match(/^class\s+\w+\(ThreeDScene/);
    if (m) { sceneType = '3d'; continue; }
```

- [ ] **Step 6: manim.js — parser: set_points_as_corners 3 koordinat yakala**

`manim.js` satır 1384-1392'deki blok şu an z'yi `0` sabit eşliyor. Şununla değiştir:

```js
    // set_points_as_corners — parse Manim coordinate list into pending path
    m = line.match(/^(\w+)\.set_points_as_corners\(\[np\.array\(p\) for p in \[(.+)\]\]\)/);
    if (m) {
      const [, pathVar, pointsStr] = m;
      if (pendingPaths[pathVar] !== undefined) {
        const pointMatches = [...pointsStr.matchAll(/\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/g)];
        pendingPaths[pathVar] = pointMatches.map(pm => ({
          mx: parseFloat(pm[1]),
          my: parseFloat(pm[2]),
          mz: parseFloat(pm[3]),
        }));
      }
      continue;
    }
```

- [ ] **Step 7: manim.js — parser: MoveAlongPath'te sceneType'a göre path kur**

`manim.js` satır 1406-1409'daki `const path = pathPoints.map(...)` bloğunu şununla değiştir:

```js
        const path = pathPoints.map(p => {
          if (sceneType === '3d') {
            return { x3d: p.mx, y3d: p.my, z3d: p.mz };
          }
          const sp = manimToStage(p.mx, p.my, sw, sh);
          return { x: Math.round(sp.x), y: Math.round(sp.y) };
        });
```

- [ ] **Step 8: manim.js — parser return objesine sceneType ekle**

`manim.js` satır 1423-1429'daki `return { ... }` objesine `sceneType` ekle:

```js
  return {
    objects,
    tracks: clips.length > 0 ? [{ id: 'track_parsed', name: 'Track 1', clips }] : [],
    stage: { backgroundColor: bgColor, width: sw, height: sh },
    sceneType,
    cameraType,
    cameraTrack,
  };
```

- [ ] **Step 9: codegen.js — aynı `pathPointsPy()` helper'ı ekle**

`services/api/src/compiler/codegen.js` içinde `stageToManim` tanımının hemen ardına, manim.js Step 3 ile **birebir aynı** `pathPointsPy` fonksiyonunu ekle:

```js
function pathPointsPy(path, sw, sh) {
  const is3dPath = path[0] && 'x3d' in path[0];
  return path.map(p => {
    if (is3dPath) {
      return `[${(p.x3d ?? 0).toFixed(3)}, ${(p.y3d ?? 0).toFixed(3)}, ${(p.z3d ?? 0).toFixed(3)}]`;
    }
    const m = stageToManim(p.x, p.y, sw, sh);
    return `[${m.x.toFixed(3)}, ${m.y.toFixed(3)}, 0]`;
  }).join(', ');
}
```

- [ ] **Step 10: codegen.js — iki path_move bloğunu helper'a bağla**

`codegen.js` satır 745-760 ve 810-825'teki **iki** `case 'path_move':` bloğunda, `const pts = c.path.map(...)` + `const ptsStr = pts.join(', ');` satır çiftini tek satırla değiştir (her iki blokta da):

```js
          const ptsStr = pathPointsPy(c.path, sw, sh);
```

Her iki bloğun geri kalanı (VMobject / set_points_as_corners / MoveAlongPath) aynı kalır.

- [ ] **Step 11: Testi çalıştır, geçtiğini doğrula**

Run: `cd services/web && npx vitest run tests/components/3d-path.test.js`
Expected: PASS — codegen, round-trip, 2D regression, axes3d range testleri geçer

- [ ] **Step 12: Tüm web testlerini çalıştır**

Run: `cd services/web && npm run test:unit && npm test`
Expected: mevcut tüm testler + yeni testler geçer, regresyon yok

- [ ] **Step 13: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/3d-path.test.js
git commit -m "feat(codegen): 3D path_move codegen + parser (sceneType-aware)"
```

---

## Task 4: Playback 3D Path İnterpolasyonu + Canvas Önizleme

**Files:**
- Modify: `services/web/src/engine/playback.js:479-515` (path_move case + yeni export helper)
- Modify: `services/web/src/components/stage/StageCanvas.vue` (eff3d helper + 3D cfg fonksiyonları)
- Test: `services/web/tests/engine.test.mjs`

- [ ] **Step 1: Failing test yaz (engine)**

`services/web/tests/engine.test.mjs` dosyasının sonuna (mevcut son `import` satırından sonra uygun yere) ekle:

```js
import { interpolatePath } from '../src/engine/playback.js';

{
  // 3D path interpolation — midpoint of a single straight segment
  const path3d = [
    { x3d: 0, y3d: 0, z3d: 0 },
    { x3d: 2, y3d: 0, z3d: 4 },
  ];
  const mid = interpolatePath(path3d, 0.5);
  assert.ok('x3d' in mid, 'returns 3D point for 3D path');
  assert.ok(Math.abs(mid.x3d - 1) < 1e-6, 'x3d midpoint = 1');
  assert.ok(Math.abs(mid.z3d - 2) < 1e-6, 'z3d midpoint = 2');

  // start and end
  const start = interpolatePath(path3d, 0);
  assert.ok(Math.abs(start.x3d - 0) < 1e-6 && Math.abs(start.z3d - 0) < 1e-6, '3D path start');
  const end = interpolatePath(path3d, 1);
  assert.ok(Math.abs(end.x3d - 2) < 1e-6 && Math.abs(end.z3d - 4) < 1e-6, '3D path end');

  // 2D path still returns {x, y}
  const path2d = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  const mid2d = interpolatePath(path2d, 0.5);
  assert.ok('x' in mid2d && !('x3d' in mid2d), 'returns 2D point for 2D path');
  assert.ok(Math.abs(mid2d.x - 5) < 1e-6, 'x midpoint = 5');

  console.log('  ✓ interpolatePath 2D + 3D');
}
```

(Not: `assert` ve test çalıştırma deseni dosyada zaten mevcut — aynı stili izle.)

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd services/web && npm test`
Expected: FAIL — `interpolatePath is not a function` (export yok)

- [ ] **Step 3: playback.js — `interpolatePath()` saf helper'ı ekle ve export et**

`services/web/src/engine/playback.js` içinde, dosyanın `import` satırlarından sonra (sınıf tanımından önce uygun bir module seviyesinde) ekle. `lerp` zaten import edilmiş ve kullanımda:

```js
// path_move için yay-uzunluğuna göre interpolasyon. 3D nokta (x3d alanı) ya da
// 2D nokta ({x,y}) kabul eder; aynı şekildeki noktayı döndürür.
export function interpolatePath(path, t) {
  const is3d = !!(path[0] && 'x3d' in path[0]);
  const clampedT = Math.max(0, Math.min(1, t));
  const segLens = [];
  let totalLen = 0;
  for (let k = 1; k < path.length; k++) {
    let len;
    if (is3d) {
      const dx = path[k].x3d - path[k - 1].x3d;
      const dy = path[k].y3d - path[k - 1].y3d;
      const dz = path[k].z3d - path[k - 1].z3d;
      len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    } else {
      const dx = path[k].x - path[k - 1].x;
      const dy = path[k].y - path[k - 1].y;
      len = Math.sqrt(dx * dx + dy * dy);
    }
    segLens.push(len);
    totalLen += len;
  }
  const at = (i) => (is3d
    ? { x3d: path[i].x3d, y3d: path[i].y3d, z3d: path[i].z3d }
    : { x: path[i].x, y: path[i].y });
  if (totalLen === 0) return at(0);
  const target = clampedT * totalLen;
  let cumLen = 0;
  for (let k = 0; k < segLens.length; k++) {
    if (cumLen + segLens[k] >= target) {
      const t2 = segLens[k] === 0 ? 0 : (target - cumLen) / segLens[k];
      if (is3d) {
        return {
          x3d: lerp(path[k].x3d, path[k + 1].x3d, t2),
          y3d: lerp(path[k].y3d, path[k + 1].y3d, t2),
          z3d: lerp(path[k].z3d, path[k + 1].z3d, t2),
        };
      }
      return { x: lerp(path[k].x, path[k + 1].x, t2), y: lerp(path[k].y, path[k + 1].y, t2) };
    }
    cumLen += segLens[k];
  }
  return at(path.length - 1);
}
```

- [ ] **Step 4: playback.js — path_move case'ini helper'a indir**

`playback.js` satır 479-515'teki `case 'path_move':` bloğunun tamamını şununla değiştir:

```js
      case 'path_move': {
        if (!clip.path || clip.path.length < 2) break;
        const pos = interpolatePath(clip.path, easedT);
        Object.assign(overrides, pos);  // 2D: {x,y} · 3D: {x3d,y3d,z3d}
        break;
      }
```

- [ ] **Step 5: Testi çalıştır, geçtiğini doğrula**

Run: `cd services/web && npm test`
Expected: PASS — `interpolatePath 2D + 3D` geçer, mevcut engine testleri korunur

- [ ] **Step 6: StageCanvas.vue — `eff3d()` helper ekle**

`StageCanvas.vue` `<script setup>` içinde, `frameState` computed'ının (satır ~253) hemen altına ekle:

```js
// 3D nesnenin geçerli (override dahil) konumu — playback path_move/move override'larını yansıtır
function eff3d(obj) {
  const ov = frameState.value.objectOverrides[obj.id] || {};
  return {
    x3d: ov.x3d ?? obj.x3d ?? 0,
    y3d: ov.y3d ?? obj.y3d ?? 0,
    z3d: ov.z3d ?? obj.z3d ?? 0,
  };
}
```

- [ ] **Step 7: StageCanvas.vue — 3D cfg fonksiyonlarını eff3d'ye geçir**

Aşağıdaki fonksiyonlarda `obj.x3d ?? 0`, `obj.y3d ?? 0`, `obj.z3d ?? 0` doğrudan okumalarını `eff3d(obj)` üzerinden yap. Her fonksiyonun başına `const e3 = eff3d(obj);` ekle ve ilgili `iso(...)` / `top(...)` çağrılarındaki `obj.x3d ?? 0` → `e3.x3d`, `obj.y3d ?? 0` → `e3.y3d`, `obj.z3d ?? 0` → `e3.z3d` olarak değiştir.

`sphere3dCfg` (satır ~957):
```js
function sphere3dCfg(obj) {
  const e3 = eff3d(obj);
  const p = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  // ... fonksiyonun geri kalanı aynı
```

`cube3dCfg` (satır ~971): başına `const e3 = eff3d(obj);` ekle, ardından
```js
  const cx = e3.x3d, cy = e3.y3d, cz = e3.z3d;
```
(satır 972'deki `const cx = obj.x3d ?? 0, cy = obj.y3d ?? 0, cz = obj.z3d ?? 0;` yerine)

`generic3dCfg` (satır ~986):
```js
function generic3dCfg(obj) {
  const e3 = eff3d(obj);
  const p = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  // ... aynı
```

`axes3dLines` (satır ~999): `const e3 = eff3d(obj);` ekle, dört `iso(...)` çağrısındaki `obj.x3d ?? 0`/`obj.y3d ?? 0`/`obj.z3d ?? 0` ifadelerini `e3.x3d`/`e3.y3d`/`e3.z3d` (ve `+3` ofsetli olanları `e3.x3d + 3` vb.) ile değiştir:
```js
  const origin = iso(e3.x3d, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const xEnd = iso(e3.x3d + 3, e3.y3d, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const yEnd = iso(e3.x3d, e3.y3d + 3, e3.z3d, projCx.value, projCy.value, proj3DScale.value);
  const zEnd = iso(e3.x3d, e3.y3d, e3.z3d + 3, projCx.value, projCy.value, proj3DScale.value);
```

`sphere3dTopCfg`, `cube3dTopCfg`, `generic3dTopCfg` (satır ~1011, ~1023, ~1035): her birinin başına `const e3 = eff3d(obj);` ekle, `top(obj.x3d ?? 0, obj.z3d ?? 0, ...)` → `top(e3.x3d, e3.z3d, ...)` yap.

- [ ] **Step 8: Build + tüm testleri çalıştır**

Run: `cd services/web && npm run build && npm run test:unit && npm test`
Expected: Build hatasız; tüm testler geçer

- [ ] **Step 9: Commit**

```bash
git add services/web/src/engine/playback.js services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(playback): 3D path_move interpolation + canvas override preview"
```

---

## Task 5: Çizilmiş Yolun Her İki Panelde Görselleştirilmesi

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue` (committed 3D path polylines)

Commit edilmiş `path_move` kliplerinin 3D yolu, hem iso hem top panelde salt-görsel polyline olarak çizilir (kullanıcı yolu perspektifte de görür). Manuel doğrulama; codegen/playback Task 3-4'te test edilir.

- [ ] **Step 1: `path3dPolylines` computed ekle**

`StageCanvas.vue` `<script setup>` içinde, `eff3d` helper'ından sonra ekle:

```js
// Commit edilmiş 3D path_move yollarını iso + top panelde polyline olarak çiz
const path3dPolylines = computed(() => {
  if (!is3D.value) return [];
  const out = [];
  for (const track of store.project.tracks || []) {
    for (const clip of track.clips || []) {
      if (clip.type !== 'path_move' || !Array.isArray(clip.path)) continue;
      if (!(clip.path[0] && 'x3d' in clip.path[0])) continue;
      const isoPts = [];
      const topPts = [];
      for (const pt of clip.path) {
        const i = iso(pt.x3d, pt.y3d ?? 0, pt.z3d, projCx.value, projCy.value, proj3DScale.value);
        isoPts.push(i.px, i.py);
        const t = top(pt.x3d, pt.z3d, projCx2.value, projCy2.value, proj3DScale.value);
        topPts.push(t.px, t.py);
      }
      const base = { stroke: '#a855f7', strokeWidth: 1.5, dash: [4, 4], listening: false, opacity: 0.7 };
      out.push({ ...base, points: isoPts, id: clip.id + '-isopath' });
      out.push({ ...base, points: topPts, id: clip.id + '-toppath' });
    }
  }
  return out;
});
```

- [ ] **Step 2: Template'e polyline çizimini ekle**

`StageCanvas.vue` `<template>` içinde, 3D split divider'ın (`<!-- 3D Split Divider -->` bloğu) hemen üstüne ekle:

```html
<!-- 3D committed path polylines (iso + top) -->
<template v-for="pl in path3dPolylines" :key="pl.id">
  <v-line :config="pl" />
</template>
```

(Vue 3 prod build kuralı: `key` `<template>` etiketinde, child `<v-line>`'da değil.)

- [ ] **Step 3: Build'i doğrula**

Run: `cd services/web && npm run build`
Expected: Hatasız tamamlanır

- [ ] **Step 4: Tüm testleri çalıştır**

Run: `cd services/web && npm run test:unit && npm test`
Expected: Regresyon yok

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): visualize committed 3D paths in iso + top panels"
```

---

## Self-Review Notu

**Spec kapsamı kontrolü:**

| Spec bölümü | Kapsayan task |
|-------------|---------------|
| Veri modeli (3D nokta, `'x3d' in p`) | Task 2 (üretim) + Task 3/4 (tüketim) |
| Tepeden çizim, Y sabit | Task 2 |
| pathCanvasPoints 3D dalı | Task 2 |
| Playback `overrides.x3d/y3d/z3d` | Task 4 |
| `eff3d()` helper + cfg fonksiyonları | Task 4 |
| Codegen 3D `MoveAlongPath` | Task 3 |
| Parser 3D path + ThreeDScene/sceneType | Task 3 |
| `axes3d` yRange/zRange editörü | Task 1 |
| Güvenlik (whitelist değişmez) | Değişiklik yok — sayısal alanlar |
| İzometrik path önizleme (commit) | Task 5 |
| Test stratejisi (codegen + round-trip + engine) | Task 1, 3, 4 |

**Tip tutarlılığı:** 3D nokta her yerde `{ x3d, y3d, z3d }`; tespit her yerde `'x3d' in p`/`'x3d' in path[0]`. Helper adı `pathPointsPy` (codegen.js + manim.js birebir). Engine helper `interpolatePath` (export + import tutarlı). `eff3d` dönüş alanları `{x3d,y3d,z3d}`.

**Bilinen sınır:** Y sabit (kullanıcı kararı); izometrik projeksiyon `phi=75°` varsayımı korunur.
