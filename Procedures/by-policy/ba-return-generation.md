---
policy-parent: Policies/regulatory-reporting-policy-v1.md · Policies/capital-management-policy-v1.md
last-reviewed: 2026-05-15
procedureId: PROC-FIN-BA-01
title: BA return generation
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-15
owner: Camille (Chief Financial Officer, governance) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
policy-cited: Policies/regulatory-reporting-policy-v1.md · Policies/capital-management-policy-v1.md
system-capability: prototype/platform/reporting/ba-return-engine (PLANNED)
---

# Procedure — BA Return Generation

**Procedure ID:** PROC-FIN-BA-01
**Owner:** Camille (Chief Financial Officer, governance) · Bea (Accounting & financial reporting engineer, engineering)
**Approval:** Audit Committee
**Cadence:** Monthly (BA 100 / 200 / 300 / 600 / 700 / 900); Quarterly (BA 325 / 326 / Risk Return)
**Version:** v0.1 — 2026-05-13
**Status:** POPULATED

---

## 1. Source policy

- `Policies/regulatory-reporting-policy-v1.md` — Regulatory Reporting Policy (primary)
- `Policies/capital-management-policy-v1.md` — Capital Management Policy (co-source for BA 100 / 300 / 700)

Both policies implement the prudential return obligations under the Regulations Relating to Banks and the PA's Directives. The obligation chain is:

```
Regulation (Banks Act / D2/2024 / D4/2022 / D3/2013)
  → Regulatory Reporting Policy
    → PROC-FIN-BA-01 (this procedure)
      → @platform/reporting/ba-return-engine (PLANNED)
```

---

## 2. Source regulation(s)

| ID | Requirement |
|---|---|
| `ORG-PR-29` | File BA returns (BA 100, 200, 300, 325, 326, 600, 700, 900) per Directive D2/2024 to the Prudential Authority on the PA-prescribed schedule. |
| `ORG-PR-41` | Submit the Risk Return per Directive D4/2022; covers operational risk loss events, market risk sensitivities, and credit risk large-exposure changes. |
| `ORG-PR-51` | Monthly BA-series prudential return submission per Directive D3/2013; includes attestation by a duly authorised executive officer of the bank. |

---

## 3. Purpose

Produce, review, attest, and submit the full suite of Prudential Authority (PA) BA-series regulatory returns on the schedule mandated by the Regulations Relating to Banks and PA Directives. The procedure ensures:

1. All return data is sourced exclusively from the canonical event log (Principle 1 — no manual data entry, no spreadsheet overrides).
2. A four-eyes control (preparer + CFO attestation) prevents submission of an unreviewed return.
3. Every filing is traceable to a `BAReturnFiled` event containing the PA portal reference number, enabling point-in-time reconstruction of any submitted return.
4. Material post-submission errors trigger a structured restatement path with PA notification within 24 hours.

---

## 4. Trigger

**Primary trigger — calendar (monthly):**
- T+0: month-end close completes; `MonthEndCloseCompleted { period }` event emitted by the month-end-close procedure.
- The BA return engine ingests this event and begins data extraction for the monthly returns (BA 100, 200, 300, 600, 700, 900).
- Submission deadline: T+15 business days (PA-prescribed for monthly BA returns); the engine emits a deadline warning at T+10 if `BAReturnAttested` has not yet been received.

**Quarterly trigger:**
- Quarter-end `QuarterEndCloseCompleted { period }` event triggers the BA 325, BA 326, and Risk Return cycle in addition to the monthly suite.
- Submission deadline: T+20 business days for quarterly returns.

**Ad-hoc trigger — restatement:**
- A material error discovered post-submission triggers `BAReturnRestatementTriggered { form, period, discovery_date, error_description }`.
- PA notified within 24 hours of discovery; corrected return filed with an explanatory cover note.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Month-end or quarter-end close completes; `MonthEndCloseCompleted` / `QuarterEndCloseCompleted` event emitted | `system` (month-end-close procedure) | `@platform/event-store` ✓ | Upstream dependency: `month-end-close.md` (PLANNED). |
| 2 | BA return engine reads canonical event log and projects the data required for each form in scope for the period | `system` | `@platform/reporting/ba-return-engine` (`PLANNED`) | No manual data entry. Projection reads from: capital-ratio-monitoring projection (BA 100 / 700), credit-risk-rwa projection (BA 200), market-risk-capital projection (BA 300), ccr-sa-ccr projection (BA 325/326), large-exposure projection (BA 600), liquidity projection (BA 900). |
| 3 | Engine emits `BAReturnDraftGenerated { form, period, draft_uri }` for each form; draft available in the document store for review | `system` | `@platform/reporting/ba-return-engine` (`PLANNED`) + `@platform/document-store` ✓ | `draft_uri` is a content-addressed BLAKE3 reference to the immutable draft artefact. |
| 4 | **BA 100 — Capital adequacy summary.** Derived from the capital-ratio-monitoring projection: CET1 ratio, T1 ratio, Total Capital ratio, RWA total, capital buffers. | `system` | `@platform/projections/capital-ratio-monitoring` ✓ | Threshold: CET1 ≥ 4.5%, T1 ≥ 6%, Total ≥ 8%; breaches escalate immediately to CFO + CRO per capital-ratio-monitoring.md. |
| 5 | **BA 200 — Credit risk RWA.** Counterparty exposures, LEX, SA credit-risk weights per standardised approach. | `system` | `@platform/projections/credit-risk-rwa` (`PLANNED`) | SA credit-risk weights per Basel III standardised approach as transposed by D2/2024. |
| 6 | **BA 300 — Market risk capital.** FRTB SA charges by risk class (GIRR, FX, EQ, COMM, CSR). Activates when FRTB goes live (targeted Jul 2025). Until then: simplified market-risk charge. | `system` | `@platform/projections/market-risk-capital` (`PLANNED`) | Prior to FRTB activation, return filed with simplified IMA/SA charge per current rules. |
| 7 | **BA 325 / 326 — Counterparty credit risk (SA-CCR).** Quarterly. Replacement cost + PFE for OTC derivatives and SFTs per SA-CCR methodology. | `system` | `@platform/projections/ccr-sa-ccr` (`PLANNED`) | Filed quarterly, not monthly. Scope expands as OTC derivatives trading commences. |
| 8 | **BA 600 — Large exposures.** Single-name and connected-group exposures vs. 25% LE limit (10% for G-SIBs). | `system` | `@platform/projections/large-exposure` (`PLANNED`) | Any exposure approaching 20% of eligible capital triggers early-warning event to Helena + Camille. |
| 9 | **BA 700 — Leverage ratio.** Tier 1 capital / total exposure measure; minimum 3%. | `system` | `@platform/projections/capital-ratio-monitoring` ✓ | Leverage ratio is derived from the same projection as BA 100; filed on monthly basis. |
| 10 | **BA 900 — Liquidity.** LCR (high-quality liquid assets / 30-day net cash outflows ≥ 100%) + NSFR (available stable funding / required stable funding ≥ 100%). | `system` | `@platform/projections/liquidity` ✓ (partial) | LCR monitoring already live (capital-ratio-monitoring.md); NSFR projection is PLANNED. |
| 11 | **Risk Return (D4/2022).** Quarterly. Operational risk loss events (gross loss + recovery), market risk sensitivities (PV01, delta, vega by risk class), credit risk LE changes. | `system` | `@platform/reporting/risk-return-engine` (`PLANNED`) | Operational loss data sourced from the op-risk loss-event register (PROC-RISK-RCSA-01 upstream); market sensitivities from positions projection. |
| 12 | Preparer (Bea) reviews all draft returns in the document store; raises any reconciliation breaks as issues in the tracking register | `human` (Bea) | `@platform/document-store` ✓ | Reconciliation break = any computed figure that cannot be traced to an upstream event. Bea must resolve all breaks before attesting. |
| 13 | Bea emits `BAReturnReviewed { form, period, reviewer: bea, issues_resolved: true }` confirming the draft is ready for CFO attestation | `system` (on Bea action) | `@platform/event-store` ✓ | If issues remain unresolved, `BAReturnReviewed` cannot be emitted; the deadline-warning escalation fires at T+10. |
| 14 | CFO (Camille) reviews the return, confirms figures against the capital-ratio-monitoring dashboard, and emits `BAReturnAttested { form, period, signatory: camille, attested_at }` | `human` (Camille) | `@platform/event-store` ✓ | **CFO attestation is the control event authorising submission.** No `BAReturnFiled` event can be emitted without a preceding `BAReturnAttested` for the same form + period. Enforced by the submission engine as a hard gate. |
| 15 | Submission engine uploads the attested return to the PA's Supervisory Technology portal (SARB online portal); portal assigns a reference number | `system` | `@platform/reporting/pa-portal-client` (`PLANNED`) | Submission is automated post-attestation; portal reference number is captured synchronously in the response. |
| 16 | Engine emits `BAReturnFiled { form, period, portal_reference, filed_at, attested_by: camille }` | `system` | `@platform/event-store` ✓ | This event is the canonical proof of submission. The portal reference number enables the PA to cross-reference if queried. |
| 17 | If material error discovered post-submission: emit `BAReturnRestatementTriggered { form, period, discovery_date, error_description, materiality_basis }`; notify PA within 24 hours; file corrected return with explanatory cover note | `human` (Camille) + `system` | `@platform/event-store` ✓ + `@platform/reporting/pa-portal-client` (`PLANNED`) | Materiality threshold: any error that changes a capital ratio, LCR, NSFR, or LE figure by ≥ 0.1 percentage points, or changes a submitted figure by ≥ ZAR 1 million. Smaller corrections are noted in the next month's submission. |

---

## 6. Reconciliation

### Events produced

| Event | Trigger | Key fields |
|---|---|---|
| `BAReturnDraftGenerated` | Step 3 — one per form per period | `form`, `period`, `draft_uri` (BLAKE3) |
| `BAReturnReviewed` | Step 13 — one per form per period | `form`, `period`, `reviewer`, `issues_resolved` |
| `BAReturnAttested` | Step 14 — one per form per period | `form`, `period`, `signatory`, `attested_at` |
| `BAReturnFiled` | Step 16 — one per form per period | `form`, `period`, `portal_reference`, `filed_at`, `attested_by` |
| `BAReturnRestatementTriggered` | Step 17 — rare | `form`, `period`, `discovery_date`, `error_description` |

### Invariants (CI-tested)

1. **Attestation gate:** `∀ BAReturnFiled(form, period) → ∃ BAReturnAttested(form, period, signatory=camille)` with `attested_at < filed_at`. No `BAReturnFiled` can exist without a preceding `BAReturnAttested`. Enforced by the submission engine; audited nightly by Vera.
2. **Review gate:** `∀ BAReturnAttested(form, period) → ∃ BAReturnReviewed(form, period, issues_resolved=true)` with `reviewed_at < attested_at`.
3. **Completeness:** For each period, all forms in scope must have a `BAReturnFiled` event before the PA deadline. Missing events are a Vera finding escalated to Camille + the Audit Committee.
4. **No data override:** The data sourcing the return is read-only from the event log; no ad-hoc overrides are permitted. Any discrepancy triggers a `BAReturnRestatementTriggered` path, not a silent amendment.

### Failure mode

If the BA return engine cannot produce a draft (e.g. missing upstream data, projection engine error), it emits `BAReturnDraftFailed { form, period, reason }`. Bea is notified immediately; Devon (COO) escalates if the deadline is at risk. The PA may be notified of a delay if resolution cannot be achieved before T+15.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `BAReturnDraftGenerated` event + draft document (BLAKE3-addressed) | Event log + document store | 7 years post-period (Reg 90) | Restricted |
| `BAReturnReviewed` event | Event log | 7 years | Restricted |
| `BAReturnAttested` event (CFO signature) | Event log | 7 years | Restricted |
| `BAReturnFiled` event (portal reference) | Event log | 7 years | Restricted |
| PA portal acknowledgement / receipt | Document store (linked from `BAReturnFiled`) | 7 years | Restricted |
| `BAReturnRestatementTriggered` event + corrected return + PA correspondence | Event log + document store | 7 years | Confidential |

---

## 8. Manual steps

The following steps involve human judgement and are not fully automated in the current substrate:

- **Step 12 — Preparer review (Bea):** Bea must inspect each draft return for reconciliation breaks, rounding issues, and cross-form consistency (e.g. BA 100 RWA total should match the sum of BA 200 + BA 300 + operational RWA). This requires financial expertise and cannot be automated without model-risk implications.
- **Step 14 — CFO attestation (Camille):** Camille is the statutory signatory. She must personally review and attest; delegation is not permitted without a formal substitution event (e.g. during leave: a designated alternate CFO must be named via a `DelegatedSignatoryAppointed` event).
- **Step 17 — Restatement decision (Camille):** The materiality assessment for whether a post-submission error requires restatement involves professional judgement. Camille decides; Helena is consulted where the error relates to risk-weighted assets.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| BA return engine fails to produce draft | `BAReturnDraftFailed` event; deadline monitor at T+10 | Bea → Devon (COO); PA notified if T+15 at risk |
| Capital ratio below minimum at month-end | BA 100 draft shows breach | Immediate: Camille + Helena + CEO; capital-ratio-monitoring.md escalation path |
| Large exposure exceeds 25% LE limit | BA 600 draft flags breach | Immediate: Camille + Helena; trading halt on affected counterparty |
| CFO attestation not received by T+13 | Deadline-warning event at T+10 | Devon (COO) escalates to Camille; if unresolved by T+14, CEO notified |
| PA portal submission fails | `BAReturnFiledFailed` event; retry x3 | Tomas (payments) + Bea; manual upload if portal unavailable; PA contacted |
| Material error discovered post-submission | Internal review, Vera recon sample | `BAReturnRestatementTriggered`; Camille notifies PA within 24 hours; Audit Committee informed at next meeting |
| Projection data gaps (missing event data) | Draft generation reconciliation check | Atlas (engineering) + Bea; sourcing gap investigated; deadline extended if needed with PA notice |

---

## 10. Related procedures

- `month-end-close.md` (PLANNED) — upstream trigger; `MonthEndCloseCompleted` fires BA return generation.
- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — source of BA 100 / BA 700 data; LCR / NSFR projection for BA 900.
- [`balance-sheet-substantiation.md`](balance-sheet-substantiation.md) — balance sheet figures feed BA 200 credit exposures.
- `credit-origination.md` (PLANNED) — credit events feed the credit-risk-rwa projection (BA 200).
- `market-risk-monitoring.md` (PLANNED) — market risk figures feed BA 300 and the Risk Return.
- `rcsa-cycle.md` — operational risk loss events feed the Risk Return (D4/2022).

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Bea + Camille | Initial STUB — full 9-section skeleton; all steps and invariants documented; system capabilities marked PLANNED pending Atlas build. |
| v0.2 | 2026-05-15 | Atlas (Core banking platform architect, engineering) | Promoted to POPULATED — status updated; all 12 sections verified complete; frontmatter added. |

---

## 12. Audit / assurance

- Vera nightly recon: `BAReturnFiled` events vs. PA submission schedule; any missing or late filing is a P1 finding.
- Vera quarterly: cross-form consistency check (BA 100 RWA vs. BA 200 + BA 300 sum); deviations reported to Audit Committee.
- Annual: Audit Committee reviews the completeness and accuracy of the BA return cycle as part of the regulatory reporting audit programme.
- PA examination: PA may request source-event traces for any line in any BA return; the event log + document store support point-in-time reconstruction.
