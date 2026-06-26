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
      // Functional project. It deliberately IGNORES tests/visual/ so that the
      // functional CI job (`playwright test --project=chromium`) never runs the
      // visual snapshots — those are owned exclusively by the `visual` project
      // below. Keeping them apart stops a pixel diff from failing the functional
      // gate and vice-versa.
      testIgnore: /visual\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Cross-browser functional project: Firefox (issue #9). Replays the SAME
      // functional suite as `chromium` on Gecko. It IGNORES BOTH tests/visual/
      // AND tests/a11y/ because those are deliberately Chromium-only:
      //   - visual snapshots are rendering-engine specific (own `visual` project),
      //   - the a11y scan compares against a Chromium-captured axe baseline
      //     (tests/a11y/axe-baseline.json), so running it on Gecko would diff
      //     against the wrong engine's tree.
      // Unit tests (tests/unit/) are pure logic with no browser dependency, so
      // re-running them per engine adds cost without coverage — they ride along
      // here harmlessly (no page use) and are not separately excluded.
      name: 'firefox',
      testIgnore: [/visual\//, /a11y\//],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      // Cross-browser functional project: WebKit (issue #9). Same scope and same
      // deliberate exclusions as `firefox` above (visual + a11y stay
      // Chromium-only). WebKit is the engine where a post-navigation timing race
      // is most likely to surface (it settles full-page navigations slightly
      // later than Chromium); the page objects use web-first waits on a stable
      // post-navigation locator so no journey relies on engine-specific timing.
      name: 'webkit',
      testIgnore: [/visual\//, /a11y\//],
      use: { ...devices['Desktop Safari'] },
    },
    {
      // Visual regression project (issue #12). CHROMIUM-ONLY by design:
      // toHaveScreenshot baselines are rendering-engine specific, so a single
      // engine keeps the baseline set small and deterministic. Other engines
      // (Firefox/WebKit) are a deliberate skip here — cross-engine visual
      // baselines are out of scope and would only add flaky, redundant diffs.
      // Run with `playwright test --project=visual`.
      name: 'visual',
      testMatch: /tests\/visual\//,
      use: { ...devices['Desktop Chrome'] },
      // A small ratio absorbs sub-pixel antialiasing noise while still catching
      // real layout/style regressions. Applied per-assertion in the specs too.
      expect: {
        toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
      },
    },
  ],
});
