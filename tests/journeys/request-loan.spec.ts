import { test, expect } from '../../src/fixtures/test';
import { RequestLoanPage } from '../../src/pages/RequestLoanPage';

/**
 * Journey: Request a loan and wait for the async approval/denial to settle
 * (the acceptance test for issue #7).
 *
 * A guaranteed-funded checking account is seeded by the `fundedAccount` fixture
 * (REUSED, not recreated); declaring it also leaves the browser logged in as
 * that customer. The journey drives the real UI: navigate to Request Loan via
 * the left-nav, submit a loan request, then WEB-FIRST-wait for the server-side
 * decision to settle in the result region.
 *
 * ParaBank's approve/deny is computed server-side and is sensitive to the
 * amount/down-payment/balance triple, so this test does NOT hard-assert a
 * specific outcome. Instead it asserts the decision SETTLED to a valid outcome
 * and that the UI is internally consistent with it (approved → a new loan
 * account id link appears; denied → no new account, with an optional reason).
 * The wait itself is encapsulated in
 * {@link RequestLoanPage.waitForSettledDecision} as an auto-retrying web-first
 * assertion — there is no `waitForTimeout` anywhere.
 *
 * Async-timing note (public instance): the loan provider is slow and frequently
 * settles to a `error.timeout` DENIAL after ~30s, which the page renders with
 * an EMPTY reason. The journey treats that as a legitimate settled denial.
 */
test.describe('Request loan (async approval)', () => {
  // The async loan decision alone can take ~30s on the public instance (the
  // loan provider often settles to an `error.timeout` denial). Give the whole
  // journey — seed + login + that wait — generous headroom over the default 30s
  // per-test budget so a slow-but-valid settle is never killed by the runner.
  test.setTimeout(120_000);

  test('submits a loan request and the async decision settles in the UI', async ({
    authenticatedPage,
    fundedAccount,
  }) => {
    const requestLoan = new RequestLoanPage(authenticatedPage);
    await requestLoan.goto();

    // Down payment is kept within the funded balance, per the journey contract.
    const downPayment = Math.floor(fundedAccount.balance / 2);
    await requestLoan.submit(1000, downPayment, fundedAccount.accountId);

    const decision = await requestLoan.waitForSettledDecision();

    // The decision settled to a definite, valid outcome...
    expect(decision.status).toMatch(/^(Approved|Denied)$/);

    // ...and the UI is consistent with whichever outcome the server chose.
    if (decision.status === 'Approved') {
      expect(decision.newAccountId).toBeTruthy();
      expect(decision.denialReason).toBeNull();
    } else {
      // Denied: no new loan account. A reason may or may not be present
      // (empty for a provider `error.timeout` denial).
      expect(decision.newAccountId).toBeNull();
    }
  });
});
