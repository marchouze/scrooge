---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-06-09T09:23:59.310Z
decision-required: false
---

# Scrooge — CEO decision record: D-BA-RETURNS-P1-SOURCING-WORKSTREAM, 2026-06-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-BA-RETURNS-P1-SOURCING-WORKSTREAM`
- **Title:** WS-BA-RETURNS-P1-SOURCING: merge Phases 1-2, dispatch Phases 3-4
- **Action:** approve
- **Outcome:** Approved. Merge #1118 (event schema granularity) then #1117 (BA 300 LCR/NSFR events-first); dispatch Phase 3 (BA 320 IRS IR-sensitivity) and Phase 4 (BA 110 off-balance-sheet) against merged schemas.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Follows CEO-approved BA return data-source audit 2026-06-09. Principle 1: all BA return inputs trace to typed events. Build-phase engineering/schema decision per decision-authority routing (CEO build-phase).

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
