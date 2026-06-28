# Wave 2 — Four Parallel Tracks Design

**Date:** 2026-06-11
**Status:** Approved (brainstorming session)
**Execution model:** one orchestrator session dispatches 4 worktree-isolated subagents in parallel; sequential integration into `main`.

## Goal

Close the remaining highest-value gaps from the Wave 2 backlog in a single wave of four independent tracks, sized to match Wave 1 rhythm with minimal file overlap.

## Background

Wave 1 (showcase, export formats, code/bar_chart, UX pack) and the follow-up PNG Frames + WebM α export are fully merged. Tests: 714 unit + 114 engine + 55 api + 12 codegen. The following items remain open from the Wave 2 backlog:

- No inline text editing (double-click on canvas)
- No numeric scrubbing or recent colors in the inspector
- No right-click context menu on timeline clips, no scene sections
- No canvas rulers/guides, no smart snapping
- Easing map has lossy mappings (spring→smooth etc.), missing elastic/back/bounce families
- No render history UI
- E2E coverage still at 9 smoke tests

## Scope

Four tracks, **wave-2-core** scope. Each track is one branch, one subagent, one implementation plan.

---

## Track A — Editor Polish (`feat/wave2-editor-polish`)

### Inline text editing

Double-clicking a `text` or `latex` object on canvas activates `editingTextId` state in `useStageInteractions.ts`. `StageCanvas.vue` renders a `<textarea>` overlay positioned over the object using CSS `transform` computed from current zoom (`vs`) and pan (`ox/oy`). On blur, `store.updateObject` is called and the overlay closes. For `latex` objects the preview does not update instantly (render required) but the textarea accepts MathTeX syntax. 2D mode only.

Files: `useStageInteractions.ts`, `StageCanvas.vue` (overlay template + editingTextId wiring).

### Numeric scrubbing

`ui/Num.vue` gains `mousedown` + document-level `mousemove` + `mouseup` listeners. Horizontal drag delta increments/decrements the value (100px = 1 unit; Shift ×10). Visual: cursor changes to `ew-resize` during drag; label highlights yellow while active. No new store actions required.

Files: `services/web/src/components/inspector/ui/Num.vue`.

### Recent colors

`store.project.recentColors: string[]` (max 8) — updated on every color change via a new `addRecentColor(hex)` action; persisted to localStorage under `manim-motion-recent-colors` (separate key, not the autosave payload). All `ColorRow.vue` instances render a mini palette row below the current color picker. Clicking a swatch calls the existing update path.

Files: `store/project.ts`, `services/web/src/components/inspector/ui/ColorRow.vue`.

---

## Track B — Timeline & Structure (`feat/wave2-timeline-structure`)

### Timeline clip context menu

Right-click on any clip bar in `Timeline.vue` opens a context menu (reuses `ContextMenu.vue` from Wave 1 with a different `items` prop). Options:

- **Kes / Kopyala / Yapıştır / Çoğalt / Sil** — delegate to existing store actions (`cutSelection`, `copySelection`, `pasteClipboard`, `duplicateSelection`, `deleteSelection`)
- **Böl** — new `splitClip(clipId, time)` store action: splits the clip at `store.currentTime` into two clips with proportional durations; both inherit the original's easing.

Files: `Timeline.vue`, `store/project.ts` (`splitClip`), `ContextMenu.vue` (items prop extension).

### Scene sections

New concept: logical chapter markers within a project.

**Store:** `store.project.sections: Array<{ id: string, time: number, title: string }>` (sorted by time). Actions: `addSection(time, title)`, `removeSection(id)`, `updateSection(id, patch)` — all call `commitState()`.

**Timeline UI:** Section markers render as vertical lines + title labels in the timeline ruler row. Draggable (updates `time`); clicking the label opens an inline title editor. "Add section" button in the timeline toolbar or right-click on empty ruler area.

**Codegen:** `generateScene` emits `self.next_section("Title")` immediately before the first animation whose `startTime ≥ section.time`. Sections are sorted before insertion. Hidden sections (time beyond scene duration) are skipped.

**Known limitation:** `.py` parser does not round-trip `next_section` calls back to store sections (Wave 3 backlog).

Files: `store/project.ts`, `Timeline.vue`, `packages/manim-codegen/src/index.ts`, `packages/manim-codegen/src/types.ts`.

---

## Track C — Precision Layout (`feat/wave2-precision-layout`)

### Rulers

Horizontal (top) and vertical (left) ruler bars are added as fixed-position HTML overlays in `StageCanvas.vue` (not Konva layers — plain `<canvas>` elements drawn from JS). They react to `vs` (zoom) and `ox/oy` (pan) changes. Tick intervals auto-scale with zoom (10 px, 50 px, 100 px etc. in project-pixel space). Labels show project-pixel values. A new `useStageRulers.ts` composable owns the drawing logic; `StageCanvas.vue` calls it with the viewport state.

Files: `useStageRulers.ts` (new), `StageCanvas.vue` (overlay mount + refs).

### Guides

Dragging from a ruler bar onto the canvas creates a guide line. `store.project.guides: Array<{ id: string, axis: 'h' | 'v', pos: number }>` — undo/redo scoped. Guides render as Konva `Line` objects in a dedicated non-interactive layer (not exported to render). Dragging an existing guide repositions it; dragging it back onto the ruler (or off-canvas) deletes it. Actions: `addGuide`, `removeGuide`, `moveGuide`.

Files: `store/project.ts`, `StageCanvas.vue` (guide layer), `useStageRulers.ts` (drag detection from ruler).

### Smart snapping

During object drag/resize in `useStageInteractions.ts`, a `snapPoint(x, y, candidates, threshold=8) → {x, y, snappedX, snappedY}` pure helper (exported, unit-tested without Konva) computes the nearest snap target within threshold pixels. Snap candidates:

1. Guide positions
2. Bounding box edges and centers of all other visible objects

When a snap fires, a temporary indicator line (Konva `Line`, dashed, color-coded) is shown on the snap layer for the duration of the drag. **Grid snapping deferred to Wave 3.** **3D split viewport: snapping disabled.**

Files: `useStageInteractions.ts`, new `engine/snap.ts` (pure helper), `StageCanvas.vue` (snap indicator layer).

---

## Track D — Quality & Robustness (`feat/wave2-quality`)

### Easing map expansion

`@manim/codegen/constants.ts` `EASING_MAP` and `engine/easing.ts` preview functions are updated in sync (parity invariant). Changes:

- Fix lossy mappings: `spring → smooth` corrected to the closest CE easing; audit all existing entries.
- Add new families: `elastic_in`, `elastic_out`, `elastic_in_out`, `back_in`, `back_out`, `back_in_out`, `bounce_out` — only entries that have a true Manim CE `rate_func` counterpart.
- Easing picker UI in `KeyframeEasingPopup.vue` and clip inspector gains entries for new easings.
- Existing easing parity tests extended to cover new entries.

Files: `packages/manim-codegen/src/constants.ts`, `services/web/src/engine/easing.ts`, `KeyframeEasingPopup.vue`, tests.

### Render history

Renderer writes `latest.<ext>` as before (no behavior change). Additionally, after writing `latest`, it rotates `render_1` … `render_5` (index 1 = newest): `render_1` is renamed to `render_2`, `render_2` → `render_3`, … `render_5` deleted, then `latest` copied to `render_1`. Legacy timestamped render copies are pruned during rotation so old pre-rotation files do not accumulate. PNG frames (ZIP) follow the same numbered history flow.

New API endpoint: `GET /api/render/:projectId/history` → `[{ index, ext, size, mtime, url }]` (lists existing `render_1` … `render_5` for the project). `renders.ts` gains a `listHistory` helper.

`App.vue` render-completed dialog gains a collapsible "Önceki Render'lar" section listing history items with download links.

Files: `services/renderer/worker.py`, `services/api/src/routes/renders.ts`, `App.vue`.

### E2E expansion

Existing 9 smoke tests in `e2e/` are extended with 8 new scenarios using the `window.__projectStore` hook:

1. Template load → verify objects on canvas
2. Add keyframe → scrub timeline → verify interpolated position
3. Select GIF format → start render → verify `.gif` download link
4. Right-click object → duplicate → verify second object exists
5. Autosave: reload page → restore prompt → verify state restored
6. Timeline: add section marker → verify title renders in timeline
7. Lock object → attempt drag → verify no position change
8. Render history: complete render → re-render → verify history list has 2 entries

Files: `e2e/tests/*.spec.ts` (new test files).

---

## Execution architecture

```
Orchestrator (main session)
 ├─ this spec + 4 implementation plans (one per track)   → USER CHECKPOINT
 ├─ dispatch 4 general-purpose subagents
 │    isolation: worktree · run_in_background · own branch · TDD · small commits
 ├─ integration order (ascending conflict risk): A → B → C → D
 │    per merge: rebase branch on current main → FULL GATE → merge → short user report
 └─ final report + Wave 3 backlog
```

- **Merge gate (mandatory per track):** `npm run test:unit`, engine `npm test`, api tests, codegen tests, `npm run lint`, `npm run typecheck`, `npm run format:check`.
- **Conflict surface:**
  - `store/project.ts`: A (recentColors), B (sections/splitClip), C (guides). Different state regions; B and C merge after A.
  - `StageCanvas.vue`: A (textarea overlay), C (ruler overlay + snap layer). Different template regions; C merges after A.
  - `packages/manim-codegen/src/`: B (`index.ts`), D (`constants.ts`). Disjoint files.
  - `App.vue`: D (render history in completed dialog). Only D touches it.
- **Failure handling:** if a subagent stalls, its worktree is preserved; orchestrator takes over or redispatches; other tracks unaffected.

## Testing strategy

TDD inside every track. Track A: `Num.vue` scrub unit test, `ColorRow.vue` recent-colors test, inline-text overlay positioning test. Track B: `splitClip` store action test, section codegen output test, ContextMenu clip items test. Track C: `snapPoint` geometry unit tests (no Konva), guide store action tests. Track D: easing parity tests extended, render history API test, E2E new scenarios.

## Risks

| Risk | Mitigation |
|---|---|
| `StageCanvas.vue` conflict (A ↔ C) | A adds overlay at bottom of template; C adds ruler divs at top — different regions. C merges after A; orchestrator resolves any rebase conflict. |
| `store/project.ts` conflict (A ↔ B ↔ C) | Three separate state slices; merge order A→B→C minimizes diff size at each step. |
| Inline text overlay positioning at extreme zoom | Tested at min/max zoom in unit test; CSS transform math is straightforward. |
| `next_section` codegen timing edge cases | Section time beyond last clip → skipped (explicit guard); multiple sections same frame → sorted order preserved. |
| Snap performance on large scenes (50+ objects) | `snapPoint` runs only during active drag; candidate list filtered to visible objects; negligible at typical scene sizes. |
| Easing CE version parity | Verify each new rate_func name against CE 0.19 changelog via context7 before coding. |
| Render history disk space | Max 5 files × max ~50 MB each = 250 MB per project; acceptable for local single-user use. |

## Wave 3 backlog (explicitly out of scope)

Grid snapping · `next_section` round-trip parser · multi-line-robust parser · `vector_field` comma round-trip · mini-map · object search · 3D viewport rulers / inline text editing.
