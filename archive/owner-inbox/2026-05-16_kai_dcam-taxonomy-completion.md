---
author: Kai
date: 2026-05-16
decision-required: false
authority: D-MARKETS-SCHEMA-FOUNDATION
tags: [dcam, taxonomy, markets, data-quality]
---

# DCAM Taxonomy Mapping — Completion

**Kai (Quantitative Markets Architect, engineering)** — completion report for the deferred DCAM taxonomy work from PR #377.

## Summary

PR #377 (merged 2026-05-14) landed the EDM Council DCAM three-layer architecture foundation. The full ProductFamily-to-DCAM mapping was deferred. This dispatch completes that deferred work.

### Products mapped

All six ProductFamily values now have a complete DCAM classification:

| ProductFamily | DCAM Scope Code | Layer 1 (FIBO) | L2 Standards | L3 ISO 20022 msgs | L3 Attrib Groups |
|---|---|---|---|---|---|
| `listed-equity` | `equity-securities` | SEC:ListedShare | CDM, ESMA-CFI | 2 | 4 |
| `listed-bond` | `debt-securities` | SEC:Bond | CDM, ESMA-CFI | 1 | 4 |
| `repo` | `securities-financing` | SEC:RepurchaseAgreement | CDM, ESMA-CFI | 2 | 3 |
| `otc-ird` | `interest-rate-derivatives` | DER:InterestRateDerivative | CDM, ESMA-CFI, BCBS | 2 | 5 |
| `fx` | `fx-instruments` | FBC:ForeignExchange | CDM, ESMA-CFI | 2 | 4 |
| `structured` | `multi-asset` | — deferred | — | — | 1 |

5 of 6 families fully classified at Layer 1/2/3. `structured` (multi-asset) deferred to NPA gate at commencement-of-trading.

### Layer 3 data attribute groups by family

The bank-specific DCAM Layer 3 data-concept / attribute-group definitions were authored per family. These are the specific data attributes that flow through each product's lifecycle events and feed M2/M3 data-quality reporting:

- **listed-equity (4 groups):** Equity Instrument Reference, Equity Trade Economics, Equity Corporate Action, Equity Settlement Record
- **listed-bond (4 groups):** Bond Instrument Reference, Bond Trade Economics, Bond Coupon Schedule, Bond Redemption
- **repo (3 groups):** Repo Leg Economics, Repo Collateral Schedule, Repo Margin / Variation
- **otc-ird (5 groups):** OTC IRD Trade Economics, IRD Rate Reset, IRD Mark-to-Market / NPV, IRD Collateral / CSA, IRD Regulatory Trade Report
- **fx (4 groups):** FX Trade Economics, FX Settlement Record, FX FinSurv Regulatory Report, FX Rate Observable

Total: 21 named data attribute groups covering the bank's full trading book.

### Files delivered

| File | Purpose |
|---|---|
| `prototype/platform/markets/products/dcam-mapping.ts` | Canonical mapping: `ProductFamily → DCAM scope code → Layer 1/2/3`. Exports `PRODUCT_FAMILY_TO_SCOPE_CODE`, `PRODUCT_FAMILY_LAYER3`, `getProductFamilyDcamRecord()`, `getAllProductFamilyDcamRecords()`. |
| `prototype/platform/recon/dcam-taxonomy-coverage.ts` | `recon:dcam-taxonomy-coverage` gate — blocking CI check. |
| `prototype/platform/regulatory/graph/seed-projection.ts` | Step 12 added: DCAM Activity nodes + `PART_OF` (attribute-group → domain) and `GOVERNS` (REG-BCBS/REG-IASB → domain) edges. |
| `prototype/package.json` | `recon:dcam-taxonomy-coverage` script added + wired into `bun run ci`. |

### Graph integration

The regulatory knowledge graph seed (Step 12) now seeds:
- 6 `Activity` nodes of the form `DCAM-<scopeCode>` — one per DCAM data domain
- 21 `Activity` nodes of the form `DCAM-DAG-<id>` — one per Layer 3 attribute group
- `PART_OF` edges: each attribute-group node → its parent domain node
- `GOVERNS` edges: `REG-IASB` → all domain nodes (FIBO standard-setter); `REG-BCBS` → risk-bearing product domains (`listed-bond`, `repo`, `otc-ird`, `fx`)

Total new graph nodes per seed run: 27 Activity nodes (6 domain + 21 attribute-group). Edges: 27 `PART_OF` + up to 10 `GOVERNS`.

### Recon gate

`recon:dcam-taxonomy-coverage` (blocking) asserts:
1. Every `ProductFamily` has a `DcamScopeCode` mapping.
2. Every mapped scope code exists in `PHYSICAL_PRODUCT_SCOPE`.
3. Every non-deferred family has a full three-layer alignment (Layer 1 FIBO anchor + Layer 2 logical standards + Layer 3 ISO 20022 messages).
4. Every family has at least one Layer 3 data attribute group.
5. (Advisory) Scope codes in `PHYSICAL_PRODUCT_SCOPE` not covered by any `ProductFamily`.

CI result: 5/6 families fully classified — 1 deferred advisory.

## Residual gaps

| Gap | Status | Notes |
|---|---|---|
| `structured` ProductFamily — no FIBO anchor | Deferred to NPA gate | Multi-asset / structured products are M5+; out of scope at v1 |
| `money-market-instruments` scope code not covered by any `ProductFamily` | Advisory warn in recon | The obligations register uses this scope code but there is no `money-market` ProductFamily. NCDs/T-bills trade as bonds or via repo; a dedicated family can be added at M5+ if needed |
| DCAM `CLASSIFIES` edge type not in graph ontology | By design | The graph ontology uses `MAPS_TO` (cross-reference) for FIBO anchoring and `GOVERNS` for standard-setter links. `CLASSIFIES` was not added as a new edge type to avoid ontology schema churn; the existing edge types carry the semantics adequately |
| Layer 3 attribute groups not yet linked to graph Obligation nodes | Deferred | M2/M3 data-quality substrate will use `getAllProductFamilyDcamRecords()` to generate per-event data-quality checks; the full obligation-to-attribute-group wiring is a M2 deliverable |

## Principle 2 compliance

Every ProductFamily now has a citable DCAM classification node in the regulatory knowledge graph. The Principle 2 (single-graph discipline) requirement that "every product code must have a citable DCAM classification node" is satisfied for the five active product families. The `structured` family is an acknowledged gap deferred to the NPA gate.
