import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { LeftNavPanel } from './components/LeftNavPanel';

/** A settled loan decision as reflected by the result region of the page. */
export interface LoanDecision {
  /** The decision the server settled on. */
  status: 'Approved' | 'Denied';
  /** The new loan account id (string as shown in the link) — only when approved. */
  newAccountId: string | null;
  /**
   * The denial reason text — only when denied, and only when the server
   * supplied one. The public ParaBank loan provider can settle a denial with
   * `error.timeout`, for which the page renders an EMPTY reason; in that case
   * this is `null`. So a denial is valid with or without a reason.
   */
  denialReason: string | null;
}

/**
 * Upper bound for the async loan decision to settle. The public ParaBank loan
 * provider is slow and has been observed taking ~30s to respond (often
 * settling to a `error.timeout` denial), so the web-first wait below is given
 * generous headroom over that. This is a CAP for auto-retrying assertions, not
 * a fixed sleep — a fast response still settles immediately.
 */
const DECISION_TIMEOUT_MS = 60_000;

/**
 * The Request Loan page (`requestloan.htm`).
 *
 * Composes the shared {@link LeftNavPanel}. The form has three inputs — loan
 * amount, down payment, and the funding account — and an "Apply Now" button.
 *
 * Async-decision behaviour (verified live, 2026-06-26): "Apply Now" is NOT a
 * form submit. It is a plain `<input type="button">` whose click fires an AJAX
 * POST to `requestLoan`. On the response the page hides the form
 * (`#requestLoanForm`) and reveals a result region (`#requestLoanResult`, which
 * starts `display:none`) where `#loanStatus` becomes the literal text
 * "Approved" or "Denied" and exactly one of two sub-panels is shown:
 *   - `#loanRequestApproved` — carries the new loan account id link
 *     (`#newAccountId`).
 *   - `#loanRequestDenied` — carries the denial reason (`p.error`).
 * There is no page navigation; the right panel mutates in place.
 *
 * Locator strategy (layered): the form inputs and result nodes are addressed by
 * their stable ids (the markup gives the inputs no name/label/role text to hook
 * on, so id is the robust layer here); the "Apply Now" control is addressed by
 * role+name (`getByRole('button', { name: 'Apply Now' })`).
 */
export class RequestLoanPage extends BasePage {
  readonly leftNav: LeftNavPanel;
  readonly heading: Locator;
  readonly amountInput: Locator;
  readonly downPaymentInput: Locator;
  readonly fromAccountSelect: Locator;
  readonly applyButton: Locator;

  // Result region.
  private readonly result: Locator;
  private readonly statusCell: Locator;
  private readonly approvedPanel: Locator;
  private readonly deniedPanel: Locator;
  private readonly newAccountIdLink: Locator;
  private readonly denialReason: Locator;

  constructor(page: Page) {
    super(page);
    this.leftNav = new LeftNavPanel(page);
    this.heading = this.page.getByRole('heading', { name: 'Apply for a Loan' });
    this.amountInput = this.page.locator('#amount');
    this.downPaymentInput = this.page.locator('#downPayment');
    this.fromAccountSelect = this.page.locator('#fromAccountId');
    // It is a real button control with accessible name "Apply Now".
    this.applyButton = this.page.getByRole('button', { name: 'Apply Now' });

    this.result = this.page.locator('#requestLoanResult');
    this.statusCell = this.page.locator('#loanStatus');
    this.approvedPanel = this.page.locator('#loanRequestApproved');
    this.deniedPanel = this.page.locator('#loanRequestDenied');
    this.newAccountIdLink = this.page.locator('#newAccountId');
    this.denialReason = this.deniedPanel.locator('p.error');
  }

  /** Navigate to the Request Loan page via the left-nav (the user journey). */
  async goto(): Promise<void> {
    await this.leftNav.goToRequestLoan();
    await expect(this.heading).toBeVisible();
    await expect(this.applyButton).toBeVisible();
  }

  /**
   * Fill the loan form and submit it.
   *
   * @param amount loan amount requested.
   * @param downPayment down payment offered (must be ≤ the funding balance).
   * @param fromAccountId the funding account; selected by its option value.
   */
  async submit(amount: number, downPayment: number, fromAccountId: number): Promise<void> {
    await this.amountInput.fill(String(amount));
    await this.downPaymentInput.fill(String(downPayment));
    await this.fromAccountSelect.selectOption(String(fromAccountId));
    await this.applyButton.click();
  }

  /**
   * WEB-FIRST wait for the async decision to SETTLE, then return it.
   *
   * This is the resilience point of the journey. The decision is computed
   * server-side and the right panel updates in place via AJAX — there is no
   * navigation to await. Rather than a fixed timeout, we lean on auto-retrying
   * web-first assertions that only pass once the page has reached a definite,
   * self-consistent end state:
   *   1. the result region is visible (the AJAX response has been applied), and
   *   2. `#loanStatus` reads exactly "Approved" or "Denied" (it is empty until
   *      the response lands), which is the single settle signal.
   * Both assertions auto-retry up to {@link DECISION_TIMEOUT_MS}, so the slow
   * public loan provider simply means a later — never a flaky — pass.
   *
   * Once settled, we read the matching sub-panel: on approval the new loan
   * account id (also asserted visible so we never read a half-rendered link);
   * on denial the reason text when the server provided one (it is empty for a
   * provider `error.timeout` denial — see {@link LoanDecision.denialReason}).
   */
  async waitForSettledDecision(): Promise<LoanDecision> {
    await expect(this.result).toBeVisible({ timeout: DECISION_TIMEOUT_MS });
    // The single source of truth for "settled": the status text is definite.
    await expect(this.statusCell).toHaveText(/^(Approved|Denied)$/, {
      timeout: DECISION_TIMEOUT_MS,
    });
    const status = (await this.statusCell.innerText()).trim() as 'Approved' | 'Denied';

    if (status === 'Approved') {
      await expect(this.approvedPanel).toBeVisible();
      await expect(this.newAccountIdLink).toBeVisible();
      const newAccountId = (await this.newAccountIdLink.innerText()).trim();
      return { status, newAccountId, denialReason: null };
    }

    await expect(this.deniedPanel).toBeVisible();
    // Reason is best-effort: present for `error.insufficient.*` denials, empty
    // for a provider `error.timeout` denial. Normalise empty → null.
    const reasonText = (await this.denialReason.innerText()).trim();
    return { status, newAccountId: null, denialReason: reasonText.length > 0 ? reasonText : null };
  }
}
