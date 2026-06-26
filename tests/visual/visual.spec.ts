import { test, expect } from '../../src/fixtures/test';
import { AccountOverviewPage } from '../../src/pages/AccountOverviewPage';
import { TransferPage } from '../../src/pages/TransferPage';

/**
 * Visual regression snapshots (issue #12).
 *
 * CHROMIUM-ONLY by configuration: these specs only run under the `visual`
 * Playwright project (`testMatch: /tests\/visual\//`), which uses Desktop
 * Chrome. The functional `chromium` project ignores this directory, so a pixel
 * diff never blocks the functional gate. Other rendering engines are a
 * deliberate skip — see playwright.config.ts for the rationale.
 *
 * Every ParaBank screen is PER-USER and PER-RUN dynamic: account numbers,
 * balances, dates and confirmation values change on every test run (each test
 * registers a fresh customer). Those cells are therefore MASKED with `mask:` so
 * the snapshot captures only the stable layout/chrome, never volatile data.
 * Without masking these baselines would never reproduce.
 *
 * State is reached purely through the existing page objects and fixtures
 * (web-first / auto-waiting via expectLoaded / expectTransferComplete) — no
 * fixed timeouts.
 */
test.describe('Visual regression', () => {
  test('Account Overview layout is stable', async ({ authenticatedPage }) => {
    const overview = new AccountOverviewPage(authenticatedPage);
    await overview.goto();
    await overview.expectLoaded();

    await expect(authenticatedPage).toHaveScreenshot('account-overview.png', {
      maxDiffPixelRatio: 0.01,
      // Mask every dynamic cell: the account-id links and their balance/available
      // columns (all <td>s in the table body), plus the per-user welcome name.
      mask: [
        authenticatedPage.locator('#accountTable tbody td'),
        authenticatedPage.locator('.smallText'),
      ],
    });
  });

  test('Transaction History (Account Activity) layout is stable', async ({
    authenticatedPage,
    userWithTwoAccounts,
    api,
  }) => {
    const { fromAccountId, toAccountId } = userWithTwoAccounts;

    // Seed a transaction so the activity table has content to lay out.
    await api.transfer(fromAccountId, toAccountId, 50);

    // Reach the activity page the way a user does: click the account-id link on
    // the overview, which navigates to activity.htm?id=<fromAccountId>.
    const overview = new AccountOverviewPage(authenticatedPage);
    await overview.goto();
    await overview.expectLoaded();
    await authenticatedPage.getByRole('link', { name: String(fromAccountId) }).click();

    // Account Activity page: heading + the account-details block + transactions
    // table all render server-side. Wait web-first for the heading and table.
    const activityHeading = authenticatedPage.getByRole('heading', { name: 'Account Activity' });
    const transactionTable = authenticatedPage.locator('#transactionTable');
    await expect(activityHeading).toBeVisible();
    await expect(transactionTable).toBeVisible();

    await expect(authenticatedPage).toHaveScreenshot('transaction-history.png', {
      maxDiffPixelRatio: 0.01,
      // Mask the dynamic account-detail spans (id / balances) and every cell in
      // the transactions table (dates, descriptions, amounts).
      mask: [
        authenticatedPage.locator('#accountId'),
        authenticatedPage.locator('#balance'),
        authenticatedPage.locator('#availableBalance'),
        authenticatedPage.locator('#transactionTable tbody td'),
      ],
    });
  });

  test('Transfer confirmation panel layout is stable', async ({
    authenticatedPage,
    userWithTwoAccounts,
  }) => {
    const { fromAccountId, toAccountId } = userWithTwoAccounts;

    const transfer = new TransferPage(authenticatedPage);
    await transfer.goto();
    await transfer.transfer(100, fromAccountId, toAccountId);
    // expectTransferComplete (inside transfer) already waited for #showResult.

    await expect(authenticatedPage).toHaveScreenshot('transfer-confirmation.png', {
      maxDiffPixelRatio: 0.01,
      // The confirmation echoes the amount and both account ids — all per-user
      // dynamic, so mask them.
      mask: [transfer.resultAmount, transfer.resultFromAccount, transfer.resultToAccount],
    });
  });
});
