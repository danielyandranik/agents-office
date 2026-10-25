---
name: exploratory-charter
description: "Run a time-boxed, charter-driven exploratory testing session: write a charter (mission, areas, risks, oracles), explore with heuristics such as boundaries, interruptions and permissions, keep a timestamped observation log, and finish with bugs found, open questions and follow-up test ideas. Use when a feature needs testing beyond scripted acceptance checks, when there are no written criteria, or when asked to 'poke at', 'explore' or 'try to break' something."
---

# Exploratory Testing Charter

Exploratory testing is simultaneous learning, test design and execution. The charter keeps it
focused; the time box keeps it honest; the log makes it reviewable. A session without a log is
not a test session.

## When to use

- After scripted checks pass and you want to find what they miss.
- When a feature has thin or no acceptance criteria.
- When a risky change lands (new permissions, payments, data migration, concurrency).
- Not a replacement for `ac-test-plan` when there are agreed criteria to verify.

## Step 1: Write the charter (before touching the product)

Keep it to one screen. Use this template:

```markdown
# Charter: <short name>
Mission: Explore <target area> with <resources/techniques> to discover <kind of information>.
Time box: <30 | 60 | 90> minutes (start: <time>, end: <time>)
Build / environment: <commit, branch, URL or command, test accounts>
Areas in scope: <screens, endpoints, commands, files>
Out of scope: <what you will not touch, and why>
Risks to probe: <3-5 specific things that could go wrong, ranked>
Oracles: <how you will recognise a problem: spec, AC, similar features, API docs, error-handling
  conventions, the owner's statements, common sense about data loss and security>
Heuristics planned: <pick 3-5 from the list below>
```

A good mission names a target and the information wanted, for example "Explore CSV import with
malformed and very large files to discover data-loss and error-message problems".
If you cannot name the risks, read the task, the diff and the surrounding code first.

Pick the time box from the risk: 30 minutes for a small change, 60 for a feature, 90 at most.
Split anything larger into several charters.

## Step 2: Explore with heuristics

Choose heuristics that fit the risks. Work through each one on purpose and log what you tried.

| Heuristic | Try |
|---|---|
| Boundaries | 0, 1, max, max+1, negative, empty, null, whitespace, very long, unicode/emoji, leading zeros |
| Interruptions | cancel mid-operation, refresh, back button, close tab, kill the process, network drop, timeout, double submit |
| Permissions | each role, logged out, expired session, another tenant's ids, direct URL/API access to hidden actions |
| State and sequence | do steps out of order, repeat a step, undo/redo, two sessions editing the same record |
| Data shape | missing fields, extra fields, wrong types, duplicates, special characters, injection-looking strings (observe only) |
| Time | time zones, DST changes, month/year ends, clock skew, long-running sessions |
| Volume | many items, pagination ends, large files, slow responses |
| Configuration | feature flags on/off, missing env settings, different browsers or locales |
| Error paths | dependency down, disk full, invalid config: are messages clear and free of secrets/stack traces? |
| Consistency | does it behave like similar features in the same product? do UI, API and stored data agree? |

Tools: `run_command` for CLIs, scripts and HTTP requests inside the workspace; `playwright-cli`
for web UIs if it is installed; `read_file` to check stored data and logs. Use test accounts and
dummy data only. Never point the session at production unless the owner explicitly said so.

## Step 3: Keep the observation log as you go

Log in real time, not from memory at the end. One line per action or observation:

```markdown
| Time | Action / input | Observation | Tag |
|---|---|---|---|
| 10:04 | Upload 0-byte CSV | "Import complete, 0 rows" (no warning) | QUESTION |
| 10:09 | Upload 60 MB CSV | 500 after 30 s, temp file left in /tmp/import | BUG |
| 10:15 | Viewer role opens /admin/import via URL | Page loads, Import button works | BUG |
| 10:22 | Upload CSV with BOM | Header "name" (with a byte-order mark) not recognised | BUG |
```

Tags: `BUG` (violates an oracle), `QUESTION` (unclear whether intended), `IDEA` (worth a test
later), `NOTE` (context), `SETUP` (time spent on environment, not testing).

If you find a serious bug early, note it, capture minimal evidence, and keep exploring; do not
turn the session into a debugging session. If the environment is broken and blocks the charter,
stop, log it, and report the session as blocked.

## Step 4: Debrief when the time box ends

Stop at the end of the time box even if you are mid-idea; put the idea under follow-ups. Then
write the session report.

```markdown
# Session report: <charter name>
Charter: <link or copy>
Time: <start-end>, <actual minutes>; split: <% testing / % bug investigation / % setup>
Coverage: <areas and heuristics actually exercised; what was not reached>

## Bugs found
| # | Title | Severity | Evidence | Written up |
|---|---|---|---|---|
| 1 | Viewer can run import via direct URL | BLOCKER | log 10:15, qa/evidence/viewer-import.png | board task #42 |

## Questions for the owner / engineer
- Should a 0-byte file be rejected or accepted silently?

## Follow-up test ideas
- Automate: role matrix test for /admin/* routes.
- New charter: concurrency on import (two uploads at once).

## Observation log
<the full table from Step 3>
```

Rate severity with the `bug-report-severity` rubric and write up every BLOCKER or MAJOR with that
skill (or `bug-reproduction-brief`) before you finish. Add follow-up ideas to the mission board
(`board_add`) only if whoever asked wants them tracked.

## Checklist

- [ ] Charter written before exploring, with mission, scope, risks, oracles and time box.
- [ ] At least three heuristics exercised on purpose and named in the coverage section.
- [ ] Log written during the session, with times and tags.
- [ ] Every BUG has evidence (command output, screenshot path, request/response).
- [ ] Session stopped at the time box; what was not covered is stated.
- [ ] BLOCKER/MAJOR bugs written up; questions sent to whoever can answer them.

## Do not

- Do not explore without a charter, or silently widen the scope mid-session.
- Do not report "no bugs found" without the coverage section saying what was tried.
- Do not fix the bugs you find during the session.
- Do not use real customer data, real credentials or production systems unless the owner said so.
- Do not run destructive actions (deleting data, mass emails, payments) outside a disposable
  test environment.
