import type { Locator, Page } from '@playwright/test';
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

  /** Fill the credentials and submit the login form. */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.logInButton.click();
  }
}
