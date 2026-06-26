import { test as base, request as playwrightRequest, type Page } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ParaBankApiClient } from '../api/ParaBankApiClient';
import { AccountType, type Account, type Payee } from '../api/types';
import { UserFactory } from '../support/UserFactory';
import { LoginPage } from '../pages/LoginPage';
import { AccountOverviewPage } from '../pages/AccountOverviewPage';

/**
 * The value the `registeredUser` fixture resolves to: everything a test needs
 * to act as an already-onboarded customer without repeating the registration
 * dance. `username`/`password` are the freshly created credentials; `customerId`
 * and `accounts` are the server's view of that customer right after sign-up.
 */
export interface RegisteredUser {
  username: string;
  password: string;
  customerId: number;
  accounts: Account[];
}

/**
 * A `registeredUser` whose primary checking account has a 2nd (savings) account
 * opened alongside it — the seed for the Transfer journey (#6). `fromAccountId`
 * is the funded initial checking account; `toAccountId` is the newly opened
 * savings account.
 */
export interface UserWithTwoAccounts extends RegisteredUser {
  fromAccountId: number;
  toAccountId: number;
}

/**
 * A guaranteed-funded source account — the seed for the Request Loan journey
 * (#7). `accountId` is the initial checking account; `balance` is its
 * server-reported balance at seed time.
 */
export interface FundedAccount {
  customerId: number;
  accountId: number;
  balance: number;
}

/**
 * A funded account plus a ready-to-use {@link Payee} and a suggested `amount` —
 * the seed for the Pay Bill journey (#8). ParaBank does not pre-register
 * payees; the payee is built with Faker and supplied to `payBill` at call time.
 */
export interface UserWithPayee {
  customerId: number;
  accountId: number;
  payee: Payee;
  amount: number;
}

/**
 * Fixtures provided by this module.
 *
 * Issue #4 EXTENDS the original `api`/`registeredUser` base with a real UI-login
 * `authenticatedPage` and three composed seeding fixtures (`userWithTwoAccounts`,
 * `fundedAccount`, `userWithPayee`). The layered fixtures are pre-staged HERE so
 * journey issues #5–#8 can run in parallel later WITHOUT editing this file
 * (no merge conflicts) — each consumes the fixtures it needs by name.
 */
export interface ApiFixtures {
  /** A {@link ParaBankApiClient} bound to a per-test API request context. */
  api: ParaBankApiClient;
  /** A freshly registered, immediately usable customer. */
  registeredUser: RegisteredUser;
  /**
   * A browser {@link Page} logged in for {@link registeredUser} through the UI
   * login FORM (real server-side `JSESSIONID` session — NOT a token/API login).
   * Resolves on the Account Overview page.
   */
  authenticatedPage: Page;
  /** {@link registeredUser} + a freshly opened savings account. For #6 Transfer. */
  userWithTwoAccounts: UserWithTwoAccounts;
  /** A guaranteed-funded source account. For #7 Request Loan. */
  fundedAccount: FundedAccount;
  /** A funded account + a ready payee. For #8 Pay Bill. */
  userWithPayee: UserWithPayee;
}

export const test = base.extend<ApiFixtures>({
  // A dedicated request context per test keeps cookies (e.g. the registration
  // JSESSIONID) isolated between parallel workers. baseURL flows in from the
  // Playwright config; the client owns the `/parabank` context path.
  api: async ({ baseURL }, use) => {
    const context: APIRequestContext = await playwrightRequest.newContext({ baseURL });
    await use(new ParaBankApiClient(context));
    await context.dispose();
  },

  // Register a brand-new user via form-POST, then hand back the server's view
  // of them (customer id + accounts) so dependent tests start fully seeded.
  registeredUser: async ({ api }, use) => {
    const user = UserFactory.makeUser();
    await api.register(user);
    const { customerId, accounts } = await api.login(user.username, user.password);
    await use({ username: user.username, password: user.password, customerId, accounts });
  },

  // A REAL UI login for `registeredUser`: navigate to the login form, submit
  // credentials, land on Account Overview. The server sets JSESSIONID on the
  // browser context — a genuine session, not an injected token. Page objects
  // own every locator; this fixture only orchestrates them.
  authenticatedPage: async ({ page, registeredUser }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(registeredUser.username, registeredUser.password);
    await new AccountOverviewPage(page).expectLoaded();
    await use(page);
  },

  // #6 Transfer seed: open a 2nd (savings) account funded from the initial
  // checking, and ensure the browser is logged in as the same user.
  userWithTwoAccounts: async ({ api, registeredUser, authenticatedPage }, use) => {
    void authenticatedPage; // ensure the shared `page` is logged in as this user
    const checking = registeredUser.accounts.find((a) => a.type === 'CHECKING');
    const fromAccountId = (checking ?? registeredUser.accounts[0]!).id;
    const savings = await api.createAccount(
      registeredUser.customerId,
      AccountType.SAVINGS,
      fromAccountId,
    );
    await use({ ...registeredUser, fromAccountId, toAccountId: savings.id });
  },

  // #7 Request Loan seed: a guaranteed-funded source (the initial checking),
  // with the browser logged in as the same user.
  fundedAccount: async ({ registeredUser, authenticatedPage }, use) => {
    void authenticatedPage; // ensure the shared `page` is logged in as this user
    const checking = registeredUser.accounts.find((a) => a.type === 'CHECKING');
    const source = checking ?? registeredUser.accounts[0]!;
    await use({
      customerId: registeredUser.customerId,
      accountId: source.id,
      balance: source.balance,
    });
  },

  // #8 Pay Bill seed: a funded account plus a Faker-built payee and a small
  // amount, with the browser logged in as the same user.
  userWithPayee: async ({ registeredUser, authenticatedPage }, use) => {
    void authenticatedPage; // ensure the shared `page` is logged in as this user
    const checking = registeredUser.accounts.find((a) => a.type === 'CHECKING');
    const source = checking ?? registeredUser.accounts[0]!;
    await use({
      customerId: registeredUser.customerId,
      accountId: source.id,
      payee: UserFactory.makePayee(),
      amount: 25,
    });
  },
});

export { expect } from '@playwright/test';
