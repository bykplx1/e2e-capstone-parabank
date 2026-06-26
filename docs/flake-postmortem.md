# Flake postmortem: the WebKit post-navigation race

A record of a real flaky-test failure in this suite, the root cause, the fix that
landed, and the prevention strategy. Structured **symptom → root cause → fix →
prevention**. Everything below is grounded in code in this repo — file paths and
the commit that fixed it are cited inline.

The headline case is the **WebKit post-navigation race**: journeys asserting
against a page before WebKit has settled a full-page reload. Fixed in commit
`b9d5ee7` (`test(cross-browser): Firefox + WebKit functional matrix with
encapsulated post-nav waits`, closes #9) by encapsulating web-first waits in the
page objects that own each navigation.

---

## Symptom

When the functional journeys are replayed on the cross-browser matrix
(the `firefox` and `webkit` projects defined in
[`playwright.config.ts`](../playwright.config.ts)), the **WebKit** engine
intermittently fails the steps that run immediately after a full-page form
submit:

- After `LoginPage.login()` clicks **Log In**, the next assertion (the Accounts
  Overview landmark) intermittently fails — the test is looking at the *old*
  login document, or hits a "execution context was destroyed" error mid-swap.
- After `RegisterPage.register()` clicks **Register**, an assertion of the
  post-registration Welcome state intermittently fails for the same reason.

The defining traits of a flake were all present:

- **Engine-specific.** Chromium was effectively always green; the same journeys
  on WebKit failed only *sometimes*. Firefox sat in between.
- **Non-deterministic.** Re-running the identical test often passed. Nothing in
  the app, the data, or the test changed between a red and a green run — only
  timing.
- **Located at navigation seams.** Failures clustered exactly on the two screens
  whose primary action is a full-page form POST (login → `overview.htm`,
  register → `register.htm`), never on in-page interactions.

This is the textbook signature of a timing race, not a real product defect.

---

## Root cause

Both `LoginPage.login()` and `RegisterPage.register()` perform a **full-page form
POST** — clicking the submit control causes the browser to tear down the current
document and commit a brand-new one at a different URL.

The original code returned the moment the `.click()` promise resolved. But
`click()` resolving only means *the click dispatched* — it does **not** mean the
resulting navigation has committed. That left the navigation in flight and
silently delegated the "is the new page here yet?" question to whatever assertion
the caller happened to run next.

On Chromium that mostly worked by luck: Chromium commits the new document fast
enough that the caller's first assertion usually arrived after the swap. **WebKit
commits a full-page navigation slightly later**, so an assertion fired right after
the click can:

- run against the **old document** (the pre-navigation login/register page) and
  fail because the expected post-nav landmark isn't there yet; or
- hit a **destroyed execution context** while WebKit is mid-swap between the two
  documents.

The race was therefore structural: the page objects exposed a navigation method
that returned *before* the post-condition (the new committed document) was
guaranteed. The suite was relying on **engine-specific timing luck** rather than
waiting on a real signal. The reason it only surfaced on the cross-browser matrix
is simply that WebKit is the engine slow enough to lose that bet often enough to
notice.

---

## Fix

Commit `b9d5ee7` hardened the two navigation seams by **encapsulating a web-first
wait inside the page object that owns the navigation**, so the method does not
return until the new document has committed. Callers can no longer observe an
unsettled page.

In [`src/pages/LoginPage.ts`](../src/pages/LoginPage.ts), `login()` now waits for
the post-login document to commit before returning:

```ts
await this.logInButton.click();
// Block until the post-login navigation has COMMITTED the overview document,
// so callers never assert against an unsettled / pre-navigation page.
await this.page.waitForURL(/overview\.htm/);
// Belt-and-braces stable post-nav landmark: the overview heading is rendered
// by the committed document, confirming we are past the navigation swap.
await expect(this.page.getByRole('heading', { name: 'Accounts Overview' })).toBeVisible();
```

In [`src/pages/RegisterPage.ts`](../src/pages/RegisterPage.ts), `register()`
applies the same pattern on the register POST:

```ts
await this.registerButton.click();
// Block until the post-register navigation has COMMITTED, so a caller never
// asserts the Welcome state against the still-loading / pre-navigation page.
await this.page.waitForURL(/register\.htm/);
```

No `waitForTimeout` / fixed sleeps were introduced, no assertions were weakened,
and the fixtures and visual/a11y project scoping were left unchanged.

### Why encapsulated web-first waits fix it (vs. masking with retries)

A **web-first wait** is a wait on a *post-condition the application is guaranteed
to reach*, with Playwright auto-polling until that condition is true.
`waitForURL(/overview\.htm/)` blocks precisely until the browser has committed the
`overview.htm` document — exactly the signal that was missing. This is
*deterministic*:

- A fast engine (Chromium) satisfies the condition almost immediately and the
  wait costs nothing.
- A slow engine (WebKit) simply takes a few more milliseconds; the wait absorbs
  the difference and resolves the instant the document commits.
- It is **not** a fixed `waitForTimeout` — there is no magic duration to tune, no
  "sleep long enough and hope," and no wasted time on the common fast path.

Crucially, the wait lives **inside the page object that owns the navigation**, not
sprinkled across every caller. Every journey that logs in or registers inherits
the correct post-condition for free, and the fix can't be forgotten at a new call
site. The post-nav landmark assertion in `login()` (the Accounts Overview
heading) is a belt-and-braces confirmation that we are past the swap and rendering
the committed document.

Contrast this with **leaning on `retries` to paper over the race**: a retry just
re-runs the whole test and hopes the timing falls the other way next time. That
would have:

- **hidden a real correctness gap** in the page objects (they returned before
  their own post-condition held) behind a green-on-second-try result;
- left the flake **latent** — it would resurface on a slower CI runner, a busier
  machine, or a future engine update, because nothing about the actual race was
  addressed;
- **masked genuine regressions**, since a retry that flips red→green can equally
  flip a *real* intermittent bug to green and let it through.

Retries treat the symptom (a test that sometimes fails); the encapsulated
web-first wait removes the cause (a navigation method that returned too early).

---

## Prevention

- **Own the post-condition where the navigation happens.** Any page-object method
  whose action triggers a full-page navigation must not return until the new
  document has committed — encapsulate `waitForURL` (and, where useful, a stable
  post-nav landmark assertion) in the method itself, as `login()` and `register()`
  now do. Callers should never have to know a navigation is in flight.
- **Wait on signals, never on the clock.** Use web-first waits / auto-waiting
  assertions on conditions the app actually reaches. No `waitForTimeout`/fixed
  sleeps were added here and none should be — a sleep is just a race with a longer
  fuse.
- **`retries: 1` is kept as a deliberate safety net, NOT the fix.**
  [`playwright.config.ts:15`](../playwright.config.ts) sets
  `retries: process.env.CI ? 1 : 0`. CI gets a single retry to absorb genuinely
  unavoidable infrastructure blips (a transient network hiccup, the ParaBank
  service container hitting a momentary hiccup) so one such blip doesn't redden an
  otherwise-correct run. Locally, `retries: 0` means a flake fails loudly and gets
  fixed rather than silently retried away. The retry is a backstop for the
  *environment*, never a substitute for fixing a test-level race — those are fixed
  at the source, as this postmortem documents.
- **The cross-browser matrix is where these races get caught.** Running the same
  functional journeys on WebKit (and Firefox) via the dedicated projects in
  `playwright.config.ts` is precisely what surfaces engine-specific timing
  assumptions. Per commit `b9d5ee7`, after the fix the WebKit nav-journeys were
  verified stable across `--repeat-each=3` (run serially with `--workers=1` to
  respect the public instance's rate limit) — the intended, repeatable behavior of
  the matrix.
