import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * The ParaBank home/login page (`index.htm`), Customer Login panel.
 *
 * Locator strategy (layered): ParaBank's login inputs carry NO associated
 * `<label for>` and no accessible name, so `getByLabel` cannot reach them. We
 * therefore fall to the next layer — stable `name=` attribute CSS selectors
 * (`input[name="username"|"password"]`). The submit control, by contrast, IS
 * an accessible button (`<input type="submit" value="Log In">`), so it uses the
 * role-first locator `getByRole('button', { name: 'Log In' })`.
 */
export class LoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly logInButton: Locator;

  constructor(page: Page) {
    super(page);
    // No labels/roles on these inputs -> name-attribute CSS (layer 2).
    this.usernameInput = this.page.locator('input[name="username"]');
    this.passwordInput = this.page.locator('input[name="password"]');
    // Submit input exposes an accessible name via its value -> role-first (layer 1).
    this.logInButton = this.page.getByRole('button', { name: 'Log In' });
  }

  /** Navigate to the login page. */
  async goto(): Promise<void> {
    await this.navigate('index.htm');
  }

  /**
   * Fill the credentials and submit the login form.
   *
   * Clicking "Log In" triggers a FULL-PAGE form POST that navigates to
   * `overview.htm`. We do NOT return the moment the click resolves — that leaves
   * the navigation in flight and forces every caller to lean on a downstream
   * assertion to absorb the unsettled load (engine-specific timing luck). On
   * WebKit in particular this race is real: WebKit commits a full-page
   * navigation slightly later than Chromium, so an assertion fired immediately
   * after the click can run against the OLD document (the login page) before the
   * new one is even committed, or hit a destroyed execution context mid-swap.
   *
   * The wait is therefore ENCAPSULATED here, at the page object that owns the
   * navigation: `waitForURL` blocks until the browser has committed the
   * `overview.htm` document. This is a web-first wait (it auto-waits on a stable
   * post-navigation signal — the URL), NOT a fixed `waitForTimeout`, so a fast
   * engine settles immediately and a slow one simply takes longer — never flaky.
   */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.logInButton.click();
    // Block until the post-login navigation has COMMITTED the overview document,
    // so callers never assert against an unsettled / pre-navigation page.
    await this.page.waitForURL(/overview\.htm/);
    // Belt-and-braces stable post-nav landmark: the overview heading is rendered
    // by the committed document, confirming we are past the navigation swap.
    await expect(this.page.getByRole('heading', { name: 'Accounts Overview' })).toBeVisible();
  }
}
