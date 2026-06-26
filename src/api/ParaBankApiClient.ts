import type { APIRequestContext } from '@playwright/test';
import {
  AccountType,
  type Account,
  type LoanResponse,
  type LoginResult,
  type Payee,
  type User,
} from './types';

/** The app is served under this context path; it is NOT part of `baseURL`. */
const CONTEXT_PATH = '/parabank';
const SERVICES = `${CONTEXT_PATH}/services/bank`;

/**
 * Headless seeding client for ParaBank.
 *
 * A DEEP module: the public surface reads as plain banking intent —
 * `register`, `login`, `getAccounts`, `createAccount`, `transfer`,
 * `requestLoan`, `payBill` — while it hides every ParaBank quirk behind it:
 * the register.htm form-POST and its mandatory JSESSIONID handshake, the
 * REST endpoint paths and verbs, and the fact that some endpoints answer in
 * JSON while others answer in plain text.
 *
 * It is bound to a Playwright {@link APIRequestContext} and nothing else — no
 * browser, ever. The request context transparently persists cookies between
 * calls, which is exactly what the registration handshake relies on.
 */
export class ParaBankApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * Register a new customer via the `register.htm` form.
   *
   * Two live-observed gotchas are handled here so callers never see them:
   *   1. The form must be GET-ed first so the server sets a JSESSIONID cookie;
   *      POSTing without it 500s. The bound request context carries the cookie
   *      forward automatically.
   *   2. Success is signalled only in the HTML body (`Welcome {username}`),
   *      not via status code — so we assert on the body.
   */
  async register(user: User): Promise<void> {
    // 1. Prime the session: GET the form so JSESSIONID is set.
    const formResponse = await this.request.get(`${CONTEXT_PATH}/register.htm`);
    if (!formResponse.ok()) {
      throw new Error(
        `Failed to load registration form: HTTP ${formResponse.status()} ${formResponse.statusText()}`,
      );
    }

    // 2. POST the form (cookie carried by the request context).
    const response = await this.request.post(`${CONTEXT_PATH}/register.htm`, {
      form: {
        'customer.firstName': user.firstName,
        'customer.lastName': user.lastName,
        'customer.address.street': user.address.street,
        'customer.address.city': user.address.city,
        'customer.address.state': user.address.state,
        'customer.address.zipCode': user.address.zipCode,
        'customer.phoneNumber': user.phoneNumber,
        'customer.ssn': user.ssn,
        'customer.username': user.username,
        'customer.password': user.password,
        repeatedPassword: user.password,
      },
    });

    const body = await response.text();
    if (!response.ok() || !body.includes(`Welcome ${user.username}`)) {
      throw new Error(
        `Registration failed for "${user.username}": HTTP ${response.status()}. ` +
          `Expected "Welcome ${user.username}" in the response body.`,
      );
    }
  }

  /**
   * Log in over REST and return the customer id together with their accounts.
   *
   * ParaBank's login endpoint returns only the customer record (no accounts),
   * so this composes a follow-up `getAccounts` call to deliver the full,
   * ready-to-use {@link LoginResult} the rest of the suite expects.
   */
  async login(username: string, password: string): Promise<LoginResult> {
    const response = await this.request.get(
      `${SERVICES}/login/${encodeURIComponent(username)}/${encodeURIComponent(password)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok()) {
      throw new Error(
        `Login failed for "${username}": HTTP ${response.status()} ${response.statusText()}`,
      );
    }

    const customer = (await response.json()) as { id: number };
    const accounts = await this.getAccounts(customer.id);
    return { customerId: customer.id, accounts };
  }

  /** List all accounts belonging to a customer. */
  async getAccounts(customerId: number): Promise<Account[]> {
    const response = await this.request.get(`${SERVICES}/customers/${customerId}/accounts`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok()) {
      throw new Error(
        `getAccounts failed for customer ${customerId}: HTTP ${response.status()} ${response.statusText()}`,
      );
    }
    return (await response.json()) as Account[];
  }

  /**
   * Open a new account for a customer, funded from an existing account.
   *
   * @param accountType `AccountType.CHECKING` (0) or `AccountType.SAVINGS` (1).
   * @param fromAccountId the existing account the opening funds come from.
   */
  async createAccount(
    customerId: number,
    accountType: AccountType,
    fromAccountId: number,
  ): Promise<Account> {
    const response = await this.request.post(
      `${SERVICES}/createAccount` +
        `?customerId=${customerId}&newAccountType=${accountType}&fromAccountId=${fromAccountId}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok()) {
      throw new Error(
        `createAccount failed for customer ${customerId}: HTTP ${response.status()} ${response.statusText()}`,
      );
    }
    return (await response.json()) as Account;
  }

  /** Transfer an amount between two accounts. (Endpoint replies in plain text.) */
  async transfer(fromAccountId: number, toAccountId: number, amount: number): Promise<void> {
    const response = await this.request.post(
      `${SERVICES}/transfer` +
        `?fromAccountId=${fromAccountId}&toAccountId=${toAccountId}&amount=${amount}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok()) {
      throw new Error(
        `transfer of ${amount} from ${fromAccountId} to ${toAccountId} failed: ` +
          `HTTP ${response.status()} ${response.statusText()}`,
      );
    }
  }

  /** Request a loan, funding the down payment from an existing account. */
  async requestLoan(
    customerId: number,
    amount: number,
    downPayment: number,
    fromAccountId: number,
  ): Promise<LoanResponse> {
    const response = await this.request.post(
      `${SERVICES}/requestLoan` +
        `?customerId=${customerId}&amount=${amount}&downPayment=${downPayment}&fromAccountId=${fromAccountId}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok()) {
      throw new Error(
        `requestLoan for customer ${customerId} failed: HTTP ${response.status()} ${response.statusText()}`,
      );
    }
    return (await response.json()) as LoanResponse;
  }

  /**
   * Pay a bill from an account to a payee.
   *
   * The payee travels as a JSON body while the account and amount are query
   * params — a ParaBank asymmetry hidden behind this single call.
   */
  async payBill(accountId: number, amount: number, payee: Payee): Promise<void> {
    const response = await this.request.post(
      `${SERVICES}/billpay?accountId=${accountId}&amount=${amount}`,
      {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        data: payee,
      },
    );
    if (!response.ok()) {
      throw new Error(
        `payBill of ${amount} from account ${accountId} to "${payee.name}" failed: ` +
          `HTTP ${response.status()} ${response.statusText()}`,
      );
    }
  }
}
