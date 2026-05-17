---
author: Anya
date: 2026-05-16
decision-required: false
authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
tags: [semantic-layer, m2, recon, registry]
---

# M2 Slice 1 — Semantic-Layer Registry: Delivery Brief

**Author:** Anya (Projection Engineer, engineering)  
**Authority:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)  
**Date:** 2026-05-16  
**Status:** Complete — CI green, PR open

---

## What was built

The `@platform/semantic` registry skeleton (Slice 1 of D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN) is now fully in-force and CI-gated. The module provides the typed business-vocabulary layer between the event log and the report generators:

```
EVENT LOG → PROJECTION RUNTIME → SEMANTIC LAYER (this) → REPORT GENERATORS → RMS STORE
```

### Registry substrate (`prototype/platform/semantic/`)

Already in-force from prior work:

- **`types.ts`** — `SemanticEntry` type (id, version, description, units, dimensions, projection, formula, citations, signers, entityScope, regulatoryCells, ifrsLines, status, firstAuthored). Richer than the dispatch spec's `SemanticMeasure` — extends it with multi-entity scoping, IFRS classification dimensions, regulatory cell mappings, and signer accountability (Principles 2, 5, 6).
- **`registry.ts`** — `SemanticRegistry` class with `register()`, `resolve()`, `listInForce()`, `listAll()`, `listAllVersionsOf()`, `citationCoverage()`. Enforces citation discipline at the boundary (`register()` rejects empty citations, empty signers, empty entityScope).
- **`entries.ts`** — Three required Slice-1 worked entries (see below).
- **`index.ts`** — Public barrel (`@platform/semantic`). Also exports Slice 3 LCR entries, Slice 3 RWA entries, Slice 4 capital entries, Slice 5 market/op-risk entries, Slice 6 IFRS entries (pre-populated by prior slices).

### New in this slice: `recon:semantic-registry-coverage`

**File:** `prototype/platform/recon/semantic-registry-coverage.ts`  
**Script:** `bun run recon:semantic-registry-coverage` (wired into `bun run ci`)

Six invariant families asserted at every CI run:

| Check | Description | Severity |
|---|---|---|
| A — Slice-1 completeness | `Balance`, `Exposure`, `CashAndBalancesAtSARB` are registered in-force | fail |
| B — Citation discipline | Every in-force entry has ≥1 citation; warns if all citations are TBC placeholders | fail / warn |
| C — Signer coverage | Every in-force entry has ≥1 signer | fail |
| D — Projection named | Every in-force entry has a non-empty `projection` field | fail |
| E — Entity scope (P5) | Every in-force entry has ≥1 `entityScope` URN | fail |
| F — Signer roster cross-link | Every signer is a registered persona in `Team/_team-roster.json` | fail |

CI run: **258 assertions, 0 violations.** Exit 0.

---

## Three required Slice-1 entries

### Balance

- **Id:** `Balance` | **Version:** `v0.1` | **Status:** `in-force`
- **Description:** Money-units balance of a GL account, sliced by entity, currency, IFRS classification, and as-of date. Base quantity every BA-return cell and AFS line decomposes into.
- **Projection:** `gl-projection`
- **Event sources (folded by projection):** `SubLedgerPostingEmitted` (per M1 sub-ledger handler), `IfrsClassificationApplied`
- **Citations:** IAS 1 §54 (SoFP line composition), IFRS 9 §4.1 (classification), ORG-AC-01 (recognition), ORG-AC-08 (presentation), Accounting Policies v0.1 §1-2
- **Signers:** Bea (Accounting & financial reporting engineer, engineering), Camille (Chief Financial Officer, governance)
- **Entity scope:** hoz-group, hoz-bank, hoz-securities

### Exposure

- **Id:** `Exposure` | **Version:** `v0.1` | **Status:** `in-force`
- **Description:** Counterparty-level exposure in money units, sliced by counterparty, exposure kind, currency. Drives BA 600, BA 410, BA 330.
- **Projection:** `exposure-projection`
- **Event sources (folded by projection):** `TradeBooked`, `CollateralUpdated`
- **Citations:** ORG-PR-09 (BCBS Large Exposures / BA 330), TBC placeholder for BA 600 + BA 410 exact lines (Mira follow-on)
- **Regulatory cells:** BA 410 (credit-risk concentration), BA 600 (counterparty credit risk), BA 330 (large exposures)
- **Signers:** Helena (Chief Risk Officer, governance), Bea (Accounting & financial reporting engineer, engineering)
- **Entity scope:** hoz-bank, hoz-group

### CashAndBalancesAtSARB

- **Id:** `CashAndBalancesAtSARB` | **Version:** `v0.1` | **Status:** `in-force`
- **Description:** Operational cash balance held at the South African Reserve Bank by Hoz Bank Limited. Feeds AFS SoFP cash line, BA 300, and BA 325 HQLA Level-1 (LCR).
- **Projection:** `gl-projection`
- **Event sources (folded by projection):** `PaymentSettled`, `FundingDrawn`
- **Citations:** IFRS 9 §4.1.2 (amortised-cost), IAS 1 §54(i) (SoFP presentation), ORG-AC-01, ORG-AC-13, ORG-PR-06 (BCBS D295 / BA 325 HQLA Level-1), Accounting Policies v0.1 §2
- **Regulatory cells:** BA 300 (Item 1 — cash at central bank), BA 325 (HQLA Level-1 LCR), BA 100 memo
- **IFRS lines:** SoFP — Cash and balances at SARB
- **Signers:** Bea (Accounting & financial reporting engineer, engineering), Camille (Chief Financial Officer, governance), Eitan (Treasurer, governance)
- **Entity scope:** hoz-bank only

---

## Platform index substrate gap

`prototype/platform/index.ts` is a thin barrel that does not re-export `@platform/semantic`. The semantic module is imported directly as `@platform/semantic` (via `tsconfig.json` path mapping). Adding it to `platform/index.ts` would create a circular barrel (the index already imports from several sub-modules, and semantic imports from other platform modules). The gap is recorded here as a substrate note for Owen (Company Secretary, governance) / Atlas (Core banking platform architect, engineering) to assess in the M8 cloud-lift phase when the barrel structure is rationalised.

---

## Slice 2 ready signal

Slice 2 (period-close event family — Bea + Atlas) may now be dispatched. It should:
- Import `@platform/semantic` and verify `balance` and `cashAndBalancesAtSARB` resolve.
- Emit `AccountingPeriodOpened`, `AccountingPeriodClosed`, `TrialBalanceSnapshotted` events.
- The `SemanticRegistry.citationCoverage()` method is available for the period-close handler to cross-reference which entries are referenced in the trial-balance snapshot.

---

## Principles compliance

- **P1 (events are truth):** every entry's `projection` field names a projection; values are always recomputed from the event log by replay. No stored state in the registry.
- **P2 (single-graph discipline):** every in-force entry carries ≥1 citation; the recon gate enforces this at CI. Upward anchors in `citations`; downward derivation in `projection` + `formula`.
- **P5 (multi-currency, multi-entity):** `entityScope` required on every entry (hoz-group / hoz-bank / hoz-securities URNs per `Regulations/_legal-entity-tree.md`); `currency` is a declared dimension.
- **P6 (autonomous-by-default):** signers cross-linked to `Team/_team-roster.json`; every entry has an accountable agent. Anya curates the registry on continuous cadence; new entries require a passing `recon:semantic-registry-coverage`.
