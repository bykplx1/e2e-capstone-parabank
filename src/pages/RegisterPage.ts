import { expect, type Locator, type Page } from '@playwright/test';
import type { User } from '../api/types';
import { BasePage } from './BasePage';

/**
 * The customer registration page (`register.htm`), "Signing up is easy!" panel.
 *
 * Locator strategy (layered):
 *   - Every form input carries a stable, semantic `id`/`name` of the form
 *     `customer.firstName`, `customer.address.street`, etc. (plus the standalone
 *     `repeatedPassword`). These ids contain dots, which are CSS class
 *     separators, so we target them with attribute selectors
 *     (`input[id="customer.firstName"]`) rather than `#id` — layer 2 (name/id
 *     CSS). The inputs have no associated `<label for>` / accessible name, so
 *     `getByLabel` is not available here.
 *   - The submit control IS an accessible button (`<input type="submit"
 *     value="Register">`), so it uses the role-first `getByRole('button')`
 *     (layer 1).
 *   - The post-submit success state is text-anchored: ParaBank renders a
 *     `Welcome {username}` heading and a fixed success sentence (layer 3).
 *
 * Note: ParaBank's registration POST requires the JSESSIONID set when the form
 * is first GET-ed; navigating here via {@link goto} establishes that session,
 * so a subsequent submit succeeds.
 */
export class RegisterPage extends BasePage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly zipCode: Locator;
  readonly phoneNumber: Locator;
  readonly ssn: Locator;
  readonly username: Locator;
  readonly password: Locator;
  readonly confirmPassword: Locator;
  readonly registerButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    // Ids contain dots -> attribute-CSS (layer 2); not getByLabel (no label/for).
    this.firstName = this.byId('customer.firstName');
    this.lastName = this.byId('customer.lastName');
    this.street = this.byId('customer.address.street');
    this.city = this.byId('customer.address.city');
    this.state = this.byId('customer.address.state');
    this.zipCode = this.byId('customer.address.zipCode');
    this.phoneNumber = this.byId('customer.phoneNumber');
    this.ssn = this.byId('customer.ssn');
    this.username = this.byId('customer.username');
    this.password = this.byId('customer.password');
    this.confirmPassword = this.byId('repeatedPassword');
    // Accessible submit input -> role-first (layer 1).
    this.registerButton = this.page.getByRole('button', { name: 'Register' });
    // Fixed success sentence rendered after a successful sign-up (layer 3).
    this.successMessage = this.page.getByText(
      'Your account was created successfully. You are now logged in.',
    );
  }

  /** Locate a form input by its exact `id`, which contains dots. */
  private byId(id: string): Locator {
    return this.page.locator(`input[id="${id}"]`);
  }

  /** Navigate to the registration page (also establishes the session cookie). */
  async goto(): Promise<void> {
    await this.navigate('register.htm');
  }

  /**
   * Fill every field from a {@link UserFactory} profile and submit. The password
   * is entered into both the password and confirm fields.
   *
   * Submitting "Register" triggers a FULL-PAGE form POST that navigates to the
   * post-registration page (`register.htm` re-rendered with the Welcome panel).
   * As with login, we encapsulate the post-navigation wait HERE rather than
   * returning mid-flight and relying on the caller's later assertion to mask an
   * unsettled load — the same WebKit full-page-navigation race applies (the new
   * document commits later than on Chromium). `waitForURL` blocks until the
   * navigation has committed; it is a web-first wait on a stable signal, not a
   * fixed sleep. The success heading/message are then asserted via
   * {@link expectRegistered}.
   */
  async register(user: User): Promise<void> {
    await this.firstName.fill(user.firstName);
    await this.lastName.fill(user.lastName);
    await this.street.fill(user.address.street);
    await this.city.fill(user.address.city);
    await this.state.fill(user.address.state);
    await this.zipCode.fill(user.address.zipCode);
    await this.phoneNumber.fill(user.phoneNumber);
    await this.ssn.fill(user.ssn);
    await this.username.fill(user.username);
    await this.password.fill(user.password);
    await this.confirmPassword.fill(user.password);
    await this.registerButton.click();
    // Block until the post-register navigation has COMMITTED, so a caller never
    // asserts the Welcome state against the still-loading / pre-navigation page.
    await this.page.waitForURL(/register\.htm/);
  }

  /**
   * The `Welcome {username}` heading shown on the post-registration page.
   * ParaBank greets the just-registered customer by their username.
   */
  welcomeHeading(username: string): Locator {
    return this.page.getByRole('heading', { name: `Welcome ${username}` });
  }

  /**
   * Assert the registration succeeded: the `Welcome {username}` heading and the
   * "created successfully / now logged in" message are both shown. Web-first
   * assertions (auto-waiting), no fixed timeouts.
   */
  async expectRegistered(username: string): Promise<void> {
    await expect(this.welcomeHeading(username)).toBeVisible();
    await expect(this.successMessage).toBeVisible();
  }
}
