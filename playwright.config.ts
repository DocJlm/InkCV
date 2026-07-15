import { defineConfig, devices } from '@playwright/test';

const localBaseUrl = 'http://127.0.0.1:5173';
const baseURL = process.env.INKCV_E2E_BASE_URL ?? localBaseUrl;
const useExternalServer = process.env.INKCV_E2E_BASE_URL !== undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  outputDir: 'test-results',
  use: {
    baseURL,
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: 'pnpm --filter @inkcv/web dev --host 127.0.0.1',
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /(?:desktop|live-ai)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], locale: 'en-US', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'android-chromium',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'], locale: 'en-US' },
    },
    {
      name: 'iphone-webkit',
      testMatch: /iphone\.spec\.ts/,
      use: { ...devices['iPhone 13'], locale: 'en-US' },
    },
  ],
});
