import type { Locator, Page } from '@playwright/test';

/**
 * The authenticated left-hand navigation panel ("Account Services").
 *
 * A COMPONENT object — not a page. It is shared by every post-login screen, so
 * it lives once here and is composed into page objects (e.g. the Account
 * Overview page exposes it). It owns the nav links and the Log Out action.
 *
 * Locator strategy (layered, role-first): the panel is `#leftPanel` and every
 * item is a real anchor, so `getByRole('link', { name })` is both the most
 * robust and the most readable choice — no CSS fallbacks are needed here.
 */
export class LeftNavPanel {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = this.page.locator('#leftPanel');
  }

  private link(name: string): Locator {
    return this.root.getByRole('link', { name, exact: true });
  }

  get openNewAccountLink(): Locator {
    return this.link('Open New Account');
  }

  get accountsOverviewLink(): Locator {
    return this.link('Accounts Overview');
  }

  get transferFundsLink(): Locator {
    return this.link('Transfer Funds');
  }

  get billPayLink(): Locator {
    return this.link('Bill Pay');
  }

  get requestLoanLink(): Locator {
    return this.link('Request Loan');
  }

  get logOutLink(): Locator {
    return this.link('Log Out');
  }

  async openNewAccount(): Promise<void> {
    await this.openNewAccountLink.click();
  }

  async goToAccountsOverview(): Promise<void> {
    await this.accountsOverviewLink.click();
  }

  async goToTransferFunds(): Promise<void> {
    await this.transferFundsLink.click();
  }

  async goToBillPay(): Promise<void> {
    await this.billPayLink.click();
  }

  async goToRequestLoan(): Promise<void> {
    await this.requestLoanLink.click();
  }

  async logOut(): Promise<void> {
    await this.logOutLink.click();
  }
}
