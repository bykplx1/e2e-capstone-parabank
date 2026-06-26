import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { LeftNavPanel } from './components/LeftNavPanel';

/** The account kinds offered by the "Open New Account" dropdown. */
export type NewAccountType = 'CHECKING' | 'SAVINGS';

/**
 * The Open New Account page (`openaccount.htm`).
 *
 * Composes the shared {@link LeftNavPanel}. The form lets a logged-in customer
 * open a new account of a chosen type, funded from one of their existing
 * accounts. On submit, ParaBank reveals a result panel containing an
 * "Account Opened!" heading and the new account's id as a link.
 *
 * Locator strategy (layered):
 *   - Page heading via `getByRole('heading', { name: 'Open New Account' })`
 *     (role-first, layer 1).
 *   - The two `<select>`s carry stable ids (`#type`, `#fromAccountId`) and have
 *     no associated labels, so they use id-CSS (layer 2). Their options are
 *     populated by JS after the page loads, so selection is web-first
 *     (auto-waiting on the option) rather than timed.
 *   - The submit is `<input type="button" value="Open New Account">`, an
 *     accessible button -> role-first (layer 1). Because two controls share the
 *     name "Open New Account" (the left-nav link and this button), the button is
 *     disambiguated structurally inside `#openAccountForm`.
 *   - The result is text-anchored/structural: the new account id renders inside
 *     `#newAccountId` within the `#openAccountResult` panel (layer 3).
 */
export class OpenAccountPage extends BasePage {
  readonly leftNav: LeftNavPanel;
  readonly heading: Locator;
  readonly accountTypeSelect: Locator;
  readonly fromAccountSelect: Locator;
  readonly openButton: Locator;
  readonly resultPanel: Locator;
  readonly resultHeading: Locator;
  /** The newly opened account's id, shown as a link in the result panel. */
  readonly newAccountId: Locator;

  constructor(page: Page) {
    super(page);
    this.leftNav = new LeftNavPanel(page);
    this.heading = this.page.getByRole('heading', { name: 'Open New Account' });
    // No labels on the selects -> id-CSS (layer 2).
    this.accountTypeSelect = this.page.locator('#type');
    this.fromAccountSelect = this.page.locator('#fromAccountId');
    // Accessible button, scoped inside the form to avoid clashing with the
    // identically named left-nav link (layer 1, structurally disambiguated).
    this.openButton = this.page
      .locator('#openAccountForm')
      .getByRole('button', { name: 'Open New Account' });
    this.resultPanel = this.page.locator('#openAccountResult');
    this.resultHeading = this.resultPanel.getByRole('heading', { name: 'Account Opened!' });
    this.newAccountId = this.resultPanel.locator('#newAccountId');
  }

  /** Navigate directly to the Open New Account page. */
  async goto(): Promise<void> {
    await this.navigate('openaccount.htm');
  }

  /**
   * Assert the form has loaded and its JS-populated dropdowns are ready: the
   * heading is shown and the funding-account select has at least one real
   * option. Web-first (auto-waiting), no fixed timeouts.
   */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.accountTypeSelect).toBeVisible();
    // The funding options are filled by JS after load; wait for a real one so a
    // later selectOption never races an empty dropdown.
    await expect(this.fromAccountSelect.locator('option')).not.toHaveCount(0);
  }

  /**
   * Open a new account of the given type, funded from `fromAccountId`, and
   * submit. Selecting by visible label (CHECKING/SAVINGS) and by the funding
   * account's id keeps the intent readable.
   */
  async openAccount(type: NewAccountType, fromAccountId: number): Promise<void> {
    await this.accountTypeSelect.selectOption({ label: type });
    await this.fromAccountSelect.selectOption({ label: String(fromAccountId) });
    await this.openButton.click();
  }

  /**
   * Wait for the success result and return the newly created account's numeric
   * id. Web-first: waits for the id link to render before reading it.
   */
  async newlyOpenedAccountId(): Promise<number> {
    await expect(this.resultHeading).toBeVisible();
    await expect(this.newAccountId).toBeVisible();
    const text = (await this.newAccountId.innerText()).trim();
    return Number(text);
  }
}
