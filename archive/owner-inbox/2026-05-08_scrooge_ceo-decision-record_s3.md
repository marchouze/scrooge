---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-05-08T12:15:43.261Z
decision-required: false
---

# Scrooge — CEO decision record: S3, 2026-05-08

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `S3`
- **Title:** Thin human layer at licence-day — composition and timing
- **Action:** modify
- **Outcome:** Approved with modifications. Direction: minimum possible humans — collapse toward the smallest layer SA law actually mandates; resist any expansion beyond the mandated minimum.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Minimum possible
- **Source proposal:** `Owner Inbox/2026-05-06_governance-framework.md`
- **Follow-on routes recorded:** `agent:Owen — re-scope thin-human-layer composition under the 'minimum possible' constraint; identify the smallest legally-mandated layer (Banks Act + Companies Act + FIC + POPIA + FAIS) and the seats Marc can plausibly retain interim`, `agent:Imani — provide legal-as-code reading of the absolute statutory minimum (separate-IO test under POPIA s.56; separate-MLRO test under FIC s.43A/B; separate-auditor test under Companies Act s.90 + Banks Act); flag any seats SARB precedent treats as non-merge-able even where the statute is silent`, `agent:Mira — confirm FIC compliance officer + MLRO concentration risk and SARB Prudential Authority precedent on the minimum`, `agent:Zara — confirm CCO/MLRO posture under the minimum-possible framing`

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
