import { test, expect } from '../../src/fixtures/test';
import { TransferPage } from '../../src/pages/TransferPage';
import { AccountOverviewPage } from '../../src/pages/AccountOverviewPage';

/**
 * Journey: Transfer funds (issue #6).
 *
 * Begins fully seeded via `userWithTwoAccounts` — a funded checking
 * (`fromAccountId`) and a freshly opened savings (`toAccountId`) — and the
 * browser is already logged in as that user (`authenticatedPage`). The test
 * therefore exercises TRANSFER LOGIC, not account-creation plumbing.
 *
 * It captures both balances on the Account Overview BEFORE the transfer, drives
 * a UI transfer of a fixed amount through {@link TransferPage}, confirms the
 * in-place "Transfer Complete!" panel, then re-reads the overview and asserts on
 * screen that the source was DEBITED and the destination CREDITED by the EXACT
 * amount. All transfer-form locators live in the page object; no raw locators in
 * this spec. Web-first assertions throughout — no fixed timeouts.
 */
test.describe('Transfer funds', () => {
  test('debits the source and credits the destination by the exact amount', async ({
    authenticatedPage,
    userWithTwoAccounts,
  }) => {
    const { fromAccountId, toAccountId } = userWithTwoAccounts;
    const amount = 100;

    const overviewPage = new AccountOverviewPage(authenticatedPage);
    await overviewPage.goto();
    await overviewPage.expectLoaded();

    // Capture the on-screen balances before the transfer.
    const sourceBefore = parseDollars(await overviewPage.balanceFor(fromAccountId).innerText());
    const destBefore = parseDollars(await overviewPage.balanceFor(toAccountId).innerText());

    // Perform the UI transfer.
    const transferPage = new TransferPage(authenticatedPage);
    await transferPage.goto();
    await transferPage.transfer(amount, fromAccountId, toAccountId);

    // The confirmation reflects the exact amount and accounts, in place.
    await expect(transferPage.resultAmount).toHaveText(formatDollars(amount));
    await expect(transferPage.resultFromAccount).toHaveText(String(fromAccountId));
    await expect(transferPage.resultToAccount).toHaveText(String(toAccountId));

    // Back on the overview, the source is debited and the destination credited
    // by EXACTLY the transferred amount — asserted on screen, web-first.
    await overviewPage.goto();
    await overviewPage.expectLoaded();
    await expect(overviewPage.balanceFor(fromAccountId)).toHaveText(
      formatDollars(sourceBefore - amount),
    );
    await expect(overviewPage.balanceFor(toAccountId)).toHaveText(
      formatDollars(destBefore + amount),
    );
  });
});

/** Parse a ParaBank balance cell (e.g. `"$515.50"`, `"-$80.00"`) to a number. */
function parseDollars(text: string): number {
  const negative = text.includes('-');
  const digits = text.replace(/[^0-9.]/g, '');
  const value = Number(digits);
  return negative ? -value : value;
}

/** Format a number the way ParaBank renders balances (e.g. `"$415.50"`). */
function formatDollars(amount: number): string {
  const negative = amount < 0;
  const body = Math.abs(amount).toFixed(2);
  return negative ? `-$${body}` : `$${body}`;
}
