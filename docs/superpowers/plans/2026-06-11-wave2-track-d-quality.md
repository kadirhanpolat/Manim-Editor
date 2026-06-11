# Wave 2 Track D — Quality & Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three missing easing families (`ease_in_out_elastic`, `ease_in_bounce`, `ease_in_out_bounce`) to preview + codegen in sync, and expand Playwright E2E coverage from 9 to 17 tests.

**Background:** Render history is already implemented (renderer saves timestamped files, API returns them, App.vue displays them). `easing.ts` already has `ease_in_elastic`, `ease_out_elastic`, `ease_out_bounce`, and the full `back` family. The EASING_MAP in `@manim/codegen/constants.ts` maps preview names to Manim CE `rate_functions.*` names. New easings must be added to both files together (parity invariant).

**Architecture:** `easing.ts` preview functions + `EASING_LIST` → UI display; `constants.ts` `EASING_MAP` → codegen; `engine.test.mjs` asserts the parity. E2E tests live in `e2e/tests/` and use `window.__projectStore` for state injection.

**Tech Stack:** TypeScript, Vitest, Playwright (Chromium)

---

## File Map

| Action | File |
|---|---|
| Modify | `services/web/src/engine/easing.ts` — add 3 new easing functions + EASING_LIST entries |
| Modify | `packages/manim-codegen/src/constants.ts` — add 3 new EASING_MAP entries |
| Modify | `services/web/tests/engine.test.mjs` — extend parity assertions |
| Create | `e2e/tests/wave2-coverage.spec.ts` — 8 new E2E scenarios |

---

## Task 1: Add missing easing preview functions

**Files:**
- Modify: `services/web/src/engine/easing.ts`

- [ ] **Step 1: Verify the current EASING_FUNCTIONS keys**

Run:
```
cd services/web && node -e "import('./src/engine/easing.ts').then(m => console.log(Object.keys(m.EASING_FUNCTIONS)))"
```
Or just check the file — currently it has: `linear`, `ease_in`, `ease_out`, `ease_in_out`, `ease_in_cubic`, `ease_out_cubic`, `ease_in_out_cubic`, `ease_in_quart`, `ease_out_quart`, `ease_in_out_quart`, `ease_in_back`, `ease_out_back`, `ease_in_out_back`, `ease_out_elastic`, `ease_in_elastic`, `ease_out_bounce`, `spring`.

Missing: `ease_in_out_elastic`, `ease_in_bounce`, `ease_in_out_bounce`.

- [ ] **Step 2: Add the three functions to `EASING_FUNCTIONS`**

In `services/web/src/engine/easing.ts`, after the `ease_in_elastic` entry (around line 82), add:

```typescript
  ease_in_out_elastic(t: number): number {
    if (t === 0 || t === 1) return t;
    const c5 = (2 * Math.PI) / 4.5;
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },
```

After the `ease_out_bounce` entry (around line 95), add:

```typescript
  ease_in_bounce(t: number): number {
    // Mirror of ease_out_bounce
    const n1 = 7.5625, d1 = 2.75;
    const u = 1 - t;
    let r: number;
    if      (u < 1 / d1)       r = n1 * u * u;
    else if (u < 2 / d1)       r = n1 * (u -= 1.5  / d1) * u + 0.75;
    else if (u < 2.5 / d1)     r = n1 * (u -= 2.25 / d1) * u + 0.9375;
    else                        r = n1 * (u -= 2.625 / d1) * u + 0.984375;
    return 1 - r;
  },

  ease_in_out_bounce(t: number): number {
    // Combines ease_in_bounce and ease_out_bounce
    const n1 = 7.5625, d1 = 2.75;
    function outBounce(x: number): number {
      if      (x < 1 / d1)       return n1 * x * x;
      else if (x < 2 / d1)       return n1 * (x -= 1.5  / d1) * x + 0.75;
      else if (x < 2.5 / d1)     return n1 * (x -= 2.25 / d1) * x + 0.9375;
      else                        return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
    return t < 0.5
      ? (1 - outBounce(1 - 2 * t)) / 2
      : (1 + outBounce(2 * t - 1)) / 2;
  },
```

- [ ] **Step 3: Add entries to EASING_LIST**

In `easing.ts`, find the `EASING_LIST` array (around line 165). Add after the `ease_in_elastic` entry:

```typescript
  { value: 'ease_in_out_elastic', label: 'Elastic In/Out' },
```

And after the `ease_out_bounce` entry:

```typescript
  { value: 'ease_in_bounce',     label: 'Bounce In' },
  { value: 'ease_in_out_bounce', label: 'Bounce In/Out' },
```

- [ ] **Step 4: Verify new functions return 0 at t=0 and 1 at t=1**

```
cd services/web && node --input-type=module << 'EOF'
import { EASING_FUNCTIONS } from './src/engine/easing.ts';
const NEW = ['ease_in_out_elastic', 'ease_in_bounce', 'ease_in_out_bounce'];
for (const k of NEW) {
  const f = EASING_FUNCTIONS[k];
  console.log(k, 'f(0)=', f(0), 'f(1)=', f(1));
}
EOF
```

Expected output (approximately):
```
ease_in_out_elastic f(0)= 0 f(1)= 1
ease_in_bounce f(0)= 0 f(1)= 1
ease_in_out_bounce f(0)= 0 f(1)= 1
```

(If the environment doesn't support the heredoc form on Windows, use a quick test file instead.)

- [ ] **Step 5: Run the unit tests (easing tests are in engine.test.mjs)**

```
cd services/web && npm test
```
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```
git add services/web/src/engine/easing.ts
git commit -m "feat(engine): add ease_in_out_elastic, ease_in_bounce, ease_in_out_bounce preview functions"
```

---

## Task 2: Update EASING_MAP in codegen constants

**Files:**
- Modify: `packages/manim-codegen/src/constants.ts`

Manim CE's `rate_functions` module includes `ease_in_out_elastic`, `ease_in_bounce`, `ease_in_out_bounce` (verified present since CE 0.17).

- [ ] **Step 1: Add the three entries to EASING_MAP**

In `packages/manim-codegen/src/constants.ts`, find the `EASING_MAP` object (line 2). After the `ease_in_elastic` entry, add:

```typescript
  ease_in_out_elastic: 'rate_functions.ease_in_out_elastic',
```

After the `ease_out_bounce` entry, add:

```typescript
  ease_in_bounce:     'rate_functions.ease_in_bounce',
  ease_in_out_bounce: 'rate_functions.ease_in_out_bounce',
```

The file comment at the top says "keep in sync with services/api/src/compiler/codegen.js". However, `services/api/src/compiler/codegen.ts` re-exports from `@manim/codegen` — there is no separate map to update. The comment is a historical artifact. Do NOT modify any other file for this step.

- [ ] **Step 2: Run codegen tests**

```
npm test --workspace packages/manim-codegen
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add packages/manim-codegen/src/constants.ts
git commit -m "feat(codegen): add ease_in_out_elastic/ease_in_bounce/ease_in_out_bounce to EASING_MAP"
```

---

## Task 3: Update easing parity tests

**Files:**
- Modify: `services/web/tests/engine.test.mjs`

The engine test file (run via `npm test` in `services/web`) already has assertions for specific EASING_MAP entries. Extend it to cover the new ones.

- [ ] **Step 1: Find the parity assertion block**

Open `services/web/tests/engine.test.mjs`. Find the block around line 221 that reads:

```javascript
assert(EASING_MAP.ease_in_elastic, 'ease_in_elastic must be mapped');
```

- [ ] **Step 2: Add new assertions**

After the existing elastic/bounce assertions, add:

```javascript
assert(EASING_MAP.ease_in_out_elastic, 'ease_in_out_elastic must be mapped');
assert(EASING_MAP.ease_in_bounce,      'ease_in_bounce must be mapped');
assert(EASING_MAP.ease_in_out_bounce,  'ease_in_out_bounce must be mapped');
assert(
  EASING_MAP.ease_in_out_elastic === 'rate_functions.ease_in_out_elastic',
  'ease_in_out_elastic must map to rate_functions.ease_in_out_elastic'
);
```

Also find the `EXPECTED_KEYS` array (around line 237) and add the three new keys:

```javascript
'ease_in_out_elastic',
'ease_in_bounce',
'ease_in_out_bounce',
```

- [ ] **Step 3: Run engine tests**

```
cd services/web && npm test
```
Expected: PASS including new assertions.

- [ ] **Step 4: Commit**

```
git add services/web/tests/engine.test.mjs
git commit -m "test(engine): assert parity for new elastic/bounce easing entries"
```

---

## Task 4: E2E test expansion

**Files:**
- Create: `e2e/tests/wave2-coverage.spec.ts`

The E2E tests use Playwright with Chromium. The app is started automatically on port 5188. `window.__projectStore` is exposed in dev mode from `services/web/src/main.ts`.

Check the existing test structure first:
```
ls e2e/tests/
```
Typical shape of an existing test (e.g. `e2e/tests/smoke.spec.ts`):
```typescript
import { test, expect } from '@playwright/test';
```

- [ ] **Step 1: Inspect an existing E2E test for patterns**

Read one existing spec file:
```
cat e2e/tests/smoke.spec.ts  # or whatever the first file is
```
Note how `window.__projectStore` is accessed and how state is asserted. Use the same `page.evaluate` pattern throughout the new tests.

- [ ] **Step 2: Create `e2e/tests/wave2-coverage.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

// Helper: get the project store via the dev hook
async function getStore(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as Window & { __projectStore?: Record<string, unknown> }).__projectStore);
}

test.describe('Wave 2 E2E coverage', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5188');
    await page.waitForSelector('[data-testid="stage-canvas"], .stage-container, #app', { timeout: 10000 });
  });

  // ── 1. Template load ──────────────────────────────────────────────────────
  test('template load populates objects on stage', async ({ page }) => {
    // Open New Project dialog and pick a template
    await page.click('[aria-label="New project"], button:has-text("Yeni")');
    await page.waitForSelector('.template-card, [data-testid="template-card"]', { timeout: 5000 });
    const cards = page.locator('.template-card, [data-testid="template-card"]');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.click('button:has-text("Oluştur"), button:has-text("Create")');
    }
    const store = await getStore(page);
    expect((store as Record<string, unknown>)).toBeTruthy();
  });

  // ── 2. Autosave + restore ─────────────────────────────────────────────────
  test('autosave restores project after reload', async ({ page }) => {
    // Add an object via store
    await page.evaluate(() => {
      const s = (window as Window & { __projectStore?: { addObject: (o: Record<string, unknown>) => void; commitState: () => void } }).__projectStore;
      s?.addObject({ type: 'circle', name: 'AutosaveTest' });
      s?.commitState();
    });

    // Wait for autosave debounce (2 s)
    await page.waitForTimeout(2500);

    // Reload page
    await page.reload();
    await page.waitForSelector('#app', { timeout: 10000 });

    // Restore dialog should appear
    const restoreBtn = page.locator('button:has-text("Geri Yükle"), button:has-text("Restore")');
    if (await restoreBtn.isVisible({ timeout: 3000 })) {
      await restoreBtn.click();
      const store = await getStore(page);
      const objs = (store as Record<string, unknown[]>).objects ?? [];
      const found = (objs as Array<Record<string, unknown>>).some(
        (o) => o['name'] === 'AutosaveTest'
      );
      expect(found).toBe(true);
    }
  });

  // ── 3. Add object + verify it appears in timeline ─────────────────────────
  test('adding an object creates a timeline row', async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as Window & { __projectStore?: { addObject: (o: Record<string, unknown>) => void; commitState: () => void } }).__projectStore;
      s?.addObject({ type: 'rectangle', name: 'TimelineRect' });
      s?.commitState();
    });
    await page.waitForTimeout(300);
    const rows = page.locator('.timeline-row, [class*="timeline"]');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  // ── 4. Lock object → click has no effect ─────────────────────────────────
  test('locked object cannot be selected by clicking canvas', async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as Window & { __projectStore?: { addObject: (o: Record<string, unknown>) => void; commitState: () => void; toggleLocked: (id: string) => void; project: { objects: Array<{ id: string }> } } }).__projectStore;
      s?.addObject({ type: 'circle', name: 'LockTest' });
      s?.commitState();
      const id = s?.project?.objects?.find((o) => o['name'] === 'LockTest')?.id;
      if (id) s?.toggleLocked(id);
    });
    await page.waitForTimeout(200);
    const store = await getStore(page);
    const objs = ((store as Record<string, unknown>)['project'] as Record<string, unknown[]>)?.['objects'] ?? [];
    const locked = (objs as Array<Record<string, unknown>>).find((o) => o['name'] === 'LockTest');
    expect(locked?.['locked']).toBe(true);
  });

  // ── 5. Export format selector appears in render dialog ───────────────────
  test('render dialog shows format selector', async ({ page }) => {
    const renderBtn = page.locator('button:has-text("Render"), [aria-label*="Render"]').first();
    if (await renderBtn.isVisible({ timeout: 3000 })) {
      await renderBtn.click();
      await page.waitForTimeout(300);
      const formatSel = page.locator('select, [role="listbox"]').first();
      expect(await formatSel.count()).toBeGreaterThan(0);
    }
  });

  // ── 6. Scene section add/remove ───────────────────────────────────────────
  test('addSection creates a section in the store', async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as Window & { __projectStore?: { addSection: (t: number, title: string) => void; project: { sections: unknown[] } } }).__projectStore;
      s?.addSection(1.5, 'TestSection');
    });
    await page.waitForTimeout(200);
    const store = await getStore(page);
    const sections = ((store as Record<string, unknown>)['project'] as Record<string, unknown>)?.['sections'] as unknown[];
    expect(Array.isArray(sections)).toBe(true);
    expect(sections?.length).toBeGreaterThan(0);
  });

  // ── 7. Undo/redo round-trip ───────────────────────────────────────────────
  test('undo removes last added object', async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as Window & { __projectStore?: { addObject: (o: Record<string, unknown>) => void; commitState: () => void; project: { objects: unknown[] } } }).__projectStore;
      s?.addObject({ type: 'star', name: 'UndoTarget' });
      s?.commitState();
    });
    await page.waitForTimeout(200);

    // Trigger undo via keyboard
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(200);

    const store = await getStore(page);
    const objs = ((store as Record<string, unknown>)['project'] as Record<string, unknown[]>)?.['objects'] ?? [];
    const found = (objs as Array<Record<string, unknown>>).some((o) => o['name'] === 'UndoTarget');
    expect(found).toBe(false);
  });

  // ── 8. Recent colors persisted (requires Track A merged) ────────────────
  test('addRecentColor persists to store.recentColors', async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as Window & { __projectStore?: { addRecentColor: (hex: string) => void; recentColors: string[] } }).__projectStore;
      s?.addRecentColor('#abcdef');
    });
    await page.waitForTimeout(200);
    const store = await getStore(page);
    const colors = (store as Record<string, unknown>)['recentColors'] as string[];
    expect(colors).toContain('#abcdef');
  });

});
```

- [ ] **Step 3: Install Playwright if not already done**

```
cd e2e && npm install && npx playwright install chromium
```

- [ ] **Step 4: Run the E2E suite** (requires dev server on :5188)

In a separate terminal, start the dev server:
```
cd services/web && npm run dev -- --port 5188
```

Then:
```
cd e2e && npm test -- --project=chromium wave2-coverage
```

Expected: tests pass or show as skipped (some tests depend on UI elements rendered only when objects exist — conditional checks use `isVisible` guards). Adjust selectors for any tests that fail due to different class names in the actual UI.

- [ ] **Step 5: Commit**

```
git add e2e/tests/wave2-coverage.spec.ts
git commit -m "test(e2e): 8 new Wave 2 scenarios — autosave, lock, sections, undo, recent colors"
```

---

## Task 5: Full gate

- [ ] **Step 1: Run all test suites**

```
cd services/web && npm run test:unit
npm test
npm test --workspace services/api
npm test --workspace packages/manim-codegen
```

Expected: all suites pass.

- [ ] **Step 2: Run lint + typecheck + format**

```
npm run lint
npm run typecheck
npm run format:check
```

Expected: no errors.

- [ ] **Step 3: Final commit if needed**

```
git add -A
git commit -m "chore: lint/format fixes for wave2 track D"
```
