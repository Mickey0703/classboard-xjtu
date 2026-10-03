import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.playwright-browsers');

export default defineConfig({
  testDir: './e2e',
  // These workflows mutate one shared local D1 database and recipient roster.
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8788', headless: true },
  webServer: { command: 'npm run preview:e2e', url: 'http://127.0.0.1:8788', reuseExistingServer: false, timeout: 120_000 },
  reporter: 'list'
});
