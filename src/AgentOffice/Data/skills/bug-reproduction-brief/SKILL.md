---
name: bug-reproduction-brief
description: "Turn a vague, intermittent, or environment-specific bug report into a minimal evidence-backed reproduction before proposing a fix. Use when a bug report is incomplete, flaky, environment-specific or mixed with an assumed cause, and you need to prove the smallest observable failure before diagnosis or repair."
license: MIT
---

# Bug Reproduction Brief

Use this skill when a bug report is incomplete, intermittent, environment-specific, or mixed with an assumed cause. The goal is to prove the smallest observable failure before diagnosis or repair begins.

Work from the mission workspace, the board task and whatever the owner or the reporting colleague provided. Reproducing needs `run_command` (a shell inside the mission workspace); without one, write the brief from what you can read and mark `Reproduced: no (not attempted, no shell)`.

## 1. Record the observed failure

Capture the exact error, incorrect output, timestamp, affected route or command, and the smallest known input. Preserve relevant logs without secrets or personal data. Label second-hand descriptions as unverified.

## 2. Identify the environment

Record only facts you can inspect:

- repository and commit (if the workspace is a git repository);
- runtime and package-manager versions;
- operating system or container;
- dependency lockfile;
- relevant feature flags;
- whether the target is local, test, staging, or production.

Never guess credentials or production configuration.

## 3. Separate expected from actual behaviour

Write two explicit observable statements:

```text
Expected: [observable result]
Actual:   [observable result, including status or error]
```

Do not put the suspected cause in either statement.

## 4. Reduce the reproduction

Start from the reported path, then remove unrelated data, services, and steps one at a time. Keep the smallest fixture that still fails. If the failure stops, restore the last removed condition and record it.

Prefer an isolated test, minimal script, or smallest safe request over reproducing against production. Any fixture or script you write goes in the mission workspace.

## 5. Prove repeatability

Run the minimal reproduction at least twice where safe. Record commands and outputs. If the failure is intermittent, report the observed frequency and duration instead of calling it deterministic (for flaky tests, the `flaky-test-triage` skill has an N-run loop).

## 6. Stop before repair

A verified reproduction is the deliverable. Do not edit implementation code while building the brief because that can destroy the evidence or mix diagnosis with remediation.

## Output

```markdown
# Bug Reproduction Brief

- Target and commit:
- Environment:
- Expected:
- Actual:
- Minimal steps:
- Minimal fixture:
- Reproduced: yes / no / intermittent
- Evidence:
- Unknowns:
- Safe next hypothesis to test:
```

To add a severity rating, user impact and frequency, use the `bug-report-severity` skill, which extends this brief.

## Safety boundaries

- Do not change production data merely to reproduce a bug.
- Do not publish secrets, customer records, or private source.
- Do not claim a root cause from correlation alone.
- Use read-only or reversible discovery first.
- Stop after a verified reproduction; diagnosis and repair are separate workflows (see `systematic-debugging`).

## Example request

```text
Use the Bug Reproduction Brief skill on the failing checkout test. Do not fix it yet. Reduce it to the smallest safe failing fixture and report the exact command evidence, expected result, actual result, and remaining unknowns.
```

## Source and licence

Adapted from the MIT-licensed workflow at https://github.com/skyestrela/ai-agent-skill-preview, via github/awesome-copilot (MIT). Both licence notices are in LICENSE.
