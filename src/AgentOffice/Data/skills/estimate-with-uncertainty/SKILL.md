---
name: estimate-with-uncertainty
description: "Size tasks with t-shirt sizes or three-point estimates (optimistic / likely / pessimistic, with PERT mean and spread), state assumptions and confidence, split anything whose range is too wide to commit to, and map sizes to story points 1/2/3/5/8/13 — recording them on office board cards when you can plan. Use when asked how long something will take, when sizing a backlog for sprint planning, or before committing to a date."
---

# Estimate With Uncertainty

An estimate is a range plus the assumptions that make it true. A single number without a range or assumptions is a guess that will be remembered as a promise. This skill gives every estimate three parts: **a size or range, the assumptions behind it, and a confidence level** — and refuses to commit to ranges that are too wide.

## Choose the Method

| Situation | Method |
|---|---|
| Triage a long backlog quickly; relative size is enough | **T-shirt sizes** |
| Commit to a date or sprint; work has real unknowns | **Three-point (PERT)** |
| Can't describe the steps at all | Neither yet — **time-box a spike** (see Splitting) |

Estimate in the unit the work is done in: ideal working days for a colleague (an agent's day of focused work), or hours for small tasks. Say which unit you used.

## Steps

1. **Pin down what is being estimated.** Restate the task and its definition of done in one line. Read the card, spec or files first (`office_board_list`, `board_list`, `read_file`). If the scope is unclear, estimate the reading you think is intended and say so — or give one estimate per reading.
2. **Break it into 3–7 steps.** You can't estimate what you can't list. Steps you can't describe are unknowns; note them.
3. **Estimate each step** (or the whole, if it's small) with the method you chose.
4. **Write the assumptions.** Everything that, if false, would change the number: scope boundaries, inputs available, who does it, reuse of existing work, review turnaround, no waiting on others.
5. **Rate confidence** (table below).
6. **Check the range.** If it is too wide to commit to (see Splitting), split or spike instead of committing.
7. **Map to story points** and, if you can plan, record them on the card.
8. **Report** in the output format below.

If you are estimating work another colleague will do, ask them (the `work-handoff-brief` skill) and combine: their likely value is usually better than yours; your job is to challenge the assumptions and the pessimistic case.

## T-Shirt Sizes

| Size | Rough effort | Points |
|---|---|---|
| XS | under half a day; obvious how | 1 |
| S | about a day | 2 |
| M | 2 days | 3 |
| L | 3–4 days | 5 |
| XL | about a week | 8 |
| XXL | more than a week | 13 — split before committing |

Size relative to a reference task the team already knows ("same as the onboarding email copy, which was an S").

## Three-Point (PERT) Estimates

For each task, give:

- **O — optimistic:** everything goes right; you have done this before. Not the fantasy case.
- **M — most likely:** what usually happens.
- **P — pessimistic:** the realistic bad case (rework, unclear inputs, a slow review). Not a catastrophe.

Then:

- **PERT mean** = (O + 4M + P) / 6
- **Spread (standard deviation)** ≈ (P − O) / 6
- Roughly 68% of outcomes land within mean ± 1 SD, and about 95% within mean ± 2 SD (an approximation; real work skews late).
- **Commit number:** mean + 1 SD (about 84% likely to be met). Quote this when someone needs a date; quote the mean for planning capacity.

Example: O = 2, M = 3, P = 7 days → mean = (2 + 12 + 7) / 6 = 3.5 days; SD = 5 / 6 ≈ 0.8 → commit to about 4.3 days.

**Adding tasks:** means add. For independent tasks, spreads add in quadrature: total SD = √(SD₁² + SD₂² + …). If tasks share a risk (same unclear input, same reviewer), they are not independent — add their SDs directly instead, which is wider and more honest.

## Confidence

| Level | Meaning | Typical sign |
|---|---|---|
| **High** | Done similar work before; inputs in hand; few unknowns | P is under 2× O |
| **Medium** | Most steps known; one or two unknowns with a plan | P is 2–3× O |
| **Low** | Key unknowns; depends on others or unclear scope | P is more than 3× O, or you couldn't list the steps |

State why, in one line ("Medium: the export library is new to us").

## Splitting: When the Range Is Too Wide to Commit

Do **not** commit to (or put points on) a task when any of these is true:

- P is more than **3× O**, or SD is more than **half the mean**
- The size is **13 points / XXL** or bigger
- Confidence is **Low**
- The pessimistic case doesn't fit in the sprint

Instead, split it:

- **By deliverable:** separate pieces that are each useful on their own (draft → review → final; read path → write path).
- **By unknown:** pull the unknown out as a **time-boxed spike** ("1 day to find out whether the vendor API supports bulk export"), estimate the spike, and re-estimate the rest after it. A spike's output is an answer and a new estimate, not the feature.
- **By risk:** do the risky part first so the rest can be estimated with confidence.

Re-estimate each piece. If a piece is still too wide, split again or say plainly that it can't be estimated yet and what would make it estimable.

## Story Points

Map the PERT mean (or the t-shirt size) to the nearest scale value at or above it:

| PERT mean (ideal days) | ≤ 0.5 | ≤ 1 | ≤ 2 | ≤ 4 | ≤ 7 | ≤ 12 | > 12 |
|---|---|---|---|---|---|---|---|
| **Points** | 1 | 2 | 3 | 5 | 8 | 13 | split |

If the team has its own calibration (e.g. past cards with known points), use that instead and say so. When confidence is Low and you still must give a number, round **up** one step and flag it.

**Recording on the office board** (planners only — skip if you don't have `office_board_update`):

1. Find the card with `office_board_list`. Don't create a duplicate.
2. Set its points with `office_board_update` (`points`). The tool can't edit the card's description, so give the range, confidence and key assumptions in your reply alongside the number, so it isn't read as a promise.
3. Don't put points on a card you decided to split; split it into new cards (`office_board_add`) and point those.
4. Don't move cards between columns as part of estimating; that is planning (see `sprint-planning`).

## Output Format

```markdown
## Estimate: [task] (card [ID])
**Method:** three-point | t-shirt   **Unit:** ideal days
| Step | O | M | P | Mean | SD |
|---|---|---|---|---|---|
| [step] | 1 | 1.5 | 3 | 1.7 | 0.3 |
| **Total** | | | | **[x]** | **[x]** |

**Commit:** [mean + 1 SD] days   **Points:** [n]   **Confidence:** [High/Medium/Low] — [why]
**Assumptions:** [list]
**Biggest risk to the estimate:** [what would push it past P]
**Split / spike recommended:** [none | what and why]
```

## Anti-Patterns

- **A single number with no range.** It will be heard as a promise. Always give the range or the commit number with its likelihood.
- **Optimistic as "likely".** If M equals O, you have described the best case twice.
- **Padding silently.** Make the pessimistic case explicit instead of inflating M; hidden padding can't be reasoned about.
- **Estimating someone else's work without asking them.** Get their likely number, then challenge it.
- **Estimating the unknowable.** Wide range → split or spike; don't average your way to false precision.
- **Points as hours.** Points are relative size; don't convert a team's points back into a deadline without its observed pace.
- **Re-using a stale estimate.** If the scope or assumptions changed, re-estimate and update the card.
