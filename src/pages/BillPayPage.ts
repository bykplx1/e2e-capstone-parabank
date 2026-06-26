import { expect, type Locator, type Page } from '@playwright/test';
import type { Payee } from '../api/types';
import { BasePage } from './BasePage';
import { LeftNavPanel } from './components/LeftNavPanel';

/**
 * The Bill Payment Service page (`billpay.htm`).
 *
 * Composes the shared {@link LeftNavPanel} and encapsulates every locator on the
 * bill-pay form so tests speak only in banking intent — fill a {@link Payee},
 * pick a source account, send the payment — never in raw DOM.
 *
 * Locator strategy (layered policy):
 *   - The page/confirmation headings use `getByRole('heading', { name })`
 *     (role-first, layer 1).
 *   - The form inputs carry NO `<label for>` and no accessible name (ParaBank
 *     renders bold `<b>` cells as pseudo-labels, not real labels), so they fall
 *     to the next layer: stable `name=` attribute CSS (`[name="payee.name"]` …).
 *   - The submit control is an `<input type="button" value="Send Payment">`,
 *     which exposes an accessible name via its value, so it is role-first again.
 *
 * Confirmation model: on success ParaBank hides the form (`#billpayForm`) and
 * reveals `#billpayResult` ("Bill Payment Complete"), naming the payee
 * (`#payeeName`) and amount (`#amount`, e.g. `$25.00`). Those id-scoped spans
 * are exposed as intent-level reads so the test asserts on domain values.
 */
export class BillPayPage extends BasePage {
  readonly leftNav: LeftNavPanel;
  readonly heading: Locator;

  private readonly payeeNameInput: Locator;
  private readonly payeeStreetInput: Locator;
  private readonly payeeCityInput: Locator;
  private readonly payeeStateInput: Locator;
  private readonly payeeZipCodeInput: Locator;
  private readonly payeePhoneInput: Locator;
  private readonly payeeAccountInput: Locator;
  private readonly verifyAccountInput: Locator;
  private readonly amountInput: Locator;
  private readonly fromAccountSelect: Locator;
  private readonly sendPaymentButton: Locator;

  private readonly result: Locator;
  /** The confirmation heading shown on success. */
  readonly confirmationHeading: Locator;
  /** The payee name echoed back in the confirmation. */
  readonly confirmedPayeeName: Locator;
  /** The amount echoed back in the confirmation (formatted, e.g. `$25.00`). */
  readonly confirmedAmount: Locator;
  /** The source account id echoed back in the confirmation. */
  readonly confirmedFromAccountId: Locator;

  constructor(page: Page) {
    super(page);
    this.leftNav = new LeftNavPanel(page);
    this.heading = this.page.getByRole('heading', { name: 'Bill Payment Service' });

    // No labels/roles on these inputs -> name-attribute CSS (layer 2).
    this.payeeNameInput = this.page.locator('input[name="payee.name"]');
    this.payeeStreetInput = this.page.locator('input[name="payee.address.street"]');
    this.payeeCityInput = this.page.locator('input[name="payee.address.city"]');
    this.payeeStateInput = this.page.locator('input[name="payee.address.state"]');
    this.payeeZipCodeInput = this.page.locator('input[name="payee.address.zipCode"]');
    this.payeePhoneInput = this.page.locator('input[name="payee.phoneNumber"]');
    this.payeeAccountInput = this.page.locator('input[name="payee.accountNumber"]');
    this.verifyAccountInput = this.page.locator('input[name="verifyAccount"]');
    this.amountInput = this.page.locator('input[name="amount"]');
    this.fromAccountSelect = this.page.locator('select[name="fromAccountId"]');
    // Submit input exposes an accessible name via its value -> role-first (layer 1).
    this.sendPaymentButton = this.page.getByRole('button', { name: 'Send Payment' });

    this.result = this.page.locator('#billpayResult');
    this.confirmationHeading = this.page.getByRole('heading', { name: 'Bill Payment Complete' });
    this.confirmedPayeeName = this.result.locator('#payeeName');
    this.confirmedAmount = this.result.locator('#amount');
    this.confirmedFromAccountId = this.result.locator('#fromAccountId');
  }

  /** Navigate directly to the bill-pay page and wait for the form to render. */
  async goto(): Promise<void> {
    await this.navigate('billpay.htm');
    await expect(this.heading).toBeVisible();
    await expect(this.payeeNameInput).toBeVisible();
  }

  /**
   * Pay a bill: fill the payee details and amount, choose the source account,
   * and submit. The source account id is selected by its visible option value.
   *
   * Mirrors the live form precisely: the payee account number must be entered
   * twice (account + verify-account), or ParaBank's client-side validation
   * blocks submission.
   */
  async payBill(payee: Payee, amount: number, fromAccountId: number): Promise<void> {
    await this.payeeNameInput.fill(payee.name);
    await this.payeeStreetInput.fill(payee.address.street);
    await this.payeeCityInput.fill(payee.address.city);
    await this.payeeStateInput.fill(payee.address.state);
    await this.payeeZipCodeInput.fill(payee.address.zipCode);
    await this.payeePhoneInput.fill(payee.phoneNumber);
    await this.payeeAccountInput.fill(payee.accountNumber);
    await this.verifyAccountInput.fill(payee.accountNumber);
    await this.amountInput.fill(String(amount));
    await this.fromAccountSelect.selectOption(String(fromAccountId));
    await this.sendPaymentButton.click();
  }

  /**
   * Assert the on-screen "Bill Payment Complete" confirmation is shown and
   * names the expected payee, amount, and source account. Web-first
   * assertions throughout (auto-waiting); no fixed timeouts.
   *
   * @param amountText the formatted amount as rendered, e.g. `$25.00`.
   */
  async expectConfirmation(
    payeeName: string,
    amountText: string,
    fromAccountId: number,
  ): Promise<void> {
    await expect(this.confirmationHeading).toBeVisible();
    await expect(this.confirmedPayeeName).toHaveText(payeeName);
    await expect(this.confirmedAmount).toHaveText(amountText);
    await expect(this.confirmedFromAccountId).toHaveText(String(fromAccountId));
  }
}
