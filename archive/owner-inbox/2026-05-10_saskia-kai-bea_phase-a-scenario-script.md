---
title: Phase-A FX end-to-end rehearsal — scenario script wedge (D-FIRST-DRY-RUN-SCENARIO #A4)
author: Saskia (Head of Global Markets, governance) · Kai (Trading systems engineer, engineering) · Bea (Accounting & financial reporting engineer, engineering)
date: 2026-05-10
summary: Phase-A wedge of the first dry-run scenario lands at prototype/scenarios/03-fx-end-to-end-rehearsal.ts. Emits T0–T7 (3 account-opens, 1 capital contribution, 4 counterparty-replay events, 1 RFQ, 1 pricing, 1 FxTradeExecuted) — 11 events total — each carrying the simulated/first-dry-run-2026-Q1 provenance tag. Runnable today via `bun run scenario:dry-run-fx`. Dependencies #A1 / #A2 / #A3 are scaffolded with TODO markers; the script becomes fully canonical once those merge.
decision-required: false
---

# Phase-A FX end-to-end rehearsal — scenario script wedge

**Authority.** D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10) §6 dispatch #A4.
**Parent design pack.** [`Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md`](2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md).
**Identity.** Saskia (Head of Global Markets, governance) · Kai (Trading systems engineer, engineering) · Bea (Accounting & financial reporting engineer, engineering).
**Status.** Engineering glue. No new event types. No new substrate. No new CEO decision.

---

## 1. What landed

- New scenario file `prototype/scenarios/03-fx-end-to-end-rehearsal.ts`.
- New test `prototype/tests/scenarios-fx-end-to-end.test.ts` (9 cases, all green).
- New `package.json` shortcut: `bun run scenario:dry-run-fx`.

The script implements the Phase-A choreography from pack §2.1 (T0–T7), tags every event with the typed simulated provenance envelope, and exits with a non-zero status if any event is mis-tagged.

## 2. Choreography (T0–T7)

| Step | Event type | Actor | Notes |
|---|---|---|---|
| T0 | `AccountOpened` (ZAR nostro at SimulatedBank Co.) | Tomas | Placeholder shape — see §4 #A1 TODO. |
| T1 | `AccountOpened` (USD nostro at SimulatedBank Co.) | Tomas | Same. |
| T2 | `AccountOpened` (ZAR capital account) | Tomas | Same. |
| T3 | `CapitalContributionRecorded` (R300m founder contribution) | Bea | Same. |
| T4 | Counterparty replay — `CounterpartySoundingOpened` + `CounterpartyProspectRegistered` + `KycCompleted` (Tier-1) + `MandateAssigned` | Niko + Mira + Saskia | Reuses `@domains/customer` factories (canonical from `02-onboard-counterparty.ts`). Each event re-stamped with the dry-run scenario tag. |
| T5 | `RfqRequested` (USD/ZAR spot, USD 5m, T+2) | Saskia | Placeholder until FX Slice 2 (#A3) lands. |
| T6 | `PricingModelEvaluated` (synthetic mid 18.5000, ±5pip) | service:fx-pricing-model | Same. |
| T7 | `FxTradeExecuted` (USD 5,000,000 vs ZAR 92,500,000, T+2, bookType=trading, settlementPath=correspondent) | Saskia | **Canonical**: `makeFxTradeExecuted()` from the merged M4 CDM (`@platform/markets/cdm/fx`). Zod-parses against `fxTradeExecutedPayloadSchema`. |

**Total: 11 events emitted per run.**

## 3. Provenance tag values

Every event carries:

```ts
{
  kind: 'simulated',
  scenario: 'first-dry-run-2026-Q1',
  sourceLineage: 'scenario-runner:03-fx-end-to-end-rehearsal',
}
```

`sourceLineage` matches the registered `scenario-runner:<scenario-name>` regex pattern in `prototype/platform/event-store/provenance-lineage.registry.ts` (recon-asserted by `bun run recon:provenance-lineage-registered`).

The tag is exported as `SCENARIO_PROVENANCE` from the scenario module so other consumers (Phase-B settlement, Phase-C IFRS renderer, Phase-D regulatory returns, Phase-E risk reports) can stamp downstream events with the same tag.

## 4. Dependency state at run time

| Dispatch | Substrate | Status when this PR opens | Treatment in #A4 |
|---|---|---|---|
| #A1 | `D-BANK-ACCOUNT-SUBSTRATE` (Tomas + Atlas) — `AccountOpened` / `CapitalContributionRecorded` event family + AccountMaster + AccountBalance projections | **Not yet merged.** | Local placeholder factories `makeAccountOpenedPlaceholder()` + `makeCapitalContributionPlaceholder()`. Payloads shaped per pack §2.1 so swap-in is mechanical. TODO markers reference `D-BANK-ACCOUNT-SUBSTRATE`. |
| #A2 | `D-SCENARIO-CLOCK` (Atlas) — `ScenarioClockTick` event + scenario-runner injection point | **Not yet merged.** | Local `SimulatedClock` shim — same shape (`asOf()` returning ISO UTC + `tick()` advancing by minutes/hours/days). Deterministic baseline `2026-01-05T07:00:00Z`. TODO marker references `D-SCENARIO-CLOCK`. |
| #A3 | `D-FX-SALES-TRADING-FRONTEND` Slice 2 (Kai + Saskia + Anya) — RFQ form + emit, pricer, dealer click | **Not yet merged.** | T5/T6 emit scenario-direct (no UI loop). T7 already routes through the canonical `makeFxTradeExecuted()` from M4 CDM regardless of UI shell. TODO marker references `D-FX-SALES-TRADING-FRONTEND` Slice 2. |
| Provenance | `D-DATA-PROVENANCE-SUBSTRATE` Slice 1 (Atlas) — typed `ProvenanceTag` envelope + lineage registry | **Merged.** Live and used. | `SCENARIO_PROVENANCE` constructed via `simulatedTag()`. |
| FX CDM | `D-MARKETS-SCHEMA-FOUNDATION` (Saskia + Kai) — `FxTradeExecuted` payload schema | **Merged.** Live and used. | T7 calls `makeFxTradeExecuted()` directly. |
| Counterparty replay | `02-onboard-counterparty.ts` (Niko) | **Live.** | T4 reuses the canonical `@domains/customer` factories; only re-stamps provenance. |

When #A1 / #A2 / #A3 merge, the four TODO blocks delete cleanly; the remaining shape is unchanged.

## 5. Observable output

```
emitted: 11
countsByType:
  AccountOpened: 3
  CapitalContributionRecorded: 1
  CounterpartySoundingOpened: 1
  CounterpartyProspectRegistered: 1
  KycCompleted: 1
  MandateAssigned: 1
  RfqRequested: 1
  PricingModelEvaluated: 1
  FxTradeExecuted: 1
provenance:
  kind: simulated
  scenario: first-dry-run-2026-Q1
  sourceLineage: scenario-runner:03-fx-end-to-end-rehearsal
```

By scenario / lineage: 11 events × 1 scenario × 1 source lineage. By legal entity: 11 events × 1 entity (`BANK-ZA-001` aliased as Hoz Bank in the build phase; will switch to the canonical `LE-ZA-HOZ-BANK` URN once `D-LEGAL-ENTITY-TREE-V0` populates the legal-entity registry with the typed handle).

The script wipes and recreates `.local/scenario-03-phase-a.db` per run for determinism.

## 6. Recon coverage today

- **Pack §2.6 assertion #6 (provenance discipline) — green.** Runner asserts every replayed event carries the scenario tag; exits non-zero on mismatch.
- **Pack §2.6 assertions #1–#4 (balance-sheet / sub-ledger / account-balance / position) — not yet exercised.** These require the projections from #A1 and from D-REPORTING-CAPABILITY-M2-M3 Slices 2–2.5. They land in Phase B.
- **Pack §2.6 assertions #5 + #7 (BA-325 cells / cross-reference) — out of Phase A scope.** They land in Phase D (BA-325) and Phase B (settlement → cross-reference rule fires once production-tagged events exist that could reference simulated trades).

## 7. Phase B–E next steps (downstream of this script)

1. **Phase B (settlement + period close).** Add T8–T14 emissions (SettlementInstructed → SettlementSettled → PeriodCloseInitiated → RevaluationApplied → PeriodCloseFinalised). Depends on D-REPORTING-CAPABILITY-M2-M3 Slice 2 (period-close events) + Slice 2.5 (posting-rules). Tomas + Bea co-author.
2. **Phase C (IFRS statements).** Add T15 emission. Depends on D-REPORTING-CAPABILITY-M2-M3 Slice 3 + Slice 3.5 (rehearsal-grade IFRS renderer fold-in). Bea owns.
3. **Phase D (BA-325 + BA-700).** Add T16–T18 emissions. Depends on D-REPORTING-CAPABILITY-M2-M3 Slice 4 + Slice 5. Mira owns.
4. **Phase E (risk reports).** Add T19–T21 emissions. Depends on D-REGULATORY-READINESS-W2 Slice 2 (re-scoped) + Slice 3 (RWA engine first cell). Helena + Rohan + Owen co-author.
5. **End-of-rehearsal close-out report.** Saskia + Bea + Mira + Helena co-author the one-pager per pack §5.

The script is structured so each phase appends events in-order — Phase B's emissions extend `buildPhaseAEvents()` into a `buildPhaseBEvents()` etc., and a master `runRehearsal()` invokes them sequentially with a single `SimulatedClock`.

## 8. Substrate gaps surfaced by this dispatch

- **G16 (new). Provenance-stamping ergonomics.** Domain factories under `@domains/customer` (`prospectRegistered`, `kycCompleted`, etc.) do not accept a provenance argument; the scenario script has to spread `{ ...factoryResult, provenance: SCENARIO_PROVENANCE }`. Prefer extending `MakeOpts` with optional `provenance?: ProvenanceTag` in the next touch of those factories. Atlas roadmap.
- **G17 (new). Canonical entity URN for Hoz Bank.** This script uses `BANK_ZA_001` (the legacy core-types alias) where pack §2.1 names `LE-ZA-HOZ-BANK`. The two are functionally the same in build-phase but will diverge once the legal-entity registry from `D-LEGAL-ENTITY-TREE-V0` populates a typed handle. Atlas + Imani roadmap.
- **G18 (new). FX `makeFxTradeExecuted()` does not take provenance.** Same shape as G16 — the M4 factory predates Slice 1 wiring. Spread-stamp is fine for now; cleanup at next touch of the FX CDM module.

These are non-blockers and feed the substrate-completeness budget at `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md`.

## 9. Acceptance

- [x] Script runs `bun run scenario:dry-run-fx` and prints `Phase A passed`.
- [x] Test `tests/scenarios-fx-end-to-end.test.ts` green (9 cases).
- [x] `bun run typecheck` clean.
- [x] `bun run citation-gate` clean.
- [ ] `bun run ci` green — full sweep run before merge.

---

**Authors (first-mention identity discipline per CLAUDE.md):**
- **Saskia** (Head of Global Markets, governance — owns the markets franchise; reports to CEO).
- **Kai** (Trading systems engineer, engineering — reports to Saskia).
- **Bea** (Accounting & financial reporting engineer, engineering — reports to Camille, Chief Financial Officer).
- Dispatched by: **Scrooge** (Chief of Staff / Orchestrator).
