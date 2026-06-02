# Technical Debt Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `manim.js` client-side exporter to support Phase 2 features (generator + parser), and fix the camera preview in `StageCanvas.vue` to use Konva-level transform instead of CSS.

**Architecture:** Port codegen.js Phase 2 logic (numberplane/numberline/axes graphs, AnimationGroup/LaggedStart grouping, path_move, camera_move) to manim.js generator; add symmetric parser support with a stateful single-pass approach for multi-line constructs (VMobject+MoveAlongPath, AnimationGroup). Fix camera preview by injecting cameraState into `vs`/`ox`/`oy` computed properties instead of CSS transform on the container div.

**Tech Stack:** Vue 2.7, Konva.js, Vitest, `services/web/src/export/manim.js`, `services/web/src/components/stage/StageCanvas.vue`

---

## File Map

| File | Change |
|---|---|
| `services/web/tests/components/manim-export.test.js` | Create — all generator + parser tests |
| `services/web/src/export/manim.js` | Modify — generator + parser Phase 2 support |
| `services/web/src/components/stage/StageCanvas.vue` | Modify — Konva-level camera preview |
| `services/web/src/App.vue` | Modify — apply `cameraType`/`cameraTrack` from parser result |

---

## Task 1: Create generator test file (all failing)

**Files:**
- Create: `services/web/tests/components/manim-export.test.js`

- [ ] **Step 1: Write the failing tests**

Create `services/web/tests/components/manim-export.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;

function makeObj(id, type = 'circle', extra = {}) {
  return {
    id, type,
    x: SW / 2, y: SH / 2,
    width: 200, height: 200,
    fill: '#ffffff', stroke: 'transparent', strokeWidth: 2,
    opacity: 1, rotation: 0,
    enterTime: 0, duration: 5,
    enterAnim: 'fade_in', exitAnim: 'none',
    ...extra,
  };
}

function makeProject(objects, clips) {
  return {
    name: 'Test',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    objects,
    groups: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips }],
  };
}

// ── Generator tests ──────────────────────────────────────────────────────────

describe('generator — numberplane', () => {
  it('emits NumberPlane with x/y ranges and dimensions', () => {
    const project = makeProject([makeObj('obj1', 'numberplane', {
      xRange: [-6, 6, 1], yRange: [-4, 4, 1], xStep: 1, yStep: 1,
      width: 1200, height: 800,
    })], []);
    const script = generateManimScript(project);
    expect(script).toContain('NumberPlane(x_range=[-6, 6, 1], y_range=[-4, 4, 1]');
  });
});

describe('generator — numberline', () => {
  it('emits NumberLine with x_range and length', () => {
    const project = makeProject([makeObj('obj1', 'numberline', {
      xRange: [-5, 5, 1], width: 1200, height: 100,
    })], []);
    const script = generateManimScript(project);
    expect(script).toContain('NumberLine(x_range=[-5, 5, 1]');
  });
});

describe('generator — axes graphs', () => {
  it('emits plot() for each graph on an axes object', () => {
    const axes = makeObj('ax1', 'axes', {
      xRange: [-5, 5, 1], yRange: [-3, 3, 1],
      graphs: [
        { id: 'g1', expression: 'x**2', color: '#F59E0B', xMin: -3, xMax: 3, strokeWidth: 3 },
      ],
    });
    const project = makeProject([axes], []);
    const script = generateManimScript(project);
    expect(script).toContain('ax1.plot(lambda x: x**2');
    expect(script).toContain('x_range=[-3, 3]');
    expect(script).toContain('"#F59E0B"');
  });

  it('sanitises dangerous expressions', () => {
    const axes = makeObj('ax1', 'axes', {
      xRange: [-5, 5, 1], yRange: [-3, 3, 1],
      graphs: [{ id: 'g1', expression: '__import__("os")', color: '#fff', xMin: -5, xMax: 5, strokeWidth: 2 }],
    });
    const script = generateManimScript(makeProject([axes], []));
    expect(script).toContain('lambda x: x**2'); // fallback expression
    expect(script).not.toContain('__import__');
  });
});

describe('generator — AnimationGroup', () => {
  it('groups two parallel clips into AnimationGroup', () => {
    const project = makeProject(
      [makeObj('obj1'), makeObj('obj2')],
      [
        { id: 'c1', type: 'move', sourceId: 'obj1', startTime: 1, duration: 1, easing: 'linear', parallel: true, lag_ratio: 0, params: { targetX: 400, targetY: SH / 2 } },
        { id: 'c2', type: 'move', sourceId: 'obj2', startTime: 1, duration: 1, easing: 'linear', parallel: true, lag_ratio: 0, params: { targetX: 1500, targetY: SH / 2 } },
      ]
    );
    const script = generateManimScript(project);
    expect(script).toContain('AnimationGroup(');
    // should NOT emit two separate self.play() calls for the same time
    const playCount = (script.match(/self\.play\(/g) || []).length;
    const agCount = (script.match(/AnimationGroup\(/g) || []).length;
    expect(agCount).toBe(1);
    // Both objects should be inside the single AnimationGroup call
    expect(script).toMatch(/AnimationGroup\(.*obj1.*obj2|AnimationGroup\(.*obj2.*obj1/s);
  });

  it('uses LaggedStart when lag_ratio > 0', () => {
    const project = makeProject(
      [makeObj('obj1'), makeObj('obj2')],
      [
        { id: 'c1', type: 'move', sourceId: 'obj1', startTime: 1, duration: 1, easing: 'linear', parallel: true, lag_ratio: 0.3, params: { targetX: 400, targetY: SH / 2 } },
        { id: 'c2', type: 'move', sourceId: 'obj2', startTime: 1, duration: 1, easing: 'linear', parallel: true, lag_ratio: 0.3, params: { targetX: 1500, targetY: SH / 2 } },
      ]
    );
    const script = generateManimScript(project);
    expect(script).toContain('LaggedStart(');
    expect(script).toContain('lag_ratio=0.30');
  });
});

describe('generator — path_move', () => {
  it('emits VMobject + MoveAlongPath for path_move clips', () => {
    const project = makeProject(
      [makeObj('obj1')],
      [{
        id: 'clip1', type: 'path_move', sourceId: 'obj1',
        startTime: 1, duration: 2, easing: 'linear', parallel: false, lag_ratio: 0,
        path: [{ x: 960, y: 540 }, { x: 1200, y: 300 }, { x: 1400, y: 540 }],
      }]
    );
    const script = generateManimScript(project);
    expect(script).toContain('VMobject()');
    expect(script).toContain('set_points_as_corners(');
    expect(script).toContain('MoveAlongPath(');
  });

  it('skips path_move clips with fewer than 2 points', () => {
    const project = makeProject(
      [makeObj('obj1')],
      [{
        id: 'clip1', type: 'path_move', sourceId: 'obj1',
        startTime: 1, duration: 2, easing: 'linear', parallel: false, lag_ratio: 0,
        path: [{ x: 960, y: 540 }],
      }]
    );
    const script = generateManimScript(project);
    expect(script).not.toContain('VMobject()');
    expect(script).not.toContain('MoveAlongPath(');
  });
});

describe('generator — camera', () => {
  it('uses MovingCameraScene when cameraType is moving', () => {
    const project = {
      name: 'Test',
      stage: { width: SW, height: SH, backgroundColor: '#000000' },
      cameraType: 'moving',
      cameraTrack: [],
      objects: [makeObj('obj1')],
      groups: [],
      tracks: [{ id: 't1', name: 'Track 1', clips: [] }],
    };
    const script = generateManimScript(project);
    expect(script).toContain('MovingCameraScene');
  });

  it('emits camera.frame.animate for camera_move clips', () => {
    const project = {
      name: 'Test',
      stage: { width: SW, height: SH, backgroundColor: '#000000' },
      cameraType: 'moving',
      cameraTrack: [{
        id: 'cam1', type: 'camera_move', startTime: 0.5, duration: 1, easing: 'linear',
        params: { targetX: SW / 2, targetY: SH / 2, zoom: 2 },
      }],
      objects: [makeObj('obj1')],
      groups: [],
      tracks: [{ id: 't1', name: 'Track 1', clips: [] }],
    };
    const script = generateManimScript(project);
    expect(script).toContain('self.camera.frame.animate');
    expect(script).toContain('.set_width(');
    expect(script).toContain('7.000'); // 14 / 2
  });
});
```

- [ ] **Step 2: Run tests to verify they all fail**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: All `generator — numberplane/numberline/axes graphs/AnimationGroup/path_move/camera` tests FAIL (no NumberPlane/NumberLine/plot/AnimationGroup/VMobject/MovingCameraScene in output).

- [ ] **Step 3: Commit the failing tests**

```bash
git add services/web/tests/components/manim-export.test.js
git commit -m "test: add failing generator tests for Phase 2 manim.js features"
```

---

## Task 2: Generator — safeMathExpr + numberplane + numberline + axes graphs

**Files:**
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Add `safeMathExpr` helper before `objCode()`**

In `services/web/src/export/manim.js`, insert after the `safeOpacity` function (after line 61):

```js
function safeMathExpr(expr) {
  if (!expr || typeof expr !== 'string') return 'x**2';
  const t = expr.trim();
  if (!t) return 'x**2';
  if (!/^[0-9a-zA-Z()+\-*/.%^, ]*$/.test(t)) return 'x**2';
  if (/import|eval|exec|open|__/.test(t)) return 'x**2';
  return t;
}
```

- [ ] **Step 2: Update the `axes` case in `objCode()` to include graphs**

Replace the existing `axes` case (currently lines 211-215 in `objCode()`):

```js
// BEFORE:
case 'axes': {
  const xr = obj.xRange || [-5, 5, 1];
  const yr = obj.yRange || [-3, 3, 1];
  lines.push(`${n} = Axes(x_range=[${xr[0]}, ${xr[1]}, ${xr[2]}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2]}], x_length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)}, y_length=${(obj.height / sh * FRAME_HEIGHT).toFixed(1)}, tips=True)`);
  break;
}
default:
```

```js
// AFTER:
case 'axes': {
  const xr = obj.xRange || [-5, 5, 1];
  const yr = obj.yRange || [-3, 3, 1];
  lines.push(`${n} = Axes(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2] ?? 1}], x_length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)}, y_length=${(obj.height / sh * FRAME_HEIGHT).toFixed(1)}, tips=True)`);
  if (obj.graphs && obj.graphs.length > 0) {
    for (const g of obj.graphs) {
      const gn = `${n}_graph_${g.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const col = hex(g.color) || '"#F59E0B"';
      const xMin = Number.isFinite(g.xMin) ? g.xMin : xr[0];
      const xMax = Number.isFinite(g.xMax) ? g.xMax : xr[1];
      lines.push(`${gn} = ${n}.plot(lambda x: ${safeMathExpr(g.expression)}, x_range=[${xMin}, ${xMax}], color=${col}, stroke_width=${g.strokeWidth || 3})`);
    }
  }
  break;
}
case 'numberplane': {
  const xr = obj.xRange || [-5, 5, 1];
  const yr = obj.yRange || [-3, 3, 1];
  const xs = obj.xStep || 1;
  const ys = obj.yStep || 1;
  lines.push(`${n} = NumberPlane(x_range=[${xr[0]}, ${xr[1]}, ${xs}], y_range=[${yr[0]}, ${yr[1]}, ${ys}], x_length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)}, y_length=${(obj.height / sh * FRAME_HEIGHT).toFixed(1)})`);
  break;
}
case 'numberline': {
  const xr = obj.xRange || [-5, 5, 1];
  lines.push(`${n} = NumberLine(x_range=[${xr[0]}, ${xr[1]}, ${xr[2] ?? 1}], length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)})`);
  break;
}
default:
```

- [ ] **Step 3: Run the relevant tests**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: `generator — numberplane`, `generator — numberline`, `generator — axes graphs` tests PASS. Others still FAIL.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/export/manim.js
git commit -m "feat(manim.js): add safeMathExpr + numberplane/numberline/axes graphs generator"
```

---

## Task 3: Generator — AnimationGroup/LaggedStart + path_move

**Files:**
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Replace the sequential clip loop with grouping algorithm**

In `generateManimScript()`, find the section that starts with `// ── Collect clips ──` (around line 303). Replace from there through the end of the clip animation section (the `for (const c of clips)` loop) with:

```js
  // ── Collect clips ──
  const clips = [];
  for (const t of project.tracks) for (const c of t.clips) clips.push(c);
  clips.sort((a, b) => a.startTime - b.startTime);

  // ── Group parallel clips ──
  const clipGroups = [];
  let gi = 0;
  while (gi < clips.length) {
    const c = clips[gi];
    if (c.parallel) {
      const group = [c];
      let j = gi + 1;
      while (j < clips.length && clips[j].parallel && Math.abs(clips[j].startTime - c.startTime) < 0.01) {
        group.push(clips[j]);
        j++;
      }
      clipGroups.push({ type: 'group', clips: group, startTime: c.startTime });
      gi = j;
    } else {
      clipGroups.push({ type: 'single', clip: c, startTime: c.startTime });
      gi++;
    }
  }

  // ── Build clip animation steps ──
  function singleClipCode(c) {
    const sn = v(c.sourceId);
    const dur = c.duration;
    const rtStr = rtOpt(dur);
    const rfStr = rfOpt(c.easing);
    switch (c.type) {
      case 'transform': {
        const tn = v(c.targetId);
        const srcObj = oMap[c.sourceId], tgtObj = oMap[c.targetId];
        const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
        const anim = hasRaster ? 'FadeTransform' : 'ReplacementTransform';
        return { code: `self.play(${anim}(${sn}, ${tn})${rtStr}${rfStr})`, dur };
      }
      case 'move': {
        const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
        return { code: `self.play(${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])${rtStr}${rfStr})`, dur };
      }
      case 'scale':
        return { code: `self.play(${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})${rtStr}${rfStr})`, dur };
      case 'fade': {
        const op = c.params?.targetOpacity ?? 0;
        return { code: op < 0.01 ? `self.play(FadeOut(${sn})${rtStr}${rfStr})` : `self.play(${sn}.animate.set_opacity(${op.toFixed(2)})${rtStr}${rfStr})`, dur };
      }
      case 'rotate': {
        const ang = ((c.params?.targetRotation || 360) - (oMap[c.sourceId]?.rotation || 0)) * Math.PI / 180;
        return { code: `self.play(Rotate(${sn}, angle=${ang.toFixed(2)})${rtStr}${rfStr})`, dur };
      }
      case 'path_move': {
        if (!c.path || c.path.length < 2) return null;
        const cn = (c.id || sn).replace(/[^a-zA-Z0-9_]/g, '_');
        const pn = `path_${cn}`;
        const pts = c.path.map(p => {
          const m = stageToManim(p.x, p.y, sw, sh);
          return `[${m.x.toFixed(3)}, ${m.y.toFixed(3)}, 0]`;
        });
        const multiLine = [
          `${pn} = VMobject()`,
          `${pn}.set_points_as_corners([np.array(p) for p in [${pts.join(', ')}]])`,
          `self.play(MoveAlongPath(${sn}, ${pn})${rtStr}${rfStr})`,
        ].join(`\n${indent}`);
        return { code: multiLine, dur };
      }
      default: return null;
    }
  }

  function animExpr(c) {
    const sn = v(c.sourceId);
    switch (c.type) {
      case 'move': {
        const mp = stageToManim(c.params?.targetX || 0, c.params?.targetY || 0, sw, sh);
        return `${sn}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])`;
      }
      case 'scale':
        return `${sn}.animate.scale(${(c.params?.targetScaleX || 1).toFixed(2)})`;
      case 'fade': {
        const op = c.params?.targetOpacity ?? 0;
        return op < 0.01 ? `FadeOut(${sn})` : `${sn}.animate.set_opacity(${op.toFixed(2)})`;
      }
      case 'rotate': {
        const ang = ((c.params?.targetRotation || 360) - (oMap[c.sourceId]?.rotation || 0)) * Math.PI / 180;
        return `Rotate(${sn}, angle=${ang.toFixed(2)})`;
      }
      case 'transform': {
        const tn = v(c.targetId);
        const srcObj = oMap[c.sourceId], tgtObj = oMap[c.targetId];
        const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
        return hasRaster ? `FadeTransform(${sn}, ${tn})` : `ReplacementTransform(${sn}, ${tn})`;
      }
      default: return null;
    }
  }

  for (const cg of clipGroups) {
    if (cg.type === 'single') {
      const result = singleClipCode(cg.clip);
      if (result) steps.push({ time: cg.clip.startTime, order: 1, ...result });
    } else if (cg.clips.length === 1) {
      const result = singleClipCode(cg.clips[0]);
      if (result) steps.push({ time: cg.startTime, order: 1, ...result });
    } else {
      const groupClips = cg.clips;
      const dur = Math.max(...groupClips.map(c => c.duration));
      const rtStr = rtOpt(dur);
      const maxLag = Math.max(...groupClips.map(c => c.lag_ratio || 0));
      const exprs = groupClips.map(animExpr).filter(Boolean);
      if (exprs.length > 0) {
        const groupFn = maxLag > 0 ? 'LaggedStart' : 'AnimationGroup';
        const lagStr = maxLag > 0 ? `, lag_ratio=${maxLag.toFixed(2)}` : '';
        const rfStr = rfOpt(groupClips[0]?.easing || 'ease_in_out');
        steps.push({ time: cg.startTime, order: 1, code: `self.play(${groupFn}(${exprs.join(', ')}${lagStr})${rtStr}${rfStr})`, dur });
      }
    }
  }
```

- [ ] **Step 2: Run tests**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: `generator — AnimationGroup` and `generator — path_move` tests PASS.

- [ ] **Step 3: Run full unit test suite to check for regressions**

```
cd services/web && npm run test:unit
```

Expected: All 29 unit tests pass.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/export/manim.js
git commit -m "feat(manim.js): add AnimationGroup/LaggedStart grouping + path_move generator"
```

---

## Task 4: Generator — camera track + MovingCameraScene

**Files:**
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Add MovingCameraScene detection**

In `generateManimScript()`, find the line:
```js
L.push('class MainScene(Scene):');
```

Replace with:
```js
const sceneBase = project.cameraType === 'moving' ? 'MovingCameraScene' : 'Scene';
L.push(`class MainScene(${sceneBase}):`);
```

- [ ] **Step 2: Add camera track step generation**

After the `for (const cg of clipGroups)` loop (but before the exit animations section), add:

```js
  // ── Camera clips ──
  if (project.cameraType === 'moving' && Array.isArray(project.cameraTrack) && project.cameraTrack.length > 0) {
    for (const camClip of project.cameraTrack) {
      const dur = camClip.duration;
      const rtStr = rtOpt(dur);
      const rfStr = rfOpt(camClip.easing);
      const mp = stageToManim(
        camClip.params?.targetX || 0,
        camClip.params?.targetY || 0,
        sw, sh
      );
      const zoom = parseFloat((camClip.params?.zoom || 1).toFixed(4));
      const frameWidth = (14 / zoom).toFixed(3);
      steps.push({
        time: camClip.startTime,
        order: 1,
        code: `self.play(self.camera.frame.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0]).set_width(${frameWidth})${rtStr}${rfStr})`,
        dur,
      });
    }
  }
```

- [ ] **Step 3: Run tests**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: `generator — camera` tests PASS. All generator tests green.

- [ ] **Step 4: Run full unit test suite**

```
cd services/web && npm run test:unit
```

Expected: All 29 unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/export/manim.js
git commit -m "feat(manim.js): add MovingCameraScene + camera_move generator"
```

---

## Task 5: Add parser tests (all failing)

**Files:**
- Modify: `services/web/tests/components/manim-export.test.js`

- [ ] **Step 1: Add parser tests to the test file**

Append to `services/web/tests/components/manim-export.test.js`:

```js
import { parseManimScript } from '../../src/export/manim.js';

// ── Parser tests ─────────────────────────────────────────────────────────────

describe('parser — NumberPlane', () => {
  it('parses NumberPlane into numberplane object', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = NumberPlane(x_range=[-6, 6, 1], y_range=[-4, 4, 1], x_length=8.7, y_length=5.9)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].type).toBe('numberplane');
    expect(result.objects[0].xRange).toEqual([-6, 6, 1]);
    expect(result.objects[0].yRange).toEqual([-4, 4, 1]);
  });
});

describe('parser — NumberLine', () => {
  it('parses NumberLine into numberline object', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = NumberLine(x_range=[-5, 5, 1], length=8.7)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].type).toBe('numberline');
    expect(result.objects[0].xRange[0]).toBe(-5);
  });
});

describe('parser — axes graphs', () => {
  it('parses axes.plot() into graphs[] on the axes object', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        ax1 = Axes(x_range=[-5, 5, 1], y_range=[-3, 3, 1], x_length=5.8, y_length=4.4, tips=True)
        ax1.move_to([0.000, 0.000, 0])
        ax1_graph_g1 = ax1.plot(lambda x: x**2, x_range=[-3, 3], color="#F59E0B", stroke_width=3)
        self.play(FadeIn(ax1))
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.objects[0].graphs).toHaveLength(1);
    expect(result.objects[0].graphs[0].expression).toBe('x**2');
    expect(result.objects[0].graphs[0].color).toBe('#F59E0B');
    expect(result.objects[0].graphs[0].xMin).toBe(-3);
    expect(result.objects[0].graphs[0].xMax).toBe(3);
  });
});

describe('parser — MoveAlongPath', () => {
  it('parses VMobject + MoveAlongPath into path_move clip', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        path_clip1 = VMobject()
        path_clip1.set_points_as_corners([np.array(p) for p in [[-3.556, 0.000, 0], [1.333, 1.333, 0], [3.111, 0.000, 0]]])
        self.play(MoveAlongPath(obj_1, path_clip1), run_time=2.0)
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    const clips = result.tracks[0]?.clips || [];
    const pathClip = clips.find(c => c.type === 'path_move');
    expect(pathClip).toBeTruthy();
    expect(pathClip.path).toHaveLength(3);
    expect(pathClip.duration).toBe(2);
  });
});

describe('parser — AnimationGroup', () => {
  it('parses AnimationGroup into parallel clips', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([-3.556, 0.000, 0])
        obj_2 = Square(side_length=1.000)
        obj_2.move_to([3.556, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.play(FadeIn(obj_2))
        self.play(AnimationGroup(obj_1.animate.move_to([-5.000, 0.000, 0]), obj_2.animate.move_to([5.000, 0.000, 0])), run_time=1.0)
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    const clips = result.tracks[0]?.clips || [];
    const parallelClips = clips.filter(c => c.parallel === true);
    expect(parallelClips.length).toBeGreaterThanOrEqual(2);
    expect(parallelClips.every(c => c.startTime === parallelClips[0].startTime)).toBe(true);
  });

  it('parses LaggedStart with lag_ratio', () => {
    const py = `\
from manim import *
class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([-3.556, 0.000, 0])
        obj_2 = Square(side_length=1.000)
        obj_2.move_to([3.556, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.play(FadeIn(obj_2))
        self.play(LaggedStart(obj_1.animate.move_to([-5.000, 0.000, 0]), obj_2.animate.move_to([5.000, 0.000, 0]), lag_ratio=0.30), run_time=1.0)
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    const clips = result.tracks[0]?.clips || [];
    const parallelClips = clips.filter(c => c.parallel === true);
    expect(parallelClips.length).toBeGreaterThanOrEqual(2);
    expect(parallelClips[0].lag_ratio).toBeCloseTo(0.30);
  });
});

describe('parser — camera', () => {
  it('detects MovingCameraScene and sets cameraType', () => {
    const py = `\
from manim import *
class MainScene(MovingCameraScene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.cameraType).toBe('moving');
  });

  it('parses camera.frame.animate into cameraTrack', () => {
    const py = `\
from manim import *
class MainScene(MovingCameraScene):
    def construct(self):
        self.camera.background_color = "#000000"
        obj_1 = Circle(radius=0.500)
        obj_1.move_to([0.000, 0.000, 0])
        self.play(FadeIn(obj_1))
        self.play(self.camera.frame.animate.move_to([0.00, 0.00, 0]).set_width(7.000), run_time=1.0)
        self.wait(1)`;
    const result = parseManimScript(py, SW, SH);
    expect(result.cameraTrack).toHaveLength(1);
    expect(result.cameraTrack[0].type).toBe('camera_move');
    expect(result.cameraTrack[0].params.zoom).toBeCloseTo(2); // 14/7 = 2
  });
});
```

- [ ] **Step 2: Run parser tests to confirm they all fail**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: All `parser — *` tests FAIL. Generator tests still pass.

- [ ] **Step 3: Commit**

```bash
git add services/web/tests/components/manim-export.test.js
git commit -m "test: add failing parser tests for Phase 2 manim.js features"
```

---

## Task 6: Parser — NumberPlane, NumberLine, axes.plot

**Files:**
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Add NumberPlane, NumberLine, axes.plot regex in `parseManimScript()`**

In `parseManimScript()`, find the `// Axes` section (around line 643 in the original file). After the existing Axes block, add:

```js
    // NumberPlane
    m = line.match(/^(\w+)\s*=\s*NumberPlane\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\],\s*y_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
    if (m) {
      const [, name, x0, x1, xs, y0, y1, ys] = m;
      const id = uid('obj');
      const obj = { id, type: 'numberplane', name, x: sw / 2, y: sh / 2, width: 400, height: 300, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)], yRange: [parseFloat(y0), parseFloat(y1), parseFloat(ys)], xStep: parseFloat(xs), yStep: parseFloat(ys), enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // NumberLine
    m = line.match(/^(\w+)\s*=\s*NumberLine\(x_range=\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
    if (m) {
      const [, name, x0, x1, xs] = m;
      const id = uid('obj');
      const obj = { id, type: 'numberline', name, x: sw / 2, y: sh / 2, width: 400, height: 60, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, opacity: 1, rotation: 0, xRange: [parseFloat(x0), parseFloat(x1), parseFloat(xs)], enterTime: 0, duration: 10, enterAnim: 'fade_in', exitAnim: 'none', zOrder: objects.length };
      objects.push(obj); varMap[name] = id; objById[id] = obj;
      continue;
    }

    // axes.plot() — adds a graph to the most recently referenced axes object
    m = line.match(/^(\w+)\s*=\s*(\w+)\.plot\(lambda x:\s*([^,]+),\s*x_range=\[([-\d.]+),\s*([-\d.]+)\](?:,\s*color=["']([^"']+)["'])?(?:,\s*stroke_width=([\d.]+))?\)/);
    if (m) {
      const [, graphVar, axesVar, expr, xMin, xMax, color, sw2] = m;
      const axesId = varMap[axesVar];
      if (axesId && objById[axesId] && objById[axesId].type === 'axes') {
        if (!objById[axesId].graphs) objById[axesId].graphs = [];
        objById[axesId].graphs.push({
          id: uid('graph').split('_').slice(-2).join('_'),
          expression: expr.trim(),
          color: color || '#F59E0B',
          xMin: parseFloat(xMin),
          xMax: parseFloat(xMax),
          strokeWidth: sw2 ? parseFloat(sw2) : 3,
        });
      }
      continue;
    }
```

- [ ] **Step 2: Run tests**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: `parser — NumberPlane`, `parser — NumberLine`, `parser — axes graphs` PASS.

- [ ] **Step 3: Run full suite**

```
cd services/web && npm run test:unit
```

Expected: All existing 29 unit tests still pass.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/export/manim.js
git commit -m "feat(manim.js): add NumberPlane/NumberLine/axes.plot parser support"
```

---

## Task 7: Parser — VMobject + MoveAlongPath

**Files:**
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Add stateful VMobject/MoveAlongPath parsing**

In `parseManimScript()`, add a `pendingPaths` map before the `for (const line of lines)` loop:

```js
  const pendingPaths = {};  // varName → [Manim coord arrays]
```

Inside the loop, add these blocks after the existing animation sections:

```js
    // VMobject() — start of a path definition
    m = line.match(/^(\w+)\s*=\s*VMobject\(\)/);
    if (m) {
      pendingPaths[m[1]] = [];
      continue;
    }

    // set_points_as_corners — parse Manim coordinate list into path
    m = line.match(/^(\w+)\.set_points_as_corners\(\[np\.array\(p\) for p in \[(.+)\]\]\)/);
    if (m) {
      const [, pathVar, pointsStr] = m;
      if (pendingPaths[pathVar] !== undefined) {
        const pointMatches = [...pointsStr.matchAll(/\[([-\d.]+),\s*([-\d.]+),\s*0\]/g)];
        pendingPaths[pathVar] = pointMatches.map(pm => ({
          mx: parseFloat(pm[1]),
          my: parseFloat(pm[2]),
        }));
      }
      continue;
    }

    // MoveAlongPath — create path_move clip from pending path
    m = line.match(/^self\.play\(MoveAlongPath\((\w+),\s*(\w+)\)(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=([^\s)]+))?\)/);
    if (m) {
      const [, objVar, pathVar, rtStr, rfStr] = m;
      const objId = varMap[objVar];
      const pathPoints = pendingPaths[pathVar];
      if (objId && pathPoints && pathPoints.length >= 2) {
        const dur = parseFloat(rtStr || 1);
        const easing = rfStr ? (EASING_REV[rfStr] || 'linear') : 'linear';
        const path = pathPoints.map(p => {
          const sp = manimToStage(p.mx, p.my, sw, sh);
          return { x: Math.round(sp.x), y: Math.round(sp.y) };
        });
        clips.push({ id: `clip_${clipIdx++}`, type: 'path_move', sourceId: objId, startTime: ct, duration: dur, easing, parallel: false, lag_ratio: 0, path });
        ct += dur;
      }
      delete pendingPaths[pathVar];
      continue;
    }
```

- [ ] **Step 2: Run tests**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: `parser — MoveAlongPath` PASS.

- [ ] **Step 3: Commit**

```bash
git add services/web/src/export/manim.js
git commit -m "feat(manim.js): add VMobject/MoveAlongPath parser (two-pass stateful)"
```

---

## Task 8: Parser — AnimationGroup / LaggedStart

**Files:**
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Add a helper to parse inner animation expressions**

In `parseManimScript()`, define a helper function before the `for (const line of lines)` loop:

```js
  function parseAnimExpr(expr, sw, sh) {
    expr = expr.trim();
    let m;
    // obj.animate.move_to([x, y, 0])
    m = expr.match(/^(\w+)\.animate\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*0\]\)/);
    if (m) {
      const id = varMap[m[1]];
      if (!id) return null;
      const sp = manimToStage(parseFloat(m[2]), parseFloat(m[3]), sw, sh);
      return { type: 'move', sourceId: id, params: { targetX: Math.round(sp.x), targetY: Math.round(sp.y) } };
    }
    // obj.animate.scale(s)
    m = expr.match(/^(\w+)\.animate\.scale\(([\d.]+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (!id) return null;
      return { type: 'scale', sourceId: id, params: { targetScaleX: parseFloat(m[2]), targetScaleY: parseFloat(m[2]) } };
    }
    // obj.animate.set_opacity(o)
    m = expr.match(/^(\w+)\.animate\.set_opacity\(([\d.]+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (!id) return null;
      return { type: 'fade', sourceId: id, params: { targetOpacity: parseFloat(m[2]) } };
    }
    // FadeOut(obj)
    m = expr.match(/^FadeOut\((\w+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (!id) return null;
      return { type: 'fade', sourceId: id, params: { targetOpacity: 0 } };
    }
    // Rotate(obj, angle=a)
    m = expr.match(/^Rotate\((\w+),\s*angle=([-\d.]+)\)/);
    if (m) {
      const id = varMap[m[1]];
      if (!id) return null;
      return { type: 'rotate', sourceId: id, params: { targetRotation: Math.round(parseFloat(m[2]) * 180 / Math.PI) } };
    }
    return null;
  }
```

- [ ] **Step 2: Add AnimationGroup/LaggedStart parsing inside the loop**

Inside the `for (const line of lines)` loop, before the `self.wait` match, add:

```js
    // AnimationGroup / LaggedStart
    m = line.match(/^self\.play\((AnimationGroup|LaggedStart)\((.+)\)(?:,\s*lag_ratio=([\d.]+))?(?:,\s*run_time=([\d.]+))?(?:,\s*rate_func=[^\s)]+)?\)/);
    if (m) {
      const [, fn, , lagStr, rtStr] = m;
      const dur = parseFloat(rtStr || 1);
      const lagRatio = parseFloat(lagStr || 0);

      // Extract inner content by bracket matching
      const fnStart = line.indexOf(fn + '(') + fn.length + 1;
      let depth = 1, end = fnStart;
      while (end < line.length && depth > 0) {
        if (line[end] === '(' || line[end] === '[') depth++;
        else if (line[end] === ')' || line[end] === ']') depth--;
        end++;
      }
      const inner = line.substring(fnStart, end - 1);

      // Split inner by ',' respecting bracket depth
      const exprs = [];
      let cur = '', d = 0;
      for (const ch of inner) {
        if (ch === '(' || ch === '[') d++;
        else if (ch === ')' || ch === ']') d--;
        if (ch === ',' && d === 0) {
          const t = cur.trim();
          if (t && !/^(lag_ratio|run_time|rate_func)/.test(t)) exprs.push(t);
          cur = '';
        } else { cur += ch; }
      }
      if (cur.trim()) exprs.push(cur.trim());

      const parsedClips = exprs.map(e => parseAnimExpr(e, sw, sh)).filter(Boolean);
      for (const pc of parsedClips) {
        clips.push({ id: `clip_${clipIdx++}`, type: pc.type, sourceId: pc.sourceId, startTime: ct, duration: dur, easing: 'ease_in_out', parallel: true, lag_ratio: lagRatio, params: pc.params });
      }
      if (parsedClips.length > 0) ct += dur;
      continue;
    }
```

- [ ] **Step 3: Run tests**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: `parser — AnimationGroup` tests PASS.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/export/manim.js
git commit -m "feat(manim.js): add AnimationGroup/LaggedStart parser"
```

---

## Task 9: Parser — MovingCameraScene + camera.frame.animate + App.vue

**Files:**
- Modify: `services/web/src/export/manim.js`
- Modify: `services/web/src/App.vue`

- [ ] **Step 1: Add cameraType and cameraTrack state in `parseManimScript()`**

At the top of `parseManimScript()`, after the existing `let bgColor = '#000000';` line, add:

```js
  let cameraType = 'static';
  const cameraTrack = [];
```

- [ ] **Step 2: Add MovingCameraScene detection in the parse loop**

Inside the loop, near the top (before the `// Background` match), add:

```js
    // MovingCameraScene
    m = line.match(/^class\s+\w+\(MovingCameraScene\)/);
    if (m) { cameraType = 'moving'; continue; }
```

- [ ] **Step 3: Add camera.frame.animate parsing in the loop**

Inside the loop, add:

```js
    // self.camera.frame.animate.move_to([x,y,0]).set_width(w)
    m = line.match(/^self\.play\(self\.camera\.frame\.animate\.move_to\(\[([-\d.]+),\s*([-\d.]+),\s*0\]\)\.set_width\(([\d.]+)\)(?:,\s*run_time=([\d.]+))?/);
    if (m) {
      const [, mx, my, fw, rtStr] = m;
      const dur = parseFloat(rtStr || 1);
      const sp = manimToStage(parseFloat(mx), parseFloat(my), sw, sh);
      const zoom = parseFloat((14 / parseFloat(fw)).toFixed(4));
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
```

- [ ] **Step 4: Include cameraType and cameraTrack in the return value**

Find the `return { objects, tracks, stage }` at the bottom of `parseManimScript()`. Replace with:

```js
  return {
    objects,
    tracks: clips.length > 0 ? [{ id: 'track_parsed', name: 'Track 1', clips }] : [],
    stage: { backgroundColor: bgColor, width: sw, height: sh },
    cameraType,
    cameraTrack,
  };
```

- [ ] **Step 5: Update `applyCodeToCanvas()` in `App.vue` to apply camera fields**

In `services/web/src/App.vue`, find `applyCodeToCanvas()` (around line 583). After `store.project.tracks = result.tracks;`, add:

```js
        if (result.cameraType) actions.setCameraType(result.cameraType);
        if (Array.isArray(result.cameraTrack) && result.cameraTrack.length > 0) {
          store.project.cameraTrack = result.cameraTrack;
        }
```

- [ ] **Step 6: Run tests**

```
cd services/web && npm run test:unit -- --reporter=verbose tests/components/manim-export.test.js
```

Expected: All `parser — camera` tests PASS. All 11 parser tests green.

- [ ] **Step 7: Run full unit suite**

```
cd services/web && npm run test:unit
```

Expected: All 29 unit tests pass.

- [ ] **Step 8: Commit**

```bash
git add services/web/src/export/manim.js services/web/src/App.vue
git commit -m "feat(manim.js): add MovingCameraScene + camera.frame.animate parser; update App.vue"
```

---

## Task 10: Camera preview fix in StageCanvas.vue

**Files:**
- Modify: `services/web/src/components/stage/StageCanvas.vue`

- [ ] **Step 1: Remove `:style="cameraStyle"` from the template**

In `services/web/src/components/stage/StageCanvas.vue`, find line ~9:
```html
<div ref="container" class="flex-1 rounded-xl overflow-hidden relative" style="min-height: 0; background: var(--studio-surface2);" :style="cameraStyle">
```

Replace with:
```html
<div ref="container" class="flex-1 rounded-xl overflow-hidden relative" style="min-height: 0; background: var(--studio-surface2);">
```

- [ ] **Step 2: Replace `cameraStyle`, `vs`, `ox`, `oy` computed properties**

Find the block containing `cameraStyle()`, `vs()`, `ox()`, `oy()` in the `computed:` section (around lines 190–215). Replace the entire block:

```js
    // REMOVE cameraStyle() entirely.

    vs() {
      const sx = this.containerWidth / this.stg.width;
      const sy = this.containerHeight / this.stg.height;
      const base = Math.min(sx, sy, 1) * 0.92 * this.zoomLevel;
      const cs = store.frameState.cameraState;
      return cs?.zoom ? base * cs.zoom : base;
    },
    ox() {
      const cs = store.frameState.cameraState;
      const camX = cs ? cs.x : this.stg.width / 2;
      return this.containerWidth / 2 - camX * this.vs + this.panOffset.x;
    },
    oy() {
      const cs = store.frameState.cameraState;
      const camY = cs ? cs.y : this.stg.height / 2;
      return this.containerHeight / 2 - camY * this.vs + this.panOffset.y;
    },
```

(Delete the old `cameraStyle()` computed entirely — it is no longer referenced.)

- [ ] **Step 3: Verify no other references to `cameraStyle`**

```
cd services/web && grep -r "cameraStyle" src/
```

Expected: No output (all references removed).

- [ ] **Step 4: Run full unit test suite**

```
cd services/web && npm run test:unit
```

Expected: All 29 unit tests pass.

- [ ] **Step 5: Run engine tests**

```
cd services/web && npm test
```

Expected: All 89 engine tests pass.

- [ ] **Step 6: Commit**

```bash
git add services/web/src/components/stage/StageCanvas.vue
git commit -m "fix(StageCanvas): replace CSS camera transform with Konva-level vs/ox/oy"
```

---

## Verification

After all tasks complete:

```
cd services/web && npm run test:unit && npm test
```

Expected: 29 unit tests + 89 engine tests all pass.

**Manual check:** Open the editor with a `moving` camera project. During playback, the stage canvas should pan/zoom in sync with the timeline position — no CSS-level jitter or offset mismatch.
