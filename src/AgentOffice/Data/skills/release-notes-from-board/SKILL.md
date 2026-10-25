---
name: release-notes-from-board
description: "Draft user-facing release notes without git access, from finished work on the boards (office_board_list if available, and the mission board_list) plus merged-work summaries from colleagues. Highlights first, features before fixes, user-facing language, internal-only and experimental items excluded, and anything unverified confirmed with the owner or engineers. Use when asked for release notes, a changelog entry, a 'what's new' post, or a summary of what shipped. Output is Markdown saved to the workspace."
---

# Release notes from the board

You have no git history to read. The record of what shipped is the boards, the
summaries colleagues give you, and the files in the workspace. Release notes
built from those sources are only as good as their verification, so this skill
keeps a ledger of every item and its evidence and publishes only what is
confirmed.

## Inputs

- **Office board** (`office_board_list`), if your role has it: cards in `done`
  and `review`. Only the owner moves cards to `done`, so `done` means accepted;
  `review` means finished but not yet accepted.
- **Mission board** (`board_list`): tasks with status `done`. Ignore `todo`,
  `doing`, and `blocked`.
- **Merged-work summaries** from the Software Engineer and other colleagues,
  either already in the conversation or requested with `ask_colleague`.
- **Workspace files**: an existing `CHANGELOG.md` or release notes (for format
  and the previous version), specs, docs, and source files that show what a
  change does.

## Steps

1. **Fix the scope.** Find the version name or number, the release date, and
   the period or milestone it covers. Take them from the request, the board,
   or an existing changelog. If none is given, ask the owner. Never invent a
   version number or date; use `VERSION` and `DATE` placeholders until confirmed.
2. **Collect candidates.** Read the boards and list every finished item in the
   scope in a ledger (template below), with its card or task ID and title.
   Cards still in `review` go in the ledger as "pending owner acceptance".
3. **Get the user-facing story for each item.** For items whose card doesn't
   say what changed for users, ask the engineer who did the work. Ask specific
   questions: What can people do now that they couldn't before? What behaves
   differently? Is it behind a flag or preview? Does anyone need to take
   action (migration, new setting, changed default)? Is anything removed or
   deprecated? Read the spec or source file when it answers the question
   directly.
4. **Classify each item**: Feature (new capability), Improvement (existing
   capability changed), Fix, Action required (breaking change, migration,
   changed default), Deprecation or removal, Security, Internal, Experimental.
5. **Exclude** from the published notes:
   - Internal-only work: refactors, tests, CI and build changes, tooling,
     internal docs, dependency bumps with no user-visible effect.
   - Experimental work: anything behind a flag, in preview, or marked
     experimental, unless the owner says to announce it (then label it
     "Preview").
   - Anything not finished, and `review` cards the owner has not accepted.
   - Security fixes whose details the Security Reviewer or owner has not
     cleared for publication (publish a general line only if they agree).
6. **Verify.** Every published item needs evidence: a `done` card plus either
   a colleague's summary or a source or spec file that shows the change. Items
   without evidence go to "To confirm". Send that list to the owner or the
   responsible engineer and wait for answers on those items. Drop or hold any
   item that stays unconfirmed; don't publish a guess.
7. **Write the notes** in the format below. Order: highlights, action
   required (if any), new features, improvements, fixes, deprecations, known
   issues. Features always come before fixes.
8. **Self-check** with the checklist, optionally run the `humanizer` skill on
   the prose, then save the notes with `write_file` (for example
   `release-notes/VERSION.md`, or prepend to the existing `CHANGELOG.md` if the
   project keeps one) and save or return the ledger separately.

## Writing rules

- Write for the people who use the product, not for the team. "You can now
  export a report as CSV" instead of "Added CsvExporter service".
- Lead with the benefit, then the detail. One or two sentences per item.
- Highlights: 3 to 5 items, each with a bold title and one or two sentences.
  Pick the changes most users will notice or have asked for.
- Fixes say what was wrong from the user's view: "Fixed: dates in exported
  reports used the wrong time zone." Not "Fixed bug" or "Various fixes".
- Action required says exactly what to do and by when, and links to the
  migration guide if one exists.
- No card IDs, internal project names, people's names, or blame in the
  published notes. Keep IDs in the ledger.
- Use the product's own terms for features (check the UI copy or docs).
- Use the project's existing changelog format when there is one.

## Output: release notes

```markdown
# <Product> VERSION release notes (DATE)

## Highlights
- **Export reports as CSV.** Download any report as a spreadsheet from the **Export** menu.
- **Faster project search.** Search results now appear as you type.

## Action required
- The `legacy_sync` setting is removed. Switch to **Scheduled sync** in **Settings** before upgrading. See [Migrate to scheduled sync](LINK).

## New features
- You can now invite teammates by email from the project page.

## Improvements
- Project lists load in pages of 50, so large accounts open faster.

## Fixes
- Fixed: dates in exported reports used the server's time zone instead of yours.

## Deprecations
- The v1 export endpoint is deprecated and will be removed in a future release.

## Known issues
- Search doesn't match words with accents yet.
```

Delete empty sections; don't publish an empty heading.

## Output: verification ledger (for whoever asked, not for publication)

```markdown
| Card/task | Title | Class | Published? | Evidence | Status |
|---|---|---|---|---|---|
| OB-42 | CSV export | Feature | Yes (highlight) | done card + Software Engineer summary | Verified |
| T-17 | Refactor auth module | Internal | No | done task | Excluded: internal |
| OB-51 | New onboarding (flagged) | Experimental | No | review card | Excluded: experimental, pending acceptance |
| OB-48 | Time zone fix in exports | Fix | Pending | done card, no summary | To confirm with Software Engineer |
```

## Checklist

- [ ] Version and date are confirmed, or left as placeholders and flagged.
- [ ] Every published item is in the ledger with evidence.
- [ ] No `review` card is published without the owner's acceptance.
- [ ] Internal-only and experimental items are excluded (or labeled Preview with the owner's approval).
- [ ] Highlights come first; features come before fixes.
- [ ] Every item is written in user-facing language with no internal IDs or names.
- [ ] Action-required items say what to do and link to instructions.
- [ ] Unverified items were sent to the owner or an engineer, and none were published as fact.

## What not to do

- Don't guess what a card did from its title alone.
- Don't fabricate version numbers, dates, metrics ("50% faster"), or issue counts.
- Don't pad the notes with "performance improvements and bug fixes".
- Don't move board cards or change their status; that is the owner's and planners' job.
- Don't ask for git access or a shell; ask the engineers for summaries instead.
