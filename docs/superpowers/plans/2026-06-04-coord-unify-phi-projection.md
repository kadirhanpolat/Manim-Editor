# Koordinat Birleştirme + phi-Duyarlı 3D Önizleme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `codegen.js` ve `manim.js`'i tek `FRAME_WIDTH=14.222` koordinat ölçeğinde birleştir; sabit 30° izometrik 3D önizlemeyi `camera3d.phi/theta`-duyarlı küresel-kamera projeksiyonuyla (ortografik/perspektif, Ayarlar'dan, önizleme-only) değiştir.

**Architecture:** Part A iki Python üreticisindeki hardcoded `14`/`7` sabitlerini paylaşılan `FRAME_WIDTH`/`FRAME_X_RADIUS` ile değiştiren mekanik bir refactor. Part B yeni saf bir `engine/projection3d.js` modülü (test edilebilir) ekler; `StageCanvas.vue` `iso()`'su buna delege eder, `playback.js` 3D `camera_move` için phi/theta/zoom lerp'ler, yeni `Scene3DPanel.vue` projeksiyon modunu seçtirir.

**Tech Stack:** Vue 3 (`<script setup>`), Pinia, Konva.js, Vitest (`npm run test:unit`), Node engine tests (`npm test`), Node.js/Express codegen.

**Spec:** `docs/superpowers/specs/2026-06-04-coord-unify-phi-projection-design.md`

**Test komutları (tüm görevlerde):**
- Unit (Vitest): `cd services/web && npm run test:unit`
- Engine (Node): `cd services/web && npm test`
- Her commit öncesi İKİSİ de geçmeli.

**Önemli kısıt:** Sunucu `codegen.js` Vitest'te import EDİLEMEZ (bkz. `tests/components/parallel-clips.test.js` notu). Bu yüzden `codegen.js` değişiklikleri otomatik test yerine `manim.js` ile **birebir senkron** tutularak ve grep ile doğrulanarak güvence altına alınır. `manim.js` değişiklikleri TDD ile test edilir.

---

## File Structure

| Dosya | Sorumluluk | Değişiklik |
|---|---|---|
| `services/api/src/compiler/codegen.js` | Sunucu Python üreteci | `FRAME_WIDTH` sabitleri + `14`→`FRAME_WIDTH`, `7`→`FRAME_X_RADIUS` |
| `services/web/src/export/manim.js` | İstemci Python üreteci/parser | `_kfPropSet`/kamera/parser `14`→`FRAME_WIDTH` |
| `services/web/src/engine/projection3d.js` | **YENİ** — saf 3D→2D projeksiyon + ters-dönüş | yeni dosya |
| `services/web/src/components/stage/StageCanvas.vue` | Konva canvas + 3D paneller | `iso()` delege, `cam3d` computed, 2D kamera computed'ları guard, drag ters-dönüş |
| `services/web/src/engine/playback.js` | rAF playback engine | 3D `cameraState` lerp + `setCamera3dBase` |
| `services/web/src/store/project.js` | Pinia store | `camera3d.projection`/`focalDistance` varsayılanları |
| `services/web/src/components/inspector/Scene3DPanel.vue` | **YENİ** — sahne-düzeyi 3D ayarları | yeni dosya |
| `services/web/src/components/inspector/Inspector.vue` | Inspector kök | `Scene3DPanel` mount (no-selection + 3d) |
| `services/web/src/App.vue` | Kök | `camera3d` watcher → `setCamera3dBase` |
| `services/web/tests/components/projection3d.test.js` | **YENİ** — projeksiyon birim testleri | yeni dosya |
| `services/web/tests/components/playback-camera3d.test.js` | **YENİ** — 3D kamera lerp testi | yeni dosya |
| `services/web/tests/components/manim-export.test.js` | Mevcut — `7.000`→`7.111` güncelle | düzenle |

---

## Task 1: codegen.js — FRAME_WIDTH birleştirmesi (sunucu)

**Files:**
- Modify: `services/api/src/compiler/codegen.js`

> codegen.js Vitest'te import edilemez; doğrulama grep + manuel. manim.js (Task 2) ile birebir aynı sabitleri kullanır.

- [ ] **Step 1: Sabit bloğunu ekle**

`services/api/src/compiler/codegen.js` içinde `function stageToManim` (L81) tanımının HEMEN ÜSTÜNE ekle:

```js
// Manim frame dimensions (matches Manim CE default)
const FRAME_WIDTH = 14 + 2 / 9;          // 14.222
const FRAME_HEIGHT = 8;
const FRAME_X_RADIUS = FRAME_WIDTH / 2;  // 7.111
```

- [ ] **Step 2: `stageToManim`'i güncelle (L82)**

```js
function stageToManim(x, y, sw, sh) {
  return { x: ((x / sw) - 0.5) * FRAME_WIDTH, y: -((y / sh) - 0.5) * FRAME_HEIGHT };
}
```

- [ ] **Step 3: Şekil genişliklerini güncelle**

Aşağıdaki satırlardaki `* 14`'ü `* FRAME_WIDTH` yap (yükseklikteki `* 8` DEĞİŞMEZ):
- Rectangle (L198): `(obj.width / sw * FRAME_WIDTH).toFixed(3)`
- Ellipse (L219): `(obj.width / sw * FRAME_WIDTH).toFixed(3)`
- Line (L252): her iki `(obj.width / 2 / sw * FRAME_WIDTH).toFixed(3)`
- Arrow halfLen (L256): `(obj.width / 2 / sw * FRAME_WIDTH).toFixed(3)`
- Arrow tipLen (L257): `(FRAME_X_RADIUS / sw * FRAME_WIDTH).toFixed(3)`  ← `7` → `FRAME_X_RADIUS`
- Image (L283): `(obj.width / sw * FRAME_WIDTH).toFixed(3)`
- SVG (L290): `(obj.width / sw * FRAME_WIDTH).toFixed(3)`
- Axes x_length (L302): `(obj.width / sw * FRAME_WIDTH).toFixed(1)`
- NumberPlane x_length (L319): `(obj.width / sw * FRAME_WIDTH).toFixed(1)`
- NumberLine length (L324): `(obj.width / sw * FRAME_WIDTH).toFixed(1)`

- [ ] **Step 4: `_kfPropSet` (L339) güncelle**

```js
function _kfPropSet(n, prop, value, sw, sh) {
  const MANIM_W = FRAME_WIDTH, MANIM_H = FRAME_HEIGHT;
```
(`MANIM_H = 8` zaten doğru; `FRAME_HEIGHT` ile değiştirmek tutarlılık için iyi ama davranışı değiştirmez.)

- [ ] **Step 5: Kamera `sceneWidth` (L911) güncelle**

```js
const sceneWidth = FRAME_WIDTH;
```

- [ ] **Step 6: Kalan koordinat-`14` kalmadığını doğrula**

Run: `cd services/api && grep -nE "[^.0-9]14\b|[^.0-9]7 / sw|MANIM_W = 14" src/compiler/codegen.js`
Expected: Koordinat dönüşümünde `14`/`7` literali KALMAMALI. (Easing süreleri, `toFixed(14)` vb. alakasız `14`'ler yoksa boş çıktı; varsa elle teyit et — yalnızca koordinat olanlar değişti.)

- [ ] **Step 7: Commit**

```bash
cd "D:\PYTHON\Manim-Editor"
git add services/api/src/compiler/codegen.js
git commit -m "fix(codegen): unify on FRAME_WIDTH=14.222 (Manim CE default)"
```

---

## Task 2: manim.js — FRAME_WIDTH birleştirmesi + keyframe-x invariant testi (istemci)

**Files:**
- Test: `services/web/tests/components/manim-export.test.js` (yeni test ekle + 2 beklenti güncelle)
- Modify: `services/web/src/export/manim.js`

`manim.js`'in `FRAME_WIDTH`/`FRAME_X_RADIUS` sabitleri zaten var (L79-81) ve şekiller doğru kullanıyor. Yalnızca 3 tutarsız nokta düzeltilir.

- [ ] **Step 1: Failing test yaz — keyframe-x, static-x ile aynı ölçeğe düşer**

`services/web/tests/components/manim-export.test.js` dosyasının SONUNA ekle:

```js
import { describe as _d } from 'vitest'; // (zaten import edilmişse bu satırı ekleme)

describe('FRAME_WIDTH unification', () => {
  const FRAME_WIDTH = 14 + 2 / 9;
  // sw=1920, x=1440px → (1440/1920 - 0.5) * 14.222 = 0.25 * 14.222 = 3.5556
  it('keyframe set_x uses the same scale as static x (14.222)', () => {
    const px = 1440, sw = 1920;
    const expectedMx = (((px / sw) - 0.5) * FRAME_WIDTH).toFixed(4); // "3.5556"
    const project = {
      name: 'kf', sceneDuration: 2,
      stage: { width: sw, height: 1080, backgroundColor: '#000' },
      objects: [{
        id: 'o1', type: 'circle', name: 'c', x: 960, y: 540, width: 100, height: 100,
        fill: '#fff', stroke: 'transparent', opacity: 1, rotation: 0,
        enterTime: 0, duration: 2, enterAnim: 'fade_in', exitAnim: 'fade_out', zOrder: 0,
        keyframes: { x: [
          { time: 0.0, value: 960, easing: { type: 'linear' } },
          { time: 1.0, value: px,  easing: { type: 'linear' } },
        ] },
        keyframeCodegen: { x: 'animate' },
      }],
      tracks: [], assets: [], cameraTrack: [],
    };
    const script = generateManimScript(project);
    expect(script).toContain(`set_x(${expectedMx})`);
  });

  it('camera set_width uses FRAME_WIDTH (zoom=2 -> 7.111)', () => {
    const project = {
      name: 'cam', sceneDuration: 2, cameraType: 'moving',
      stage: { width: 1920, height: 1080, backgroundColor: '#000' },
      objects: [], tracks: [], assets: [],
      cameraTrack: [{ id: 'cm', type: 'camera_move', startTime: 0, duration: 1,
        easing: 'linear', params: { targetX: 0, targetY: 0, zoom: 2 } }],
    };
    const script = generateManimScript(project);
    expect(script).toContain('.set_width(7.111)');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd services/web && npm run test:unit -- manim-export`
Expected: FAIL — `set_x(3.5000)` (eski `14` ölçeği) ve `set_width(7.000)` üretiliyor.

- [ ] **Step 3: `_kfPropSet` (L336) düzelt**

```js
function _kfPropSet(n, prop, value, sw, sh) {
  const MANIM_W = FRAME_WIDTH, MANIM_H = FRAME_HEIGHT;
```

- [ ] **Step 4: Kamera `set_width` üretimi (L826) düzelt**

```js
const frameWidth = (FRAME_WIDTH / zoom).toFixed(3);
```

- [ ] **Step 5: Parser zoom (L1456) düzelt**

```js
const zoom = parseFloat((FRAME_WIDTH / parseFloat(fw)).toFixed(4));
```

- [ ] **Step 6: Mevcut `7.000` beklentilerini güncelle**

`manim-export.test.js` içinde:
- L171: `expect(script).toContain('7.000'); // 14 / 2` → `expect(script).toContain('7.111'); // 14.222 / 2`
- L328: beklenen çıktı satırındaki `.set_width(7.000)` → `.set_width(7.111)`
- L333: `params.zoom).toBeCloseTo(2)` DEĞİŞMEZ (14.222/7.111 ≈ 2.0).

- [ ] **Step 7: Yeni + mevcut testlerin geçtiğini doğrula**

Run: `cd services/web && npm run test:unit`
Expected: PASS (tüm unit testler). Başka bir test `14`-ölçeğine bağlıysa (set_x/set_width numeric) onu da yeni değere göre güncelle — değeri `((px/sw)-0.5)*14.222` formülüyle yeniden hesapla.

- [ ] **Step 8: Engine testleri regresyon kontrolü**

Run: `cd services/web && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd "D:\PYTHON\Manim-Editor"
git add services/web/src/export/manim.js services/web/tests/components/manim-export.test.js
git commit -m "fix(manim.js): unify keyframe-x/camera on FRAME_WIDTH=14.222"
```

---

## Task 3: projection3d.js — saf projeksiyon modülü (YENİ)

**Files:**
- Create: `services/web/src/engine/projection3d.js`
- Test: `services/web/tests/components/projection3d.test.js`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/projection3d.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { project3D, unprojectIso } from '../../src/engine/projection3d.js';

describe('project3D', () => {
  const cx = 100, cy = 100, scale = 10;

  it('phi=0, theta=-90 -> classic XY (X right, Y up)', () => {
    const p = project3D({ x3d: 2, y3d: 3, z3d: 5 },
      { phi: 0, theta: -90, zoom: 1, mode: 'orthographic' }, cx, cy, scale);
    // screen_x = Px = 2, screen_y = Py = 3 ; canvas py grows down
    expect(p.px).toBeCloseTo(cx + 2 * scale, 3);
    expect(p.py).toBeCloseTo(cy - 3 * scale, 3);
  });

  it('phi=90 -> world Z maps to screen up', () => {
    // theta=-90: r=(1,0,0), u=(0,0,1) ; screen_x=Px, screen_y=Pz
    const p = project3D({ x3d: 1, y3d: 9, z3d: 4 },
      { phi: 90, theta: -90, zoom: 1, mode: 'orthographic' }, cx, cy, scale);
    expect(p.px).toBeCloseTo(cx + 1 * scale, 3);
    expect(p.py).toBeCloseTo(cy - 4 * scale, 3);
  });

  it('perspective magnifies points nearer the camera (f>1)', () => {
    const cam = { phi: 60, theta: -45, zoom: 1, mode: 'perspective', focalDistance: 8 };
    const ortho = { ...cam, mode: 'orthographic' };
    // a point along +n (toward camera) has d>0 -> f>1 -> larger |offset|
    const near = project3D({ x3d: 1, y3d: 0, z3d: 0 }, cam, cx, cy, scale);
    const nearO = project3D({ x3d: 1, y3d: 0, z3d: 0 }, ortho, cx, cy, scale);
    const distP = Math.hypot(near.px - cx, near.py - cy);
    const distO = Math.hypot(nearO.px - cx, nearO.py - cy);
    expect(distP).toBeGreaterThan(distO);
  });
});

describe('unprojectIso (orthographic, y fixed)', () => {
  it('round-trips x3d/z3d with y held constant', () => {
    const cam = { phi: 65, theta: -40, zoom: 1, mode: 'orthographic' };
    const cx = 100, cy = 100, scale = 10, yKnown = 1.5;
    const orig = { x3d: 2.3, y3d: yKnown, z3d: -1.7 };
    const scr = project3D(orig, cam, cx, cy, scale);
    const back = unprojectIso(scr.px, scr.py, cam, cx, cy, scale, yKnown);
    expect(back.x3d).toBeCloseTo(orig.x3d, 3);
    expect(back.z3d).toBeCloseTo(orig.z3d, 3);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd services/web && npm run test:unit -- projection3d`
Expected: FAIL — modül yok.

- [ ] **Step 3: Modülü yaz**

`services/web/src/engine/projection3d.js`:

```js
// Manim Z-up spherical-camera projection (preview-only).
// phi  = polar angle from +Z (deg), theta = azimuth in XY (deg).
// n=(sφcθ, sφsθ, cφ) view dir; r=(-sθ, cθ, 0) screen-right; u=n×r=(-cφcθ, -cφsθ, sφ) screen-up.

const DEG = Math.PI / 180;

function basis(phi, theta) {
  const ph = phi * DEG, th = theta * DEG;
  return {
    sp: Math.sin(ph), cp: Math.cos(ph),
    st: Math.sin(th), ct: Math.cos(th),
  };
}

/**
 * Project a 3D point to canvas pixels.
 * @param {{x3d?:number,y3d?:number,z3d?:number}} p
 * @param {{phi?:number,theta?:number,zoom?:number,mode?:string,focalDistance?:number}} cam
 * @returns {{px:number, py:number}}
 */
export function project3D(p, cam, cx, cy, scale) {
  const { phi = 75, theta = -45, zoom = 1, mode = 'orthographic', focalDistance = 8 } = cam || {};
  const { sp, cp, st, ct } = basis(phi, theta);
  const x = p.x3d ?? 0, y = p.y3d ?? 0, z = p.z3d ?? 0;
  let sx = -x * st + y * ct;
  let sy = -cp * (x * ct + y * st) + z * sp;
  if (mode === 'perspective') {
    const d = x * sp * ct + y * sp * st + z * cp; // P·n
    const denom = focalDistance - d;
    const f = denom > 1e-6 ? focalDistance / denom : 1e6;
    sx *= f; sy *= f;
  }
  const s = scale * zoom;
  return { px: cx + sx * s, py: cy - sy * s };
}

/**
 * Inverse of project3D for iso drag, holding y3d fixed. Orthographic only.
 * Returns { x3d, z3d }; either may be null when ill-conditioned (st≈0 or sp≈0).
 */
export function unprojectIso(px, py, cam, cx, cy, scale, yKnown) {
  const { phi = 75, theta = -45, zoom = 1 } = cam || {};
  const { sp, cp, st, ct } = basis(phi, theta);
  const s = scale * zoom;
  const sx = (px - cx) / s;
  const sy = (cy - py) / s;
  // sx = -st*x + ct*y  -> x = (ct*y - sx)/st
  const x3d = Math.abs(st) > 1e-6 ? (ct * yKnown - sx) / st : null;
  // sy = -cp*(x*ct + y*st) + z*sp -> z = (sy + cp*(x*ct + y*st))/sp
  let z3d = null;
  if (Math.abs(sp) > 1e-6 && x3d !== null) {
    z3d = (sy + cp * (x3d * ct + yKnown * st)) / sp;
  }
  return { x3d, z3d };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd services/web && npm run test:unit -- projection3d`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
cd "D:\PYTHON\Manim-Editor"
git add services/web/src/engine/projection3d.js services/web/tests/components/projection3d.test.js
git commit -m "feat(engine): pure 3D spherical-camera projection module"
```

---

## Task 4: store — camera3d.projection / focalDistance varsayılanları

**Files:**
- Test: `services/web/tests/components/3d-store.test.js` (yeni test ekle)
- Modify: `services/web/src/store/project.js:64`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/3d-store.test.js` dosyasının uygun `describe` bloğuna ekle (dosya başında store setup pattern'i mevcut):

```js
it('new project has 3D projection defaults', () => {
  expect(store.project.camera3d.projection).toBe('orthographic');
  expect(store.project.camera3d.focalDistance).toBe(8);
});

it('setCamera3d updates projection mode', () => {
  store.setCamera3d({ projection: 'perspective', focalDistance: 5 });
  expect(store.project.camera3d.projection).toBe('perspective');
  expect(store.project.camera3d.focalDistance).toBe(5);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd services/web && npm run test:unit -- 3d-store`
Expected: FAIL — `projection` undefined.

- [ ] **Step 3: Varsayılanları ekle (L64)**

```js
camera3d: {
  phi: 75,
  theta: -45,
  zoom: 1.0,
  projection: 'orthographic',  // 'orthographic' | 'perspective' — preview-only
  focalDistance: 8,
},
```

`setCamera3d` (L1157) zaten `Object.assign` — değişmez.

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd services/web && npm run test:unit -- 3d-store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\PYTHON\Manim-Editor"
git add services/web/src/store/project.js services/web/tests/components/3d-store.test.js
git commit -m "feat(store): camera3d.projection + focalDistance defaults"
```

---

## Task 5: playback.js — 3D camera_move lerp + setCamera3dBase

**Files:**
- Test: `services/web/tests/components/playback-camera3d.test.js`
- Modify: `services/web/src/engine/playback.js`

3D `camera_move` klipleri `params: { phi, theta, zoom }` taşır (2D ise `targetX/targetY`). 3D tespiti: `'phi' in camClip.params`. İlk klibin "from" tabanı `this._camera3dBase` (varsayılan `{phi:75, theta:-45, zoom:1}`).

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/playback-camera3d.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { PlaybackEngine } from '../../src/engine/playback.js';
// Doğrulandı: playback.js `export class PlaybackEngine` (named export).

describe('3D camera_move lerp', () => {
  it('interpolates phi/theta/zoom from base and flags is3d', () => {
    const eng = new PlaybackEngine();
    eng.setCamera3dBase({ phi: 75, theta: -45, zoom: 1 });
    const cameraTrack = [{
      id: 'cm', type: 'camera_move', startTime: 0, duration: 2, easing: 'linear',
      params: { phi: 45, theta: -90, zoom: 2 },
    }];
    const frame = eng.computeFrame(1.0, [], [], cameraTrack); // t=1 of 2 => alpha 0.5
    expect(frame.cameraState.is3d).toBe(true);
    expect(frame.cameraState.phi).toBeCloseTo((75 + 45) / 2, 3);   // 60
    expect(frame.cameraState.theta).toBeCloseTo((-45 + -90) / 2, 3); // -67.5
    expect(frame.cameraState.zoom).toBeCloseTo((1 + 2) / 2, 3);     // 1.5
  });

  it('2D camera_move still produces {x,y,zoom} without is3d', () => {
    const eng = new PlaybackEngine();
    const cameraTrack = [{
      id: 'cm', type: 'camera_move', startTime: 0, duration: 2, easing: 'linear',
      params: { targetX: 100, targetY: 200, zoom: 2 },
    }];
    const frame = eng.computeFrame(1.0, [], [], cameraTrack);
    expect(frame.cameraState.is3d).toBeFalsy();
    expect(frame.cameraState.x).toBeCloseTo(50, 3);  // from 0 -> 100, alpha .5
    expect(frame.cameraState.y).toBeCloseTo(100, 3);
  });
});
```

> Adım 1 öncesi: `playback.js`'in oluşturucu/exportunu Read ile teyit et (`export class ...` veya `export default`). Test importunu ona göre düzelt. `new PlaybackEngine()` ile çağrılabildiğini ve `computeFrame` boş `tracks=[]`/`objects=[]` ile çalıştığını doğrula (L227 guard `!tracks||!objects` → `[]` truthy, sorun yok).

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd services/web && npm run test:unit -- playback-camera3d`
Expected: FAIL — `setCamera3dBase` yok / `is3d` undefined.

- [ ] **Step 3: `setCamera3dBase` setter + base alanı ekle**

`setKeyframeDefaults` (L111-113 civarı) yanına ekle:

```js
setCamera3dBase(base) {
  this._camera3dBase = base || { phi: 75, theta: -45, zoom: 1 };
}
```

Oluşturucuda (constructor) veya ilk kullanımda fallback için: `computeFrame` içinde `const base = this._camera3dBase || { phi: 75, theta: -45, zoom: 1 };`

- [ ] **Step 4: 3D camera lerp dalını ekle (L256-275)**

Mevcut kamera döngüsündeki `frame.cameraState = {...}` (L268-272) bloğunu, klip tipine göre dallanacak şekilde değiştir:

```js
frame.cameraState = null;
if (cameraTrack && cameraTrack.length > 0) {
  const base = this._camera3dBase || { phi: 75, theta: -45, zoom: 1 };
  const sortedCam = [...cameraTrack].sort((a, b) => a.startTime - b.startTime);
  for (let ci = 0; ci < sortedCam.length; ci++) {
    const camClip = sortedCam[ci];
    if (!isClipActive(camClip, time)) continue;
    const progress = getClipProgress(camClip, time);
    const easedT = evaluateEasing(progress, camClip.easing || 'ease_in_out', 0, 1);
    const prev = ci > 0 ? sortedCam[ci - 1].params : null;
    const is3d = camClip.params && 'phi' in camClip.params;
    if (is3d) {
      const fromPhi   = prev?.phi   ?? base.phi;
      const fromTheta = prev?.theta ?? base.theta;
      const fromZoom  = prev?.zoom  ?? base.zoom;
      frame.cameraState = {
        phi:   lerp(fromPhi,   camClip.params.phi   ?? base.phi,   easedT),
        theta: lerp(fromTheta, camClip.params.theta ?? base.theta, easedT),
        zoom:  lerp(fromZoom,  camClip.params.zoom  ?? 1,          easedT),
        is3d: true,
      };
    } else {
      const fromX = prev?.targetX || 0;
      const fromY = prev?.targetY || 0;
      const fromZoom = prev?.zoom || 1;
      frame.cameraState = {
        x: lerp(fromX, camClip.params?.targetX || 0, easedT),
        y: lerp(fromY, camClip.params?.targetY || 0, easedT),
        zoom: lerp(fromZoom, camClip.params?.zoom || 1, easedT),
      };
    }
    break;
  }
}
```

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Run: `cd services/web && npm run test:unit -- playback-camera3d`
Expected: PASS (2 test).

- [ ] **Step 6: Tüm unit + engine regresyon**

Run: `cd services/web && npm run test:unit && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd "D:\PYTHON\Manim-Editor"
git add services/web/src/engine/playback.js services/web/tests/components/playback-camera3d.test.js
git commit -m "feat(playback): 3D camera_move phi/theta/zoom lerp + setCamera3dBase"
```

---

## Task 6: App.vue — camera3d watcher → setCamera3dBase

**Files:**
- Modify: `services/web/src/App.vue:388` (mevcut keyframeDefaults watcher'ın yanına)

> Bu görevde otomatik test yok (App.vue kök bileşeni, mevcut watcher deseni test edilmiyor). Doğrulama: build + manuel.

- [ ] **Step 1: camera3d watcher ekle**

`services/web/src/App.vue` içinde mevcut watcher (L388-389):
```js
() => store.project.keyframeDefaults,
(defaults) => { getPlaybackEngine().setKeyframeDefaults(defaults); },
```
Hemen ardına yeni bir `watch` ekle (aynı dosyadaki `watch` import'u mevcut; `{ deep: true, immediate: true }` kullan):

```js
watch(
  () => store.project.camera3d,
  (cam) => { getPlaybackEngine().setCamera3dBase(cam); },
  { deep: true, immediate: true }
);
```

> Mevcut watcher'ın tam sözdizimini (tek `watch` mi, `watchEffect` mi, immediate var mı) Read ile teyit edip aynı kalıba uydur.

- [ ] **Step 2: Build doğrula**

Run: `cd services/web && npm run build`
Expected: Başarılı build (hata yok).

- [ ] **Step 3: Unit + engine regresyon**

Run: `cd services/web && npm run test:unit && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd "D:\PYTHON\Manim-Editor"
git add services/web/src/App.vue
git commit -m "feat(app): feed camera3d base into playback engine"
```

---

## Task 7: StageCanvas.vue — iso() delege + cam3d + 2D kamera guard + drag ters-dönüş

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue`

> Bu görevde Konva render birim testi yok (mevcut StageCanvas testleri viewport hesabını test ediyor, render'ı değil). Doğrulama: build + manuel render (Task 9). `iso()` mantığı zaten Task 3'te test edildi.

- [ ] **Step 1: projection3d import et**

`StageCanvas.vue` `<script setup>` import bloğuna ekle:

```js
import { project3D, unprojectIso } from '../../engine/projection3d.js';
```

- [ ] **Step 2: cam3d computed ekle**

`is3D` computed'ının (L281) yakınına ekle:

```js
const cam3d = computed(() => {
  const cs = store.frameState.cameraState;
  const base = store.project?.camera3d ?? {};
  if (cs && cs.is3d) {
    return { phi: cs.phi, theta: cs.theta, zoom: cs.zoom,
             mode: base.projection ?? 'orthographic', focalDistance: base.focalDistance ?? 8 };
  }
  return { phi: base.phi ?? 75, theta: base.theta ?? -45, zoom: base.zoom ?? 1,
           mode: base.projection ?? 'orthographic', focalDistance: base.focalDistance ?? 8 };
});
```

- [ ] **Step 3: `iso()` yeniden yaz (L214-218) + cos30/sin30 kaldır**

```js
function iso(x3d, y3d, z3d, cx, cy, scale) {
  return project3D({ x3d, y3d, z3d }, cam3d.value, cx, cy, scale);
}
```
`const cos30 = ...` ve `const sin30 = ...` (L211-212) satırlarını SİL (artık `iso` kullanmıyor; `top()` zaten kullanmıyor). `onDrag3DEnd` içinde cos30/sin30 kullanımı Step 5'te kaldırılacak.

> `top()` (L220-222) DEĞİŞMEZ.

- [ ] **Step 4: 2D kamera computed'larını 3D cameraState'e karşı guard et (L261-277)**

`vs`/`ox`/`oy` `cs.zoom`/`cs.x`/`cs.y` okuyor; 3D cameraState'te bunlar yok (NaN riski). 3D durumda 2D kamera dönüşümü uygulanmamalı:

```js
const vs = computed(() => {
  const sx = containerWidth.value / stg.value.width;
  const sy = containerHeight.value / stg.value.height;
  const base = Math.min(sx, sy, 1) * 0.92 * zoomLevel.value;
  const cs = store.frameState.cameraState;
  return (cs && !cs.is3d && cs.zoom) ? base * cs.zoom : base;
});
const ox = computed(() => {
  const cs = store.frameState.cameraState;
  const camX = (cs && !cs.is3d) ? cs.x : stg.value.width / 2;
  return containerWidth.value / 2 - camX * vs.value + panOffset.value.x;
});
const oy = computed(() => {
  const cs = store.frameState.cameraState;
  const camY = (cs && !cs.is3d) ? cs.y : stg.value.height / 2;
  return containerHeight.value / 2 - camY * vs.value + panOffset.value.y;
});
```

- [ ] **Step 5: iso drag ters-dönüşünü güncelle (onDrag3DEnd, L868-873)**

```js
if (panel === 'iso') {
  const r = unprojectIso(canvasX, canvasY, cam3d.value, projCx.value, projCy.value, scale,
                         (store.objectById(objId)?.y3d ?? 0));
  const patch = {};
  if (r.x3d !== null) patch.x3d = parseFloat(r.x3d.toFixed(3));
  if (r.z3d !== null) patch.z3d = parseFloat(r.z3d.toFixed(3));
  store.updateObject(objId, patch);
} else {
```
(`else` dalı / top panel L874-877 DEĞİŞMEZ.)

> `store.objectById` factory getter — fonksiyon olarak çağrılır. Mevcut dosyada obje erişimi nasılsa (örn. `store.project.objects.find`) ona uydur; `onTransform`'da L884 `store.project.objects.find(...)` kullanılmış — tutarlılık için aynısını kullan: `(store.project.objects.find(o => o.id === objId)?.y3d ?? 0)`.

- [ ] **Step 6: Build doğrula**

Run: `cd services/web && npm run build`
Expected: Başarılı (cos30/sin30 referansı kalmadığını da doğrular — kalsa `defined but never used` lint değil ama referans hatası olmaz; emin olmak için grep).

Run: `cd services/web && grep -n "cos30\|sin30" src/components/stage/StageCanvas.vue`
Expected: Boş çıktı.

- [ ] **Step 7: Unit + engine regresyon**

Run: `cd services/web && npm run test:unit && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd "D:\PYTHON\Manim-Editor"
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "feat(canvas): phi/theta-aware iso projection + drag inverse; guard 2D camera"
```

---

## Task 8: Scene3DPanel.vue — projeksiyon modu UI (YENİ)

**Files:**
- Create: `services/web/src/components/inspector/Scene3DPanel.vue`
- Modify: `services/web/src/components/inspector/Inspector.vue`
- Test: `services/web/tests/components/Scene3DPanel.test.js`

- [ ] **Step 1: Failing test yaz**

`services/web/tests/components/Scene3DPanel.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../../src/store/project.js';
import Scene3DPanel from '../../src/components/inspector/Scene3DPanel.vue';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.setSceneType('3d');
  store.commitState();
});

describe('Scene3DPanel', () => {
  it('changing projection select updates store', async () => {
    const wrapper = mount(Scene3DPanel, { global: { plugins: [] } });
    const select = wrapper.get('[data-testid="projection-mode"]');
    await select.setValue('perspective');
    expect(store.project.camera3d.projection).toBe('perspective');
  });

  it('focal distance input visible only in perspective mode', async () => {
    store.setCamera3d({ projection: 'orthographic' });
    const wrapper = mount(Scene3DPanel);
    expect(wrapper.find('[data-testid="focal-distance"]').exists()).toBe(false);
    store.setCamera3d({ projection: 'perspective' });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="focal-distance"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd services/web && npm run test:unit -- Scene3DPanel`
Expected: FAIL — bileşen yok.

- [ ] **Step 3: Bileşeni yaz**

`services/web/src/components/inspector/Scene3DPanel.vue`:

```vue
<template>
  <div class="px-4 py-3 border-b border-studio-border">
    <span class="text-xs text-studio-text-muted uppercase tracking-wider">3D Camera Preview</span>
    <div class="mt-2">
      <label class="block text-xs text-studio-text-muted mb-1">Projection</label>
      <select
        data-testid="projection-mode"
        :value="cam.projection ?? 'orthographic'"
        @change="store.setCamera3d({ projection: $event.target.value })"
        class="input text-sm w-full"
      >
        <option value="orthographic">Orthographic</option>
        <option value="perspective">Perspective</option>
      </select>
      <p class="text-[10px] text-studio-text-muted/60 mt-1">Preview only — does not affect render output.</p>
    </div>
    <div class="mt-2" v-if="(cam.projection ?? 'orthographic') === 'perspective'">
      <label class="block text-xs text-studio-text-muted mb-1">Focal Distance</label>
      <input
        type="number"
        data-testid="focal-distance"
        :value="cam.focalDistance ?? 8"
        @input="store.setCamera3d({ focalDistance: parseFloat($event.target.value) || 8 })"
        min="2" step="1" class="input text-sm w-24"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
const store = useProjectStore();
const cam = computed(() => store.project.camera3d ?? {});
</script>
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd services/web && npm run test:unit -- Scene3DPanel`
Expected: PASS.

- [ ] **Step 5: Inspector'a mount et**

`services/web/src/components/inspector/Inspector.vue`:
- `<script setup>` import bloğuna: `import Scene3DPanel from './Scene3DPanel.vue';`
- No-selection dalına (L5'teki `v-if="!selectedElement"` placeholder div'inin İÇİNE veya hemen ardına, aynı `v-if="!selectedElement"` koşulunda) sahne 3D panelini ekle:

```vue
<Scene3DPanel v-if="!selectedElement && store.project.sceneType === '3d'" />
```
Yerleşim: L5-11 arasındaki no-selection bloğunda, "Add Element Buttons" (L107) bölümünden önce uygun bir konuma. `store` zaten Inspector'da kullanımda (L148 `store.updateObject`).

- [ ] **Step 6: Build + tüm testler**

Run: `cd services/web && npm run build && npm run test:unit && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd "D:\PYTHON\Manim-Editor"
git add services/web/src/components/inspector/Scene3DPanel.vue services/web/src/components/inspector/Inspector.vue services/web/tests/components/Scene3DPanel.test.js
git commit -m "feat(inspector): Scene3DPanel projection mode selector (preview-only)"
```

---

## Task 9: Manuel doğrulama render'ı (kod yok)

**Files:** yok — manuel doğrulama + bulgu kaydı.

> Projeksiyon konvansiyonu (Z-up, açı işaretleri) yalnızca birim testle değil, gerçek render karşılaştırmasıyla kesinleşir.

- [ ] **Step 1: 3D test sahnesi hazırla**

`docker compose up --build` ile editörü aç; yeni 3D proje; birkaç nesne yerleştir: bir `sphere` (x3d=2, y3d=0, z3d=0), bir `cube` (x3d=0, y3d=2, z3d=0), bir `axes3d`. Belirgin asimetrik konumlar seç (eksen karışıklığını yakalamak için).

- [ ] **Step 2: Açıları değiştir + karşılaştır**

`camera3d` açılarını (şu an UI yok → bir `camera_move` 3D klibi ekleyerek veya proje JSON'ını düzenleyerek) 3 ayar için test et: (a) phi=60, theta=-30; (b) phi=45, theta=0; (c) phi=90, theta=-90.
Her ayar için: canvas iso önizlemesini, sunucu render çıktısıyla (Tools > Render HQ) veya `File > Export .py` → yerel `manim -qh scene.py MainScene` ile karşılaştır.

- [ ] **Step 3: Eşleşmeyi değerlendir**

Nesnelerin göreli konumları/ekran yönelimi render ile önizlemede tutarlı olmalı. Eşleşmezse `projection3d.js`'te açı işareti / eksen ataması düzelt (örn. `theta` işareti, `u` vektörü), `projection3d.test.js` sabit-nokta beklentilerini gerçek Manim davranışına göre güncelle, Task 3'ten itibaren testleri tekrar çalıştır.

- [ ] **Step 4: Perspektif modu göz kontrolü**

Inspector sahne panelinden Perspective seç; iso panelde foreshortening (yakın nesneler büyür) görülmeli. focalDistance düşürünce etki artmalı.

- [ ] **Step 5: Bulguyu kaydet**

Doğrulama sonucunu (eşleşti / düzeltildi) spec'in Bölüm 5'ine kısa bir not olarak ekle veya commit mesajında belirt. Düzeltme yaptıysan commit'le.

---

## Final Doğrulama

- [ ] `cd services/web && npm run test:unit` → tüm unit testler PASS
- [ ] `cd services/web && npm test` → tüm engine testler PASS
- [ ] `cd services/web && npm run build` → temiz build
- [ ] `grep -n "cos30\|sin30" services/web/src/components/stage/StageCanvas.vue` → boş
- [ ] codegen.js + manim.js koordinat matematiğinde stray `14`/`7` kalmadı (Task 1 Step 6 + Task 2)
- [ ] Manuel render: iso önizleme ≈ render (Task 9)
