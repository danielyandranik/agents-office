# Reconnaissance

### Step 1: Map the source before hunting

Reconnaissance reads the target and locally available build/configuration state only. It does not contact deployed endpoints, external identity providers, registries, brokers, cloud APIs, or other shared services. Use `list_files`, `read_file` and, where your role has a shell, read-only `run_command` searches (for example `grep`, `find`, `ls`) inside the mission workspace. Do not run builds or tests during reconnaissance.

Work through these four maps in order. Record repository-relative `file:line` references for every fact; they are the evidence the later steps rely on.

**Map A: Product, stack, and local operation**

1. Product type, users, operators, and ordinary trust-sensitive actions.
2. Languages, frameworks, build system, runtimes, and locally visible deployment models.
3. Repository-relative entry points and subsystem boundaries.
4. Exact build and test commands that could run offline with local dependencies, their expected write locations, and the target-controlled inputs they process.
5. Comparable software or protocol visible from local documentation and dependencies. If no useful comparison is source-grounded, say so.
6. Missing local toolchains or runtime facts that limit bounded execution.

**Map B: Principals, authority, and controls**

Read all source that establishes identity, authorization, isolation, and privilege. Map:

1. Each lower-trust principal and the actions it has by design.
2. Authentication or peer identity at each entry surface.
3. Per-resource authorization and tenant/owner scope.
4. Process, browser, workload, CI, plugin, model/tool, device, or local-IPC authority.
5. Privilege changes, confirmation, revocation, recovery, and fallback paths.
6. Which controls are source-visible and which depend on an unobserved deployment fact.

Do not infer live reachability.

**Map C: Entry surfaces, copies, and sinks**

Inventory every source-visible place external or lower-trust input enters:

- HTTP/browser, RPC/message/protocol, files/archive/document, CLI/env/config, plugins/dependencies/CI, cloud events/IAM selectors, model context/tool arguments, mobile/deep-link/webview, and local IPC.

For each surface, follow major transformations, stored or derived copies, and security-relevant sinks. Record source-visible limits and parallel paths to the same effect. Be complete, but do not execute or send inputs.

**Map D: Local execution and deployment visibility**

Read tests, build definitions, manifests, packaging, and maintained environment overlays. Note:

1. Small offline tests or existing fixtures that could validate trust boundaries with dummy data.
2. Commands that would fetch dependencies, publish artifacts, contact paid/provider APIs, or affect shared state; these are prohibited.
3. Deployed controls and attachments that source cannot establish and therefore require `needs_validation` if decisive.
4. The final active source path for each deployment mode only where the repository selects it deterministically.

## Architecture summary and companion selection

Write a short architecture summary (roughly 1,000 words at most) in your working notes or report:

1. Product, principals, normal authority, and protected resources.
2. The comparable-software baseline from Map A, when one is source-grounded: what security trade-offs the comparable accepts. Use it to calibrate effort and severity, never to dismiss a demonstrated finding; if the comparable shares a defect pattern that has mattered in practice, that strengthens the finding. Omit this line when no meaningful comparable exists.
3. Tech stack, source-visible deployment paths, and offline build/test limits.
4. Entry surfaces and the important source-to-sink or lifecycle paths.
5. Trust boundaries and the strongest source-visible control on each.
6. Repository-relative starting paths.
7. A short companion-selection summary derived from [ATTACK-CLASSES.md](ATTACK-CLASSES.md): selected files and the source-visible boundaries that require them.

Do not select a companion file merely because the language or dependency name appears. Select it because reconnaissance found the trust-sensitive boundary described by its `When to use this file` section. Do not exclude a visible boundary just because a related class will be reviewed elsewhere.

## Coverage notes

Keep a simple list of what you reviewed: for each entry surface × trust boundary × attack class you looked at, the paths you read and the result (covered, candidate, blocked, or not reviewed and why). This list is your coverage claim. An architecture summary or a generic "auth reviewed" sentence is not coverage evidence. A scoped or partial review must present itself as partial coverage; never imply that one pass exhausts the target.
