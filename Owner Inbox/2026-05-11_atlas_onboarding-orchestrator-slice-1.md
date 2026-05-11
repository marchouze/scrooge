---
title: "Onboarding Orchestrator — Slice 1 completion brief"
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-11
decision-required: false
---

## What landed

Four files shipped as a single PR:

| File | Role |
|------|------|
| `prototype/platform/lifecycle/onboarding-orchestrator.ts` | Pure read-side projection; 21-phase fold over 12 customer event types |
| `prototype/platform/lifecycle/onboarding-orchestrator.test.ts` | 8 test cases (synthetic events only; no store reads) |
| `prototype/platform/lifecycle/index.ts` | Re-exports for the `@platform/lifecycle` alias |
| `prototype/dashboard/onboarding-view.ts` | Thin dashboard wrapper; injects real `eventStore` |

`prototype/dashboard/server.ts` was updated to wire `GET /api/onboarding`, which returns an `OnboardingBoardView` (phase counts, per-counterparty state, totals, `asOf`).

Authority: D-PARTY-REGISTER (CEO-approved 2026-05-11) · AML-CFT-POLICY-V1 (PR #261) · TRADING-MANDATE-V1 (PR #256) · FIC-ACT-38-2001.

## Architecture notes

**Projection pattern.** The orchestrator follows the `latest-wins-per-key` projection pattern established in `dashboard/markets-fx-counterparties.ts`, keyed on `counterpartyId`. A single `store.replay()` pass folds all 12 `CUSTOMER_EVENT_TYPES` in sequence order; non-customer events are silently ignored.

**Phase-mapping rationale.** `KycCompleted` advances to `"cdd-initiated"` as a Slice 1 simplification — KYC completion is treated as the CDD gate. Slice 2 will introduce dedicated `CddCompleted`, `BeneficialOwnerResolved`, `SanctionsClearanceRecorded`, `FatcaCrsClassified`, `PopiaConsentRecorded`, and `CreditAssessmentCompleted` event types to fill the seven substrate gaps below.

**Monotonicity.** Phase advances are monotonic except for `MandateRevoked`, which regresses to `"mandate-scoped"` regardless of the current position. `"activated"` and `"offboarded"` are terminal; `"offboarded"` always overrides.

**Purity.** The orchestrator module imports only from `@domains/customer/types` and `@platform/event-store/{store,types}`. It never imports from `@platform/composition`. The `onboarding-view.ts` wrapper owns the composition-root import.

## Substrate gaps surfaced

Seven phases have no backing event type in Slice 1:

| Phase | Gap | Status |
|-------|-----|--------|
| `fais-categorised` (phase 3) | No `FaisCategorised` event type | [substrate-gap: planned, Slice 2] |
| `bo-resolved` (phase 5) | No `BeneficialOwnerResolved` event type | [substrate-gap: planned, Slice 2] |
| `sanctions-cleared` (phase 6) | No `SanctionsClearanceRecorded` event type | [substrate-gap: planned, Slice 2] |
| `fatca-crs-classified` (phase 7) | No `FatcaCrsClassified` event type | [substrate-gap: planned, Slice 2] |
| `popia-recorded` (phase 8) | No `PopiaConsentRecorded` event type | [substrate-gap: planned, Slice 2] |
| `credit-assessed` (phase 10) | No `CreditAssessmentCompleted` event type | [substrate-gap: planned, Slice 2] |
| `accounts-setup` (phase 16) | No `AccountsConfigured` event type | [substrate-gap: planned, Slice 2] |

## Next step

Anya (Data / analytics engineer, engineering) to build the `/onboarding` dashboard page consuming `GET /api/onboarding`. The endpoint is live; the `OnboardingBoardView` shape is stable for Slice 1.
