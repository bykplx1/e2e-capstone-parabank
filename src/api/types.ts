/**
 * Shared API/domain types for the ParaBank suite.
 *
 * Shapes mirror the live ParaBank REST responses (verified against
 * https://parabank.parasoft.com). These are the contract every seeder method
 * and fixture builds on, so journey issues (#5–#8) can import them directly.
 */

/** A postal address, used both for registration and for bill-pay payees. */
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

/**
 * A full user profile for registration. Profile fields come from Faker; the
 * `username` is hand-rolled to guarantee uniqueness (see {@link UserFactory}).
 */
export interface User {
  firstName: string;
  lastName: string;
  address: Address;
  phoneNumber: string;
  ssn: string;
  username: string;
  password: string;
}

/** A bank account as returned by the accounts/createAccount endpoints. */
export interface Account {
  id: number;
  customerId: number;
  type: 'CHECKING' | 'SAVINGS';
  balance: number;
}

/** New-account type codes accepted by `createAccount` (`newAccountType`). */
export enum AccountType {
  CHECKING = 0,
  SAVINGS = 1,
}

/** Response from the `requestLoan` endpoint. */
export interface LoanResponse {
  responseDate: number;
  loanProviderName: string;
  approved: boolean;
  /** Present when the loan is approved; the new loan account's id. */
  accountId: number | null;
}

/** A bill-pay payee, sent as the JSON body of the `billpay` endpoint. */
export interface Payee {
  name: string;
  address: Address;
  phoneNumber: string;
  accountNumber: string;
}

/** Result of a successful login: the customer id plus their accounts. */
export interface LoginResult {
  customerId: number;
  accounts: Account[];
}
