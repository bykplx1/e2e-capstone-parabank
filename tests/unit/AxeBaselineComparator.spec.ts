import { test, expect } from '@playwright/test';
import type { Result } from 'axe-core';
import { AxeBaselineComparator } from '../../src/a11y/AxeBaselineComparator';

/**
 * Pure-logic unit tests for {@link AxeBaselineComparator}. These run under the
 * Playwright runner but NEVER open a browser — they assert on hand-written
 * synthetic axe fixtures only (no live scan, no `axe-baseline.json`).
 */

/** Build a synthetic axe {@link Result} with one rule failing on the given targets. */
function violation(ruleId: string, ...targets: string[][]): Result {
  return {
    id: ruleId,
    description: `desc:${ruleId}`,
    help: `help:${ruleId}`,
    helpUrl: `https://example.test/${ruleId}`,
    tags: ['wcag2a'],
    nodes: targets.map((target) => ({
      html: `<node ${ruleId}>`,
      target,
      any: [],
      all: [],
      none: [],
    })),
  } as Result;
}

test.describe('AxeBaselineComparator', () => {
  test('a known violation in the baseline is NOT flagged', () => {
    const known = violation('color-contrast', ['#header .logo']);
    const comparator = new AxeBaselineComparator([known]);

    const newViolations = comparator.findNewViolations([known]);

    expect(newViolations).toEqual([]);
  });

  test('a new violation absent from the baseline IS flagged', () => {
    const known = violation('color-contrast', ['#header .logo']);
    const regression = violation('image-alt', ['img.hero']);
    const comparator = new AxeBaselineComparator([known]);

    const newViolations = comparator.findNewViolations([known, regression]);

    expect(newViolations).toHaveLength(1);
    expect(newViolations[0]!.ruleId).toBe('image-alt');
    expect(newViolations[0]!.target).toEqual(['img.hero']);
    expect(newViolations[0]!.result).toBe(regression);
    expect(newViolations[0]!.node).toBe(regression.nodes[0]);
  });

  test('an empty baseline means every current violation is new', () => {
    const a = violation('color-contrast', ['#header .logo']);
    const b = violation('image-alt', ['img.hero']);
    const comparator = new AxeBaselineComparator([]);

    const newViolations = comparator.findNewViolations([a, b]);

    expect(newViolations.map((v) => v.ruleId)).toEqual(['color-contrast', 'image-alt']);
  });

  test('empty current results flag nothing, even with a populated baseline', () => {
    const known = violation('color-contrast', ['#header .logo']);
    const comparator = new AxeBaselineComparator([known]);

    expect(comparator.findNewViolations([])).toEqual([]);
  });

  test('target-selector ORDER does not affect identity matching', () => {
    // Same rule + same selectors, but the order differs between baseline and scan.
    const baselined = violation('color-contrast', ['.b', '.a', '.c']);
    const reordered = violation('color-contrast', ['.c', '.a', '.b']);
    const comparator = new AxeBaselineComparator([baselined]);

    // Despite the different target order, identity matches → NOT a regression.
    expect(comparator.findNewViolations([reordered])).toEqual([]);
  });

  test('the same rule on a DIFFERENT node is flagged as new (per-node identity)', () => {
    const baselined = violation('color-contrast', ['#footer .a']);
    // Same ruleId, different target → distinct identity → a real regression.
    const sameRuleNewNode = violation('color-contrast', ['#main .b']);
    const comparator = new AxeBaselineComparator([baselined]);

    const newViolations = comparator.findNewViolations([sameRuleNewNode]);

    expect(newViolations).toHaveLength(1);
    expect(newViolations[0]!.ruleId).toBe('color-contrast');
    expect(newViolations[0]!.target).toEqual(['#main .b']);
  });

  test('a multi-node violation flags only the regressed node, not the baselined one', () => {
    // One axe rule firing on two nodes; only one of them is in the baseline.
    const baselined = violation('label', ['#known-input']);
    const scan = violation('label', ['#known-input'], ['#new-input']);
    const comparator = new AxeBaselineComparator([baselined]);

    const newViolations = comparator.findNewViolations([scan]);

    expect(newViolations).toHaveLength(1);
    expect(newViolations[0]!.target).toEqual(['#new-input']);
  });
});
