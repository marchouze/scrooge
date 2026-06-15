# Phase 3A — GL / Posting-Rule Registry on V2: Design Document

**Authority:** D-V1-REMOVAL-PHASE-3A (CEO-approved 2026-06-15)  
**Author:** Atlas (Substrate Architect, engineering)  
**Date:** 2026-06-15

---

## 1. V2 Trigger Coverage Table

Go through every posting rule in `posting-rule-registry.ts` (70 entries total).
For each `triggerEventType`, check whether the trigger event exists in V2
(has `v2Status: "v2-parallel"` or has a V2 FIL-instance equivalent).

| V1 trigger | v2Status | V2 equivalent? | Notes |
|---|---|---|---|
| FxTradeExecuted | v1-only | No — FIL only | FilInstrumentCreated covers the FIL equivalent; triggers PR-FX-001 |
| FxPositionRevalued | v1-only | No | V2 revaluation is FxBookValuationSnapshotted (aggregate); no per-trade V2 event |
| FxSettlementInstructed | v1-only | No | intentional-no-impact; memo only |
| PrincipalPayment | v1-only | No | V1 CDM only |
| TradeReportSubmitted | v1-only | No | intentional-no-impact; regulatory dispatch |
| SettlementConfirmed | v1-only | No | V1 CDM only |
| FxTradeCancelled | v1-only | No | FilInstrumentTerminated covers cancellation in FIL |
| FxSettlementFailed | v1-only | No | No V2 equivalent yet |
| TradeMatured | v1-only | No | Deprecated V1 back-compat path |
| BondTradeExecuted | v1-only | No | No V2 bond FIL model yet |
| BondInterestAccrued | v1-only | No | No V2 bond FIL model yet |
| BondPositionRevalued | v1-only | No | No V2 bond FIL model yet |
| BondMatured | v1-only | No | No V2 bond FIL model yet |
| BondSold | v1-only | No | No V2 bond FIL model yet |
| EquityTradeExecuted | v1-only | No | No V2 equity FIL model yet |
| EquityPositionRevalued | v1-only | No | No V2 equity FIL model yet |
| EquityCorporateActionApplied | v1-only | No | No V2 equity FIL model yet |
| EquitySettlementInstructed | v1-only | No | intentional-no-impact; memo only |
| EquitySettlementConfirmed | v1-only | No | No V2 equity FIL model yet |
| IrsTradeBooked | v1-only | No | No V2 IRD FIL model yet |
| IrsPositionRevalued | v1-only | No | No V2 IRD FIL model yet |
| IrsCouponScheduleGenerated | v1-only | No | intentional-no-impact; memo only |
| IrsCouponPaymentInstructed | v1-only | No | intentional-no-impact; memo only |
| IrsCouponSettlementConfirmed | v1-only | No | No V2 IRD FIL model yet |
| IrdSwapTerminated | v1-only | No | No V2 IRD FIL model yet |
| RepoTradeOpened | v1-only | No | No V2 repo FIL model yet |
| RepoStartLegSettled | v1-only | No | intentional-no-impact; memo only |
| RepoInterestAccrued | v1-only | No | No V2 repo FIL model yet |
| RepoEndLegSettled | v1-only | No | No V2 repo FIL model yet |
| RepoTradeTerminatedEarly | v1-only | No | No V2 repo FIL model yet |
| DepositTaken | v1-only | No | No V2 deposit FIL model yet |
| DepositInterestAccrued | v1-only | No | No V2 deposit FIL model yet |
| DepositMatured | v1-only | No | No V2 deposit FIL model yet |
| DepositWithdrawnEarly | v1-only | No | No V2 deposit FIL model yet |
| FundingLineDrawn | v1-only | No | No V2 funding FIL model yet |
| FundingLineRepaid | v1-only | No | No V2 funding FIL model yet |
| InterbankLoanPlaced | v1-only | No | No V2 IBL FIL model yet |
| InterbankLoanInterestAccrued | v1-only | No | No V2 IBL FIL model yet |
| InterbankLoanMatured | v1-only | No | No V2 IBL FIL model yet |
| InterbankLoanRecalledEarly | v1-only | No | No V2 IBL FIL model yet |
| ProvisionCalculated | v1-only | No | Category B — event type does not exist in registry |
| BookPnlAttributed | v1-only | No | Category B — event type does not exist in registry |

**Coverage tally (based on 42 unique trigger types across 70 registry entries):**
- Full V2 trigger coverage: **0 / 42** (0%)
- Partial V2 trigger coverage: **0 / 42** (0%)
- No V2 coverage: **42 / 42** (100%)

**Assessment:** The FIL instance event family (`FilInstrumentCreated`, `FilInstrumentAmended`,
`FilInstrumentTerminated`) is the closest V2 analogue — these three events are v2-parallel and
cover FX trade lifecycle. However, they are semantic analogues (one FilInstrumentCreated per
instrument), not direct 1:1 trigger replacements (the V1 posting engine fires once per
FxTradeExecuted per posting rule). No V2 posting engine exists yet; this workstream builds it.

**Implication for parity check:** The V2 GL engine (this workstream) consumes `FilInstrumentCreated`,
`FilInstrumentAmended`, `FilInstrumentTerminated` as V2 triggers for the FX sub-set. All other
V1 triggers have no V2 equivalent; the parity gate will produce advisory warnings for uncovered
rules, which is correct and expected.

---

## 2. V2 GL Event Type: `GlPostingEmitted`

**Search result:** No existing `GlPosting`, `AccountingEntry`, or similar event type exists in
v2-core. The closest v1 event is `SubLedgerPostingEmitted` which is `v2Status: "v1-only"`.
The `Gl` prefix is mapped to the `accounting` provenance category in `provenance-category.ts`
via the heuristic match `["Gl", "accounting"]`.

**Design decision:** Mint a new `GlPostingEmitted` event type. This is NOT a duplicate of
`SubLedgerPostingEmitted` — it is the V2 successor with:
1. `tenantId` (V2 mandatory)
2. `iasRule` (direct IFRS citation on the event, not a `postingType` string)
3. `MoneyWire` decimal-native amount (never `amountMinor: number`)
4. Single flat leg per event (not an array) — one `GlPostingEmitted` = one DR or CR leg

**Payload definition:**

```ts
interface GlPostingEmittedPayload {
  accountCode: string;        // COA account ID (e.g. "ACC-2100-001")
  creditDebit: "credit" | "debit";
  amount: MoneyWire;          // decimal-native; NEVER minorUnits
  postingDate: string;        // ISO 8601 date (YYYY-MM-DD)
  tenantId: TenantId;         // V2 required tenant axis
  sourceEventId: string;      // event_id of the V2 trigger (FilInstrumentCreated etc.)
  iasRule: string;            // IFRS/IAS citation (e.g. "IFRS 9 §3.1.1")
  postingRuleId: string;      // PR identifier (e.g. "PR-FX-001-V2")
  description?: string;       // human-readable description
}
```

**Class:** `"markets"` — consistent with `SubLedgerPostingEmitted` and the `["Gl", "accounting"]`
heuristic (GL events are in the `accounting` provenance category, but their registry `class` field
follows the `markets` pattern where trade-domain events live; `FxBookValuationSnapshotted` uses
`"markets"` and maps to `"accounting"` provenance — same pattern here).

---

## 3. V2 Engine Topology

The V2 posting engine (`gl-posting-engine-v2.ts`) subscribes to V2 FIL events from
`BANK_V2_ANCHOR_DB`. V2 FIL events with v2-parallel coverage:

| V2 event | Trigger | Covered rules |
|---|---|---|
| FilInstrumentCreated | FX trade opening | PR-FX-001-V2 (initial recognition) |
| FilInstrumentAmended | FX revaluation | PR-FX-REVAL-V2 (FVTPL revaluation) |
| FilInstrumentTerminated | FX settlement/cancellation | PR-FX-CLOSE-V2 (derecognition) |

**Scope:** FX sub-ledger only (rules PR-FX-001-V2, PR-FX-REVAL-V2, PR-FX-CLOSE-V2).
All other lifecycle types (Bond, Equity, IRS, Repo, MMD, IBL) have no V2 trigger equivalents;
their gap is documented here and surfaced by the parity gate as advisory warnings.

**Constraint:** `recon:v2-no-v1-import` does not bind `platform/accounting/gl-posting-engine-v2.ts`
because it is in `platform/`, not `v2-core/`. It MAY import from both `platform/` and `v2-core/`.

---

## 4. Parity Scope

The parity check compares:
- **V1 side:** `computeTrialBalance()` from `period-close.ts` (reads `SubLedgerPostingEmitted`)
- **V2 side:** `computeTrialBalanceV2()` from `gl-projection-v2.ts` (reads `GlPostingEmitted`)

**Expected outcome at Phase 3A:**
- V2 produces postings ONLY for FX trades covered by FIL instances (3 rules)
- V1 produces postings for ALL 42 trigger types
- Accounts that V1 posts and V2 doesn't → advisory warn violation listing account codes
- Accounts where BOTH post → byte-comparison per (accountCode, currency) net balance

**Gate severity:** ADVISORY (ok: true even with warn violations). Becomes enforcing after
full V2 coverage is achieved (Phase 3 complete — all domains have FIL models and emit
`GlPostingEmitted`).

---

## 5. v2Status Updates

| Event type | Before | After | Rationale |
|---|---|---|---|
| `GlPostingEmitted` | (new) | `v2-parallel` | New V2 GL event; V1 SubLedger still authoritative |
| `SubLedgerPostingEmitted` | `v1-only` | `v1-only` | No change; V1 still authoritative |

The Phase 1 v1-only count ratchet must not be violated. Adding `GlPostingEmitted` as
`v2-parallel` does NOT increment the v1-only count (correct). The ratchet allows adding
v2-parallel entries freely — only adding v1-only entries would violate it.
