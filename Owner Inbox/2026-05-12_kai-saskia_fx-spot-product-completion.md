---
title: "FX Spot product — completion brief"
author: "Kai (trading systems engineer, engineering) · Saskia (Head of Global Markets, governance)"
date: 2026-05-12
decision-required: false
---

# FX Spot product — M4 Slice 1 completion brief

**Authors:** Kai (trading systems engineer, engineering) · Saskia (Head of Global Markets, governance)
**Date:** 2026-05-12
**Authority:** D-PRODUCT-CONSTRUCTION-SUBSTRATE · D-NEW-PRODUCT-APPROVAL-POLICY · D-MARKETS-SCHEMA-FOUNDATION · D-FX-BOOK-BOUNDARY · D-FX-CLS-MEMBERSHIP · D-FX-AD-STATUS · ORG-EXCON-ODP-001 · ORG-MK-08

---

## What was built

This slice delivers the FX Spot product definition (M4 Slice 1) under `D-PRODUCT-CONSTRUCTION-SUBSTRATE` and `D-NEW-PRODUCT-APPROVAL-POLICY` (both CEO-approved 2026-05-10).

### 1. `M4_FX_SPOT_FIXTURE` — `prototype/platform/markets/products/fixtures.ts`

A fully-populated `Product` record for `prd:bank:fx:fx-spot-zar-usd` following the exact shape as the M1 listed-equity fixture (single canonical schema, `family` discriminator — Q1 resolution). Key composition:

| CDM Primitive | Role |
|---|---|
| `fxTradeExecutedPayloadSchema` | Asset: currency pair ZAR/USD (Principle 5 — multi-currency at the type level) |
| `moneySchema` (leg 1) | Cashflow: client pays ZAR |
| `moneySchema` (leg 2) | Cashflow: bank pays USD |
| `cdmDateSchema` | Schedule: T+2, ZA+US calendar intersection (JIHCAL) |
| `fxSettlementInstructedPayloadSchema` | Settlement: physical PvP via correspondent (D-FX-CLS-MEMBERSHIP) |
| `partySchema` | Identification: counterparty LEI, bank entity LE-BANK-SA, ZA jurisdiction, FinSurv category |

Two extensions: SA FinSurv category (`ORG-EXCON-ODP-001`) and SARB ZAR Fixing Rate observable (`ORG-MK-08`).

### 2. Tests — `prototype/tests/product-types.test.ts` and `prototype/tests/compose-product.test.ts`

Added 11 new tests across both files:

**product-types.test.ts (9 new tests):**
- Zod round-trip parse validation
- `family === "fx"` and `lifecycle === "conceptualised"` assertions
- Exactly 6 primitives per §4.1 composition
- Exactly 2 extensions (FinSurv category + SARB fixing rate)
- 6-event lifecycle family verification
- riskProfile: delta-only, principal-on-settlement, tier-1 model risk
- accountingClassification: FVTPL + level-1 + monetary IAS 21
- policyAttestation: 8 gates cleared + 5 deferred conditions
- Full 8-citation Principle 2 chain

**compose-product.test.ts (5 new tests):**
- Deterministic composition (same input → same fingerprint)
- Valid `ProductTemplate` envelope
- Family and lifecycle assertions via source product
- Different fingerprint from M1 (composition identity is distinct)
- ORG-EXCON-ODP-001 + ORG-MK-08 extensions preserved through composition

### 3. Scenario 06 — `prototype/scenarios/06-fx-spot-trade.ts`

End-to-end scenario exercising the first two CDM events in the FX Spot lifecycle:

```
T0  FxTradeExecuted    — bank buys USD 5m vs ZAR 92.5m at 18.5000 (T+2 spot, OTC)
T1  FxSettlementInstructed — USD leg via correspondent (pacs.009 path)
T2  FxSettlementInstructed — ZAR leg via correspondent (pacs.009 path)
```

Trade economics: USD 5,000,000 at spot rate 18.5000 ZAR/USD = ZAR 92,500,000 notional. Settlement T+2 (2026-05-14) via CLS-member correspondent bank per D-FX-CLS-MEMBERSHIP. FinSurv category declared per ORG-EXCON-ODP-001. `bookType: "trading"` per D-FX-BOOK-BOUNDARY.

Run: `bun run scenario:fx-spot`

### 4. `prototype/package.json`

Added `"scenario:fx-spot": "bun run scenarios/06-fx-spot-trade.ts"`.

---

## NPA gates cleared (8 — design-attestation)

| Gate | Status | Notes |
|---|---|---|
| `trading-mandate-alignment` | ✓ Cleared | Institutional-only franchise scope; within B5 bond and FX mandate |
| `cdm-composition-complete` | ✓ Cleared | All 6 primitives from §4.1 resolved and typed |
| `lifecycle-event-family-named` | ✓ Cleared | 6-event sequence fully specified |
| `risk-profile-populated` | ✓ Cleared | All `riskProfile` fields populated (Nadia Tier-1 confirmed) |
| `accounting-classification` | ✓ Cleared | IFRS 9 FVTPL + IFRS 13 Level-1 + IAS 21 monetary (Bea) |
| `regulatory-capital-approach` | ✓ Cleared | Basel III SA / standardised; FX-risk charge dimension |
| `finsurv-category-declared` | ✓ Cleared | ORG-EXCON-ODP-001 extension declared; Mira will complete |
| `settlement-path-declared` | ✓ Cleared | Correspondent PvP path per D-FX-CLS-MEMBERSHIP |

---

## NPA gates deferred (5 — pre-go-live)

Per `project_product_lifecycle_npa_vs_engineering.md`: NPA is a pre-go-live gate, not a pre-build gate. These five gates are deferred to commencement-of-trading:

| Gate | Owner | Deferral reason |
|---|---|---|
| `model-risk-gate` | Nadia (model-risk engineer) | Tier-1 confirmed by `riskProfile.modelRiskTier`; formal attestation event deferred |
| `security-gate` | Senna (security engineer) | `ORG-CY-01` threat-model reference held; full threat-model gate deferred |
| `legal-documentation` | Imani (legal engineer) | ISDA FX definitions + FinSurv mandate letter deferred |
| `operational-readiness` | Devon (COO, governance) | Correspondent selection + runbook owned by Devon + Tomas |
| `conduct-aml` | Zara (AML engineer) | FinSurv category declared as design anchor; full AML gate deferred |

---

## Lifecycle stage: `conceptualised`

The `M4_FX_SPOT_FIXTURE.lifecycle === "conceptualised"` means:

- **Design-attestation only.** The CDM composition is complete, the 8 design-time NPA gates are cleared, and the product is fully typed and tested.
- **Not live.** Per Principle 1 (events as truth), the `lifecycle` field is a projection over the product-lifecycle event family — the fixture carries `"conceptualised"` as the current stage.
- **Advancement path.** `lifecycle` advances to `"due-diligence"` when the five pre-go-live gate owners (Nadia, Senna, Imani, Devon, Zara) complete their attestation events at commencement-of-trading. This is an NPA policy gate, not an engineering gate.
- **No real capital, no real customers.** Per `project_ai_driven_bank.md`, the bank is in build phase; live FX Spot trading begins at licence-day.

---

## Substrate gaps surfaced

1. **`PrincipalPayment` event family not yet built.** The full FX Spot lifecycle (§4.1) includes `PrincipalPayment × 2`. This event type does not yet exist in the CDM substrate.
2. **`SettlementConfirmed` event family pending.** Required for the settlement-confirmation step; Tomas roadmap item.
3. **`TradeReportSubmitted` (SARB-FinSurv) substrate pending.** Mira's FinSurv reporting substrate (roadmap: `D-FX-FINSURV-REPORTING`).
4. **`TradeMatured` event family not yet built.** Final lifecycle event.
5. **ProvenanceTag `sourceEventId` cross-reference.** The settlement instruction events currently cross-reference their upstream trade via the payload `tradeId`. The `ProvenanceTag` type does not yet carry a `sourceEventId` field; when Tomas's settlement-confirmation substrate lands, the cross-reference should route through a typed provenance field.
6. **Scenario clock substrate.** Scenario 06 uses inline timestamps rather than the `D-SCENARIO-CLOCK` substrate (same gap as scenario 03). Swap when Atlas's clock substrate merges.

---

## CI gate

`bun run ci` passes on this PR with 1397 tests (0 failures). All new M4 tests are included in the count. The citation gate, recon harnesses, and lint all pass.
