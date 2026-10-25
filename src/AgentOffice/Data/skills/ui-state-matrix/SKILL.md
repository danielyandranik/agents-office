---
name: ui-state-matrix
description: "Enumerate every UI state for each screen of an HTML mockup or design: default, loading, empty (first use vs no results), error (recoverable vs not), permission-denied, offline/slow, success, and destructive confirmation, with exact UI copy and accessibility notes (focus, announcements, contrast) per state, reusing the product's existing patterns. Use after drafting a mockup or spec, before handing a design to engineering, or when reviewing a design for missing states. Produces a matrix table plus per-state notes saved to the workspace."
---

# UI state matrix

A screen is not designed until every state it can be in is designed. Engineers
fill undesigned states with whatever is fastest, and that is usually a blank
area, a raw error string, or a spinner that never ends. This skill turns a
mockup into a complete, buildable list of states with the exact words on screen
and the accessibility behavior of each.

## Inputs

- The mockup or design: HTML files, a design guide, or a screen spec in the
  mission workspace (`list_files`, `read_file`).
- The existing product, if there is one: current screens, components, style
  files, copy, and design notes in the workspace.
- The spec or acceptance criteria from the Product Manager, if any.

If you don't know how the backend fails (which errors exist, whether a 403 or a
404 is returned, how long requests take), ask the Software Engineer or Software
Architect with `ask_colleague`. Don't invent error codes or limits.

## Steps

1. **List the screens.** Give each screen an ID (`S1 Project list`,
   `S2 Project detail`, `D1 Delete project dialog`). Include dialogs, drawers,
   and full-page states that have their own layout.
2. **Inventory the existing patterns before designing any state.** Find what
   the product already uses for: loading (skeleton, spinner, progress bar),
   empty states, inline field errors, error banners, full-page errors, toasts,
   confirmation dialogs, offline indicators, permission messages. Record each
   pattern's name and file. Reuse them. Propose a new pattern only when none
   fits, and say why in the notes.
3. **Walk every screen through every state** in the list below. For each cell,
   decide: the trigger, what changes on screen, the exact copy, the actions,
   and the accessibility behavior. If a state cannot happen on a screen, write
   `N/A` with the reason (for example, "N/A: static page, no data fetch"). An
   empty cell is a missing decision, not a pass.
4. **Write the exact copy.** Titles, body text, button labels, helper text,
   toasts, announcements. Follow the `ux-writing` skill: say what happened and
   what to do next, keep the same verb through a flow ("Delete project" leads
   to "Project deleted"), no apologies, no vague "Something went wrong", no raw
   codes as the main message.
5. **Add accessibility notes per state**: where focus goes, what is announced
   and how (`role="status"` / `aria-live="polite"` for routine updates,
   `role="alert"` only for urgent, blocking problems), contrast of any new
   colors, and keyboard behavior. Use the `accessibility` skill for criteria.
6. **Collect open questions** (behavior you could not confirm) and send them
   to the right colleague. Mark the affected cells `TBC`.
7. **Save the result** to the workspace with `write_file`, for example
   `design/<feature>-state-matrix.md`, and summarize gaps in your reply.

## The states and what each must specify

| State | Must specify |
|---|---|
| **Default** | Populated layout with realistic data, including long names and large numbers. Primary action. Initial focus (page start or main heading, not a random field). |
| **Loading** | Skeleton that reserves the final layout for content, spinner only for short isolated actions; buttons show progress and are disabled while busy. `aria-busy="true"` on the region. Announce "Loading <thing>…" politely only if it takes more than about a second. Focus does not move. Reduced-motion variant for shimmer. |
| **Empty: first use** | Why it is empty, the benefit of filling it, one primary action ("Create project"). Decorative illustration has empty alt text. |
| **Empty: no results** | Echo the query or filters ("No projects match 'atlas'"), keep the query in the field, offer "Clear filters". Announce the result count with `role="status"`. Distinct from first use. |
| **Error: recoverable** | What failed and what to do; retry or edit action; user input preserved. Field errors sit next to the field, linked with `aria-describedby`, field has `aria-invalid="true"`; on submit, focus the first invalid field or an error summary. Error color plus icon plus text, never color alone. |
| **Error: unrecoverable** | Full-page or blocking state with a heading that receives focus, a plain explanation, a way out (go back, go to home, contact the owner), and a copyable reference ID if the system has one. |
| **Permission denied** | What the person can't do, why in plain words, who can grant access, and a "Request access" or "Go back" action. Confirm with engineering whether the screen should reveal that the resource exists. |
| **Offline / slow** | Offline banner with `role="status"`, which actions still work, whether changes are queued; network-only actions disabled with a visible reason. Slow state: after a set delay (state it, for example 5 s) show "Still loading…" with a cancel or retry option. |
| **Success** | Past-tense confirmation with the same verb as the action ("Changes saved"). Toast uses `role="status"`, does not steal focus, and is not the only place the result is visible. A toast with an action (Undo) stays until dismissed or gives enough time (WCAG 2.2.1). |
| **Destructive confirmation** | Name the object and the consequence ("Delete 'Atlas'? Its 12 tasks are deleted too. You can't undo this."). Confirm button repeats the verb ("Delete project"), Cancel is the default focus, Escape cancels, focus returns to the trigger. Dialog uses `role="alertdialog"` with `aria-labelledby` and `aria-describedby`. Prefer Undo over a dialog for reversible actions; use type-to-confirm only for high-stakes deletes. |

Add other states only when the screen has them (partial data, read-only, stale
data, rate-limited). Hover, focus, pressed, and disabled states of individual
components belong in the component spec (see `ui-ux-designer`), not here.

## Output format

```markdown
# <Feature> state matrix

Source: <mockup/spec paths> · Patterns reused: <list with file paths>

## Matrix

| Screen | Default | Loading | Empty (first use) | Empty (no results) | Error (recoverable) | Error (unrecoverable) | Permission denied | Offline / slow | Success | Destructive confirm |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 Project list | S1.1 list of cards | S1.2 skeleton x6 | S1.3 "No projects yet" | S1.4 "No projects match…" | S1.5 retry banner | S1.6 full-page error | S1.7 request access | S1.8 offline banner | N/A: read-only | N/A: no delete here |

## Per-state notes

### S1.3 Project list: empty, first use
- Trigger: the account has no projects.
- Pattern: `EmptyState` (components/EmptyState.html).
- Layout: centered block replaces the card grid; header and nav unchanged.
- Copy: title "No projects yet" · body "Create a project to start tracking work with your team." · primary "Create project".
- Accessibility: focus stays at page start; illustration `alt=""`; button contrast 7.1:1 on surface.
- Open questions: none.

## Open questions
| ID | Question | Asked | Status |
|---|---|---|---|
| S1.7 | Does a user without access get 403 or 404 on a project URL? | Software Engineer | TBC |
```

Keep the matrix cells short (an ID and a few words). Put the detail in the
per-state notes, one block per non-N/A cell.

## Checklist before you hand it over

- [ ] Every screen has a value in every column: a state, `N/A` with a reason, or `TBC`.
- [ ] Empty first-use and no-results states are different designs with different copy.
- [ ] Recoverable and unrecoverable errors are distinguished, and both give a next step.
- [ ] Every state reuses a named existing pattern, or the notes say why a new one is needed.
- [ ] Every user-visible string is written out exactly, with no "lorem ipsum" or "[error message]".
- [ ] Each state says where focus goes and what is announced, if anything.
- [ ] New colors have computed contrast: text at least 4.5:1, icons, borders and focus rings at least 3:1.
- [ ] Destructive actions name the object and consequence, default to Cancel, and return focus.
- [ ] Open questions were sent to a named colleague.

## What not to do

- Don't invent new spinners, toasts, or dialog styles when the product has them.
- Don't write "Something went wrong", "Error", "Oops", or a bare status code as the main message.
- Don't use `role="alert"` for routine updates; it interrupts screen-reader users.
- Don't move focus to toasts or announce every keystroke of a search.
- Don't guess backend behavior (error types, limits, timeouts) and present it as fact; mark it `TBC`.
- Don't leave cells blank or write "same as above" without the ID it refers to.

When you review someone else's design for missing states, report each gap with
the office severity scale: **BLOCKER** (no error or permission state on a
critical flow, or a destructive action without confirmation or undo),
**MAJOR** (missing loading, empty, or offline state; color-only error),
**MINOR** (copy inconsistency, missing announcement on a non-critical update),
**NIT** (polish).
