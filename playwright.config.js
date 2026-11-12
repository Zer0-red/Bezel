// Bezel's browser tests: the web version in Chrome and the desktop app in Electron,
// both against the fixture site in tests/fixtures. Run with `npm test` (it builds first);
// on Linux without a display, run the app tests under xvfb-run.
import { defineConfig } from '@playwright/test';
import { BEZEL, SITE } from './tests/helpers.js';

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.js',
  workers: 1, // one app or browser at a time: they share the two servers below
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'web', testMatch: 'web.spec.js', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1500, height: 950 } } },
    { name: 'app', testMatch: 'app.spec.js' },
  ],
  webServer: [
    {
      command: `npx vite preview --port ${new URL(BEZEL).port} --strictPort --host 127.0.0.1`,
      url: `${BEZEL}/version.json`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node tests/serve-fixtures.mjs ${new URL(SITE).port}`,
      url: `${SITE}/index.html`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
