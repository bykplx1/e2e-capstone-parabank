import { test, expect } from '../../src/fixtures/test';
import { UserFactory } from '../../src/support/UserFactory';
import { RegisterPage } from '../../src/pages/RegisterPage';
import { OpenAccountPage } from '../../src/pages/OpenAccountPage';
import { AccountOverviewPage } from '../../src/pages/AccountOverviewPage';

/**
 * Journey (issue #5): a brand-new customer registers through the real UI, then
 * opens a new account through the Open New Account UI and confirms it shows up
 * on the Account Overview.
 *
 * Parallel-safe: the test owns its own unique {@link UserFactory} user, so it
 * does not share state with any other test or worker. It does NOT use the
 * `registeredUser`/`authenticatedPage` fixtures because registration is the
 * behavior under test — it must drive the real registration form itself.
 *
 * After a successful registration ParaBank auto-creates one funded CHECKING
 * account and logs the user in, so "open first account" here means opening a
 * further account via the Open New Account page (funded from that initial
 * account) and asserting it appears on the overview. All locators are
 * encapsulated in the page objects; the spec body holds none.
 */
test.describe('Journey: register and open an account (UI)', () => {
  test('registers a new customer and opens an account that appears on the overview', async ({
    page,
  }) => {
    const user = UserFactory.makeUser();

    // --- Slice 1: register through the form and assert the Welcome state. ---
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.register(user);
    await registerPage.expectRegistered(user.username);

    // --- Slice 2: open a new account via the UI, funded from the initial one. ---
    const overviewPage = new AccountOverviewPage(page);
    await overviewPage.goto();
    await overviewPage.expectLoaded();
    const initialAccountIds = await overviewPage.accountIds();
    expect(initialAccountIds.length).toBeGreaterThan(0);
    const fundingAccountId = initialAccountIds[0]!;

    const openAccountPage = new OpenAccountPage(page);
    await openAccountPage.goto();
    await openAccountPage.expectLoaded();
    await openAccountPage.openAccount('SAVINGS', fundingAccountId);
    const newAccountId = await openAccountPage.newlyOpenedAccountId();
    expect(newAccountId).toBeGreaterThan(0);
    expect(initialAccountIds).not.toContain(newAccountId);

    // The new account must be listed on the Account Overview.
    await overviewPage.goto();
    await overviewPage.expectLoaded();
    expect(await overviewPage.accountIds()).toContain(newAccountId);
  });
});
