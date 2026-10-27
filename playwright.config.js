import { defineConfig } from '@playwright/test';

const port = process.env.MARKIAN_TEST_PORT ?? '5177';

export default defineConfig({
  testDir: './Tests',
  testMatch: '**/*.spec.js',
  outputDir: '.test-results',
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI },
});