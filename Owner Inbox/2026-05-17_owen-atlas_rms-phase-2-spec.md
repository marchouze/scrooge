---
title: "RMS Phase 2 — Mandatory AgentBriefIssued Dispatch"
date: 2026-05-17
authors:
  - name: Owen
    position: Company Secretary, governance
  - name: Atlas
    position: Core banking platform architect, engineering
status: APPROVED
decision: D-RMS-PHASE-2
approved-by: CEO (marc@tgv.co.za)
approved-date: 2026-05-17
effective: immediate
accelerated-by: D-RMS-PHASE-2-3-ACCELERATE
cites:
  - D-RMS-PHASE-1
  - D-RMS-PHASE-2
  - D-RMS-PHASE-2-3-ACCELERATE
  - D-RMS-PHASE-2-4-AUTHORSHIP
decision-required: false
---

# RMS Phase 2 — Mandatory AgentBriefIssued Dispatch

## 1. Status

**APPROVED** — Decision `D-RMS-PHASE-2`, CEO-approved 2026-05-17.

One-agent-week soak period waived per `D-RMS-PHASE-2-3-ACCELERATE` (CEO-approved in-session 2026-05-17).
Phase 2 is **effective immediately** on approval.

## 2. Purpose

Phase 1 (`D-RMS-PHASE-1`, 2026-05-09) delivered the event substrate: seven typed event kinds,
a content-addressed document store, seven projection-derived registers, and the Briefs / Dispatches
register. Phase 2 activates the mandate: every agent dispatch must be preceded by an
`AgentBriefIssued` event. Team Inbox markdown becomes a *derived render* of that event, not the
canonical artefact.

This closes the first leg of the events-first authoring rule (CLAUDE.md §"Events-first authoring"):
markdown-without-event is a Principle 1 violation, reportable by Vera.

## 3. Scope

Phase 2 governs all **agent dispatches** — every `Agent(...)` call that Scrooge coordinates.

- Every dispatch must be preceded by an `AgentBriefIssued` event emitted by Scrooge.
- The `briefId` returned by `dispatch:open-brief` must be threaded through to `dispatch:start-run`
  and `dispatch:close-run` so the full lifecycle is captured in the Briefs / Dispatches register.
- Team Inbox markdown files written after Phase 2 activation are *derived renders* of brief events;
  the event is canonical (Principle 1).
- Pre-Phase-2 Team Inbox files (before 2026-05-17) are **historical** — expected to have no
  matching `AgentBriefIssued` event; treated as `warn`, not `fail`, by the recon gate.

## 4. How it works — dispatch sequence

Scrooge runs the following sequence for every agent dispatch:

```
# Step 1 — emit AgentBriefIssued; capture briefId
cd prototype/
BRIEF_ID=$(bun run dispatch:open-brief \
  --to-name   <agent-name> \
  --to-position "<agent-position>" \
  --title     "<brief title>" \
  --workstream <workstream-id> \
  --priority  now|next-tick|scheduled \
  --body      <path/to/brief.md> \
  --cite      <decision-urn> \
  --expected  "<kind:description>" \
)

# Step 2 — fire agent (passing briefId in prompt / worktree context)
Agent(...)  # briefId surfaced in prompt

# Step 3 — on agent start (or Scrooge-coordinated in-session start)
bun run dispatch:start-run \
  --brief         $BRIEF_ID \
  --agent-name    <agent-name> \
  --agent-position "<agent-position>" \
  --substrate     agent-runtime|scrooge-coordinated-in-session

# Step 4 — on agent close
bun run dispatch:close-run \
  --run           <runId> \
  --brief         $BRIEF_ID \
  --agent-name    <agent-name> \
  --agent-position "<agent-position>" \
  --outcome       delivered|blocked|withdrawn \
  --deliverable   <pr-files>
```

The Team Inbox markdown brief (optional, during Phase 2 dual-render) is written by Scrooge
alongside the event. Phase 4 retires the markdown; the register view is sole canonical.

## 5. Acceptance criterion

Phase 2 is accepted when:

1. Every new dispatch from 2026-05-17 onward has a matching `AgentBriefIssued` event in the
   event store.
2. The `recon:rms-briefs-parity` gate (§6) passes in CI — zero `fail`-severity violations.
3. The Briefs / Dispatches register view (`/briefs` dashboard route) reflects all in-flight
   and delivered dispatches from Phase 2 activation onward.

## 6. Recon gate — `recon:rms-briefs-parity`

A continuous-controls pipeline at `prototype/platform/recon/rms-briefs-parity.ts`:

- **Pre-Phase-2 files (before 2026-05-17):** no matching `AgentBriefIssued` event →
  `warn` severity (historical; expected gap).
- **Post-Phase-2 files (2026-05-17 or later):** no matching `AgentBriefIssued` event →
  `fail` severity (Principle 1 violation; mandatory remediation).
- **Pass condition:** zero `fail` violations.

The pipeline is wired into `bun run recon:rms-briefs-parity` and included in `bun run ci`.

## 7. S8 A2 dependency — per-agent auto-subscription

The full autonomous substrate (S8 A2) will add per-agent auto-subscription: each agent
automatically emits `AgentBriefIssued` from its own run initiation, without Scrooge
coordinating. Until A2 lands:

- Current substrate = **Scrooge-coordinated**: Scrooge emits the event before firing the agent.
- This is a roadmap gap, not a Phase 2 blocker. Scrooge-coordinated dispatch satisfies Phase 2.

Substrate gap recorded in Atlas §16 (roadmap).

## 8. Vera enforcement

Vera (Internal audit engineer, engineering) enforces Phase 2 compliance:

- A Team Inbox file created after 2026-05-17 without a matching `AgentBriefIssued` event is a
  **Vera finding** (Principle 1 violation).
- Vera checks this via the `recon:rms-briefs-parity` pipeline on every overnight recon run.
- First violation after Phase 2 activation → immediate brief to Owen (Company Secretary,
  governance) for remediation tracking.

## 9. Transition from Phase 0 / Phase 1

| Phase | Team Inbox status | Event requirement |
|-------|-------------------|-------------------|
| 0     | Canonical artefact | None (pre-substrate) |
| 1     | Canonical + events dual-write (started) | Optional backfill |
| 2 ✅  | Derived render | Mandatory for new dispatches |
| 4     | Retired to `archive/` | Register view is sole canonical |

## 10. Citations

- `D-RMS-PHASE-1` — Phase 1 substrate approved 2026-05-09
- `D-RMS-PHASE-2` — Phase 2 approved 2026-05-17
- `D-RMS-PHASE-2-3-ACCELERATE` — soak period waived 2026-05-17
- `D-RMS-PHASE-2-4-AUTHORSHIP` — spec authorship brief (this delivery closes it partially)
