---
title: "Slice 5 — Pre-Trade Risk Controls + Correspondent-Routing Layer"
date: 2026-05-13
author: Scrooge (Chief of Staff)
addressees:
  - Kai (FX/markets engineer, engineering)
  - Helena (Chief Risk Officer, governance)
  - Tomas (payments/settlement engineer, engineering)
  - Rohan (risk engineer, engineering)
status: DISPATCHED
brief-type: work-slice
parent-decision: D-MARKETS-SCHEMA-FOUNDATION
regulatory-baseline:
  - ORG-JSE-IRC-01 (Domain J — JSE IRC Rules)
  - ORG-JSE-IRC-02 (Domain J — JSE Debt Listings Requirements)
  - ORG-JSE-IRC-03 (Domain J — JSE Clear CCP Rules)
  - ORG-PR-19 (Market risk limits)
  - ORG-PR-20 (Trading mandate limits)
  - ORG-PR-48 (GN 5/2013 FX settlement risk)
---

# Slice 5 — Pre-Trade Risk Controls + Correspondent-Routing Layer

**Dispatched by:** Scrooge (Chief of Staff)
**Date:** 2026-05-13
**Addressees:** Kai (FX/markets engineer, engineering); Helena (Chief Risk Officer, governance); Tomas (payments/settlement engineer, engineering); Rohan (risk engineer, engineering)
**Parent decision:** D-MARKETS-SCHEMA-FOUNDATION
**Status:** DISPATCHED

---

## 1. Context and purpose

Slice 5 closes the loop between trade execution (Slices 1–4, already built) and real-time risk visibility. Three outcomes are required before commencement-of-trading:

1. **Pre-trade gateway** must emit `OrderRejected` events (with limit code + utilisation %) when a trade breaches a RAS limit
2. **Limit-utilisation projection** must aggregate live positions against RAS B1–B5 limits into a per-cluster utilisation feed
3. **Correspondent-routing projection** must surface which correspondent bank / settlement scheme handles each currency + instrument pair

These three outputs directly power the three risk-officer dashboard tiles that Helena (Chief Risk Officer, governance) needs to manage the bank's risk posture in real time. Without this slice, the pre-trade control layer is silent on limit breaches and Helena has no live view of utilisation or settlement routing — both of which are required by the Domain J obligations and the bank's own RAS.

---

## 2. Regulatory baseline

| Reference | Instrument | Obligation |
|-----------|-----------|-----------|
| ORG-JSE-IRC-01 | JSE IRC Rules (Domain J) | Pre-trade controls must satisfy JSE IRC order-submission and position-limit requirements; `OrderRejected` events feed the compliance trail |
| ORG-JSE-IRC-02 | JSE Debt Listings Requirements (Domain J) | Debt instrument position limits apply at pre-trade; gateway must enforce and record breaches |
| ORG-JSE-IRC-03 | JSE Clear CCP Rules (Domain J) | CCP-eligible trades require pre-trade CCP eligibility check; routing to CLS or BankservAfrica depends on instrument and currency |
| ORG-PR-19 | Regulation 19 — Market risk limits | Pre-trade gateway enforces limits set in the RAS / Trading Mandate; breach events must be timestamped and attributed to the triggering cluster |
| ORG-PR-20 | Regulation 20 — Trading mandate limits | Mandate limits per desk / asset class enforced at pre-trade; `limitCode` must encode the mandate cluster |
| ORG-PR-48 | GN 5/2013 FX Settlement Risk | Herstatt-risk management; correspondent routing must be visible to Helena; non-CLS pairs must be flagged for bilateral settlement risk |

---

## 3. Work items by agent

### Kai (FX/markets engineer, engineering) — pre-trade gateway: rejection event emission

- Extend `@platform/markets/pre-trade-gateway` to emit `OrderRejected` as a typed event on every limit breach
- Event payload:
  ```typescript
  {
    orderId: string;
    instrumentId: string;
    asset: string;
    notional: number;
    currency: string;        // ISO 4217
    limitCode: string;       // e.g. 'B3-MKT-NOTIONAL-FX'
    utilisationAtRejection: number;   // 0.0–1.0
    riskCluster: 'B1' | 'B2' | 'B3' | 'B4' | 'B5';
    timestamp: string;       // ISO 8601
  }
  ```
- `limitCode` must reference the RAS cluster (B1–B5) and the specific limit breached (e.g. `B3-MKT-NOTIONAL-FX`)
- Provenance: `kind: 'production'`, `sourceLineage: 'agent-runtime:kai'`
- Register `OrderRejected` in the event-type registry with a retention policy of 7 years
- Wire the event into the JSE IRC market-participant rule compliance trail (ORG-JSE-IRC-01)
- Expose `OrderRejected` events via `/api/rejections` (last 24 h replay, consumed by Dashboard Tile 2)

### Helena (Chief Risk Officer, governance) — RAS limit schedule + dashboard tile sign-off

- Publish the formal RAS limit schedule as a typed event `RasLimitSchedulePublished` with the B1–B5 limit values and breach thresholds
- Review and approve the `LimitUtilisationProjection` output format (Rohan builds; Helena is the governance sign-off)
- Sign off the three risk-officer dashboard tiles before the commencement-of-trading gate by emitting `RiskOfficerViewApproved`
- Helena's `RasLimitSchedulePublished` event is the authoritative input to Rohan's projection — the projection must read from this event, not from a static config file

### Rohan (risk engineer, engineering) — limit utilisation projection (co-owner with Helena)

- Build `LimitUtilisationProjection` that reduces `TradeExecuted` + `PositionUpdated` + `OrderRejected` events against the `RasLimitSchedulePublished` event into per-cluster utilisation % per entity
- Projection output shape:
  ```typescript
  {
    cluster: 'B1' | 'B2' | 'B3' | 'B4' | 'B5';
    utilisationPct: number;       // 0.0–1.0
    limitValue: number;
    currentExposure: number;
    ragStatus: 'green' | 'amber' | 'red';
    asOf: string;                 // ISO 8601
  }
  ```
- RAG thresholds: green < 0.70, amber 0.70–0.90, red > 0.90
- Feed `/api/state` → `limitUtilisations` map (already consumed by `risk.js`)
- Register `LimitUtilisationProjection` in the platform projections registry alongside the existing `PositionProjection`

### Tomas (payments/settlement engineer, engineering) — correspondent-routing projection

- Build `CorrespondentRoutingProjection` that reduces `SettlementInstructionRouted` events into a live routing table: currency → correspondent bank → scheme (SWIFT / SAMOS / CLS / BankservAfrica)
- Seed with the static correspondent matrix from the bank's nostro account structure (synthetic until live correspondent-onboarding)
- Expose via `/api/correspondent-routing` endpoint
- Surface the GN 5/2013 FX settlement risk management requirement (ORG-PR-48): the routing table must flag any currency pair where CLS access is not available and fallback to bilateral settlement applies (Herstatt-risk classification)
- Register `CorrespondentRoutingProjection` in the platform projections registry
- Note: `strate-connector` and `cls-connector` remain planned infrastructure; Tomas seeds with synthetic routing data until live participant-onboarding

---

## 4. Dashboard tiles specification (`risk.html`)

These three tiles are the primary output visible to Helena (Chief Risk Officer, governance) and to Marc (CEO) during the pre-licence readiness review.

### Tile 1 — RAS utilisation bar chart

- Shows B1–B5 clusters, each as a horizontal bar: current exposure / limit = utilisation %
- Colour coding: green < 70%, amber 70–90%, red > 90%
- Data source: `/api/state` → `limitUtilisations`
- Refreshes on the existing dashboard polling interval
- Each bar shows: cluster label | current exposure (formatted) | limit (formatted) | % utilisation

### Tile 2 — Rejection feed

- Scrolling feed of the last 50 `OrderRejected` events
- Columns: time | instrument | notional | limit breached | utilisation at rejection
- Data source: `/api/rejections` (new endpoint — replays last 24 h of `OrderRejected` events from the event store)
- Empty state: "No rejections in the last 24 hours"

### Tile 3 — Correspondent-routing tile

- Table: currency | correspondent bank | scheme | Herstatt-risk flag | CLS eligible?
- Data source: `/api/correspondent-routing`
- Flag any non-CLS-eligible pair in amber
- Herstatt-risk flag renders as a warning icon for bilateral-settlement pairs
- Helena uses this table to satisfy the ORG-PR-48 visibility requirement

---

## 5. Definition of done

- [ ] `OrderRejected` event type registered + emitted by pre-trade gateway (Kai)
- [ ] `RasLimitSchedulePublished` event emitted by Helena (or Scrooge on Helena's behalf under session-delegation)
- [ ] `LimitUtilisationProjection` live + feeding `/api/state` (Rohan)
- [ ] `CorrespondentRoutingProjection` live + `/api/correspondent-routing` endpoint (Tomas)
- [ ] `risk.html` updated with all three tiles (Atlas + Noa)
- [ ] `bun run ci` passes with new event types registered
- [ ] Domain J obligations (ORG-JSE-IRC-01..03) linked from trading-mandate and market-risk-policy
- [ ] Helena sign-off event (`RiskOfficerViewApproved`) emitted before commencement-of-trading gate

---

## 6. Substrate gaps recorded

The following gaps are surfaced by this slice and are roadmap items:

1. **`CorrespondentRoutingProjection` type** — not yet in the platform projections registry; Tomas registers it as part of this slice
2. **`LimitUtilisationProjection` type** — not yet in the platform projections registry; Rohan registers it alongside the existing `PositionProjection`
3. **`strate-connector` + `cls-connector`** — remain planned until live participant-onboarding; Tomas seeds with synthetic routing data in this slice
4. **Helena's `RasLimitSchedulePublished` authoring** — until Helena's agent substrate supports autonomous event emission, Scrooge emits on Helena's behalf under session-delegation (actor: `marc@tgv.co.za`, recordedVia: `scrooge:session-delegation`)
5. **`/api/rejections` endpoint** — new endpoint required; not present in current `routes.ts`; Kai owns

---

*Dispatched under D-MARKETS-SCHEMA-FOUNDATION (CEO-approved). No new CEO decision required. Downstream work proceeds under the no-pause rule (CLAUDE.md §Dispatch discipline).*
