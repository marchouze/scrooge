---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-06-09T11:02:48.762Z
decision-required: false
---

# Scrooge — CEO decision record: D-BA-RETURNS-FOLLOWON-BATCH, 2026-06-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-BA-RETURNS-FOLLOWON-BATCH`
- **Title:** BA-returns audit follow-on batch: BA 400/200/100/210 events-first, DV01 review, BA_110 rename
- **Action:** approve
- **Outcome:** Approved. Dispatch the remaining lower-severity BA-return audit items: (1) BA 400 op-risk events-first fold via baselBusinessLine; (2) BA 200 credit-risk ECL/staging events + events-first generator; (3) BA 100 counterparty-sector decomposition; (4) BA 210 large-exposures generator; (5) BA_110 LCR->BA_300 symbol rename; (6) Helena CRO advisory DV01-bucketing methodology calibration review. Wave 1 (1-3 + 6) parallel; Wave 2 (4-5) after to avoid index.ts collision.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Completes the BA-return data-source audit remediation. All build-phase; current products only.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
