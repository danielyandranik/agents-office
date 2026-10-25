---
name: bug-report-severity
description: "Write a bug report that extends the bug-reproduction-brief with an Agent Office severity rating (BLOCKER/MAJOR/MINOR/NIT, defined concretely), user impact, frequency and a mandatory evidence block. Use when filing or triaging a bug for an engineer or the owner, when asked how bad a bug is, or when a test or exploratory session finds a defect that needs to be handed off."
---

# Bug Report with Severity

A bug report has two jobs: let an engineer reproduce the problem without asking you anything, and
let the owner decide how urgently to fix it. This skill adds the second job to
`bug-reproduction-brief`.

## Step 1: Reproduce first

Follow `bug-reproduction-brief` (record the failure, environment, expected vs actual, reduce,
prove repeatability, stop before repair). If you cannot reproduce it, you can still file the
report, but `Reproduced` must say `no` or `intermittent` and severity must say what it would be
*if* confirmed.

## Step 2: Rate severity with the office rubric

Severity is about **impact if it happens**, not how often or how easy the fix is. Pick the highest
level whose definition fits; when torn between two, pick the higher and say why.

| Severity | Definition (any one is enough) | Examples |
|---|---|---|
| **BLOCKER** | Data loss or corruption; security or privacy exposure (auth bypass, cross-tenant access, leaked secrets or personal data); money or billing wrong; a core flow is unusable for everyone or for a whole role with no workaround; the build, deploy or app start is broken; legal/compliance violation. | Saving an order silently drops line items. Viewer role can delete projects. Login fails for all SSO users. |
| **MAJOR** | A core flow is broken for some users or inputs, or works only with a painful workaround; an important feature returns wrong results; serious performance degradation (timeouts, multi-second waits on common actions); accessibility barrier that blocks a task; regression of previously working behavior. | Export fails for files over 10 MB. Search ignores the date filter. Screen reader cannot reach the Submit button. |
| **MINOR** | A secondary feature misbehaves or a core flow has a cosmetic-but-confusing defect, with an easy workaround; unclear or wrong error messages; edge-case input handled badly without data loss. | Pagination shows "Page 3 of 2" after deleting items. Error says "Unknown error" for a validation failure. |
| **NIT** | Cosmetic or polish issues with no functional effect: typos, alignment, inconsistent capitalization, minor visual glitches, log noise. | Button label "Cancle". Icon misaligned by 2 px. |

Escalation rules:

- Any security or data-integrity bug starts at BLOCKER; lower it only with a stated reason
  (for example, "requires admin access the attacker already has"). Hand security bugs to the
  Security Reviewer too.
- A regression is at least MAJOR when it breaks something that a user relies on.
- A workaround lowers severity only if a typical user would find it unaided.

## Step 3: Describe user impact and frequency

- **User impact**: who is affected (all users, a role, a tenant, a browser, a locale), what they
  cannot do or what goes wrong for them, and the consequence (lost work, wrong invoice, support
  ticket). One or two sentences, concrete.
- **Frequency**: `always` (every attempt), `often` (more than about 1 in 5), `sometimes` (less), or
  `rare`, backed by the numbers you observed (`failed 7 of 10 runs`). Also state how common the
  triggering condition is for users, if known.

Severity and frequency are separate fields. Do not fold frequency into severity; the owner
combines them into priority.

## Step 4: Fill in the evidence block (mandatory)

No evidence, no report. The block must contain at least one of: the command and its output, a
request and response, a failing test with its output, a log excerpt with timestamps, or a
screenshot/trace path in the workspace. Copy output verbatim and trim, never paraphrase.
Redact secrets, tokens and personal data.

## Output format

```markdown
# Bug: <short, specific title: what fails, where, under which condition>

- Severity: BLOCKER | MAJOR | MINOR | NIT  - <one-line justification against the rubric>
- Frequency: always | often | sometimes | rare  - <observed: N of M attempts>
- User impact: <who, what they cannot do, consequence>
- Reproduced: yes | no | intermittent
- Target and commit: <repo/branch/commit or build>
- Environment: <runtime versions, OS/container, flags, local/test/staging>

## Expected
<observable result>

## Actual
<observable result, including status or error>

## Minimal steps
1. ...
2. ...

## Minimal fixture / input
<smallest data that triggers it, or path to it in the workspace>

## Evidence
    $ <exact command>
    <verbatim output, trimmed>
<paths to screenshots, traces or logs in the workspace>

## Unknowns
- <what you could not determine>

## Safe next hypothesis to test
- <one hypothesis, clearly labelled as unconfirmed>
```

File it where whoever asked wants it: usually as a mission board task (`board_add`) with the
severity in the title, for example `[MAJOR] Export fails for files over 10 MB`, and the full
report in the description or in a workspace file it links to. Hand it to an engineer with
`ask_colleague` only if you were asked to route it.

## Checklist

- [ ] Title says what fails, where and when; no root-cause guess in the title.
- [ ] Severity chosen from the rubric with a one-line justification.
- [ ] Frequency backed by observed counts.
- [ ] User impact names who is affected and the consequence.
- [ ] Expected and actual are observable and free of suspected causes.
- [ ] Evidence block present, verbatim, secrets redacted.

## Do not

- Do not inflate severity to get attention, or deflate it because the fix looks easy.
- Do not claim a root cause from correlation; put it under hypotheses.
- Do not fix the bug in the same step as reporting it.
- Do not file duplicates: check the board (`board_list`) for an existing report first and add your
  evidence there instead.
