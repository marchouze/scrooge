---
title: "Rehearsal scenarios 03-05 — Slice 1 completion brief"
author: Niko (Client lifecycle engineer, engineering)
date: 2026-05-12
decision-required: false
---

# Rehearsal scenarios 03-05 — Slice 1 completion brief

**Author:** Niko (Client lifecycle engineer, engineering)
**Date:** 2026-05-12
**Authority:** D-PARTY-REGISTER · AML-CFT-POLICY-V1 · TRADING-MANDATE-V1 · FIC-ACT-38-2001

---

## What was built

Three synthetic counterparty rehearsal scenarios written to populate the live `/onboarding` dashboard page. Each scenario seeds a distinct path through the Slice-1 onboarding orchestrator (`platform/lifecycle/onboarding-orchestrator.ts`), which folds 12 customer event types into 21 phases.

All three scenarios were run and passed (`process.exit(0)`) before commit. CI gate (`bun run ci`) passes at exit code 0.

---

## Scenarios seeded

### 03-rehearsal-asset-manager.ts — `CP-SYN-AM-001`

**Counterparty:** Helios Asset Management (Pty) Ltd  
**Sector:** `asset-manager` | **Jurisdiction:** `ZA`  
**Terminal phase:** `activated`

Full Slice-1 walk across 8 events:

| Step | Event | Phase reached |
|------|-------|---------------|
| 1 | `CounterpartySoundingOpened` | `sounding` |
| 2 | `CounterpartyProspectRegistered` | `prospect-registered` |
| 3 | `KycCompleted` (Tier-1, low risk) | `cdd-initiated` |
| 4 | `DocumentationDrafted` (ISDA 2002) | `documentation-drafted` |
| 5 | `DocumentationReadyToExecute` (ISDA 2002) | `documentation-ready` |
| 6 | `AuthorisedSignatoryAdded` (scope: both) | `signatories-registered` |
| 7 | `MandateAssigned` (ZAR-IRS + ZAR-BOND, notional-cap R50m, RAS-B01) | `mandate-assigned` |
| 8 | `CounterpartyActivated` | `activated` |

Assertions: `status === "Active"`, `currentTier === "Tier-1"`, `isdaStatus === "Executed"`, `signatoryCount === 1`.

---

### 04-rehearsal-hedge-fund.ts — `CP-SYN-HF-001`

**Counterparty:** Meridian Opportunities Fund (RF) (Pty) Ltd  
**Sector:** `hedge-fund` | **Jurisdiction:** `ZA`  
**Terminal phase:** `mandate-assigned` (in-progress — not yet activated)

Walks 7 events to mandate-assigned, then stops. Demonstrates a counterparty that has cleared KYC and has a live mandate but has not yet crossed the activation gate:

| Step | Event | Phase reached |
|------|-------|---------------|
| 1 | `CounterpartySoundingOpened` | `sounding` |
| 2 | `CounterpartyProspectRegistered` | `prospect-registered` |
| 3 | `KycCompleted` (Tier-2, medium risk) | `cdd-initiated` |
| 4 | `DocumentationDrafted` (ISDA 2002) | `documentation-drafted` |
| 5 | `DocumentationReadyToExecute` (ISDA 2002) | `documentation-ready` |
| 6 | `AuthorisedSignatoryAdded` (scope: both) | `signatories-registered` |
| 7 | `MandateAssigned` (ZAR-IRS + ZAR-BOND, notional-cap R50m, RAS-B01) | `mandate-assigned` |

Assertions: `status === "MandateAssigned"`, `currentTier === "Tier-2"`, `isdaStatus === "ReadyToExecute"`, `signatoryCount === 1`.

---

### 05-rehearsal-market-maker.ts — `CP-SYN-MM-001`

**Counterparty:** Volta Market Making (Pty) Ltd  
**Sector:** `market-maker` | **Jurisdiction:** `ZA`  
**Terminal phase:** `offboarded` (adverse media finding)

Walks 4 events to `cdd-initiated` then offboards. Demonstrates the offboarded terminal state — KYC passed the initial gate, but extended due diligence surfaced an adverse media finding causing compliance rejection:

| Step | Event | Phase reached |
|------|-------|---------------|
| 1 | `CounterpartySoundingOpened` | `sounding` |
| 2 | `CounterpartyProspectRegistered` | `prospect-registered` |
| 3 | `KycCompleted` (Tier-1, low risk) | `cdd-initiated` |
| 4 | `CounterpartyOffboarded` (reason: "KYC failed — adverse media finding") | `offboarded` |

Assertions: `status === "Offboarded"`, `currentTier === "Tier-1"`.

---

## Dashboard impact

Once these scenarios are run against the production event store (or the dashboard server reads from a seeded store), `GET /api/onboarding` will return:

```json
{
  "totalCounterparties": 3,
  "activeCounterparties": 1,
  "inProgressCounterparties": 1,
  "phaseCounts": {
    "activated": 1,
    "mandate-assigned": 1,
    "offboarded": 1
  }
}
```

The `/onboarding` dashboard page will move from empty state to three populated counterparty rows spanning the three distinct lifecycle outcomes.

---

## Substrate gaps — 7 Slice-2 phases these scenarios cannot exercise

The Slice-1 orchestrator documents seven phases that have no backing event type yet. These scenarios cannot demonstrate them:

| Phase | Gap description | Slice 2 deliverable |
|-------|----------------|---------------------|
| `fais-categorised` (Phase 3) | No `FaisCategorised` event type in `@domains/customer` | Slice 2 event + projection |
| `bo-resolved` (Phase 5) | No `BeneficialOwnerResolved` event type | Slice 2 event + projection |
| `sanctions-cleared` (Phase 6) | No `SanctionsClearanceConfirmed` event type | Slice 2 event + projection |
| `fatca-crs-classified` (Phase 7) | No `FatcaCrsClassified` event type | Slice 2 event + projection |
| `popia-recorded` (Phase 8) | No `PopiaConsentRecorded` event type | Slice 2 event + projection |
| `credit-assessed` (Phase 10) | No `CreditAssessmentCompleted` event type | Slice 2 event + projection |
| `accounts-setup` (Phase 16) | No `AccountsSetupCompleted` event type | Slice 2 event + projection |

Additionally, `monitoring`, `kyc-refresh-due`, and `eligibility-revalidated` (phases 18-20) are post-activation lifecycle phases with no Slice-1 event backing and no current rehearsal coverage.

The `KycCompleted` event currently serves double duty as the `cdd-initiated` gate (Slice-1 simplification, noted in the orchestrator source). Slice 2 will separate `KycCompleted → cdd-initiated` from a dedicated `CddCompleted` event for `bo-resolved` + `sanctions-cleared`.

---

## Script entries added

```json
"scenario:rehearsal:am": "bun run scenarios/03-rehearsal-asset-manager.ts",
"scenario:rehearsal:hf": "bun run scenarios/04-rehearsal-hedge-fund.ts",
"scenario:rehearsal:mm": "bun run scenarios/05-rehearsal-market-maker.ts"
```
