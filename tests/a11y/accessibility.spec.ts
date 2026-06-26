import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { test, expect } from '../../src/fixtures/test';
import { AccountOverviewPage } from '../../src/pages/AccountOverviewPage';
import { AxeBaselineComparator } from '../../src/a11y/AxeBaselineComparator';
import baseline from './axe-baseline.json' with { type: 'json' };

/**
 * Accessibility scan + known-violations baseline (issue #11).
 *
 * Runs an axe-core scan on the authenticated Account Overview page and gates ON
 * REGRESSIONS ONLY. ParaBank ships with pre-existing accessibility debt; that
 * debt is captured once in `axe-baseline.json` (the axe `violations` array,
 * i.e. `Result[]`) and treated as the accepted floor. The test fails only when
 * a scan surfaces a (rule, node) identity ABSENT from that baseline — a genuine
 * new violation — as decided by {@link AxeBaselineComparator} (issue #10).
 *
 * Every run attaches the FULL axe results JSON to the HTML report so the
 * complete picture (passes, incomplete, all violations) is always inspectable,
 * independent of the pass/fail gate.
 *
 * Regenerating the baseline: run this spec with `UPDATE_A11Y_BASELINE=1` to
 * overwrite `axe-baseline.json` from a live scan instead of asserting. The
 * COMMITTED test always asserts — the update branch is an explicit, opt-in
 * escape hatch for refreshing accepted debt, never the default behaviour.
 */
const baselineViolations = baseline as Result[];
const baselinePath = fileURLToPath(new URL('./axe-baseline.json', import.meta.url));

test.describe('Accessibility: Account Overview', () => {
  test('has no NEW axe violations vs the committed baseline', async ({
    authenticatedPage,
  }, testInfo) => {
    const overviewPage = new AccountOverviewPage(authenticatedPage);
    await overviewPage.goto();
    await overviewPage.expectLoaded();

    const results = await new AxeBuilder({ page: authenticatedPage }).analyze();

    // Always attach the full axe results so the report carries complete context
    // (every violation, pass, and incomplete check) regardless of the gate.
    await testInfo.attach('axe-results.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });

    // Opt-in baseline refresh: capture current debt and skip the assertion.
    if (process.env.UPDATE_A11Y_BASELINE === '1') {
      writeFileSync(baselinePath, `${JSON.stringify(results.violations, null, 2)}\n`);
      test.skip(true, `Baseline regenerated at ${baselinePath}`);
      return;
    }

    const comparator = new AxeBaselineComparator(baselineViolations);
    const newViolations = comparator.findNewViolations(results.violations);

    expect(
      newViolations,
      `New accessibility violations vs baseline:\n${JSON.stringify(
        newViolations.map((v) => ({ ruleId: v.ruleId, target: v.target })),
        null,
        2,
      )}`,
    ).toHaveLength(0);
  });
});
