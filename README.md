# e2e-capstone-parabank

Resilient cross-browser E2E Playwright/TypeScript suite for **ParaBank** (QA capstone).

<!-- CI badge activates once the GitHub Actions workflow lands in Phase 4 -->
[![CI](https://github.com/bykplx1/e2e-capstone-parabank/actions/workflows/ci.yml/badge.svg)](https://github.com/bykplx1/e2e-capstone-parabank/actions/workflows/ci.yml)

---

## What this project tests

ParaBank is a demo retail-banking web app. This suite verifies that its core **money-moving user journeys** work correctly, consistently, and across all three major browser engines (Chromium, Firefox, WebKit). We test the application the way a real customer uses it — through the browser — while seeding setup state through ParaBank's REST API so each test starts at the step it actually means to verify.

Four banking journeys are covered:

| Journey | What it exercises | Why it matters |
|---|---|---|
| **Register + open account** | The real registration UI form and first-account creation | The entry point to every other journey; the one flow we test fully through the UI |
| **Transfer funds** | Moving money between two of a customer's own accounts | Core stateful operation — balances must change correctly and consistently |
| **Request loan** | Submitting a loan request and waiting on the **async approval decision** | Exercises an asynchronous workflow where the result isn't immediate |
| **Pay bill** | Paying a registered payee from an account | Multi-step flow with a prerequisite (payee) that must exist first |

On top of the functional flows, three quality layers run:

- **Cross-browser** — the functional journeys run on Chromium, Firefox, and WebKit.
- **Accessibility** — an `axe` scan on the authenticated Account Overview page.
- **Visual regression** — pixel snapshots of Account Overview and Transaction History.

## What the expected results are

A run is considered **passing** when:

- All four journeys complete successfully on **Chromium, Firefox, and WebKit**.
- After a **transfer**, the source account is debited and the destination credited by the exact amount, and both balances reflect it on screen.
- A **loan request** resolves to a decision (approved/denied) and the UI reflects that decision once it settles.
- A **bill payment** produces an on-screen confirmation and a corresponding transaction.
- The **accessibility scan** reports **no _new_ violations** beyond a committed baseline of ParaBank's known, pre-existing issues.
- The **visual snapshots** match their baselines, ignoring intentionally masked dynamic data (account numbers, balances, dates).
- CI is **green**, runs the three browsers **in parallel**, and uploads the HTML report as an artifact.

Assertions check **observable behavior** — resulting balances, account lists, confirmation messages, new transactions — not internal implementation details. Tests use auto-retrying (web-first) assertions rather than fixed waits, so a pass means the real end-state was reached, not that enough time elapsed.

## Why this testing is useful

- **Confidence that money moves correctly.** The highest-risk thing a bank app does is change balances. These tests fail loudly if a transfer, loan, or bill payment produces the wrong end-state.
- **Cross-browser safety.** A feature that works in Chromium can break in WebKit (timing, rendering, JS-API differences). Running all three engines catches divergence before users do.
- **Regression protection over time.** The a11y baseline and visual snapshots turn "did anything silently change?" into an automatic check — accessibility regressions and unintended layout shifts surface in CI instead of in production.
- **Reliability you can trust.** The suite is built to be deterministic and parallel-safe (each test owns its own user and data), so a red result means a real problem — not a flaky test. One documented real flake and its fix demonstrate that resilience is engineered, not hoped for.

## What we cover — and what each layer is expected to capture (and why)

Each test layer catches a *different class* of bug. None is redundant; together they form a defense in depth.

### 1. Functional E2E flows
- **Covers:** the four banking journeys, end to end, through the UI.
- **Expected to capture:** broken business logic (wrong balance math, failed transfers), navigation/state regressions, integration breaks between pages, and steps that silently no-op.
- **Why:** these are the bugs that directly cost a customer money or block a core task — the highest-severity failures.
- **Cannot capture:** purely visual regressions, accessibility issues, or browser-specific rendering (functional assertions pass as long as the *behavior* is right).

### 2. Cross-browser matrix (Chromium / Firefox / WebKit)
- **Covers:** the same functional flows, replayed on each engine.
- **Expected to capture:** engine-specific timing races (notably WebKit settling after full-page navigations), JS-API differences, and rendering/layout behavior that only breaks on one engine.
- **Why:** "works on my machine/browser" is a real and common defect class; users are spread across all three engines.
- **Cannot capture:** logic bugs that fail identically everywhere (those show up in layer 1 regardless of engine).

### 3. Accessibility scan (axe, baseline-gated)
- **Covers:** the authenticated Account Overview page (data-rich, traversed by every journey).
- **Expected to capture:** **new** accessibility violations introduced by our own changes — measured against a committed baseline of ParaBank's pre-existing debt.
- **Why:** a11y regressions are invisible to functional and visual tests; gating on *new* violations (rather than zero) makes this a meaningful guard on a legacy app instead of a permanently-red gate.
- **Cannot capture:** pre-existing violations we've deliberately baselined, or a11y issues on pages outside the scan.

### 4. Visual regression (Chromium-only, masked)
- **Covers:** Account Overview and Transaction History snapshots.
- **Expected to capture:** unintended layout, styling, or structural shifts that functional assertions sail straight past (a button that moved, a broken table, a CSS regression).
- **Why:** functional correctness ≠ visual correctness; a page can "work" while looking broken.
- **Cannot capture:** behavioral bugs (a correctly-rendered page can still do the wrong thing), and — by design — differences in the masked dynamic regions. Restricted to Chromium with Linux-generated baselines so cross-engine and local-vs-CI rendering differences don't produce false diffs.

### Isolated unit test
- **`AxeBaselineComparator`** is unit-tested directly, because the logic that decides "new violation vs known violation" is what makes layer 3 trustworthy — a bug there would silently pass or fail a11y regressions.

## What we expect to *catch in flight* (the flake story)

Beyond product bugs, the suite is built to expose and document at least one **test-infrastructure flake**. The headline case is a **WebKit post-navigation race**: asserting against a page before WebKit finishes a full-page reload. The fix is encapsulated, web-first waiting (not fixed `waitForTimeout`s), with a single CI retry retained only as a safety net. This is documented as a postmortem — symptom → root cause → fix → prevention — to show the difference between *fixing* flake and *masking* it.

---

## Project status & operational docs

> **Phase 1 in progress.** The sections below will be filled in as the suite is built.

- **Local execution:** _TBD — prerequisites (pnpm, Docker), how to start ParaBank, and how to run the suite._
- **CI structure:** _TBD — GitHub Actions browser matrix, per-job ParaBank service container with health gate, report artifacts._
- **State-dependency management:** _TBD — unique-user-per-test isolation and hybrid UI/API seeding._
- **Retrospective design decision:** _TBD — why unique-user-per-test, and its trade-offs._

See [issue #1](https://github.com/bykplx1/e2e-capstone-parabank/issues/1) for the full PRD.
