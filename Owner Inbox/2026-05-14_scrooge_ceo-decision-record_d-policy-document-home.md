---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-05-14T17:11:29.629Z
decision-required: false
---

# Scrooge — CEO decision record: D-POLICY-DOCUMENT-HOME, 2026-05-14

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-POLICY-DOCUMENT-HOME`
- **Title:** Canonical home for policy documents
- **Action:** approve
- **Outcome:** Option C (Hybrid) approved: Policies/ directory with automated DocumentRegistered event emission on commit; existing 10 policies migrated with backfill events; Owner Inbox/ retired for policy authoring.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Marc approved Option C in-session 2026-05-14.
- **Source proposal:** `Owner Inbox/2026-05-12_owen_policy-document-home-decision.md`

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
