# Phase 3e Design — BA-700 Capital Adequacy + BA-320 FX Market Risk on V2

**Authority:** D-V1-REMOVAL-PHASE-3E (CEO-approved 2026-06-15)  
**Author:** Atlas (Substrate Architect, engineering)  
**Date:** 2026-06-15  
**Status:** SCAFFOLD — design committed at minute 10; implementation in flight

---

## 1. Context and scope

Phase 3e extends the V1→V2 removal workstream to the two primary SARB regulatory
capital returns:

- **BA-700** — Capital Adequacy and Leverage (Reg 38; BCBS Basel III §50–§90)
- **BA-320** — Market Risk (Reg 28; BCBS D352 §718)

The goal is a **V2 projection + advisory parity gate** for each return, following
the same pattern as Phase 3A's `recon:gl-v2-parity`.

At Phase 3e scope, the V2 data paths are **structurally partial** (the same way
Phase 3A's GL engine is structurally partial — not all posting rules have V2
equivalents yet). The parity gates are **advisory** (ok: true with warn violations)
until full V2 coverage is achieved.

---

## 2. BA-700 V2 data path

### 2.1 Capital numerator — `GlPostingEmitted`

The V1 capital-numerator path folds `SubLedgerPostingEmitted` and
`CapitalContributionRecorded` events for capital-classified accounts (CET1/AT1/T2)
via `generateBa100CapitalFromEvents` in `ba-700-events-adapter.ts`.

The V2 equivalent:
- Folds `GlPostingEmitted` events (Phase 3A; `v2-parallel`) for capital-classified
  accounts (ACC-5000-001 share capital, ACC-5000-002 retained earnings,
  ACC-5200-001 subordinated debt, ACC-5200-002 general provisions).
- `GlPostingEmitted` carries `accountCode` (COA account ID), `creditDebit`,
  `amount` (MoneyWire decimal-native), and `postingDate`.
- At Phase 3e scope, only the FX posting rules (PR-FX-001-V2, PR-FX-REVAL-V2,
  PR-FX-CLOSE-V2) emit `GlPostingEmitted`. Capital accounts are NOT FX accounts,
  so the V2 trial balance will have **zero capital-account rows** on a clean store.
- **Coverage assessment:** V2 cannot produce a capital numerator yet. The capital
  posting rules that credit ACC-5000-001/002 (equity injections, retained-earnings
  allocations) are V1-only (`SubLedgerPostingEmitted` / `CapitalContributionRecorded`)
  with no V2 GL posting-rule equivalents in Phase 3A–3e scope.

### 2.2 RWA denominator — `CcrEadComputed` (v2-parallel)

`CcrEadComputed` has `v2Status: "v2-parallel"` in the registry
(`registry/counterparty-credit-risk.ts`). The V2 variant uses `MoneyWire` amounts
for `rc`, `pfe`, `ead` (per D-DECIMAL-NATIVE-MONEY-ARITHMETIC, slice 2). The V2
store holds `CcrEadComputed` events with `schemaVersion: 2`.

The V2 RWA path:
1. Replay `CcrEadComputed` from the event store (the shared canonical store —
   `eventStore` from `platform/composition.ts`; V2-parallel events live there).
2. Sum `ead` across all netting sets → credit RWA proxy.
3. Market RWA and operational RWA are gaps at Phase 3e (no V2 VaR/op-risk event
   types yet — see Gap table below).

**Coverage assessment:** V2 can produce a partial RWA (credit leg only) from
`CcrEadComputed` events. The market RWA leg (12.5 × BA-320 capital charge) and
operational RWA leg (gross-income-blocked placeholder) have no V2 events yet.

### 2.3 Coverable cells at Phase 3e

| Cell | V2 source | Coverage status |
|---|---|---|
| `capitalAdequacy.tier1Capital` | `GlPostingEmitted` (ACC-5000-001/002) | **GAP** — no capital posting rule emits GlPostingEmitted |
| `capitalAdequacy.tier2Capital` | `GlPostingEmitted` (ACC-5200-001/002) | **GAP** — same as above |
| `capitalAdequacy.rwa` (credit leg) | `CcrEadComputed` (v2-parallel) | **PARTIAL** — credit RWA from SA-CCR EAD sum |
| `capitalAdequacy.rwa` (market leg) | V2 VaR event (does not exist yet) | **GAP** |
| `capitalAdequacy.rwa` (operational leg) | V2 op-risk event (not yet) | **GAP** |
| `capitalAdequacy.carRatio` | Derived (capital ÷ RWA) | **GAP** — numerator unavailable |
| `balanceSheet.*` | `GlPostingEmitted` (asset/liability accounts) | **PARTIAL** — only FX posting rules have V2 |
| `incomeStatement.*` | `GlPostingEmitted` (P&L accounts) | **PARTIAL** — only FX P&L accounts |
| `offBalanceSheet.*` | OBS event types (no V2 path yet) | **GAP** |

### 2.4 Parity strategy

The `recon:ba700-v2-parity` gate:

1. Reads the V1 BA-700 via `generateBA700Return` (the existing events-first path
   using `SubLedgerPostingEmitted` / `CapitalContributionRecorded` + `CcrEadComputed` V1).
2. Reads the V2 BA-700 via `computeBA700V2` (new projection: `GlPostingEmitted` +
   `CcrEadComputed` V2-parallel fold).
3. If **both sides produce non-zero data**: compare coverable cells; mismatches →
   `severity: "warn"` advisory violations.
4. If **V2 side produces all-zeros** (expected at Phase 3e — no capital GL rules
   in V2 yet): emit advisory gap summary, `ok: true`. This is the expected outcome
   on a clean CI store.
5. Advisory gate (`ok: true` even with warn violations); registers in `infra` suite.

---

## 3. BA-320 FX V2 data path

### 3.1 FIL FX lifecycle events as a data source

`FilInstrumentCreated` / `FilInstrumentAmended` / `FilInstrumentTerminated` are
`v2-parallel` and carry the FX trade lifecycle in V2 via the FIL framework. The
SA-CCR FIL-model (`v2-core/fil-models/sa-ccr.ts`) proves parity with V1
(`recon:v2-saccr-parity`). The FX valuation FIL-model (`v2-core/fil-models/fx-valuation.ts`)
provides the FX position via the Valuable facet.

**Can FIL FX lifecycle events provide net FX positions for BA-320?**

Yes, **with caveats**:
- `FilInstrumentCreated` for FX instruments carries the trade notionals (from the
  FIL product spec: currencyPair, notionalAmount, settlementDate, etc.).
- The FX valuation FIL-model (`fx-valuation.ts`) exposes `value()` which produces
  `MoneyWire` amounts — but this is a gross notional value per instrument, not the
  **net open position** (long vs short netting) that BA-320 requires.
- Deriving the net open FX position requires folding OPEN FilInstrumentCreated (minus
  FilInstrumentTerminated) by currency pair. This is mechanically possible but
  requires knowing which instruments are still open vs terminated.
- The V1 BA-320 FX path uses `fxPositionCalculator` over raw `FxTradeExecuted` events
  with `TradeMatured` settlement closures. The V2 equivalent would use
  `FilInstrumentCreated` / `FilInstrumentTerminated` — a structurally parallel path.

**Data path if feasible:**
```
FilInstrumentCreated{typeUrn: "fil:type:fx:*"} → open instrument set
FilInstrumentTerminated → settled/cancelled instruments (remove from open set)
→ net position per non-ZAR currency (long − short, expressed in ZAR minor units)
→ FX open-position charge: 8% × max(Σlong, Σshort) or 8% × netOpenPosition
→ BA-320 FX section (V2)
```

**Coverage assessment:** A V2 FX position projection from FIL events is **feasible**
in principle. However:
1. The `FilInstrumentCreated` payload from `v2-core/fil-instances/events.ts` carries
   an `instanceSpec` (arbitrary JSON blob) rather than strongly-typed notionals per
   currency pair. Extracting `currencyPair` and `notional` requires parsing the
   `instanceSpec` field with knowledge of the FX product type schema.
2. The V2 FX instruments in the anchor store were seeded via Phase 1 FIL FX
   (`prototype/v2-core/fil-models/fx-valuation.ts`). The FX valuation model returns
   gross value (in ZAR), not a signed net position by currency.
3. Constructing a signed net position by (baseCurrency, quoteCurrency) from FIL
   events requires a **new projection** that understands the FIL FX product schema.
   This is Phase 3e scope-feasible but requires reading `instanceSpec` structure.

**Decision:** Build the V2 BA-320 FX projection using `FilInstrumentCreated` +
`FilInstrumentTerminated` events, extracting currency pair information from the
`instanceSpec`. Mark cells that require FX rate data (ZAR conversion) as advisory
gaps where rates are unavailable. Gate is advisory.

### 3.2 Parity strategy for BA-320

The `recon:ba320-fx-v2-parity` gate:

1. V1 side: fold `FxTradeExecuted` + `TradeMatured` via `fxPositionCalculator` →
   `fxPositionsToBa310Input` → BA-320 FX section.
2. V2 side: fold `FilInstrumentCreated` + `FilInstrumentTerminated` for FX types
   → derive net currency positions → BA-320 FX section (V2).
3. Advisory: `ok: true` even with warn violations.
4. Gap-documents rate-data dependency (ZAR conversion rates for non-ZAR currencies
   are V1-only at this phase).

---

## 4. Gap register

| Gap ID | Description | Resolution path |
|---|---|---|
| GAP-3E-001 | No V2 capital GL posting rules (CET1/T2 accounts never hit by GlPostingEmitted) | Phase 3f: build V2 capital posting rules; emit GlPostingEmitted on CapitalContributionRecorded equivalents |
| GAP-3E-002 | Market RWA leg (12.5 × BA-320 capital charge) has no V2 event source | Phase 3e BA-320 V2 feeds here once the flip is approved |
| GAP-3E-003 | Operational RWA leg — no V2 event type yet | Separate workstream; gross-income-blocked placeholder |
| GAP-3E-004 | Balance sheet / income statement — only FX accounts have GlPostingEmitted | Phase 3 completion: all 42 posting rules on V2 |
| GAP-3E-005 | FX rate data (ZAR conversion) for BA-320 V2 — no V2 rate-feed event | Separate rate-feed workstream |
| GAP-3E-006 | Off-balance-sheet (OBS) — no V2 OBS event types | Future workstream |

---

## 5. Implementation plan

1. **`prototype/platform/projections/ba700-v2.ts`** — V2 BA-700 capital adequacy
   projection. Folds `GlPostingEmitted` (capital accounts) + `CcrEadComputed` V2.
   Returns `BA700ReturnV2` with `noData` marker when V2 capital GL events absent.

2. **`prototype/platform/recon/ba700-v2-parity.ts`** — Advisory parity gate.
   V1 BA-700 vs V2 BA-700. Registers in `infra` suite.

3. **`prototype/platform/projections/ba320-fx-v2.ts`** — V2 BA-320 FX section
   projection from `FilInstrumentCreated` + `FilInstrumentTerminated`.

4. **`prototype/platform/recon/ba320-fx-v2-parity.ts`** — Advisory parity gate.
   V1 BA-320 FX section vs V2. Registers in `infra` suite.

---

## 6. No new V2 event types

Phase 3e introduces **no new event types**. The projection reads existing
`v2-parallel` events:
- `GlPostingEmitted` (v2-parallel, registered in Phase 3A)
- `CcrEadComputed` (v2-parallel, registered in WS-CREDIT-LIMIT-ENGINE)
- `FilInstrumentCreated` / `FilInstrumentTerminated` (v2-parallel, registered in
  WS-V2-BBAAS S7-FIL)

The V1-only ratchet baseline (585) is not impacted. No F-032 three-site registration
is required.

---

## 7. Citations

- D-V1-REMOVAL-PHASE-3E (CEO-approved 2026-06-15)
- D-ENGINEERING-INTEGRITY-CHARTER (CEO-approved 2026-06-14)
- Banks Act 94 of 1990 §70 (capital adequacy)
- Regulations Relating to Banks Reg 38 (capital adequacy)
- Regulations Relating to Banks Reg 28 (FX open-position charge)
- BCBS Basel III §50–§90 (capital adequacy)
- BCBS D352 §718(xiii) (FX market risk)
- D-V1-REMOVAL-PHASE-3A (GL V2 projection precedent)
- D-CREDIT-LIMIT-ENGINE-BUILD (CcrEadComputed)
- D-FIL-ATTRIBUTION-A1-BUILD (FIL FX valuation model)
