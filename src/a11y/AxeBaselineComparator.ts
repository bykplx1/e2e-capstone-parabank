import type { Result, NodeResult } from 'axe-core';

/**
 * A single new (regressed) accessibility violation: one axe rule failing on one
 * specific DOM node that is NOT present in the committed baseline.
 *
 * The shape is deliberately report-ready for issue #11: `ruleId`, the `target`
 * selectors exactly as axe reported them, the stable `identity` used for
 * matching, plus the originating axe `result`/`node` so a reporter can attach
 * the full context (help text, impact, html) without re-deriving anything.
 */
export interface NewViolation {
  /** The axe rule id (axe calls this `id` on a {@link Result}). */
  ruleId: string;
  /** The node's target selectors, exactly as axe reported them (unsorted). */
  target: NodeResult['target'];
  /** Stable identity: `ruleId` + the node's target selectors, sorted. */
  identity: string;
  /** The originating axe violation result (rule-level context). */
  result: Result;
  /** The originating axe node (node-level context: html, impact, summary). */
  node: NodeResult;
}

/**
 * Decides "new violation vs known violation" for axe accessibility results.
 *
 * A DEEP, PURE module: no Playwright, no browser, no live axe — types only.
 * It collapses each axe violation+node into a stable identity (`ruleId` plus
 * the node's target selectors SORTED, so selector ORDER never affects matching)
 * and diffs the current results against a committed baseline, surfacing only
 * identities absent from the baseline — i.e. genuine regressions.
 *
 * Usage (issue #11 wires this to a live scan + `axe-baseline.json`):
 *   const comparator = new AxeBaselineComparator(baseline);
 *   const regressions = comparator.findNewViolations(scan.violations);
 */
export class AxeBaselineComparator {
  private readonly baselineIdentities: ReadonlySet<string>;

  /** @param baseline the committed known-violations (axe `violations` array). */
  constructor(baseline: Result[]) {
    this.baselineIdentities = new Set(identitiesOf(baseline));
  }

  /**
   * Diff `results` against the baseline and return ONLY the new violations:
   * one {@link NewViolation} per (rule, node) whose identity is not baselined.
   */
  findNewViolations(results: Result[]): NewViolation[] {
    const newViolations: NewViolation[] = [];
    for (const result of results) {
      for (const node of result.nodes) {
        const id = identity(result.id, node.target);
        if (!this.baselineIdentities.has(id)) {
          newViolations.push({
            ruleId: result.id,
            target: node.target,
            identity: id,
            result,
            node,
          });
        }
      }
    }
    return newViolations;
  }
}

/** Every (rule, node) identity contained in a set of axe violations. */
function identitiesOf(results: Result[]): string[] {
  return results.flatMap((result) => result.nodes.map((node) => identity(result.id, node.target)));
}

/**
 * Stable identity for one violation node: `ruleId` + its target selectors
 * SORTED. Sorting makes the identity invariant to selector order, so a baselined
 * violation still matches even if axe emits its targets in a different order.
 * Non-string (shadow-DOM) selectors are JSON-encoded so they compare stably.
 */
function identity(ruleId: string, target: NodeResult['target']): string {
  const selectors = target
    .map((selector) => (typeof selector === 'string' ? selector : JSON.stringify(selector)))
    .sort();
  return JSON.stringify([ruleId, selectors]);
}
