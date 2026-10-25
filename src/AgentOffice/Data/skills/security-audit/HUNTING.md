# Vulnerability Hunting

### Step 2: Hunt the selected classes

Work through the boundaries from reconnaissance in priority order: (1) unauthenticated or lowest-trust entry surfaces before authenticated ones; (2) boundaries protecting the most valuable resources (credentials, cross-tenant data, code execution, release authority); (3) changed source before unchanged source; (4) classes that historically yield confirmed findings for this target type over speculative ones.

For each boundary, apply the selected ordinary attack-class block from [ATTACK-CLASSES.md](ATTACK-CLASSES.md) and, from each selected companion file, its `Core discipline`, the chosen attack-class subsections, `Universal moves`, and `Validation rules`. A path may cross several domains; keep their constraints together. If an unexpected different boundary appears, note it as uncovered rather than silently widening or dropping it.

## Defensive vulnerability-finding method

Your goal is to find source-grounded security invariant failures and the smallest fix, not to expand harm beyond the boundary result. Stay within source review and bounded local execution. Do not contact deployed endpoints, provider APIs, registries, identity systems, message brokers, shared services, or other users. Use local dummy data only.

READ THE CODE AT DEPTH. Follow each input through parsing, identity, authorization, normalization, state, derived copies, and the final sink. Read sibling, legacy, batch, retry, cancellation, migration, and error paths that produce the same effect. Compare sibling controls for equivalence, not only presence, and compare what one component guarantees with what the next component assumes.

WORK FROM A CONCRETE INVARIANT:

1. Name the lower-trust principal and starting capability.
2. Name the accepted value, action, state transition, or resource selector.
3. Locate the control that should reject, bind, isolate, limit, or revoke it.
4. Trace the exact source path after that decision.
5. Stop at the smallest affected dummy record, wrong return value, process-integrity effect, or locally observable shared-resource effect.
6. State a source-level change and regression case that enforce the invariant.

DEPTH BOUND: trace only paths that can reach the boundary under review or whose guarantees that boundary relies on. Stop a line of investigation as soon as the invariant is settled either way, and record the result (covered, candidate, blocked, or uncovered) instead of continuing to search.

TEST SAD PATHS AND DISAGREEMENTS. Check absent, empty, zero, negative, maximum, over-limit, duplicate, mixed encoding, stale, revoked, reordered, concurrent, partially migrated, failed dependency, and rollback state only where the interface accepts them. Compare canonicalization and units at every parser or policy handoff. For multi-step issues, treat each output as a prerequisite and do not assume a later boundary. If any prerequisite is not established, record a blocker.

When a proposed high or critical candidate reveals a reusable root cause, search the paths in scope for lexical, structural, and logical variants. Consolidate the same root cause, but establish each variant's conditions and impact independently.

USE THE NARROWEST LOCAL CHECK THAT SETTLES THE CLAIM, and only within the local validation boundaries below. Prefer an existing unit test, minimal function harness, dummy-tenant service call, small malformed fixture, deterministic race schedule, or locally rendered policy. Do not install or fetch tools.

Record the exact input, command, and minimum result. Never capture or copy the ambient environment, inherited variables, credentials, authentication state, or unrelated host paths into notes or reports. Never stress availability, invoke a live target, use a real credential, publish an artifact, or continue past the minimum observed effect.

A deployment, browser, provider, broker, OS, proxy, package, secret, or identity fact outside source is not proof either way. If one such fact is decisive, record a `needs_validation` candidate with the exact missing observation and safe owner-observed check.

## Candidate gate

1. A candidate needs a complete repository-relative source trace and evidence for the claimed root cause, including the strongest source-visible control.
2. A proposed confirmed record needs a bounded local observed result (or, where execution is not allowed, a source trace complete enough that the result is not in doubt), meaningful impact across a stated boundary, complete conditions, and no visible preventing layer.
3. Do not strengthen a crash into code execution, ordinary work into shared availability, or a same-principal action into privilege gain.
4. If a required fact is not source-visible or locally observable, use `needs_validation`. Name exact blockers; do not give it severity or speculative completion.
5. A missing best practice with no affected principal/resource is excluded or hardening, not a finding. A candidate disproved by source is not `needs_validation`.
6. Use one stable, source-derived identifier (fingerprint) for the same root cause across every state. It must not include a line number, severity, or verdict.
7. Report no candidates when nothing survives these gates.

## Local validation boundaries

Local execution is for confirmation, not impact expansion. It happens only through `run_command` inside the mission workspace, and only for roles that have a shell.

- **Allowed:** offline builds and tests that use dependencies already present; existing unit and integration tests; small fixture processing; bounded regression tests; deterministic concurrency checks; rendered manifests and policy evaluation with dummy identities; mocked external or paid calls. Keep every check short and small, and run it against dummy data only.
- **Disallowed:** live or deployed traffic; requests to services you did not start for this check; dependency installation or any build step that fetches from the network; real accounts or credentials; production data; shared queues, cloud resources, runners, registries, signing or release services; publishing; stress, saturation, or cost generation; writing outside the mission workspace; editing target source; any work after the minimum dummy-data boundary result.

If a check cannot be run within these boundaries, do not run it. A missing execution capability does not erase a source-grounded candidate; represent the exact blocker as `needs_validation` and give a safe validation plan.
