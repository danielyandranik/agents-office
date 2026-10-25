_From PM-Skills (product-on-purpose/pm-skills), Apache-2.0. Adapted for Agent Office._
# Routing map

The Build Risk Review is a gate that dispatches the next piece of work. Always name a next step so whoever asked knows the next move. Where no bundled office skill covers that step, inline its minimal version (the "Inline instead" table in SKILL.md) rather than leaving a bare pointer.

## By verdict

| Verdict | Means | Next |
|---|---|---|
| **Build small** | worth a narrow first version | `write-spec` (tight P0 scope, user stories), then `deliver-acceptance-criteria` |
| **Validate first** | direction plausible; demand, payment, or distribution unproven | inline a hypothesis, then an experiment sketch |
| **Pivot first** | the area is plausible but the current wedge is too broad, crowded, or weak | inline the three riskiest business-model boxes (problem, customer segment, unfair advantage) |
| **Don't build yet** | too vague, no reachable user, or solved well enough already | stop; or inline a competitive or market-size evidence check |

## By risk type

When a specific risk dominates and warrants a deeper look, follow the "Next" column in `references/risk-taxonomy.md` (e.g. a `monetization` risk calls for the business-model check, a `demand` risk for a hypothesis or a market-size check).

## Several competing requests

If the input is not one build decision but a set of requests to rank, hand off to `define-prioritization-framework` (RICE / ICE / MoSCoW). This skill judges one decision's risk of failure; it does not rank a list.

## Related office skills

- Delivery risks (schedule, staffing, dependencies, vendors) once the work is committed -> `risk-assessment`.
- Sizing the first version once the verdict is Build small -> `estimate-with-uncertainty`.

## Boundaries (NOT this skill's job)

- A launched product's pivot-or-persevere call, weighing market feedback -> say so; weigh the usage and market data directly.
- Framing a confirmed problem for the team or leadership -> `write-spec` (Problem Statement, Goals).
- Designing the test for a chosen assumption -> inline the hypothesis and experiment sketch.
- The full business model -> out of scope; note the three riskiest boxes.
