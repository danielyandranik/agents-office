---
name: sprint-planning
description: "Plan a sprint — scope work, estimate capacity, set goals, and draft a sprint plan, then (if you can plan) put it on the office board. Use when kicking off a new sprint or work cycle, sizing a backlog against colleagues' availability, deciding what's P0 vs. stretch, or handling carryover from the last sprint."
license: Apache-2.0
---

# Sprint Planning

Plan a sprint by scoping work, estimating capacity, and setting clear goals.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPRINT PLANNING                              │
├─────────────────────────────────────────────────────────────────┤
│  ALWAYS                                                         │
│  ✓ Define sprint goals and success criteria                     │
│  ✓ Estimate team capacity (accounting for other commitments)    │
│  ✓ Scope and prioritize backlog items                           │
│  ✓ Identify dependencies and risks                              │
│  ✓ Generate sprint plan document                                │
├─────────────────────────────────────────────────────────────────┤
│  WHEN YOU HAVE THE OFFICE BOARD TOOLS (planners)                │
│  + Read the backlog from the office board (office_board_list)   │
│  + Move committed items backlog → todo, set owner and points    │
│  + Add missing cards for agreed work (office_board_add)         │
└─────────────────────────────────────────────────────────────────┘
```

## What I Need From You

- **Team**: Which colleagues are on the sprint, and how much of their time is free for it?
- **Sprint length**: How many days/weeks?
- **Backlog**: What's prioritized? (Read it from the office board, or have it pasted or described)
- **Carryover**: Anything unfinished from last sprint? (Cards still in todo/doing/review on the office board, or `blocked` on a mission board)
- **Dependencies**: Anything waiting on another colleague, the owner, or an outside party?

If you have `office_board_list`, start there instead of asking for the backlog. Ask whoever asked only for what the board and files cannot tell you.

## Output

```markdown
## Sprint Plan: [Sprint Name]
**Dates:** [Start] — [End] | **Team:** [names / roles]
**Sprint Goal:** [One clear sentence about what success looks like]

### Capacity
| Person | Available Days | Allocation | Notes |
|--------|---------------|------------|-------|
| [Name] | [X] of [Y] | [X] points | [Other commitments, reviews owed, etc.] |
| **Total** | **[X]** | **[X] points** | |

### Sprint Backlog
| Priority | Item | Estimate | Owner | Dependencies |
|----------|------|----------|-------|--------------|
| P0 | [Must ship] | [X] pts | [Person] | [None / Blocked by X] |
| P1 | [Should ship] | [X] pts | [Person] | [None] |
| P2 | [Stretch] | [X] pts | [Person] | [None] |

### Planned Capacity: [X] points | Sprint Load: [X] points ([X]% of capacity)

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [What happens] | [What to do] |

### Definition of Done
- [ ] The deliverable exists where it was promised (file in the workspace, document, decision written down) and is linked from its card
- [ ] It meets the card's acceptance criteria, checked one by one
- [ ] It has been reviewed by someone other than its author (card went through review)
- [ ] Anything it changes for others is written up (notes, docs or a short summary on the card)
- [ ] The owner — or whoever requested it — has accepted it; only the card's owner moves it to done

### Key Dates
| Date | Event |
|------|-------|
| [Date] | Sprint start |
| [Date] | Mid-sprint check-in |
| [Date] | Sprint end / Demo |
| [Date] | Retro |
```

Adjust the Definition of Done to the work: for code, add "tests pass and the change is reviewed"; for a document, "facts checked against the source"; for a decision, "recorded with its rationale and who made it".

## Putting the Plan on the Office Board

Do this only if you have the office board tools (planners). Otherwise, hand the plan to whoever asked and stop.

1. **Read the board** with `office_board_list` and match each plan item to an existing card. Do not create duplicates.
2. **Add missing cards** for agreed items with `office_board_add`, in **backlog**, with a title a colleague can act on without reading this plan.
3. **Commit the sprint**: for each P0 and P1 item, use `office_board_update` to move it **backlog → todo**, set the owner and the story points from your estimate (see the `estimate-with-uncertainty` skill). Leave P2 stretch items in backlog, marked as stretch in the plan.
4. **Carryover**: leave cards already in doing or review where they are; re-estimate them if their scope changed.
5. **Never move a card to done** — only its owner does that.
6. **Report back** with the sprint goal, the cards you moved (ID/title, owner, points) and anything you could not place.

To hand a committed item to a colleague with full context, use the `work-handoff-brief` skill.

## Tips

1. **Leave buffer** — Plan to 70-80% capacity. You will get interrupts.
2. **One clear sprint goal** — If you can't state it in one sentence, the sprint is unfocused.
3. **Identify stretch items** — Know what to cut if things take longer than expected.
4. **Carry over honestly** — If something didn't ship, understand why before re-committing.
