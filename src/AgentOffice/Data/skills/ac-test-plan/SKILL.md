---
name: ac-test-plan
description: "Turn a task's acceptance criteria into a test plan: for each criterion list happy, edge and negative cases, map every case to an automated test or a manual check, run them, and finish with a per-criterion PASS/FAIL table backed by command output. Use when a story, board task or spec has acceptance criteria and you must show whether the work meets them, or when asked to plan or execute QA for a feature."
---

# Acceptance-Criteria Test Plan

The deliverable is a plan that a colleague could execute without asking you anything, and a
verdict per acceptance criterion that a reviewer can trust because every PASS has evidence.

## When to use

- A board task, spec or owner request lists acceptance criteria (AC) and the work is ready to test.
- Someone asks "is this done?", "does it meet the AC?" or "plan the QA for this".
- Not for auditing existing test suites (use `test-gap-audit`) or for open-ended bug hunting
  (use `exploratory-charter`).

## Step 1: Collect and number the criteria

1. Read the board task (`board_list`), the spec and anything the owner provided.
2. Copy every criterion verbatim and number it `AC1`, `AC2`, ... Do not merge or reword them.
3. If a criterion is ambiguous or untestable ("fast", "user-friendly"), write down the concrete
   interpretation you will test (`AC3 interpreted as: search returns in < 1 s for 1,000 rows`) and
   flag it in the report. If the ambiguity decides PASS vs FAIL, ask whoever asked before testing.
4. Note implicit criteria you will also check (existing behavior must not regress, errors must
   not leak secrets), labelled `IMPLICIT`, so they are never mistaken for the agreed AC.

## Step 2: Derive cases per criterion

For each AC, write at least one case of each kind:

| Kind | What it proves | Typical sources |
|---|---|---|
| Happy | The criterion holds on the normal path | the AC's own example, the main user flow |
| Edge | It still holds at the limits | boundaries (0, 1, max, max+1), empty, very long, unicode, time zones, concurrency, pagination ends |
| Negative | Invalid or unauthorized use is rejected cleanly | bad input, missing fields, wrong role, expired session, dependency down |

Give each case an id (`AC2-E1`) with: preconditions, steps or input, and the **expected observable
result** (status code, message, record state). "Works correctly" is not an expected result.

## Step 3: Map each case to a check

For every case choose exactly one:

- **Automated (existing)**: name the test file and test name that already proves it. Read the test
  and confirm its assertion actually checks the expected result.
- **Automated (new)**: a test you will write in the workspace, following the project's test
  conventions. Use `test-driven-development` habits: see it fail against a broken expectation before
  trusting a pass.
- **Manual**: a command, request or UI walk-through you will run, with the exact command. For web
  UIs, use `playwright-cli` if it is installed in the workspace.
- **Not testable here**: say why (needs production data, a third-party account, hardware) and what
  would be needed. This case cannot count toward PASS.

Prefer the lowest test level that proves the behavior. Do not modify production code to make a
test pass; a failing AC is a finding, not something to quietly fix.

## Step 4: Execute and capture evidence

Run every check with `run_command` inside the mission workspace and keep the output. Apply the
`verification-before-completion` skill: no PASS without fresh output from this session.

- Record the exact command and the relevant lines of its output (exit code, test summary, response
  body). Trim long logs but never edit them.
- Run the full relevant test file or suite once at the end too, to catch regressions your new
  tests introduced.
- If a check fails, record it and move on; do not stop the plan at the first failure. For a
  failure you need to hand to an engineer, write it up with `bug-report-severity`.
- If something passes only sometimes, it is not a PASS; see `flaky-test-triage`.

## Step 5: Verdict per criterion

A criterion is:

- **PASS**: every happy, edge and negative case for it was checked and passed, with evidence.
- **FAIL**: at least one case failed. Name the case.
- **BLOCKED**: at least one case could not be run (environment, missing tool, missing access) and
  none failed. Say what is needed to unblock.

Never mark PASS on reasoning alone ("the code looks right"). Partial evidence is BLOCKED, not PASS.

## Output format

Write the plan and results to the workspace (for example `qa/ac-test-plan-<task>.md`) and give
whoever asked the summary table.

```markdown
# AC Test Plan: <task title>

Scope: <build/commit/branch tested, environment, date>
Criteria source: <board task id / spec path>

## AC1: <criterion, verbatim>
Interpretation (if any): ...

| Case | Kind | Steps / input | Expected | Check | Result |
|---|---|---|---|---|---|
| AC1-H1 | Happy | ... | ... | auto: tests/orders.test.ts "creates order" | PASS |
| AC1-E1 | Edge | qty = 0 | 400 "quantity must be > 0" | manual: curl ... | FAIL |
| AC1-N1 | Negative | no auth header | 401 | auto (new): tests/orders.auth.test.ts | PASS |

Evidence:
    $ npm test -- tests/orders.test.ts
    Tests: 12 passed, 12 total   (exit 0)
    $ curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/orders -d '{"qty":0}'
    201

## Summary

| AC | Verdict | Failing / blocked cases | Evidence |
|---|---|---|---|
| AC1 | FAIL | AC1-E1 (qty 0 accepted, 201) | qa/evidence/ac1.txt |
| AC2 | PASS | - | npm test output above |
| AC3 | BLOCKED | AC3-N2 needs a second tenant account | - |

Overall: <N> PASS, <N> FAIL, <N> BLOCKED. Bugs filed: <links or board task ids>.
Not tested: <anything out of scope and why>.
```

## Checklist before you report

- [ ] Every AC copied verbatim and numbered; interpretations flagged.
- [ ] Each AC has at least one happy, one edge and one negative case.
- [ ] Each case has an observable expected result and exactly one mapped check.
- [ ] Every PASS has command output from this session next to it.
- [ ] FAIL and BLOCKED cases are named in the summary; bugs are written up.
- [ ] Board task updated (`board_update`) with the summary or a link to the plan file.

## Do not

- Do not report "all AC met" from a single green test run that does not cover each case.
- Do not weaken an expected result after seeing the actual one. If the expectation was wrong, say
  so and ask whoever owns the criteria.
- Do not change production code during testing, and do not move board tasks to done on behalf of
  the owner.
- Do not count "not testable here" cases as passed.
