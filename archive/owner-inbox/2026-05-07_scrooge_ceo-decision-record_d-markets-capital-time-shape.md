---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-05-07T13:51:16.781Z
decision-required: false
---

# Scrooge — CEO decision record: D-MARKETS-CAPITAL-TIME-SHAPE, 2026-05-07

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-MARKETS-CAPITAL-TIME-SHAPE`
- **Title:** Markets franchise design — proposal
- **Action:** request-revision
- **Outcome:** CORRECTION: the prior request-revision event on this decision (event_id d935e2bc-bb24-4b45-aac3-ac66014385e1) was a smoke-test of the dashboard form against /api/decide and was incorrectly attributed to marc@tgv.co.za. It was Scrooge's smoke test, not a CEO decision. This event supersedes via latest-wins-per-key. The decision remains genuinely open — Saskia's §8 (capital time-shape) awaits Marc's actual call.
- **Actor:** `agent:scrooge`
- **Comment:** Audit-trail correction. The dashboard's hardcoded actor="marc@tgv.co.za" needs an identity seam (deferred substrate work).

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
