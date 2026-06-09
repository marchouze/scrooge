---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-06-09T10:42:06.495Z
decision-required: false
---

# Scrooge — CEO decision record: D-IRS-HISTORICAL-GL-BACKFILL, 2026-06-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-IRS-HISTORICAL-GL-BACKFILL`
- **Title:** Backfill historical IRS book into GL
- **Action:** approve
- **Outcome:** Approved. After #1121 merges, emit additive IrdSwap* accounting events corresponding to the 6 pre-cutover Irs* events (1 IrsTradeBooked + 5 IrsPositionRevalued) so the historical IRS book posts to the GL. Additive only — no existing event mutated or deleted (Principle 1).
- **Actor:** `marc@tgv.co.za`
- **Comment:** Extends D-IRS-FAMILY-CONVERGE-ACCOUNTING. Brings the historical IRS NPV asset/liability + unrealised P&L into the ledger rather than starting from cutover.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
