// End-to-end smoke of every add/clip/tool UI surface in a real browser.
// Proves the app boots (Vue + Konva), and that clicking each palette/tool
// button drives the real Pinia store — the browser-level counterpart to the
// jsdom unit audit (tests/components/ui-tools-audit.test.js).
import { test, expect } from '@playwright/test';

const BENIGN = /fetch|NetworkError|WebSocket|Failed to load|ERR_CONNECTION|Loading chunk/i;

async function bootedStore(page) {
  await page.waitForFunction(() => !!window.__projectStore && !!window.__projectStore.project);
}
const objCount = (page) => page.evaluate(() => window.__projectStore.project.objects.length);
const objTypes = (page) =>
  page.evaluate(() => window.__projectStore.project.objects.map((o) => o.type));
const clipCount = (page) =>
  page.evaluate(() => window.__projectStore.project.tracks.flatMap((t) => t.clips).length);

let pageErrors;
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto('/');
  await bootedStore(page);
  // Fresh, deterministic project for each test.
  await page.evaluate(() => window.__projectStore.newProject('E2E', 'visual'));
});

test.afterEach(() => {
  const real = pageErrors.filter((m) => !BENIGN.test(m));
  expect(real, `uncaught page errors: ${real.join(' | ')}`).toEqual([]);
});

test('app boots: toolbar, sidebar and stage are visible', async ({ page }) => {
  await expect(page.locator('aside .shape-card').first()).toBeVisible();
  await expect(page.getByText('Shapes').first()).toBeVisible();
  await expect(page.locator('.konvajs-content, canvas').first()).toBeVisible();
});

test('every 2D sidebar card adds exactly one object', async ({ page }) => {
  const cards = page.locator('.shape-card');
  const n = await cards.count();
  expect(n).toBeGreaterThan(30);
  for (let i = 0; i < n; i++) {
    const before = await objCount(page);
    await cards.nth(i).click();
    await expect.poll(() => objCount(page)).toBe(before + 1);
  }
});

test('Add Text button adds a text object', async ({ page }) => {
  const before = await objCount(page);
  await page.locator('button[title="Drag or click to add text"]').click();
  await expect.poll(() => objCount(page)).toBe(before + 1);
  expect((await objTypes(page)).at(-1)).toBe('text');
});

test('F1: Counter card adds a counter and unlocks the Count clip tool', async ({ page }) => {
  await page.locator('.shape-card', { hasText: 'Counter' }).click();
  expect((await objTypes(page)).at(-1)).toBe('counter');
  // Selected counter → inspector shows the counter-only "Count" motion button.
  await expect(page.locator('[data-test="anim-count"]')).toBeVisible();
  const before = await clipCount(page);
  await page.locator('[data-test="anim-count"]').click();
  await expect.poll(() => clipCount(page)).toBe(before + 1);
});

test('F3: Number Plane card adds a numberplane', async ({ page }) => {
  await page.locator('.shape-card', { hasText: 'Number Plane' }).click();
  expect((await objTypes(page)).at(-1)).toBe('numberplane');
});

test('3D mode exposes Prism + Surface cards that add 3D objects', async ({ page }) => {
  await page.evaluate(() => window.__projectStore.setSceneType('3d'));
  await expect(page.getByRole('heading', { name: '3D Shapes' })).toBeVisible();
  for (const [label, type] of [
    ['Prism', 'prism'],
    ['Surface', 'surface'],
    ['Sphere', 'sphere'],
  ]) {
    const before = await objCount(page);
    await page.locator('.shape-card', { hasText: label }).click();
    await expect.poll(() => objCount(page)).toBe(before + 1);
    expect((await objTypes(page)).at(-1)).toBe(type);
  }
});

test('MotionPicker buttons create timeline clips for a selected object', async ({ page }) => {
  await page.locator('.shape-card', { hasText: 'Circle' }).click();
  for (const name of ['Move', 'Scale', 'Fade', 'Rotate']) {
    const before = await clipCount(page);
    await page.getByRole('button', { name, exact: true }).click();
    await expect.poll(() => clipCount(page)).toBe(before + 1);
  }
});

// The live interaction tools are keyboard-driven (App.vue handleKeydown);
// the legacy Toolbar.vue button strip is orphaned (audit finding F6).
test('keyboard shortcuts set the active interaction tool', async ({ page }) => {
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('h');
  await expect.poll(() => page.evaluate(() => window.__projectStore.activeTool)).toBe('hand');
  await page.keyboard.press('v');
  await expect.poll(() => page.evaluate(() => window.__projectStore.activeTool)).toBe('select');
});

test('AssetSidebar Transform button is gated until two objects are selected', async ({ page }) => {
  const transform = page.locator('.btn-transform');
  await expect(transform).toBeDisabled();
  await page.evaluate(() => {
    const s = window.__projectStore;
    s.addObject('circle', 200, 200);
    s.addObject('square', 300, 300);
    s.selectedObjectIds = s.project.objects.map((o) => o.id);
  });
  await expect(transform).toBeEnabled();
});

test('Every sidebar shape card can be selected and edited through the inspector', async ({
  page,
}) => {
  const cards = page.locator('.shape-card');
  const total = await cards.count();
  expect(total).toBeGreaterThan(30);

  const seenTypes = new Set<string>();
  for (let i = 0; i < total; i++) {
    const before = await objCount(page);
    await cards.nth(i).click();
    await expect.poll(() => objCount(page)).toBe(before + 1);
    await expect(page.getByText('Properties').first()).toBeVisible();

    const type = await page.evaluate(() => window.__projectStore.project.objects.at(-1)?.type);
    if (!type) throw new Error('expected a selected object type');
    seenTypes.add(type);

    const opacity = page.getByLabel('Object opacity');
    await opacity.evaluate((el) => {
      const input = el as HTMLInputElement;
      input.value = '0.5';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(opacity).toHaveValue('0.5');

    const fillHex = page.getByLabel('Fill color hex');
    if ((await fillHex.count()) > 0) {
      await fillHex.fill('#112233');
      await expect(fillHex).toHaveValue('#112233');
    }
  }

  expect(seenTypes.size).toBeGreaterThan(20);
});

test('Type-specific inspector panels expose and update their dedicated controls', async ({
  page,
}) => {
  const cases = [
    {
      label: 'Polygon',
      section: 'Polygon Settings',
      control: 'Sides',
      value: '8',
    },
    {
      label: 'Star',
      section: 'Star Settings',
      control: 'Arms',
      value: '7',
    },
    {
      label: 'Dot Grid',
      section: 'Grid Settings',
      control: 'Columns',
      value: '6',
    },
    {
      label: 'Counter',
      section: 'Counter',
      control: 'Start value',
      value: '42',
    },
    {
      label: 'Number Line',
      section: 'NumberLine Range',
      control: 'Length (px)',
      value: '640',
    },
    {
      label: 'Number Plane',
      section: 'NumberPlane Range',
      control: 'X Min',
      value: '-7',
    },
    {
      label: 'Axes',
      section: 'Axes Range',
      control: 'Y Max',
      value: '8',
    },
    {
      label: 'Add Text',
      section: 'Text Content',
      control: 'Font Size',
      value: '72',
    },
  ] as const;

  for (const c of cases) {
    const before = await objCount(page);
    await page.locator('.shape-card, button', { hasText: c.label }).first().click();
    await expect.poll(() => objCount(page)).toBe(before + 1);
    await expect(page.getByText(c.section).first()).toBeVisible();

    const input = page.getByLabel(c.control);
    await expect(input).toBeVisible();
    await input.fill(c.value);
    await expect(input).toHaveValue(c.value);
  }
});
