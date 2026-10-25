---
name: work-handoff-brief
description: "Turn a task into a self-contained brief for a named colleague and send it with ask_colleague: goal, why it matters, context (files, links, decisions so far), inputs, acceptance criteria, constraints and non-goals, dependencies, the deadline or state you need, and exactly how to report back. Use whenever you delegate or hand off work to another colleague, route a board task to someone, or ask a colleague for anything that takes more than a one-line answer."
---

# Work Handoff Brief

A colleague who receives your brief **cannot see your conversation, your reasoning, or what the owner told you**. They see the brief, and whatever files and boards they can open themselves. A good brief lets them start immediately, finish without coming back to ask, and report in a form you can use without rework.

The test for every brief: *could a capable colleague who joined the office today do this from the brief alone?*

## When to Use

- Handing a board task (mission or office board) to a colleague
- Splitting your own work and delegating a piece of it
- Asking a colleague for a review, an estimate, a draft, a decision input — anything bigger than a one-line question
- Re-routing work that came to you but belongs to another role

For a quick factual question ("which file holds the pricing table?"), just ask. Use this skill when the answer is *work*.

## Steps

1. **Pick one ask and one colleague.** One brief = one deliverable for one named colleague. If you have three asks, write three briefs (or three cards). Choose the colleague by role: who is equipped (tools, skills) to do this?
2. **Gather the context before writing.** Collect file paths, board task/card IDs, URLs, the decisions already made and by whom, and what has been tried. Read the files you will cite so you describe them accurately.
3. **Fill the template below.** Every section. Write "None" rather than deleting a section, so the colleague knows you thought about it.
4. **Make acceptance criteria checkable.** Each criterion is something the colleague can verify themselves before reporting done. For feature work, reuse or derive them with the `deliver-acceptance-criteria` skill; for sizing, ask for an estimate in the form `estimate-with-uncertainty` describes.
5. **Run the pre-send checklist.** Fix anything that fails.
6. **Send with `ask_colleague`**, the brief as the message. If the work is tracked on a board, put the card/task ID in the brief and, if you have board tools, record the handoff: on the mission board, `board_update` with a short `note` (who has it, one-line summary); on the office board, set the card's `assignee` with `office_board_update`. Don't move the card to done; only its owner does that.
7. **When the reply comes, check it against your acceptance criteria** before passing it on. If it falls short, reply with the specific criterion that is not met, not "please redo".

## Template

```markdown
# Brief: [verb-first title, e.g. "Draft the empty-state copy for the upload screen"]
**To:** [colleague name / role]   **From:** [you]   **Card/task:** [ID or "none"]
**Need by:** [date/time, or the state you need it in by when, e.g. "a draft before the 3pm review"]

## Goal
[One or two sentences: the outcome you need, not the activity.]

## Why it matters
[What this unblocks or who is waiting on it, and what happens if it's late or wrong. Helps them make judgment calls you didn't anticipate.]

## Context
[Everything they need and cannot see. Say what each item is and why it matters.]
- Files: `path/to/spec.md` (the approved spec; section 3 covers this screen)
- Links: [URL] (what it is)
- Decisions so far: [decision] — made by [who], [when]. Do not revisit.
- Already tried / ruled out: [what, and why it didn't work]

## Inputs
[Exactly what they start from: files, data, drafts, access. Where each one is.]

## Acceptance criteria
- [ ] [Checkable criterion 1]
- [ ] [Checkable criterion 2]
- [ ] [Checkable criterion 3]

## Constraints and non-goals
- Constraints: [must use / must not change / budget / tone / format / tools]
- Non-goals: [what NOT to do, even if tempting — and why]

## Dependencies
[What this waits on, and what waits on this. "None" if none.]

## How to report back
- **Done looks like:** [the deliverable and where it goes, e.g. "file at `drafts/upload-copy.md`, plus a 3-line summary in your reply"]
- **Reply with:** [what to include: what you did, how each acceptance criterion was checked, open questions, anything you changed outside scope]
- **If blocked:** [what counts as blocked, how long to try before raising it, who to ask (me / the owner / another colleague), and what to do meanwhile — e.g. "mark the task `blocked` with the reason and tell me; don't guess at the pricing numbers"]
- **If the ask looks wrong:** [say so before doing the work — e.g. "if the spec contradicts the mockup, stop and tell me which you'd follow"]
```

Keep the brief as short as completeness allows. Most briefs fit in 20–40 lines. Link long material instead of pasting it, but quote the specific lines that matter.

## Pre-send checklist

- [ ] One deliverable, one named colleague
- [ ] The goal is an outcome, not an activity ("a ranked list of 5 vendors", not "look into vendors")
- [ ] Every file, card and decision mentioned is named explicitly (path, ID, who decided) — nothing refers to "above", "earlier" or "what we discussed"
- [ ] Every assumption you are making is written down (audience, format, scope, data source)
- [ ] Each acceptance criterion can be checked by the colleague without asking you
- [ ] At least one non-goal is stated when the task has an obvious tempting extension
- [ ] The deadline is a specific time or state, not "ASAP"
- [ ] "How to report back" says what done looks like and what to do if blocked
- [ ] The colleague has the tools to do it (e.g. don't ask a role without a shell to run tests)
- [ ] No secrets or credentials pasted into the brief; point to where access is granted instead

## Anti-patterns

| Anti-pattern | Why it fails | Instead |
|---|---|---|
| "See above" / "as discussed" / "the file we looked at" | The colleague has no "above" | Name the file, quote the line, state the decision |
| Unstated assumptions ("for the launch", "the usual format") | They will guess differently | Say which launch, which format, with an example or path |
| Multiple asks in one brief | Partial completion, unclear done, one ask gets lost | One brief per deliverable; list the others as separate briefs or cards |
| Activity instead of outcome ("research competitors") | No way to know when to stop | Name the artifact and its shape ("table of 5 competitors × price, seats, SSO") |
| Missing why | They can't make trade-offs, so they ask or guess | One line on what it unblocks and what matters most |
| Acceptance criteria that need you to judge ("looks good", "clean") | They can't self-check; you get a round trip | Measurable criteria ("under 120 words", "every number cites its source file") |
| No blocked path | They stall silently or improvise | Say how long to try, who to ask, and what to do meanwhile |
| Pasting a whole transcript as context | The key decision is buried | Summarize; quote only the decisive lines; link the rest |
| Re-deciding settled questions by omission | They reopen a decision the owner made | List decisions as "made, do not revisit" |

## Example (short)

```markdown
# Brief: Size the CSV export feature for sprint 14
**To:** Software Engineer   **From:** Project Manager   **Card/task:** OB-42
**Need by:** today 16:00, so it can go into sprint planning tomorrow

## Goal
A three-point estimate for the P0 scope of CSV export, with the assumptions behind it.

## Why it matters
Sprint 14 planning is tomorrow at 10:00; without an estimate the owner can't decide whether export fits alongside billing fixes.

## Context
- Files: `specs/csv-export.md` (approved spec; P0 = sections 4.1–4.3 only)
- Decisions so far: export is synchronous up to 10k rows — decided by the owner on Oct 22. Do not revisit.
- Already tried: none.

## Inputs
The spec above and the current codebase in the mission workspace.

## Acceptance criteria
- [ ] Optimistic / likely / pessimistic in days for P0 only, with the PERT mean
- [ ] Each assumption listed (e.g. "reuses the existing table serializer")
- [ ] Anything that could push it past the pessimistic number named as a risk

## Constraints and non-goals
- Constraints: estimate only; no code changes
- Non-goals: P1 (scheduled exports) — don't size it

## Dependencies
None upstream. Sprint planning (tomorrow 10:00) waits on this.

## How to report back
- **Done looks like:** reply with the estimate block and assumptions; I'll record points on OB-42
- **If blocked:** if the spec is ambiguous on row limits, give two estimates (one per reading) rather than waiting
- **If the ask looks wrong:** if P0 can't be sized without a design decision, tell me which decision by 14:00
```
