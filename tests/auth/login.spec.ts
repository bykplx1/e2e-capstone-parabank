import { test, expect } from '../../src/fixtures/test';
import { LoginPage } from '../../src/pages/LoginPage';
import { AccountOverviewPage } from '../../src/pages/AccountOverviewPage';

/**
 * UI login verification (the acceptance test for issue #4).
 *
 * A `registeredUser` is created headlessly via form-POST (the existing fixture);
 * here we drive a REAL browser login through the login FORM, exercising the
 * page objects exactly as journey tests will. No raw locators live in this
 * spec — everything is encapsulated behind {@link LoginPage} and
 * {@link AccountOverviewPage}.
 */
test.describe('UI login', () => {
  test('a registered user logs in through the form and lands on Account Overview', async ({
    page,
    registeredUser,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(registeredUser.username, registeredUser.password);

    const overviewPage = new AccountOverviewPage(page);
    await overviewPage.expectLoaded();
    await expect(overviewPage.accountsTable).toBeVisible();
    expect(await overviewPage.accountIds()).toContain(registeredUser.accounts[0]!.id);
  });
});
