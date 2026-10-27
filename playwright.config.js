import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './Tests',
  testMatch: '**/*.spec.js',
  outputDir: '.test-results',
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5177', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5177 --strictPort', url: 'http://127.0.0.1:5177', reuseExistingServer: !process.env.CI },
});