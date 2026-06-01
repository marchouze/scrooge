---
agent: Saskia
trigger: markets-readiness-snapshot
asOf: 2026-06-01T05:33:34.202Z
decision-required: false
---

# Saskia — markets-readiness snapshot, 2026-06-01

Autonomous run of Saskia's weekly markets-readiness snapshot per `Team/Saskia.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Tenth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 37 Saskia-owned obligations on the register (0 IN FORCE; 0 IN FLIGHT; 4 PARTIAL; 17 PLANNED; 0 PRE-LICENCE) · markets bench 7/1 handlers (Kai pending) · 0 trades booked · M1 decision / design pending, CDM module scaffolded.

## Saskia-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 0 |
| IN FLIGHT | 0 |
| PARTIAL | 4 |
| PLANNED | 17 |
| DRAFTING | 2 |
| PRE-LICENCE | 0 |
| N/A-yet | 0 |
| **Total** | **37** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Saskia (or where Saskia is named anywhere on the row), including Domain M (OTC Derivative Provider) entries added 2026-05-07. Counts are coarse — refines once the obligations register exposes a structured per-row API._

## Markets bench

| Seat | Runtime handlers | Keys |
|---|---|---|
| Kai | 7 | `kai:m1-cdm-typescript-bindings`, `kai:pre-trade-gateway-aggregator`, `kai:identity-gateway-check`, `kai:suitability-gateway-check`, `kai:credit-capital-funding-check`, `kai:goal-loop`, `kai:event-triage` |

## Markets-domain events (last 7 days)

| Event | Count |
|---|---|
| `TradeBooked` | 0 |
| `PositionAdjusted` | 0 |
| `MarketDataIngested` | 0 |
| `MarketSurveillanceAlert` | 0 |
| `LimitOverrideRequested` | 0 |
| `DealerMandateBreach` | 0 |
| `IssuerInclusionListRefreshed` | 0 |
| `CounterpartyEvent` | 0 |

_Build-phase posture: zero trades, zero positions, zero surveillance alerts. Kai's OMS / EMS, Anya's position projection, and Mira's surveillance pipelines emit these types — none yet built. Live event flow activates at commencement of trading per the build-phase model._

## M1 markets-schema-foundation readiness

| Item | State |
|---|---|
| `D-MARKETS-SCHEMA-FOUNDATION` decision recorded | **no — substrate gap** |
| Franchise-design proposal in Owner Inbox | yes |
| Kai M1 CDM-bindings deliverable in Owner Inbox | yes |
| `@platform/markets/cdm` module scaffolded | yes |
| Last M1 / CDM `WorkstreamRegistered` event | **never — substrate gap** |

## Substrate gaps surfaced this run

- **Kai runtime handler** — markets bench has zero typed-event producers today. Kai's first handler should snapshot OMS / EMS substrate state, CDM-bindings progress, and the typed-event surface produced by the desk. Required pre-M1 cutover.
- **`@platform/markets/cdm` module** — TypeScript bindings + Zod validators authorised under D-MARKETS-SCHEMA-FOUNDATION but not yet scaffolded under `prototype/platform/markets/cdm/`. Required pre-M2 (listed bonds + repo).
- **OMS / EMS substrate (Kai)** — booking-and-state queries are point-in-time; trade lifecycle event types (`TradeBooked`, `PositionAdjusted`, `MarketDataIngested`) registered but no producer.
- **Surveillance substrate (Mira + Saskia)** — voice / e-comms ingest pipelines partial; insider-list register pending. Required pre-licence for FMA Ch. X market-abuse posture.
- **Position / risk projection (Anya / Rohan)** — under build; needed before dealer-mandate breach detection can run end-to-end.
- **Counterparty / negotiations-in-principle workspace (Imani + Atlas)** — partial; load-bearing for ISDA / GMRA / GMSLA onboarding under Domain M.
- **Strate / JSE connectivity (Tomas + Kai + Atlas)** — not yet established. Required before licence-day trading.
- **Pre-licence go-live readiness gate (Saskia + Rashida + Devon)** — three-signature substrate under build; gate-state event-type pending.
- **Institutional-markets-sales engineering counterpart** — vacant; flagged for PAX / Nolan as the franchise's needs concretise.

## Saskia's narrative

Markets substrate is pre-commencement and not yet decision-locked: of 37 obligations on my mandate, zero are IN FORCE, four sit at PARTIAL and seventeen at PLANNED, and the markets-domain event tape is empty across all eight types over the last seven days — which is what build phase should look like. The M1 markets-schema-foundation has a franchise-design proposal and a scaffolded `@platform/markets/cdm` module, Kai has the M1 CDM-bindings deliverable on his bench, but **D-MARKETS-SCHEMA-FOUNDATION is not recorded and the workstream has never emitted a registered event**. That puts Kai's M1 CDM-bindings work squarely on the critical path to commencement of trading — no ISDA CDM 2026 primitive registry means no typed `TradeBooked` envelope, which means no booking model, no STP, and nothing for surveillance, best-ex evidence or counterparty-credit to hang off.

Three things are load-bearing at first trade and not yet there. **(1) Best-execution policy** under FSCA Conduct Standard 2 of 2018 is at PLANNED; without a documented venue/liquidity selection logic and post-trade evidence pipeline it cannot go live, and the evidence pipeline depends on the same CDM execution primitive Kai is building. **(2) Voice and e-comms recording and supervision** under FMA s.95 read with Conduct Standard 3 of 2018 is at PARTIAL — recording capture may exist, but lexicon-driven surveillance review and the `MarketSurveillanceAlert` handler do not, and that gap is a Banks Act 94 of 1990 s.60B fit-and-proper exposure on day one. **(3) ODP authorisation** under FMA Chapter IV is at PLANNED for Domain M; no ODP licence, no OTC derivatives franchise at commencement, full stop. On the engineering side, the missing handler that would close the typed-event loop is a `kai:trade-booking-writer` (or equivalent) that consumes the pre-trade gateway aggregator output and emits a CDM-typed `TradeBooked` — until that lands, the gateway chain terminates in air.

Next markets move, this week: (a) get D-MARKETS-SCHEMA-FOUNDATION to a recorded decision against the franchise-design proposal, and commission Kai to land the CDM-typed `TradeBooked` writer behind the pre-trade gateway so the substrate is rehearsed end-to-end on at least one rates and one equity primitive; (b) surface to the CEO the franchise-posture question of whether we commence as a cash-and-listed-derivatives shop only, deferring ODP and the Joint Standard 2 of 2020 (as amended 9 June 2023) IM/VM obligations to a Phase 2 — because if the answer is "OTC at go-live" then the ODP file, the CSA inventory, and the dealer-mandate breach ladder all need to be sequenced now; (c) schedule a working session with Imani on the best-ex policy artefact and the Conduct Standards 1–3 of 2018 evidence map, and with Mira on the voice/e-comms supervision SOP and surveillance-alert disposition workflow, both targeted to clear PARTIAL before Rashida and Devon's readiness gate.

## Provenance

Saskia-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Saskia appears in any cell, across Domain ORG-PR / ORG-CD / ORG-MK and Domain M for OTC Derivative Provider); markets-bench handler-coverage from `runtime/handlers-metadata.ts`; markets-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; M1 readiness state from filesystem presence of D-MARKETS-SCHEMA-FOUNDATION decision record, franchise-design proposal, Kai's M1 deliverable, and `@platform/markets/cdm` scaffold, plus latest `WorkstreamRegistered` event whose payload mentions M1 / CDM / markets-schema.
