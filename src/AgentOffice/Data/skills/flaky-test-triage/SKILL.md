---
name: flaky-test-triage
description: "Triage and fix an intermittently failing (flaky) test: measure or estimate the failure rate, reproduce it with an N-run loop sized to that rate, classify the cause (timing, order dependence, shared state, environment, external services), fix the root cause and validate with the same loop. Forbids sleeps, blind retries, raised timeouts and weakened assertions as fixes. Use when a test passes and fails without code changes, when CI is 'red sometimes', or before quarantining or deleting a test."
---

# Flaky Test Triage

Three rules, in order:

1. **Reproduce before you fix.** A fix for a failure you never observed is a guess.
2. **Fix the root cause.** Sleeps, longer timeouts, retries and looser assertions hide a flake;
   they do not fix it.
3. **Validate with an N-run loop.** One green run proves nothing about an intermittent failure.

Requires `run_command` in the mission workspace and the project's test runner installed there.
Without them, you can still classify the likely cause by reading the test, but say clearly that
nothing was reproduced or validated.

## Step 1: Pin down the failure

- Exact test id (file and name), the failing assertion or error, and any warnings printed before it.
- Where it fails: locally, in CI, only on some machines, only in the full suite?
- The failure rate, from evidence: CI logs or reports in the workspace, a board task history, or
  what the owner reported. Write it as "about 1 in k runs". If you only have anecdotes, say so.
- Interleaved pass/fail suggests a flake. A long unbroken run of failures since a specific change
  is more likely a real regression: treat it with `systematic-debugging` instead.

## Step 2: Reproduce with a sized N-run loop

Run the single test in a loop and count failures. Size the loop to the rate:

- Known rate of about 1 in k: run **N = max(3k, 20)** times.
- No usable estimate: run **50** and note the lower confidence.
- Escalate conditions only if the plain loop stays green: run with the rest of its file, then the
  full suite; randomize or reverse test order; run in parallel workers; add CPU load; use CI-like
  settings (env vars, TZ, locale, headless).

```bash
# Generic loop; replace the command with the project's runner for ONE test
pass=0; fail=0
for i in $(seq 1 30); do
  if npx --no-install jest path/to/file.test.ts -t "test name" > "flaky-run-$i.log" 2>&1; then
    pass=$((pass+1)); rm "flaky-run-$i.log"
  else
    fail=$((fail+1))
  fi
done
echo "pass=$pass fail=$fail"
```

Many runners have built-in repetition (`pytest --count` with pytest-repeat, `go test -count=N`,
`dotnet test` in a loop, Playwright `--repeat-each=N`). Use whatever is already installed; do not
install plugins. Keep the logs of failing runs: they are the evidence.

If it never fails locally after escalation, record that, read the failing CI log closely, and go
to Step 3 with the log as your only evidence. Label any later fix as **analytical, not
reproduced**.

## Step 3: Classify the cause

Match the symptom to a class, then confirm it with a targeted experiment (for example, run the
test alone vs after a specific neighbour, or fix the clock and see if the failure disappears).

| Class | Typical symptoms | Usual root cause |
|---|---|---|
| **Timing / async** | timeouts waiting for an element, promise or event; passes on fast machines | unawaited async work, racing on an animation or debounce, asserting before the condition is true |
| **Order dependence** | passes alone, fails after a specific test (or only alone) | a test relies on side effects of another, missing setup |
| **Shared state** | fails in the full suite or in parallel workers | leaked globals, module caches, singletons, database rows, files, ports shared between tests |
| **Environment** | fails only in CI, one OS, one time zone, near midnight/month end, under load | real clock or `now()`, locale, TZ, file system case or path, resource limits, unpinned tool versions |
| **Nondeterministic data** | assertion on list order, generated ids, floats, random values | unordered queries, random seeds, hash ordering, float precision |
| **External services** | network errors, 5xx, rate limits, slow responses | the test talks to a real third-party or shared service |

The cause can be in product code (a genuine race). Then the test found a real bug: report it with
`bug-report-severity` and fix it there, not in the test.

## Step 4: Fix the root cause

Good fixes, by class:

- Timing: wait for the specific condition (element visible, promise resolved, event received),
  use fake timers, await the work you started.
- Order / shared state: give each test its own setup and teardown, unique ids, fresh database
  transactions or schemas, temp directories, reset globals.
- Environment: inject the clock, pin TZ and locale in the test, avoid absolute paths, pin versions.
- Nondeterministic data: sort before comparing, seed randomness, compare with tolerances.
- External services: replace the network call with a fake, stub or recorded response at the test
  boundary; keep one separate, clearly labelled contract test if the real service matters.

**Forbidden as fixes** (they hide the flake):

- Adding `sleep`, `setTimeout`, `waitForTimeout` or fixed delays before an assertion.
- Raising test, hook or network timeouts without finding what was slow.
- Wrapping the test or the step in retries, or turning on runner-level retries. (A retry is
  acceptable only around a genuinely nondeterministic external system that the test must call,
  with a comment explaining why, and only after the owner agrees.)
- Loosening or deleting assertions, or asserting on less than the behavior requires.
- Skipping, quarantining or deleting the test without the owner's explicit approval and a board
  task that tracks it.

If the right outcome is to move the check to a lower test level or delete a test that should not
exist, propose it; do not do it unilaterally.

## Step 5: Validate

Re-run the same N-run loop under the same conditions that reproduced the failure (same order,
parallelism, load). Any failure sends you back to Step 3. Then run the test's whole file or suite
once to check you did not break neighbours. Apply `verification-before-completion`: report the
actual counts, not "it passes now".

## Report

```markdown
# Flaky test: <file> :: <test name>

- Observed rate before: <e.g. ~1 in 10 (source: CI logs in ci/logs/, 6 of 60 runs)>
- Reproduction: <command, conditions, result e.g. 4 fail / 30 runs with --runInBand off>
- Cause class: <Timing | Order | Shared state | Environment | Data | External>
- Root cause: <one or two sentences, with file:line>
- Confirming experiment: <what you changed and what happened>
- Fix: <what changed, files touched; test-only or product code>
- Validation: <command, N runs, result e.g. 0 fail / 30 runs; full file green>
- Confidence: reproduced and validated | analytical only (never reproduced)
- Follow-ups: <other tests with the same pattern, product bug filed, board task ids>
```

## Do not

- Do not call a test flaky because it failed once; measure first.
- Do not report "fixed" after a single green run.
- Do not change the assertion to match the flaky output.
- Do not leave temporary loop logs or debug edits in the workspace when you finish, except the
  evidence you cite.
