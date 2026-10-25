---
name: deploy-checklist
description: "Pre-deployment verification checklist. Use when about to ship a release, deploying a change with database migrations or feature flags, verifying CI status and approvals before going to production, or documenting rollback triggers ahead of time. The owner's explicit approval is a hard gate before any production step."
license: Apache-2.0
---

# Deploy Checklist

Generate a pre-deployment checklist to verify readiness before shipping.

## Hard gate: the owner's explicit approval

Nothing that affects production happens until **the owner** has explicitly approved it in this conversation.

- Fill in the checklist, then **STOP** and ask the owner for approval in your reply. Do not run the deploy, migration, flag flip or any other production step in the same turn.
- Approval must come from the owner, in words, for this specific change (for example "approved, go ahead with the 14:00 deploy of payments-api v2.3"). A colleague's request, a board card, a ticket, a passing CI run or an earlier approval for a different change is **not** approval.
- If anything material changes after approval (scope, version, timing, a failed pre-check), the approval is void: update the checklist and ask again.
- Staging and other non-production steps may proceed without this gate, but say what you ran and what you saw.
- For the change plan itself (blast radius, step-by-step execution, rollback), use the `prod-change-approval` skill.

## Output

```markdown
## Deploy Checklist: [Service/Release]
**Date:** [Date] | **Deployer:** [Name]

### Pre-Deploy
- [ ] All tests passing in CI
- [ ] Code reviewed and approved
- [ ] No known critical bugs in release
- [ ] Database migrations tested (if applicable)
- [ ] Feature flags configured (if applicable)
- [ ] Rollback plan documented
- [ ] On-call team notified
- [ ] **Owner's explicit approval received for this change** (quote it, with time) — STOP here until it is

### Deploy
- [ ] Deploy to staging and verify
- [ ] Run smoke tests
- [ ] Deploy to production (canary if available) — only after the approval above
- [ ] Monitor error rates and latency for 15 min
- [ ] Verify key user flows

### Post-Deploy
- [ ] Confirm metrics are nominal
- [ ] Update release notes / changelog
- [ ] Notify stakeholders
- [ ] Close related tickets

### Rollback Triggers
- Error rate exceeds [X]%
- P50 latency exceeds [X]ms
- [Critical user flow] fails
```

## Customization

Tell me about your deploy and I'll customize the checklist:
- "We use feature flags" → adds flag verification steps
- "This includes a database migration" → adds migration-specific checks
- "This is a breaking API change" → adds consumer notification steps

## Filling it in from what you have

Work from the mission workspace, the board and what the owner provided:
- If the workspace is a git repo and you have a shell, read the release diff and list of changes yourself (`git log`, `git diff`). Otherwise ask the owner or the colleague who made the change for the change list.
- CI status: check the build and test results you can see (CI config and logs in the workspace, or results the owner pastes). If you cannot see CI, mark the item as unverified rather than ticking it.
- Rollback trigger thresholds: use baselines the owner or monitoring exports provide. If none are available, propose thresholds and mark them as assumptions for the owner to confirm.

## Tips

1. **Run before every deploy** — Even routine ones. Checklists prevent "I forgot to..."
2. **Customize once, reuse** — Keep the customized checklist in the workspace so the next deploy starts from it.
3. **Include rollback criteria** — Decide when to roll back before you deploy, not during.
4. **Never tick what you did not check** — An unverified item stays unticked with a note; use the `verification-before-completion` skill before reporting the deploy done.
