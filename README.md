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
- **Visual regression** — pixel snapshots of Account Overview, Transaction History, and the Transfer Funds confirmation page.

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
- **Covers:** Account Overview, Transaction History, and Transfer Funds confirmation snapshots (three — one above the required minimum, for resilience margin).
- **Expected to capture:** unintended layout, styling, or structural shifts that functional assertions sail straight past (a button that moved, a broken table, a CSS regression).
- **Why:** functional correctness ≠ visual correctness; a page can "work" while looking broken.
- **Cannot capture:** behavioral bugs (a correctly-rendered page can still do the wrong thing), and — by design — differences in the masked dynamic regions. Restricted to Chromium with Linux-generated baselines so cross-engine and local-vs-CI rendering differences don't produce false diffs.

### Isolated unit test
- **`AxeBaselineComparator`** is unit-tested directly, because the logic that decides "new violation vs known violation" is what makes layer 3 trustworthy — a bug there would silently pass or fail a11y regressions.

## A concrete bug — and which layer catches it first

**The bug:** a regression in the transfer endpoint **debits the source account but fails to credit the destination** (the money vanishes). Both pages still render perfectly and the confirmation message still appears.

**Which layer catches it first: the functional E2E flow (layer 1).** The *Transfer funds* test asserts the *resulting balances* — source down by the exact amount **and** destination up by the same amount. The missing credit fails that assertion on the first run, on every engine.

**Why no other layer catches it first:**
- **Visual regression** would not catch it — the page renders correctly; balances are masked dynamic data, so the snapshot is intentionally blind to the numbers.
- **Accessibility** would not catch it — the markup is still valid; a wrong balance is not an a11y violation.
- **Cross-browser** adds nothing here — the bug is in business logic, so it fails identically on all three engines (layer 1 already caught it on each).

This is the point of the layered design: the highest-severity, money-losing bug is caught by the cheapest, most direct assertion, while the other layers stand guard over the failure modes that functional assertions are blind to. A few more bug→first-catcher mappings:

| Hypothetical bug | First layer to catch it |
|---|---|
| Transfer debits but doesn't credit | Functional E2E (balance assertion) |
| Account Overview table collapses on WebKit only | Cross-browser matrix |
| A new form input ships without a label | Accessibility (axe baseline — new violation) |
| Nav bar shifts / a button is pushed off-screen by a CSS change | Visual regression |
| `axe-baseline.json` comparison miscounts a known violation as new | `AxeBaselineComparator` unit test |

## What we expect to *catch in flight* (the flake story)

Beyond product bugs, the suite is built to expose and document at least one **test-infrastructure flake**. The headline case is a **WebKit post-navigation race**: asserting against a page before WebKit finishes a full-page reload. The fix is encapsulated, web-first waiting (not fixed `waitForTimeout`s), with a single CI retry retained only as a safety net. This is documented as a postmortem — symptom → root cause → fix → prevention — to show the difference between *fixing* flake and *masking* it.

---

## Running the suite locally

### Prerequisites

- **Node 22+** (the repo pins `"node": ">=22"` in `package.json`).
- **pnpm 9.15.9** — pinned via `packageManager`. The easiest path is Corepack:
  ```bash
  corepack enable
  corepack prepare pnpm@9.15.9 --activate
  ```
- **Docker** — to run ParaBank locally from the `parasoft/parabank` image.

### 1. Start ParaBank (Docker)

The suite expects ParaBank reachable at `http://localhost:8080`, served under the
`/parabank` context path. Start the container:

```bash
docker run -d --name parabank -p 8080:8080 parasoft/parabank
```

The image boots with an **empty HSQLDB** — the demo data (and the REST spine the
seeding fixtures depend on) does not exist until you initialize it. Mirror exactly
what CI does: wait for the webapp to respond, then POST `initializeDB` once and
poll the login endpoint until it returns `200`.

```bash
# Wait until Tomcat has deployed the WAR (any non-5xx response will do).
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/parabank/index.htm)" != "000" ]; do
  echo "waiting for ParaBank..."; sleep 5
done

# Seed the demo database (idempotent — safe to re-run).
curl -s -X POST http://localhost:8080/parabank/services/bank/initializeDB

# Confirm the seed took: the demo user must authenticate with HTTP 200.
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/parabank/services/bank/login/john/demo
# expect: 200
```

> If `login/john/demo` returns `400`, the database is unseeded — re-run the
> `initializeDB` POST. This is the single most common local setup gotcha and is
> the exact failure the CI health gate guards against (see [CI structure](#ci-structure)).

To point the suite at a different instance (e.g. the public demo), override the
base URL: `PARABANK_URL=https://parabank.parasoft.com pnpm test`. It defaults to
`http://localhost:8080` (see `playwright.config.ts`).

### 2. Install and run

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps   # browser binaries (chromium/firefox/webkit)

pnpm test                                   # full suite, all projects (playwright test)
```

Useful scoped commands (all real `package.json` scripts / Playwright invocations):

| Command | What it runs |
|---|---|
| `pnpm test` | The whole suite across every configured project |
| `pnpm exec playwright test --project=chromium` | Functional journeys on Chromium only (what the CI job runs) |
| `pnpm exec playwright test --project=firefox` / `--project=webkit` | Cross-browser functional replay |
| `pnpm exec playwright test --project=visual` | Chromium-only masked visual regression snapshots |
| `pnpm exec playwright test tests/a11y` | The axe accessibility scan |
| `pnpm test:unit` | The isolated `AxeBaselineComparator` unit test (`playwright test tests/unit`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | ESLint + Prettier check / Prettier write |

> **Visual baselines are platform-specific.** The committed snapshots under
> `tests/visual/.../*-snapshots/` are suffixed `-win32` (generated on Windows).
> Playwright keys screenshots by platform, so on Linux/macOS the `visual` project
> will report missing baselines until you regenerate them with
> `pnpm exec playwright test --project=visual --update-snapshots`. CI is intended
> to own a Linux baseline set (see issue #14) so the gate is deterministic there.

## CI structure

CI is defined in `.github/workflows/ci.yml` and runs on pull requests to `main`
(plus `workflow_dispatch`). It currently lands as a **single-browser tracer**
(Chromium) per issue #13; the **target structure (issue #14)** fans this exact job
template out into a **3-browser matrix** (Chromium, Firefox, WebKit). The design is
matrix-ready because each browser is functionally independent.

**Per-job ParaBank service container.** Each job runs `parasoft/parabank` as a
GitHub Actions service container on port 8080 — one fresh, isolated ParaBank per
job, so matrix shards never share state.

**Two-layer health gate.** ParaBank is unusually awkward to gate on, and the
workflow handles it in two layers:

1. **Docker health-cmd (port bind).** The `parasoft/parabank` image ships
   *without* `curl` or `wget`, so a curl-based `--health-cmd` can never pass.
   Instead the container probes itself with a bash builtin
   (`echo > /dev/tcp/localhost/8080`) to confirm Tomcat has bound the port.
2. **Workflow readiness poll + seed.** Binding the port does *not* mean the app is
   usable: the container boots with an empty HSQLDB, so `login/john/demo` returns
   `400` and `/index.htm` redirects to `initializeDB.htm`. The workflow therefore
   waits for the webapp to respond, **POSTs `initializeDB`** to seed the demo data,
   and **polls `login/john/demo` until it returns `200`** before any test starts.
   Re-seeding is idempotent and retried in case the first POST races boot.

Only after the seed is confirmed does the job run
`pnpm exec playwright test --project=chromium`.

**Report artifacts.** The HTML report (`playwright-report/`) is uploaded with
`actions/upload-artifact` on `if: always()` (7-day retention) so a failing run's
report — including traces and screenshots — is downloadable. Traces are captured
`on-first-retry`, screenshots `only-on-failure`, and video `retain-on-failure`
(see `playwright.config.ts`).

## State-dependency management

ParaBank is a stateful banking app: tests change balances, open accounts, and pay
bills. Shared mutable state is the classic source of order-dependent flake. This
suite removes that dependency in two ways.

**Unique user per test.** Every test gets its own freshly registered customer.
`UserFactory.makeUser()` (`src/support/UserFactory.ts`) builds a profile from Faker
but owns *username uniqueness itself* — ParaBank rejects duplicates and silently
misreports non-alphanumeric usernames as "already exists". The username is composed
from a process-wide monotonic counter (rules out same-process collisions) plus a
millisecond timestamp and an 8-char random suffix (rules out cross-process ones),
all kept strictly alphanumeric.

**Hybrid UI/API seeding.** Setup state is created through ParaBank's REST API; only
the behavior under test runs through the UI. This lives in the fixtures in
`src/fixtures/test.ts`:

- `api` — a `ParaBankApiClient` bound to a **per-test** `APIRequestContext`, so
  each worker's cookies (notably the registration `JSESSIONID`) stay isolated.
- `registeredUser` — registers a fresh user via form-POST, then returns the
  server's view (customer id + accounts) so dependent tests start fully onboarded.
- `authenticatedPage` — a **real UI form login** for that user (genuine
  server-side `JSESSIONID`, *not* an injected token), landing on Account Overview.
- `userWithTwoAccounts`, `fundedAccount`, `userWithPayee` — composed seeds for the
  Transfer (#6), Request Loan (#7), and Pay Bill (#8) journeys, each opening/funding
  state via the API client and ensuring the browser is logged in as the same user.

The `ParaBankApiClient` is a deep module: a plain banking surface
(`register`/`login`/`createAccount`/`transfer`/`requestLoan`/`payBill`) hiding
ParaBank's quirks (the GET-then-POST registration handshake, JSON-vs-plaintext
responses, query-param-vs-body asymmetries). The result is fast, deterministic
setup with each test asserting one real journey through the UI.

## Retrospective design decision: unique-user-per-test

**Decision.** Rather than seed one shared demo customer and reuse it across the
suite, each test registers and operates on its own brand-new user, seeded via the
API. This is the load-bearing reliability choice.

**Why.** ParaBank balances and account lists are mutable and persistent. A shared
user makes assertions order-dependent: a transfer test asserting "balance went up
by \$X" breaks the moment another test (or a re-run) has already moved money. With
`fullyParallel: true`, shared state would also race across workers. Owning a fresh
user per test makes every assertion absolute, not relative to whatever ran before —
so a red result means a real defect, not test cross-talk.

**Honest trade-offs:**

- **Setup cost.** Every test pays for a registration + login + account setup
  round-trip. Doing this through the **API** rather than the UI keeps it cheap, but
  it is not free — the suite is heavier than one that reuses a logged-in session.
- **No durable fixtures across runs.** ParaBank's container/DB accumulates users;
  on the ephemeral CI container that is harmless (fresh DB per job), but a
  long-lived local instance slowly fills with throwaway customers.
- **Username uniqueness is hand-rolled.** We can't lean on Faker for the one field
  that must never collide, so `UserFactory` carries bespoke counter+timestamp+random
  logic — more code to maintain, but the alternative (intermittent duplicate-user
  failures under parallelism) is exactly the flake class this design exists to kill.
- **It does not cover multi-user interactions.** Isolation is the point, so any
  genuinely cross-customer scenario would need a deliberately different fixture.

The trade is accepted deliberately: a modest, parallel-friendly setup cost buys
deterministic, order-independent, parallel-safe tests.

## The flake story

Beyond product bugs, the suite is engineered to expose and *document* test-infra
flake rather than paper over it. The headline case is a **WebKit post-navigation
race** — asserting against a page before WebKit settles a full-page reload — fixed
with encapsulated web-first waits on a stable post-navigation locator (not fixed
`waitForTimeout`s), with the single CI retry (`retries: 1`) kept only as a safety
net. The full symptom → root cause → fix → prevention write-up lives in
[`docs/flake-postmortem.md`](docs/flake-postmortem.md).

---

See [issue #1](https://github.com/bykplx1/e2e-capstone-parabank/issues/1) for the full PRD.
