---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-06-09T09:46:54.035Z
decision-required: false
---

# Scrooge — CEO decision record: D-BA-RETURNS-P1-SOURCING-CLOSEOUT, 2026-06-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-BA-RETURNS-P1-SOURCING-CLOSEOUT`
- **Title:** WS-BA-RETURNS-P1-SOURCING close-out: merge Phases 3-4, follow-on the two substrate gaps
- **Action:** approve
- **Outcome:** Approved. Merge #1119 (BA 320 IRS IR ladder) and #1120 (BA 110 off-balance-sheet) as-is — both correct and defensive. Record follow-on workstream WS-BA-RETURNS-IRS-FAMILY-RECONCILE for (a) two-IRS-families reconciliation (dv01ByTenorBucket landed on dormant IrdSwapPositionRevalued; live engine emits IrsPositionRevalued scalar dv01) and (b) BA_110 LCR-symbol rename to BA_300. Dispatched on request.
- **Actor:** `marc@tgv.co.za`
- **Comment:** BA 320 IRS DV01 path documented as substrate gap until family reconciliation lands; Phase 3 surfaces live swaps as gaps rather than fabricating. Helena CRO DV01 methodology calibration remains advisory follow-on.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
