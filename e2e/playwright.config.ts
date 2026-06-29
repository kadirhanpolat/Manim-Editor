import { defineConfig, devices } from '@playwright/test';
const webPort = Number.parseInt(process.env.E2E_WEB_PORT ?? '5188', 10);
const resolvedWebPort = Number.isInteger(webPort) && webPort > 0 ? webPort : 5188;
const webBaseURL = `http://127.0.0.1:${resolvedWebPort}`;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: webBaseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
