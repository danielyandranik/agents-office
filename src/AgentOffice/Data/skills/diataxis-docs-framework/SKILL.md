---
name: diataxis-docs-framework
description: "Technical documentation best practices for developer and partner adoption: Diataxis four-quadrant content architecture, 14 content types (tutorials, quickstarts, how-to guides, API and SDK reference, migration guides, changelogs, runbooks, integration guides, troubleshooting, architecture docs), 27 rules, templates, information architecture, docs audits, anti-patterns, and developer experience strategy, with pluggable style packs (default: Google). Use when asked to write docs, document something, plan a docs structure, audit documentation, write a migration guide, changelog, tutorial, how-to, reference, runbook, troubleshooting or integration guide, or when Diataxis, Good Docs Project, or Google OpenDocs is mentioned."
license: MIT
---

# Tech Docs

**IMPORTANT:** Your training data about documentation best practices may be outdated or conflate different frameworks. Diataxis, Google OpenDocs, and the Good Docs Project each have specific structural requirements that are frequently mixed up — especially the critical distinction between tutorials (learning-oriented) and how-to guides (task-oriented). Always rely on this skill's rule files and reference documents as the source of truth. Do not fall back on generic documentation advice when it conflicts with these frameworks. Project-specific style guides and behavior verified in the source still come first.

## When to Use This Skill

This skill is for **writing, planning, auditing, and improving technical documentation** for products that need developer and partner adoption. It synthesizes six proven frameworks into a unified system.

| Need | Recommended Approach |
|------|---------------------|
| Write a specific document | Use content type rules (`write-` prefix) + templates |
| Plan documentation strategy | Use architecture rules (`arch-` prefix) + adoption funnel |
| Audit existing documentation | Use audit rules (`audit-` prefix) + maturity model |
| Improve writing quality | Use style rules (`style-` prefix) |
| Set up docs-as-code | Use architecture rules (`arch-` prefix) |
| Build partner documentation | Use DX rules (`dx-` prefix) |
| Migrate/version documentation | Use governance rules (`gov-` prefix) |

## Foundational Frameworks

| Framework | Contribution | Source |
|-----------|-------------|--------|
| **Diataxis** | Content architecture — the four quadrants | diataxis.fr |
| **Google OpenDocs** | Project archetypes, maturity assessment, audit | github.com/google/opendocs |
| **Good Docs Project** | Content type templates with writing guides | thegooddocsproject.dev |
| **Google Style Guide** | Language, tone, and formatting standards | developers.google.com/style |
| **Stripe DX Patterns** | Outcome-oriented docs, developer journey design | docs.stripe.com |
| **Canonical Practice** | Documentation as engineering discipline | canonical.com/documentation |

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Content Architecture | CRITICAL | `write-` (6 rules) |
| 2 | Writing Style | CRITICAL | `style-` (6 rules) |
| 3 | Information Architecture | HIGH | `arch-` (4 rules) |
| 4 | Developer Experience | HIGH | `dx-` (3 rules) |
| 5 | Documentation Audit | MEDIUM | `audit-` (3 rules) |
| 6 | Governance & Lifecycle | MEDIUM | `gov-` (3 rules) |
| 7 | Partner & Ecosystem | MEDIUM | `partner-` (2 rules) |

## Quick Reference

### 1. Content Architecture (CRITICAL)

- `write-one-purpose-per-doc` — Never mix content types; tutorials teach, how-to guides solve, reference describes, explanation contextualizes
- `write-tutorial-not-howto` — Tutorials are learning-oriented (student); how-to guides are task-oriented (practitioner). Most common conflation in docs
- `write-reference-describe-only` — Reference docs describe machinery neutrally; never instruct, explain, or opine
- `write-explanation-no-steps` — Explanation provides "why" and context; never include step-by-step procedures
- `write-outcomes-not-features` — Document what users achieve ("move data to your warehouse"), not what exists ("the Pipeline object")
- `write-show-dont-tell` — Every concept needs a concrete example; abstract descriptions become concrete through code and diagrams

### 2. Writing Style (CRITICAL)

- `style-active-voice-second-person` — Use active voice and address the reader as "you"; present tense for descriptions
- `style-code-examples-must-work` — Every code example must be copy-pasteable and runnable; test examples in CI
- `style-consistent-terminology` — One term per concept everywhere; never alternate between synonyms for the same thing
- `style-global-readability` — No idioms, cultural references, or humor that doesn't translate; spell out acronyms on first use
- `style-minimize-admonitions` — Max 2-3 callouts per page; if everything is a warning, nothing is
- `style-tone-matches-type` — Tutorials are encouraging; how-to guides are direct; reference is neutral; explanation is conversational

### 3. Information Architecture (HIGH)

- `arch-organize-by-type-not-team` — Structure docs by content type (guides, reference, tutorials), not by internal team or component
- `arch-two-level-max` — Limit navigation hierarchy to two levels of nesting; deeper structures lose readers
- `arch-adoption-funnel` — Prioritize docs that unblock the current adoption bottleneck: Discover → Evaluate → Start → Build → Operate → Upgrade
- `arch-cross-link-strategy` — Every doc links to prerequisites, related content, and next steps; no dead ends

### 4. Developer Experience (HIGH)

- `dx-time-to-hello-world` — Optimize quickstart for speed; experienced devs should reach a working example in under 5 minutes
- `dx-audience-matrix` — Map audiences (new devs, building devs, evaluators, partners, operators, decision makers) to content types
- `dx-interactive-examples` — Provide runnable sandboxes, multi-language code tabs, and copy-pasteable examples wherever possible

### 5. Documentation Audit (MEDIUM)

- `audit-inventory-first` — Before improving docs, inventory every page: URL, title, content type, owner, last updated, accuracy
- `audit-classify-and-gap` — Classify each page into its Diataxis quadrant; identify gaps, overlaps, and misclassifications
- `audit-maturity-model` — Assess against four maturity levels: Seeds → Foundation → Integration → Excellence

### 6. Governance & Lifecycle (MEDIUM)

- `gov-docs-are-done` — A feature is not shipped until its documentation is written, reviewed, and published
- `gov-version-strategy` — Version API/SDK docs per major version; don't version conceptual docs unless concepts change
- `gov-freshness-cadence` — API reference: matches current release; how-to guides: quarterly review; runbooks: review after every incident

### 7. Partner & Ecosystem (MEDIUM)

- `partner-both-sides` — Integration guides document both sides of the interaction, not just your API
- `partner-production-readiness` — Every integration guide includes a production readiness checklist and support escalation paths

## The Documentation Compass

Every document serves one of four fundamental purposes (Diataxis quadrants):

```
                    PRACTICAL
                       |
         Tutorials     |     How-to Guides
        (learning)     |     (task-oriented)
                       |
   ACQUISITION --------+-------- APPLICATION
                       |
        Explanation    |     Reference
       (understanding) |     (information)
                       |
                   THEORETICAL
```

**Quick classification — ask two questions:**

1. **Studying or working?** Studying → left (tutorials, explanation). Working → right (how-to, reference).
2. **Practical steps or theoretical knowledge?** Practical → top (tutorials, how-to). Theoretical → bottom (explanation, reference).

## Enterprise Content Types

| Content Type | Quadrant | When to Use |
|-------------|----------|-------------|
| **Tutorial** | Learning | New users need guided first experience |
| **Quickstart** | Learning + Task | Experienced devs need fast path to "hello world" |
| **How-to Guide** | Task | Users need to accomplish specific goals |
| **Integration Guide** | Task | Partners need to connect their systems |
| **Migration Guide** | Task | Users need to upgrade between versions |
| **Troubleshooting** | Task | Users need to diagnose and fix problems |
| **API Reference** | Information | Developers need exact specifications |
| **SDK Reference** | Information | Developers need language-specific details |
| **Configuration Reference** | Information | Operators need parameter details |
| **Changelog** | Information | Users need to track what changed |
| **Explanation** | Understanding | Users need to understand "why" |
| **Architecture Guide** | Understanding | Engineers need system design context |
| **Glossary** | Information | Everyone needs consistent terminology |
| **Runbook** | Task | Operators need incident response procedures |

## Audience Matrix

| Audience | Primary Need | Key Content Types |
|----------|-------------|-------------------|
| **New developers** | Get started quickly | Quickstart, Tutorial |
| **Building developers** | Complete tasks efficiently | How-to guides, API reference |
| **Evaluating developers** | Decide whether to adopt | Explanation, Architecture |
| **Partner integrators** | Connect their systems | Integration guide, SDK reference |
| **Internal engineers** | Operate and maintain | Runbook, Architecture, Config reference |
| **Decision makers** | Understand capabilities | Explanation, Architecture overview |

## Adoption Funnel

Prioritize content types that unblock the current bottleneck:

```
Discover  → "What is this?"           → Explanation, README
Evaluate  → "Should I use this?"      → Architecture, Comparison
Start     → "How do I begin?"         → Quickstart, Tutorial
Build     → "How do I do X?"          → How-to guides, API reference
Operate   → "How do I keep it going?" → Runbook, Troubleshooting, Config ref
Upgrade   → "How do I move forward?"  → Migration guide, Changelog
```

## Documentation Project Archetypes

When planning documentation work (not single documents), use Google OpenDocs archetypes:

| Project Type | When to Use |
|-------------|-------------|
| **The Manual** | Writing new user/developer/admin guides from scratch |
| **The Edit** | Improving existing docs for accuracy, style, or goals |
| **The Audit** | Reviewing existing docs to assess condition and gaps |
| **The Migration** | Changing docs infrastructure (platform, format, hosting) |
| **The Factory** | Setting up automation, CI/CD, and tooling for docs |
| **The Translation** | Internationalizing and localizing documentation |
| **The Rules** | Creating contributor guidelines and style standards |
| **The Study** | Investigating user needs and documentation usage patterns |

## The Diataxis Map

| | Tutorials | How-to Guides | Reference | Explanation |
|-|-|-|-|-|
| **What they do** | Introduce, educate, lead | Guide | State, describe, inform | Explain, clarify, discuss |
| **Answers** | "Can you teach me to...?" | "How do I...?" | "What is...?" | "Why...?" |
| **Oriented to** | Learning | Goals | Information | Understanding |
| **Purpose** | Provide a learning experience | Help achieve a goal | Describe the machinery | Illuminate a topic |
| **Form** | A lesson | A series of steps | Austere description | Discursive explanation |
| **Analogy** | Teaching a child to cook | A recipe in a cookbook | Info on a food packet | Article on culinary history |

## Quality Standards

Diataxis distinguishes two categorically different types of quality:

**Functional quality** (objective, measurable, independent): Accurate, Complete, Consistent, Current, Precise

**Deep quality** (subjective, interdependent, conditional on functional quality): Feels good to use, Has flow, Fits human needs, Anticipates the user

Diataxis addresses deep quality — it cannot fix inaccurate content, but it *exposes* functional quality problems by making them visible when documentation is properly structured.

## How to Apply Diataxis

**Don't create empty structures.** Getting started does not mean dividing docs into four empty sections labeled tutorials/howto/reference/explanation. That's horrible. Diataxis changes structure from the inside.

**Work iteratively.** Pick any piece of documentation. Ask: what user need does this serve? How well? What one change would improve it? Do it. Repeat. Small, responsive iterations over top-down planning.

**Complete, not finished.** Like a living plant, your documentation is never finished (it can always grow) but always complete (nothing is missing at this stage of growth). Every stage from seed to mature tree is whole.

## How to Use

Read individual rule files for detailed explanations and examples with `read_skill_file("diataxis-docs-framework", "<path>")`, for example:

```
rules/write-one-purpose-per-doc.md
rules/style-active-voice-second-person.md
rules/arch-adoption-funnel.md
```

Load only the rule files and references the task needs. You have no shell in Agent Office, so rules that say to test examples in CI or run link checkers mean: verify the example against the source (see the `technical-documentation` skill), ask a colleague with a shell to run anything that must be run, and recommend the CI check to the Software Engineer instead of setting it up yourself.

Each rule file contains:

- Brief explanation of why it matters
- Incorrect example with explanation
- Correct example with explanation
- Additional context and decision tables

## Writing Style System

This skill supports **pluggable writing styles**. In Agent Office the default is **Google** style. Load exactly **one** style pack per task: `references/styles/google.md` unless the project already follows another style guide, or the owner or whoever asked names one. Never load several packs and blend them. If the project has its own style guide in the workspace, it wins over any pack.

The packs are written as overrides of the per-quadrant Diataxis style (`references/styles/diataxis.md`). Where the chosen pack diverges from that baseline or from the `style-tone-matches-type` rule (for example, Google's uniform "you" and conversational tone in tutorials and reference), the pack wins.

| Style | Best For | Key Difference from Diataxis baseline |
|-------|----------|----------------------------|
| **Google** (Agent Office default) | Open source, Google ecosystem, general developer docs | Always "you", uniform conversational tone, strict word list, accessibility-first |
| **Diataxis** | Projects that want per-quadrant voice | Per-quadrant tone: "we" in tutorials, impersonal in reference, opinionated in explanation |
| **Microsoft** | Enterprise B2B, internal platforms | Warm brand voice everywhere, bias-free communication, UI text conventions |
| **Stripe** | API-first products, DX-focused | Outcome-first framing, three-column layout, interactive code, docs as product |
| **Canonical** | Infrastructure, open source platforms | Pure Diataxis + engineering discipline, four pillars framework, starter packs |
| **Minimal** | Startups, MVPs, internal tools | README-first, auto-generate what you can, ship without perfection |

To apply the style, read `references/styles/[style].md` (default `google`) and follow its divergences from the Diataxis baseline. Say which pack you used when you hand the document over.

## References

| Priority | Reference | When to read |
|----------|-----------|-------------|
| 1 | `references/content-types.md` | Writing any specific content type — purpose, structure, principles, anti-patterns for all 14 types |
| 2 | `references/templates.md` | Starting a new document — ready-to-use skeletons for tutorials, how-to, API ref, migration, runbook, etc. |
| 3 | `references/style-guide.md` | Making writing decisions — formatting, code examples, accessibility, multi-audience patterns |
| 4 | `references/anti-patterns.md` | Reviewing documentation — consolidated checklist of documentation smells and common mistakes |
| 5 | `references/enterprise-patterns.md` | Planning docs strategy — IA, docs-as-code, versioning, governance, maturity model, metrics, partner docs |
| 6 | `references/styles/google.md` | Default style pack in Agent Office — uniform "you", sentence case, word list, accessibility priority |
| 7 | `references/styles/diataxis.md` | Diataxis baseline style — per-quadrant voice, person, tone, phrasing patterns for all four Diataxis types |
| 8 | `references/styles/microsoft.md` | Microsoft style override — warm brand voice, bias-free communication, UI conventions |
| 9 | `references/styles/stripe.md` | Stripe style override — outcome-first, interactive code, docs-as-product culture |
| 10 | `references/styles/canonical.md` | Canonical style override — pure Diataxis + engineering discipline, four pillars |
| 11 | `references/styles/minimal.md` | Minimal style override — README-first, MVP docs, ship fast |

## Related bundled skills

| Skill | When It Helps |
|-------|---------------|
| `technical-documentation` | Verifying every command, flag, default, and behavior against the source before publishing |
| `documentation-writer` | Clarify, outline, then write a single document |
| `release-notes-from-board` | Changelogs and release notes when there is no git history to read |
| `humanizer` | A final pass to remove AI-sounding prose |
| `documentation-and-adrs` | Architecture decision records |

When an audit produces findings, tag each with the office severity scale: **BLOCKER** (wrong or unsafe content, or a missing doc that stops adoption at its funnel stage), **MAJOR** (mixed content types, missing prerequisites or verification, broken examples), **MINOR** (style, terminology, navigation depth), **NIT** (polish).
