---
name: foundation-meeting-recap
description: "Produces a topic-segmented post-meeting summary for attendees with decisions highlighted and actions captured inline per topic (plus a consolidated action view by owner). Uses an agenda from the workspace as the topic skeleton when one exists and reconciles planned vs. actual topics. Accepts transcripts from any meeting tool or manual notes; runs on variable-quality input without blocking and never invents owners, decisions or actions. Use after a meeting that produced decisions or actions."
license: Apache-2.0
---

# Meeting Recap

A meeting recap is a post-meeting topic-segmented summary produced for attendees and light distribution. It organizes content by topic rather than chronology, highlights decisions visually, and captures actions inline (with owner, due date, dependencies) per topic segment, plus a consolidated actions view at the end for scannability.

This skill absorbs what would otherwise be a separate "meeting-actions" skill. Actions live alongside the context that makes them meaningful, not in a sibling artifact.

It follows the meeting-skills conventions in `references/meeting-skills-contract.md` (frontmatter, file naming, confidence markers, shareable summary, Sources & References). Read it with `read_skill_file` the first time you use this skill.

## When to Use

- After any internal meeting that produces decisions or actions affecting attendees
- When an agenda for the meeting exists and needs reconciliation (planned vs. actual topics)
- When the team needs a topic-organized reference rather than a chronological transcript dump
- When inputs include a transcript (from any meeting or transcription tool) or mixed notes and transcript

## When NOT to Use

- Setting the pre-meeting structure attendees will see (topics, owners, time boxes) before the meeting happens. A recap summarizes what happened after a meeting; write an agenda directly instead.
- Preparing private positioning before a meeting that matters. A recap is a shared post-meeting record, not private prep.
- Communicating outcomes to non-attendees. A recap assumes reader context; for project status use `status-report`, or write a short update tailored to readers without that context.
- Cross-meeting synthesis (patterns across multiple meetings). This skill covers one meeting; synthesize across several recaps separately.
- Synthesizing user research interviews across participants. A recap organizes a single meeting by topic; it does not find patterns across many research conversations.
- Live meeting note-taking. This skill consumes finished inputs; it does not transcribe live.

## Zero-friction execution

Per the meeting-skills contract, this skill never blocks on interrogation. Default flow:

1. Read all provided inputs (transcript, notes, or hybrid) and note input quality upfront
2. Look for a related agenda in the mission workspace (`list_files`): a filename matching `*_{title-slug}_agenda.md`, preferably in the same folder as the notes
3. Run inference: meeting metadata from content, decisions from language markers, actions from imperative-future patterns, owners from attendee context
4. Present a brief inference summary and accept one-word `go` or corrections
5. Produce the recap

Skip the inference summary when whoever asked says to, when they provided all metadata upfront, or when there is nobody to answer it (you are working from a board task or a colleague's handoff). Then record every inference in Generation context instead.

## Fabrication prohibition

This skill never fabricates owners, decisions, or actions. When an action lacks an explicit owner, it is captured as `[owner: unassigned, needs confirmation]` not invented. When a decision is implicit ("it sounded like we decided X"), it is flagged with a confidence marker rather than stated as fact. Trust decay from fabrication is worse than the mild friction of flagging.

## Ownership reconciliation threshold

When the ratio of unassigned actions to total actions exceeds **0.3** (30%), OR when any high-priority action lacks an owner, the skill surfaces a dedicated `## ⚠ Ownership reconciliation required` section at the top of the recap (above the topic segments) listing:

- All unassigned actions
- A suggested next step for each (who should probably own this based on topic context, flagged as inference)
- A recommended follow-up action (ask the likely owner with `ask_colleague` if they are a colleague, a 15-min sync, or a note to the owner)

The shareable summary also leads with this flag when triggered: `⚠ Ownership reconciliation required: N of M actions lack owners.`

The `unassigned_action_ratio` frontmatter field (float 0.0-1.0) records the ratio for later use.

Rationale: a recap with 60% ownerless actions is "non-fabricated" (per the prohibition above) but operationally broken: a pile of broken tickets. The threshold makes this visible instead of silently shipping.

## Instructions

When asked to create a meeting recap, follow these steps:

1. **Parse inputs and detect type**
   Transcript (timestamped speaker-attributed lines), notes (bullet or prose), or hybrid. Note input quality upfront: transcript plus structured notes is high; scrappy bullets is low.

2. **Find a related agenda**
   Look in the mission workspace for a file matching `{YYYY-MM-DD}_{HH-MMtimezone}_{title-slug}_agenda.md` (or an agenda whoever asked points you to). If found, read it: its topic list is the recap's topic skeleton and its `desired_outcomes` drive the meeting-quality reconciliation.

3. **Present go-mode inference summary** (unless skipped, see Zero-friction execution)
   Show detected meeting date, title, attendees (if inferred), input quality assessment. Accept `go` or corrections.

4. **Topic-segment the content**
   - If an agenda was loaded, use its topic list as scaffold (plus any emergent topics)
   - If no agenda, identify topics from transcript discourse markers ("moving on to", "the other thing")

5. **Per topic segment, extract**
   - **Discussion summary**: 2-3 sentences capturing what was discussed
   - **Decisions made**: bold-flagged visually. Never fabricate. If uncertain, flag "appears to have decided X [confidence: medium]"
   - **Actions**: owner + due date + dependencies. Flag missing owners as `[owner: unassigned]` and missing dates as `[due: not specified]`. Never invent.
   - **Open questions**: unresolved items with confidence marker on whether they are truly unresolved or simply not re-raised

6. **Consolidate actions by owner**
   Regroup all actions under each owner. Enables single-owner scan ("what do I owe after this meeting?").

7. **Reconcile agenda** (if agenda loaded)
   - `topics_planned`: from agenda topic list
   - `topics_hit`: topics actually discussed
   - `topics_skipped`: planned but not discussed, with brief reason
   - `topics_emerged`: discussed but not on agenda

8. **Assess meeting quality signals**
   - `outcomes_achieved`: N/M ratio of agenda `desired_outcomes` met (when agenda present)
   - `started_on_time` / `ended_on_time`: from timestamps when available; skipped when not
   - `key_attendees_present`: flag if decision-makers were absent

9. **Surface next steps**
   When we reconvene, what needs to happen on the critical path before that.

10. **Render TEMPLATE.md and validate**
    Read `references/TEMPLATE.md` (format) and, if useful, `references/EXAMPLE.md` (a worked recap). Then check:
    - Every action's owner appears in `attendees` or is explicitly `unassigned`
    - `meeting_quality.outcomes_achieved` matches `N/M` pattern when populated
    - `agenda_reconciliation` fields present even when empty lists

11. **Save and (optionally) track**
    If you can write files, save the recap in the mission workspace using the contract's file naming. If whoever asked wants actions tracked and you have board tools, add each action **that has a stated owner** as a mission board task (`board_add`) or, if you are a planner, an office board card (`office_board_add`), citing the recap file. Never create tasks for unassigned actions; they stay in the reconciliation section until someone owns them.

## Quality Checklist

- [ ] Input quality flagged honestly (high / medium / low)
- [ ] Agenda lookup attempted; result noted in Generation context
- [ ] Every topic segment has Discussion / Decisions / Actions / Open questions subsections
- [ ] Decisions are bold-flagged; never invented; confidence marked when inferred
- [ ] Every action has owner (or explicit `unassigned`) + due date (or explicit `not specified`)
- [ ] Consolidated actions view regrouped by owner
- [ ] Agenda reconciliation populated when agenda was loaded
- [ ] Meeting quality signals populated with data available; skipped fields flagged
- [ ] Shareable summary 5-6 lines, lead with decisions and top actions
- [ ] Sources and References Generation context notes transcript source and any missing owners/dates

## See also

- `references/meeting-skills-contract.md`: shared conventions (excerpt)
- `status-report`: turning recap outcomes into a project status for readers who were not there
- `work-handoff-brief`: handing a recap action to a colleague with full context

---
_From PM-Skills (product-on-purpose/pm-skills), Apache-2.0. Adapted for Agent Office._
