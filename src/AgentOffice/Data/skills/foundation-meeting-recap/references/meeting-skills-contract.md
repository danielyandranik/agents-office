# Meeting Skills Contract (excerpt for meeting recaps)

_From PM-Skills (product-on-purpose/pm-skills), `site/src/content/docs/reference/skill-families/meeting-skills-contract.md`, contract v1.1.0, Apache-2.0. Excerpted and adapted for Agent Office: only the parts that govern `foundation-meeting-recap` are kept. Sections about the sibling agenda, brief, synthesis and stakeholder-update skills (not bundled here), CI enforcement, versioning and the change log are removed._

---

## What this document is

The shared behavioral and structural contract behind a meeting recap: the frontmatter it emits, the file naming it uses, the behavioral pattern it follows, the shared taxonomies it references, and the non-goals it respects. In the upstream library it is shared by a family of meeting skills (agenda, brief, recap, synthesis, stakeholder update); here only the recap is bundled, but the conventions still apply so recaps stay consistent and an agenda written by hand in the same format can be reconciled.

---

## Universal principles

### 1. Zero-friction execution (go mode)

The skill never blocks on interrogation. When invoked, it reads whatever input is provided, infers whatever it can, and either (a) presents a brief inference summary and accepts a one-word `go` to proceed, (b) runs straight through if whoever asked said to skip the check, or there is nobody to answer (you are working from a board task or a colleague's handoff), or (c) runs through immediately if all inputs were provided upfront.

**Default flow**:

1. Read the inputs, run an inference pass
2. Present a brief inference summary, for example:
   > Inferred:
   > - Meeting type: `decision-making` (confidence: medium. from "need to decide whether to ship v2")
   > - Attendees: 6 people, roles inferred from attendee-list context
   > - Objective: "Decide v2 ship timing for Q2"
   >
   > Say **go** to proceed, or tell me what to adjust.
3. On `go`, produce the output; on corrections, re-infer and re-summarize
4. The output's `Generation context` section notes every inference that made it into the final artifact

**Blocking questions** are permitted only when inference confidence is actively low on a load-bearing input AND no reasonable default exists. This should be rare. When asking, state the default you will apply if there is no answer.

**Load-bearing inference gates**:

Some inferences are load-bearing: downstream output depends on them. When confidence is below `high` on any of the following fields, flag the risk in the inference summary (and in Generation context) with a `⚠` marker:

| Field | Why load-bearing | Required flag when <high confidence |
|-------|------------------|-------------------------------------|
| Decision-maker attribution | Downstream escalation depends on correct attribution | "⚠ decision-maker inferred; verify before escalating" |
| Primary ask / primary outcome | Output is structured around this | "⚠ primary outcome inferred; confirm before acting" |

**Anti-patterns** (prohibited):

- Asking "is this attendee list correct?" mid-flow
- Asking whoever asked to confirm inferred values before producing anything
- Rejecting low-quality input. `input_quality: low` exists precisely for this
- Requiring more than what was provided before producing any output
- Passing load-bearing low-confidence inferences silently (must flag with `⚠`)

### 2. Adaptive Executor pattern

Gracefully accept variable-quality input:

- Clean structured notes with headers and sections
- Raw transcripts (any meeting or transcription tool, or a manual paste)
- Bullet-point scraps or shorthand notes
- Chat thread exports
- Hybrid inputs (partial transcript + annotations)
- Ancillary context (prior recaps, related docs)

Ask only for critically missing context; do not require structured input. When content is fragmentary, flag it via `input_quality: low` and produce a best-effort output with explicit `Known gaps` rather than refusing.

### 3. Evidence and confidence discipline

Never fabricate attendees, decisions, actions, or claims unsupported by input. Uncertainty is surfaced, not hidden. Every output carries:

- An overall `input_quality` marker (`high | medium | low`) in frontmatter
- An overall `confidence` marker in frontmatter
- Inline per-section confidence markers where warranted (`[confidence: high]`, `[confidence: medium]`, `[confidence: low]`)
- A `Known gaps` list in the `Sources & References` section

When you infer a value (meeting type, attendee role, decision classification), flag the inference inline with its confidence and the evidence basis.

### 4. Filename-based chaining

No separate `meeting_id` field. The filename itself is the identifier; artifacts reference each other by full filename (`related_agenda`, `related_brief`, `related_recap` in frontmatter). `project` + `topics` enable grouping recaps across meetings.

---

## Shared taxonomies

### Meeting type enum

```
standup
planning
review
decision-making
brainstorm
1-on-1
stakeholder-review
project-kickoff
working-session
exec-briefing
incident-postmortem
customer-call
training-workshop
business-review
other
```

**Frontmatter field**: `meeting_type` (optional; infer when absent).

### Attendee role enum (simplified RACI-4)

```
decision-maker
contributor
informed
optional
```

**Frontmatter field**: `attendees` is an optional list of objects with optional `role` values. Infer roles from context when not provided.

### Input quality levels

```
high     - structured notes with clear topics, complete attendee list, explicit decisions and actions captured
medium   - partial notes, some gaps, requires moderate inference
low      - fragmentary input, significant inference required, multiple gaps
```

**Frontmatter field**: `input_quality` (required).

### Confidence levels

Same enum used for overall confidence (frontmatter `confidence`) and inline per-section markers:

```
high   - directly supported by input
medium - inferred from multiple contextual cues
low    - tentative, verify before sharing
```

### Artifact type

`meeting-recap` (frontmatter `artifact_type`, required). An agenda is `meeting-agenda`.

### Visibility enum

```
private | team | leadership | public
```

**Frontmatter field**: `visibility` (required). Recap default: `team`.

### Status enum

```
draft | final | archived
```

**Frontmatter field**: `status` (required). New artifacts default to `draft`.

---

## Universal output requirements

### 1. Shareable summary at the top

The recap leads with a `## Shareable summary` block designed to be pasted into a chat message or email, or sent to a colleague, with no further editing.

**Right-sized** means:

- 3 to 6 short lines
- Leads with the most important information (outcome, decisions, top actions)
- Skimmable in under 10 seconds
- Self-contained: a reader who does not open the full doc still gets the essentials
- Plain prose and simple bullets. No nested headers, no tables, no markdown that breaks in chat clients

### 2. Sources & References section at the bottom

The recap ends with a `## Sources & References` section with this structure:

```markdown
## Sources & References

### Primary inputs
[what the skill drew from to produce this artifact]
- {{Source type}}: {{Source name/identifier}}

### Referenced artifacts
[related meeting or project documents, using full filenames]
- Agenda: [{{filename}}]({{path}})
- Prior recap: [{{filename}}]({{path}})

### External references
[docs, links, data cited in the meeting content]
- {{Title}}: {{Link}}

### Generation context
- **Generated**: {{Timestamp}}
- **Skill version**: {{Version}}
- **Input quality**: {{high | medium | low}}. {{Brief rationale}}
- **Overall confidence**: {{high | medium | low}}. {{Brief rationale}}
- **Known gaps**: {{List of topics the input did not cover sufficiently, or "None identified"}}
- **Inferences applied**: {{List of values inferred, each with confidence marker}}
```

Purpose: auditability (can a reader verify claims?), chaining (later work knows what to trust), and cross-meeting synthesis (depends on traceable lineage).

### 3. YAML frontmatter

The recap begins with YAML frontmatter. `references/TEMPLATE.md` shows the full block. Universal base fields: `artifact_type`, `version`, `generated_at`, `generated_by_skill`, `input_quality`, `confidence`, `visibility`, `status`. Meeting identity fields: `meeting_title`, `meeting_date`, `meeting_start_time`, `meeting_type`, `project`, `topics`, `attendees`, `attendees_absent`, `related_agenda`, `related_brief`.

Recap-specific fields: `agenda_reconciliation` (object: `topics_planned`, `topics_hit`, `topics_skipped`, `topics_emerged`), `meeting_quality` (object: `outcomes_achieved`, `started_on_time`, `ended_on_time`, `key_attendees_present`), `meeting_type_source` (`explicit | inferred | null`), `unassigned_action_ratio` (float 0.0 to 1.0).

### 4. File naming convention

Single-meeting artifacts (agenda, brief, recap):

```
YYYY-MM-DD_HH-MMtimezone_title_artifact-type[_prepared-YYYY-MM-DD].md
```

Where:

- `YYYY-MM-DD`: meeting date (not prep date)
- `HH-MMtimezone`: meeting start time with concatenated timezone abbreviation (e.g., `14-00EST`, `09-30PST`, `16-00UTC`)
- `title`: short slug of the meeting title
- `artifact-type`: `agenda`, `brief` or `recap`
- `_prepared-YYYY-MM-DD`: optional, only when the write-up date differs from the meeting date

Examples:

```
2026-04-17_14-00EST_search-feature-kickoff_agenda.md
2026-04-17_14-00EST_search-feature-kickoff_recap_prepared-2026-04-18.md
```

**Slug rules**: ASCII lowercase only (transliterate accented characters); hyphen separators; strip all other punctuation; maximum 60 characters; on a collision append `-2`, `-3`, etc.

**Timezone note**: abbreviations such as `EST` are DST-ambiguous. That is acceptable within one team's workflow; for cross-region work, add an `IANA_timezone` frontmatter field (e.g. `America/New_York`) or use UTC offsets in filenames (`14-00-0400`). Be consistent.

### 5. Input quality flagging and confidence markers

- **Assess input quality** at the start and flag it in frontmatter: `high`, `medium`, or `low`
- **Surface confidence per section** where appropriate
- **Explicitly note gaps** in the `Sources & References` section: "The following topics lacked sufficient detail to summarize: {X, Y}"
- **Never fabricate** attendees, decisions, or actions not supported by input

---

## Explicit non-goals

1. **Calendar integration**. The recap is a document, not calendar events.
2. **Live transcription**. The skill consumes transcripts; it does not produce them.
3. **Meeting recording**. Not a skill responsibility.
4. **Attendee identity resolution**. Names are accepted as provided. Disambiguation of "Alex" vs. "Alex R." vs. "Alexandra" is the requester's responsibility; flag ambiguity but do not resolve it.
5. **Synchronous collaboration**. This is post-processing, not real-time collaboration during meetings.
6. **Slide generation**. The recap is a Markdown artifact.
