import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { LeftNavPanel } from './components/LeftNavPanel';

/**
 * The Accounts Overview page (`overview.htm`) shown right after login.
 *
 * Composes the shared {@link LeftNavPanel}. Exposes the accounts table and
 * intent-level reads (the list of account ids) so tests assert on domain data,
 * never on raw DOM.
 *
 * Locator strategy (layered):
 *   - Page heading via `getByRole('heading', { name: 'Accounts Overview' })`
 *     (role-first, layer 1).
 *   - The accounts table is identified by its stable `#accountTable` id and
 *     then read structurally: each balance-bearing data row links its account
 *     id in the first cell, so we anchor on those `<a>` links inside the table
 *     body. This text-anchored structural approach deliberately skips the
 *     trailing "Total" summary row, which has no id link.
 */
export class AccountOverviewPage extends BasePage {
  readonly leftNav: LeftNavPanel;
  readonly heading: Locator;
  readonly accountsTable: Locator;
  /** The account-id links in the table body (one per real account row). */
  readonly accountIdLinks: Locator;

  constructor(page: Page) {
    super(page);
    this.leftNav = new LeftNavPanel(page);
    this.heading = this.page.getByRole('heading', { name: 'Accounts Overview' });
    this.accountsTable = this.page.locator('#accountTable');
    // Structural, anchored inside the table: account rows render their id as a
    // link; the "Total" row does not, so this naturally excludes it.
    this.accountIdLinks = this.accountsTable.locator('tbody tr td a');
  }

  /** Navigate directly to the overview page. */
  async goto(): Promise<void> {
    await this.navigate('overview.htm');
  }

  /**
   * Assert the page has loaded: the heading is shown, the accounts table is
   * visible, and at least one account row has rendered. Uses web-first
   * assertions (auto-waiting), no fixed timeouts.
   */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.accountsTable).toBeVisible();
    // The table body renders its rows server-side; wait for the first account
    // id link so later structural reads (accountIds) never race an empty table.
    await expect(this.accountIdLinks.first()).toBeVisible();
  }

  /** The numeric account ids listed in the table, in display order. */
  async accountIds(): Promise<number[]> {
    // Web-first: ensure at least one id link is attached before reading text,
    // so this never returns an empty list against a still-rendering table.
    await expect(this.accountIdLinks.first()).toBeVisible();
    const texts = await this.accountIdLinks.allInnerTexts();
    return texts.map((t) => Number(t.trim())).filter((n) => Number.isFinite(n));
  }

  /** The balance cell text for a given account id (e.g. `"$515.50"`). */
  balanceFor(accountId: number): Locator {
    return this.accountsTable
      .locator('tbody tr', { has: this.page.getByRole('link', { name: String(accountId) }) })
      .locator('td')
      .nth(1);
  }
}
