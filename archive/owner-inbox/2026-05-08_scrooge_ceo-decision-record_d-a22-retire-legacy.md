---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-05-08T08:29:30.046Z
decision-required: false
---

# Scrooge — CEO decision record: D-A22-RETIRE-LEGACY, 2026-05-08

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-A22-RETIRE-LEGACY`
- **Title:** A2.2 retire-legacy dispatcher cutover
- **Action:** approve
- **Outcome:** Phase 1 (bus-canonical, legacy-shadow) authorised. Phase 2 (legacy retire) and Phase 3 (observe) remain downstream — re-confirm at each phase per the gating criteria.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Approved 2026-05-08 EOD as part of round 8 → round 9 sequencing.
- **Source proposal:** `Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md`

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
