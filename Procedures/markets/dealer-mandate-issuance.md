---
procedureId: PROC-MK-MDI-01
title: Dealer mandate issuance, review, and revocation
author: Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance)
status: POPULATED
version: "0.1"
last-updated: "2026-05-16"
policy-cited: TRADING-MANDATE-V1
system-capability: "@platform/markets/mandate-registry (PLANNED)"
citations:
  - TRADING-MANDATE-V1
  - Banks Act Regulation 39
  - D-MARKETS-SCHEMA-FOUNDATION
---

# Procedure — Dealer mandate issuance, review, and revocation

**Procedure ID:** PROC-MK-MDI-01
**Owner:** Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance)
**Approval:** BRC (TRADING-MANDATE-V1)
**Cadence:** Per-request (issuance / amendment / revocation); annual blanket review of all active mandates
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- TRADING-MANDATE-V1 — the bank's approved trading mandate framework; defines dealer categories, product scope, notional limits, tenor limits, and escalation thresholds.
- Banks Act Regulation 39 — requires that trading authority is formally delegated in writing and that delegation records are maintained; non-delegated trades are void.

The obligation chain:

```
Regulation (Banks Act Reg 39 — written trading authority delegation)
  → TRADING-MANDATE-V1 (trading mandate framework)
    → PROC-MK-MDI-01 (this procedure)
      → @platform/markets/mandate-registry (PLANNED)
        → DealerMandateIssued / DealerMandateRevoked events
```

**Build-phase posture:** No live trading. Mandate records are prepared and validated during the build phase so that they are production-ready at commencement of trading. The issuance procedure exercises the full workflow in rehearsal mode.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act Regulation 39 | Trading authority must be formally delegated in writing; scope (products, notional, tenor) must be explicit; delegation records retained for the life of the mandate plus 7 years. |
| TRADING-MANDATE-V1 | Internal framework setting dealer categories (Junior Dealer, Senior Dealer, Principal), product eligibility per category, and limit calibration methodology. |
| Principle 6 (autonomous-by-default) | Default actor in mandate workflow is an agent; human steps (Helena risk review, Rohan limit-calibration) are P6-cited in the steps table. |

## 3. Purpose

1. Provide a structured, auditable pathway for issuing individual dealer mandates that formally delegate product, notional, and tenor authority to each dealer operating on the bank's trading desk.
2. Ensure every mandate has completed credit/risk review (Helena) and quantitative limit-calibration (Rohan) before a `DealerMandateIssued` event is emitted.
3. Maintain an immutable mandate registry so that any trade can be validated against the dealer's mandate at execution time.
4. Provide a controlled process for amending or revoking mandates when a dealer's role, risk appetite, or regulatory standing changes.

## 4. Trigger

- **Issuance:** `DealerMandateRequested { dealerId, dealerName, category, proposedProductScope, proposedNotionalLimits, proposedTenorLimits, requestedBy: Saskia, requestedAt }` — emitted when Saskia determines a new dealer mandate is required.
- **Amendment:** `DealerMandateAmendmentRequested { dealerId, mandateId, amendments, requestedBy, requestedAt }`.
- **Revocation:** `DealerMandateRevocationRequested { dealerId, mandateId, reason, requestedBy, requestedAt }`.
- **Annual review:** `AnnualMandateReviewDue { year }` — triggers blanket review of all active mandates.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Saskia (Head of Global Markets) identifies the need for a new or amended dealer mandate; reviews the proposed product scope and limits against TRADING-MANDATE-V1 category limits; submits `DealerMandateRequested` | `human` (Saskia — Chief Markets Officer, governance) | `@platform/markets/mandate-registry` (PLANNED) | Proposal must specify: dealer category (Junior / Senior / Principal), product scope (e.g. FX spot, OTC IRS), single-trade notional limit, portfolio notional limit, max tenor. |
| 2 | Helena (Chief Risk Officer, governance) reviews the credit and counterparty risk implications of the proposed mandate; assesses whether the proposed limits are consistent with the bank's current risk appetite statement (RAS) and capital allocation; approves or returns for revision | `human` (Helena — Chief Risk Officer, governance) | None — risk judgment | Helena's review must be completed within 2 business days of mandate request. Return-for-revision requires Helena to document the gap in writing (chat or event body). |
| 3 | Rohan (Market Risk Quant Engineer) calibrates the quantitative limits: VaR contribution, DV01 per tenor bucket (IRS/FX), and maximum single-trade notional consistent with the bank's intraday liquidity buffer; produces a limit-calibration note | `agent` (Rohan — Market Risk Quant Engineer) | `@platform/risk/var-engine` (PLANNED) | Limit-calibration note is an input artefact, not a separate event; it is referenced by hash in the `DealerMandateIssued` event body. |
| 4 | If Helena approves and Rohan's calibration is consistent with the proposal: Saskia emits `DealerMandateIssued { dealerId, mandateId, category, productScope, notionalLimits, tenorLimits, effectiveFrom, limitCalibrationHash, approvedBy: Helena, issuedBy: Saskia, issuedAt }` | `agent` | `@platform/event-store` | This event is the canonical mandate record per Principle 1. `mandateId` follows the pattern `MDT-{dealerInitials}-{YYYYMMDD}`. |
| 5 | Mandate registry projection updated: `@platform/markets/mandate-registry` ingests the event and makes the mandate queryable for pre-trade validation | `agent` | `@platform/markets/mandate-registry` (PLANNED) | Pre-trade validation (PROC-MK-PCG-01) will query this registry on every trade. |
| 6 | Dealer notified: automated notification sent to the dealer confirming mandate details, effective date, and escalation thresholds; dealer must acknowledge receipt within 1 business day | `agent` | `@platform/notifications` (PLANNED) | Acknowledgement event: `DealerMandateAcknowledged { mandateId, dealerId, acknowledgedAt }`. No trading under the mandate until acknowledged. |
| 7 | Mandate document (structured JSON rendering of the event) stored in the document store (BLAKE3-addressed); stored reference recorded in `DealerMandateIssued.documentHash` | `agent` | `@platform/doc-store` | Document must be printable as a signed PDF for Regulation 39 compliance at commencement-of-trading. |
| 8 | **Amendment path:** On `DealerMandateAmendmentRequested`: repeat steps 2–7 with amended parameters; emit `DealerMandateAmended { mandateId, dealerId, amendments, previousVersion, amendedAt }`; registry projection updated | `agent` + `human` (Helena, Rohan) | Same as above | Prior mandate version retained in event log; amendment creates a new version, not an overwrite. |
| 9 | **Revocation path:** On `DealerMandateRevocationRequested`: Helena approves revocation; Saskia emits `DealerMandateRevoked { mandateId, dealerId, reason, effectiveAt, revokedBy: Saskia, approvedBy: Helena }`; registry removes dealer from active-mandate list; dealer notified immediately | `human` (Saskia + Helena) | `@platform/event-store` | Revocation is immediate — no grace period. Any open trades placed after `DealerMandateRevoked.effectiveAt` are flagged for review. |
| 10 | **Annual blanket review:** On `AnnualMandateReviewDue`: Rohan re-runs limit calibration for all active mandates; Helena reviews for RAS alignment; Saskia confirms product scope remains current; out-of-date mandates amended or revoked; `AnnualMandateReviewCompleted { year, mandatesReviewed, mandatesAmended, mandatesRevoked, completedAt }` emitted | `human` + `agent` | `@platform/markets/mandate-registry` (PLANNED) | Annual review must complete within 20 business days of `AnnualMandateReviewDue`. Overdue is a Vera finding. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Saskia (Head of Global Markets) | Mandate request initiation; issuance event emission; annual review coordination; revocation initiation |
| Helena (Chief Risk Officer, governance) | Credit/risk review (step 2); RAS alignment check; revocation approval |
| Rohan (Market Risk Quant Engineer) | Quantitative limit calibration (step 3); annual re-calibration (step 10) |
| Vera (internal audit engineer, governance) | Asserts every active dealer has a current acknowledged mandate; flags overdue annual reviews |
| BRC | TRADING-MANDATE-V1 framework approval; material limit-framework changes |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Helena rejects mandate (risk grounds) | Saskia + Helena joint discussion → CEO if unresolved | Within 2 business days |
| Rohan calibration flags RAS breach | Helena notified immediately; mandate paused pending RAS review | Immediate |
| Dealer does not acknowledge within 1 business day | Saskia escalates to Helena; trading suspended until acknowledged | 1 business day |
| Annual review not completed on time | Vera finding → Helena + CEO | Overdue date |
| Revocation contested by dealer | Imani (Legal / Contracts Engineer) engaged; Helena ruling is final pending CEO review | Within 1 business day |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/markets/mandate-registry` | PLANNED | Mandate store, pre-trade query interface, annual review workflow |
| `@platform/risk/var-engine` | PLANNED | VaR and DV01 limit calibration |
| `@platform/event-store` | Live | Canonical mandate events |
| `@platform/doc-store` | Live | BLAKE3-addressed mandate document storage |
| `@platform/notifications` | PLANNED | Dealer notification and acknowledgement |

## 9. Quality controls

- Every active dealer must have exactly one current `DealerMandateIssued` event without a downstream `DealerMandateRevoked`. Vera asserts this daily.
- Every `DealerMandateIssued` must reference a `limitCalibrationHash`. Missing hash is a Vera finding.
- No `TradeExecuted` event may reference a `dealerId` without an acknowledged active mandate. Pre-trade gate (PROC-MK-PCG-01) enforces this; Vera asserts it post-hoc.
- Annual review must produce `AnnualMandateReviewCompleted` within 20 business days of `AnnualMandateReviewDue`.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `DealerMandateRequested` | Event log | 7 years | Mandate initiation record |
| `DealerMandateIssued` | Event log | Permanent | Canonical mandate authority per Reg 39 |
| `DealerMandateAcknowledged` | Event log | 7 years | Acknowledgement trail |
| `DealerMandateAmended` | Event log | Permanent | Amendment history |
| `DealerMandateRevoked` | Event log | Permanent | Revocation record |
| Limit calibration note | Doc store (BLAKE3) | 7 years | Referenced by hash in mandate event |
| `AnnualMandateReviewCompleted` | Event log | 7 years | Annual review record |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — mandate request, Helena risk review, Rohan limit-calibration, issuance event, dealer notification, document storage; amendment and revocation paths; annual blanket review; Banks Act Reg 39 compliance. |
