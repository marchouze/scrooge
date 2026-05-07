---
agent: Scrooge
trigger: follow-on-router
asOf: 2026-05-07T13:53:44.613Z
decision-required: false
---

# Scrooge — follow-on routing, 2026-05-07

Audit record of follow-on routes dispatched after CEO decision approvals. Each decision below names the routes declared in its CeoDecision payload and the dispatch outcome.

## D-MARKETS-SCHEMA-FOUNDATION

| Route | Status | Detail |
|---|---|---|
| `agent:atlas:m1-substrate-sequencing` | unresolved | No runtime handler registered for atlas:m1-substrate-sequencing. Substrate gap: target needs to become a registered handler before auto-fire. |
| `agent:kai:m1-cdm-typescript-bindings` | unresolved | No runtime handler registered for kai:m1-cdm-typescript-bindings. Substrate gap: target needs to become a registered handler before auto-fire. |
| `agent:anya:m1-projection-runtime-mapping` | unresolved | No runtime handler registered for anya:m1-projection-runtime-mapping. Substrate gap: target needs to become a registered handler before auto-fire. |
| `agent:imani:m3-isda-csa-clause-library` | unresolved | No runtime handler registered for imani:m3-isda-csa-clause-library. Substrate gap: target needs to become a registered handler before auto-fire. |
| `agent:bea:m1-ifrs-classification-rules` | unresolved | No runtime handler registered for bea:m1-ifrs-classification-rules. Substrate gap: target needs to become a registered handler before auto-fire. |
| `agent:mira:m1-regulator-citation-urns` | unresolved | No runtime handler registered for mira:m1-regulator-citation-urns. Substrate gap: target needs to become a registered handler before auto-fire. |
| `agent:senna:m1-trading-stack-threat-model` | unresolved | No runtime handler registered for senna:m1-trading-stack-threat-model. Substrate gap: target needs to become a registered handler before auto-fire. |

## Provenance

Triggered event-driven from CeoDecision events appended in the parent run. Routes dispatched via the canonical handler map at `runtime/handler-callables.ts`. Unresolved routes surface as AgentEscalation events for substrate-gap visibility.
