import { test, expect } from '../../src/fixtures/test';

/**
 * API-spine verification: the headless seeding path every other test depends on.
 *
 * The `registeredUser` fixture registers a fresh user via form-POST; here we
 * confirm that user is immediately usable over REST — it can log in, yields a
 * real customer id, and its accounts are retrievable.
 */
test.describe('API spine', () => {
  test('a freshly registered user is immediately loginable via REST', async ({
    api,
    registeredUser,
  }) => {
    const { username, password, customerId, accounts } = registeredUser;

    // Re-login independently to prove the registration truly persisted server-side.
    const login = await api.login(username, password);

    expect(login.customerId).toBe(customerId);
    expect(typeof login.customerId).toBe('number');
    expect(login.customerId).toBeGreaterThan(0);
    expect(Array.isArray(login.accounts)).toBe(true);
    expect(login.accounts.length).toBeGreaterThan(0);

    // The fixture's snapshot of accounts should match what login returns.
    expect(accounts.length).toBe(login.accounts.length);
  });

  test('getAccounts returns the customer accounts for the registered user', async ({
    api,
    registeredUser,
  }) => {
    const accounts = await api.getAccounts(registeredUser.customerId);

    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);

    const [first] = accounts;
    expect(first).toBeDefined();
    expect(first!.customerId).toBe(registeredUser.customerId);
    expect(typeof first!.id).toBe('number');
    expect(typeof first!.balance).toBe('number');
  });
});
