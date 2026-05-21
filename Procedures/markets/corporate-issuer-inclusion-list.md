---
procedureId: PROC-MK-CIL-01
title: Corporate issuer inclusion/exclusion from approved-counterparty list
author: Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance)
status: POPULATED
version: "0.1"
last-updated: "2026-05-16"
policy-cited: Counterparty Credit Policy (planned)
system-capability: "@platform/markets/counterparty-registry (PLANNED)"
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - Banks Act Regulation 39
  - FAIS Act GCC s4
---

# Procedure — Corporate issuer inclusion/exclusion from approved-counterparty list

**Procedure ID:** PROC-MK-CIL-01
**Owner:** Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance)
**Approval:** BRC (Counterparty Credit Policy — planned)
**Cadence:** Per-request (inclusion / exclusion); annual refresh of full approved list
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Counterparty Credit Policy (planned; Helena co-author; BRC approval required at commencement of trading).
- FAIS Act General Code of Conduct §4 — conduct due diligence obligations on counterparties.
- KYC/AML Policy (Zara-owned) — customer due diligence requirements must be satisfied before any trading relationship.

The obligation chain:

```
Regulation (Banks Act — counterparty risk management; FAIS GCC §4 — conduct due diligence)
  → Counterparty Credit Policy (planned)
    → PROC-MK-CIL-01 (this procedure)
      → @platform/markets/counterparty-registry (PLANNED)
        → CounterpartyApproved / CounterpartyExcluded events
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act Regulation 39 | Banks must maintain formal approved-counterparty lists with documented credit and conduct due diligence on record. |
| FAIS Act GCC §4 | FSP must conduct counterparty due diligence before executing transactions; suitability and capacity assessments are required. |
| FICA s.21 | Customer identification and verification obligations apply to counterparties; KYC must be current before trading commences. |
| TCF Outcome 4 | Products and counterparty relationships must be appropriate for the bank's institutional mandate and risk appetite. |

## 3. Purpose

1. Provide a controlled, multi-gate approval pathway for adding corporate issuers to the bank's approved-counterparty list for FX spot and bond transactions.
2. Ensure every inclusion has passed KYC/conduct due diligence (Zara), credit review (Helena), and legal capacity review (Imani) before a `CounterpartyApproved` event is emitted.
3. Provide an equivalent controlled pathway for removing corporate issuers when credit standing, conduct, or legal status changes.
4. Maintain the approved-counterparty list in the party register as the single authoritative source, so that pre-trade conduct gate (PROC-MK-PCG-01) can query it in real time.

## 4. Trigger

- **Inclusion request:** `CounterpartyInclusionRequested { counterpartyId, legalName, lei, proposedProducts, requestedBy: Saskia, requestedAt }`.
- **Exclusion request:** `CounterpartyExclusionRequested { counterpartyId, legalName, reason, requestedBy, requestedAt }`.
- **Annual refresh:** `AnnualCounterpartyListRefreshDue { year }`.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Saskia (Head of Global Markets) identifies a corporate issuer for potential inclusion; confirms business rationale (proposed products, estimated volume, strategic relationship); submits `CounterpartyInclusionRequested` with supporting documentation | `human` (Saskia — Chief Markets Officer, governance) | `@platform/markets/counterparty-registry` (PLANNED) | Required documentation: company registration, LEI, audited financials (latest 2 years), credit rating (if available), product scope proposed. |
| 2 | **KYC/conduct due diligence (Zara):** Zara (MLRO, governance) conducts customer due diligence per FICA s.21: identity verification, UBO mapping, sanctions screening (OFAC, UN, SA PFA lists), PEP screening, adverse media check; classifies counterparty risk tier (Low / Medium / High) | `human` (Zara — MLRO, governance) | `@platform/compliance/kyc-engine` (PLANNED) | Zara must complete KYC within 5 business days. High-risk counterparties require enhanced due diligence (EDD) and Helena's explicit sign-off before proceeding. Zara emits `KycCddCompleted { counterpartyId, riskTier, eddRequired, completedAt }`. |
| 3 | **Credit review (Helena):** Helena (Chief Risk Officer, governance) assesses counterparty credit quality: internal credit scoring, external rating if available, financial ratio analysis, sector concentration check against the bank's credit risk appetite; recommends credit limit for the approved-counterparty record | `human` (Helena — Chief Risk Officer, governance) | `@platform/risk/credit-limit-engine` | Helena must complete credit review within 5 business days of Zara's KYC completion. Helena emits `CounterpartyCreditReviewCompleted { counterpartyId, internalCreditScore, proposedCreditLimit, rationale, completedAt }`. |
| 4 | **Legal capacity review (Imani):** Imani (Legal / Contracts Engineer) confirms: (a) counterparty has legal capacity to enter FX spot and bond transactions; (b) ISDA Master Agreement or equivalent is in place or being executed; (c) netting enforceability confirmed for the counterparty's jurisdiction | `agent` (Imani — Legal / Contracts Engineer) | `@platform/legal/isda-registry` (PLANNED) | ISDA check: if ISDA is not yet in place, Imani flags this and inclusion is conditional on ISDA execution. Imani emits `LegalCapacityConfirmed { counterpartyId, isdaStatus, nettingEnforceability, completedAt }`. |
| 5 | **Inclusion decision:** If Zara's KYC is approved, Helena's credit review is approved, and Imani's legal capacity is confirmed: Saskia emits `CounterpartyApproved { counterpartyId, legalName, lei, approvedProducts, creditLimit, riskTier, isdaRef, approvedBy: [Zara, Helena, Imani, Saskia], effectiveFrom, approvedAt }` | `human` (Saskia) | `@platform/event-store` | This event is the canonical inclusion record. Any one of the three reviews can block inclusion by returning a negative disposition. |
| 6 | **Party register update:** The party register (D-PARTY-REGISTER) is updated with the new counterparty's approved status, LEI, credit limit, and risk tier; this update makes the counterparty queryable by PROC-MK-PCG-01 | `agent` | `@platform/party-register` | Party register is the authoritative source; counterparty-registry projection derives from it. |
| 7 | **Exclusion path:** On `CounterpartyExclusionRequested`: Helena reviews the grounds; if approved: Saskia emits `CounterpartyExcluded { counterpartyId, reason, openPositionsFlag, excludedAt, excludedBy }`; counterparty-registry removes from approved list; open trades flagged for review | `human` (Saskia + Helena) | `@platform/event-store` | Open positions at time of exclusion are reviewed by Helena and Saskia; positions must be unwound or novated; unwind timeline set by Helena based on market liquidity. |
| 8 | **Annual refresh:** On `AnnualCounterpartyListRefreshDue`: Zara re-runs KYC refresh for all active counterparties; Helena re-runs credit reviews; Imani confirms ISDA currency; counterparties failing refresh are excluded (step 7); `AnnualCounterpartyListRefreshCompleted { year, counterpartiesReviewed, counterpartiesExcluded, completedAt }` emitted | `human` + `agent` | Various | Annual refresh must complete within 30 business days. Overdue is a Vera finding. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Saskia (Head of Global Markets) | Inclusion/exclusion requests; final approval event emission; annual refresh coordination |
| Zara (MLRO, governance) | KYC/CDD/EDD; sanctions and PEP screening; risk-tier classification |
| Helena (Chief Risk Officer, governance) | Credit review; credit-limit recommendation; exclusion approval |
| Imani (Legal / Contracts Engineer) | Legal capacity confirmation; ISDA status; netting enforceability |
| Vera (internal audit engineer, governance) | Annual assertion that all active counterparties have current KYC and credit reviews |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| High-risk counterparty (Zara EDD flag) | Helena explicit sign-off required before proceeding | Before step 3 |
| Helena credit review negative | Saskia + Helena discussion; CEO if strategic importance is argued | Within 2 business days |
| ISDA not in place at inclusion date | Imani expedites; inclusion blocked until ISDA signed | Per Imani timeline |
| Counterparty sanctioned post-inclusion | Zara immediate exclusion trigger; Devon (COO) + Mira regulatory notification | Immediate |
| Annual refresh overdue | Vera finding → Helena → CEO | Overdue date |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/markets/counterparty-registry` | PLANNED | Approved-counterparty list; pre-trade query interface |
| `@platform/compliance/kyc-engine` | PLANNED | KYC/CDD/EDD workflow; sanctions screening |
| `@platform/risk/credit-limit-engine` | LIVE | Credit limit projection, pre-deal headroom check, breach detection, LEX cap check |
| `@platform/legal/isda-registry` | PLANNED | ISDA agreement status and enforceability confirmation |
| `@platform/party-register` | Live (Phase 3) | Canonical party records; counterparty approved-status field |
| `@platform/event-store` | Live | Inclusion/exclusion events |

## 9. Quality controls

- Every active counterparty must have a current `CounterpartyApproved` event without a downstream `CounterpartyExcluded`. Vera asserts daily.
- Every `CounterpartyApproved` must reference completed `KycCddCompleted`, `CounterpartyCreditReviewCompleted`, and `LegalCapacityConfirmed` events. Missing references are Vera findings.
- Annual refresh must produce `AnnualCounterpartyListRefreshCompleted` within 30 business days.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `CounterpartyInclusionRequested` | Event log | 7 years | Request trail |
| `KycCddCompleted` | Event log | 7 years | FICA s.21 compliance record |
| `CounterpartyCreditReviewCompleted` | Event log | 7 years | Credit due diligence record |
| `LegalCapacityConfirmed` | Event log | 7 years | Legal capacity evidence |
| `CounterpartyApproved` | Event log | Permanent | Canonical inclusion record |
| `CounterpartyExcluded` | Event log | Permanent | Exclusion record |
| `AnnualCounterpartyListRefreshCompleted` | Event log | 7 years | Annual review record |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — Saskia proposal, Zara KYC/CDD, Helena credit review, Imani legal capacity, inclusion event, party register update, exclusion path, annual refresh; FICA + FAIS GCC + Banks Act Reg 39 sourcing. |
