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
      const obj = window.__projectStore.addObject('circle', 960, 540);
      obj.name = 'TestCircle';
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
      const obj = window.__projectStore.addObject('star', 960, 540);
      obj.name = 'UndoTarget';
      window.__projectStore.commitState();
    });
    await page.evaluate(() => {
      window.__projectStore.undo();
    });
    const names = await page.evaluate(() =>
      window.__projectStore.project.objects.map((o: Record<string, unknown>) => o.name)
    );
    expect(names).not.toContain('UndoTarget');
  });

  // 4. Lock object → locked flag is true
  test('toggleLocked sets object.locked to true', async ({ page }) => {
    await page.evaluate(() => {
      const obj = window.__projectStore.addObject('rectangle', 960, 540);
      obj.name = 'LockMe';
      window.__projectStore.commitState();
    });
    await page.evaluate(() => {
      const id = window.__projectStore.project.objects.find(
        (o: Record<string, unknown>) => o.name === 'LockMe'
      )?.id;
      if (id) window.__projectStore.toggleLocked(id);
    });
    const locked = await page.evaluate(
      () =>
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
      const created = window.__projectStore.addObject('circle', 960, 540);
      created.name = 'SplitObj';
      window.__projectStore.commitState();
      const obj = window.__projectStore.project.objects.find(
        (item: Record<string, unknown>) => item.name === 'SplitObj'
      );
      const clip = window.__projectStore.addClip(0, {
        type: 'fade',
        objectId: obj.id,
        startTime: 0,
        duration: 4,
      });
      window.__projectStore.setPlaybackTime(2);
      window.__projectStore.splitClip(clip.id);
    });
    const clipCount = await page.evaluate(
      () => window.__projectStore.project.tracks[0].clips.length
    );
    expect(clipCount).toBe(2);
  });

  // 9. Render history list
  test('render history dialog shows two completed renders', async ({ page }) => {
    const projectId = 'e2e-render-history';
    await page.route('**/api/render/**/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          history: [
            {
              index: 1,
              ext: 'zip',
              name: 'render_1.zip',
              size: 1234,
              mtime: '2026-06-28T12:00:00.000Z',
              url: `/api/render/${projectId}/render_1.zip`,
            },
            {
              index: 2,
              ext: 'mp4',
              name: 'render_2.mp4',
              size: 4321,
              mtime: '2026-06-28T12:05:00.000Z',
              url: `/api/render/${projectId}/render_2.mp4`,
            },
          ],
        }),
      });
    });

    await page.evaluate(() => {
      window.__projectStore.project.id = 'e2e-render-history';
      window.__projectStore.showRenderDialog = true;
      window.__projectStore.renderStatus = 'completed';
      window.__projectStore.renderVideoUrl = '/api/renders/e2e-render-history/latest.mp4';
    });

    await expect(page.getByText('Render #1.zip')).toBeVisible();
    await expect(page.getByText('Render #2.mp4')).toBeVisible();
    await expect(page.locator(`a[href="/api/render/${projectId}/render_1.zip"]`)).toHaveCount(1);
    await expect(page.locator(`a[href="/api/render/${projectId}/render_2.mp4"]`)).toHaveCount(1);
  });
});
