import { defineConfig, devices } from '@playwright/test';

/**
 * ParaBank base URL. Resolves from the `PARABANK_URL` env var, defaulting to
 * the local Docker `parasoft/parabank` instance. Note: the app is served under
 * the `/parabank` context path, so test routes include it
 * (e.g. `page.goto('/parabank/index.htm')`).
 */
const baseURL = process.env.PARABANK_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
