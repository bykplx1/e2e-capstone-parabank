import { test as base, request as playwrightRequest } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ParaBankApiClient } from '../api/ParaBankApiClient';
import type { Account } from '../api/types';
import { UserFactory } from '../support/UserFactory';

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
 * Fixtures provided by this base module. Issue #4 EXTENDS this same `test`
 * (adding `authenticatedPage` and layered user fixtures) by calling
 * `test.extend(...)` on the export below, so keep these composable.
 */
export interface ApiFixtures {
  /** A {@link ParaBankApiClient} bound to a per-test API request context. */
  api: ParaBankApiClient;
  /** A freshly registered, immediately usable customer. */
  registeredUser: RegisteredUser;
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
});

export { expect } from '@playwright/test';
