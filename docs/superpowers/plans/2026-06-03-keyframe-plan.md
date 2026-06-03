# Keyframe Animasyon Sistemi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her nesneye absolute-zamanlı per-property keyframe katmanı ekle; Timeline'da lane UI, Bezier popup, Inspector paneli ve Manim codegen ile birlikte tam çalışır hale getir.

**Architecture:** Nesne objesine `keyframes`, `keyframeMode`, `keyframeCodegen` alanları eklenir. `engine/keyframe.js` interpolasyon mantığını yönetir. `PlaybackEngine._applyKeyframeOverrides()` her frame'de klip sonuçlarına keyframe değerlerini uygular. Codegen her iki dosyada da (server + client) senkron güncellenir.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest, Node.js ESM test runner, Konva.js (canvas — bu planda dokunulmaz)

---

## Dosya Haritası

| Dosya | İşlem |
|-------|-------|
| `services/web/src/engine/keyframe.js` | Yeni — `interpolateKeyframes`, `getKeyframeRange`, Bezier solver |
| `services/web/tests/engine.test.mjs` | Güncelle — keyframe engine testleri eklenir (sonuna) |
| `services/web/src/store/project.js` | Güncelle — `keyframeDefaults`, `selectedKeyframeId`, 7 yeni action |
| `services/web/tests/components/keyframe-store.test.js` | Yeni — store action testleri |
| `services/web/src/engine/playback.js` | Güncelle — `setKeyframeDefaults()`, `_applyKeyframeOverrides()` |
| `services/api/src/compiler/codegen.js` | Güncelle — keyframe codegen (3 mod) |
| `services/web/src/export/manim.js` | Güncelle — codegen.js ile senkron |
| `services/web/tests/components/keyframe-codegen.test.js` | Yeni — codegen snapshot testleri |
| `services/web/src/components/timeline/KeyframeLane.vue` | Yeni — tek property keyframe şeridi |
| `services/web/src/components/timeline/KeyframeEasingPopup.vue` | Yeni — segment Bezier editörü popup |
| `services/web/src/components/timeline/KeyframeLanesPanel.vue` | Yeni — seçili klibe ait tüm lane'ler |
| `services/web/src/components/timeline/Timeline.vue` | Güncelle — `KeyframeLanesPanel` eklenir |
| `services/web/src/components/inspector/KeyframePanel.vue` | Yeni — seçili keyframe değer/mod editörü |
| `services/web/src/components/inspector/Inspector.vue` | Güncelle — `KeyframePanel` import + render |

---

## Task 1: Keyframe interpolasyon motoru

**Files:**
- Create: `services/web/src/engine/keyframe.js`
- Modify: `services/web/tests/engine.test.mjs`

- [ ] **Step 1: `keyframe.js` dosyasını oluştur**

```js
// services/web/src/engine/keyframe.js

const PRESET_HANDLES = {
  linear:      [0, 0, 1, 1],
  ease_in:     [0.42, 0, 1, 1],
  ease_out:    [0, 0, 0.58, 1],
  ease_in_out: [0.42, 0, 0.58, 1],
};

function cubicBezierY(x1, y1, x2, y2, t) {
  function bx(u) { return 3*u*(1-u)*(1-u)*x1 + 3*u*u*(1-u)*x2 + u*u*u; }
  function by(u) { return 3*u*(1-u)*(1-u)*y1 + 3*u*u*(1-u)*y2 + u*u*u; }
  function bxd(u) { return 3*(1-u)*(1-u)*x1 + 6*u*(1-u)*(x2-x1) + 3*u*u*(1-x2); }
  let g = t;
  for (let i = 0; i < 8; i++) {
    const err = bx(g) - t;
    if (Math.abs(err) < 1e-7) break;
    const d = bxd(g);
    if (Math.abs(d) < 1e-6) break;
    g -= err / d;
  }
  return by(Math.max(0, Math.min(1, g)));
}

export function interpolateKeyframes(keyframes, time) {
  if (!keyframes || keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0].value;

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  let lo = 0, hi = sorted.length - 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (sorted[mid].time <= time) lo = mid; else hi = mid - 1;
  }

  const k1 = sorted[lo], k2 = sorted[lo + 1];
  const rawT = (time - k1.time) / (k2.time - k1.time);
  const easing = k1.easing || { type: 'linear' };
  const h = (easing.type === 'bezier' && easing.handles)
    ? easing.handles
    : (PRESET_HANDLES[easing.type] || PRESET_HANDLES.linear);

  const t = cubicBezierY(h[0], h[1], h[2], h[3], rawT);
  return k1.value + (k2.value - k1.value) * t;
}

export function getKeyframeRange(keyframes) {
  if (!keyframes || keyframes.length === 0) return null;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  return { start: sorted[0].time, end: sorted[sorted.length - 1].time };
}
```

- [ ] **Step 2: Engine testlerini `tests/engine.test.mjs` sonuna ekle**

```js
// --- Sonuna ekle ---

import { interpolateKeyframes, getKeyframeRange } from '../src/engine/keyframe.js';

section('Keyframe Interpolation');

// Boş dizi
assert(interpolateKeyframes([], 1.0) === null, 'empty keyframes returns null');
assert(interpolateKeyframes(null, 1.0) === null, 'null keyframes returns null');

// Tek nokta
assertApprox(interpolateKeyframes([{ time: 1, value: 42 }], 0.5), 42, 0.001, 'single keyframe returns its value before time');
assertApprox(interpolateKeyframes([{ time: 1, value: 42 }], 1.0), 42, 0.001, 'single keyframe returns its value at time');
assertApprox(interpolateKeyframes([{ time: 1, value: 42 }], 2.0), 42, 0.001, 'single keyframe returns its value after time');

// İki nokta — linear
const kfs = [
  { time: 0, value: 0, easing: { type: 'linear' } },
  { time: 2, value: 100 }
];
assertApprox(interpolateKeyframes(kfs, 0), 0, 0.001, 'linear: at t=0 returns 0');
assertApprox(interpolateKeyframes(kfs, 1), 50, 0.001, 'linear: at t=1 returns 50 (midpoint)');
assertApprox(interpolateKeyframes(kfs, 2), 100, 0.001, 'linear: at t=2 returns 100');
assertApprox(interpolateKeyframes(kfs, -1), 0, 0.001, 'before range: clamps to first value');
assertApprox(interpolateKeyframes(kfs, 5), 100, 0.001, 'after range: clamps to last value');

// Bezier — handles=[0,0,1,1] eşittir linear
const kfsBez = [
  { time: 0, value: 0, easing: { type: 'bezier', handles: [0, 0, 1, 1] } },
  { time: 1, value: 100 }
];
assertApprox(interpolateKeyframes(kfsBez, 0.5), 50, 0.5, 'bezier [0,0,1,1] at midpoint ≈ 50 (linear-ish)');

// Üç nokta — ortadaki seçilir
const kfsThree = [
  { time: 0, value: 0, easing: { type: 'linear' } },
  { time: 1, value: 100, easing: { type: 'linear' } },
  { time: 2, value: 0 }
];
assertApprox(interpolateKeyframes(kfsThree, 0.5), 50, 0.001, 'three kf: first segment at t=0.5');
assertApprox(interpolateKeyframes(kfsThree, 1.5), 50, 0.001, 'three kf: second segment at t=1.5');

section('getKeyframeRange');
assert(getKeyframeRange([]) === null, 'empty returns null');
const r = getKeyframeRange([{ time: 2 }, { time: 0.5 }, { time: 3 }]);
assertApprox(r.start, 0.5, 0.001, 'range.start is min time');
assertApprox(r.end, 3, 0.001, 'range.end is max time');
```

- [ ] **Step 3: Testleri çalıştır, geçtiğini doğrula**

```
cd services/web && node tests/engine.test.mjs
```

Beklenen: son satırda mevcut sayının üstüne yeni testler eklendi, hepsi PASS.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/engine/keyframe.js services/web/tests/engine.test.mjs
git commit -m "feat(engine): keyframe interpolation engine with Bezier solver"
```

---

## Task 2: Store keyframe action'ları

**Files:**
- Modify: `services/web/src/store/project.js`
- Create: `services/web/tests/components/keyframe-store.test.js`

- [ ] **Step 1: Failing testleri yaz**

`services/web/tests/components/keyframe-store.test.js` dosyasını oluştur:

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

describe('keyframeDefaults', () => {
  it('project has keyframeDefaults with mode opt-in', () => {
    expect(store.project.keyframeDefaults).toBeDefined();
    expect(store.project.keyframeDefaults.mode).toBe('opt-in');
    expect(store.project.keyframeDefaults.codegenMode).toBe('UpdateFromAlphaFunc');
  });
});

describe('addKeyframe', () => {
  it('adds a keyframe to an object property', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    const updated = store.objectById(obj.id);
    expect(updated.keyframes).toBeDefined();
    expect(updated.keyframes.x).toHaveLength(1);
    expect(updated.keyframes.x[0].time).toBe(1.0);
    expect(updated.keyframes.x[0].value).toBe(500);
    expect(updated.keyframes.x[0].easing).toEqual({ type: 'linear' });
  });

  it('updates existing keyframe at same time', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.addKeyframe(obj.id, 'x', 1.0, 700);
    expect(store.objectById(obj.id).keyframes.x).toHaveLength(1);
    expect(store.objectById(obj.id).keyframes.x[0].value).toBe(700);
  });

  it('keeps keyframes sorted by time', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 2.0, 800);
    store.addKeyframe(obj.id, 'x', 0.5, 100);
    const kfs = store.objectById(obj.id).keyframes.x;
    expect(kfs[0].time).toBe(0.5);
    expect(kfs[1].time).toBe(2.0);
  });
});

describe('removeKeyframe', () => {
  it('removes a keyframe', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.removeKeyframe(obj.id, 'x', 1.0);
    expect(store.objectById(obj.id).keyframes).toBeUndefined();
  });

  it('cleans up empty prop arrays', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.addKeyframe(obj.id, 'y', 1.0, 300);
    store.removeKeyframe(obj.id, 'x', 1.0);
    expect(store.objectById(obj.id).keyframes.x).toBeUndefined();
    expect(store.objectById(obj.id).keyframes.y).toHaveLength(1);
  });
});

describe('updateKeyframeValue', () => {
  it('updates only the value', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.updateKeyframeValue(obj.id, 'x', 1.0, 999);
    expect(store.objectById(obj.id).keyframes.x[0].value).toBe(999);
    expect(store.objectById(obj.id).keyframes.x[0].easing).toEqual({ type: 'linear' });
  });
});

describe('updateKeyframeEasing', () => {
  it('updates the easing of a keyframe', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.updateKeyframeEasing(obj.id, 'x', 1.0, { type: 'ease_in_out' });
    expect(store.objectById(obj.id).keyframes.x[0].easing).toEqual({ type: 'ease_in_out' });
  });
});

describe('setKeyframeMode', () => {
  it('sets per-property keyframe mode', () => {
    const obj = store.addObject('circle', 960, 540);
    store.setKeyframeMode(obj.id, 'x', 'override');
    expect(store.objectById(obj.id).keyframeMode.x).toBe('override');
  });
});

describe('setKeyframeCodegen', () => {
  it('sets per-property codegen mode', () => {
    const obj = store.addObject('circle', 960, 540);
    store.setKeyframeCodegen(obj.id, 'x', 'ValueTracker');
    expect(store.objectById(obj.id).keyframeCodegen.x).toBe('ValueTracker');
  });
});

describe('selectKeyframe', () => {
  it('sets selectedKeyframeId', () => {
    store.selectKeyframe('obj_1', 'x', 1.5);
    expect(store.selectedKeyframeId).toEqual({ objId: 'obj_1', prop: 'x', time: 1.5 });
  });

  it('clears selectedKeyframeId with null args', () => {
    store.selectKeyframe('obj_1', 'x', 1.5);
    store.selectKeyframe(null, null, null);
    expect(store.selectedKeyframeId).toBeNull();
  });
});

describe('undo/redo with keyframes', () => {
  it('undoes addKeyframe', () => {
    const obj = store.addObject('circle', 960, 540);
    store.addKeyframe(obj.id, 'x', 1.0, 500);
    store.undo();
    expect(store.objectById(obj.id).keyframes).toBeUndefined();
  });
});
```

- [ ] **Step 2: Testleri çalıştır — FAIL görmek için**

```
cd services/web && npm run test:unit -- tests/components/keyframe-store.test.js
```

Beklenen: tüm testler FAIL (action'lar henüz yok).

- [ ] **Step 3: `createDefaultProject()` içine `keyframeDefaults` ekle**

`services/web/src/store/project.js` içinde `createDefaultProject` return objesine, `cameraTrack: []` satırından hemen sonra:

```js
keyframeDefaults: {
  mode: 'opt-in',
  codegenMode: 'UpdateFromAlphaFunc'
},
```

- [ ] **Step 4: Store state'e `selectedKeyframeId: null` ekle**

`defineStore` içindeki `state: () => ({` bloğuna, `selectedClipId: null` satırından hemen sonra:

```js
selectedKeyframeId: null,  // { objId, prop, time } | null
```

- [ ] **Step 5: Keyframe action'larını store'a ekle**

`actions: {` bloğunda, son action'dan sonra yeni bir bölüm ekle:

```js
// ══════════════════════════════════════════════════════════════════════════
// Keyframes
// ══════════════════════════════════════════════════════════════════════════

addKeyframe(objId, prop, time, value) {
  const obj = this.project.objects.find(o => o.id === objId);
  if (!obj) return;
  if (!obj.keyframes) obj.keyframes = {};
  if (!obj.keyframes[prop]) obj.keyframes[prop] = [];
  const existing = obj.keyframes[prop].findIndex(k => Math.abs(k.time - time) < 0.01);
  if (existing >= 0) {
    obj.keyframes[prop][existing].value = value;
  } else {
    obj.keyframes[prop].push({ time, value, easing: { type: 'linear' } });
    obj.keyframes[prop].sort((a, b) => a.time - b.time);
  }
  this.isDirty = true;
  this.commitState();
},

removeKeyframe(objId, prop, time) {
  const obj = this.project.objects.find(o => o.id === objId);
  if (!obj?.keyframes?.[prop]) return;
  obj.keyframes[prop] = obj.keyframes[prop].filter(k => Math.abs(k.time - time) >= 0.01);
  if (obj.keyframes[prop].length === 0) delete obj.keyframes[prop];
  if (obj.keyframes && Object.keys(obj.keyframes).length === 0) delete obj.keyframes;
  this.isDirty = true;
  this.commitState();
},

updateKeyframeValue(objId, prop, time, value) {
  const obj = this.project.objects.find(o => o.id === objId);
  const kf = obj?.keyframes?.[prop]?.find(k => Math.abs(k.time - time) < 0.01);
  if (!kf) return;
  kf.value = value;
  this.isDirty = true;
  this.commitState();
},

updateKeyframeEasing(objId, prop, time, easing) {
  const obj = this.project.objects.find(o => o.id === objId);
  const kf = obj?.keyframes?.[prop]?.find(k => Math.abs(k.time - time) < 0.01);
  if (!kf) return;
  kf.easing = easing;
  this.isDirty = true;
  this.commitState();
},

setKeyframeMode(objId, prop, mode) {
  const obj = this.project.objects.find(o => o.id === objId);
  if (!obj) return;
  if (!obj.keyframeMode) obj.keyframeMode = {};
  obj.keyframeMode[prop] = mode;
  this.isDirty = true;
  this.commitState();
},

setKeyframeCodegen(objId, prop, codegenMode) {
  const obj = this.project.objects.find(o => o.id === objId);
  if (!obj) return;
  if (!obj.keyframeCodegen) obj.keyframeCodegen = {};
  obj.keyframeCodegen[prop] = codegenMode;
  this.isDirty = true;
  this.commitState();
},

selectKeyframe(objId, prop, time) {
  this.selectedKeyframeId = (objId && prop != null && time != null)
    ? { objId, prop, time }
    : null;
},
```

- [ ] **Step 6: Testleri çalıştır — PASS görmek için**

```
cd services/web && npm run test:unit -- tests/components/keyframe-store.test.js
```

Beklenen: tüm testler PASS.

- [ ] **Step 7: Tüm unit testlerin hâlâ geçtiğini kontrol et**

```
cd services/web && npm run test:unit
```

- [ ] **Step 8: Commit**

```bash
git add services/web/src/store/project.js services/web/tests/components/keyframe-store.test.js
git commit -m "feat(store): keyframe actions, keyframeDefaults, selectedKeyframeId"
```

---

## Task 3: Playback engine entegrasyonu

**Files:**
- Modify: `services/web/src/engine/playback.js`

- [ ] **Step 1: `interpolateKeyframes` ve `getKeyframeRange` import'unu ekle**

`playback.js` dosyasının en üstüne, mevcut import'ların yanına:

```js
import { interpolateKeyframes, getKeyframeRange } from './keyframe.js';
```

- [ ] **Step 2: `PlaybackEngine` sınıfına `setKeyframeDefaults` metodu ekle**

`constructor()` içine `this._keyframeDefaults = { mode: 'opt-in' };` ekle:

```js
constructor() {
  this.playing = false;
  this.currentTime = 0;
  this.loop = true;
  this.duration = 10;
  this._frameId = null;
  this._lastTimestamp = null;
  this._onFrame = null;
  this._onTimeUpdate = null;
  this._pointsCache = new Map();
  this._keyframeDefaults = { mode: 'opt-in' };  // ← ekle
}
```

Sınıfın herhangi bir yerine yeni metot ekle (örn. `clearCache()` sonrasına):

```js
setKeyframeDefaults(defaults) {
  this._keyframeDefaults = defaults || { mode: 'opt-in' };
}
```

- [ ] **Step 3: `_applyKeyframeOverrides` metodunu ekle**

`_applyEnterExitAnims` metodundan hemen önce ekle:

```js
_applyKeyframeOverrides(frame, time, objects) {
  for (const obj of objects) {
    if (!obj.keyframes || Object.keys(obj.keyframes).length === 0) continue;

    for (const [prop, keyframes] of Object.entries(obj.keyframes)) {
      if (!keyframes || keyframes.length === 0) continue;

      const mode = (obj.keyframeMode && obj.keyframeMode[prop]) ||
        this._keyframeDefaults.mode || 'opt-in';

      if (mode === 'opt-in') {
        const range = getKeyframeRange(keyframes);
        if (!range || time < range.start || time > range.end) continue;
      }

      const kfValue = interpolateKeyframes(keyframes, time);
      if (kfValue === null) continue;

      const overrides = frame.objectOverrides[obj.id] || {};
      if (mode === 'additive') {
        const base = overrides[prop] !== undefined ? overrides[prop] : (obj[prop] || 0);
        overrides[prop] = base + kfValue;
      } else {
        overrides[prop] = kfValue;
      }
      frame.objectOverrides[obj.id] = overrides;
    }
  }
}
```

- [ ] **Step 4: `computeFrame` içinde `_applyKeyframeOverrides` çağır**

`computeFrame` metodunda `this._applyEnterExitAnims(frame, time, objects);` satırından hemen önce:

```js
// Keyframe overrides — applied after clip blending, before enter/exit anims
this._applyKeyframeOverrides(frame, time, objects);
```

- [ ] **Step 5: `App.vue`'ye keyframeDefaults bağlantısı ekle**

`services/web/src/App.vue` içinde `getPlaybackEngine()` kullanılan yerin yakınına, proje yüklendiğinde ve değiştiğinde `setKeyframeDefaults` çağrısını ekle. `watch(() => store.project.keyframeDefaults, ...)` kullanarak:

```js
import { watch } from 'vue';
// mevcut engine import'u yanına — getPlaybackEngine zaten import edilmiş olmalı

// onMounted veya setup bloğuna:
watch(
  () => store.project.keyframeDefaults,
  (defaults) => { getPlaybackEngine().setKeyframeDefaults(defaults); },
  { immediate: true, deep: true }
);
```

- [ ] **Step 6: Engine testlerini çalıştır — regresyon yok mu?**

```
cd services/web && node tests/engine.test.mjs
```

- [ ] **Step 7: Commit**

```bash
git add services/web/src/engine/playback.js services/web/src/App.vue
git commit -m "feat(playback): apply keyframe overrides per-property after clip blending"
```

---

## Task 4: Codegen — keyframe Python çıktısı

**Files:**
- Modify: `services/api/src/compiler/codegen.js`
- Modify: `services/web/src/export/manim.js`
- Create: `services/web/tests/components/keyframe-codegen.test.js`

- [ ] **Step 1: Failing codegen testlerini yaz**

`services/web/tests/components/keyframe-codegen.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateManimCode } from '../../src/export/manim.js';

function makeProject(overrides = {}) {
  return {
    stage: { width: 1920, height: 1080, backgroundColor: '#000000', backgroundOpacity: 1 },
    objects: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips: [] }],
    groups: [],
    assets: [],
    sceneDuration: 5,
    cameraType: 'static',
    cameraTrack: [],
    keyframeDefaults: { mode: 'opt-in', codegenMode: 'UpdateFromAlphaFunc' },
    ...overrides
  };
}

describe('keyframe codegen — no keyframes', () => {
  it('project without keyframes generates same output as before', () => {
    const proj = makeProject({
      objects: [{ id: 'obj_1', type: 'circle', name: 'Circle', x: 960, y: 540, width: 120, height: 120, fill: '#22c55e', stroke: '#fff', strokeWidth: 2, opacity: 1, enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', rotation: 0 }]
    });
    const code = generateManimCode(proj);
    expect(code).not.toContain('UpdateFromFunc');
    expect(code).not.toContain('ValueTracker');
    expect(code).toContain('Circle');
  });
});

describe('keyframe codegen — animate mode', () => {
  it('generates sequential obj.animate.set_x() calls', () => {
    const proj = makeProject({
      objects: [{
        id: 'obj_1', type: 'circle', name: 'Circle', x: 100, y: 540, width: 120, height: 120,
        fill: '#22c55e', stroke: '#fff', strokeWidth: 2, opacity: 1,
        enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', rotation: 0,
        keyframes: {
          x: [
            { time: 0.5, value: 300, easing: { type: 'linear' } },
            { time: 2.0, value: 900 }
          ]
        },
        keyframeCodegen: { x: 'animate' }
      }]
    });
    const code = generateManimCode(proj);
    expect(code).toContain('.animate');
    expect(code).toContain('run_time=1.5');
  });
});

describe('keyframe codegen — UpdateFromAlphaFunc mode', () => {
  it('generates _kf_ list and UpdateFromFunc call', () => {
    const proj = makeProject({
      objects: [{
        id: 'obj_1', type: 'circle', name: 'Circle', x: 100, y: 540, width: 120, height: 120,
        fill: '#22c55e', stroke: '#fff', strokeWidth: 2, opacity: 1,
        enterTime: 0, duration: 5, enterAnim: 'none', exitAnim: 'none', rotation: 0,
        keyframes: {
          x: [
            { time: 0.5, value: 300, easing: { type: 'linear' } },
            { time: 2.0, value: 900 }
          ]
        },
        keyframeCodegen: { x: 'UpdateFromAlphaFunc' }
      }]
    });
    const code = generateManimCode(proj);
    expect(code).toContain('_kf_obj_1_x');
    expect(code).toContain('UpdateFromFunc');
    expect(code).toContain('run_time=1.5');
  });
});
```

- [ ] **Step 2: Testleri çalıştır — FAIL görmek için**

```
cd services/web && npm run test:unit -- tests/components/keyframe-codegen.test.js
```

- [ ] **Step 3: `codegen.js` sonuna `generateKeyframeSteps` yardımcı fonksiyonunu ekle**

`services/api/src/compiler/codegen.js` içinde, `module.exports` satırından hemen önce:

```js
// ── Keyframe steps ─────────────────────────────────────────────────────────

function generateKeyframeSteps(project, steps, sw, sh) {
  if (!project.objects) return;
  for (const obj of project.objects) {
    if (!obj.keyframes || Object.keys(obj.keyframes).length === 0) continue;
    const n = vn(obj.id);
    const defaults = project.keyframeDefaults || {};

    for (const [prop, keyframes] of Object.entries(obj.keyframes)) {
      if (!keyframes || keyframes.length < 2) continue;
      const sorted = [...keyframes].sort((a, b) => a.time - b.time);
      const codegenMode = (obj.keyframeCodegen && obj.keyframeCodegen[prop]) ||
        defaults.codegenMode || 'UpdateFromAlphaFunc';

      if (codegenMode === 'animate') {
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i], k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const val = _kfPropSet(n, prop, k2.value, sw, sh);
          if (!val) continue;
          const rt = rtOpt(dur);
          steps.push({ time: k1.time, order: 0.5, code: `self.play(${val}${rt})`, dur });
        }
      } else if (codegenMode === 'ValueTracker') {
        const safeProp = prop.replace(/[^a-zA-Z0-9_]/g, '_');
        const trackVar = `_vt_${vn(obj.id)}_${safeProp}`;
        const initVal = sorted[0].value;
        let block = `${trackVar} = ValueTracker(${initVal})\n`;
        block += `${n}.add_updater(lambda m: m.${_kfUpdater(prop)}(${trackVar}.get_value()))\n`;
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i], k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const rt = rtOpt(dur);
          block += `self.play(${trackVar}.animate.set_value(${k2.value})${rt})\n`;
        }
        block += `${n}.clear_updaters()`;
        steps.push({ time: sorted[0].time, order: 0.5, code: block, dur: sorted[sorted.length - 1].time - sorted[0].time });
      } else {
        // UpdateFromAlphaFunc (default)
        for (let i = 0; i < sorted.length - 1; i++) {
          const k1 = sorted[i], k2 = sorted[i + 1];
          const dur = parseFloat((k2.time - k1.time).toFixed(2));
          const safeProp = prop.replace(/[^a-zA-Z0-9_]/g, '_');
          const kfVar = `_kf_${vn(obj.id)}_${safeProp}_${i}`;
          const setter = _kfUpdater(prop);
          if (!setter) continue;
          const rt = rtOpt(dur);
          const v0 = k1.value.toFixed(4), v1 = k2.value.toFixed(4);
          const t0 = k1.time.toFixed(4), t1 = k2.time.toFixed(4);
          const block =
            `def ${kfVar}_fn(mob, alpha):\n` +
            `    t = ${t0} + alpha * ${dur.toFixed(4)}\n` +
            `    v = ${v0} + (${v1} - ${v0}) * max(0, min(1, (t - ${t0}) / ${dur.toFixed(4)}))\n` +
            `    mob.${setter}(v)\n` +
            `self.play(UpdateFromFunc(${n}, ${kfVar}_fn, run_time=${dur.toFixed(1)}, rate_func=linear))`;
          steps.push({ time: k1.time, order: 0.5, code: block, dur });
        }
      }
    }
  }
}

function _kfPropSet(n, prop, value, sw, sh) {
  const MANIM_W = 14, MANIM_H = 8;
  switch (prop) {
    case 'x': {
      const mx = ((value / sw) - 0.5) * MANIM_W;
      return `${n}.animate.set_x(${mx.toFixed(4)})`;
    }
    case 'y': {
      const my = (0.5 - value / sh) * MANIM_H;
      return `${n}.animate.set_y(${my.toFixed(4)})`;
    }
    case 'opacity': return `${n}.animate.set_opacity(${Math.max(0, Math.min(1, value)).toFixed(4)})`;
    case 'rotation': return `${n}.animate.rotate(${(value * Math.PI / 180).toFixed(4)})`;
    case 'scaleX': return `${n}.animate.stretch_to_fit_width(${value.toFixed(4)})`;
    case 'scaleY': return `${n}.animate.stretch_to_fit_height(${value.toFixed(4)})`;
    default: return null;
  }
}

function _kfUpdater(prop) {
  switch (prop) {
    case 'x':       return 'set_x';
    case 'y':       return 'set_y';
    case 'opacity': return 'set_opacity';
    default:        return null;
  }
}
```

- [ ] **Step 4: `generateManimCode` içinde `generateKeyframeSteps` çağrısını ekle**

`codegen.js` içinde clips işlendikten sonra, camera clips'ten hemen önce:

```js
// Keyframe steps
generateKeyframeSteps(project, steps, sw, sh);
```

(Yaklaşık 620. satır civarı — `// Camera clips` yorumundan hemen önce)

- [ ] **Step 5: Aynı yardımcı fonksiyonları `manim.js`'e ekle**

`services/web/src/export/manim.js` dosyasında aynı 3 fonksiyonu (`generateKeyframeSteps`, `_kfPropSet`, `_kfUpdater`) `generateManimCode` fonksiyonundan önce ekle. `generateKeyframeSteps` çağrısını da aynı yere (camera clips'ten önce) koy.

Not: `manim.js` ES module kullandığı için `module.exports` yok. Fonksiyon isimleri ve mantık `codegen.js` ile birebir aynı kalır.

- [ ] **Step 6: Testleri çalıştır — PASS görmek için**

```
cd services/web && npm run test:unit -- tests/components/keyframe-codegen.test.js
```

- [ ] **Step 7: Tüm testleri çalıştır**

```
cd services/web && npm run test:unit && node tests/engine.test.mjs
```

- [ ] **Step 8: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/src/export/manim.js services/web/tests/components/keyframe-codegen.test.js
git commit -m "feat(codegen): keyframe Python codegen for animate/UpdateFromFunc/ValueTracker modes"
```

---

## Task 5: Timeline — KeyframeLane bileşeni

**Files:**
- Create: `services/web/src/components/timeline/KeyframeLane.vue`
- Create: `services/web/src/components/timeline/KeyframeLanesPanel.vue`
- Modify: `services/web/src/components/timeline/Timeline.vue`

- [ ] **Step 1: `KeyframeLane.vue` oluştur**

```vue
<!-- services/web/src/components/timeline/KeyframeLane.vue -->
<template>
  <div class="keyframe-lane flex border-b border-studio-border/20" style="height: 20px;">
    <div
      class="flex-shrink-0 flex items-center px-2 text-[9px] text-studio-text-muted/60 bg-studio-bg/10 border-r border-studio-border/30 truncate"
      :style="{ width: labelW + 'px' }"
    >
      ↳ {{ prop }}
    </div>
    <div
      class="relative flex-1 overflow-hidden cursor-crosshair"
      :style="{ width: totalW + 'px' }"
      @dblclick="onDblClick"
    >
      <div :style="{ width: totalW + 'px' }" class="h-full relative">
        <!-- Keyframe diamonds -->
        <div
          v-for="kf in sortedKeyframes"
          :key="kf.time"
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-transform hover:scale-125"
          :style="{ left: kf.time * pps + 'px' }"
          :title="`t=${kf.time.toFixed(2)}s  v=${kf.value}`"
          @click.stop="selectKf(kf)"
          @contextmenu.prevent="rightClickKf(kf, $event)"
          @mousedown.stop="startDrag(kf, $event)"
        >
          <svg width="10" height="10" viewBox="-5 -5 10 10">
            <polygon
              points="0,-4 4,0 0,4 -4,0"
              :fill="modeColor"
              stroke="white"
              stroke-width="0.8"
            />
          </svg>
        </div>
        <!-- Segment lines between keyframes -->
        <svg
          v-if="sortedKeyframes.length > 1"
          class="absolute top-0 left-0 w-full h-full pointer-events-none"
          :width="totalW"
          height="20"
        >
          <line
            v-for="(kf, i) in sortedKeyframes.slice(0, -1)"
            :key="'seg-' + kf.time"
            :x1="kf.time * pps"
            y1="10"
            :x2="sortedKeyframes[i + 1].time * pps"
            y2="10"
            :stroke="modeColor"
            stroke-width="1"
            stroke-opacity="0.35"
            class="cursor-pointer"
            @click.stop="openEasingPopup(kf, sortedKeyframes[i + 1], $event)"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';

const props = defineProps({
  objId:  { type: String, required: true },
  prop:   { type: String, required: true },
  pps:    { type: Number, required: true },
  labelW: { type: Number, required: true },
  totalW: { type: Number, required: true },
});

const emit = defineEmits(['openEasingPopup']);

const store = useProjectStore();
const obj = computed(() => store.objectById(props.objId));
const keyframes = computed(() => obj.value?.keyframes?.[props.prop] || []);
const sortedKeyframes = computed(() => [...keyframes.value].sort((a, b) => a.time - b.time));
const mode = computed(() => obj.value?.keyframeMode?.[props.prop] || store.project.keyframeDefaults?.mode || 'opt-in');
const modeColor = computed(() => ({ override: '#ffd700', additive: '#ff9d42', 'opt-in': '#60a5fa' }[mode.value] || '#60a5fa'));

function selectKf(kf) {
  store.selectKeyframe(props.objId, props.prop, kf.time);
}

function rightClickKf(kf, e) {
  store.removeKeyframe(props.objId, props.prop, kf.time);
}

function onDblClick(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const t = Math.round(((e.clientX - rect.left) / props.pps) * 100) / 100;
  const currentVal = obj.value?.[props.prop] ?? 0;
  store.addKeyframe(props.objId, props.prop, t, currentVal);
}

function startDrag(kf, e) {
  selectKf(kf);
  const startX = e.clientX, origTime = kf.time;
  const move = (ev) => {
    const dt = (ev.clientX - startX) / props.pps;
    const newTime = Math.max(0, Math.round((origTime + dt) * 100) / 100);
    store.removeKeyframe(props.objId, props.prop, origTime);
    store.addKeyframe(props.objId, props.prop, newTime, kf.value);
    store.selectKeyframe(props.objId, props.prop, newTime);
  };
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function openEasingPopup(k1, k2, e) {
  emit('openEasingPopup', { objId: props.objId, prop: props.prop, k1, k2, event: e });
}
</script>
```

- [ ] **Step 2: `KeyframeLanesPanel.vue` oluştur**

```vue
<!-- services/web/src/components/timeline/KeyframeLanesPanel.vue -->
<template>
  <div v-if="selectedClip && sourceObj" class="border-b border-studio-border/30">
    <!-- Lane header -->
    <div class="flex border-b border-studio-border/20" style="height:22px">
      <div
        class="flex-shrink-0 flex items-center px-2 bg-studio-bg/20 border-r border-studio-border/50 text-[9px] text-studio-accent font-medium"
        :style="{ width: labelW + 'px' }"
      >
        ◆ Keyframes
      </div>
      <div class="flex-1 relative overflow-hidden text-[9px] text-studio-text-muted flex items-center px-2 gap-3">
        <span>{{ sourceObj.name }}</span>
        <!-- Add keyframe prop buttons -->
        <button
          v-for="p in addableProps"
          :key="p"
          class="text-studio-accent/70 hover:text-studio-accent leading-none"
          :title="`${p} için keyframe ekle`"
          @click="addPropLane(p)"
        >+ {{ p }}</button>
      </div>
    </div>

    <!-- Existing lanes -->
    <KeyframeLane
      v-for="prop in activePropLanes"
      :key="prop"
      :objId="sourceObj.id"
      :prop="prop"
      :pps="pps"
      :labelW="labelW"
      :totalW="totalW"
      @openEasingPopup="$emit('openEasingPopup', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';
import KeyframeLane from './KeyframeLane.vue';

const KEYFRAMEABLE_PROPS = ['x', 'y', 'opacity', 'rotation', 'scaleX', 'scaleY', 'width', 'height', 'strokeWidth', 'fontSize'];

const props = defineProps({
  pps:    { type: Number, required: true },
  labelW: { type: Number, required: true },
  totalW: { type: Number, required: true },
});

const emit = defineEmits(['openEasingPopup']);

const store = useProjectStore();
const selectedClip = computed(() => store.selectedClip);
const sourceObj = computed(() => {
  const clip = selectedClip.value;
  if (!clip?.sourceId) return null;
  return store.objectById(clip.sourceId);
});

const activePropLanes = computed(() => {
  const obj = sourceObj.value;
  if (!obj?.keyframes) return [];
  return Object.keys(obj.keyframes);
});

const addableProps = computed(() => {
  const active = new Set(activePropLanes.value);
  return KEYFRAMEABLE_PROPS.filter(p => !active.has(p));
});

function addPropLane(prop) {
  if (!sourceObj.value) return;
  const val = sourceObj.value[prop] ?? 0;
  store.addKeyframe(sourceObj.value.id, prop, store.playbackTime, val);
}
</script>
```

- [ ] **Step 3: `Timeline.vue` içine `KeyframeLanesPanel` ekle**

`services/web/src/components/timeline/Timeline.vue` template'inde, camera track bloğundan hemen önce:

```html
<!-- Keyframe Lanes Panel -->
<KeyframeLanesPanel
  :pps="pps"
  :labelW="labelW"
  :totalW="totalW"
  @openEasingPopup="onOpenEasingPopup"
/>
```

`<script setup>` içine:

```js
import KeyframeLanesPanel from './KeyframeLanesPanel.vue';

function onOpenEasingPopup(payload) {
  easingPopup.value = payload;
}

const easingPopup = ref(null);
```

- [ ] **Step 4: Dev server'ı çalıştır, timeline'da keyframe lane'lerini test et**

```
cd services/web && npm run dev
```

Bir klip oluştur, seç — alt kısımda "◆ Keyframes" başlığı ve `+x`, `+y` butonları görünmeli. Bir butona tıkla — lane açılmalı. Lane üzerinde çift tık → elmas noktası eklenmeli.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/timeline/KeyframeLane.vue services/web/src/components/timeline/KeyframeLanesPanel.vue services/web/src/components/timeline/Timeline.vue
git commit -m "feat(timeline): keyframe lanes panel with diamond markers, add/remove/drag"
```

---

## Task 6: Bezier easing popup

**Files:**
- Create: `services/web/src/components/timeline/KeyframeEasingPopup.vue`
- Modify: `services/web/src/components/timeline/Timeline.vue`

- [ ] **Step 1: `KeyframeEasingPopup.vue` oluştur**

```vue
<!-- services/web/src/components/timeline/KeyframeEasingPopup.vue -->
<template>
  <div
    v-if="visible"
    class="keyframe-popup fixed z-50 bg-studio-surface border border-studio-border rounded-lg shadow-xl p-3"
    :style="{ left: posX + 'px', top: posY + 'px', width: '200px' }"
    @mousedown.stop
  >
    <div class="text-[10px] text-studio-text-muted mb-2">Segment easing · {{ prop }}</div>

    <!-- Bezier preview SVG -->
    <svg class="w-full rounded bg-studio-bg mb-2" height="60" viewBox="0 0 180 60">
      <path :d="curvePath" stroke="#ffd700" stroke-width="1.5" fill="none"/>
      <!-- Tangent handles (draggable) -->
      <line :x1="10" :y1="50" :x2="h1x" :y2="h1y" stroke="#4a90d9" stroke-width="1" stroke-dasharray="2"/>
      <line :x1="170" :y1="10" :x2="h2x" :y2="h2y" stroke="#4a90d9" stroke-width="1" stroke-dasharray="2"/>
      <circle :cx="h1x" :cy="h1y" r="4" fill="none" stroke="#4a90d9" stroke-width="1.5" class="cursor-grab" @mousedown.prevent="startHandleDrag(0, $event)"/>
      <circle :cx="h2x" :cy="h2y" r="4" fill="none" stroke="#4a90d9" stroke-width="1.5" class="cursor-grab" @mousedown.prevent="startHandleDrag(1, $event)"/>
      <circle cx="10" cy="50" r="3" fill="#ffd700"/>
      <circle cx="170" cy="10" r="3" fill="#ffd700"/>
    </svg>

    <!-- Preset buttons -->
    <div class="flex flex-wrap gap-1 mb-2">
      <button
        v-for="preset in PRESETS"
        :key="preset.name"
        class="px-1.5 py-0.5 text-[9px] rounded border transition-colors"
        :class="activePreset === preset.name ? 'bg-studio-accent border-studio-accent text-white' : 'border-studio-border text-studio-text-muted hover:border-studio-accent/60'"
        @click="applyPreset(preset)"
      >{{ preset.label }}</button>
    </div>

    <!-- codegenMode selector -->
    <div class="text-[9px] text-studio-text-muted mb-1">Codegen</div>
    <select
      :value="codegenMode"
      class="w-full text-[10px] bg-studio-bg border border-studio-border rounded px-1 py-0.5"
      @change="setCodegenMode($event.target.value)"
    >
      <option value="UpdateFromAlphaFunc">UpdateFromFunc</option>
      <option value="animate">animate</option>
      <option value="ValueTracker">ValueTracker</option>
    </select>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '../../store/project.js';

const PRESETS = [
  { name: 'linear',      label: 'Linear',     handles: [0, 0, 1, 1] },
  { name: 'ease_in',     label: 'Ease In',    handles: [0.42, 0, 1, 1] },
  { name: 'ease_out',    label: 'Ease Out',   handles: [0, 0, 0.58, 1] },
  { name: 'ease_in_out', label: 'In-Out',     handles: [0.42, 0, 0.58, 1] },
];

const props = defineProps({
  payload: { type: Object, default: null }  // { objId, prop, k1, k2, event }
});

const emit = defineEmits(['close']);
const store = useProjectStore();

const visible = computed(() => !!props.payload);
const prop = computed(() => props.payload?.prop);
const posX = ref(0);
const posY = ref(0);

// Current handles from k1.easing
const handles = ref([0.42, 0, 0.58, 1]);

watch(() => props.payload, (p) => {
  if (!p) return;
  const rect = p.event?.target?.getBoundingClientRect?.();
  posX.value = Math.min(p.event.clientX + 10, window.innerWidth - 220);
  posY.value = Math.min(p.event.clientY + 10, window.innerHeight - 230);
  const e = p.k1.easing;
  handles.value = (e?.type === 'bezier' && e.handles) ? [...e.handles]
    : (PRESETS.find(pr => pr.name === e?.type)?.handles || [0.42, 0, 0.58, 1]);
});

// SVG coords (10,50)→(170,10)
const h1x = computed(() => 10 + handles.value[0] * 160);
const h1y = computed(() => 50 - handles.value[1] * 40);
const h2x = computed(() => 10 + handles.value[2] * 160);
const h2y = computed(() => 50 - handles.value[3] * 40);

const curvePath = computed(() => {
  return `M10,50 C${h1x.value},${h1y.value} ${h2x.value},${h2y.value} 170,10`;
});

const activePreset = computed(() => {
  const h = handles.value;
  const p = PRESETS.find(pr =>
    Math.abs(pr.handles[0]-h[0])<0.01 && Math.abs(pr.handles[1]-h[1])<0.01 &&
    Math.abs(pr.handles[2]-h[2])<0.01 && Math.abs(pr.handles[3]-h[3])<0.01
  );
  return p?.name || null;
});

const codegenMode = computed(() => {
  const p = props.payload;
  if (!p) return 'UpdateFromAlphaFunc';
  const obj = store.objectById(p.objId);
  return obj?.keyframeCodegen?.[p.prop] || store.project.keyframeDefaults?.codegenMode || 'UpdateFromAlphaFunc';
});

function applyPreset(preset) {
  handles.value = [...preset.handles];
  saveEasing({ type: preset.name });
}

function saveEasing(easing) {
  const p = props.payload;
  if (!p) return;
  store.updateKeyframeEasing(p.objId, p.prop, p.k1.time, easing);
}

function setCodegenMode(mode) {
  const p = props.payload;
  if (!p) return;
  store.setKeyframeCodegen(p.objId, p.prop, mode);
}

function startHandleDrag(handleIdx, e) {
  const svgEl = e.target.closest('svg');
  const rect = svgEl.getBoundingClientRect();
  const move = (ev) => {
    const rx = Math.max(0, Math.min(1, (ev.clientX - rect.left - 10) / 160));
    const ry = Math.max(0, Math.min(1, (50 - (ev.clientY - rect.top)) / 40));
    const h = [...handles.value];
    if (handleIdx === 0) { h[0] = rx; h[1] = ry; }
    else { h[2] = rx; h[3] = ry; }
    handles.value = h;
    saveEasing({ type: 'bezier', handles: h });
  };
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}
</script>
```

- [ ] **Step 2: `Timeline.vue`'ye popup bağla**

`Timeline.vue` template'inde, kapanış `</div>` etiketinden hemen önce:

```html
<!-- Keyframe Easing Popup -->
<KeyframeEasingPopup :payload="easingPopup" @close="easingPopup = null" />
<div v-if="easingPopup" class="fixed inset-0 z-40" @click="easingPopup = null" />
```

`<script setup>` import'larına ekle:

```js
import KeyframeEasingPopup from './KeyframeEasingPopup.vue';
```

- [ ] **Step 3: Dev server'da popup'ı test et**

İki keyframe noktası ekle, aralarındaki çizgiye tıkla → popup açılmalı. Preset butona tıkla → eğri değişmeli. Dışarı tıklayınca kapanmalı.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/timeline/KeyframeEasingPopup.vue services/web/src/components/timeline/Timeline.vue
git commit -m "feat(timeline): Bezier easing popup for keyframe segments"
```

---

## Task 7: Inspector — KeyframePanel

**Files:**
- Create: `services/web/src/components/inspector/KeyframePanel.vue`
- Modify: `services/web/src/components/inspector/Inspector.vue`

- [ ] **Step 1: `KeyframePanel.vue` oluştur**

```vue
<!-- services/web/src/components/inspector/KeyframePanel.vue -->
<template>
  <div v-if="kf" class="px-4 py-3 border-b border-studio-border">
    <div class="text-xs text-studio-text-muted font-medium mb-2 flex items-center gap-1">
      <svg width="10" height="10" viewBox="-5 -5 10 10">
        <polygon points="0,-4 4,0 0,4 -4,0" :fill="modeColor" stroke="white" stroke-width="0.8"/>
      </svg>
      Keyframe · {{ kf.prop }}
    </div>

    <!-- Time (read-only) -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-[10px] text-studio-text-muted">Time</span>
      <span class="text-[10px] font-mono text-studio-text">{{ kf.time.toFixed(2) }}s</span>
    </div>

    <!-- Value -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-[10px] text-studio-text-muted">Value</span>
      <input
        type="number"
        :value="kfData?.value ?? ''"
        class="w-20 text-[10px] font-mono text-right bg-studio-bg border border-studio-border rounded px-1 py-0.5"
        @change="updateValue(+$event.target.value)"
      />
    </div>

    <!-- Mode -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-[10px] text-studio-text-muted">Mode</span>
      <select
        :value="mode"
        class="text-[10px] bg-studio-bg border border-studio-border rounded px-1 py-0.5"
        @change="store.setKeyframeMode(kf.objId, kf.prop, $event.target.value)"
      >
        <option value="opt-in">Opt-in</option>
        <option value="override">Override</option>
        <option value="additive">Additive</option>
      </select>
    </div>

    <!-- Delete button -->
    <button
      class="w-full mt-1 py-1 text-[10px] text-studio-error bg-studio-error/10 rounded hover:bg-studio-error/20"
      @click="store.removeKeyframe(kf.objId, kf.prop, kf.time); store.selectKeyframe(null, null, null)"
    >
      Keyframe'i sil
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../../store/project.js';

const store = useProjectStore();
const kf = computed(() => store.selectedKeyframeId);
const obj = computed(() => kf.value ? store.objectById(kf.value.objId) : null);
const kfData = computed(() => {
  if (!kf.value || !obj.value?.keyframes?.[kf.value.prop]) return null;
  return obj.value.keyframes[kf.value.prop].find(k => Math.abs(k.time - kf.value.time) < 0.01) || null;
});
const mode = computed(() => {
  if (!kf.value || !obj.value) return 'opt-in';
  return obj.value.keyframeMode?.[kf.value.prop] || store.project.keyframeDefaults?.mode || 'opt-in';
});
const modeColor = computed(() => ({ override: '#ffd700', additive: '#ff9d42', 'opt-in': '#60a5fa' }[mode.value] || '#60a5fa'));

function updateValue(val) {
  if (!kf.value) return;
  store.updateKeyframeValue(kf.value.objId, kf.value.prop, kf.value.time, val);
}
</script>
```

- [ ] **Step 2: `Inspector.vue`'ye `KeyframePanel` ekle**

`Inspector.vue` template'inde `<AudioPanel>` bloğundan hemen sonra:

```html
<!-- Keyframe Panel (shown when a keyframe is selected) -->
<KeyframePanel />
```

`<script setup>` import'larına:

```js
import KeyframePanel from './KeyframePanel.vue'
```

- [ ] **Step 3: Dev server'da Inspector'ı test et**

Bir keyframe noktasına tıkla → Inspector'da ◆ Keyframe paneli görünmeli. Value input'u değiştir → timeline'daki noktanın canvas preview'da etkisi olmalı. Mode seçiciyi değiştir → noktanın rengi değişmeli.

- [ ] **Step 4: Tüm testleri çalıştır**

```
cd services/web && npm run test:unit && node tests/engine.test.mjs
```

Beklenen: tüm testler PASS.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/inspector/KeyframePanel.vue services/web/src/components/inspector/Inspector.vue
git commit -m "feat(inspector): KeyframePanel for editing selected keyframe value and mode"
```

---

## Son Kontrol

- [ ] `docker compose up --build` ile tam stack ayağa kaldır
- [ ] Bir nesneye `x` keyframe'i ekle → canvas'ta hareket preview'ı çalışıyor mu?
- [ ] Bezier popup'ında `Ease In-Out` preset seç → playback değişiyor mu?
- [ ] `Export .py` → keyframe kodunu içeriyor mu?
- [ ] Tüm testler: `cd services/web && npm run test:unit && node tests/engine.test.mjs`
