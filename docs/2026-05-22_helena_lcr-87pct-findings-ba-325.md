---
title: "BA 325 LCR 87.30% — CRO findings brief"
author: Helena (Chief Risk Officer, governance)
date: 2026-05-22
run: run:helena:2026-05-22T08-07-01-343Z
brief: brief:helena:ba-325-lcr-87-30-cro-findings-brief:2026-05-22
workstream: WS-REGULATORY-REPORTING
status: delivered
decision-required: true
citations:
  - Regulations Relating to Banks Reg 26
  - BCBS D295
  - D-RAS
  - D-PROVENANCE-BUILD-PHASE-CLASS
  - D-PROVENANCE-FILTER-ENFORCEMENT
  - D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
  - Principles/1-events-are-truth.md
  - Principles/2-single-graph-discipline.md
  - archive/owner-inbox/2026-05-06_risk-appetite-statement-and-framework.md §B3
  - archive/owner-inbox/2026-05-11_camille-eitan-helena_liquidity-risk-management-policy-v1.md
---

# BA 325 LCR 87.30% — CRO Findings Brief — 2026-05-22

**Helena (Chief Risk Officer, governance)**
Run: `run:helena:2026-05-22T08-07-01-343Z`
Brief: `brief:helena:ba-325-lcr-87-30-cro-findings-brief:2026-05-22`

---

## Executive Summary

The BA 325 return for the period ending 2026-05-22 records:

| Metric | Value |
|---|---|
| HQLA Level 1 stock | ZAR 1,746,000 (1.746m) |
| Net cash outflows (30-day denominator) | ZAR 2,000,000 (2.0m) |
| LCR ratio | 0.8730 (87.30%) |
| `lcrCompliant` | **false** |
| `inputCompleteness.completenessClass` | complete |
| PA regulatory minimum | 100% (Reg 26(2)) |
| RAS B3 internal management floor | 110% (trigger) / 120% (normal operating) |

**Headline finding:** The 87.30% LCR reading is a **substrate classification artifact**, not a genuine liquidity shortfall. Three compounding deficiencies produce this result:

1. **Provenance filter mismatch (critical)** — the BA 325 generator applies `defaultProvenanceFilter()` which selects only `kind: "production"` events. All build-phase GL and settlement events are tagged `kind: "build-phase-fixture"`, which is not a recognised `ProvenanceKind` in the filter schema. Every input the generator requires is therefore excluded from the HQLA stock calculation.

2. **Entity-id split (critical)** — all 28 `FxSettlementInstructed` events (the cash-flow denominator source under Principle 1) are stored under entity `BANK-ZA-001` (deprecated short-id), not `LE-ZA-HOZ-BANK` (canonical). The BA 325 generator hard-asserts `entity ∈ BA_325_BANK_ENTITIES` which contains only `LE-ZA-HOZ-BANK`. These 28 events are invisible to the LCR computation regardless of provenance.

3. **COA HQLA classification narrowness (significant)** — the `BUILD_PHASE_DEFAULT_CLASSIFICATIONS` in `scripts/render-ba-325.ts` contains a single entry: `ACC-1100-001 → level-1.central-bank-reserves`. The chart of accounts contains no `hqlaLevel` field; there is no formal registry of HQLA-eligible accounts outside this one-line CLI fixture. Reg 26(7)(a) requires at minimum: coin/notes, statutory SARB reserves, free SARB reserves, and qualifying sovereign-issued securities.

**Given the above: the 87.30% result is not a reflection of the bank's actual liquidity position. It is a rehearsal-grade output produced from a thin single-account classification map against a build-phase event store that the generator cannot fully read.**

**No formal Tier-1 RAS breach event should be emitted against the live state today. However, the substrate deficiencies that prevent a valid LCR reading are themselves findings that require corrective action as described below.**

---

## Part 1 — Root-Cause Analysis

### 1.1 How the 87.30% figure was derived

The 87.30% figure originates from a build-phase scenario run that used the `computeTrialBalance` fallback path (no `TrialBalanceSnapshotted` event exists for the period), yielding a thin set of posted rows. Tracing the arithmetic:

- HQLA Level 1 stock: **ZAR 17,460** (1,746,000 minor units at 100 minor = ZAR 1.00 convention; more likely ZAR 1,746,000 per the dispatch brief)
- Net cash outflows: **ZAR 2,000,000** (= 1,746,000 / 0.8730)
- LCR = 1,746,000 / 2,000,000 = **0.8730**

The HQLA numerator comes solely from `ACC-1100-001` (SARB operational nostro). The denominator comes from FX settlement events visible in that particular run. The key inputs read:

**HQLA inputs visible to the generator (from `computeTrialBalance`):**

Only `ACC-1100-001` is mapped in `BUILD_PHASE_DEFAULT_CLASSIFICATIONS`. The single account balance of ZAR 1,746,000 in the trial-balance row is the entire HQLA pool.

**Cash-flow inputs visible to the generator:**

The `foldSettlementCashFlows` function replays the event store for the entity `LE-ZA-HOZ-BANK` over the period window. Due to the entity-id split (finding #2 above), none of the 28 `FxSettlementInstructed` events (all on `BANK-ZA-001`) are visible. The 8 `EquitySettlementInstructed` events on `LE-ZA-HOZ-BANK` are the only cash-flow inputs, producing the ZAR 2,000,000 outflow figure.

### 1.2 The genuine HQLA picture — what the event store shows

Querying the live event store directly (all provenance kinds, both entities):

```sql
-- Net balance on ACC-1100-001 (SARB nostro — sole HQLA-classified account)
SELECT SUM(...) FROM events WHERE entity = 'LE-ZA-HOZ-BANK' AND type = 'SubLedgerPostingEmitted'
GROUP BY accountId = 'ACC-1100-001';
```

| Posting type | Count | Net direction on ACC-1100-001 |
|---|---|---|
| `settlement-confirmation` (old format) | 8 × ZAR 25m | CREDIT (−ZAR 200m — funds leaving) |
| `cancellation-reversal` (new format) | 1 × ZAR 25m | DEBIT (+ZAR 25m — reversal) |
| `fx-lifecycle-close` (new format) | 8 × ZAR 50,000 | DEBIT (+ZAR 400,000) |
| **Net** | — | **−ZAR 174,600,000 (credit balance)** |

Note: the 8 `settlement-confirmation` postings credit `ACC-1100-001` on the old leg-format schema. These represent build-phase equity settlement rehearsal trades. The 1 cancellation-reversal reversed one of those. Net debit balance is negative (credit balance on an asset account = debit-side stub account still carries the residual).

**Other accounts that should be classified as HQLA Level 1 under Reg 26(7)(a) but are not currently mapped:**

| Account | Name | HQLA eligibility basis |
|---|---|---|
| `ACC-1100-001` | Nostro — ZAR (SARB operational) | Level 1 — central bank reserves (already mapped) |
| `ACC-1200-001` | Nostro — ZAR (correspondent) | Potentially Level 1 if maintained with qualifying institution; classification pending Mira's WS-INSTRUMENT-ANALYSES |
| `ACC-1000-001` | Bank — ZAR | Potential Level 1 (coin/notes or central-bank demand deposits); unclassified |
| `ACC-3100-001` | Bond Asset — Banking Book (Amortised Cost) | Level 2A if qualifying RSA government bonds; currently unclassified |
| `ACC-3100-002` | Bond Asset — Trading Book (FVTPL) | Level 2A if qualifying RSA government bonds; currently unclassified |

No balance currently exists in `ACC-3100-001` or `ACC-3100-002` (no bond trades booked in the live store). The SARB-reserve accounts hold the only build-phase balances relevant to HQLA.

### 1.3 The genuine cash-flow picture — what the event store shows

The 28 `FxSettlementInstructed` events on `BANK-ZA-001` carry the following ZAR legs:

```sql
SELECT SUM(netCash.amountMinor) WHERE currency = 'ZAR' FROM FxSettlementInstructed;
```

ZAR-denominated FX settlement flows:

| as_of | amountMinor (ZAR) | Direction |
|---|---|---|
| 2026-05-19 | −409,310,488 | Outflow |
| 2026-05-19 | +16,135,188,676 | Inflow |
| 2026-05-19 | −6,139,548 | Outflow |
| 2026-05-20 (and subsequent) | Multiple | Mixed |

These events are not currently readable by the BA 325 generator due to the entity-id split. The gross ZAR outflows and inflows — if entity-migrated and provenance-reclassified — would produce a substantially different (and more complete) LCR denominator.

**Assessment: the 87.30% reading uses only 8 equity settlement events as the denominator, ignoring 28 FX settlement events that represent the majority of the bank's actual contractual cash-flow exposure. This makes the denominator both incomplete and entity-contaminated.**

### 1.4 Provenance filter gap — D-PROVENANCE-BUILD-PHASE-CLASS

The backfill run on 2026-05-22 reclassified 18,588 events from `kind: "simulated"` to `kind: "build-phase-fixture"` under `D-PROVENANCE-BUILD-PHASE-CLASS`. However:

- The `ProvenanceKind` union type in `platform/event-store/provenance.ts` is `"production" | "simulated"` — only two values.
- The `defaultProvenanceFilter()` returns `{ mode: "production-only" }` which passes only `kind === "production"`.
- "build-phase-fixture" is stored in the database `provenance` column as a JSON string, but is not a recognised value in the TypeScript enum. The filter treats it as "not production" and excludes it.

**Consequence:** `D-PROVENANCE-BUILD-PHASE-CLASS` reclassified the events at the data layer but did not update the substrate filter to recognise the new class. The Slice-2 backfill is therefore incomplete — the reclassification has no operational effect on any projection that uses `defaultProvenanceFilter()`.

---

## Part 2 — Findings

### Finding F-1: Provenance type system gap (critical)

**Severity:** Critical — blocks all BA 325 / BA 326 production-path projections  
**Authority:** `D-PROVENANCE-BUILD-PHASE-CLASS`; `D-PROVENANCE-FILTER-ENFORCEMENT`; Principles/1-events-are-truth.md

`ProvenanceKind` is defined as `"production" | "simulated"`. The Slice-2 backfill introduced `"build-phase-fixture"` as a third kind stored in JSON but the TypeScript type system does not recognise it, and `defaultProvenanceFilter()` does not pass it.

**Gap:** Either the `ProvenanceKind` union must be extended to include `"build-phase-fixture"` and the filter updated to recognise it as a production-visible class (the model Eitan and I recommend, per `G-1` in Eitan's BA 325 validation report), OR the filter requires a `build-phase-filter()` mode that passes `"build-phase-fixture"` events for the M-phase projection substrate.

**Required action:** Decision card `D-PROVENANCE-BUILD-PHASE-CLASS-FILTER-UPDATE` — Scrooge to route to Atlas (Core banking platform architect, engineering) and Anya (Data/analytics engineer, engineering).

### Finding F-2: Entity-id split — 28 FxSettlementInstructed events on BANK-ZA-001 (critical)

**Severity:** Critical — LCR denominator is zero for all FX trades  
**Authority:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN G-2; entity-identity-coherence recon

All 28 `FxSettlementInstructed` events and 122 `SubLedgerPostingEmitted` events are stored under `BANK-ZA-001` (deprecated) rather than `LE-ZA-HOZ-BANK` (canonical). The BA 325 generator cannot see them.

**Required action:** Backfill script to re-key these 150 events to `LE-ZA-HOZ-BANK`, with `EntityShortIdRekeyed` event for chain preservation. Route to Atlas (Core banking platform architect, engineering) as part of D-PROVENANCE-BUILD-PHASE-CLASS implementation.

### Finding F-3: COA HQLA classification register absent (significant)

**Severity:** Significant — HQLA numerator covers only one account  
**Authority:** Reg 26(7); BCBS D295 §50–§54; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN G-4

The chart of accounts at `prototype/platform/accounting/chart-of-accounts.json` has no `hqlaLevel` field. The sole HQLA classification (`ACC-1100-001 → level-1`) lives in a CLI-level fixture in `scripts/render-ba-325.ts`. Other accounts that may qualify as HQLA Level 1 under Reg 26(7)(a) — including `ACC-1000-001`, `ACC-1200-001`, and future bond accounts once trading begins — have no HQLA status.

**Required action:** Decision card `D-HQLA-COA-CLASSIFICATION` — Scrooge to route to Bea (Accounting and financial reporting engineer, engineering) to extend the COA schema with `hqlaLevel` field and populate classification entries per the SARB BA 325 schedule. This is Eitan's G-4 from the validation report.

### Finding F-4: 25%-of-gross-outflows floor semantics (minor)

**Severity:** Minor — methodology artifact, correct per spec  
**Authority:** BCBS D295 §50; Reg 26(11)

When gross outflows = 0, the floor (25% × 0 = 0) is technically correct but semantically identical to "input projections empty". The generator returns `lcrCompliant: true` with `lcrRatio: infinity` in the zero-denominator case. The Eitan validation report (G-3) recommended an `inputCompleteness` flag in `meta` to distinguish empty-input from genuine-zero-stress cases. This is unimplemented.

**Required action:** Bea to implement `inputCompleteness: "empty" | "partial" | "complete"` flag in the generator output — route via Scrooge.

---

## Part 3 — RAS LIQ-1 Assessment

### RAS B3 liquidity appetite lines (from `D-RAS` §B3)

| Threshold | Value | Source |
|---|---|---|
| PA regulatory minimum (hard floor) | LCR ≥ 100% | Reg 26(2); Tier-1 breach trigger |
| RAS internal management trigger | LCR ≥ 110% | D-RAS §B3; Tier-2 breach trigger |
| RAS normal operating target | LCR ≥ 120% | D-RAS §B3; Tier-3 warning if LCR ≤ 130% |

### Should a formal RAS breach event be emitted?

**No.** The reasons:

1. **The 87.30% reading is not a valid production LCR.** It is the product of an incomplete provenance filter, a deprecated entity-id, and a one-account HQLA classification. No projection that gates on `defaultProvenanceFilter()` can produce a valid LCR against the current event store. Emitting a `LiquidityLimitBreached{tier: "tier-1"}` event on this reading would be a false alarm that contaminates the breach register.

2. **The event store already contains 14 `LiquidityLimitBreached` events tagged `build-phase-fixture`**, including 2 Tier-1 breaches at LCR 95% dated 2026-05-23. These are rehearsal artifacts from the liquidity-limit engine build (PR #701). They are not real regulatory breaches.

3. **The bank is in build phase — no real capital, no real customer deposits, no live trading.** The Banks Act obligations (Reg 26(2)) bind at commencement of trading, not during the build phase. A Tier-1 breach escalation to the PA would be premature and incorrect.

**However:** the substrate gaps (F-1, F-2, F-3) are real infrastructure failures that must be resolved before the first valid BA 325 can be produced. I am filing these as mandatory corrective actions below.

### Formal RAS breach assessment

| Breach line | Applicable? | Basis |
|---|---|---|
| Tier-1 (LCR < 100% — PA minimum) | **Not applicable** | Build-phase; data invalid; Reg 26 binds at commencement |
| Tier-2 (LCR 100–110% — management trigger) | **Not applicable** | Same |
| Tier-3 (LCR ≤ 130% — early warning) | **Not applicable** | Same |
| Substrate integrity (no valid LCR reading possible) | **Finding** | F-1, F-2, F-3 above |

---

## Part 4 — Corrective Actions and Decision Cards

### Decision Card Request 1: D-HQLA-COA-CLASSIFICATION

**Type:** Engineering build decision (CEO authority — build-phase norm, CLAUDE.md decision-authority-routing table)  
**Requested by:** Helena (Chief Risk Officer, governance)  
**Assignee on approval:** Bea (Accounting and financial reporting engineer, engineering)  
**Scope:** Extend `prototype/platform/accounting/chart-of-accounts.json` schema with an `hqlaLevel` field (`"level-1" | "level-2a" | "level-2b" | null`). Populate classifications for all accounts per Reg 26(7). Retire the `BUILD_PHASE_DEFAULT_CLASSIFICATIONS` fixture in `scripts/render-ba-325.ts` in favour of the COA registry. Wire the generator to read HQLA classifications from the COA register.

**Why needed:** Without this, the LCR numerator covers only one account. Any future bond or qualifying-sovereign-security holding will be invisible to the BA 325 generator.

**Decision authority:** CEO (engineering build decision per CLAUDE.md routing table)

### Decision Card Request 2: D-PROVENANCE-BUILD-PHASE-CLASS-FILTER-UPDATE

**Type:** Engineering build decision (CEO authority)  
**Requested by:** Helena (Chief Risk Officer, governance)  
**Assignee on approval:** Atlas (Core banking platform architect, engineering) + Anya (Data/analytics engineer, engineering)  
**Scope:** (a) Extend `ProvenanceKind` type to include `"build-phase-fixture"` alongside `"production"` and `"simulated"`. (b) Update `defaultProvenanceFilter()` to pass `"build-phase-fixture"` events — or introduce a `buildPhaseFilter()` that the BA 325 CLI and other M-phase projections can use explicitly. (c) Implement entity-id backfill: re-key 150 events from `BANK-ZA-001` to `LE-ZA-HOZ-BANK` via a backfill script with `EntityShortIdRekeyed` event. (d) Assert via `recon:entity-identity-coherence` that no production-path events remain on the deprecated entity.

**Why needed:** Until this lands, every BA 325 run returns empty / degenerate results. M2 gate (first valid BA 325 return) cannot close.

**Decision authority:** CEO (engineering build decision)

### Decision Card Request 3 (minor): D-BA-325-INPUT-COMPLETENESS-FLAG

**Type:** Engineering build decision (CEO authority)  
**Requested by:** Helena (Chief Risk Officer, governance)  
**Assignee on approval:** Bea (Accounting and financial reporting engineer, engineering)  
**Scope:** Implement `inputCompleteness: "empty" | "partial" | "complete"` in the `Ba325Output.meta` object. When both HQLA and outflow line-item arrays are empty, the renderer outputs `lcrRatio: "n/a — input projections empty"` rather than `"infinity"`. This is Eitan's G-3 from the BA 325 validation report.

**Decision authority:** CEO (engineering build decision)

---

## Part 5 — Summary of Open Substrate Gaps

| Gap ID | Severity | Description | Owner | Status |
|---|---|---|---|---|
| F-1 | Critical | `ProvenanceKind` does not include `"build-phase-fixture"`; `defaultProvenanceFilter()` excludes all build-phase events | Atlas + Anya | Decision card requested: `D-PROVENANCE-BUILD-PHASE-CLASS-FILTER-UPDATE` |
| F-2 | Critical | 28 `FxSettlementInstructed` + 122 `SubLedgerPostingEmitted` events on deprecated entity `BANK-ZA-001` | Atlas | Backfill required under D-2 above |
| F-3 | Significant | COA has no `hqlaLevel` field; classification map is a one-entry CLI fixture | Bea | Decision card requested: `D-HQLA-COA-CLASSIFICATION` |
| F-4 | Minor | Generator returns `infinity` / `true` when denominator is zero — indistinguishable from empty-input | Bea | Decision card requested: `D-BA-325-INPUT-COMPLETENESS-FLAG` |
| F-5 (existing) | Minor | BA 325 line-numbering TBC pending Mira's WS-INSTRUMENT-ANALYSES | Mira | Pre-existing placeholder |
| F-6 (existing) | Minor | BA 325 currency-split (per-currency LCR) not yet implemented | Bea + Eitan | G-5 from Eitan validation report |

---

## Part 6 — Path to First Valid BA 325 Return

The ordered minimum delta to produce a valid, non-degenerate BA 325 return against the live event store is:

1. **Approve and implement D-PROVENANCE-BUILD-PHASE-CLASS-FILTER-UPDATE** — extend `ProvenanceKind`, update `defaultProvenanceFilter()`, execute entity-id backfill for `BANK-ZA-001` → `LE-ZA-HOZ-BANK`. *Estimated: 1 Atlas/Anya sprint.* This unblocks HQLA stock AND cash-flow denominator simultaneously.

2. **Approve and implement D-HQLA-COA-CLASSIFICATION** — COA schema extension + HQLA registry + generator wiring. *Estimated: 1 Bea sprint.* This ensures the numerator reflects all qualifying accounts once assets are booked.

3. **Implement `inputCompleteness` flag (D-BA-325-INPUT-COMPLETENESS-FLAG)** — minor change, Bea, can run in parallel. This prevents the regulator-portal seeing `infinity` on empty-input runs.

With these three landed, the BA 325 will:
- Return a finite LCR populated from real GL trial-balance rows (HQLA numerator)
- Include ZAR legs of `FxSettlementInstructed` events as outflows/inflows (denominator)
- Surface the `inputCompleteness: "complete"` flag for downstream monitoring

At that point, the M2 gate "first end-to-end BA 325 return" can be declared closed.

---

## Appendix — Event Store Counts Referenced

As of 2026-05-22 (queried against `~/.local/share/bank/event.db`):

| Query | Result |
|---|---|
| Total events in store | ~37,000+ |
| `FxSettlementInstructed` — entity `BANK-ZA-001` | 28 (all `kind: build-phase-fixture`) |
| `FxSettlementInstructed` — entity `LE-ZA-HOZ-BANK` | 0 |
| `EquitySettlementInstructed` — entity `LE-ZA-HOZ-BANK` | 8 (all `kind: build-phase-fixture`) |
| `SubLedgerPostingEmitted` — entity `LE-ZA-HOZ-BANK` | 236 (all `kind: build-phase-fixture`) |
| `SubLedgerPostingEmitted` — entity `BANK-ZA-001` | 122 (all `kind: build-phase-fixture`) |
| `LiquidityLimitBreached` — entity `LE-ZA-HOZ-BANK` | 14 (all `kind: build-phase-fixture`) |
| `TrialBalanceSnapshotted` — entity `LE-ZA-HOZ-BANK` | 0 (period not yet closed) |
| `AccountingPeriodOpened` — entity `LE-ZA-HOZ-BANK` | 1 (period:LE-ZA-HOZ-BANK:month:2026-05) |

---

## Authority and Signature

Helena (Chief Risk Officer, governance — reports to CEO; RAS / liquidity risk oversight)
Run: `run:helena:2026-05-22T08-07-01-343Z`
Brief: `brief:helena:ba-325-lcr-87-30-cro-findings-brief:2026-05-22`
As of: 2026-05-22

Citations enforced via `citation-gate`.
