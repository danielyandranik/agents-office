---
name: status-report
description: "Generate a status report with KPIs, risks, and action items that says what is done, in progress, blocked and needing a decision. Use when writing a weekly or monthly update for the owner or stakeholders, summarizing project health with green/yellow/red status, surfacing blockers, risks and decisions that need attention, or turning board activity into a readable narrative."
license: Apache-2.0
---

# Status Report

Generate a polished status report for the owner or stakeholders. See the `risk-assessment` skill for risk matrix frameworks and severity definitions.

Every report answers four questions, in this order of urgency: **what needs a decision**, **what is blocked**, **what is in progress**, **what is done**.

## Gather the Facts First

Use whichever of these you have, and report from them rather than from memory:
- **Mission board** (`board_list`): tasks in todo / doing / blocked / done for the current mission.
- **Office board** (`office_board_list`): cards in backlog / todo / doing / review / done across the office.
- **Workspace files** (`list_files`, `read_file`): plans, specs, meeting recaps and earlier status reports, to compare against last period.

If you have none of these, work from what whoever asked provides. Map board states onto the report like this:

| Report section | Mission board | Office board |
|---|---|---|
| Accomplishments | done (this period) | done (this period) |
| In Progress | doing, todo started this period | doing, review |
| Blocked | blocked | any card whose notes say it is waiting on someone or something |
| Next Period | todo | todo, then top of backlog |

## Output

```markdown
## Status Report: [Project/Team] — [Period]
**Author:** [Name] | **Date:** [Date]

### Executive Summary
[3-4 sentence overview — what's on track, what needs attention, key wins]

### Overall Status: 🟢 On Track / 🟡 At Risk / 🔴 Off Track

### Key Metrics
| Metric | Target | Actual | Trend | Status |
|--------|--------|--------|-------|--------|
| [KPI] | [Target] | [Actual] | [up/down/flat] | 🟢/🟡/🔴 |

### Done This Period
- [Win 1]
- [Win 2]

### In Progress
| Item | Owner | Status | ETA | Notes |
|------|-------|--------|-----|-------|
| [Item] | [Person] | [doing / in review] | [Date] | [Context] |

### Blocked
| Item | Owner | Blocked on | Since | What unblocks it | Who can unblock |
|------|-------|-----------|-------|------------------|-----------------|
| [Item] | [Person] | [Dependency, missing input, access, decision] | [Date] | [Specific action] | [Person / the owner] |

### Risks and Issues
| Risk/Issue | Impact | Mitigation | Owner |
|------------|--------|------------|-------|
| [Risk] | [Impact] | [What we're doing] | [Who] |

### Decisions Needed
| Decision | Context | Deadline | Recommended Action |
|----------|---------|----------|--------------------|
| [Decision] | [Why it matters] | [When] | [What I recommend] |

### Next Period Priorities
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]
```

Write "None" under **Blocked** or **Decisions Needed** when there are none, rather than dropping the section, so readers know it was checked. A blocker that is waiting on a decision appears in both tables, cross-referenced.

## Tips

1. **Lead with the headline** — Busy leaders read the first 3 lines. Make them count. If anything is blocked or needs a decision, say so in the executive summary.
2. **Be honest about risks** — Surfacing issues early builds trust. Surprises erode it.
3. **Make decisions easy** — For each decision needed, provide context and a recommendation.
4. **Make blockers actionable** — Name exactly what would unblock each item and who can do it. "Waiting on design" is not enough; "Waiting on the Product Designer's empty-state copy for the upload screen" is.
5. **Don't invent status** — If the board and files don't say whether something is done, mark it unknown and ask its owner.
