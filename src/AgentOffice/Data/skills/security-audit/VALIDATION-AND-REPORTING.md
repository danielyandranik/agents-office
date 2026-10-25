# Validation and Reporting

### Step 3: Try to refute every candidate

Before reporting, consolidate candidates by fingerprint and root cause, then switch roles: treat each candidate as if someone else wrote it and try to refute it from repository source and bounded local evidence. Stay inside the local validation boundaries in [HUNTING.md](HUNTING.md).

1. Re-read every cited trace and evidence location: path, positive line number, scope, and description. Confirm the first entry is a real lower-trust entrypoint and the last is the claimed sink or boundary effect.
2. Reconstruct the strongest source-visible validation, identity, authorization, normalization, lifecycle, framework, and containment controls on the path. Where the architecture summary names a comparable baseline, note whether it shares the pattern, as calibration, never as grounds to dismiss.
3. For a proposed confirmed candidate, reproduce the minimum observed result when the boundaries allow it. Verify inputs, interface shape, conditions, and affected dummy principal/resource. Do not infer a stronger result or continue after it.
4. Verify that likelihood, impact, confidence, and the proposed source fix match only what the evidence establishes.
5. For a proposed `needs_validation` candidate, decide whether the blocker is genuinely outside source/local observation. If source refutes the trace, reject it. If the missing fact remains decisive, keep `needs_validation` and make the local and owner-observed plans exact and non-destructive.
6. Keep the same fingerprint for the same source-derived root cause across every state.

Promote `needs_validation` to `confirmed` only after establishing the complete path and bounded observed result. Demote a proposed confirmation to `needs_validation` when a specific deployment or runtime fact remains unknown. Use `rejected` when source, local behavior, a visible control, missing meaningful impact, or an impossible prerequisite refutes the claim. `needs_validation` is never a parking place for a speculative idea.

When the stakes are high (a proposed BLOCKER or MAJOR) and your role has `ask_colleague`, you may ask a colleague for an independent second read of the record; give them the record, not your conclusion. The `security-verdict` skill describes the false-positive check required before a BLOCKER or MAJOR is reported.

### Step 4: Record contents

Keep these verdict contracts distinct:

- A **confirmed** record has: fingerprint, title, description, repository-relative source paths, root cause, intended behavior, ordered trace (entrypoint → propagation → sink), evidence, conditions, execution (the bounded local check performed, in the target's native interface: API/HTTP input, CLI call, library call, message, file fixture, browser action, rendered policy, or local harness), the factual observed result, remediation (described, not applied), severity (likelihood, impact, overall), and confidence.
- A **needs_validation** record has: fingerprint, title, description, claimed root cause, trace, evidence, blockers, and at least one validation plan (`local` with a bounded fixture, or `deployment` asking an owner to observe a configuration, identity, route, policy, or runtime fact). It has no severity, execution, or remediation.
- A **rejected** record has: fingerprint, claimed root cause, trace, evidence, and the reason it was refuted. It has no severity.

Overall severity cannot exceed demonstrated impact.

### Step 5: Report

Derive prose from the final records only. The prose never changes a verdict, severity, blocker, or demonstrated impact. Deliver the report the way whoever asked wants it: as a message, a mission-workspace file via `write_file` if asked, and/or task-board updates.

1. Scope, source ref (commit or "workspace snapshot"), the statement that execution stayed source-and-local-only, and explicit not-reviewed areas. A scoped or partial review states plainly that it is a partial pass.
2. One short security posture summary.
3. A confirmed-findings table: severity (BLOCKER / MAJOR / MINOR / NIT), title, affected boundary, and one-line observed result.
4. Each confirmed finding: repository source location, lower-trust principal, target-native bounded reproduction, conditions, actual result, impact, priority rationale, and smallest source fix. For BLOCKER and MAJOR findings include the complete ordered trace, the dummy principal and resource, the exact bounded instructions, the observed output and the invariant it proves, and a regression case.
5. A separate `NEEDS VALIDATION` table. Give each lead's title, repository trace, exact blocker, bounded local next step, and safe owner-observed deployment check. Do not assign severity or call it a confirmed vulnerability.
6. Separate hardening notes and positive source patterns.
7. Coverage summary from your coverage notes: covered, candidate, blocked, and not-reviewed areas, plus important exclusions.

Do not describe rejected records as findings. Mention them only when they explain a disagreement or coverage decision.

HTTP is one possible native interface, not the default. A library finding may use a function call, a parser a fixture, a CLI a command, a desktop app an IPC or file action, and infrastructure a locally rendered policy. Do not require an endpoint, external account, or live environment that the target does not have.

Keep the report proportional to the evidence. A clean review may have zero confirmed records. State that result and the remaining coverage/validation limits without inventing NIT findings.
