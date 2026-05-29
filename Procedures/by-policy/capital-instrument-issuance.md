---
policy-parent: Capital Management Policy (planned — Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md)
last-reviewed: 2026-05-15
procedureId: PROC-CAP-CII-01
title: Capital instrument issuance
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-15
owner: Camille (Chief Financial Officer, governance) · Eitan (Treasurer)
status: POPULATED
policy-cited: Capital Management Policy (planned — Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md)
system-capability: prototype/platform/capital/instrument-issuance-engine (PLANNED)
---

# Procedure — Capital instrument issuance

**Procedure ID:** PROC-CAP-CII-01
**Owner:** Camille (Chief Financial Officer, governance) · Eitan (Treasurer)
**Approval:** Board (with SARB no-objection for AT1 / Tier 2)
**Cadence:** On demand (triggered by capital plan or regulatory trigger); build-phase dormant
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

---

## 1. Source policy

- `Capital Management Policy v0.1` (planned — under `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md`) — primary source; defines the bank's capital adequacy targets, instrument eligibility criteria (CET1 / AT1 / Tier 2), SARB approval requirements, and the issuance decision framework.
- `Policies/market-risk-policy-v1.md` — trading-book capital treatment (co-source for Tier 1 instruments that may be used to support FRTB capital).

Obligation chain:

```
Banks Act 94/1990, section 70 + Regulations Relating to Banks (RRB), Regulation 38–40
  + Basel III Implementation (Directive 1 of 2013; D1/2013)
    → Capital Management Policy v0.1
      → PROC-CAP-CII-01 (this procedure)
        → @platform/capital/instrument-issuance-engine (PLANNED)
```

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-BA-14` | Minimum capital adequacy ratios per Regulation 38: CET1 ≥ 4.5% + conservation buffer; Tier 1 ≥ 6%; Total capital ≥ 8% of RWA. |
| `ORG-BA-15` | AT1 and Tier 2 instruments must meet eligibility criteria in D1/2013; SARB written no-objection required before issuance. |
| `ORG-BA-16` | SARB must be notified of any new capital instrument issuance within the prescribed timeframe; instrument terms and conditions submitted with the application. |
| Banks Act 94/1990, s.70 | Minimum capital and reserve requirements; SARB may direct capital remediation. |
| Regulation 38 (RRB) | Qualifying criteria for CET1, AT1, and Tier 2 capital instruments; loss-absorption provisions; PONV trigger requirements for AT1. |
| SARB Directive 1 of 2013 (D1/2013) | Basel III capital instrument eligibility criteria as adopted in SA; AT1 instruments must include a contractual PONV write-down or conversion mechanism; Tier 2 instruments must have ≥ 5 years remaining maturity at issuance. |

---

## 3. Purpose

Govern the end-to-end lifecycle of capital instrument issuance — from Board approval through SARB no-objection to issuance, settlement, and registration in the capital ledger. The procedure:

1. Evaluates proposed instruments against RRB / D1/2013 eligibility criteria (CET1 ordinary shares, AT1 perpetual notes / contingent convertible bonds, Tier 2 dated subordinated notes).
2. Obtains Board approval and SARB written no-objection before any AT1 or Tier 2 instrument is issued.
3. Manages the issuance mechanics — term-sheet negotiation, prospectus / information memorandum, JSE / STRATE settlement, CIPC registration where required.
4. Records the instrument and its contractual terms in the capital ledger; emits the canonical `CapitalInstrumentIssued` event.
5. Maintains the instrument register throughout the instrument's lifecycle (coupon / dividend payments, write-down / conversion trigger monitoring, redemption / maturity).

The procedure activates at licence-day when the bank first issues regulatory capital beyond the founding ordinary shares.

---

## 4. Trigger

- **Capital plan trigger:** `CapitalPlanUpdated { scenario, projected_shortfall_pct }` event — where the capital plan identifies that a projected ratio falls below the internal target buffer (typically CET1 < 6% or Tier 1 < 8% in the base scenario), Camille initiates an issuance review.
- **Regulatory trigger:** SARB PA directive or ICG requirement; `SARBDirectiveReceived { type: capital_remediation }` event triggers priority issuance.
- **Board-authorised issuance programme:** Board resolution (pre-approved issuance programme for AT1 / Tier 2 instruments up to a specified aggregate notional) triggers Eitan to prepare the term sheet within the approved envelope.
- **Refinancing / maturity trigger:** For existing Tier 2 instruments with < 2 years to maturity, `CapitalInstrumentMaturityApproaching { instrument_id, maturity_date }` event; Eitan initiates a replacement issuance review.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Camille reviews the capital position against targets; runs a pro-forma impact on CET1 / Tier 1 / Total capital ratios under the proposed issuance; confirms instrument type (CET1 ordinary shares, AT1, or Tier 2) and approximate notional required. Emit `CapitalIssuanceProposalInitiated { proposal_id, instrument_type, target_notional, rationale }` | `human` (Camille) | `@platform/capital/ratio-engine` ✓ (partial) | Ordinary share issuances are CET1; no SARB no-objection required but prospectus rules apply. AT1 / Tier 2 require SARB no-objection. |
| 2 | Imani (Legal engineer, legal) reviews RRB / D1/2013 eligibility criteria for the proposed instrument; drafts the term sheet ensuring PONV write-down clause (AT1) or 5-year minimum maturity (Tier 2); confirms legal-entity issuer and governing law. Emit `CapitalInstrumentTermSheetDrafted { proposal_id, instrument_type, ponv_clause_present, governing_law }` | `human` (Imani) | `@platform/document-store` ✓ | AT1 term sheets must include a contractual write-down mechanism triggered at PONV (CET1 < 5.125% or SARB direction). Imani confirms with external counsel if novel structure. |
| 3 | Helena (Chief Risk Officer, governance) reviews the capital impact: stress-test sensitivity of the proposed instrument type under ICAAP adverse scenario; confirms the instrument does not create PONV trigger proximity risk; signs off `CapitalIssuanceRiskApproved { proposal_id, risk_approved_by: helena, stressed_cet1_post_issuance }` | `human` (Helena) | `@platform/risk/stress-test-engine` ✓ (partial) | Risk sign-off is required before Board submission. Helena's review uses the stress-test cycle (PROC-RISK-ST-01) adverse scenario. |
| 4 | Owen (Company Secretary, governance) prepares the Board paper citing the Capital Management Policy; schedules for Board approval meeting. Board resolution to authorise issuance is captured by Owen; emit `BoardResolutionRecorded { resolution_id, type: capital_issuance, authorised_notional, instrument_type }` | `human` (Owen) + Board | `@platform/event-store` ✓ | Board resolution is the corporate authority gate. For an ordinary share issuance, this also covers Companies Act s.38–40 requirements (shares issued within authorised capital). |
| 5 | For AT1 or Tier 2 instruments: Camille + Mira (Regulatory intelligence engineer, compliance) prepare and submit the SARB PA no-objection application, including term sheet, Board resolution, and D1/2013 eligibility self-assessment. Record submission: `SARBNoObjectionApplicationSubmitted { proposal_id, submitted_at }` | `human` (Camille + Mira) | `@platform/document-store` ✓ | SARB PA response time is typically 20–40 business days. Camille monitors the application; Helena is copied on the PA response. Step 6 is blocked until SARB no-objection is received. |
| 6 | SARB issues written no-objection; Mira records it: `SARBNoObjectionReceived { proposal_id, sarb_reference, received_at }`. If SARB declines or conditions the instrument, Camille + Imani review and amend the term sheet before resubmitting | `human` (Mira) | `@platform/event-store` ✓ | No-objection is required before proceeding to Step 7. Any SARB conditions are tracked in the instrument register. |
| 7 | Eitan manages the issuance mechanics: investor engagement (where listed / private placement), prospectus or information memorandum (FSCA requirements), JSE / STRATE settlement arrangement for listed instruments, transfer agent appointment for private notes. Emit `CapitalInstrumentIssuanceMechanicsCompleted { proposal_id, settlement_channel, pricing_date }` | `human` (Eitan) | `@platform/treasury/instrument-register` (`PLANNED`) | For a JSE-listed bond, the prospectus must be FSCA-approved. For a private placement, an Information Memorandum (exempt from FSCA prospectus requirements under Companies Act s.96). |
| 8 | On settlement date: proceeds received; shares / notes registered; emit `CapitalInstrumentIssued { instrument_id, proposal_id, type, notional, currency, issue_date, maturity_date, coupon_rate_or_dividend, ponv_trigger, sarb_reference, strate_isin }` | `system` | `@platform/capital/instrument-issuance-engine` (`PLANNED`) + `@platform/event-store` ✓ | `CapitalInstrumentIssued` is the canonical event that updates the capital ledger projection and the capital-ratio computation. The instrument is now part of the Tier 1 or Tier 2 regulatory capital stack. |
| 9 | Bea (Finance / reporting engineer, engineering) books the proceeds: STRATE delivery vs. payment confirmed; journal entry posted (Dr Cash / Cr Share Capital or Subordinated Debt); `LedgerEntryPosted { instrument_id, entry_type: capital_issuance, amount }` emitted | `system` + `human` (Bea) | `@platform/ledger/posting-engine` ✓ | CET1 issuances increase share capital. AT1 / Tier 2 issuances increase subordinated debt liabilities. Treatment per IAS 32 (equity vs. debt classification). |
| 10 | Camille updates the SARB regulatory capital return (BA 700) for the period in which the instrument is issued, reflecting the new Tier 1 / Tier 2 instrument. Emit `BA700UpdatedForCapitalInstrument { instrument_id, period, updated_at }` | `human` (Camille) + `system` | `@platform/tax/ba-return-engine` ✓ (partial) | BA 700 capital adequacy reporting must reflect the new instrument in the period of issuance. The BA return generation procedure (PROC-FIN-BA-01) is the downstream consumer. |

---

## 6. Reconciliation

- **Events produced:**
  - `CapitalIssuanceProposalInitiated { proposal_id, instrument_type, target_notional, rationale }` — Step 1.
  - `CapitalInstrumentTermSheetDrafted { proposal_id, instrument_type, ponv_clause_present }` — Step 2.
  - `CapitalIssuanceRiskApproved { proposal_id, risk_approved_by, stressed_cet1_post_issuance }` — Step 3.
  - `BoardResolutionRecorded { resolution_id, type: capital_issuance }` — Step 4.
  - `SARBNoObjectionApplicationSubmitted { proposal_id, submitted_at }` — Step 5 (AT1/Tier 2 only).
  - `SARBNoObjectionReceived { proposal_id, sarb_reference, received_at }` — Step 6 (AT1/Tier 2 only).
  - `CapitalInstrumentIssuanceMechanicsCompleted { proposal_id, settlement_channel }` — Step 7.
  - `CapitalInstrumentIssued { instrument_id, proposal_id, type, notional, ... }` — Step 8.
  - `LedgerEntryPosted { instrument_id, entry_type: capital_issuance }` — Step 9.
  - `BA700UpdatedForCapitalInstrument { instrument_id, period }` — Step 10.

- **Reconciliation invariants:**
  1. **Board authorisation gate:** Every `CapitalInstrumentIssued` event must have a preceding `BoardResolutionRecorded` event. No issuance without Board authority.
  2. **SARB no-objection gate:** Every `CapitalInstrumentIssued` event for an AT1 or Tier 2 instrument must have a preceding `SARBNoObjectionReceived` event. Vera checks at issuance.
  3. **Ledger reconciliation:** `CapitalInstrumentIssued.notional` matches the `LedgerEntryPosted.amount` for the issuance entry. Deviations are Vera findings.
  4. **Capital ratio post-issuance:** `BA700UpdatedForCapitalInstrument` emitted within 5 business days of `CapitalInstrumentIssued`. Delays are Vera findings.
  5. **PONV clause presence:** Every `CapitalInstrumentIssued` event for an AT1 instrument has `ponv_trigger` populated. Missing PONV clause is a critical Vera finding escalated to Camille + Helena + SARB immediately.

- **Failure mode:** Settlement fails (STRATE / correspondent bank) → `CapitalInstrumentSettlementFailed { instrument_id, reason }`. Eitan + Tomas investigate; issuance reverted if settlement not cured within T+2. SARB notified if a regulatory capital shortfall results.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CapitalInstrumentIssued` events | Event log | Permanent (instrument lifetime + 5 years) | Restricted |
| `BoardResolutionRecorded` events + Board minutes | Event log + document store | Permanent | Restricted |
| `SARBNoObjectionReceived` event + SARB letter | Event log + document store | Permanent (founding capital documents) | Restricted |
| Term sheet / Information Memorandum / Prospectus | Document store (BLAKE3-addressed) | Permanent | Restricted |
| STRATE ISIN registration confirmation | Document store | Permanent | Internal |
| `LedgerEntryPosted` events (capital issuance) | Event log | Permanent | Restricted |
| D1/2013 eligibility self-assessment | Document store | Permanent | Restricted |
| Capital instrument register (live projection) | `@platform/capital/instrument-issuance-engine` | Live | Restricted |

---

## 8. Manual steps

- **Step 1 — Camille capital position review:** Professional judgement on issuance timing, instrument mix, and market conditions cannot be automated.
- **Step 2 — Imani legal review of term sheet:** Legal review of PONV clause, D1/2013 compliance, and Companies Act s.38 requirements requires legal expertise; no automated substitute.
- **Step 3 — Helena stress-test sign-off:** CRO risk judgement on PONV proximity and stressed capital impact requires human accountable sign-off.
- **Step 4 — Board resolution:** Board authority is a statutory governance requirement; cannot be delegated or automated.
- **Step 5–6 — SARB no-objection process:** SARB engagement is a bilateral regulatory process; no automation possible.
- **Step 7 — Issuance mechanics:** Investor meetings, FSCA prospectus review, JSE listing process, and STRATE setup involve bilateral engagement with external parties.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| SARB declines no-objection | `SARBNoObjectionApplicationSubmitted` not followed by `Received` within 60 days, or SARB decline letter | Camille + Imani; term-sheet amendment; resubmission; Helena assesses interim capital position |
| Capital shortfall before issuance completes | Capital ratio projection alert in `@platform/capital/ratio-engine` | Camille + Helena; interim capital plan; SARB notification if below minimum |
| PONV trigger breached post-issuance | CET1 drops below 5.125% (AT1 write-down threshold) | Helena + Camille; `PONVTriggerBreached` event; AT1 write-down or conversion per instrument terms; SARB immediate notification; Board emergency meeting |
| Settlement failure (STRATE) | `CapitalInstrumentSettlementFailed` event | Eitan + Tomas; T+2 cure window; SARB notification if capital impact |
| Board resolution missing | Vera invariant check before `CapitalInstrumentIssued` | Immediate halt; Owen + Camille; Board meeting convened |

---

## 10. Related procedures

- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) (PROC-CAP-CRM-01) — ongoing CET1 / Tier 1 / LCR / NSFR monitoring that triggers the issuance review.
- [`ba-return-generation.md`](ba-return-generation.md) (PROC-FIN-BA-01) — BA 700 capital adequacy return; updated in Step 10 of this procedure.
- [`stress-test-cycle.md`](stress-test-cycle.md) (PROC-RISK-ST-01) — ICAAP adverse scenario results feed Step 3 (Helena risk sign-off).
- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) — institutional investors subscribing to AT1 / Tier 2 notes are onboarded as counterparties.
- [`month-end-close.md`](month-end-close.md) (PROC-FIN-MC-01) — capital instrument ledger entries are included in the period-close reconciliation.
- [`balance-sheet-substantiation.md`](balance-sheet-substantiation.md) (PROC-FIN-BSS-01) — capital instruments appear on the balance sheet; substantiated monthly by Bea.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Atlas (Core banking platform architect, engineering) | Initial draft — POPULATED. All 12 sections authored; CET1 / AT1 / Tier 2 instrument issuance lifecycle documented per Banks Act + D1/2013 + RRB Regulation 38–40; SARB no-objection gate and PONV trigger controls included; system capabilities marked PLANNED. |

---

## 12. Audit / assurance

- Vera at each `CapitalInstrumentIssued` event: Board authorisation gate (invariant 1), SARB no-objection gate (invariant 2), ledger reconciliation (invariant 3), BA700 timeliness (invariant 4), PONV clause presence for AT1 (invariant 5).
- Board Audit Committee receives an annual capital instrument register summary (instrument type, outstanding notional, Tier classification, coupon/dividend, remaining maturity, SARB references).
- Helena (CRO, governance) reviews PONV trigger proximity quarterly as part of the stress-test cycle.
- SARB PA may conduct periodic capital adequacy supervisory reviews; all instrument documentation available in the document store with < 5-business-day retrieval SLA.
