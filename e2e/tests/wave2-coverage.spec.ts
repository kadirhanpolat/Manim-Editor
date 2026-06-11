import { test, expect } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bootedStore(page: any) {
  await page.waitForFunction(() => !!window.__projectStore && !!window.__projectStore.project);
}

test.describe('Wave 2 E2E coverage', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (e: Error) => pageErrors.push(e.message));
    await page.goto('/');
    await bootedStore(page);
    await page.evaluate(() => window.__projectStore.newProject('E2E', 'visual'));
  });

  test.afterEach(() => {
    const benign = /fetch|NetworkError|WebSocket|Failed to load|ERR_CONNECTION|Loading chunk/i;
    const real = pageErrors.filter((m) => !benign.test(m));
    expect(real, `uncaught page errors: ${real.join(' | ')}`).toEqual([]);
  });

  // 1. App boots with an empty project
  test('new project has empty objects list', async ({ page }) => {
    const count = await page.evaluate(() => window.__projectStore.project.objects.length);
    expect(count).toBe(0);
  });

  // 2. Add object via store → verify count
  test('addObject creates exactly one object', async ({ page }) => {
    await page.evaluate(() => {
      window.__projectStore.addObject({ type: 'circle', name: 'TestCircle' });
      window.__projectStore.commitState();
    });
    const count = await page.evaluate(() => window.__projectStore.project.objects.length);
    expect(count).toBe(1);
    const type = await page.evaluate(() => window.__projectStore.project.objects[0].type);
    expect(type).toBe('circle');
  });

  // 3. Undo removes last added object
  test('undo removes last added object', async ({ page }) => {
    await page.evaluate(() => {
      window.__projectStore.addObject({ type: 'star', name: 'UndoTarget' });
      window.__projectStore.commitState();
    });
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(200);
    const names = await page.evaluate(() =>
      window.__projectStore.project.objects.map((o: Record<string, unknown>) => o.name)
    );
    expect(names).not.toContain('UndoTarget');
  });

  // 4. Lock object → locked flag is true
  test('toggleLocked sets object.locked to true', async ({ page }) => {
    await page.evaluate(() => {
      window.__projectStore.addObject({ type: 'rectangle', name: 'LockMe' });
      window.__projectStore.commitState();
    });
    await page.evaluate(() => {
      const id = window.__projectStore.project.objects.find(
        (o: Record<string, unknown>) => o.name === 'LockMe'
      )?.id;
      if (id) window.__projectStore.toggleLocked(id);
    });
    const locked = await page.evaluate(() =>
      window.__projectStore.project.objects.find(
        (o: Record<string, unknown>) => o.name === 'LockMe'
      )?.locked
    );
    expect(locked).toBe(true);
  });

  // 5. Scene section add
  test('addSection creates a section in the store', async ({ page }) => {
    await page.evaluate(() => {
      window.__projectStore.addSection(1.5, 'TestSection');
    });
    const sections = await page.evaluate(() => window.__projectStore.project.sections);
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('TestSection');
  });

  // 6. Recent colors
  test('addRecentColor adds to recentColors', async ({ page }) => {
    await page.evaluate(() => {
      window.__projectStore.addRecentColor('#ff0099');
    });
    const colors = await page.evaluate(() => window.__projectStore.recentColors);
    expect(colors).toContain('#ff0099');
  });

  // 7. Guide store action
  test('addGuide creates a guide entry', async ({ page }) => {
    await page.evaluate(() => {
      window.__projectStore.addGuide('h', 400);
    });
    const guides = await page.evaluate(() => window.__projectStore.project.guides);
    expect(guides.length).toBe(1);
    expect(guides[0].axis).toBe('h');
    expect(guides[0].pos).toBe(400);
  });

  // 8. Split clip action
  test('splitClip divides a clip into two at playback time', async ({ page }) => {
    await page.evaluate(() => {
      window.__projectStore.addObject({ type: 'circle', name: 'SplitObj' });
      window.__projectStore.commitState();
      const obj = window.__projectStore.project.objects[0];
      window.__projectStore.addClip({
        type: 'fade', objectId: obj.id, startTime: 0, duration: 4,
      });
      window.__projectStore.setPlaybackTime(2);
      const clip = window.__projectStore.project.tracks[0].clips[0];
      window.__projectStore.splitClip(clip.id);
    });
    const clipCount = await page.evaluate(
      () => window.__projectStore.project.tracks[0].clips.length
    );
    expect(clipCount).toBe(2);
  });
});
