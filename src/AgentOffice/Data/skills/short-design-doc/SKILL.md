---
name: short-design-doc
description: "One-to-two-page design doc template for the Software Architect: approach, components touched, data/API changes, at least one rejected alternative with why, risks with mitigations, and a task breakdown sized for one sitting each. Use when a feature, change or fix needs a design before implementation, when the owner or a colleague asks how something should be built, or before handing work to the Software Engineer."
---

# Short Design Doc

## Overview

A short design doc is the Architect's main deliverable: enough design that an engineer can start building without guessing, and short enough that the owner reads it in five minutes. It answers six questions: what is the approach, what does it touch, what data or API changes, what did we reject and why, what could go wrong, and what are the tasks.

**Core rule:** one to two pages. If it is longer, either the scope is too big (split it) or you are writing the code in prose (cut it).

## When to Use

- A feature or change touches more than one component, or changes data or an API
- The owner or a colleague asks "how should we build this?"
- Before the Software Engineer starts work that has more than one reasonable approach
- A bug fix turned out to need a structural change

**When NOT to use:**
- One-file, one-obvious-way changes: put a line on the board instead.
- No requirements exist yet: write the spec first (`spec-driven-development` or `write-spec`), then the design.
- A single lasting decision with no implementation work: write an ADR (`documentation-and-adrs`).

## Process

1. **Gather inputs.** Read the spec, acceptance criteria, the board task and any notes the owner gave. Use `list_files` and `read_file` to look at the code the change will touch: entry points, the modules involved, existing patterns, existing ADRs (`docs/decisions/`, `docs/adr/`).
2. **List what you don't know.** Ask the owner or the right colleague (`ask_colleague`) only the questions that change the design. For everything else, state your assumption in the doc.
3. **Pick an approach and one real alternative.** The alternative must be something a reasonable engineer would actually propose, not a straw man. Compare them on the constraints that matter here (effort, risk, reversibility, fit with existing code).
4. **Walk the change through the system.** Name every component, file area, data structure and interface it touches. For interfaces, apply the `api-and-interface-design` skill: contract first, additive changes, consistent errors.
5. **Find the risks.** Ask: what breaks existing users, what loses or corrupts data, what is slow at scale, what is a security or privacy exposure, what depends on someone else, what are we least sure of? Give each a mitigation.
6. **Break it into tasks.** Each task fits one sitting (one focused session), ends in something testable, and is ordered by dependency. Put the riskiest or most uncertain task first where you can.
7. **Write the doc** with the template below, save it with `write_file`, and self-review against the checklist.
8. **Hand it off** (see Handoff).

## Template

Save to `docs/design/YYYY-MM-DD-<short-name>.md` in the mission workspace, unless the project already keeps designs elsewhere (match the existing convention).

```markdown
# Design: [Short Name]

**Status:** Draft | Approved | Superseded
**Author:** [role] · **Date:** YYYY-MM-DD
**Spec / task:** [path to spec or board task this implements]

## Problem
[2-4 sentences: what we need and why now. Link the spec instead of repeating it.]

## Approach
[One paragraph: the chosen design and why it fits. Mention the existing pattern it follows.]

## Components Touched
| Component / area | Change | Notes |
|------------------|--------|-------|
| `src/...` | New / Modified / Removed | [what changes, one line] |

## Data and API Changes
- **Data:** [new or changed fields, tables, files, formats; migration and backfill; rollback]
- **API / interfaces:** [new or changed endpoints, function signatures, events, config; backward compatibility]
- None: [say "None" explicitly if there are none]

## Alternatives Considered
### [Alternative name]
- What: [one or two sentences]
- Why rejected: [the concrete reason it loses here]

## Risks
| Risk | Likelihood (H/M/L) | Impact (H/M/L) | Mitigation |
|------|--------------------|----------------|------------|
| [What could go wrong] | M | H | [Task, test, flag or check that prevents or limits it, or "Accepted: reason"] |

## Tasks
| # | Task | Done when | Depends on |
|---|------|-----------|------------|
| 1 | [Verb + object, one sitting] | [observable, testable result] | — |
| 2 | ... | ... | 1 |

## Open Questions
- [Question] (owner: [who decides])
```

## Section Guidance

- **Approach:** decisions, not narration. "Add a `status` column and filter in the existing query" beats "We will carefully consider how to store status."
- **Components Touched:** if you cannot name the files or modules, you have not read enough code yet.
- **Data and API Changes:** this is where designs usually go wrong. Always state backward compatibility and how to roll back.
- **Alternatives Considered:** at least one, each with a reason tied to this problem. "Rejected because it's worse" is not a reason.
- **Risks:** at least the top three, or all of them if fewer. Every risk has a mitigation or an explicit, reasoned acceptance. Mitigations that need work must appear as tasks or as "done when" checks.
- **Tasks:** one sitting each, typically touching no more than about five files. If a task needs "and" twice, split it. Include tests in the task that owns the code, not as a separate "write tests" task at the end.
- **Open Questions:** only questions that block or change the design, each with who decides.

## Handoff

1. Tell whoever asked where the doc is (the workspace path) and summarize the approach, the top risk and the number of tasks in three or four lines.
2. If the owner asked to approve the design, wait for approval before tasks start.
3. Put the tasks on the mission board with `board_add`: one card per task, titled with its number and verb phrase, referencing the design doc path, status `todo`.
4. If the implementer needs step-level detail (exact files, signatures, test names), expand the tasks with the `writing-plans` skill. Hand the work to the Software Engineer with `ask_colleague` (the `work-handoff-brief` skill helps for larger handoffs).
5. If the design contains a lasting decision (a library, data model, protocol, or anything expensive to reverse), record it as an ADR with the `documentation-and-adrs` skill and link the ADR from the doc.
6. If a risk is a security exposure, ask the Security Reviewer colleague to look before implementation starts.

## Self-Review Checklist

- [ ] Fits in one to two pages
- [ ] Approach names the existing pattern it follows (or says why it departs from it)
- [ ] Every component touched is named; data and API changes are stated, or "None" is stated
- [ ] Backward compatibility and rollback are addressed for every data or API change
- [ ] At least one realistic alternative, with a concrete reason for rejecting it
- [ ] Risks have likelihood, impact and a mitigation (or a reasoned acceptance); mitigations needing work appear in Tasks
- [ ] Every task fits one sitting, has a testable "done when", and lists its dependencies
- [ ] Assumptions and open questions are written down, each open question with who decides
- [ ] The doc matches the spec: every requirement maps to at least one task

## What NOT to Do

- Don't write code bodies in the doc. Signatures and shapes, yes; implementations, no.
- Don't invent a straw-man alternative just to fill the section.
- Don't list risks without mitigations, or write "no risks".
- Don't create one giant "implement the feature" task, or a final "add tests" task.
- Don't start implementing yourself if your role is the Architect; hand off.
- Don't silently change the spec. If the design shows the spec is wrong, raise it as an open question with the owner.
- Don't mark a design "Approved" yourself; only the owner approves.
