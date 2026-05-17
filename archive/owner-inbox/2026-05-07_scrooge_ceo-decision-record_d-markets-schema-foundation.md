---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-05-07T13:53:44.555Z
decision-required: false
---

# Scrooge — CEO decision record: D-MARKETS-SCHEMA-FOUNDATION, 2026-05-07

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-MARKETS-SCHEMA-FOUNDATION`
- **Title:** Global markets — ISDA CDM canonical schema foundation + M1–M5 build sequence
- **Action:** approve
- **Outcome:** Approved as drafted. ISDA CDM adopted as the canonical schema foundation for the trading system. Build sequence M1 (CDM core + JSE-listed equities) → M2 (JSE-listed bonds + corporate-action lifecycle) → M3 (OTC IRS + ISDA/CSA documentation) → M4 (collateral + variation-margin + IM substrate) → M5 (FRTB-ready risk + structured-product composition). M6/M7 deferred to franchise-pull; M8 deferred to post-licence.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Approval authorises Kai + Atlas + Anya to begin M1. Cross-persona dependencies in §11 (Bea IFRS classification, Imani clause library, Mira regulator URNs, Senna+Rashida threat model at M1 design freeze) are in-scope for the M1 envelope.
- **Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md`
- **Follow-on routes recorded:** `agent:atlas:m1-substrate-sequencing`, `agent:kai:m1-cdm-typescript-bindings`, `agent:anya:m1-projection-runtime-mapping`, `agent:imani:m3-isda-csa-clause-library`, `agent:bea:m1-ifrs-classification-rules`, `agent:mira:m1-regulator-citation-urns`, `agent:senna:m1-trading-stack-threat-model`

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
