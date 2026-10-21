import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.ts', 'electron/**/*.spec.ts'],
  timeout: 180_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1,
  // In CI: one retry (shared macOS runners are slow and noisy; a retried pass is reported as "flaky",
  // not hidden) and GitHub annotations, so failures are readable without downloading logs.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]]
    : [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', testMatch: 'e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    // Electron app (needs a display: run under xvfb-run on headless Linux)
    { name: 'electron', testMatch: 'electron/**/*.spec.ts' },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
