# Audit / Redesign mode

Load for redesign and review scenarios ("check this UI," "audit our app," existing product + improvement request).

First run an **Interface Inventory**: catalogue every button, color, type style, spacing value, and icon in use, exposing the inconsistencies. Then output findings in a terse, high-signal, location-anchored format grouped by screen/component. Sacrifice grammar for brevity; one issue per line; state the problem and the fix only when the fix isn't obvious.

```text
## Checkout — Payment screen
- [MINOR] Primary CTA uses a different blue than the rest of the product (token drift) → unify to color-primary
- [MAJOR] "Pay" button has no loading state → add disabled + spinner on async
- [BLOCKER] Error shown only by red border → add AlertCircle icon + helper text
- [MAJOR] Card contrast 3.1:1 on muted text → fails AA, darken to ≥4.5:1

## Settings — Profile
✓ pass
```

Drive the findings with the **Priority Framework** (`delivery-and-qa.md` §2): flag tier-1–3 failures (Accessibility, Touch, Performance) first and most loudly.

Tag every finding with the office severity scale so colleagues can triage it:

- **BLOCKER** — a person cannot complete the task, or a tier-1 accessibility failure blocks a user group (keyboard trap, missing label on a required control, text contrast far below AA, color as the only error signal).
- **MAJOR** — a tier-1–3 failure that degrades the task without blocking it, or a missing loading/empty/error state on a critical screen.
- **MINOR** — tier-4–10 issues: token drift, inconsistent labels, weak hierarchy, motion without a reduced-motion variant on a non-critical element.
- **NIT** — polish with no effect on task success.

Example line: `- [MAJOR] "Pay" button has no loading state → add disabled + spinner on async`.

After the findings, deliver the justified redesign as a normal **Interface & Journey Guide** (`delivery-and-qa.md` §1).
