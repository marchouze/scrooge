# Phase 2 Gap A3 — Wire `MarketRiskVarComputed` production event

**Authority:** `D-V1-REMOVAL-PHASE2-GAP-A3` (CEO-approved 2026-06-15)  
**Author:** Atlas (Substrate Architect, engineering)  
**Status:** IMPLEMENTING

---

## 1. Problem

`recon:fx-v2-parity` identifies Gap A3 as a hard blocker on the V1→V2 flip for
VaR/ES:

> *GAP A3 (FLIP BLOCKED): VaR/ES V2 path has no production event. The V2 A3 VaR
> metric (`makeVarMetric`) runs ONLY in `recon:attribution-var-diversification` — it
> is not wired to emit any event to replace `MarketRiskMeasureComputed`. The
> `MarketRiskMeasureComputed` type is tagged `v2Status: "v1-only"`.*

The V2 FIL-model (`makeVarMetric` / `jointVar`) is already validated against the V1
engine byte-for-byte in `recon:attribution-var-diversification` — the math is correct
and parity-proven. What is missing is a production event-of-record and the plumbing
to emit it.

---

## 2. Scope

This deliverable resolves Gap A3 by wiring the V2 metric to emit a typed production
event (`MarketRiskVarComputed`) and registering it at all three F-032 sites (event
type schema + registry row + provenance-category map). It also:

- adds a dual-read in the V1 projection (`market-risk-measure.ts`) so the V2 figure
  is visible alongside the V1 figure for comparison;
- adds a new advisory parity gate (`recon:var-v2-parity`) that asserts V1 ↔ V2 VaR
  figures agree within minor-unit rounding;
- updates `fx-v2-parity.ts` Gap A3 advisory warn to reflect that the event is now
  registered and the emission is wired.

**Out of scope:** flipping `MarketRiskMeasureComputed` to `v2-replaced`. That requires
the parity gate to prove byte-equivalence in production and a CEO Decision approving
the flip.

---

## 3. Design decisions

### 3.1 `MarketRiskVarComputed` payload shape

The payload mirrors the V1 `MarketRiskMeasureComputedPayload` shape with two changes:

1. `tenantId: z.string()` added (V2 multi-tenant discipline).
2. Numeric VaR fields (`varZar`, `svarZar`, `esZar`, `varAppetiteZar`) lifted to
   `MoneyWire` (`{currency, amount}` string pair) under
   `D-V2-CORE-MONEY-DECIMAL-NATIVE`.

The `status`, `asOf`, `measureId`, `riskFactorCount`, `minObservations` fields are
unchanged.

The figures `var`/`svar`/`es` remain as `FinancialInput`-shaped Zod discriminated
unions (present/absent) but their `value` is replaced with a `MoneyWire` value object.

### 3.2 Emission basis

The emitter (`var-engine-v2.ts`) re-uses:
- `deriveRiskFactorExposures` from `var-engine.ts` — the single shared NOP fold.
- `jointVar` from `v2-core/fil-models/market-risk-var/methodology.ts` — the ported
  V2 historical-simulation kernel.

The emitter does NOT call `makeVarMetric` / `evaluateSlice` (those are the
attribution-layer API). Instead it directly calls `deriveRiskFactorExposures` and
`jointVar` — the same path `attribution-var-diversification.ts` uses in its section
(c) GROUP VaR computation. This keeps the emitter dependency-free of the attribution
framework.

### 3.3 Fail-closed on insufficient data

- `no-positions` (flat book) → emit nothing (no silent absent event).
- `insufficient-history` (< 20 return observations) → emit nothing.
- `computed` → emit `MarketRiskVarComputed` with present-figure MoneyWire values.

This matches the V1 engine's loudly-absent pattern without copying it to the V2 event
store. If there's nothing to compare, the parity gate degrades to info.

### 3.4 Store target

`MarketRiskVarComputed` is appended to the **platform event store** (same store as
`MarketRiskMeasureComputed`) — NOT the V2 anchor store. Rationale: the parity gate
compares V1 and V2 figures from the same store; using a separate store would require
cross-store reads in the projection and complicate the comparison.

### 3.5 VaR appetite on the V2 event

The V1 `MarketRiskMeasureComputed` carries `varAppetiteZar: number`. The V2 event
carries `varAppetiteZar: MoneyWire` (decimal-native). The appetite value is sourced
from the same RAS register as V1 (currently hardcoded to ZAR 575,000 in the V1 run
script).

---

## 4. Three-site F-032 registration

| Site | File | What changes |
|---|---|---|
| Site 1 — event type schema | `platform/event-store/event-types/market-risk-measure.ts` | Add `MarketRiskVarComputedPayload` Zod schema + factory |
| Site 2 — registry row | `platform/event-store/registry/markets.ts` | Add `MarketRiskVarComputed` row, `v2Status: "v2-parallel"`, `schemaVersion: 2` |
| Site 3 — provenance category | `platform/event-store/provenance-category.ts` | Map `MarketRiskVarComputed` → `"market-data"` (same category as `MarketRiskMeasureComputed` / `CcrEadComputed`) |

---

## 5. Files created / modified

| Action | File |
|---|---|
| NEW | `prototype/docs/phase2-gap-a3-var-v2-design.md` (this file) |
| NEW | `prototype/platform/market-risk/var-engine-v2.ts` |
| NEW | `prototype/platform/recon/var-v2-parity.ts` |
| MODIFY | `prototype/platform/event-store/event-types/market-risk-measure.ts` |
| MODIFY | `prototype/platform/event-store/registry/markets.ts` |
| MODIFY | `prototype/platform/event-store/provenance-category.ts` |
| MODIFY | `prototype/platform/projections/markets/market-risk-measure.ts` |
| MODIFY | `prototype/platform/recon/fx-v2-parity.ts` |
| MODIFY | `prototype/scripts/run-recon-suite.ts` |
| MODIFY | `prototype/package.json` |

---

## 6. Parity gate design

`recon:var-v2-parity` (advisory, `ok: true`):

1. Fold latest `MarketRiskMeasureComputed` → `{varZar, svarZar, esZar}` (numbers).
2. Fold latest `MarketRiskVarComputed` → convert MoneyWire major-string to float for
   comparison.
3. Compare within tolerance: `Math.abs(v1 - v2) <= 1` (ZAR minor-unit rounding).
4. Gap or tolerance breach → `severity: "warn"` advisory.
5. `ok: true` always (advisory gate — the flip to enforcing happens when the V2 event
   is promoted to `v2-replaced` and parity is production-proven).

---

## 7. Definition of Done

- [ ] `bun run ci` passes on a clean store (BANK_EVENT_DB=$(pwd)/.local/event.db)
- [ ] `bun run citation-gate` zero violations
- [ ] `MarketRiskVarComputed` present at all three F-032 sites
- [ ] `var-engine-v2.ts` emits the event fail-closed
- [ ] `recon:var-v2-parity` registered in run-recon-suite.ts + package.json
- [ ] `fx-v2-parity.ts` Gap A3 advisory message updated to reflect wired state
- [ ] PR merged to main
