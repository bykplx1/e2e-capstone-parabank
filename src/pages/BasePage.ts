import type { Page } from '@playwright/test';

/** The app is served under this context path; routes include it, baseURL does not. */
export const CONTEXT_PATH = '/parabank';

/**
 * Shared base for every ParaBank page object.
 *
 * Owns the {@link Page} handle and the cross-cutting concerns every screen
 * shares: building context-path-aware URLs and navigating to them. Concrete
 * page objects extend this and add their own screen-specific locators and
 * intent methods. Tests never touch `page` directly — they go through these
 * page objects, keeping all locators encapsulated.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Navigate to a route under the `/parabank` context path.
   *
   * @param route a path relative to the context root, e.g. `index.htm`.
   */
  protected async navigate(route: string): Promise<void> {
    await this.page.goto(`${CONTEXT_PATH}/${route}`);
  }
}
