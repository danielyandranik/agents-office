---
name: security-verdict
description: "Turn security findings from any source (security-review, differential-review, security-audit, threat-model-analyst, dependency-review, scanners, colleagues) into one normalized BLOCKER/MAJOR/MINOR/NIT list, require an evidence-backed false-positive check (exploitability, reachability, preconditions) for every BLOCKER and MAJOR, and end with a verdict: SHIP, FIX FIRST or NEEDS DISCUSSION. The reviewer does not write patches. Use when a change or release needs a security sign-off, or when several security reports must be merged into one decision."
---

# Security Verdict

The Security Reviewer's verdict can block a merge, so it must be precise in both directions: no
real BLOCKER waved through, no false alarm blocking work. This skill is the last step after the
analysis skills; it does not replace them.

## Rules

- **Read-only.** Do not edit code, configuration or dependencies, and do not write patches or
  diffs. Describe the fix in words (and, if it helps, a short illustrative snippet in the report)
  for the engineer who owns it.
- **Evidence over assertion.** Every finding cites `path:line` (or a package and version) and
  every BLOCKER/MAJOR has a completed false-positive check.
- **Do not invent findings.** Only normalize what the inputs and your own checks support.
- Static checks only, inside the mission workspace. Do not run exploits against shared or
  production systems. A local proof using test data in the workspace is fine when quick and safe.

## Step 1: Collect the inputs

Gather every finding for the scope under review: reports in the workspace, board tasks
(`board_list`), colleagues' notes, scanner output. Record for each one its source, its original
severity label and its location. Note the scope (branch, commit range, release) and what was not
reviewed.

## Step 2: Deduplicate and normalize

Merge findings that describe the same root cause at the same location (keep all sources). Then map
severity to the office scale.

| Office | Means | Common upstream labels |
|---|---|---|
| **BLOCKER** | Exploitable now by a realistic attacker with serious impact: auth bypass, cross-tenant or unauthorized data access, RCE, injection reaching a sink, secrets exposed, payment/integrity compromise | Critical; P0; SDL Critical; CVSS 9.0-10.0 |
| **MAJOR** | Exploitable with some preconditions, or serious impact with limited reach: stored XSS, SSRF to internal services, privilege escalation needing a valid account, missing authz on a sensitive but low-volume action, known-exploited dependency vulnerability on a reachable path | High; P1; SDL Important; CVSS 7.0-8.9 |
| **MINOR** | Real weakness with low impact or hard preconditions; defense-in-depth gaps: missing rate limit, verbose errors, weak but not broken crypto settings | Medium; P2; SDL Moderate; CVSS 4.0-6.9 |
| **NIT** | Hardening and hygiene with no demonstrated attack path: headers, logging improvements, informational notes | Low; Info; P3; SDL Low; CVSS below 4.0 |

Re-rate a finding when the evidence says so, and record the original label. Severity comes from
impact and exploitability in *this* system, not from the source's label.

## Step 3: False-positive check for every BLOCKER and MAJOR

Answer each question with evidence (file and line, command output, config value). A finding stays
BLOCKER/MAJOR only if the check supports it.

1. **Reachability**: Can attacker-controlled input actually reach the vulnerable code? Trace the
   path from an entry point (route, handler, job, CLI argument, message) to the sink. Cite each hop.
2. **Exploitability**: Does any control on that path neutralize it (validation, parameterized query,
   encoding, framework protection, allow-list, type constraint)? Read the control, do not assume.
3. **Preconditions**: What must the attacker already have (unauthenticated, any user, admin,
   network position, a specific config or feature flag)? Is that configuration actually deployed
   or the default?
4. **Impact**: What exactly is gained (which data, whose account, what action), and for how many
   users or tenants?
5. **Counter-evidence**: What would prove this a false positive? Look for it explicitly (tests,
   middleware, upstream guards, dead code, test-only files).

Record the outcome as one of:

- **CONFIRMED**: path, control gap and impact shown with evidence. Keep the severity.
- **LIKELY**: path mostly shown but one link is unverified (dynamic dispatch, config you cannot
  see). Keep it at MAJOR at most, and list exactly what is unverified.
- **FALSE POSITIVE**: a control or missing path is shown. Drop it from the counts and keep it in a
  "Dismissed" section with the evidence, so nobody re-raises it.
- **DOWNGRADED**: real but the preconditions or impact justify MINOR or NIT. Say why.

For dependency advisories, reachability means the vulnerable function or feature is actually used
by this code (see `dependency-review`).

## Step 4: Decide the verdict

| Verdict | When |
|---|---|
| **SHIP** | No CONFIRMED or LIKELY BLOCKER, and no CONFIRMED MAJOR. MINOR and NIT items are listed for follow-up. |
| **FIX FIRST** | Any CONFIRMED BLOCKER, or any CONFIRMED MAJOR. List exactly what must change before merging or releasing. |
| **NEEDS DISCUSSION** | A LIKELY BLOCKER you could not confirm or rule out; a risk that depends on a business decision (accepting a known risk, a compensating control outside the code); conflicting findings; or the review scope was too incomplete to judge. Name the question and who should answer it. |

The verdict is yours to recommend; accepting a risk is the owner's decision. Never mark SHIP when
in-scope code was not reviewed: that is NEEDS DISCUSSION with the gap named.

## Output format

Write the report to the workspace (for example `security/verdict-<scope>.md`) and post the verdict
line and counts to whoever asked and on the board task.

```markdown
# Security Verdict: <scope>

**Verdict: FIX FIRST**  (BLOCKER 1, MAJOR 1, MINOR 2, NIT 3; 2 dismissed)
Scope: <branch/commit range/release>; inputs: <list of reports and tools>
Not reviewed: <areas, and why>

## Must fix before merge
### [BLOCKER] SEC-1: Missing tenant check on invoice download
- Location: src/api/invoices.ts:88
- Sources: security-review VULN-002 (High), differential-review (CRITICAL)
- False-positive check: CONFIRMED
  - Reachability: GET /invoices/:id -> router.ts:41 -> invoices.ts:88, any logged-in user
  - Exploitability: no ownership filter; query at invoices.ts:92 uses id only
  - Preconditions: any authenticated account in any tenant
  - Impact: read any tenant's invoices (names, amounts, addresses)
  - Counter-evidence sought: no middleware on the route (router.ts:30-45), no test covers it
- Remediation (for the code owner): scope the query by the caller's tenant id and add a
  cross-tenant test.

## Follow-up (does not block)
| ID | Severity | Title | Location | Note |
|---|---|---|---|---|
| SEC-3 | MINOR | No rate limit on login | src/auth/login.ts:15 | ... |

## Needs discussion
- <question, who should answer>

## Dismissed (false positives)
| Source finding | Why dismissed | Evidence |
|---|---|---|
| scanner: SQL injection in reports.ts:40 | value is an enum checked at reports.ts:31 | reports.ts:31-36 |
```

## Checklist

- [ ] All inputs listed; duplicates merged with every source kept.
- [ ] Every finding mapped to BLOCKER/MAJOR/MINOR/NIT, original label recorded.
- [ ] Every BLOCKER/MAJOR has a five-part false-positive check with evidence and an outcome.
- [ ] Dismissed findings kept with their evidence.
- [ ] Verdict follows the table; gaps in scope stated.
- [ ] No code, config or dependency was changed; remediation is described, not applied.

## Do not

- Do not write patches, open pull requests or "quickly fix" a finding.
- Do not raise severity on a hunch or lower it to make a deadline.
- Do not let a source's confidence label stand in for your own reachability check.
- Do not mark SHIP to be agreeable; NEEDS DISCUSSION is the honest answer when evidence is missing.
