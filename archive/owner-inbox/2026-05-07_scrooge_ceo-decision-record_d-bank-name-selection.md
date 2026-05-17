---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-05-07T13:34:39.660Z
decision-required: false
---

# Scrooge — CEO decision record: D-BANK-NAME-SELECTION, 2026-05-07

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-BANK-NAME-SELECTION`
- **Title:** Bank name — selection from Linnea inaugural shortlist
- **Action:** request-revision
- **Outcome:** WITHDRAWN. Cadens was Linnea's recommendation; Scrooge defaulted to it without the CEO's explicit pick and emitted the resolved CeoDecision in error. Decision returned to open. Marc to choose explicitly from Linnea's shortlist (Cadens, Ortus, Perigee) or send back for additional candidates / different positioning.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Correction emitted because Scrooge defaulted to Linnea's recommendation rather than waiting for explicit CEO choice. Per A0 freeze §6 latest-wins-per-key folding rule, this event supersedes the prior approval.
- **Source proposal:** `Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md`

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
