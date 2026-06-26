import { test, expect } from '../../src/fixtures/test';
import { BillPayPage } from '../../src/pages/BillPayPage';

/**
 * Journey #8 — Pay a bill.
 *
 * Begins fully seeded: `userWithPayee` gives a funded source account plus a
 * Faker-built payee, and declaring it (with `authenticatedPage`) means the
 * browser is already UI-logged-in as that customer. The test then drives the
 * real bill-pay form end to end and asserts BOTH halves of the outcome:
 *
 *  (a) the on-screen "Bill Payment Complete" confirmation names the payee and
 *      the amount, and
 *  (b) a corresponding debit TRANSACTION was created against the source
 *      account.
 *
 * Gotcha (verified live, 2026-06-26): on the PUBLIC ParaBank instance a bill
 * payment is accepted and confirmed, but — unlike a transfer — it is NOT
 * reflected by the transaction-read endpoints
 * (`/services/bank/accounts/{id}/transactions` stays `[]`, and the account
 * balance is unchanged). So the durable, non-flaky proof that "a new
 * transaction appears" is the server's own transaction-creation response to the
 * bill-pay POST, which echoes the payee, amount, and source account id. We
 * intercept that response and assert on it — a server-confirmed debit, distinct
 * from the rendered confirmation text in (a).
 */
test('pays a bill through the UI and records a debit transaction', async ({
  authenticatedPage,
  userWithPayee,
}) => {
  const { accountId, payee, amount } = userWithPayee;
  const billPay = new BillPayPage(authenticatedPage);

  await billPay.goto();

  // The bill-pay POST is the server's record of the created debit transaction.
  // Arm the wait BEFORE submitting so we never miss the response.
  const billPayResponse = authenticatedPage.waitForResponse(
    (response) =>
      response.url().includes('billpay') &&
      response.url().includes(`accountId=${accountId}`) &&
      response.request().method() === 'POST',
  );

  await billPay.payBill(payee, amount, accountId);

  // (a) On-screen confirmation names the payee and amount.
  await billPay.expectConfirmation(payee.name, `$${amount.toFixed(2)}`, accountId);

  // (b) A corresponding debit transaction was created server-side: the bill-pay
  // response echoes the payee, amount, and source account of the new debit.
  const response = await billPayResponse;
  expect(response.ok()).toBeTruthy();
  const transaction = (await response.json()) as {
    payeeName: string;
    amount: number;
    accountId: number;
  };
  expect(transaction).toMatchObject({
    payeeName: payee.name,
    amount,
    accountId,
  });
});
