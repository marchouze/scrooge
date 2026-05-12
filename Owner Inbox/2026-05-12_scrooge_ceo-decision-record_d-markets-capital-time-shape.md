---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-12T09:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-MARKETS-CAPITAL-TIME-SHAPE, 2026-05-12

Audit record of Marc's (CEO) approval of the `D-MARKETS-CAPITAL-TIME-SHAPE` capital time-shape decision on 2026-05-12. This supersedes the prior `request-revision` corrective event (2026-05-11T08:00:00.000Z) via latest-wins-per-key in `reduceCeoDecisions`. The canonical authority is the `CeoDecision` event produced from this record by the boot-time backfill (`runtime/decisions/backfill-from-records.ts`); this markdown is the human-readable mirror.

- **Decision ID:** `D-MARKETS-CAPITAL-TIME-SHAPE`
- **Title:** Markets franchise design — capital time-shape (Saskia §8)
- **Action:** approve
- **Outcome:** CEO approved the capital time-shape as proposed by Saskia (Head of Markets, trading): R150m trading-book capital (Standardised Approach), ~R125m liquidity buffer / ILAAP, R5m build CapEx envelope (AI-driven posture — no dealing-room buildout). Working split per Saskia §6.1 governs; Camille (CFO, finance) / Eitan (Treasurer, treasury) to shape the capital plan; Helena (Chief Risk Officer, governance) to challenge through the paper ICAAP / ILAAP run. See `Owner Inbox/2026-05-12_camille_capital-plan-d-markets-capital-time-shape.md` for Camille's capital plan deliverable.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** Approval confirmed 2026-05-12. Saskia's franchise-design proposal (§6.1) updated to reflect approved figures. Camille's capital plan dispatched under this authority. Supersedes the corrective `request-revision` event (event_id `evt-2026-05-11-d-markets-capital-time-shape-correction`) which was an audit-trail correction of a smoke-test — the decision itself was always genuine.

## Context

The prior event history for this decision ID:

1. `2026-05-07T13:51:16.781Z` — smoke-test `request-revision` event (event_id `d935e2bc-bb24-4b45-aac3-ac66014385e1`), incorrectly attributed to `marc@tgv.co.za` via the hardcoded actor seam in `dashboard/server.ts`. **Not a real CEO decision.**
2. `2026-05-11T08:00:00.000Z` — corrective `request-revision` event (event_id `evt-2026-05-11-d-markets-capital-time-shape-correction`), attributed to `agent:scrooge`. Explicitly marked the decision as genuinely open and superseded the smoke-test. **Correct audit-trail correction; decision remained open.**
3. `2026-05-12T09:00:00.000Z` — this event (from this record). Marc's actual `approve` call. **The canonical approval event.**

## Follow-on routes

- Saskia (Head of Markets, trading) — §6.1 capital table updated in franchise-design proposal. CapEx overrun flag (`D-MARKETS-CAPEX-OVERRUN-REVIEW`) raised for CEO review: prior R45m estimate vs R5m approved envelope.
- Camille (CFO, finance) — capital plan produced at `Owner Inbox/2026-05-12_camille_capital-plan-d-markets-capital-time-shape.md`.
- Helena (Chief Risk Officer, governance) — ICAAP RWA sizing; use R150m trading-book backing + ~R125m ILAAP buffer as approved inputs.
- Eitan (Treasurer, treasury) — funding strategy calibration against approved capital envelope.

## Provenance

Emitted via `synthesizeCeoDecisionsFromRecords` boot-time backfill (`runtime/decisions/backfill-from-records.ts`). The `CeoDecision` event is the canonical record (Principle 1); this markdown is the human-readable mirror. Citations: `GOV-FRAMEWORK-CEO-RESERVED`, `COMPANIES-ACT-71-2008`.

— Scrooge (Chief of Staff / Orchestrator)
