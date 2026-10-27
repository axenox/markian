import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './Tests',
  outputDir: './.prototype-tests/results',
  reporter: 'list',
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5176',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5176 --strictPort',
    url: 'http://127.0.0.1:5176',
    reuseExistingServer: !process.env.CI,
  },
});