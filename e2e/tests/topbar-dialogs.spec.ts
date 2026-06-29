import { test, expect } from '@playwright/test';

async function bootedStore(page) {
  await page.waitForFunction(() => !!window.__projectStore && !!window.__projectStore.project);
}

test.describe('Topbar dialogs and menus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await bootedStore(page);
    await page.evaluate(() => window.__projectStore.newProject('E2E', 'visual'));
  });

  test('New Project dialog accepts name and code-only mode', async ({ page }) => {
    await page.locator('.menu-label', { hasText: 'File' }).click();
    await page.locator('[role="menuitem"]').filter({ hasText: 'New Project' }).click();

    const dialog = page.getByRole('dialog', { name: 'New Project' });
    await expect(dialog).toBeVisible();

    await page.getByPlaceholder('My Animation').fill('Dialog Flow');
    await page.getByRole('button', { name: 'Code Only' }).click();
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect.poll(() => page.evaluate(() => window.__projectStore.project.name)).toBe(
      'Dialog Flow'
    );
    await expect.poll(() => page.evaluate(() => window.__projectStore.project.editorMode)).toBe(
      'code'
    );
  });

  test('Export dialog opens and allows code copy', async ({ page }) => {
    await page.locator('.shape-card', { hasText: 'Circle' }).click();
    await page.locator('.menu-label', { hasText: 'File' }).click();
    await page.locator('[role="menuitem"]').filter({ hasText: 'Export .py' }).click();

    const dialog = page.getByRole('dialog', { name: 'Export to Manim' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Download a self-contained scene.py')).toBeVisible();

    await dialog.getByRole('button', { name: 'Copy Code' }).click();
    await expect(dialog).toBeVisible();
  });

  test('Render dialog opens and reflects selected render options', async ({ page }) => {
    await page.locator('.shape-card', { hasText: 'Circle' }).click();
    await page.locator('.menu-label', { hasText: 'Tools' }).click();
    await page.locator('[role="menuitem"]').filter({ hasText: 'Render HQ' }).click();

    const dialog = page.getByRole('dialog', { name: 'Render with Manim' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('High-quality render via Docker')).toBeVisible();

    await page.getByTestId('fmt-gif').click();
    await page.getByTestId('res-1280x720').click();
    await page.getByTestId('fps-30').click();

    await expect(page.getByTestId('fmt-gif')).toHaveClass(/active/);
    await expect(page.getByTestId('res-1280x720')).toHaveClass(/active/);
    await expect(page.getByTestId('fps-30')).toHaveClass(/active/);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('Server Projects dialog loads through the API list endpoint', async ({ page }) => {
    let listCalled = false;
    await page.route('**/api/projects', async (route) => {
      listCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [
            { id: 'proj-1', name: 'Mock Project', editorMode: 'visual', objectsCount: 2 },
          ],
        }),
      });
    });

    await page.locator('.menu-label', { hasText: 'File' }).click();
    await page.locator('[role="menuitem"]').filter({ hasText: 'Server Projects' }).click();

    const dialog = page.getByRole('dialog', { name: 'Server Projects' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => listCalled).toBe(true);
  });
});
