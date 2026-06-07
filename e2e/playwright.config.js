import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, '../services/web');

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5188',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Boot the frontend dev server on a dedicated port. It is fully client-side
  // for object editing (Pinia store + Konva) — no API/Redis needed for the
  // UI-tool smoke tests. A non-default port (5173 is commonly taken by other
  // local Vite apps) + reuseExistingServer:false guarantees we drive OUR app.
  webServer: {
    command: 'npm run dev -- --port 5188 --strictPort',
    cwd: webDir,
    url: 'http://localhost:5188',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
