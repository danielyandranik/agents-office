---
name: security-audit
description: "Source-first security guidance and vulnerability review for codebases, APIs, services, CLI tools, libraries, and daemons. Use for security questions, focused reviews of a feature, path or boundary, vulnerability research, triage of specific findings, or a security audit done by reading source. Strong on trust boundaries and tenant/data isolation. Reports confirmed / needs_validation / rejected findings with BLOCKER/MAJOR/MINOR/NIT severity; read-only, never patches code."
license: MIT
---

# Security Audit

Find vulnerabilities that violate a real trust boundary, then give owners the source evidence, safe reproduction, priority, and smallest effective fix. This is a defensive, source-first workflow. A candidate without a concrete affected principal, resource, or security outcome is not a confirmed finding.

## Operating mode

This skill runs in guidance mode only. For security questions, focused reviews, methodology, triage, or investigation of specific findings, use only the relevant parts of this skill. For a broader audit request, work through the steps below at the scope whoever asked set; if the scope is unclear, ask one focused question before starting. You are a reviewer: you describe fixes, you do not write patches or modify target source.

You work with `list_files`, `read_file`, and (if your role has a shell) `run_command` inside the mission workspace. There are no subagents, browser sessions, or external services. Git history is available only when your role has a shell and the workspace is a git repository.

## Execution safety

Source inspection is read-only. Running target-controlled code (builds, tests, processes, fixtures) is optional and allowed only within the local validation boundaries in [HUNTING.md](HUNTING.md): inside the mission workspace, offline, with dependencies already present, against dummy data, short and small. Do not install dependencies or let builds fetch them. Use only tools and dependencies already available locally. If a check cannot stay inside those boundaries, do not execute target code: report the missing capability as a `needs_validation` blocker and give a safe validation plan.

Use dummy principals, fixtures, and secrets. Do not probe deployed endpoints, external services, shared infrastructure, production identities, other users' data, or live control planes. Do not test availability against a live or shared process, publish artifacts, alter releases, spend paid API quota, or continue beyond the minimum local effect needed to establish a defect. If the decisive fact is outside source or the local fixture, report it as needing validation.

For a reproduced check, record the command and exact test input. Never capture or copy the ambient environment, inherited variables, credential values, authentication state, or unrelated host paths into notes or reports. If you find a hardcoded secret, cite its file and line; do not reproduce its value.

## Workflow

1. **Reconnaissance**: map the source, principals, trust boundaries, entry surfaces, sinks, and local build/test paths, then select companion files, with [RECONNAISSANCE.md](RECONNAISSANCE.md). For a narrow question, map only what the question touches.
2. **Hunting**: apply the selected classes from [ATTACK-CLASSES.md](ATTACK-CLASSES.md) and the domain companions below using the method and candidate gate in [HUNTING.md](HUNTING.md).
3. **Refutation**: try to refute every candidate and settle it as `confirmed`, `needs_validation`, or `rejected`, as described in [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md).
4. **Report**: write the report from the final records in the format in [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md). A clean review may have zero confirmed findings.

### Companion files

Read a companion only when reconnaissance found the boundary its `When to use this file` section describes:

| File | Use for |
|---|---|
| [ATTACK-CLASSES.md](ATTACK-CLASSES.md) | Ordinary classes: injection, access control, resource/file handling, crypto and secrets, business logic, feature abuse, chained issues, wildcard, obvious exposures |
| [DATA-ISOLATION-AND-LIFECYCLE.md](DATA-ISOLATION-AND-LIFECYCLE.md) | Multi-tenant stores, tenant/owner isolation, caches/search, object links, analytics, export/backup, migration, deletion, retention, restore |
| [WEB-PROTOCOL-AND-AUTH.md](WEB-PROTOCOL-AND-AUTH.md) | HTTP framing and caching, sessions, CSRF, JWT, OAuth/OIDC, SAML, MFA, passkeys, recovery, API keys, mTLS |
| [CLIENT-SIDE.md](CLIENT-SIDE.md) | SPAs, extensions, webviews, service workers, browser storage, postMessage, CORS, WebSockets, DOM rendering |
| [AI-AND-LLM.md](AI-AND-LLM.md) | Chatbots, RAG, agent memory, tool-calling agents, MCP, prompt assembly, model-controlled actions |
| [SUPPLY-CHAIN-AND-RELEASE.md](SUPPLY-CHAIN-AND-RELEASE.md) | Dependency resolution, generated inputs, CI, release/signing, updates, plugins |
| [CLOUD-AND-DEPLOYMENT.md](CLOUD-AND-DEPLOYMENT.md) | IAM, infrastructure as code, containers/Kubernetes, mesh, serverless/edge, ingress, runtime configuration |
| [PROTOCOLS-RPC-AND-MESSAGING.md](PROTOCOLS-RPC-AND-MESSAGING.md) | gRPC, GraphQL transports, custom protocols, queues, brokers, pub/sub, webhooks, streaming RPC |
| [RESOURCE-EXHAUSTION-AND-AVAILABILITY.md](RESOURCE-EXHAUSTION-AND-AVAILABILITY.md) | Untrusted work consuming shared CPU, memory, disk, connections, workers, queues, quotas, or spend |
| [MEMORY-SAFETY-AND-BINARY.md](MEMORY-SAFETY-AND-BINARY.md) | C/C++, Rust `unsafe`, FFI, kernels, parsers/decoders, loaders, JITs, firmware |
| [DESKTOP-MOBILE-AND-LOCAL-IPC.md](DESKTOP-MOBILE-AND-LOCAL-IPC.md) | Native apps, deep links, webview bridges, exported components, privileged helpers, local daemons and IPC |

## Core principles

### Require a boundary and result

For every candidate, name the lower-trust principal, accepted input or action, intended control, crossed boundary, affected principal or resource, and concrete observed or owner-observable result. Do not elevate a missing best practice, guessed deployment behavior, generic parser crash, or self-impact into a security finding.

### Use bounded local evidence

Static analysis establishes the source path. Bounded local tests resolve behavior when they fit the execution boundaries: a minimal function harness, existing unit test, small parser fixture, dummy-tenant integration test, or locally rendered configuration. Stop at a wrong return value, unauthorized dummy record, sanitizer finding, policy difference, or other minimum effect. Do not extend the local check beyond the minimum boundary result or produce persistence, post-fault, or concealment material.

### Respect source visibility

Deployment controls, proxy behavior, provider settings, browser headers, identity policy, broker ACLs, packaging, and topology are real controls. If they are required and absent from the repository, do not assume either presence or absence. Use `needs_validation` with the exact missing fact and a safe owner-observed or local plan.

### Separate priority from certainty

Only `confirmed` records receive severity. Likelihood and impact must reflect the demonstrated conditions and result; overall severity cannot exceed demonstrated impact. `needs_validation` means a specific source-grounded boundary hypothesis is blocked, not a low-confidence confirmed vulnerability, and it has no severity.

Calibrate overall severity with these anchors (upstream level → office severity):

- **critical → BLOCKER**: an unauthenticated actor gains code execution, full data-store access, or takeover of arbitrary accounts.
- **high → MAJOR**: an actor fully defeats an explicit security control with real consequences: authentication bypass, cross-tenant read or write, stored script execution affecting other users, authenticated code execution, or an unauthenticated remote stop of a shared service.
- **medium → MINOR**: a real boundary violation with limited blast radius, uncommon preconditions, or consequences confined to a narrow resource set.
- **low → NIT**: disclosure of non-secret internals, or an effect requiring sustained effort for minimal gain.
- **informational → NIT (note)**: a confirmed but minimal-impact observation, useful mainly as a prerequisite inside a larger finding. Label it as informational.

The MAJOR/MINOR discriminator: does the demonstrated result fully defeat an explicit control for an action with real consequences, or only weaken it? If you cannot state the concrete damage, the severity is lower than it feels.

### Recommend the smallest effective source fix

For each confirmed finding, identify the invariant the code must enforce and the narrowest source change that enforces it at the last trusted decision point. Prefer specific repository-relative changes and regression tests over generic hardening advice. The audit describes fixes; it does not modify target source.

## Anti-patterns

1. Checklist deviations presented as vulnerabilities.
2. Defense-in-depth advice with no reachable boundary violation.
3. Live or shared-environment testing where bounded local evidence is insufficient.
4. Guessing provider, proxy, browser, identity, or deployment behavior not present in source.
5. Treating intended same-principal authority or self-impact as a cross-boundary result.
6. Reporting a parser or runtime effect stronger than the observed effect.
7. Assigning severity to `needs_validation` records.
8. Writing the report before trying to refute each candidate, or letting the summary table and the finding details disagree.
9. Writing patches or editing target source instead of describing the fix.
