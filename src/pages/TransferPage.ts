import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { LeftNavPanel } from './components/LeftNavPanel';

/**
 * The Transfer Funds page (`transfer.htm`).
 *
 * ParaBank renders this screen as a small client-side app (`#transferApp`):
 * on load it AJAX-fetches the customer's accounts and DYNAMICALLY appends an
 * `<option>` per account to both the "from" and "to" `<select>`s. There are no
 * server-rendered options, so the page object must wait for the options to
 * populate before selecting (encapsulated in {@link transfer}). Submitting the
 * form does NOT navigate: the app `preventDefault`s, POSTs over AJAX, then hides
 * the form and reveals an in-place "Transfer Complete!" confirmation panel
 * (`#showResult`). The actual balance change is therefore asserted elsewhere
 * (Account Overview); this page only confirms the transfer was accepted.
 *
 * Locator strategy (layered):
 *   - Headings via `getByRole('heading', ...)` (role-first, layer 1).
 *   - The two account dropdowns and the amount input carry stable ids
 *     (`#fromAccountId`, `#toAccountId`, `#amount`) but no accessible name or
 *     `name=` we can target by role/label, so they use id CSS (layer 2).
 *   - The submit control is an `<input type="submit" value="Transfer">`, an
 *     accessible button, so it uses the role-first locator (layer 1).
 *   - Confirmation values are read from their stable result-span ids.
 */
export class TransferPage extends BasePage {
  readonly leftNav: LeftNavPanel;
  readonly heading: Locator;
  readonly amountInput: Locator;
  readonly fromAccountSelect: Locator;
  readonly toAccountSelect: Locator;
  readonly transferButton: Locator;
  /** The "Transfer Complete!" confirmation heading shown in place after submit. */
  readonly confirmationHeading: Locator;
  /** The confirmed amount, formatted as currency (e.g. `"$100.00"`). */
  readonly resultAmount: Locator;
  /** The confirmed source account id. */
  readonly resultFromAccount: Locator;
  /** The confirmed destination account id. */
  readonly resultToAccount: Locator;

  constructor(page: Page) {
    super(page);
    this.leftNav = new LeftNavPanel(page);
    this.heading = this.page.getByRole('heading', { name: 'Transfer Funds' });
    // Stable ids, but no role/label/name to anchor on -> id CSS (layer 2).
    this.amountInput = this.page.locator('#amount');
    this.fromAccountSelect = this.page.locator('#fromAccountId');
    this.toAccountSelect = this.page.locator('#toAccountId');
    // Accessible submit button -> role-first (layer 1).
    this.transferButton = this.page.getByRole('button', { name: 'Transfer' });
    this.confirmationHeading = this.page.getByRole('heading', { name: 'Transfer Complete!' });
    this.resultAmount = this.page.locator('#amountResult');
    this.resultFromAccount = this.page.locator('#fromAccountIdResult');
    this.resultToAccount = this.page.locator('#toAccountIdResult');
  }

  /** Navigate directly to the Transfer Funds page. */
  async goto(): Promise<void> {
    await this.navigate('transfer.htm');
  }

  /**
   * Assert the form is ready to use: the heading is shown and the account
   * dropdowns have been populated by the page's AJAX account fetch. Web-first
   * assertions (auto-waiting), no fixed timeouts — this is what prevents a race
   * with the dynamic `<option>` injection.
   */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.amountInput).toBeVisible();
    // Options are appended by AJAX; wait until at least one real account option
    // exists in each dropdown before any selection is attempted.
    await expect(this.fromAccountSelect.locator('option')).not.toHaveCount(0);
    await expect(this.toAccountSelect.locator('option')).not.toHaveCount(0);
  }

  /**
   * Perform a UI transfer of `amount` from `fromAccountId` to `toAccountId`,
   * then wait for the in-place "Transfer Complete!" confirmation.
   *
   * Selects the accounts by their seeded ids (the option `value`s), so the test
   * controls exactly which accounts move money regardless of dropdown order.
   */
  async transfer(amount: number, fromAccountId: number, toAccountId: number): Promise<void> {
    await this.expectLoaded();
    await this.amountInput.fill(String(amount));
    await this.fromAccountSelect.selectOption(String(fromAccountId));
    await this.toAccountSelect.selectOption(String(toAccountId));
    await this.transferButton.click();
    await this.expectTransferComplete();
  }

  /**
   * Assert the in-place confirmation panel is shown after a successful transfer.
   * Submitting does not navigate, so this simply waits for the "Transfer
   * Complete!" heading to become visible.
   */
  async expectTransferComplete(): Promise<void> {
    await expect(this.confirmationHeading).toBeVisible();
  }
}
