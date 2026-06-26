import { faker } from '@faker-js/faker';
import type { Payee, User } from '../api/types';

/**
 * Builds fresh {@link User} profiles for per-test isolation.
 *
 * Profile fields (name, address, phone, ssn, password) come from Faker for
 * realism. The `username`, however, is the one field that MUST be unique —
 * ParaBank rejects duplicates — so its uniqueness is hand-rolled rather than
 * delegated to Faker, whose random output can collide across parallel workers.
 *
 * Uniqueness recipe: a process-wide monotonic counter + a high-entropy random
 * suffix + the millisecond timestamp, all base-36 encoded. Keeping the username
 * strictly alphanumeric is also a hard ParaBank requirement: underscores or
 * special characters trigger a misleading "username already exists" error.
 */
export class UserFactory {
  /** Monotonic counter shared across all makeUser() calls in this process. */
  private static counter = 0;

  /**
   * Create a fresh user with a guaranteed-unique, strictly alphanumeric username.
   */
  static makeUser(): User {
    const username = UserFactory.uniqueUsername();

    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        // ParaBank expects a 2-letter US state abbreviation.
        state: faker.location.state({ abbreviated: true }),
        zipCode: faker.location.zipCode('#####'),
      },
      phoneNumber: faker.string.numeric(10),
      ssn: `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`,
      username,
      // Faker password can contain symbols; keep it simple and valid.
      password: `Pw${faker.string.alphanumeric(10)}`,
    };
  }

  /**
   * Build a fresh bill-pay {@link Payee} from Faker.
   *
   * ParaBank does not pre-register payees — the payee is supplied to `payBill`
   * at call time — so this is pure throwaway data. `accountNumber` is a numeric
   * string (the payee's own account, distinct from the paying account).
   */
  static makePayee(): Payee {
    return {
      name: faker.company.name(),
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zipCode: faker.location.zipCode('#####'),
      },
      phoneNumber: faker.string.numeric(10),
      accountNumber: faker.string.numeric(5),
    };
  }

  /**
   * Compose a unique alphanumeric username. Uniqueness is owned here, not by
   * Faker: a monotonic counter rules out same-process collisions and the
   * timestamp + random suffix rule out cross-process ones.
   */
  private static uniqueUsername(): string {
    const seq = (UserFactory.counter++).toString(36);
    const time = Date.now().toString(36);
    const rand = faker.string.alphanumeric(8).toLowerCase();
    return `qa${seq}${time}${rand}`;
  }
}
